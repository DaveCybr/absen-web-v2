import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    
    const employeeId = searchParams.get("employee_id");
    const startDate = searchParams.get("start_date");
    const endDate = searchParams.get("end_date");
    const limit = parseInt(searchParams.get("limit") || "30");
    const offset = parseInt(searchParams.get("offset") || "0");

    if (!employeeId) {
      return NextResponse.json(
        { error: "employee_id is required" },
        { status: 400 }
      );
    }

    let query = supabase
      .from("attendances")
      .select("*", { count: "exact" })
      .eq("employee_id", employeeId)
      .order("attendance_date", { ascending: false })
      .range(offset, offset + limit - 1);

    if (startDate) {
      query = query.gte("attendance_date", startDate);
    }

    if (endDate) {
      query = query.lte("attendance_date", endDate);
    }

    const { data, error, count } = await query;

    if (error) {
      throw error;
    }

    // Calculate summary stats
    const summary = {
      total_days: count || 0,
      present_days: data?.filter((a) => a.status === "present").length || 0,
      late_days: data?.filter((a) => a.status === "late").length || 0,
      absent_days: data?.filter((a) => a.status === "absent").length || 0,
      leave_days: data?.filter((a) => a.status === "leave").length || 0,
      total_work_minutes: data?.reduce((acc, a) => acc + (a.work_duration_minutes || 0), 0) || 0,
      total_late_minutes: data?.reduce((acc, a) => acc + (a.late_minutes || 0), 0) || 0,
    };

    return NextResponse.json({
      success: true,
      data,
      summary,
      pagination: {
        total: count,
        limit,
        offset,
        has_more: (count || 0) > offset + limit,
      },
    });
  } catch (error) {
    console.error("Get attendance history error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
