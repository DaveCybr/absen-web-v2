import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * PUT /api/leave/request/[id]/cancel
 *
 * Batalkan pengajuan izin yang sudah approved.
 * Hanya bisa dilakukan oleh:
 * - Karyawan pemilik izin (selama status approved)
 * - Admin (bisa batalkan milik siapapun)
 *
 * Status yang bisa dibatalkan: "approved" saja.
 * "pending" → gunakan flow reject, bukan cancel.
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
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
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!currentEmployee) {
      return NextResponse.json(
        { error: "Employee not found" },
        { status: 404 },
      );
    }

    // Ambil data izin
    const { data: leaveRequest, error: fetchError } = await supabase
      .from("leave_requests")
      .select("id, employee_id, status, leave_type_label, start_date")
      .eq("id", id)
      .single();

    if (fetchError || !leaveRequest) {
      return NextResponse.json(
        { error: "Pengajuan izin tidak ditemukan" },
        { status: 404 },
      );
    }

    // Cek kepemilikan — karyawan hanya bisa batalkan miliknya sendiri
    const isOwner = leaveRequest.employee_id === currentEmployee.id;
    const isAdmin = currentEmployee.role === "admin";

    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { error: "Anda tidak memiliki akses untuk membatalkan izin ini" },
        { status: 403 },
      );
    }

    // Hanya approved yang bisa dibatalkan
    if (leaveRequest.status !== "approved") {
      return NextResponse.json(
        {
          error:
            leaveRequest.status === "pending"
              ? "Izin yang masih pending tidak bisa dibatalkan. Hubungi admin untuk menolak pengajuan."
              : "Hanya izin yang sudah disetujui yang bisa dibatalkan",
        },
        { status: 400 },
      );
    }

    // Tidak bisa batalkan izin yang sudah lewat
    const today = new Date().toISOString().split("T")[0];
    if (leaveRequest.start_date < today) {
      return NextResponse.json(
        { error: "Tidak bisa membatalkan izin yang tanggalnya sudah lewat" },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from("leave_requests")
      .update({
        status: "cancelled",
        approved_by: currentEmployee.id,
        approved_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select(`*, employee:employees!leave_requests_employee_id_fkey(id, name)`)
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data,
      message: "Izin berhasil dibatalkan",
    });
  } catch (error) {
    console.error("Cancel leave request error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
