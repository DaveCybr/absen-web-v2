import { messaging, isFirebaseReady } from "@/lib/firebase-admin";

// =====================================================
// TYPES
// =====================================================

export interface NotificationPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
  imageUrl?: string;
}

export interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  /** Token tidak valid — hapus dari database */
  tokenInvalid?: boolean;
}

export interface SendMultipleResult {
  successCount: number;
  failureCount: number;
  results: Array<{ token: string; result: SendResult }>;
  /** Daftar token yang tidak valid dan perlu dihapus dari DB */
  invalidTokens: string[];
}

// =====================================================
// CORE SEND FUNCTIONS
// =====================================================

/**
 * Kirim notifikasi ke satu device via FCM token
 */
export async function sendToDevice(
  fcmToken: string,
  notification: NotificationPayload,
): Promise<SendResult> {
  if (!isFirebaseReady()) {
    console.warn("Firebase tidak ready, notifikasi dilewati");
    return { success: false, error: "Firebase not initialized" };
  }

  try {
    const message: admin.messaging.Message = {
      token: fcmToken,
      notification: {
        title: notification.title,
        body: notification.body,
        ...(notification.imageUrl && { imageUrl: notification.imageUrl }),
      },
      data: notification.data || {},
      android: {
        priority: "high",
        notification: {
          channelId: "absensi_default",
          priority: "high",
          defaultSound: true,
          defaultVibrateTimings: true,
        },
      },
      apns: {
        payload: {
          aps: {
            sound: "default",
            badge: 1,
          },
        },
      },
    };

    const messageId = await messaging().send(message);
    return { success: true, messageId };
  } catch (error: unknown) {
    const errorCode = (error as { code?: string })?.code || "";
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    // Token tidak valid / sudah expired
    const isInvalidToken =
      errorCode === "messaging/registration-token-not-registered" ||
      errorCode === "messaging/invalid-registration-token" ||
      errorCode === "messaging/invalid-argument";

    console.error(
      `FCM send error [${fcmToken.substring(0, 20)}...]:`,
      errorMessage,
    );

    return {
      success: false,
      error: errorMessage,
      tokenInvalid: isInvalidToken,
    };
  }
}

/**
 * Kirim notifikasi ke banyak device sekaligus (batch)
 * Otomatis return daftar token yang tidak valid
 */
export async function sendToMultipleDevices(
  fcmTokens: string[],
  notification: NotificationPayload,
): Promise<SendMultipleResult> {
  if (!isFirebaseReady()) {
    return {
      successCount: 0,
      failureCount: fcmTokens.length,
      results: fcmTokens.map((token) => ({
        token,
        result: { success: false, error: "Firebase not initialized" },
      })),
      invalidTokens: [],
    };
  }

  // Filter token kosong
  const validTokens = fcmTokens.filter((t) => t && t.trim().length > 0);

  if (validTokens.length === 0) {
    return {
      successCount: 0,
      failureCount: 0,
      results: [],
      invalidTokens: [],
    };
  }

  // Kirim paralel (max 500 per batch sesuai limit FCM)
  const BATCH_SIZE = 500;
  const allResults: Array<{ token: string; result: SendResult }> = [];

  for (let i = 0; i < validTokens.length; i += BATCH_SIZE) {
    const batch = validTokens.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(async (token) => ({
        token,
        result: await sendToDevice(token, notification),
      })),
    );
    allResults.push(...batchResults);
  }

  const successCount = allResults.filter((r) => r.result.success).length;
  const failureCount = allResults.filter((r) => !r.result.success).length;
  const invalidTokens = allResults
    .filter((r) => r.result.tokenInvalid)
    .map((r) => r.token);

  return {
    successCount,
    failureCount,
    results: allResults,
    invalidTokens,
  };
}

// =====================================================
// NOTIFICATION TEMPLATES
// =====================================================

/**
 * Notifikasi: Cuti disetujui
 */
export function buildLeaveApprovedNotification(params: {
  employeeName: string;
  leaveTypeName: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  leaveRequestId: string;
}): NotificationPayload {
  const dateRange =
    params.startDate === params.endDate
      ? params.startDate
      : `${params.startDate} - ${params.endDate}`;

  return {
    title: "✅ Pengajuan Cuti Disetujui",
    body: `Cuti ${params.leaveTypeName} kamu (${dateRange}, ${params.totalDays} hari) telah disetujui.`,
    data: {
      type: "LEAVE_APPROVED",
      leave_request_id: params.leaveRequestId,
      screen: "leave_detail",
    },
  };
}

/**
 * Notifikasi: Cuti ditolak
 */
export function buildLeaveRejectedNotification(params: {
  leaveTypeName: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  rejectionReason?: string;
  leaveRequestId: string;
}): NotificationPayload {
  const dateRange =
    params.startDate === params.endDate
      ? params.startDate
      : `${params.startDate} - ${params.endDate}`;

  return {
    title: "❌ Pengajuan Cuti Ditolak",
    body: params.rejectionReason
      ? `Cuti ${params.leaveTypeName} (${dateRange}) ditolak. Alasan: ${params.rejectionReason}`
      : `Cuti ${params.leaveTypeName} (${dateRange}) ditolak oleh admin.`,
    data: {
      type: "LEAVE_REJECTED",
      leave_request_id: params.leaveRequestId,
      screen: "leave_detail",
    },
  };
}

/**
 * Notifikasi: Ada pengajuan cuti baru (ke admin)
 */
export function buildNewLeaveRequestNotification(params: {
  employeeName: string;
  leaveTypeName: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  leaveRequestId: string;
}): NotificationPayload {
  const dateRange =
    params.startDate === params.endDate
      ? params.startDate
      : `${params.startDate} - ${params.endDate}`;

  return {
    title: "📋 Pengajuan Cuti Baru",
    body: `${params.employeeName} mengajukan ${params.leaveTypeName} (${dateRange}, ${params.totalDays} hari). Silakan review.`,
    data: {
      type: "NEW_LEAVE_REQUEST",
      leave_request_id: params.leaveRequestId,
      screen: "leave_approval",
    },
  };
}

/**
 * Notifikasi: Reminder check-in (belum absen)
 */
export function buildCheckInReminderNotification(): NotificationPayload {
  return {
    title: "⏰ Jangan Lupa Absen!",
    body: "Kamu belum melakukan check-in hari ini. Segera absen sebelum terlambat.",
    data: {
      type: "CHECKIN_REMINDER",
      screen: "attendance",
    },
  };
}

/**
 * Notifikasi: Reminder check-out (belum pulang)
 */
export function buildCheckOutReminderNotification(): NotificationPayload {
  return {
    title: "🏃 Jangan Lupa Check-Out!",
    body: "Kamu belum melakukan check-out hari ini. Segera absen pulang.",
    data: {
      type: "CHECKOUT_REMINDER",
      screen: "attendance",
    },
  };
}

// Import admin untuk tipe Message
import { admin } from "@/lib/firebase-admin";
