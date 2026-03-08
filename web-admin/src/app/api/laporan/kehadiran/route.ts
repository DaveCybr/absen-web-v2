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

    // Ambil semua absensi bulan ini beserta data karyawan
    const { data: attendances, error } = await supabase
      .from("attendances")
      .select(
        `
        *,
        employee:employees!attendances_employee_id_fkey(id, name, department, employee_id)
      `,
      )
      .gte("date", startDate)
      .lte("date", endDate)
      .order("date", { ascending: true });

    if (error) throw error;

    // Hitung jumlah hari kerja di bulan ini
    let workdays = 0;
    const cur = new Date(startDate);
    const end = new Date(endDate);
    while (cur <= end) {
      const day = cur.getDay();
      if (day !== 0 && day !== 6) workdays++;
      cur.setDate(cur.getDate() + 1);
    }

    // Rekap per karyawan
    const byEmployee: Record<
      string,
      {
        employee: {
          id: string;
          name: string;
          department: string;
          employee_id: string;
        };
        hadir: number;
        terlambat: number;
        pulang_awal: number;
        absen: number;
      }
    > = {};

    for (const att of attendances ?? []) {
      const emp = att.employee;
      if (!emp) continue;
      if (!byEmployee[emp.id]) {
        byEmployee[emp.id] = {
          employee: emp,
          hadir: 0,
          terlambat: 0,
          pulang_awal: 0,
          absen: workdays,
        };
      }
      byEmployee[emp.id].hadir++;
      byEmployee[emp.id].absen--;
      if (att.is_late) byEmployee[emp.id].terlambat++;
      if (att.is_early_leave) byEmployee[emp.id].pulang_awal++;
    }

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
        rows: Object.values(byEmployee),
        raw: attendances,
      },
    });
  } catch (err) {
    console.error("Laporan kehadiran error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
