import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// GET - List leave requests
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    
    const employeeId = searchParams.get("employee_id");
    const status = searchParams.get("status");

    let query = supabase
      .from("leave_requests")
      .select("*, leave_type:leave_types(*), employee:employees(*)")
      .order("created_at", { ascending: false });

    if (employeeId) {
      query = query.eq("employee_id", employeeId);
    }

    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Get leave requests error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
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
        { status: 400 }
      );
    }

    // Calculate total days
    const start = new Date(start_date);
    const end = new Date(end_date);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    // Check leave balance
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
        { error: `Insufficient leave balance. You have ${balance.remaining} days remaining.` },
        { status: 400 }
      );
    }

    // Check for overlapping leave requests
    const { data: overlapping } = await supabase
      .from("leave_requests")
      .select("*")
      .eq("employee_id", employee_id)
      .in("status", ["pending", "approved"])
      .or(`start_date.lte.${end_date},end_date.gte.${start_date}`);

    if (overlapping && overlapping.length > 0) {
      return NextResponse.json(
        { error: "You already have a leave request for this period" },
        { status: 400 }
      );
    }

    // Create leave request
    const { data, error } = await supabase
      .from("leave_requests")
      .insert({
        employee_id,
        leave_type_id,
        start_date,
        end_date,
        total_days: totalDays,
        reason,
        status: "pending",
      })
      .select("*, leave_type:leave_types(*)")
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data,
      message: "Leave request submitted successfully",
    });
  } catch (error) {
    console.error("Create leave request error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
