"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Toast } from "@/components/ui/toast";
import { Check, X } from "lucide-react";
import type { LeaveRequest, Employee, LeaveType } from "@/types";

interface LeaveRequestActionsProps {
  request: LeaveRequest & { employee: Employee; leave_type: LeaveType };
}

/**
 * CATATAN: Update leave_balance dilakukan OTOMATIS oleh database trigger.
 * Komponen ini hanya perlu update status leave_request.
 * Jangan tambahkan manual balance update di sini.
 */
export function LeaveRequestActions({ request }: LeaveRequestActionsProps) {
  const router = useRouter();
  const supabase = createClient();

  const [showReject, setShowReject] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  const handleApprove = async () => {
    setLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error("Not authenticated");

      const { data: adminEmployee } = await supabase
        .from("employees")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!adminEmployee) throw new Error("Admin not found");

      // Update status — DB trigger otomatis update leave_balance
      const { error } = await supabase
        .from("leave_requests")
        .update({
          status: "approved",
          approved_by: adminEmployee.id,
          approved_at: new Date().toISOString(),
        })
        .eq("id", request.id);

      if (error) throw error;

      setToast({
        message: "Pengajuan cuti berhasil disetujui",
        type: "success",
      });
      router.refresh();
    } catch (err) {
      console.error("Error approving request:", err);
      setToast({ message: "Gagal menyetujui pengajuan", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      setToast({ message: "Masukkan alasan penolakan", type: "error" });
      return;
    }

    setLoading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error("Not authenticated");

      const { data: adminEmployee } = await supabase
        .from("employees")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!adminEmployee) throw new Error("Admin not found");

      // Update status — DB trigger akan handle rollback balance jika sebelumnya approved
      const { error } = await supabase
        .from("leave_requests")
        .update({
          status: "rejected",
          approved_by: adminEmployee.id,
          approved_at: new Date().toISOString(),
          rejection_reason: rejectReason,
        })
        .eq("id", request.id);

      if (error) throw error;

      setShowReject(false);
      setRejectReason("");
      setToast({ message: "Pengajuan cuti berhasil ditolak", type: "success" });
      router.refresh();
    } catch (err) {
      console.error("Error rejecting request:", err);
      setToast({ message: "Gagal menolak pengajuan", type: "error" });
    } finally {
      setLoading(false);
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

      <div className="flex items-center justify-end gap-2">
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
      </div>

      {/* Modal Tolak */}
      {showReject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold">Tolak Pengajuan</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Pengajuan cuti dari <strong>{request.employee?.name}</strong>
            </p>

            <div className="mt-4 space-y-2">
              <Label htmlFor="reject-reason" required>
                Alasan Penolakan
              </Label>
              <Input
                id="reject-reason"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Masukkan alasan penolakan..."
              />
            </div>

            <div className="mt-6 flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setShowReject(false);
                  setRejectReason("");
                }}
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
    </>
  );
}
