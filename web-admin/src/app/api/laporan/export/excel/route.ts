import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { resolvePython } from "@/lib/python";

// Nama bulan dalam bahasa Indonesia
const BULAN = [
  "",
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

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
    const type = searchParams.get("type") || "rekap"; // kehadiran | izin | rekap
    const month = parseInt(
      searchParams.get("month") || String(new Date().getMonth() + 1),
    );
    const year = parseInt(
      searchParams.get("year") || String(new Date().getFullYear()),
    );
    const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
    const endDate = new Date(year, month, 0).toISOString().split("T")[0];
    const periodLabel = `${BULAN[month]} ${year}`;

    // Fetch data sesuai tipe
    let payload: Record<string, unknown> = {};

    if (type === "kehadiran") {
      const { data } = await supabase
        .from("attendances")
        .select(
          `*, employee:employees!attendances_employee_id_fkey(id, name, department, employee_id)`,
        )
        .gte("date", startDate)
        .lte("date", endDate)
        .order("date", { ascending: true });
      payload = { type, period: periodLabel, month, year, rows: data ?? [] };
    } else if (type === "izin") {
      const { data } = await supabase
        .from("leave_requests")
        .select(
          `*, employee:employees!leave_requests_employee_id_fkey(id, name, department, employee_id), approver:employees!leave_requests_approved_by_fkey(id, name)`,
        )
        .gte("start_date", startDate)
        .lte("start_date", endDate)
        .order("start_date", { ascending: true });
      payload = { type, period: periodLabel, month, year, rows: data ?? [] };
    } else {
      // rekap
      let workdays = 0;
      const cur = new Date(startDate);
      const end = new Date(endDate);
      while (cur <= end) {
        if (cur.getDay() !== 0 && cur.getDay() !== 6) workdays++;
        cur.setDate(cur.getDate() + 1);
      }

      const [{ data: employees }, { data: attendances }, { data: leaves }] =
        await Promise.all([
          supabase
            .from("employees")
            .select("id, name, department, employee_id, position")
            .eq("is_active", true)
            .order("name"),
          supabase
            .from("attendances")
            .select("employee_id, date, is_late, is_early_leave")
            .gte("date", startDate)
            .lte("date", endDate),
          supabase
            .from("leave_requests")
            .select("employee_id, total_days")
            .gte("start_date", startDate)
            .lte("start_date", endDate)
            .eq("status", "approved"),
        ]);

      const attMap: Record<string, number> = {};
      const lateMap: Record<string, number> = {};
      for (const a of attendances ?? []) {
        attMap[a.employee_id] = (attMap[a.employee_id] ?? 0) + 1;
        if (a.is_late)
          lateMap[a.employee_id] = (lateMap[a.employee_id] ?? 0) + 1;
      }
      const leaveMap: Record<string, number> = {};
      for (const l of leaves ?? [])
        leaveMap[l.employee_id] =
          (leaveMap[l.employee_id] ?? 0) + (l.total_days ?? 0);

      const rows = (employees ?? []).map((emp) => ({
        ...emp,
        hadir: attMap[emp.id] ?? 0,
        terlambat: lateMap[emp.id] ?? 0,
        izin: leaveMap[emp.id] ?? 0,
        absen: Math.max(
          0,
          workdays - (attMap[emp.id] ?? 0) - (leaveMap[emp.id] ?? 0),
        ),
        pct:
          workdays > 0
            ? Math.round(((attMap[emp.id] ?? 0) / workdays) * 100)
            : 0,
      }));
      payload = { type, period: periodLabel, month, year, workdays, rows };
    }

    // Panggil Python script untuk generate Excel
    // AFTER
    const { exec } = await import("child_process");
    const { promisify } = await import("util");
    const { writeFileSync, readFileSync, unlinkSync } = await import("fs");
    const { join } = await import("path");
    const { tmpdir } = await import("os");
    const execAsync = promisify(exec);

    const ts = Date.now();
    const tmpIn = join(tmpdir(), `laporan_in_${ts}.json`);
    const tmpOut = join(
      tmpdir(),
      `laporan_${type}_${month}_${year}_${ts}.xlsx`,
    );

    writeFileSync(tmpIn, JSON.stringify(payload));

    const scriptPath = join(process.cwd(), "scripts", "laporan_excel.py");
    const python = await resolvePython();
    await execAsync(`"${python}" "${scriptPath}" "${tmpIn}" "${tmpOut}"`);

    const fileBuffer = readFileSync(tmpOut);
    unlinkSync(tmpIn);
    unlinkSync(tmpOut);

    const filename = `Laporan_${type}_${BULAN[month]}_${year}.xlsx`;

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error("Export Excel error:", err);
    return NextResponse.json(
      { error: "Gagal generate Excel" },
      { status: 500 },
    );
  }
}
