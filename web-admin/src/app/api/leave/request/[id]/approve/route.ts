import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = await createClient();
    const { id } = await params;

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: adminEmployee } = await supabase
      .from("employees")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!adminEmployee || adminEmployee.role !== "admin") {
      return NextResponse.json(
        { error: "Only admins can approve leave requests" },
        { status: 403 },
      );
    }

    const { data: leaveRequest, error: fetchError } = await supabase
      .from("leave_requests")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !leaveRequest) {
      return NextResponse.json(
        { error: "Leave request not found" },
        { status: 404 },
      );
    }

    if (leaveRequest.status !== "pending") {
      return NextResponse.json(
        { error: "Can only approve pending requests" },
        { status: 400 },
      );
    }

    // ✅ FIX: Gunakan FK hint eksplisit pada select setelah update
    const { data, error } = await supabase
      .from("leave_requests")
      .update({
        status: "approved",
        approved_by: adminEmployee.id,
        approved_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select(
        `
        *,
        employee:employees!leave_requests_employee_id_fkey(*),
        leave_type:leave_types(*),
        approver:employees!leave_requests_approved_by_fkey(id, name)
      `,
      )
      .single();

    if (error) throw error;

    // Update leave balance
    await updateLeaveBalance(
      supabase,
      leaveRequest.employee_id,
      leaveRequest.leave_type_id,
      leaveRequest.total_days,
      new Date(leaveRequest.start_date).getFullYear(),
    );

    return NextResponse.json({
      success: true,
      data,
      message: "Pengajuan cuti berhasil disetujui",
    });
  } catch (error) {
    console.error("Approve leave request error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

async function updateLeaveBalance(
  supabase: Awaited<
    ReturnType<typeof import("@/lib/supabase/server").createClient>
  >,
  employeeId: string,
  leaveTypeId: string,
  totalDays: number,
  year: number,
) {
  try {
    const { data: balance } = await supabase
      .from("leave_balances")
      .select("id, used")
      .eq("employee_id", employeeId)
      .eq("leave_type_id", leaveTypeId)
      .eq("year", year)
      .single();

    if (balance) {
      await supabase
        .from("leave_balances")
        .update({ used: balance.used + totalDays })
        .eq("id", balance.id);
    } else {
      const { data: leaveType } = await supabase
        .from("leave_types")
        .select("default_quota")
        .eq("id", leaveTypeId)
        .single();

      await supabase.from("leave_balances").insert({
        employee_id: employeeId,
        leave_type_id: leaveTypeId,
        year,
        quota: leaveType?.default_quota || 0,
        used: totalDays,
      });
    }
  } catch (err) {
    console.error("Failed to update leave balance:", err);
  }
}
