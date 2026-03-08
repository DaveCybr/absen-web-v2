import { createClient } from "@/lib/supabase/server";
import { formatTime } from "@/lib/utils";
import { getTodayWIB } from "@/lib/attendance";
import {
  Users,
  UserCheck,
  Clock,
  UserX,
  CalendarDays,
  AlertCircle,
  TrendingUp,
  ArrowRight,
  MapPin,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import type { Attendance, Employee } from "@/types";

async function getDashboardStats() {
  const supabase = await createClient();
  const today = getTodayWIB();
  const { count: totalEmployees } = await supabase
    .from("employees")
    .select("*", { count: "exact", head: true })
    .eq("is_active", true);
  const { data: todayAttendances } = await supabase
    .from("attendances")
    .select("*, employee:employees(*)")
    .eq("attendance_date", today);
  const presentToday =
    todayAttendances?.filter(
      (a) => a.status === "present" || a.status === "late",
    ).length || 0;
  const lateToday =
    todayAttendances?.filter((a) => a.status === "late").length || 0;
  const onLeaveToday =
    todayAttendances?.filter((a) => a.status === "leave").length || 0;
  const { count: pendingLeaveRequests } = await supabase
    .from("leave_requests")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending");
  const absentToday = Math.max(
    0,
    (totalEmployees || 0) - presentToday - onLeaveToday,
  );
  return {
    totalEmployees: totalEmployees || 0,
    presentToday,
    lateToday,
    absentToday,
    onLeaveToday,
    pendingLeaveRequests: pendingLeaveRequests || 0,
    recentAttendances: todayAttendances || [],
  };
}

const STATUS_MAP: Record<
  string,
  { bg: string; fg: string; dot: string; label: string; pill: string }
> = {
  present: {
    bg: "#F0FDF4",
    fg: "#15803D",
    dot: "#22C55E",
    label: "Hadir",
    pill: "pill-present",
  },
  late: {
    bg: "#FFFBEB",
    fg: "#B45309",
    dot: "#F59E0B",
    label: "Terlambat",
    pill: "pill-late",
  },
  absent: {
    bg: "#FEF2F2",
    fg: "#B91C1C",
    dot: "#EF4444",
    label: "Tidak Hadir",
    pill: "pill-absent",
  },
  leave: {
    bg: "#F5F3FF",
    fg: "#6D28D9",
    dot: "#8B5CF6",
    label: "Cuti",
    pill: "pill-leave",
  },
};

export default async function DashboardPage() {
  const stats = await getDashboardStats();
  const attendanceRate =
    stats.totalEmployees > 0
      ? Math.round((stats.presentToday / stats.totalEmployees) * 100)
      : 0;

  const statCards = [
    {
      label: "Total Karyawan",
      value: stats.totalEmployees,
      icon: Users,
      accent: "#2563EB",
      bg: "rgba(37,99,235,0.08)",
      sub: "karyawan aktif",
      trend: null,
    },
    {
      label: "Hadir Hari Ini",
      value: stats.presentToday,
      icon: UserCheck,
      accent: "#16A34A",
      bg: "rgba(22,163,74,0.08)",
      sub: `dari ${stats.totalEmployees}`,
      trend: attendanceRate,
    },
    {
      label: "Terlambat",
      value: stats.lateToday,
      icon: Clock,
      accent: "#D97706",
      bg: "rgba(217,119,6,0.08)",
      sub: "dari yang hadir",
      trend: null,
    },
    {
      label: "Tidak Hadir",
      value: stats.absentToday,
      icon: UserX,
      accent: "#DC2626",
      bg: "rgba(220,38,38,0.08)",
      sub: "karyawan absen",
      trend: null,
    },
    {
      label: "Izin",
      value: stats.onLeaveToday,
      icon: CalendarDays,
      accent: "#7C3AED",
      bg: "rgba(124,58,237,0.08)",
      sub: "karyawan cuti",
      trend: null,
    },
    {
      label: "Perlu Review",
      value: stats.pendingLeaveRequests,
      icon: AlertCircle,
      accent: "#EA580C",
      bg: "rgba(234,88,12,0.08)",
      sub: "pengajuan cuti",
      trend: null,
      urgent: stats.pendingLeaveRequests > 0,
    },
  ];

  return (
    <>
      <style>{`
        /* ── PAGE HEADER ── */
        .dash-header {
          display: flex; align-items: flex-start; justify-content: space-between;
          gap: 16px; flex-wrap: wrap; margin-bottom: 24px;
        }
        .dash-title { font-size: 24px; font-weight: 800; color: var(--text-1); letter-spacing: -0.03em; margin-bottom: 4px; }
        .dash-sub { font-size: 13.5px; color: var(--text-2); font-weight: 400; }

        /* Attendance rate widget */
        .rate-widget {
          display: flex; align-items: center; gap: 12px;
          background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--r-lg); padding: 12px 16px;
          box-shadow: var(--shadow-sm);
        }
        .rate-ring { position: relative; width: 48px; height: 48px; flex-shrink: 0; }
        .rate-ring svg { transform: rotate(-90deg); }
        .rate-ring-val {
          position: absolute; inset: 0;
          display: flex; align-items: center; justify-content: center;
          font-size: 12px; font-weight: 700; color: var(--text-1);
        }
        .rate-info { }
        .rate-label { font-size: 11px; font-weight: 600; color: var(--text-3); text-transform: uppercase; letter-spacing: 0.06em; }
        .rate-val { font-size: 15px; font-weight: 700; color: var(--text-1); margin-top: 1px; }

        /* ── STAT GRID ── */
        .stat-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 14px;
          margin-bottom: 24px;
        }
        @media (min-width: 768px) { .stat-grid { grid-template-columns: repeat(3, 1fr); } }
        @media (min-width: 1400px) { .stat-grid { grid-template-columns: repeat(6, 1fr); } }

        .stat-card {
          background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--r-lg); padding: 18px 16px;
          box-shadow: var(--shadow-sm);
          position: relative; overflow: hidden;
          transition: transform 0.18s var(--ease), box-shadow 0.18s var(--ease), border-color 0.18s;
          cursor: default;
        }
        .stat-card:hover {
          transform: translateY(-2px);
          box-shadow: var(--shadow-lg);
          border-color: var(--border-2);
        }
        .stat-card.urgent { border-color: #FED7AA; }
        .stat-card.urgent::after {
          content: '';
          position: absolute; top: 0; left: 0; right: 0; height: 3px;
          background: linear-gradient(90deg, #EA580C, #F97316);
          border-radius: var(--r-lg) var(--r-lg) 0 0;
        }

        /* Subtle top accent line on hover */
        .stat-card::before {
          content: ''; position: absolute; top: 0; left: 16px; right: 16px; height: 1px;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.8), transparent);
          opacity: 0; transition: opacity 0.2s;
        }
        .stat-card:hover::before { opacity: 1; }

        .stat-icon {
          width: 40px; height: 40px; border-radius: var(--r-md);
          display: flex; align-items: center; justify-content: center;
          margin-bottom: 14px;
        }
        .stat-value {
          font-size: 30px; font-weight: 800; color: var(--text-1);
          letter-spacing: -0.04em; line-height: 1; margin-bottom: 4px;
        }
        .stat-label { font-size: 11px; font-weight: 600; color: var(--text-3); text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 6px; }
        .stat-sub { font-size: 12px; color: var(--text-3); }
        .stat-trend {
          display: inline-flex; align-items: center; gap: 4px;
          font-size: 11px; font-weight: 700;
          padding: 2px 8px; border-radius: 999px;
          margin-top: 8px;
        }

        /* ── ATTENDANCE LIST ── */
        .section-header {
          display: flex; align-items: center; justify-content: space-between;
          margin-bottom: 14px; gap: 12px;
        }
        .section-title { font-size: 15px; font-weight: 700; color: var(--text-1); }
        .section-meta { font-size: 12px; color: var(--text-3); font-weight: 400; }
        .section-link {
          display: inline-flex; align-items: center; gap: 5px;
          font-size: 12.5px; font-weight: 600; color: var(--blue-500);
          text-decoration: none; padding: 6px 12px;
          border-radius: var(--r-sm); border: 1px solid rgba(37,99,235,0.2);
          background: rgba(37,99,235,0.04);
          transition: background 0.13s, border-color 0.13s;
        }
        .section-link:hover { background: rgba(37,99,235,0.08); border-color: rgba(37,99,235,0.3); }

        .att-panel {
          background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--r-lg); box-shadow: var(--shadow-sm); overflow: hidden;
        }
        .att-panel-head {
          padding: 14px 20px;
          border-bottom: 1px solid var(--border);
          display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
        }
        .legend-item { display: flex; align-items: center; gap: 5px; }
        .legend-dot { width: 6px; height: 6px; border-radius: 50%; }
        .legend-txt { font-size: 11.5px; color: var(--text-2); font-weight: 500; }

        .att-list { }
        .att-row {
          display: flex; align-items: center; gap: 14px; padding: 12px 20px;
          border-bottom: 1px solid var(--border);
          transition: background 0.12s;
        }
        .att-row:last-child { border-bottom: none; }
        .att-row:hover { background: var(--surface-2); }

        .att-avatar {
          width: 38px; height: 38px; border-radius: var(--r-sm);
          display: flex; align-items: center; justify-content: center;
          font-size: 13px; font-weight: 800; flex-shrink: 0;
        }
        .att-info { flex: 1; min-width: 0; }
        .att-name { font-size: 13.5px; font-weight: 600; color: var(--text-1); margin: 0; line-height: 1.3;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .att-dept { font-size: 11.5px; color: var(--text-3); margin: 0; line-height: 1.3; }

        .att-times { display: flex; gap: 20px; flex-shrink: 0; }
        .att-time-col { text-align: right; }
        .att-time-lbl { font-size: 10px; font-weight: 600; color: var(--text-3); text-transform: uppercase; letter-spacing: 0.06em; line-height: 1.2; }
        .att-time-val { font-size: 13px; font-weight: 600; color: var(--text-1); font-family: 'JetBrains Mono', monospace; line-height: 1.4; }
        .att-time-val.empty { color: var(--text-3); font-weight: 400; }

        .att-verify-badges { display: flex; gap: 4px; flex-shrink: 0; }
        .att-badge {
          width: 24px; height: 24px; border-radius: var(--r-sm);
          display: flex; align-items: center; justify-content: center; font-size: 12px;
          border: 1px solid var(--border); background: var(--surface-2);
          title: "";
        }

        /* Empty */
        .empty-state { padding: 56px 24px; text-align: center; }
        .empty-icon-wrap {
          width: 56px; height: 56px; border-radius: var(--r-lg);
          background: var(--surface-2); border: 1px solid var(--border);
          display: flex; align-items: center; justify-content: center;
          margin: 0 auto 14px;
        }
        .empty-title { font-size: 14px; font-weight: 600; color: var(--text-2); margin: 0 0 6px; }
        .empty-desc { font-size: 13px; color: var(--text-3); }

        /* Bottom grid */
        .dash-bottom {
          display: grid; grid-template-columns: 1fr;
          gap: 16px; margin-top: 24px;
        }
        @media (min-width: 1024px) { .dash-bottom { grid-template-columns: 1fr 320px; } }

        /* Quick stats panel */
        .quick-panel {
          background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--r-lg); box-shadow: var(--shadow-sm);
          overflow: hidden;
        }
        .quick-row {
          display: flex; align-items: center; justify-content: space-between;
          padding: 14px 20px; border-bottom: 1px solid var(--border);
        }
        .quick-row:last-child { border-bottom: none; }
        .quick-label { font-size: 13px; color: var(--text-2); font-weight: 500; }
        .quick-val { font-size: 14px; font-weight: 700; color: var(--text-1); }

        /* Animate in */
        @keyframes fade-up {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .stat-card { animation: fade-up 0.4s var(--ease-out) both; }
        .stat-card:nth-child(1) { animation-delay: 0ms; }
        .stat-card:nth-child(2) { animation-delay: 50ms; }
        .stat-card:nth-child(3) { animation-delay: 100ms; }
        .stat-card:nth-child(4) { animation-delay: 150ms; }
        .stat-card:nth-child(5) { animation-delay: 200ms; }
        .stat-card:nth-child(6) { animation-delay: 250ms; }
      `}</style>

      {/* Header */}
      <div className="dash-header">
        <div>
          <h1 className="dash-title">Dashboard</h1>
          <p className="dash-sub">
            Ringkasan kehadiran karyawan hari ini,{" "}
            {new Date().toLocaleDateString("id-ID", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>

        {/* Attendance rate ring */}
        <div className="rate-widget">
          <div className="rate-ring">
            <svg width="48" height="48" viewBox="0 0 48 48">
              <circle
                cx="24"
                cy="24"
                r="20"
                fill="none"
                stroke="#E2E8F0"
                strokeWidth="4"
              />
              <circle
                cx="24"
                cy="24"
                r="20"
                fill="none"
                stroke={
                  attendanceRate >= 80
                    ? "#16A34A"
                    : attendanceRate >= 60
                      ? "#D97706"
                      : "#DC2626"
                }
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={`${attendanceRate * 1.257} 125.7`}
              />
            </svg>
            <div className="rate-ring-val">{attendanceRate}%</div>
          </div>
          <div className="rate-info">
            <div className="rate-label">Tingkat Kehadiran</div>
            <div className="rate-val">
              {stats.presentToday}/{stats.totalEmployees}
            </div>
          </div>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="stat-grid">
        {statCards.map((card) => (
          <div
            key={card.label}
            className={`stat-card${card.urgent ? " urgent" : ""}`}
          >
            <div className="stat-icon" style={{ background: card.bg }}>
              <card.icon size={18} color={card.accent} strokeWidth={2} />
            </div>
            <div className="stat-label">{card.label}</div>
            <div className="stat-value">{card.value}</div>
            <div className="stat-sub">{card.sub}</div>
            {card.trend !== null && card.trend !== undefined && (
              <div
                className="stat-trend"
                style={{
                  background:
                    card.trend >= 80
                      ? "rgba(22,163,74,0.1)"
                      : "rgba(217,119,6,0.1)",
                  color: card.trend >= 80 ? "#16A34A" : "#D97706",
                }}
              >
                <TrendingUp size={10} />
                {card.trend}% hadir
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Bottom: Attendance list + quick stats */}
      <div className="dash-bottom">
        {/* Attendance list */}
        <div>
          <div className="section-header">
            <div>
              <span className="section-title">Kehadiran Hari Ini</span>
              {stats.recentAttendances.length > 0 && (
                <span className="section-meta">
                  {" "}
                  · {stats.recentAttendances.length} records
                </span>
              )}
            </div>
            <Link href="/dashboard/kehadiran" className="section-link">
              Lihat Semua <ArrowRight size={13} />
            </Link>
          </div>

          <div className="att-panel">
            {/* Legend */}
            <div className="att-panel-head">
              {Object.entries(STATUS_MAP).map(([key, s]) => (
                <div key={key} className="legend-item">
                  <div className="legend-dot" style={{ background: s.dot }} />
                  <span className="legend-txt">{s.label}</span>
                </div>
              ))}
            </div>

            <div className="att-list">
              {stats.recentAttendances.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon-wrap">
                    <Clock size={22} color="var(--text-3)" />
                  </div>
                  <p className="empty-title">Belum ada kehadiran</p>
                  <p className="empty-desc">
                    Data akan muncul setelah karyawan check-in
                  </p>
                </div>
              ) : (
                stats.recentAttendances
                  .slice(0, 12)
                  .map((att: Attendance & { employee: Employee }) => {
                    const s = STATUS_MAP[att.status] || STATUS_MAP.absent;
                    return (
                      <div key={att.id} className="att-row">
                        <div
                          className="att-avatar"
                          style={{ background: s.bg, color: s.fg }}
                        >
                          {att.employee?.name?.charAt(0).toUpperCase()}
                        </div>
                        <div className="att-info">
                          <p className="att-name">{att.employee?.name}</p>
                          <p className="att-dept">
                            {att.employee?.department ||
                              att.employee?.position ||
                              "—"}
                          </p>
                        </div>

                        {/* Times — hidden on mobile */}
                        <div className="att-times" style={{ display: "none" }}>
                          <div className="att-time-col">
                            <div className="att-time-lbl">Masuk</div>
                            <div
                              className={`att-time-val${!att.check_in_time ? " empty" : ""}`}
                            >
                              {att.check_in_time
                                ? formatTime(att.check_in_time)
                                : "—"}
                            </div>
                          </div>
                          <div className="att-time-col">
                            <div className="att-time-lbl">Pulang</div>
                            <div
                              className={`att-time-val${!att.check_out_time ? " empty" : ""}`}
                            >
                              {att.check_out_time
                                ? formatTime(att.check_out_time)
                                : "—"}
                            </div>
                          </div>
                        </div>

                        {/* Verification badges */}
                        <div className="att-verify-badges">
                          {att.check_in_face_verified && (
                            <div
                              className="att-badge"
                              title="Wajah terverifikasi"
                            >
                              <ShieldCheck size={13} color="#16A34A" />
                            </div>
                          )}
                          {att.check_in_location_verified && (
                            <div
                              className="att-badge"
                              title="Lokasi terverifikasi"
                            >
                              <MapPin size={12} color="#2563EB" />
                            </div>
                          )}
                        </div>

                        <span className={`pill ${s.pill}`}>
                          <span
                            className="pill-dot"
                            style={{ background: s.dot }}
                          />
                          {s.label}
                        </span>
                      </div>
                    );
                  })
              )}
            </div>
          </div>
        </div>

        {/* Quick stats */}
        <div>
          <div className="section-header" style={{ marginBottom: 14 }}>
            <span className="section-title">Ringkasan Cepat</span>
          </div>
          <div className="quick-panel">
            <div className="quick-row">
              <span className="quick-label">Tingkat Kehadiran</span>
              <span
                className="quick-val"
                style={{
                  color: attendanceRate >= 80 ? "var(--green)" : "var(--amber)",
                }}
              >
                {attendanceRate}%
              </span>
            </div>
            <div className="quick-row">
              <span className="quick-label">Hadir Tepat Waktu</span>
              <span className="quick-val">
                {stats.presentToday - stats.lateToday}
              </span>
            </div>
            <div className="quick-row">
              <span className="quick-label">Terlambat</span>
              <span className="quick-val" style={{ color: "var(--amber)" }}>
                {stats.lateToday}
              </span>
            </div>
            <div className="quick-row">
              <span className="quick-label">Tidak Hadir</span>
              <span className="quick-val" style={{ color: "var(--red)" }}>
                {stats.absentToday}
              </span>
            </div>
            <div className="quick-row">
              <span className="quick-label">Sedang Cuti</span>
              <span className="quick-val" style={{ color: "var(--purple)" }}>
                {stats.onLeaveToday}
              </span>
            </div>
            <div className="quick-row">
              <span className="quick-label">Pengajuan Pending</span>
              <span
                className="quick-val"
                style={{
                  color:
                    stats.pendingLeaveRequests > 0
                      ? "#EA580C"
                      : "var(--text-1)",
                }}
              >
                {stats.pendingLeaveRequests}
              </span>
            </div>
          </div>

          {/* Link to pending leaves */}
          {stats.pendingLeaveRequests > 0 && (
            <Link
              href="/dashboard/cuti?status=pending"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginTop: 12,
                padding: "12px 16px",
                background: "#FFF7ED",
                border: "1px solid #FED7AA",
                borderRadius: "var(--r-md)",
                textDecoration: "none",
                transition: "background 0.13s",
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#9A3412",
                    marginBottom: 2,
                  }}
                >
                  {stats.pendingLeaveRequests} Pengajuan Menunggu
                </div>
                <div style={{ fontSize: 11.5, color: "#C2410C" }}>
                  Klik untuk review segera
                </div>
              </div>
              <ArrowRight size={15} color="#C2410C" />
            </Link>
          )}
        </div>
      </div>
    </>
  );
}
