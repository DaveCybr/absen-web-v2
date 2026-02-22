import * as admin from "firebase-admin";
import * as fs from "fs";
import * as path from "path";

/**
 * Inisialisasi Firebase Admin SDK
 * Membaca service account dari path file (cocok untuk VPS)
 * Path dikonfigurasi via FIREBASE_SERVICE_ACCOUNT_PATH di .env.local
 */
function initializeFirebaseAdmin() {
  // Cegah inisialisasi ulang (Next.js hot reload)
  if (admin.apps.length > 0) {
    return admin.apps[0]!;
  }

  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

  if (!serviceAccountPath) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_PATH belum dikonfigurasi di .env.local\n" +
        "Contoh: FIREBASE_SERVICE_ACCOUNT_PATH=/etc/secrets/firebase-service-account.json",
    );
  }

  // Resolve path (support relative & absolute)
  const resolvedPath = path.isAbsolute(serviceAccountPath)
    ? serviceAccountPath
    : path.resolve(process.cwd(), serviceAccountPath);

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(
      `Firebase service account file tidak ditemukan: ${resolvedPath}\n` +
        "Pastikan file sudah diupload ke VPS dan path di .env.local sudah benar.",
    );
  }

  const serviceAccount = JSON.parse(fs.readFileSync(resolvedPath, "utf8"));

  return admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

// Inisialisasi saat module pertama kali di-import
try {
  initializeFirebaseAdmin();
} catch (error) {
  console.error("❌ Firebase Admin init error:", error);
  // Tidak throw supaya server tetap bisa jalan
  // Fitur notifikasi akan disabled, endpoint lain tetap berfungsi
}

/**
 * Cek apakah Firebase Admin sudah ter-inisialisasi dengan benar
 */
export function isFirebaseReady(): boolean {
  return admin.apps.length > 0;
}

export { admin };
export const messaging = () => admin.messaging();
