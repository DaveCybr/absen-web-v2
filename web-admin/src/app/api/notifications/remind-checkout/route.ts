import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";
import { getTodayWIB } from "@/lib/attendance";
import {
  sendToMultipleDevices,
  buildCheckOutReminderNotification,
} from "@/lib/fcm";
import { cleanupInvalidTokens } from "@/lib/fcm-cleanup";

/**
 * POST /api/notifications/remind-checkout
 *
 * Kirim reminder check-out ke karyawan yang sudah check-in
 * tapi belum check-out hari ini.
 *
 * Setup cron di VPS (crontab):
 * 0 17 * * 1-5 curl -X POST https://yourdomain.com/api/notifications/remind-checkout \
 *   -H "Authorization: Bearer YOUR_CRON_SECRET"
 */
export async function POST(request: NextRequest) {
  // Verifikasi cron secret
  const authHeader = request.headers.get("Authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return NextResponse.json({ error: "Cron not configured" }, { status: 500 });
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const adminSupabase = createAdminClient();
    const today = getTodayWIB();

    // Ambil karyawan yang sudah check-in tapi belum check-out hari ini
    const { data: notCheckedOut, error } = await adminSupabase
      .from("attendances")
      .select(
        `
        employee_id,
        employee:employees!attendances_employee_id_fkey(id, fcm_token)
      `,
      )
      .eq("attendance_date", today)
      .not("check_in_time", "is", null)
      .is("check_out_time", null);

    if (error) throw error;

    if (!notCheckedOut || notCheckedOut.length === 0) {
      return NextResponse.json({
        success: true,
        message: "Semua karyawan sudah check-out",
        sent: 0,
      });
    }

    // Ambil FCM token dari karyawan yang belum check-out
    const tokens = notCheckedOut
      .map((a) => (a.employee as { fcm_token?: string })?.fcm_token)
      .filter(Boolean) as string[];

    if (tokens.length === 0) {
      return NextResponse.json({
        success: true,
        message: "Tidak ada FCM token untuk dikirim",
        sent: 0,
      });
    }

    const notification = buildCheckOutReminderNotification();
    const result = await sendToMultipleDevices(tokens, notification);

    // Cleanup invalid tokens
    if (result.invalidTokens.length > 0) {
      await cleanupInvalidTokens(result.invalidTokens);
    }

    console.log(
      `Check-out reminder: sent=${result.successCount}, failed=${result.failureCount}`,
    );

    return NextResponse.json({
      success: true,
      message: `Reminder terkirim ke ${result.successCount} karyawan`,
      total_not_checked_out: notCheckedOut.length,
      sent: result.successCount,
      failed: result.failureCount,
      invalid_tokens_cleaned: result.invalidTokens.length,
    });
  } catch (error) {
    console.error("Check-out reminder error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
