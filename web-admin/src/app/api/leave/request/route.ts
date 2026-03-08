import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { getTodayWIB } from "@/lib/attendance";
import {
  sendToMultipleDevices,
  buildNewLeaveRequestNotification,
} from "@/lib/fcm";
import { cleanupInvalidTokens } from "@/lib/fcm-cleanup";
import { formatDate } from "@/lib/utils";
import { LEAVE_TYPES, type LeaveTypeCode } from "@/lib/leave-types";

// =====================================================
// KONSTANTA
// =====================================================

/**
 * Jenis izin yang tersedia (fixed — tidak dari DB)
 * code digunakan sebagai identifier unik
 */

/** Maksimum hari kerja per pengajuan izin */
const MAX_WORKDAYS = 3;

/** Maksimum panjang alasan */
const MAX_REASON_LENGTH = 500;

/** Konfigurasi attachment */
const ATTACHMENT_BUCKET = "leave-attachments";
const ATTACHMENT_MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ATTACHMENT_ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
];

// =====================================================
// GET — List pengajuan izin
// =====================================================

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
        approver:employees!leave_requests_approved_by_fkey(id, name)
      `,
        { count: "exact" },
      )
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    // Employee hanya bisa lihat miliknya, admin bisa lihat semua
    if (currentEmployee.role !== "admin") {
      query = query.eq("employee_id", currentEmployee.id);
    } else {
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

// =====================================================
// POST — Buat pengajuan izin baru
// =====================================================

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Ambil employee dari session
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

    // ── Parse FormData (support file upload) ─────────
    // Content-Type: multipart/form-data
    const formData = await request.formData();
    const leave_type_code = formData.get("leave_type_code") as string | null;
    const start_date = formData.get("start_date") as string | null;
    const end_date = formData.get("end_date") as string | null;
    const reason = formData.get("reason") as string | null;
    const attachmentFile = formData.get("attachment") as File | null;

    // ── Validasi field wajib ──────────────────────────
    if (!leave_type_code || !start_date || !end_date) {
      return NextResponse.json(
        { error: "Jenis izin, tanggal mulai, dan tanggal selesai wajib diisi" },
        { status: 400 },
      );
    }

    // ── Validasi jenis izin ───────────────────────────
    const validCodes = LEAVE_TYPES.map((t) => t.code);
    if (!validCodes.includes(leave_type_code as LeaveTypeCode)) {
      return NextResponse.json(
        {
          error: `Jenis izin tidak valid. Pilihan: ${validCodes.join(", ")}`,
        },
        { status: 400 },
      );
    }

    const leaveType = LEAVE_TYPES.find((t) => t.code === leave_type_code)!;

    // ── Validasi format tanggal ───────────────────────
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

    // ── Validasi tidak boleh tanggal lampau ───────────
    const today = getTodayWIB();
    if (start_date < today) {
      return NextResponse.json(
        { error: "Tidak bisa mengajukan izin untuk tanggal yang sudah lewat" },
        { status: 400 },
      );
    }

    // ── Hitung hari kerja ─────────────────────────────
    const totalDays = countWorkdays(start, end);

    if (totalDays === 0) {
      return NextResponse.json(
        { error: "Tidak ada hari kerja dalam rentang tanggal yang dipilih" },
        { status: 400 },
      );
    }

    // ── Validasi maksimal 3 hari kerja ────────────────
    if (totalDays > MAX_WORKDAYS) {
      return NextResponse.json(
        {
          error: `Pengajuan izin maksimal ${MAX_WORKDAYS} hari kerja. Anda memilih ${totalDays} hari kerja.`,
        },
        { status: 400 },
      );
    }

    // ── Validasi panjang alasan ───────────────────────
    if (reason && reason.length > MAX_REASON_LENGTH) {
      return NextResponse.json(
        { error: `Alasan maksimal ${MAX_REASON_LENGTH} karakter` },
        { status: 400 },
      );
    }

    // ── Validasi attachment (opsional) ───────────────
    if (attachmentFile) {
      if (!ATTACHMENT_ALLOWED_TYPES.includes(attachmentFile.type)) {
        return NextResponse.json(
          {
            error:
              "Format file tidak didukung. Gunakan JPG, PNG, WEBP, atau PDF.",
          },
          { status: 400 },
        );
      }
      if (attachmentFile.size > ATTACHMENT_MAX_BYTES) {
        return NextResponse.json(
          { error: "Ukuran file maksimal 5 MB." },
          { status: 400 },
        );
      }
    }

    // ── Cek overlap dengan izin yang sudah ada ────────
    const { data: overlapping, error: overlapError } = await supabase
      .from("leave_requests")
      .select("id, start_date, end_date, status, leave_type_code")
      .eq("employee_id", employee.id)
      .in("status", ["pending", "approved"])
      .lte("start_date", end_date)
      .gte("end_date", start_date);

    if (overlapError) throw overlapError;

    if (overlapping && overlapping.length > 0) {
      return NextResponse.json(
        {
          error: "Anda sudah memiliki pengajuan izin pada periode yang sama",
        },
        { status: 400 },
      );
    }

    // ── Upload attachment ke Storage (jika ada) ───────
    let attachmentUrl: string | null = null;
    let attachmentName: string | null = null;

    if (attachmentFile) {
      // Path: {user_id}/{leave_request_temp_id}_{filename}
      // Karena belum punya ID, pakai timestamp
      const ext = attachmentFile.name.split(".").pop();
      const safeName = attachmentFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const filePath = `${user.id}/${Date.now()}_${safeName}`;

      const arrayBuffer = await attachmentFile.arrayBuffer();
      const fileBuffer = new Uint8Array(arrayBuffer);

      const { error: uploadError } = await supabase.storage
        .from(ATTACHMENT_BUCKET)
        .upload(filePath, fileBuffer, {
          contentType: attachmentFile.type,
          upsert: false,
        });

      if (uploadError) {
        console.error("Upload attachment error:", uploadError);
        return NextResponse.json(
          { error: "Gagal mengunggah file. Coba lagi." },
          { status: 500 },
        );
      }

      attachmentUrl = filePath; // simpan path, bukan public URL (bucket private)
      attachmentName = attachmentFile.name;
    }

    // ── Insert pengajuan izin ─────────────────────────
    const { data, error } = await supabase
      .from("leave_requests")
      .insert({
        employee_id: employee.id,
        leave_type_code,
        leave_type_label: leaveType.label,
        start_date,
        end_date,
        total_days: totalDays,
        reason: reason?.trim() || null,
        status: "pending",
        attachment_url: attachmentUrl,
        attachment_name: attachmentName,
      })
      .select(
        `
        *,
        employee:employees!leave_requests_employee_id_fkey(id, name)
      `,
      )
      .single();

    if (error) throw error;

    // ── Notifikasi ke admin (fire and forget) ─────────
    notifyAdmins(supabase, data, leaveType.label).catch(console.error);

    return NextResponse.json({
      success: true,
      data,
      message: `Pengajuan izin ${leaveType.label} berhasil dikirim (${totalDays} hari kerja)`,
    });
  } catch (error) {
    console.error("Create leave request error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// =====================================================
// HELPERS
// =====================================================

/**
 * Hitung jumlah hari kerja (Senin–Jumat) antara dua tanggal (inklusif)
 */
function countWorkdays(start: Date, end: Date): number {
  let count = 0;
  const current = new Date(start);
  current.setHours(0, 0, 0, 0);

  const endDate = new Date(end);
  endDate.setHours(0, 0, 0, 0);

  while (current <= endDate) {
    const day = current.getDay();
    if (day !== 0 && day !== 6) count++; // bukan Minggu (0) atau Sabtu (6)
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
  },
  leaveTypeLabel: string,
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
    leaveTypeName: leaveTypeLabel,
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
