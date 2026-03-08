import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

const ATTACHMENT_BUCKET = "leave-attachments";
const SIGNED_URL_EXPIRES = 60 * 60; // 1 jam

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/leave/attachment/[id]
 *
 * Generate signed URL untuk mengunduh attachment dari pengajuan izin.
 * Hanya bisa diakses oleh:
 * - Karyawan yang mengajukan (employee pemilik)
 * - Admin
 *
 * Signed URL berlaku selama 1 jam.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = await createClient();
    const { id } = await params;

    // ── Auth ──────────────────────────────────────────
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: currentEmployee } = await supabase
      .from("employees")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!currentEmployee) {
      return NextResponse.json(
        { error: "Employee not found" },
        { status: 404 },
      );
    }

    // ── Ambil data leave request ──────────────────────
    const { data: leaveRequest, error: fetchError } = await supabase
      .from("leave_requests")
      .select("id, employee_id, attachment_url, attachment_name, status")
      .eq("id", id)
      .single();

    if (fetchError || !leaveRequest) {
      return NextResponse.json(
        { error: "Pengajuan izin tidak ditemukan" },
        { status: 404 },
      );
    }

    // ── Cek akses: hanya pemilik atau admin ───────────
    const isOwner = leaveRequest.employee_id === currentEmployee.id;
    const isAdmin = currentEmployee.role === "admin";

    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { error: "Anda tidak memiliki akses ke file ini" },
        { status: 403 },
      );
    }

    // ── Cek apakah ada attachment ─────────────────────
    if (!leaveRequest.attachment_url) {
      return NextResponse.json(
        { error: "Pengajuan ini tidak memiliki attachment" },
        { status: 404 },
      );
    }

    // ── Generate signed URL ───────────────────────────
    const { data: signedUrlData, error: signedUrlError } =
      await supabase.storage
        .from(ATTACHMENT_BUCKET)
        .createSignedUrl(leaveRequest.attachment_url, SIGNED_URL_EXPIRES);

    if (signedUrlError || !signedUrlData?.signedUrl) {
      console.error("Signed URL error:", signedUrlError);
      return NextResponse.json(
        { error: "Gagal membuat link download. Coba lagi." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        signed_url: signedUrlData.signedUrl,
        file_name: leaveRequest.attachment_name,
        expires_in_secs: SIGNED_URL_EXPIRES,
      },
    });
  } catch (error) {
    console.error("Get attachment error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/leave/attachment/[id]
 *
 * Hapus attachment dari storage + clear kolom di DB.
 * Hanya bisa dilakukan jika status masih "pending" (belum diproses admin).
 * Hanya bisa dilakukan oleh pemilik izin.
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = await createClient();
    const { id } = await params;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: currentEmployee } = await supabase
      .from("employees")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!currentEmployee) {
      return NextResponse.json(
        { error: "Employee not found" },
        { status: 404 },
      );
    }

    const { data: leaveRequest, error: fetchError } = await supabase
      .from("leave_requests")
      .select("id, employee_id, attachment_url, status")
      .eq("id", id)
      .single();

    if (fetchError || !leaveRequest) {
      return NextResponse.json(
        { error: "Pengajuan izin tidak ditemukan" },
        { status: 404 },
      );
    }

    // Hanya pemilik yang boleh hapus
    if (leaveRequest.employee_id !== currentEmployee.id) {
      return NextResponse.json(
        { error: "Anda tidak memiliki akses ke file ini" },
        { status: 403 },
      );
    }

    // Hanya boleh hapus kalau masih pending
    if (leaveRequest.status !== "pending") {
      return NextResponse.json(
        { error: "Attachment tidak bisa dihapus setelah pengajuan diproses" },
        { status: 400 },
      );
    }

    if (!leaveRequest.attachment_url) {
      return NextResponse.json(
        { error: "Tidak ada attachment untuk dihapus" },
        { status: 404 },
      );
    }

    // Hapus file dari storage
    const { error: deleteStorageError } = await supabase.storage
      .from(ATTACHMENT_BUCKET)
      .remove([leaveRequest.attachment_url]);

    if (deleteStorageError) {
      console.error("Delete storage error:", deleteStorageError);
      // Lanjutkan meskipun storage error — tetap clear DB
    }

    // Clear kolom di DB
    const { error: updateError } = await supabase
      .from("leave_requests")
      .update({ attachment_url: null, attachment_name: null })
      .eq("id", id);

    if (updateError) throw updateError;

    return NextResponse.json({
      success: true,
      message: "Attachment berhasil dihapus",
    });
  } catch (error) {
    console.error("Delete attachment error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
