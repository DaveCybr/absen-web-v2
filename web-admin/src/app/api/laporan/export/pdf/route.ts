import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { resolvePython } from "@/lib/python";

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
    const type = searchParams.get("type") || "rekap";
    const month = parseInt(
      searchParams.get("month") || String(new Date().getMonth() + 1),
    );
    const year = parseInt(
      searchParams.get("year") || String(new Date().getFullYear()),
    );
    const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
    const endDate = new Date(year, month, 0).toISOString().split("T")[0];
    const periodLabel = `${BULAN[month]} ${year}`;

    let payload: Record<string, unknown> = {
      type,
      period: periodLabel,
      month,
      year,
    };

    if (type === "rekap") {
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
            .select("id, name, department, employee_id")
            .eq("is_active", true)
            .order("name"),
          supabase
            .from("attendances")
            .select("employee_id, is_late")
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
      payload = { ...payload, workdays, rows };
    } else if (type === "izin") {
      const { data } = await supabase
        .from("leave_requests")
        .select(
          `*, employee:employees!leave_requests_employee_id_fkey(id, name, department)`,
        )
        .gte("start_date", startDate)
        .lte("start_date", endDate)
        .order("start_date");
      payload = { ...payload, rows: data ?? [] };
    }

    const { exec } = await import("child_process");
    const { promisify } = await import("util");
    const { writeFileSync, readFileSync, unlinkSync } = await import("fs");
    const { join } = await import("path");
    const { tmpdir } = await import("os");
    const execAsync = promisify(exec);

    const ts = Date.now();
    const tmpIn = join(tmpdir(), `laporanpdf_in_${ts}.json`);
    const tmpOut = join(tmpdir(), `laporan_${type}_${month}_${year}_${ts}.pdf`);

    writeFileSync(tmpIn, JSON.stringify(payload));
    const scriptPath = join(process.cwd(), "scripts", "laporan_pdf.py");
    const python = await resolvePython();
    await execAsync(`"${python}" "${scriptPath}" "${tmpIn}" "${tmpOut}"`);

    const fileBuffer = readFileSync(tmpOut);
    unlinkSync(tmpIn);
    unlinkSync(tmpOut);

    const filename = `Laporan_${type}_${BULAN[month]}_${year}.pdf`;
    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error("Export PDF error:", err);
    return NextResponse.json({ error: "Gagal generate PDF" }, { status: 500 });
  }
}
