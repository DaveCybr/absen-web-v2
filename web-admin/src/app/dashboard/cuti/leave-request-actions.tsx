"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Toast } from "@/components/ui/toast";

import { Check, X, Paperclip, Ban, Eye } from "lucide-react";
import Link from "next/link";
import type { Employee } from "@/types";

// ── Tipe ────────────────────────────────────────────────────
interface IzinRequest {
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
  employee: Pick<Employee, "name"> & { department?: string };
  approver: { name: string } | null;
}

interface LeaveRequestActionsProps {
  request: IzinRequest;
}

export function LeaveRequestActions({ request }: LeaveRequestActionsProps) {
  const router = useRouter();

  const [showReject, setShowReject] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [attachLoading, setAttachLoading] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  const showToast = (message: string, type: "success" | "error") =>
    setToast({ message, type });

  // ── Handlers ────────────────────────────────────────────
  const handleApprove = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/leave/request/${request.id}/approve`, {
        method: "PUT",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal menyetujui");
      showToast("Pengajuan izin berhasil disetujui", "success");
      router.refresh();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Gagal menyetujui pengajuan",
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
      const res = await fetch(`/api/leave/request/${request.id}/reject`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectReason.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal menolak");
      setShowReject(false);
      setRejectReason("");
      showToast("Pengajuan izin berhasil ditolak", "success");
      router.refresh();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Gagal menolak pengajuan",
        "error",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/leave/request/${request.id}/cancel`, {
        method: "PUT",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal membatalkan");
      setShowCancelConfirm(false);
      showToast("Izin berhasil dibatalkan", "success");
      router.refresh();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Gagal membatalkan izin",
        "error",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleViewAttachment = async () => {
    setAttachLoading(true);
    try {
      const res = await fetch(`/api/leave/attachment/${request.id}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal membuka file");
      window.open(json.data.signed_url, "_blank", "noopener,noreferrer");
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Gagal membuka attachment",
        "error",
      );
    } finally {
      setAttachLoading(false);
    }
  };

  // ── Render ──────────────────────────────────────────────
  return (
    <>
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      <div className="flex items-center justify-end gap-1">
        {/* 1. Lihat Detail — semua status, navigate ke halaman detail */}
        <Link href={`/dashboard/cuti/${request.id}`}>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            title="Lihat detail"
          >
            <Eye className="h-4 w-4" />
          </Button>
        </Link>

        {/* 2. Lihat Attachment — semua status, hanya kalau ada file */}
        {request.attachment_url && (
          <Button
            size="sm"
            variant="ghost"
            className="h-8 text-blue-600 hover:bg-blue-50 hover:text-blue-700"
            onClick={handleViewAttachment}
            disabled={attachLoading}
            title={request.attachment_name || "Lihat attachment"}
          >
            <Paperclip className="h-4 w-4" />
          </Button>
        )}

        {/* 3. Setujui + Tolak — hanya pending */}
        {request.status === "pending" && (
          <>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-green-600 hover:bg-green-50 hover:text-green-700"
              onClick={handleApprove}
              disabled={loading}
            >
              <Check className="mr-1 h-4 w-4" />
              Setujui
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-red-600 hover:bg-red-50 hover:text-red-700"
              onClick={() => setShowReject(true)}
              disabled={loading}
            >
              <X className="mr-1 h-4 w-4" />
              Tolak
            </Button>
          </>
        )}

        {/* 4. Batalkan — hanya approved */}
        {request.status === "approved" && (
          <Button
            size="sm"
            variant="ghost"
            className="h-8 text-slate-500 hover:bg-red-50 hover:text-red-600"
            onClick={() => setShowCancelConfirm(true)}
            disabled={loading}
            title="Batalkan izin"
          >
            <Ban className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Modal Tolak */}
      {showReject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl">
            <h2 className="text-base font-semibold text-slate-900">
              Tolak Pengajuan
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Izin <strong>{request.leave_type_label}</strong> dari{" "}
              <strong>{request.employee?.name}</strong>
            </p>
            <div className="mt-4 space-y-2">
              <Label htmlFor="reject-reason">Alasan Penolakan</Label>
              <Input
                id="reject-reason"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Masukkan alasan penolakan..."
                onKeyDown={(e) => e.key === "Enter" && handleReject()}
                autoFocus
              />
            </div>
            <div className="mt-5 flex gap-3">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center flex-shrink-0">
                <Ban className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Batalkan Izin?
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Tindakan ini tidak bisa diurungkan
                </p>
              </div>
            </div>
            <p className="text-sm text-slate-600">
              Izin <strong>{request.leave_type_label}</strong> milik{" "}
              <strong>{request.employee?.name}</strong> akan dibatalkan.
            </p>
            <div className="mt-5 flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowCancelConfirm(false)}
                disabled={loading}
              >
                Tidak
              </Button>
              <Button
                className="flex-1 bg-orange-500 hover:bg-orange-600 text-white border-0"
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
