import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { getTodayWIB } from "@/lib/attendance";
import {
  sendToMultipleDevices,
  buildNewLeaveRequestNotification,
} from "@/lib/fcm";
import { cleanupInvalidTokens } from "@/lib/fcm-cleanup";
import { formatDate } from "@/lib/utils";

// GET - List leave requests
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Ambil employee yang login untuk filter berdasarkan role
    const { data: currentEmployee } = await supabase
      .from("employees")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!currentEmployee) {
      return NextResponse.json(
        { error: "Employee not found" },
        { status: 404 },
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = (page - 1) * limit;

    let query = supabase
      .from("leave_requests")
      .select(
        `
        *,
        employee:employees!leave_requests_employee_id_fkey(*),
        leave_type:leave_types(*),
        approver:employees!leave_requests_approved_by_fkey(id, name)
      `,
        { count: "exact" },
      )
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    // ✅ FIX [C3]: Employee hanya bisa lihat request miliknya sendiri
    // Admin bisa lihat semua
    if (currentEmployee.role !== "admin") {
      query = query.eq("employee_id", currentEmployee.id);
    } else {
      // Admin bisa filter by employee_id tertentu jika perlu
      const employeeId = searchParams.get("employee_id");
      if (employeeId) {
        query = query.eq("employee_id", employeeId);
      }
    }

    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    const { data, error, count } = await query;
    if (error) throw error;

    return NextResponse.json({
      success: true,
      data,
      pagination: {
        total: count || 0,
        page,
        limit,
        has_more: (count || 0) > offset + limit,
      },
    });
  } catch (error) {
    console.error("Get leave requests error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// POST - Create leave request
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // ✅ FIX [C3]: Ambil employee_id dari session, bukan dari body
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: employee, error: empError } = await supabase
      .from("employees")
      .select("id, name, is_active")
      .eq("user_id", user.id)
      .single();

    if (empError || !employee) {
      return NextResponse.json(
        { error: "Data karyawan tidak ditemukan" },
        { status: 404 },
      );
    }

    if (!employee.is_active) {
      return NextResponse.json(
        { error: "Akun Anda sudah dinonaktifkan" },
        { status: 403 },
      );
    }

    const body = await request.json();
    const { leave_type_id, start_date, end_date, reason } = body;

    if (!leave_type_id || !start_date || !end_date) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    const start = new Date(start_date);
    const end = new Date(end_date);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return NextResponse.json(
        { error: "Format tanggal tidak valid" },
        { status: 400 },
      );
    }

    if (end < start) {
      return NextResponse.json(
        { error: "Tanggal selesai tidak boleh sebelum tanggal mulai" },
        { status: 400 },
      );
    }

    // ✅ FIX [H2]: Validasi tanggal tidak boleh masa lalu
    const today = getTodayWIB();
    if (start_date < today) {
      return NextResponse.json(
        { error: "Tidak bisa mengajukan cuti untuk tanggal yang sudah lewat" },
        { status: 400 },
      );
    }

    // ✅ FIX [H3]: Hitung hari kerja saja (exclude Sabtu & Minggu)
    const totalDays = countWorkdays(start, end);

    if (totalDays === 0) {
      return NextResponse.json(
        { error: "Tidak ada hari kerja dalam rentang tanggal yang dipilih" },
        { status: 400 },
      );
    }

    // Validasi maksimum 30 hari kerja per request
    if (totalDays > 30) {
      return NextResponse.json(
        { error: "Maksimum pengajuan cuti adalah 30 hari kerja per request" },
        { status: 400 },
      );
    }

    const year = start.getFullYear();

    // Cek saldo cuti
    const { data: balance, error: balanceError } = await supabase
      .from("leave_balances")
      .select("*")
      .eq("employee_id", employee.id)
      .eq("leave_type_id", leave_type_id)
      .eq("year", year)
      .single();

    if (balanceError && balanceError.code !== "PGRST116") {
      throw balanceError;
    }

    if (!balance) {
      return NextResponse.json(
        { error: "Saldo cuti tidak ditemukan. Hubungi admin." },
        { status: 400 },
      );
    }

    if (balance.remaining < totalDays) {
      return NextResponse.json(
        {
          error: `Saldo cuti tidak cukup. Sisa saldo: ${balance.remaining} hari kerja, dibutuhkan: ${totalDays} hari kerja.`,
        },
        { status: 400 },
      );
    }

    // Cek overlap
    const { data: overlapping, error: overlapError } = await supabase
      .from("leave_requests")
      .select("id, start_date, end_date, status")
      .eq("employee_id", employee.id)
      .in("status", ["pending", "approved"])
      .lte("start_date", end_date)
      .gte("end_date", start_date);

    if (overlapError) throw overlapError;

    if (overlapping && overlapping.length > 0) {
      return NextResponse.json(
        { error: "Anda sudah memiliki pengajuan cuti pada periode yang sama" },
        { status: 400 },
      );
    }

    // Buat leave request
    const { data, error } = await supabase
      .from("leave_requests")
      .insert({
        employee_id: employee.id, // dari session, bukan dari body
        leave_type_id,
        start_date,
        end_date,
        total_days: totalDays,
        reason: reason || null,
        status: "pending",
      })
      .select(
        `
        *,
        employee:employees!leave_requests_employee_id_fkey(id, name),
        leave_type:leave_types(name)
      `,
      )
      .single();

    if (error) throw error;

    // Kirim notifikasi ke admin (fire and forget)
    notifyAdmins(supabase, data).catch(console.error);

    return NextResponse.json({
      success: true,
      data,
      message: `Pengajuan cuti berhasil dikirim (${totalDays} hari kerja)`,
    });
  } catch (error) {
    console.error("Create leave request error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * ✅ FIX [H3]: Hitung jumlah hari kerja (Senin-Jumat) antara dua tanggal
 * Tidak termasuk Sabtu dan Minggu
 */
function countWorkdays(start: Date, end: Date): number {
  let count = 0;
  const current = new Date(start);
  current.setHours(0, 0, 0, 0);

  const endDate = new Date(end);
  endDate.setHours(0, 0, 0, 0);

  while (current <= endDate) {
    const dayOfWeek = current.getDay();
    // 0 = Minggu, 6 = Sabtu
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }

  return count;
}

/**
 * Kirim notifikasi ke semua admin yang punya FCM token
 */
async function notifyAdmins(
  supabase: Awaited<
    ReturnType<typeof import("@/lib/supabase/server").createClient>
  >,
  leaveRequest: {
    id: string;
    total_days: number;
    start_date: string;
    end_date: string;
    employee: { name: string } | null;
    leave_type: { name: string } | null;
  },
) {
  const { data: admins } = await supabase
    .from("employees")
    .select("fcm_token")
    .eq("role", "admin")
    .eq("is_active", true)
    .not("fcm_token", "is", null);

  if (!admins || admins.length === 0) return;

  const adminTokens = admins
    .map((a) => a.fcm_token)
    .filter(Boolean) as string[];

  if (adminTokens.length === 0) return;

  const notification = buildNewLeaveRequestNotification({
    employeeName: leaveRequest.employee?.name || "Karyawan",
    leaveTypeName: leaveRequest.leave_type?.name || "Cuti",
    startDate: formatDate(leaveRequest.start_date, { month: "short" }),
    endDate: formatDate(leaveRequest.end_date, { month: "short" }),
    totalDays: leaveRequest.total_days,
    leaveRequestId: leaveRequest.id,
  });

  const result = await sendToMultipleDevices(adminTokens, notification);

  if (result.invalidTokens.length > 0) {
    cleanupInvalidTokens(result.invalidTokens);
  }
}
