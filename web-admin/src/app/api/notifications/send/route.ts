import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";
import { sendToDevice, sendToMultipleDevices } from "@/lib/fcm";
import { cleanupInvalidTokens } from "@/lib/fcm-cleanup";

/**
 * POST /api/notifications/send
 *
 * Kirim notifikasi manual dari admin ke karyawan tertentu atau semua karyawan.
 * Hanya bisa diakses oleh admin.
 *
 * Body:
 * {
 *   title: string,
 *   body: string,
 *   target: "all" | "employee",
 *   employee_id?: string,  // wajib jika target = "employee"
 *   data?: Record<string, string>
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Verifikasi admin
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: adminEmployee } = await supabase
      .from("employees")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (!adminEmployee || adminEmployee.role !== "admin") {
      return NextResponse.json(
        { error: "Only admins can send notifications" },
        { status: 403 },
      );
    }

    const body = await request.json();
    const { title, message, target, employee_id, data: extraData } = body;

    if (!title || !message || !target) {
      return NextResponse.json(
        { error: "title, message, dan target wajib diisi" },
        { status: 400 },
      );
    }

    if (!["all", "employee"].includes(target)) {
      return NextResponse.json(
        { error: "target harus 'all' atau 'employee'" },
        { status: 400 },
      );
    }

    const adminSupabase = createAdminClient();
    const notification = {
      title,
      body: message,
      data: extraData || {},
    };

    // Kirim ke satu karyawan
    if (target === "employee") {
      if (!employee_id) {
        return NextResponse.json(
          { error: "employee_id wajib diisi jika target = 'employee'" },
          { status: 400 },
        );
      }

      const { data: employee } = await adminSupabase
        .from("employees")
        .select("id, name, fcm_token")
        .eq("id", employee_id)
        .single();

      if (!employee) {
        return NextResponse.json(
          { error: "Employee not found" },
          { status: 404 },
        );
      }

      if (!employee.fcm_token) {
        return NextResponse.json(
          {
            error: "Karyawan tidak memiliki FCM token (belum login di mobile)",
          },
          { status: 400 },
        );
      }

      const result = await sendToDevice(employee.fcm_token, notification);

      if (result.tokenInvalid) {
        await cleanupInvalidTokens([employee.fcm_token]);
      }

      return NextResponse.json({
        success: result.success,
        message: result.success
          ? `Notifikasi berhasil dikirim ke ${employee.name}`
          : `Gagal kirim ke ${employee.name}: ${result.error}`,
        sent: result.success ? 1 : 0,
      });
    }

    // Kirim ke semua karyawan aktif
    const { data: allEmployees } = await adminSupabase
      .from("employees")
      .select("fcm_token")
      .eq("is_active", true)
      .eq("role", "employee")
      .not("fcm_token", "is", null);

    if (!allEmployees || allEmployees.length === 0) {
      return NextResponse.json({
        success: true,
        message: "Tidak ada karyawan dengan FCM token",
        sent: 0,
      });
    }

    const tokens = allEmployees
      .map((e) => e.fcm_token)
      .filter(Boolean) as string[];

    const result = await sendToMultipleDevices(tokens, notification);

    if (result.invalidTokens.length > 0) {
      await cleanupInvalidTokens(result.invalidTokens);
    }

    return NextResponse.json({
      success: true,
      message: `Notifikasi terkirim ke ${result.successCount} dari ${tokens.length} karyawan`,
      sent: result.successCount,
      failed: result.failureCount,
      invalid_tokens_cleaned: result.invalidTokens.length,
    });
  } catch (error) {
    console.error("Send notification error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
