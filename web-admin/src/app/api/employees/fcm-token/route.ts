import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// PUT - Update FCM token karyawan (dipanggil mobile app setelah login)
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Verifikasi user login via Bearer token
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { employee_id, fcm_token } = body;

    if (!employee_id || !fcm_token) {
      return NextResponse.json(
        { error: "employee_id dan fcm_token wajib diisi" },
        { status: 400 },
      );
    }

    // Pastikan employee_id milik user yang login
    const { data: employee, error: empError } = await supabase
      .from("employees")
      .select("id, user_id")
      .eq("id", employee_id)
      .single();

    if (empError || !employee) {
      return NextResponse.json(
        { error: "Employee not found" },
        { status: 404 },
      );
    }

    if (employee.user_id !== user.id) {
      return NextResponse.json(
        { error: "Tidak boleh update FCM token milik orang lain" },
        { status: 403 },
      );
    }

    // Update FCM token
    const { error: updateError } = await supabase
      .from("employees")
      .update({ fcm_token })
      .eq("id", employee_id);

    if (updateError) throw updateError;

    return NextResponse.json({
      success: true,
      message: "FCM token berhasil diperbarui",
    });
  } catch (error) {
    console.error("Update FCM token error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// DELETE - Hapus FCM token saat logout (agar tidak dapat notif setelah logout)
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get("employee_id");

    if (!employeeId) {
      return NextResponse.json(
        { error: "employee_id is required" },
        { status: 400 },
      );
    }

    const { error } = await supabase
      .from("employees")
      .update({ fcm_token: null })
      .eq("id", employeeId)
      .eq("user_id", user.id); // pastikan hanya bisa hapus milik sendiri

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: "FCM token berhasil dihapus",
    });
  } catch (error) {
    console.error("Delete FCM token error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
