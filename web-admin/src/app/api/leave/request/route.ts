import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// GET - List leave requests
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    const employeeId = searchParams.get("employee_id");
    const status = searchParams.get("status");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = (page - 1) * limit;

    // ✅ FIX: Gunakan FK hint eksplisit
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

    if (employeeId) {
      query = query.eq("employee_id", employeeId);
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
    const body = await request.json();

    const { employee_id, leave_type_id, start_date, end_date, reason } = body;

    if (!employee_id || !leave_type_id || !start_date || !end_date) {
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

    const diffTime = Math.abs(end.getTime() - start.getTime());
    const totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    const year = start.getFullYear();
    const { data: balance, error: balanceError } = await supabase
      .from("leave_balances")
      .select("*")
      .eq("employee_id", employee_id)
      .eq("leave_type_id", leave_type_id)
      .eq("year", year)
      .single();

    if (balanceError && balanceError.code !== "PGRST116") {
      throw balanceError;
    }

    if (balance && balance.remaining < totalDays) {
      return NextResponse.json(
        {
          error: `Saldo cuti tidak cukup. Sisa saldo: ${balance.remaining} hari, dibutuhkan: ${totalDays} hari.`,
        },
        { status: 400 },
      );
    }

    // ✅ FIX: Query overlap yang benar
    const { data: overlapping, error: overlapError } = await supabase
      .from("leave_requests")
      .select("id, start_date, end_date, status")
      .eq("employee_id", employee_id)
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

    const { data, error } = await supabase
      .from("leave_requests")
      .insert({
        employee_id,
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
        leave_type:leave_types(*)
      `,
      )
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data,
      message: "Pengajuan cuti berhasil dikirim",
    });
  } catch (error) {
    console.error("Create leave request error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
