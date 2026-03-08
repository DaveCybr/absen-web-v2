import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import { LeaveRequestActions } from "./leave-request-actions";
import type { Employee } from "@/types";
import {
  CalendarDays,
  Clock,
  CheckCircle2,
  XCircle,
  FileText,
  Users,
  Paperclip,
} from "lucide-react";

// ── Tipe lokal (tidak lagi pakai LeaveType dari DB) ──────────
interface IzinRequest {
  id: string;
  employee_id: string;
  leave_type_code: "sakit" | "bepergian" | "kepentingan";
  leave_type_label: string;
  start_date: string;
  end_date: string;
  total_days: number;
  reason: string | null;
  status: "pending" | "approved" | "rejected" | "cancelled";
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  attachment_url: string | null;
  attachment_name: string | null;
  created_at: string;
  employee: Omit<Employee, "department"> & { department?: string };
  approver: { id: string; name: string } | null;
}

interface PageProps {
  searchParams: Promise<{ status?: string; page?: string }>;
}

const PAGE_SIZE = 50;

// ── Warna chip per jenis izin ────────────────────────────────
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
  pending: {
    bg: "#FFFBEB",
    fg: "#B45309",
    dot: "#F59E0B",
    label: "Menunggu",
    pill: "pill-pending",
  },
  approved: {
    bg: "#F0FDF4",
    fg: "#15803D",
    dot: "#22C55E",
    label: "Disetujui",
    pill: "pill-approved",
  },
  rejected: {
    bg: "#FEF2F2",
    fg: "#B91C1C",
    dot: "#EF4444",
    label: "Ditolak",
    pill: "pill-rejected",
  },
  cancelled: {
    bg: "#F8FAFC",
    fg: "#64748B",
    dot: "#94A3B8",
    label: "Dibatalkan",
    pill: "pill-cancelled",
  },
};

async function getIzinRequests(status?: string, page = 1) {
  const supabase = await createClient();
  let query = supabase
    .from("leave_requests")
    .select(
      `*, employee:employees!leave_requests_employee_id_fkey(*), approver:employees!leave_requests_approved_by_fkey(id, name)`,
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  if (status && status !== "all") query = query.eq("status", status);

  const { data, error, count } = await query;
  if (error) return { data: [] as IzinRequest[], count: 0 };
  return { data: data as IzinRequest[], count: count || 0 };
}

async function getIzinStats() {
  const supabase = await createClient();
  const { data } = await supabase.from("leave_requests").select("status");
  if (!data) return { pending: 0, approved: 0, rejected: 0, total: 0 };
  return {
    pending: data.filter((r) => r.status === "pending").length,
    approved: data.filter((r) => r.status === "approved").length,
    rejected: data.filter((r) => r.status === "rejected").length,
    total: data.length,
  };
}

export default async function IzinPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const page = parseInt(params.page || "1");
  const [{ data: requests, count }, stats] = await Promise.all([
    getIzinRequests(params.status, page),
    getIzinStats(),
  ]);
  const totalPages = Math.ceil(count / PAGE_SIZE);
  const active = params.status || "all";

  const statCards = [
    {
      label: "Menunggu",
      value: stats.pending,
      icon: Clock,
      color: "#D97706",
      bg: "rgba(217,119,6,0.08)",
      href: "pending",
      urgent: stats.pending > 0,
    },
    {
      label: "Disetujui",
      value: stats.approved,
      icon: CheckCircle2,
      color: "#16A34A",
      bg: "rgba(22,163,74,0.08)",
      href: "approved",
    },
    {
      label: "Ditolak",
      value: stats.rejected,
      icon: XCircle,
      color: "#DC2626",
      bg: "rgba(220,38,38,0.08)",
      href: "rejected",
    },
    {
      label: "Total",
      value: stats.total,
      icon: FileText,
      color: "#2563EB",
      bg: "rgba(37,99,235,0.08)",
      href: "all",
    },
  ];

  const tabs = [
    { label: "Semua", value: "all", count: stats.total },
    { label: "Menunggu", value: "pending", count: stats.pending },
    { label: "Disetujui", value: "approved", count: stats.approved },
    { label: "Ditolak", value: "rejected", count: stats.rejected },
  ];

  return (
    <>
      <style>{`
        .ct-page { display: flex; flex-direction: column; gap: 20px; }
        .ct-title { font-size: 24px; font-weight: 800; color: var(--text-1); letter-spacing: -0.03em; margin-bottom: 4px; }
        .ct-sub { font-size: 13.5px; color: var(--text-2); }

        .ct-stats { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
        @media (min-width: 768px) { .ct-stats { grid-template-columns: repeat(4, 1fr); } }
        .ct-stat {
          background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--r-lg); padding: 16px;
          display: flex; align-items: center; gap: 12px;
          text-decoration: none; box-shadow: var(--shadow-xs);
          transition: transform 0.16s var(--ease), box-shadow 0.16s, border-color 0.16s;
        }
        .ct-stat:hover { transform: translateY(-2px); box-shadow: var(--shadow-md); border-color: var(--border-2); }
        .ct-stat.urgent { border-color: #FED7AA; }
        .ct-stat-icon { width: 38px; height: 38px; border-radius: var(--r-md); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .ct-stat-val { font-size: 22px; font-weight: 800; color: var(--text-1); letter-spacing: -0.03em; margin-bottom: 2px; }
        .ct-stat-lbl { font-size: 12px; color: var(--text-3); font-weight: 500; }

        .ct-tabs {
          background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--r-lg); padding: 6px; box-shadow: var(--shadow-xs);
          display: flex; gap: 4px; flex-wrap: wrap;
        }
        .ct-tab {
          display: inline-flex; align-items: center; gap: 7px;
          padding: 8px 16px; border-radius: var(--r-md);
          font-size: 13px; font-weight: 500; color: var(--text-2);
          text-decoration: none; transition: background 0.13s, color 0.13s;
          border: 1px solid transparent;
        }
        .ct-tab:hover { background: var(--surface-2); color: var(--text-1); }
        .ct-tab.active { background: var(--navy-800); color: white; font-weight: 600; }
        .ct-tab-count { font-size: 10.5px; font-weight: 700; padding: 1px 7px; border-radius: 999px; }
        .ct-tab:not(.active) .ct-tab-count { background: var(--surface-2); color: var(--text-3); }
        .ct-tab.active .ct-tab-count { background: rgba(255,255,255,0.15); color: rgba(255,255,255,0.8); }

        .ct-panel {
          background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--r-lg); box-shadow: var(--shadow-sm); overflow: hidden;
        }
        .ct-panel-head {
          padding: 16px 20px; border-bottom: 1px solid var(--border);
          display: flex; align-items: center; justify-content: space-between; gap: 12px;
        }
        .ct-panel-title { font-size: 14.5px; font-weight: 700; color: var(--text-1); }
        .ct-panel-meta { font-size: 12px; color: var(--text-3); }

        .ct-table-wrap { overflow-x: auto; }
        table { width: 100%; border-collapse: collapse; }
        thead { background: var(--surface-2); }
        th { padding: 10px 16px; font-size: 11px; font-weight: 700; color: var(--text-3); text-transform: uppercase; letter-spacing: 0.07em; text-align: left; border-bottom: 1px solid var(--border); white-space: nowrap; }
        td { padding: 13px 16px; border-bottom: 1px solid var(--border); vertical-align: middle; }
        tr:last-child td { border-bottom: none; }
        tbody tr:hover td { background: var(--surface-2); }

        .td-emp { display: flex; align-items: center; gap: 12px; }
        .td-avatar { width: 36px; height: 36px; border-radius: var(--r-sm); display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 800; flex-shrink: 0; }
        .td-name { font-size: 13.5px; font-weight: 600; color: var(--text-1); margin: 0; line-height: 1.3; }
        .td-dept { font-size: 11.5px; color: var(--text-3); margin: 0; }

        .type-chip {
          display: inline-flex; align-items: center;
          padding: 3px 10px; border-radius: var(--r-sm);
          font-size: 12px; font-weight: 600; border: 1px solid;
        }

        .date-main { font-size: 13px; color: var(--text-1); font-weight: 500; }
        .date-range { font-size: 11.5px; color: var(--text-3); margin-top: 1px; }
        .duration-val { font-size: 14px; font-weight: 700; color: var(--text-1); }
        .duration-unit { font-size: 12px; color: var(--text-3); font-weight: 400; }
        .reason-txt { font-size: 12.5px; color: var(--text-2); max-width: 180px; line-height: 1.4; }
        .created-txt { font-size: 12px; color: var(--text-3); white-space: nowrap; }

        .ct-empty { padding: 60px 24px; text-align: center; }
        .ct-empty-icon { width: 56px; height: 56px; border-radius: var(--r-lg); background: var(--surface-2); border: 1px solid var(--border); display: flex; align-items: center; justify-content: center; margin: 0 auto 14px; }
        .ct-empty-title { font-size: 14px; font-weight: 600; color: var(--text-2); margin-bottom: 6px; }
        .ct-empty-desc { font-size: 13px; color: var(--text-3); }

        .ct-pagination { display: flex; align-items: center; justify-content: space-between; padding: 14px 20px; border-top: 1px solid var(--border); gap: 12px; flex-wrap: wrap; }
        .ct-pag-info { font-size: 12.5px; color: var(--text-2); }
        .ct-pag-btns { display: flex; gap: 6px; }
        .ct-pag-btn {
          padding: 6px 14px; border-radius: var(--r-sm);
          border: 1px solid var(--border); background: var(--surface);
          font-size: 12.5px; font-weight: 500; color: var(--text-2);
          text-decoration: none; transition: background 0.13s, border-color 0.13s;
          font-family: 'Plus Jakarta Sans', sans-serif;
        }
        .ct-pag-btn:hover { background: var(--surface-2); border-color: var(--border-2); }

        /* Badge max hari */
        .max-days-badge {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 4px 10px; border-radius: 999px;
          background: rgba(37,99,235,0.07); color: #1D4ED8;
          border: 1px solid rgba(37,99,235,0.15);
          font-size: 11.5px; font-weight: 600;
        }

        /* Attachment */
        .attach-link {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 4px 9px; border-radius: var(--r-sm);
          background: rgba(37,99,235,0.06); color: #2563EB;
          border: 1px solid rgba(37,99,235,0.14);
          font-size: 11.5px; font-weight: 500;
          text-decoration: none; max-width: 140px;
          transition: background 0.13s, border-color 0.13s;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .attach-link:hover { background: rgba(37,99,235,0.12); border-color: rgba(37,99,235,0.28); }
        .attach-none { font-size: 12px; color: var(--text-3); }
      `}</style>

      <div className="ct-page">
        <div>
          <h1 className="ct-title">Izin Karyawan</h1>
          <p className="ct-sub">
            Kelola pengajuan izin karyawan
            <span className="max-days-badge" style={{ marginLeft: 10 }}>
              <Clock size={11} /> Maks. 3 hari kerja per pengajuan
            </span>
          </p>
        </div>

        {/* Stats */}
        <div className="ct-stats">
          {statCards.map((card) => (
            <a
              key={card.href}
              href={`/dashboard/cuti?status=${card.href}`}
              className={`ct-stat${card.urgent ? " urgent" : ""}`}
            >
              <div className="ct-stat-icon" style={{ background: card.bg }}>
                <card.icon size={17} color={card.color} strokeWidth={2} />
              </div>
              <div>
                <div className="ct-stat-val">{card.value}</div>
                <div className="ct-stat-lbl">{card.label}</div>
              </div>
            </a>
          ))}
        </div>

        {/* Tabs */}
        <div className="ct-tabs">
          {tabs.map((tab) => (
            <a
              key={tab.value}
              href={`/dashboard/cuti?status=${tab.value}`}
              className={`ct-tab${active === tab.value ? " active" : ""}`}
            >
              {tab.label}
              <span className="ct-tab-count">{tab.count}</span>
            </a>
          ))}
        </div>

        {/* Table */}
        <div className="ct-panel">
          <div className="ct-panel-head">
            <div>
              <span className="ct-panel-title">Daftar Pengajuan Izin</span>
              {count > 0 && (
                <span className="ct-panel-meta" style={{ marginLeft: 8 }}>
                  ({count} total)
                </span>
              )}
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
                {count} records
              </span>
            </div>
          </div>

          {requests.length === 0 ? (
            <div className="ct-empty">
              <div className="ct-empty-icon">
                <CalendarDays size={22} color="var(--text-3)" />
              </div>
              <p className="ct-empty-title">Tidak ada pengajuan izin</p>
              <p className="ct-empty-desc">
                Belum ada data untuk filter yang dipilih
              </p>
            </div>
          ) : (
            <>
              <div className="ct-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Karyawan</th>
                      <th>Jenis Izin</th>
                      <th>Tanggal</th>
                      <th>Durasi</th>
                      <th>Alasan</th>
                      <th>Attachment</th>
                      <th>Status</th>
                      <th>Diajukan</th>
                      <th style={{ textAlign: "center" }}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requests.map((req) => {
                      const s =
                        STATUS[req.status as keyof typeof STATUS] ||
                        STATUS.cancelled;
                      const typeStyle =
                        TYPE_CHIP[req.leave_type_code] || TYPE_CHIP.kepentingan;
                      return (
                        <tr key={req.id}>
                          <td>
                            <div className="td-emp">
                              <div
                                className="td-avatar"
                                style={{ background: s.bg, color: s.fg }}
                              >
                                {req.employee?.name?.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className="td-name">{req.employee?.name}</p>
                                <p className="td-dept">
                                  {req.employee?.department || "—"}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td>
                            {/* Pakai leave_type_label langsung, tidak join tabel */}
                            <span
                              className="type-chip"
                              style={{
                                background: typeStyle.bg,
                                color: typeStyle.fg,
                                borderColor: typeStyle.border,
                              }}
                            >
                              {req.leave_type_label}
                            </span>
                          </td>
                          <td>
                            <div className="date-main">
                              {formatDate(req.start_date, { month: "short" })}
                            </div>
                            {req.start_date !== req.end_date && (
                              <div className="date-range">
                                s/d{" "}
                                {formatDate(req.end_date, { month: "short" })}
                              </div>
                            )}
                          </td>
                          <td>
                            <span className="duration-val">
                              {req.total_days}
                            </span>
                            <span className="duration-unit"> hari</span>
                          </td>
                          <td>
                            <p className="reason-txt" title={req.reason || ""}>
                              {req.reason
                                ? req.reason.substring(0, 55) +
                                  (req.reason.length > 55 ? "…" : "")
                                : "—"}
                            </p>
                          </td>
                          <td>
                            {req.attachment_url ? (
                              <a
                                href={`/api/leave/attachment/${req.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="attach-link"
                                title={
                                  req.attachment_name || "Lihat attachment"
                                }
                                onClick={async (e) => {
                                  // Fetch signed URL dulu, lalu buka di tab baru
                                  e.preventDefault();
                                  const res = await fetch(
                                    `/api/leave/attachment/${req.id}`,
                                  );
                                  const json = await res.json();
                                  if (json?.data?.signed_url) {
                                    window.open(json.data.signed_url, "_blank");
                                  }
                                }}
                              >
                                <Paperclip size={11} />
                                {req.attachment_name
                                  ? req.attachment_name.length > 18
                                    ? req.attachment_name.substring(0, 16) + "…"
                                    : req.attachment_name
                                  : "Lihat file"}
                              </a>
                            ) : (
                              <span className="attach-none">—</span>
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
                            <span className="created-txt">
                              {formatDate(req.created_at, { month: "short" })}
                            </span>
                          </td>
                          <td style={{ textAlign: "center" }}>
                            <LeaveRequestActions request={req} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="ct-pagination">
                  <span className="ct-pag-info">
                    Halaman {page} dari {totalPages}
                  </span>
                  <div className="ct-pag-btns">
                    {page > 1 && (
                      <a
                        href={`/dashboard/cuti?status=${active}&page=${page - 1}`}
                        className="ct-pag-btn"
                      >
                        ← Sebelumnya
                      </a>
                    )}
                    {page < totalPages && (
                      <a
                        href={`/dashboard/cuti?status=${active}&page=${page + 1}`}
                        className="ct-pag-btn"
                      >
                        Berikutnya →
                      </a>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
