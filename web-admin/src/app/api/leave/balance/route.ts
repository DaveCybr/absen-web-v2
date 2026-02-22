import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    
    const employeeId = searchParams.get("employee_id");
    const year = parseInt(searchParams.get("year") || new Date().getFullYear().toString());

    if (!employeeId) {
      return NextResponse.json(
        { error: "employee_id is required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("leave_balances")
      .select("*, leave_type:leave_types(*)")
      .eq("employee_id", employeeId)
      .eq("year", year);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data,
      year,
    });
  } catch (error) {
    console.error("Get leave balance error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
