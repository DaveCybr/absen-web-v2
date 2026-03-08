"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Toast } from "@/components/ui/toast";
import { Check, X, Ban } from "lucide-react";

interface IzinDetailActionsProps {
  id: string;
  status: "pending" | "approved";
  employeeName: string;
  leaveTypeLabel: string;
}

export function IzinDetailActions({
  id,
  status,
  employeeName,
  leaveTypeLabel,
}: IzinDetailActionsProps) {
  const router = useRouter();

  const [showReject, setShowReject] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  const showToast = (message: string, type: "success" | "error") =>
    setToast({ message, type });

  const handleApprove = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/leave/request/${id}/approve`, {
        method: "PUT",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      showToast("Pengajuan izin berhasil disetujui", "success");
      router.refresh();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Gagal menyetujui",
        "error",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      showToast("Masukkan alasan penolakan", "error");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/leave/request/${id}/reject`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectReason.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      showToast("Pengajuan izin berhasil ditolak", "success");
      router.push("/dashboard/cuti");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Gagal menolak", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/leave/request/${id}/cancel`, {
        method: "PUT",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      showToast("Izin berhasil dibatalkan", "success");
      router.refresh();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Gagal membatalkan",
        "error",
      );
    } finally {
      setLoading(false);
      setShowCancelConfirm(false);
    }
  };

  return (
    <>
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {status === "pending" && (
          <>
            <Button
              size="sm"
              variant="outline"
              className="text-green-600 hover:bg-green-50 hover:text-green-700"
              onClick={handleApprove}
              disabled={loading}
            >
              <Check className="mr-1.5 h-4 w-4" /> Setujui
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-red-600 hover:bg-red-50 hover:text-red-700"
              onClick={() => setShowReject(true)}
              disabled={loading}
            >
              <X className="mr-1.5 h-4 w-4" /> Tolak
            </Button>
          </>
        )}

        {status === "approved" && (
          <Button
            size="sm"
            variant="outline"
            className="text-slate-500 hover:bg-red-50 hover:text-red-600 hover:border-red-200"
            onClick={() => setShowCancelConfirm(true)}
            disabled={loading}
          >
            <Ban className="mr-1.5 h-4 w-4" /> Batalkan
          </Button>
        )}
      </div>

      {/* Modal Tolak */}
      {showReject && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.35)" }}
          onClick={(e) => e.target === e.currentTarget && setShowReject(false)}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 380,
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--r-lg)",
              boxShadow: "0 8px 30px rgba(0,0,0,0.12)",
              padding: "20px 20px",
            }}
          >
            <p
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: "var(--text-1)",
                marginBottom: 4,
              }}
            >
              Tolak Pengajuan
            </p>
            <p
              style={{ fontSize: 13, color: "var(--text-3)", marginBottom: 16 }}
            >
              Izin{" "}
              <strong style={{ color: "var(--text-2)" }}>
                {leaveTypeLabel}
              </strong>{" "}
              dari{" "}
              <strong style={{ color: "var(--text-2)" }}>{employeeName}</strong>
            </p>
            <div style={{ marginBottom: 16 }}>
              <Label htmlFor="reject-reason" style={{ fontSize: 12.5 }}>
                Alasan Penolakan
              </Label>
              <Input
                id="reject-reason"
                style={{ marginTop: 6 }}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Masukkan alasan penolakan..."
                onKeyDown={(e) => e.key === "Enter" && handleReject()}
                autoFocus
              />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setShowReject(false);
                  setRejectReason("");
                }}
                disabled={loading}
              >
                Batal
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={handleReject}
                loading={loading}
              >
                Tolak
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Batalkan */}
      {showCancelConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.35)" }}
          onClick={(e) =>
            e.target === e.currentTarget && setShowCancelConfirm(false)
          }
        >
          <div
            style={{
              width: "100%",
              maxWidth: 360,
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--r-lg)",
              boxShadow: "0 8px 30px rgba(0,0,0,0.12)",
              padding: "20px",
            }}
          >
            <p
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: "var(--text-1)",
                marginBottom: 4,
              }}
            >
              Batalkan Izin?
            </p>
            <p
              style={{ fontSize: 13, color: "var(--text-3)", marginBottom: 20 }}
            >
              Izin{" "}
              <strong style={{ color: "var(--text-2)" }}>
                {leaveTypeLabel}
              </strong>{" "}
              milik{" "}
              <strong style={{ color: "var(--text-2)" }}>{employeeName}</strong>{" "}
              akan dibatalkan. Tindakan ini tidak bisa diurungkan.
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowCancelConfirm(false)}
                disabled={loading}
              >
                Tidak
              </Button>
              <Button
                className="flex-1"
                style={{ background: "#F97316", borderColor: "#F97316" }}
                onClick={handleCancel}
                loading={loading}
              >
                Ya, Batalkan
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
