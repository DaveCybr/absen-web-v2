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

    // Hitung hari kerja bulan ini
    let workdays = 0;
    const cur = new Date(startDate);
    const end = new Date(endDate);
    while (cur <= end) {
      if (cur.getDay() !== 0 && cur.getDay() !== 6) workdays++;
      cur.setDate(cur.getDate() + 1);
    }

    // Ambil semua karyawan aktif
    const { data: employees } = await supabase
      .from("employees")
      .select("id, name, department, employee_id, position")
      .eq("is_active", true)
      .order("name");

    if (!employees)
      return NextResponse.json({
        success: true,
        data: { rows: [], by_department: [] },
      });

    // Absensi bulan ini
    const { data: attendances } = await supabase
      .from("attendances")
      .select(
        "employee_id, date, is_late, is_early_leave, check_in_time, check_out_time",
      )
      .gte("date", startDate)
      .lte("date", endDate);

    // Izin bulan ini (hanya approved)
    const { data: leaves } = await supabase
      .from("leave_requests")
      .select(
        "employee_id, leave_type_code, leave_type_label, total_days, status",
      )
      .gte("start_date", startDate)
      .lte("start_date", endDate)
      .eq("status", "approved");

    // Map data per employee
    const attMap: Record<string, typeof attendances> = {};
    for (const att of attendances ?? []) {
      if (!attMap[att.employee_id]) attMap[att.employee_id] = [];
      attMap[att.employee_id]!.push(att);
    }

    const leaveMap: Record<string, number> = {};
    for (const leave of leaves ?? []) {
      leaveMap[leave.employee_id] =
        (leaveMap[leave.employee_id] ?? 0) + (leave.total_days ?? 0);
    }

    // Rekap per karyawan
    const rows = employees.map((emp) => {
      const atts = attMap[emp.id] ?? [];
      const hadir = atts.length;
      const terlambat = atts.filter((a) => a.is_late).length;
      const izin_hari = leaveMap[emp.id] ?? 0;
      const absen = Math.max(0, workdays - hadir - izin_hari);
      const pct = workdays > 0 ? Math.round((hadir / workdays) * 100) : 0;

      return {
        employee: emp,
        hadir,
        terlambat,
        pulang_awal: atts.filter((a) => a.is_early_leave).length,
        izin_hari,
        absen,
        workdays,
        attendance_pct: pct,
      };
    });

    // Rekap per departemen
    const deptMap: Record<
      string,
      {
        department: string;
        total_karyawan: number;
        total_hadir: number;
        total_terlambat: number;
        total_izin: number;
        total_absen: number;
        avg_pct: number;
      }
    > = {};

    for (const row of rows) {
      const dept = row.employee.department || "Tidak Ada";
      if (!deptMap[dept]) {
        deptMap[dept] = {
          department: dept,
          total_karyawan: 0,
          total_hadir: 0,
          total_terlambat: 0,
          total_izin: 0,
          total_absen: 0,
          avg_pct: 0,
        };
      }
      deptMap[dept].total_karyawan++;
      deptMap[dept].total_hadir += row.hadir;
      deptMap[dept].total_terlambat += row.terlambat;
      deptMap[dept].total_izin += row.izin_hari;
      deptMap[dept].total_absen += row.absen;
      deptMap[dept].avg_pct += row.attendance_pct;
    }

    const byDepartment = Object.values(deptMap).map((d) => ({
      ...d,
      avg_pct: Math.round(d.avg_pct / d.total_karyawan),
    }));

    return NextResponse.json({
      success: true,
      data: {
        period: {
          month,
          year,
          start_date: startDate,
          end_date: endDate,
          workdays,
        },
        rows,
        by_department: byDepartment,
      },
    });
  } catch (err) {
    console.error("Rekap error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
