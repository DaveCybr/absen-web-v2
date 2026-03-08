import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: admin } = await supabase
      .from("employees")
      .select("role")
      .eq("user_id", user.id)
      .single();
    if (admin?.role !== "admin")
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const month = parseInt(
      searchParams.get("month") || String(new Date().getMonth() + 1),
    );
    const year = parseInt(
      searchParams.get("year") || String(new Date().getFullYear()),
    );
    const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
    const endDate = new Date(year, month, 0).toISOString().split("T")[0];

    const { data: leaves, error } = await supabase
      .from("leave_requests")
      .select(
        `
        *,
        employee:employees!leave_requests_employee_id_fkey(id, name, department, employee_id),
        approver:employees!leave_requests_approved_by_fkey(id, name)
      `,
      )
      .gte("start_date", startDate)
      .lte("start_date", endDate)
      .order("start_date", { ascending: true });

    if (error) throw error;

    // Rekap per jenis izin
    const byType: Record<
      string,
      { label: string; count: number; total_days: number }
    > = {};
    for (const leave of leaves ?? []) {
      const code = leave.leave_type_code;
      if (!byType[code])
        byType[code] = {
          label: leave.leave_type_label,
          count: 0,
          total_days: 0,
        };
      byType[code].count++;
      byType[code].total_days += leave.total_days ?? 0;
    }

    // Rekap per status
    const byStatus = { pending: 0, approved: 0, rejected: 0, cancelled: 0 };
    for (const leave of leaves ?? []) {
      if (leave.status in byStatus)
        byStatus[leave.status as keyof typeof byStatus]++;
    }

    return NextResponse.json({
      success: true,
      data: {
        period: { month, year, start_date: startDate, end_date: endDate },
        summary: {
          by_type: Object.values(byType),
          by_status: byStatus,
          total: leaves?.length ?? 0,
        },
        rows: leaves,
      },
    });
  } catch (err) {
    console.error("Laporan izin error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
