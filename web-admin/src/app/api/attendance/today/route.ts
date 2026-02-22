import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { getTodayWIB } from "@/lib/attendance";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get("employee_id");

    if (!employeeId) {
      return NextResponse.json(
        { error: "employee_id is required" },
        { status: 400 },
      );
    }

    // ✅ FIX: Gunakan getTodayWIB() agar konsisten dengan check-in/check-out
    const today = getTodayWIB();

    const { data: attendance, error } = await supabase
      .from("attendances")
      .select("*")
      .eq("employee_id", employeeId)
      .eq("attendance_date", today)
      .single();

    if (error && error.code !== "PGRST116") {
      // PGRST116 = no rows found
      throw error;
    }

    return NextResponse.json({
      success: true,
      data: attendance || null,
      has_checked_in: !!attendance?.check_in_time,
      has_checked_out: !!attendance?.check_out_time,
    });
  } catch (error) {
    console.error("Get today attendance error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
