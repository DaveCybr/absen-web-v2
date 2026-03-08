"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Eye,
  X,
  Paperclip,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
} from "lucide-react";
import { formatDate } from "@/lib/utils";

interface IzinDetailProps {
  request: {
    id: string;
    status: "pending" | "approved" | "rejected" | "cancelled";
    leave_type_code: string;
    leave_type_label: string;
    start_date: string;
    end_date: string;
    total_days: number;
    reason: string | null;
    attachment_url: string | null;
    attachment_name: string | null;
    rejection_reason: string | null;
    approved_at: string | null;
    created_at: string;
    employee: { name: string; department?: string };
    approver: { name: string } | null;
  };
  onViewAttachment?: () => void;
  attachLoading?: boolean;
}

const STATUS_CONFIG = {
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

// Row helper — pakai div bukan tr/td agar tidak kena CSS global tabel
function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 0,
        padding: "10px 18px",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <span
        style={{
          width: 110,
          flexShrink: 0,
          fontSize: 12.5,
          color: "var(--text-3)",
          fontWeight: 500,
          paddingTop: 2,
        }}
      >
        {label}
      </span>
      <div
        style={{
          flex: 1,
          fontSize: 13,
          color: "var(--text-1)",
          fontWeight: 500,
        }}
      >
        {children}
      </div>
    </div>
  );
}

export function IzinDetailModal({
  request,
  onViewAttachment,
  attachLoading,
}: IzinDetailProps) {
  const [open, setOpen] = useState(false);

  const s = STATUS_CONFIG[request.status] || STATUS_CONFIG.cancelled;
  const chip = TYPE_CHIP[request.leave_type_code] || TYPE_CHIP.kepentingan;

  return (
    <>
      {/* Trigger */}
      <Button
        size="sm"
        variant="ghost"
        className="h-8 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
        onClick={() => setOpen(true)}
        title="Lihat detail"
      >
        <Eye className="h-4 w-4" />
      </Button>

      {open && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 50,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            background: "rgba(0,0,0,0.35)",
          }}
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 400,
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--r-lg)",
              boxShadow: "0 8px 30px rgba(0,0,0,0.12)",
              overflow: "hidden",
              animation: "izin-modal-in 0.16s ease",
            }}
          >
            <style>{`
              @keyframes izin-modal-in {
                from { opacity: 0; transform: translateY(6px); }
                to   { opacity: 1; transform: translateY(0);   }
              }
            `}</style>

            {/* Header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "13px 18px",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <span
                style={{
                  fontSize: 13.5,
                  fontWeight: 700,
                  color: "var(--text-1)",
                }}
              >
                Detail Pengajuan Izin
              </span>
              <button
                onClick={() => setOpen(false)}
                style={{
                  width: 26,
                  height: 26,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: "var(--r-sm)",
                  border: "1px solid var(--border)",
                  background: "transparent",
                  cursor: "pointer",
                  color: "var(--text-3)",
                }}
              >
                <X size={12} />
              </button>
            </div>

            {/* Rows */}
            <div style={{ borderBottom: "1px solid var(--border)" }}>
              <Row label="Karyawan">
                {request.employee.name}
                {request.employee.department && (
                  <span style={{ color: "var(--text-3)", fontWeight: 400 }}>
                    {" · "}
                    {request.employee.department}
                  </span>
                )}
              </Row>

              <Row label="Status">
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 3 }}
                >
                  <span
                    className={`pill ${s.pill}`}
                    style={{ fontSize: 12, width: "fit-content" }}
                  >
                    <span className="pill-dot" style={{ background: s.dot }} />
                    {s.label}
                  </span>
                  {request.approved_at && request.approver && (
                    <span style={{ fontSize: 11.5, color: "var(--text-3)" }}>
                      oleh{" "}
                      <strong
                        style={{ color: "var(--text-2)", fontWeight: 600 }}
                      >
                        {request.approver.name}
                      </strong>
                      {" · "}
                      {formatDate(request.approved_at, { month: "short" })}
                    </span>
                  )}
                </div>
              </Row>

              <Row label="Jenis Izin">
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    padding: "3px 10px",
                    borderRadius: "var(--r-sm)",
                    fontSize: 12,
                    fontWeight: 600,
                    background: chip.bg,
                    color: chip.fg,
                    border: `1px solid ${chip.border}`,
                  }}
                >
                  {request.leave_type_label}
                </span>
              </Row>

              <Row label="Tanggal">
                {formatDate(request.start_date, { month: "short" })}
                {request.start_date !== request.end_date && (
                  <> — {formatDate(request.end_date, { month: "short" })}</>
                )}
                <span style={{ color: "var(--text-3)", fontWeight: 400 }}>
                  {" · "}
                  {request.total_days} hari kerja
                </span>
              </Row>

              {request.reason && (
                <Row label="Alasan">
                  <span
                    style={{
                      color: "var(--text-2)",
                      fontWeight: 400,
                      lineHeight: 1.5,
                    }}
                  >
                    {request.reason}
                  </span>
                </Row>
              )}

              {request.attachment_url && (
                <Row label="Lampiran">
                  <button
                    onClick={() => onViewAttachment?.()}
                    disabled={attachLoading}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      background: "none",
                      border: "none",
                      padding: 0,
                      cursor: "pointer",
                      color: "#2563EB",
                      fontSize: 13,
                      fontWeight: 500,
                      opacity: attachLoading ? 0.5 : 1,
                    }}
                  >
                    <Paperclip size={13} />
                    <span
                      style={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        maxWidth: 200,
                      }}
                    >
                      {request.attachment_name || "Lihat file"}
                    </span>
                  </button>
                </Row>
              )}

              <Row label="Diajukan">
                <span style={{ color: "var(--text-2)", fontWeight: 400 }}>
                  {formatDate(request.created_at, { month: "short" })}
                </span>
              </Row>
            </div>

            {/* Penolakan */}
            {request.status === "rejected" && request.rejection_reason && (
              <div
                style={{
                  margin: "12px 18px 0",
                  padding: "10px 12px",
                  background: "rgba(220,38,38,0.05)",
                  border: "1px solid rgba(220,38,38,0.16)",
                  borderRadius: "var(--r-md)",
                }}
              >
                <p
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#B91C1C",
                    marginBottom: 4,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                  }}
                >
                  Alasan Penolakan
                </p>
                <p
                  style={{
                    fontSize: 13,
                    color: "#7F1D1D",
                    lineHeight: 1.5,
                    margin: 0,
                  }}
                >
                  {request.rejection_reason}
                </p>
              </div>
            )}

            {/* Footer */}
            <div
              style={{
                padding: "12px 18px",
                display: "flex",
                justifyContent: "flex-end",
                marginTop:
                  request.status === "rejected" && request.rejection_reason
                    ? 12
                    : 0,
              }}
            >
              <Button
                variant="outline"
                size="sm"
                onClick={() => setOpen(false)}
              >
                Tutup
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
