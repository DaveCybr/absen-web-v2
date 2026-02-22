import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";
import { getTodayWIB } from "@/lib/attendance";
import {
  sendToMultipleDevices,
  buildCheckInReminderNotification,
} from "@/lib/fcm";
import { cleanupInvalidTokens } from "@/lib/fcm-cleanup";

/**
 * POST /api/notifications/remind-checkin
 *
 * Kirim reminder check-in ke karyawan yang belum absen hari ini.
 * Endpoint ini dipanggil oleh cron job (misal jam 09:00 WIB).
 *
 * Security: dilindungi CRON_SECRET di header Authorization
 *
 * Setup cron di VPS (crontab):
 * 0 9 * * 1-5 curl -X POST https://yourdomain.com/api/notifications/remind-checkin \
 *   -H "Authorization: Bearer YOUR_CRON_SECRET"
 */
export async function POST(request: NextRequest) {
  // Verifikasi cron secret
  const authHeader = request.headers.get("Authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error("CRON_SECRET belum dikonfigurasi di .env.local");
    return NextResponse.json({ error: "Cron not configured" }, { status: 500 });
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const adminSupabase = createAdminClient();
    const today = getTodayWIB();

    // Ambil semua karyawan aktif yang punya fcm_token
    const { data: allEmployees, error: empError } = await adminSupabase
      .from("employees")
      .select("id, name, fcm_token")
      .eq("is_active", true)
      .eq("role", "employee")
      .not("fcm_token", "is", null);

    if (empError) throw empError;
    if (!allEmployees || allEmployees.length === 0) {
      return NextResponse.json({
        success: true,
        message: "Tidak ada karyawan dengan FCM token",
        sent: 0,
      });
    }

    // Ambil karyawan yang sudah check-in hari ini
    const { data: checkedIn } = await adminSupabase
      .from("attendances")
      .select("employee_id")
      .eq("attendance_date", today)
      .not("check_in_time", "is", null);

    const checkedInIds = new Set(checkedIn?.map((a) => a.employee_id) || []);

    // Filter karyawan yang BELUM check-in
    const notCheckedIn = allEmployees.filter(
      (emp) => !checkedInIds.has(emp.id),
    );

    if (notCheckedIn.length === 0) {
      return NextResponse.json({
        success: true,
        message: "Semua karyawan sudah check-in",
        sent: 0,
      });
    }

    const tokens = notCheckedIn
      .map((e) => e.fcm_token)
      .filter(Boolean) as string[];

    const notification = buildCheckInReminderNotification();
    const result = await sendToMultipleDevices(tokens, notification);

    // Cleanup invalid tokens
    if (result.invalidTokens.length > 0) {
      await cleanupInvalidTokens(result.invalidTokens);
    }

    console.log(
      `Check-in reminder: sent=${result.successCount}, failed=${result.failureCount}, invalid=${result.invalidTokens.length}`,
    );

    return NextResponse.json({
      success: true,
      message: `Reminder terkirim ke ${result.successCount} karyawan`,
      total_not_checked_in: notCheckedIn.length,
      sent: result.successCount,
      failed: result.failureCount,
      invalid_tokens_cleaned: result.invalidTokens.length,
    });
  } catch (error) {
    console.error("Check-in reminder error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
