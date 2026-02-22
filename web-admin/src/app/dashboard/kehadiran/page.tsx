import { createClient } from "@/lib/supabase/server";
import { formatDate, formatTime, formatDuration } from "@/lib/utils";
import { getTodayWIB } from "@/lib/attendance";
import { AttendanceFilters } from "./attendance-filters";
import type { Attendance, Employee } from "@/types";
import { Clock, MapPin, ShieldCheck, Users } from "lucide-react";

interface PageProps {
  searchParams: Promise<{
    date?: string;
    status?: string;
    department?: string;
  }>;
}

async function getAttendances(filters: {
  date?: string;
  status?: string;
  department?: string;
}) {
  const supabase = await createClient();
  let query = supabase
    .from("attendances")
    .select("*, employee:employees(*)")
    .order("check_in_time", { ascending: false });
  query = query.eq("attendance_date", filters.date || getTodayWIB());
  if (filters.status && filters.status !== "all")
    query = query.eq("status", filters.status);
  const { data, error } = await query;
  if (error) return [];
  let result = data as (Attendance & { employee: Employee })[];
  if (filters.department && filters.department !== "all")
    result = result.filter(
      (a) => a.employee?.department === filters.department,
    );
  return result;
}

async function getDepartments() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("employees")
    .select("department")
    .not("department", "is", null)
    .eq("is_active", true);
  return [
    ...new Set(data?.map((e) => e.department).filter(Boolean)),
  ] as string[];
}

const STATUS = {
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

export default async function KehadiranPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const [attendances, departments] = await Promise.all([
    getAttendances(params),
    getDepartments(),
  ]);
  const displayDate = params.date || getTodayWIB();

  const summary = {
    present: attendances.filter((a) => a.status === "present").length,
    late: attendances.filter((a) => a.status === "late").length,
    absent: attendances.filter((a) => a.status === "absent").length,
    leave: attendances.filter((a) => a.status === "leave").length,
  };

  return (
    <>
      <style>{`
        .kh-page { display: flex; flex-direction: column; gap: 20px; }
        .kh-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
        .kh-title { font-size: 24px; font-weight: 800; color: var(--text-1); letter-spacing: -0.03em; margin-bottom: 4px; }
        .kh-sub { font-size: 13.5px; color: var(--text-2); }

        /* Summary pills */
        .kh-summary { display: flex; gap: 10px; flex-wrap: wrap; }
        .kh-sum-chip {
          display: flex; align-items: center; gap: 8px; padding: 9px 14px;
          background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--r-md); box-shadow: var(--shadow-xs);
        }
        .kh-sum-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
        .kh-sum-val { font-size: 16px; font-weight: 800; color: var(--text-1); }
        .kh-sum-lbl { font-size: 12px; color: var(--text-2); font-weight: 500; }

        /* Filters */
        .kh-filters {
          background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--r-lg); padding: 16px 20px;
          box-shadow: var(--shadow-xs);
        }

        /* Table */
        .kh-panel {
          background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--r-lg); box-shadow: var(--shadow-sm); overflow: hidden;
        }
        .kh-panel-head {
          padding: 16px 20px; border-bottom: 1px solid var(--border);
          display: flex; align-items: center; justify-content: space-between; gap: 12px;
        }
        .kh-panel-title { font-size: 14.5px; font-weight: 700; color: var(--text-1); }
        .kh-panel-meta { font-size: 12px; color: var(--text-3); }

        .kh-table-wrap { overflow-x: auto; }
        table { width: 100%; border-collapse: collapse; }
        thead { background: var(--surface-2); }
        th {
          padding: 10px 16px; font-size: 11px; font-weight: 700;
          color: var(--text-3); text-transform: uppercase; letter-spacing: 0.07em;
          text-align: left; border-bottom: 1px solid var(--border); white-space: nowrap;
        }
        td { padding: 12px 16px; border-bottom: 1px solid var(--border); vertical-align: middle; }
        tr:last-child td { border-bottom: none; }
        tbody tr:hover td { background: var(--surface-2); }

        .td-emp { display: flex; align-items: center; gap: 12px; }
        .td-avatar {
          width: 36px; height: 36px; border-radius: var(--r-sm);
          display: flex; align-items: center; justify-content: center;
          font-size: 13px; font-weight: 800; flex-shrink: 0;
        }
        .td-name { font-size: 13.5px; font-weight: 600; color: var(--text-1); margin: 0; line-height: 1.3; }
        .td-dept { font-size: 11.5px; color: var(--text-3); margin: 0; line-height: 1.3; }

        .td-time { font-family: 'JetBrains Mono', monospace; font-size: 13px; font-weight: 500; color: var(--text-1); }
        .td-time.empty { color: var(--text-3); font-size: 12px; font-family: 'Plus Jakarta Sans', sans-serif; }
        .td-duration { font-size: 13px; color: var(--text-2); }
        .td-late-ok { font-size: 13px; color: var(--green); font-weight: 600; }
        .td-late-bad { font-size: 13px; color: var(--amber); font-weight: 600; }

        .verify-badges { display: flex; gap: 4px; }
        .verify-badge {
          width: 26px; height: 26px; border-radius: var(--r-sm);
          display: flex; align-items: center; justify-content: center;
          border: 1px solid var(--border); background: var(--surface-2);
        }

        .empty-state { padding: 56px 24px; text-align: center; }
        .empty-icon { width: 56px; height: 56px; border-radius: var(--r-lg); background: var(--surface-2); border: 1px solid var(--border); display: flex; align-items: center; justify-content: center; margin: 0 auto 14px; }
        .empty-title { font-size: 14px; font-weight: 600; color: var(--text-2); margin-bottom: 6px; }
        .empty-desc { font-size: 13px; color: var(--text-3); }
      `}</style>

      <div className="kh-page">
        {/* Header */}
        <div className="kh-header">
          <div>
            <h1 className="kh-title">Kehadiran</h1>
            <p className="kh-sub">
              Data kehadiran {formatDate(displayDate)} · {attendances.length}{" "}
              karyawan
            </p>
          </div>
          <div className="kh-summary">
            {Object.entries(STATUS).map(([key, s]) => (
              <div key={key} className="kh-sum-chip">
                <div className="kh-sum-dot" style={{ background: s.dot }} />
                <span className="kh-sum-val">
                  {summary[key as keyof typeof summary]}
                </span>
                <span className="kh-sum-lbl">{s.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Filters */}
        <div className="kh-filters">
          <AttendanceFilters departments={departments} />
        </div>

        {/* Table */}
        <div className="kh-panel">
          <div className="kh-panel-head">
            <div>
              <span className="kh-panel-title">Data Kehadiran</span>
              <span className="kh-panel-meta" style={{ marginLeft: 8 }}>
                {formatDate(displayDate, { weekday: "long", month: "long" })}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Users size={13} color="var(--text-3)" />
              <span
                style={{
                  fontSize: 12,
                  color: "var(--text-3)",
                  fontWeight: 500,
                }}
              >
                {attendances.length} records
              </span>
            </div>
          </div>

          {attendances.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">
                <Clock size={22} color="var(--text-3)" />
              </div>
              <p className="empty-title">Tidak ada data kehadiran</p>
              <p className="empty-desc">
                Coba ubah filter atau pilih tanggal lain
              </p>
            </div>
          ) : (
            <div className="kh-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Karyawan</th>
                    <th>Departemen</th>
                    <th>Check In</th>
                    <th>Check Out</th>
                    <th>Durasi Kerja</th>
                    <th>Keterlambatan</th>
                    <th>Status</th>
                    <th>Verifikasi</th>
                  </tr>
                </thead>
                <tbody>
                  {attendances.map((att) => {
                    const s =
                      STATUS[att.status as keyof typeof STATUS] ||
                      STATUS.absent;
                    return (
                      <tr key={att.id}>
                        <td>
                          <div className="td-emp">
                            <div
                              className="td-avatar"
                              style={{ background: s.bg, color: s.fg }}
                            >
                              {att.employee?.name?.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="td-name">{att.employee?.name}</p>
                              <p className="td-dept">
                                {att.employee?.position || "—"}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span
                            style={{ fontSize: 13, color: "var(--text-2)" }}
                          >
                            {att.employee?.department || "—"}
                          </span>
                        </td>
                        <td>
                          <span
                            className={`td-time${!att.check_in_time ? " empty" : ""}`}
                          >
                            {att.check_in_time
                              ? formatTime(att.check_in_time)
                              : "Belum absen"}
                          </span>
                        </td>
                        <td>
                          <span
                            className={`td-time${!att.check_out_time ? " empty" : ""}`}
                          >
                            {att.check_out_time
                              ? formatTime(att.check_out_time)
                              : "—"}
                          </span>
                        </td>
                        <td>
                          <span className="td-duration">
                            {att.work_duration_minutes
                              ? formatDuration(att.work_duration_minutes)
                              : "—"}
                          </span>
                        </td>
                        <td>
                          {att.late_minutes > 0 ? (
                            <span className="td-late-bad">
                              +{att.late_minutes} mnt
                            </span>
                          ) : (
                            <span className="td-late-ok">Tepat waktu</span>
                          )}
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
                        <td>
                          <div className="verify-badges">
                            <div
                              className="verify-badge"
                              title={
                                att.check_in_face_verified
                                  ? "Wajah ✓"
                                  : "Wajah ✗"
                              }
                            >
                              <ShieldCheck
                                size={13}
                                color={
                                  att.check_in_face_verified
                                    ? "#16A34A"
                                    : "#CBD5E1"
                                }
                              />
                            </div>
                            <div
                              className="verify-badge"
                              title={
                                att.check_in_location_verified
                                  ? "Lokasi ✓"
                                  : "Lokasi ✗"
                              }
                            >
                              <MapPin
                                size={12}
                                color={
                                  att.check_in_location_verified
                                    ? "#2563EB"
                                    : "#CBD5E1"
                                }
                              />
                            </div>
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
      </div>
    </>
  );
}
