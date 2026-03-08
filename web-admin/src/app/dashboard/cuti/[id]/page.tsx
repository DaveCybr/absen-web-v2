import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { formatDate } from "@/lib/utils";
import { IzinDetailActions } from "./izin-detail-actions";
import {
  ArrowLeft,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Paperclip,
  User,
  FileText,
  Building2,
} from "lucide-react";
import type { Employee } from "@/types";

interface PageProps {
  params: Promise<{ id: string }>;
}

const STATUS = {
  pending: {
    label: "Menunggu",
    icon: Clock,
    dot: "#F59E0B",
    pill: "pill-pending",
  },
  approved: {
    label: "Disetujui",
    icon: CheckCircle2,
    dot: "#22C55E",
    pill: "pill-approved",
  },
  rejected: {
    label: "Ditolak",
    icon: XCircle,
    dot: "#EF4444",
    pill: "pill-rejected",
  },
  cancelled: {
    label: "Dibatalkan",
    icon: AlertCircle,
    dot: "#94A3B8",
    pill: "pill-cancelled",
  },
};

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

async function getIzinDetail(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("leave_requests")
    .select(
      `
      *,
      employee:employees!leave_requests_employee_id_fkey(*),
      approver:employees!leave_requests_approved_by_fkey(id, name)
    `,
    )
    .eq("id", id)
    .single();

  if (error || !data) return null;
  return data as typeof data & {
    employee: Employee;
    approver: { id: string; name: string } | null;
  };
}

export default async function IzinDetailPage({ params }: PageProps) {
  const { id } = await params;
  const izin = await getIzinDetail(id);

  if (!izin) notFound();

  const s = STATUS[izin.status as keyof typeof STATUS] || STATUS.cancelled;
  const chip = TYPE_CHIP[izin.leave_type_code] || TYPE_CHIP.kepentingan;
  const StatusIcon = s.icon;

  return (
    <>
      <style>{`
        .id-page { display: flex; flex-direction: column; gap: 20px; max-width: 640px; }

        /* Back link */
        .id-back {
          display: inline-flex; align-items: center; gap: 6px;
          font-size: 13px; font-weight: 500; color: var(--text-3);
          text-decoration: none;
          transition: color 0.13s;
          width: fit-content;
        }
        .id-back:hover { color: var(--text-1); }

        /* Card */
        .id-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--r-lg);
          box-shadow: var(--shadow-sm);
          overflow: hidden;
        }

        /* Card header */
        .id-card-head {
          padding: 16px 20px;
          border-bottom: 1px solid var(--border);
          display: flex; align-items: center; justify-content: space-between; gap: 12px;
        }
        .id-card-title { font-size: 13.5px; font-weight: 700; color: var(--text-1); }
        .id-card-sub   { font-size: 11.5px; color: var(--text-3); margin-top: 1px; font-family: monospace; }

        /* Info rows */
        .id-row {
          display: flex; align-items: flex-start;
          padding: 12px 20px;
          border-bottom: 1px solid var(--border);
          gap: 12px;
        }
        .id-row:last-child { border-bottom: none; }
        .id-row-label {
          width: 130px; flex-shrink: 0;
          font-size: 12.5px; font-weight: 500; color: var(--text-3);
          padding-top: 1px;
        }
        .id-row-value {
          flex: 1;
          font-size: 13.5px; font-weight: 500; color: var(--text-1);
          line-height: 1.45;
        }
        .id-row-icon {
          width: 18px; height: 18px; flex-shrink: 0; margin-top: 1px;
          color: var(--text-3);
          display: flex; align-items: center; justify-content: center;
        }

        /* Chip */
        .id-chip {
          display: inline-flex; align-items: center;
          padding: 3px 10px; border-radius: var(--r-sm);
          font-size: 12px; font-weight: 600; border: 1px solid;
        }

        /* Text muted */
        .id-muted { color: var(--text-3); font-weight: 400; }

        /* Alasan box */
        .id-reason-box {
          padding: 12px 20px; border-bottom: 1px solid var(--border);
        }
        .id-reason-label { font-size: 12.5px; font-weight: 500; color: var(--text-3); margin-bottom: 8px; }
        .id-reason-text {
          font-size: 13.5px; color: var(--text-2); line-height: 1.6;
          background: var(--surface-2); border: 1px solid var(--border);
          border-radius: var(--r-md); padding: 12px 14px;
        }

        /* Rejection box */
        .id-reject-box {
          margin: 0; padding: 14px 20px;
          background: rgba(220,38,38,0.04);
          border-top: 1px solid rgba(220,38,38,0.12);
        }
        .id-reject-label {
          font-size: 11px; font-weight: 700; color: #B91C1C;
          text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 6px;
        }
        .id-reject-text { font-size: 13.5px; color: #7F1D1D; line-height: 1.55; }

        /* Attachment button */
        .id-attach-btn {
          display: inline-flex; align-items: center; gap: 7px;
          padding: 7px 12px;
          background: var(--surface-2); border: 1px solid var(--border);
          border-radius: var(--r-md);
          font-size: 13px; font-weight: 500; color: var(--text-2);
          cursor: pointer; text-decoration: none;
          transition: border-color 0.13s, color 0.13s, background 0.13s;
        }
        .id-attach-btn:hover {
          background: rgba(37,99,235,0.06);
          border-color: rgba(37,99,235,0.22);
          color: #1D4ED8;
        }

        /* Approver note */
        .id-approved-by {
          font-size: 12px; color: var(--text-3); margin-top: 5px;
        }
        .id-approved-by strong { color: var(--text-2); font-weight: 600; }

        /* Actions card */
        .id-actions-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--r-lg);
          box-shadow: var(--shadow-sm);
          padding: 16px 20px;
          display: flex; align-items: center; justify-content: space-between; gap: 12px;
        }
        .id-actions-label { font-size: 13px; font-weight: 600; color: var(--text-1); }
        .id-actions-sub   { font-size: 12px; color: var(--text-3); margin-top: 1px; }
      `}</style>

      <div className="id-page">
        {/* Back */}
        <a href="/dashboard/cuti" className="id-back">
          <ArrowLeft size={14} />
          Kembali ke daftar izin
        </a>

        {/* Info karyawan */}
        <div className="id-card">
          <div className="id-card-head">
            <div>
              <p className="id-card-title">Detail Pengajuan Izin</p>
              <p className="id-card-sub">{izin.id}</p>
            </div>
            <span className={`pill ${s.pill}`}>
              <span className="pill-dot" style={{ background: s.dot }} />
              {s.label}
            </span>
          </div>

          {/* Karyawan */}
          <div className="id-row">
            <div className="id-row-icon">
              <User size={14} />
            </div>
            <span className="id-row-label">Karyawan</span>
            <div className="id-row-value">
              {izin.employee?.name}
              {izin.employee?.department && (
                <span className="id-muted"> · {izin.employee.department}</span>
              )}
            </div>
          </div>

          {/* Jenis izin */}
          <div className="id-row">
            <div className="id-row-icon">
              <FileText size={14} />
            </div>
            <span className="id-row-label">Jenis Izin</span>
            <div className="id-row-value">
              <span
                className="id-chip"
                style={{
                  background: chip.bg,
                  color: chip.fg,
                  borderColor: chip.border,
                }}
              >
                {izin.leave_type_label}
              </span>
            </div>
          </div>

          {/* Tanggal */}
          <div className="id-row">
            <div className="id-row-icon">
              <Calendar size={14} />
            </div>
            <span className="id-row-label">Tanggal</span>
            <div className="id-row-value">
              {formatDate(izin.start_date, { month: "long" })}
              {izin.start_date !== izin.end_date && (
                <> — {formatDate(izin.end_date, { month: "long" })}</>
              )}
              <span className="id-muted"> · {izin.total_days} hari kerja</span>
            </div>
          </div>

          {/* Status & diproses */}
          <div className="id-row">
            <div className="id-row-icon">
              <StatusIcon size={14} />
            </div>
            <span className="id-row-label">Status</span>
            <div className="id-row-value">
              <span className={`pill ${s.pill}`}>
                <span className="pill-dot" style={{ background: s.dot }} />
                {s.label}
              </span>
              {izin.approver && izin.approved_at && (
                <p className="id-approved-by">
                  oleh <strong>{izin.approver.name}</strong>
                  {" · "}
                  {formatDate(izin.approved_at, { month: "short" })}
                </p>
              )}
            </div>
          </div>

          {/* Diajukan */}
          <div className="id-row">
            <div className="id-row-icon">
              <Clock size={14} />
            </div>
            <span className="id-row-label">Diajukan</span>
            <div className="id-row-value id-muted">
              {formatDate(izin.created_at, { month: "long" })}
            </div>
          </div>

          {/* Departemen karyawan */}
          {izin.employee?.department && (
            <div className="id-row">
              <div className="id-row-icon">
                <Building2 size={14} />
              </div>
              <span className="id-row-label">Departemen</span>
              <div className="id-row-value">{izin.employee.department}</div>
            </div>
          )}

          {/* Alasan */}
          {izin.reason && (
            <div className="id-reason-box">
              <p className="id-reason-label">Alasan</p>
              <div className="id-reason-text">{izin.reason}</div>
            </div>
          )}

          {/* Attachment */}
          {izin.attachment_url && (
            <div className="id-reason-box">
              <p className="id-reason-label">Lampiran</p>
              <IzinAttachmentLink id={izin.id} name={izin.attachment_name} />
            </div>
          )}

          {/* Penolakan */}
          {izin.status === "rejected" && izin.rejection_reason && (
            <div className="id-reject-box">
              <p className="id-reject-label">Alasan Penolakan</p>
              <p className="id-reject-text">{izin.rejection_reason}</p>
            </div>
          )}
        </div>

        {/* Aksi — hanya kalau pending atau approved */}
        {(izin.status === "pending" || izin.status === "approved") && (
          <div className="id-actions-card">
            <div>
              <p className="id-actions-label">
                {izin.status === "pending"
                  ? "Tindakan diperlukan"
                  : "Batalkan Izin"}
              </p>
              <p className="id-actions-sub">
                {izin.status === "pending"
                  ? "Pengajuan ini menunggu persetujuan admin"
                  : "Izin yang sudah disetujui dapat dibatalkan"}
              </p>
            </div>
            <IzinDetailActions
              id={izin.id}
              status={izin.status}
              employeeName={izin.employee?.name || ""}
              leaveTypeLabel={izin.leave_type_label}
            />
          </div>
        )}
      </div>
    </>
  );
}

// ── Komponen attachment link (client fetch signed URL) ───────
function IzinAttachmentLink({ id, name }: { id: string; name: string | null }) {
  return (
    <a
      href={`/api/leave/attachment/${id}`}
      className="id-attach-btn"
      onClick={async (e) => {
        e.preventDefault();
        const res = await fetch(`/api/leave/attachment/${id}`);
        const json = await res.json();
        if (json?.data?.signed_url) window.open(json.data.signed_url, "_blank");
      }}
    >
      <Paperclip size={13} />
      {name || "Lihat file lampiran"}
    </a>
  );
}
