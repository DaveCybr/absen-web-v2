import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

// PUT - Reject leave request
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = await createClient();
    const { id } = await params;
    const body = await request.json();
    const { reason } = body;

    // Get current user (admin)
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get admin employee record
    const { data: adminEmployee } = await supabase
      .from("employees")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!adminEmployee || adminEmployee.role !== "admin") {
      return NextResponse.json(
        { error: "Only admins can reject leave requests" },
        { status: 403 }
      );
    }

    // Get leave request
    const { data: leaveRequest, error: fetchError } = await supabase
      .from("leave_requests")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !leaveRequest) {
      return NextResponse.json(
        { error: "Leave request not found" },
        { status: 404 }
      );
    }

    if (leaveRequest.status !== "pending") {
      return NextResponse.json(
        { error: "Can only reject pending requests" },
        { status: 400 }
      );
    }

    // Reject the request
    const { data, error } = await supabase
      .from("leave_requests")
      .update({
        status: "rejected",
        approved_by: adminEmployee.id,
        approved_at: new Date().toISOString(),
        rejection_reason: reason || null,
      })
      .eq("id", id)
      .select("*, employee:employees(*), leave_type:leave_types(*)")
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data,
      message: "Leave request rejected",
    });
  } catch (error) {
    console.error("Reject leave request error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
