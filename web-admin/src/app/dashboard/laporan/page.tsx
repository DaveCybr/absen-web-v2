import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import {
  CalendarDays,
  Download,
  FileSpreadsheet,
  FileText,
  TrendingUp,
  Users,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from "lucide-react";
import { LaporanExportButtons } from "./laporan-export-buttons";

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

const TYPE_CHIP: Record<string, { bg: string; fg: string; border: string }> = {
  sakit: {
    bg: "rgba(220,38,38,0.07)",
    fg: "#B91C1C",
    border: "rgba(220,38,38,0.18)",
  },
  bepergian: {
    bg: "rgba(37,99,235,0.07)",
    fg: "#1D4ED8",
    border: "rgba(37,99,235,0.18)",
  },
  kepentingan: {
    bg: "rgba(217,119,6,0.07)",
    fg: "#B45309",
    border: "rgba(217,119,6,0.18)",
  },
};

const STATUS = {
  pending: { label: "Menunggu", dot: "#F59E0B", pill: "pill-pending" },
  approved: { label: "Disetujui", dot: "#22C55E", pill: "pill-approved" },
  rejected: { label: "Ditolak", dot: "#EF4444", pill: "pill-rejected" },
  cancelled: { label: "Dibatalkan", dot: "#94A3B8", pill: "pill-cancelled" },
};

interface PageProps {
  searchParams: Promise<{
    tab?: string;
    month?: string;
    year?: string;
    start?: string;
    end?: string;
  }>;
}

function workdaysInRange(start: string, end: string) {
  let count = 0;
  const cur = new Date(start),
    fin = new Date(end);
  while (cur <= fin) {
    if (cur.getDay() !== 0 && cur.getDay() !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

export default async function LaporanPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const now = new Date();
  const tab = params.tab || "rekap";

  // ── Periode ──────────────────────────────────────────────────
  let startDate: string, endDate: string, periodLabel: string;
  if (params.start && params.end) {
    startDate = params.start;
    endDate = params.end;
    periodLabel = `${formatDate(startDate, { month: "short" })} — ${formatDate(endDate, { month: "short" })}`;
  } else {
    const month = parseInt(params.month || String(now.getMonth() + 1));
    const year = parseInt(params.year || String(now.getFullYear()));
    startDate = `${year}-${String(month).padStart(2, "0")}-01`;
    endDate = new Date(year, month, 0).toISOString().split("T")[0];
    periodLabel = `${BULAN[month]} ${year}`;
  }

  const workdays = workdaysInRange(startDate, endDate);
  const supabase = await createClient();

  // ── Fetch data sesuai tab ─────────────────────────────────────
  let kehadiranData: unknown[] = [];
  let izinData: unknown[] = [];
  let rekapData: unknown[] = [];
  let deptData: unknown[] = [];
  let izinStats = { total: 0, approved: 0, rejected: 0, pending: 0 };

  if (tab === "kehadiran") {
    const { data } = await supabase
      .from("attendances")
      .select(
        `*, employee:employees!attendances_employee_id_fkey(id, name, department, employee_id)`,
      )
      .gte("date", startDate)
      .lte("date", endDate)
      .order("date", { ascending: true });
    kehadiranData = data ?? [];
  } else if (tab === "izin") {
    const { data } = await supabase
      .from("leave_requests")
      .select(
        `*, employee:employees!leave_requests_employee_id_fkey(id, name, department), approver:employees!leave_requests_approved_by_fkey(id, name)`,
      )
      .gte("start_date", startDate)
      .lte("start_date", endDate)
      .order("start_date", { ascending: true });
    izinData = data ?? [];
    izinStats = {
      total: izinData.length,
      approved: izinData.filter((r: any) => r.status === "approved").length,
      rejected: izinData.filter((r: any) => r.status === "rejected").length,
      pending: izinData.filter((r: any) => r.status === "pending").length,
    };
  } else {
    // rekap (default) + departemen
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
    const earlyMap: Record<string, number> = {};
    for (const a of attendances ?? []) {
      attMap[a.employee_id] = (attMap[a.employee_id] ?? 0) + 1;
      if (a.is_late) lateMap[a.employee_id] = (lateMap[a.employee_id] ?? 0) + 1;
      if (a.is_early_leave)
        earlyMap[a.employee_id] = (earlyMap[a.employee_id] ?? 0) + 1;
    }
    const leaveMap: Record<string, number> = {};
    for (const l of leaves ?? [])
      leaveMap[l.employee_id] =
        (leaveMap[l.employee_id] ?? 0) + (l.total_days ?? 0);

    rekapData = (employees ?? []).map((emp) => ({
      ...emp,
      hadir: attMap[emp.id] ?? 0,
      terlambat: lateMap[emp.id] ?? 0,
      pulang_awal: earlyMap[emp.id] ?? 0,
      izin: leaveMap[emp.id] ?? 0,
      absen: Math.max(
        0,
        workdays - (attMap[emp.id] ?? 0) - (leaveMap[emp.id] ?? 0),
      ),
      pct:
        workdays > 0 ? Math.round(((attMap[emp.id] ?? 0) / workdays) * 100) : 0,
    }));

    // Dept
    const deptMap: Record<string, any> = {};
    for (const r of rekapData as any[]) {
      const dept = r.department || "Tidak Ada";
      if (!deptMap[dept])
        deptMap[dept] = {
          department: dept,
          n: 0,
          hadir: 0,
          terlambat: 0,
          izin: 0,
          absen: 0,
          pct: 0,
        };
      deptMap[dept].n++;
      deptMap[dept].hadir += r.hadir;
      deptMap[dept].terlambat += r.terlambat;
      deptMap[dept].izin += r.izin;
      deptMap[dept].absen += r.absen;
      deptMap[dept].pct += r.pct;
    }
    deptData = Object.values(deptMap).map((d: any) => ({
      ...d,
      avg_pct: Math.round(d.pct / d.n),
    }));
  }

  // ── Param string untuk URL ────────────────────────────────────
  const monthParam = params.month || String(now.getMonth() + 1);
  const yearParam = params.year || String(now.getFullYear());
  const baseParams = params.start
    ? `start=${params.start}&end=${params.end}`
    : `month=${monthParam}&year=${yearParam}`;

  // ── Stat cards untuk rekap ────────────────────────────────────
  const avgPct = rekapData.length
    ? Math.round(
        (rekapData as any[]).reduce((s, r) => s + r.pct, 0) / rekapData.length,
      )
    : 0;
  const totalTerlambat = (rekapData as any[]).reduce(
    (s, r) => s + r.terlambat,
    0,
  );

  return (
    <>
      <style>{`
        .lp-page { display: flex; flex-direction: column; gap: 20px; }

        /* Header */
        .lp-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
        .lp-title  { font-size: 24px; font-weight: 800; color: var(--text-1); letter-spacing: -0.03em; margin-bottom: 4px; }
        .lp-sub    { font-size: 13.5px; color: var(--text-2); }

        /* Filter bar */
        .lp-filter {
          background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--r-lg); padding: 14px 18px;
          display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
          box-shadow: var(--shadow-xs);
        }
        .lp-filter-label { font-size: 12px; font-weight: 600; color: var(--text-3); }
        .lp-filter select, .lp-filter input {
          padding: 6px 10px; border-radius: var(--r-sm);
          border: 1px solid var(--border); background: var(--surface-2);
          font-size: 13px; color: var(--text-1);
          font-family: 'Plus Jakarta Sans', sans-serif;
        }
        .lp-filter-sep { height: 20px; width: 1px; background: var(--border); }
        .lp-filter-apply {
          padding: 6px 14px; border-radius: var(--r-sm);
          background: var(--navy-800); color: white;
          border: none; font-size: 13px; font-weight: 600;
          cursor: pointer; font-family: 'Plus Jakarta Sans', sans-serif;
          transition: opacity 0.13s;
        }
        .lp-filter-apply:hover { opacity: 0.88; }

        /* Stats */
        .lp-stats { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
        @media (min-width: 768px) { .lp-stats { grid-template-columns: repeat(4, 1fr); } }
        .lp-stat {
          background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--r-lg); padding: 16px;
          display: flex; align-items: center; gap: 12px;
          box-shadow: var(--shadow-xs);
        }
        .lp-stat-icon { width: 38px; height: 38px; border-radius: var(--r-md); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .lp-stat-val  { font-size: 22px; font-weight: 800; color: var(--text-1); letter-spacing: -0.03em; margin-bottom: 2px; }
        .lp-stat-lbl  { font-size: 12px; color: var(--text-3); font-weight: 500; }

        /* Tabs */
        .lp-tabs {
          background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--r-lg); padding: 6px;
          display: flex; gap: 4px; flex-wrap: wrap;
          box-shadow: var(--shadow-xs);
        }
        .lp-tab {
          padding: 8px 16px; border-radius: var(--r-md);
          font-size: 13px; font-weight: 500; color: var(--text-2);
          text-decoration: none; transition: background 0.13s, color 0.13s;
          border: 1px solid transparent;
        }
        .lp-tab:hover  { background: var(--surface-2); color: var(--text-1); }
        .lp-tab.active { background: var(--navy-800); color: white; font-weight: 600; }

        /* Panel */
        .lp-panel {
          background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--r-lg); box-shadow: var(--shadow-sm); overflow: hidden;
        }
        .lp-panel-head {
          padding: 14px 18px; border-bottom: 1px solid var(--border);
          display: flex; align-items: center; justify-content: space-between; gap: 12px;
        }
        .lp-panel-title { font-size: 14px; font-weight: 700; color: var(--text-1); }
        .lp-panel-meta  { font-size: 12px; color: var(--text-3); }

        /* Table */
        .lp-table-wrap { overflow-x: auto; }
        .lp-table { width: 100%; border-collapse: collapse; }
        .lp-table thead { background: var(--surface-2); }
        .lp-table th {
          padding: 9px 14px; font-size: 11px; font-weight: 700;
          color: var(--text-3); text-transform: uppercase;
          letter-spacing: 0.07em; text-align: left;
          border-bottom: 1px solid var(--border); white-space: nowrap;
        }
        .lp-table td {
          padding: 11px 14px; border-bottom: 1px solid var(--border);
          vertical-align: middle; font-size: 13px; color: var(--text-1);
        }
        .lp-table tr:last-child td { border-bottom: none; }
        .lp-table tbody tr:hover td { background: var(--surface-2); }
        .lp-table .td-num { font-size: 12px; color: var(--text-3); width: 36px; }
        .lp-table .td-emp { display: flex; align-items: center; gap: 10px; }
        .lp-table .td-avatar {
          width: 32px; height: 32px; border-radius: var(--r-sm);
          display: flex; align-items: center; justify-content: center;
          font-size: 12px; font-weight: 800; flex-shrink: 0;
          background: var(--surface-2); color: var(--text-2);
        }
        .lp-table .td-name  { font-size: 13px; font-weight: 600; color: var(--text-1); }
        .lp-table .td-dept  { font-size: 11.5px; color: var(--text-3); }

        /* Pct bar */
        .pct-wrap { display: flex; align-items: center; gap: 8px; }
        .pct-bar  { width: 60px; height: 5px; border-radius: 999px; background: var(--border); overflow: hidden; }
        .pct-fill { height: 100%; border-radius: 999px; }
        .pct-txt  { font-size: 12px; font-weight: 700; min-width: 32px; }

        /* Empty */
        .lp-empty { padding: 48px 24px; text-align: center; }
        .lp-empty-icon { width: 48px; height: 48px; border-radius: var(--r-lg); background: var(--surface-2); border: 1px solid var(--border); display: flex; align-items: center; justify-content: center; margin: 0 auto 12px; }
        .lp-empty-title { font-size: 13.5px; font-weight: 600; color: var(--text-2); }
        .lp-empty-desc  { font-size: 12.5px; color: var(--text-3); margin-top: 4px; }

        /* Chip */
        .lp-chip { display: inline-flex; align-items: center; padding: 2px 9px; border-radius: var(--r-sm); font-size: 12px; font-weight: 600; border: 1px solid; }
      `}</style>

      <div className="lp-page">
        {/* Header */}
        <div className="lp-header">
          <div>
            <h1 className="lp-title">Laporan</h1>
            <p className="lp-sub">
              Periode: <strong>{periodLabel}</strong> · {workdays} hari kerja
            </p>
          </div>
          <LaporanExportButtons baseParams={baseParams} tab={tab} />
        </div>

        {/* Filter */}
        <LaporanFilter
          tab={tab}
          monthParam={monthParam}
          yearParam={yearParam}
          startParam={params.start}
          endParam={params.end}
        />

        {/* Tabs */}
        <div className="lp-tabs">
          {[
            { label: "Rekap Karyawan", value: "rekap" },
            { label: "Per Departemen", value: "departemen" },
            { label: "Kehadiran Harian", value: "kehadiran" },
            { label: "Izin", value: "izin" },
          ].map((t) => (
            <a
              key={t.value}
              href={`/dashboard/laporan?tab=${t.value}&${baseParams}`}
              className={`lp-tab${tab === t.value ? " active" : ""}`}
            >
              {t.label}
            </a>
          ))}
        </div>

        {/* Konten tab */}
        {tab === "rekap" && (
          <>
            {/* Stats */}
            <div className="lp-stats">
              {[
                {
                  label: "Total Karyawan",
                  value: rekapData.length,
                  icon: Users,
                  color: "#2563EB",
                  bg: "rgba(37,99,235,0.08)",
                },
                {
                  label: "Rata-rata Hadir",
                  value: `${avgPct}%`,
                  icon: TrendingUp,
                  color: "#16A34A",
                  bg: "rgba(22,163,74,0.08)",
                },
                {
                  label: "Total Terlambat",
                  value: totalTerlambat,
                  icon: Clock,
                  color: "#D97706",
                  bg: "rgba(217,119,6,0.08)",
                },
                {
                  label: "Hari Kerja",
                  value: workdays,
                  icon: CalendarDays,
                  color: "#7C3AED",
                  bg: "rgba(124,58,237,0.08)",
                },
              ].map((card) => (
                <div key={card.label} className="lp-stat">
                  <div className="lp-stat-icon" style={{ background: card.bg }}>
                    <card.icon size={17} color={card.color} strokeWidth={2} />
                  </div>
                  <div>
                    <div className="lp-stat-val">{card.value}</div>
                    <div className="lp-stat-lbl">{card.label}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Tabel rekap */}
            <div className="lp-panel">
              <div className="lp-panel-head">
                <span className="lp-panel-title">Rekap Per Karyawan</span>
                <span className="lp-panel-meta">
                  {rekapData.length} karyawan
                </span>
              </div>
              {rekapData.length === 0 ? (
                <EmptyState />
              ) : (
                <div className="lp-table-wrap">
                  <table className="lp-table">
                    <thead>
                      <tr>
                        <th className="td-num">#</th>
                        <th>Karyawan</th>
                        <th>Hadir</th>
                        <th>Terlambat</th>
                        <th>Pulang Awal</th>
                        <th>Izin (hari)</th>
                        <th>Absen</th>
                        <th>Kehadiran</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(rekapData as any[]).map((r, i) => {
                        const pct = r.pct;
                        const pctColor =
                          pct >= 85
                            ? "#16A34A"
                            : pct >= 70
                              ? "#D97706"
                              : "#DC2626";
                        return (
                          <tr key={r.id}>
                            <td className="td-num">{i + 1}</td>
                            <td>
                              <div className="td-emp">
                                <div className="td-avatar">
                                  {r.name?.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <p className="td-name">{r.name}</p>
                                  <p className="td-dept">
                                    {r.department || "—"}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td>
                              <strong>{r.hadir}</strong>
                              <span
                                style={{
                                  color: "var(--text-3)",
                                  fontWeight: 400,
                                }}
                              >
                                /{workdays}
                              </span>
                            </td>
                            <td
                              style={{
                                color:
                                  r.terlambat > 0 ? "#D97706" : "var(--text-3)",
                              }}
                            >
                              {r.terlambat}
                            </td>
                            <td
                              style={{
                                color:
                                  r.pulang_awal > 0
                                    ? "#D97706"
                                    : "var(--text-3)",
                              }}
                            >
                              {r.pulang_awal}
                            </td>
                            <td>{r.izin || "—"}</td>
                            <td
                              style={{
                                color:
                                  r.absen > 0 ? "#DC2626" : "var(--text-3)",
                              }}
                            >
                              {r.absen || "—"}
                            </td>
                            <td>
                              <div className="pct-wrap">
                                <div className="pct-bar">
                                  <div
                                    className="pct-fill"
                                    style={{
                                      width: `${pct}%`,
                                      background: pctColor,
                                    }}
                                  />
                                </div>
                                <span
                                  className="pct-txt"
                                  style={{ color: pctColor }}
                                >
                                  {pct}%
                                </span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {tab === "departemen" && (
          <div className="lp-panel">
            <div className="lp-panel-head">
              <span className="lp-panel-title">Rekap Per Departemen</span>
              <span className="lp-panel-meta">
                {deptData.length} departemen
              </span>
            </div>
            {deptData.length === 0 ? (
              <EmptyState />
            ) : (
              <div className="lp-table-wrap">
                <table className="lp-table">
                  <thead>
                    <tr>
                      <th className="td-num">#</th>
                      <th>Departemen</th>
                      <th>Karyawan</th>
                      <th>Total Hadir</th>
                      <th>Total Terlambat</th>
                      <th>Total Izin</th>
                      <th>Total Absen</th>
                      <th>Avg Kehadiran</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(deptData as any[]).map((d, i) => {
                      const pct = d.avg_pct;
                      const pctColor =
                        pct >= 85
                          ? "#16A34A"
                          : pct >= 70
                            ? "#D97706"
                            : "#DC2626";
                      return (
                        <tr key={d.department}>
                          <td className="td-num">{i + 1}</td>
                          <td>
                            <strong>{d.department}</strong>
                          </td>
                          <td>{d.n}</td>
                          <td>{d.hadir}</td>
                          <td
                            style={{
                              color: d.terlambat > 0 ? "#D97706" : undefined,
                            }}
                          >
                            {d.terlambat || "—"}
                          </td>
                          <td>{d.izin || "—"}</td>
                          <td
                            style={{
                              color: d.absen > 0 ? "#DC2626" : undefined,
                            }}
                          >
                            {d.absen || "—"}
                          </td>
                          <td>
                            <div className="pct-wrap">
                              <div className="pct-bar">
                                <div
                                  className="pct-fill"
                                  style={{
                                    width: `${pct}%`,
                                    background: pctColor,
                                  }}
                                />
                              </div>
                              <span
                                className="pct-txt"
                                style={{ color: pctColor }}
                              >
                                {pct}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {tab === "kehadiran" && (
          <div className="lp-panel">
            <div className="lp-panel-head">
              <span className="lp-panel-title">Kehadiran Harian</span>
              <span className="lp-panel-meta">
                {kehadiranData.length} records
              </span>
            </div>
            {kehadiranData.length === 0 ? (
              <EmptyState />
            ) : (
              <div className="lp-table-wrap">
                <table className="lp-table">
                  <thead>
                    <tr>
                      <th className="td-num">#</th>
                      <th>Tanggal</th>
                      <th>Karyawan</th>
                      <th>Check In</th>
                      <th>Check Out</th>
                      <th>Terlambat</th>
                      <th>Pulang Awal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(kehadiranData as any[]).map((r, i) => (
                      <tr key={r.id}>
                        <td className="td-num">{i + 1}</td>
                        <td style={{ fontSize: 12.5, whiteSpace: "nowrap" }}>
                          {formatDate(r.date, { month: "short" })}
                        </td>
                        <td>
                          <div className="td-emp">
                            <div className="td-avatar">
                              {r.employee?.name?.charAt(0)}
                            </div>
                            <div>
                              <p className="td-name">{r.employee?.name}</p>
                              <p className="td-dept">
                                {r.employee?.department || "—"}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td style={{ fontSize: 12.5 }}>
                          {r.check_in_time || "—"}
                        </td>
                        <td style={{ fontSize: 12.5 }}>
                          {r.check_out_time || "—"}
                        </td>
                        <td>
                          {r.is_late ? (
                            <span
                              style={{
                                color: "#D97706",
                                fontWeight: 600,
                                fontSize: 12,
                              }}
                            >
                              Ya
                            </span>
                          ) : (
                            <span
                              style={{ color: "var(--text-3)", fontSize: 12 }}
                            >
                              —
                            </span>
                          )}
                        </td>
                        <td>
                          {r.is_early_leave ? (
                            <span
                              style={{
                                color: "#D97706",
                                fontWeight: 600,
                                fontSize: 12,
                              }}
                            >
                              Ya
                            </span>
                          ) : (
                            <span
                              style={{ color: "var(--text-3)", fontSize: 12 }}
                            >
                              —
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {tab === "izin" && (
          <>
            <div className="lp-stats">
              {[
                {
                  label: "Total Pengajuan",
                  value: izinStats.total,
                  icon: FileText,
                  color: "#2563EB",
                  bg: "rgba(37,99,235,0.08)",
                },
                {
                  label: "Disetujui",
                  value: izinStats.approved,
                  icon: CheckCircle2,
                  color: "#16A34A",
                  bg: "rgba(22,163,74,0.08)",
                },
                {
                  label: "Ditolak",
                  value: izinStats.rejected,
                  icon: XCircle,
                  color: "#DC2626",
                  bg: "rgba(220,38,38,0.08)",
                },
                {
                  label: "Menunggu",
                  value: izinStats.pending,
                  icon: AlertCircle,
                  color: "#D97706",
                  bg: "rgba(217,119,6,0.08)",
                },
              ].map((card) => (
                <div key={card.label} className="lp-stat">
                  <div className="lp-stat-icon" style={{ background: card.bg }}>
                    <card.icon size={17} color={card.color} strokeWidth={2} />
                  </div>
                  <div>
                    <div className="lp-stat-val">{card.value}</div>
                    <div className="lp-stat-lbl">{card.label}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="lp-panel">
              <div className="lp-panel-head">
                <span className="lp-panel-title">Pengajuan Izin</span>
                <span className="lp-panel-meta">{izinData.length} records</span>
              </div>
              {izinData.length === 0 ? (
                <EmptyState />
              ) : (
                <div className="lp-table-wrap">
                  <table className="lp-table">
                    <thead>
                      <tr>
                        <th className="td-num">#</th>
                        <th>Karyawan</th>
                        <th>Jenis Izin</th>
                        <th>Tanggal</th>
                        <th>Durasi</th>
                        <th>Status</th>
                        <th>Alasan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(izinData as any[]).map((r, i) => {
                        const chip =
                          TYPE_CHIP[r.leave_type_code] || TYPE_CHIP.kepentingan;
                        const s =
                          STATUS[r.status as keyof typeof STATUS] ||
                          STATUS.cancelled;
                        return (
                          <tr key={r.id}>
                            <td className="td-num">{i + 1}</td>
                            <td>
                              <div className="td-emp">
                                <div className="td-avatar">
                                  {r.employee?.name?.charAt(0)}
                                </div>
                                <div>
                                  <p className="td-name">{r.employee?.name}</p>
                                  <p className="td-dept">
                                    {r.employee?.department || "—"}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td>
                              <span
                                className="lp-chip"
                                style={{
                                  background: chip.bg,
                                  color: chip.fg,
                                  borderColor: chip.border,
                                }}
                              >
                                {r.leave_type_label}
                              </span>
                            </td>
                            <td
                              style={{ fontSize: 12.5, whiteSpace: "nowrap" }}
                            >
                              {formatDate(r.start_date, { month: "short" })}
                              {r.start_date !== r.end_date && (
                                <>
                                  {" "}
                                  — {formatDate(r.end_date, { month: "short" })}
                                </>
                              )}
                            </td>
                            <td style={{ fontSize: 12.5 }}>
                              {r.total_days} hari
                            </td>
                            <td>
                              <span className={`pill ${s.pill}`}>
                                <span
                                  className="pill-dot"
                                  style={{ background: s.dot }}
                                />
                                {s.label}
                              </span>
                            </td>
                            <td
                              style={{
                                fontSize: 12.5,
                                color: "var(--text-2)",
                                maxWidth: 160,
                              }}
                            >
                              {r.reason
                                ? r.reason.substring(0, 50) +
                                  (r.reason.length > 50 ? "…" : "")
                                : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}

// ── Sub-components ────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="lp-empty">
      <div className="lp-empty-icon">
        <CalendarDays size={20} color="var(--text-3)" />
      </div>
      <p className="lp-empty-title">Tidak ada data</p>
      <p className="lp-empty-desc">Belum ada data untuk periode yang dipilih</p>
    </div>
  );
}

function LaporanFilter({
  tab,
  monthParam,
  yearParam,
  startParam,
  endParam,
}: {
  tab: string;
  monthParam: string;
  yearParam: string;
  startParam?: string;
  endParam?: string;
}) {
  const now = new Date();
  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);
  const months = Array.from({ length: 12 }, (_, i) => ({
    value: i + 1,
    label: BULAN[i + 1],
  }));

  return (
    <form method="GET" action="/dashboard/laporan">
      <input type="hidden" name="tab" value={tab} />
      <div className="lp-filter">
        <span className="lp-filter-label">Filter Periode</span>

        {/* Bulan & Tahun */}
        <select name="month" defaultValue={monthParam}>
          {months.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
        <select name="year" defaultValue={yearParam}>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>

        <div className="lp-filter-sep" />

        {/* Range bebas */}
        <span className="lp-filter-label">Atau Range</span>
        <input type="date" name="start" defaultValue={startParam || ""} />
        <input type="date" name="end" defaultValue={endParam || ""} />

        <button type="submit" className="lp-filter-apply">
          Terapkan
        </button>
      </div>
    </form>
  );
}
