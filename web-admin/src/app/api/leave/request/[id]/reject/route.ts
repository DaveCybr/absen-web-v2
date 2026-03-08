import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { sendToDevice, buildLeaveRejectedNotification } from "@/lib/fcm";
import { cleanupInvalidTokens } from "@/lib/fcm-cleanup";
import { formatDate } from "@/lib/utils";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = await createClient();
    const { id } = await params;
    const body = await request.json();
    const { reason } = body;

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
        { error: "Only admins can reject leave requests" },
        { status: 403 },
      );
    }

    const { data: leaveRequest, error: fetchError } = await supabase
      .from("leave_requests")
      .select(
        `
        *,
        employee:employees!leave_requests_employee_id_fkey(id, name, fcm_token)
      `,
      )
      .eq("id", id)
      .single();

    if (fetchError || !leaveRequest) {
      return NextResponse.json(
        { error: "Pengajuan izin tidak ditemukan" },
        { status: 404 },
      );
    }

    if (leaveRequest.status !== "pending") {
      return NextResponse.json(
        { error: "Hanya bisa menolak pengajuan yang berstatus pending" },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from("leave_requests")
      .update({
        status: "rejected",
        approved_by: adminEmployee.id,
        approved_at: new Date().toISOString(),
        rejection_reason: reason || null,
      })
      .eq("id", id)
      .select(
        `
        *,
        employee:employees!leave_requests_employee_id_fkey(*),
        approver:employees!leave_requests_approved_by_fkey(id, name)
      `,
      )
      .single();

    if (error) throw error;

    // Kirim FCM ke karyawan
    const fcmToken = leaveRequest.employee?.fcm_token;
    if (fcmToken) {
      const notification = buildLeaveRejectedNotification({
        leaveTypeName: leaveRequest.leave_type_label || "Izin",
        startDate: formatDate(leaveRequest.start_date, { month: "short" }),
        endDate: formatDate(leaveRequest.end_date, { month: "short" }),
        totalDays: leaveRequest.total_days,
        rejectionReason: reason,
        leaveRequestId: id,
      });

      sendToDevice(fcmToken, notification).then((result) => {
        if (result.tokenInvalid) {
          cleanupInvalidTokens([fcmToken]);
        }
      });
    }

    return NextResponse.json({
      success: true,
      data,
      message: "Pengajuan izin berhasil ditolak",
    });
  } catch (error) {
    console.error("Reject leave request error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
