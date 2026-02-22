import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Hapus FCM token yang tidak valid dari database
 * Dipanggil setelah batch send gagal dengan tokenInvalid = true
 */
export async function cleanupInvalidTokens(invalidTokens: string[]) {
  if (invalidTokens.length === 0) return;

  try {
    const adminSupabase = createAdminClient();

    const { error } = await adminSupabase
      .from("employees")
      .update({ fcm_token: null })
      .in("fcm_token", invalidTokens);

    if (error) {
      console.error("Failed to cleanup invalid FCM tokens:", error);
    } else {
      console.log(`Cleaned up ${invalidTokens.length} invalid FCM tokens`);
    }
  } catch (err) {
    console.error("cleanupInvalidTokens error:", err);
  }
}
