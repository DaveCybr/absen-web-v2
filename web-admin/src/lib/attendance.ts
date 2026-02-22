import { createClient } from "@/lib/supabase/server";

// =====================================================
// TIMEZONE UTILITY
// =====================================================

const TIMEZONE = "Asia/Jakarta"; // WIB (UTC+7)

/**
 * Mendapatkan tanggal hari ini dalam format YYYY-MM-DD (timezone WIB)
 */
export function getTodayWIB(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/**
 * Mendapatkan waktu sekarang dalam WIB
 * ✅ FIX [H4]: Gunakan Intl.DateTimeFormat bukan toLocaleString
 * toLocaleString tidak konsisten antar OS/Node version
 */
export function getNowWIB(): Date {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(new Date());
  const get = (type: string) =>
    parseInt(parts.find((p) => p.type === type)?.value || "0");

  return new Date(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );
}

/**
 * Parse jam kerja dari string "HH:MM:SS" menjadi Date hari ini (WIB)
 */
export function parseWorkTime(timeStr: string): Date {
  const now = getNowWIB();
  const [hours, minutes] = timeStr.split(":").map(Number);
  const result = new Date(now);
  result.setHours(hours, minutes, 0, 0);
  return result;
}

// =====================================================
// GPS UTILITY
// =====================================================

/**
 * Menghitung jarak antara dua koordinat GPS menggunakan Haversine formula
 * @returns Jarak dalam meter
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

// =====================================================
// FACE++ UTILITY
// =====================================================

interface FaceVerifyResult {
  success: boolean;
  verified: boolean;
  confidence?: number;
  message?: string;
}

/**
 * ✅ FIX [C1]: Verifikasi wajah menggunakan Face++ API
 *
 * SEBELUMNYA (BUG):
 * Menggunakan face_token yang disimpan di DB untuk compare.
 * Face++ face_token EXPIRE SETELAH 24 JAM → check-in selalu gagal keesokan harinya.
 *
 * SESUDAH (FIX):
 * Menggunakan image_base64_1 (fetch dari storage) vs image_base64_2 (foto baru).
 * Tidak ada expiry karena tidak menggunakan token sementara.
 *
 * @param photoBase64  - Foto baru dari mobile (base64)
 * @param faceImageUrl - URL foto referensi wajah di Supabase Storage
 * @param threshold    - Minimum confidence (0-1)
 */
export async function verifyFace(
  photoBase64: string,
  faceImageUrl: string,
  threshold: number,
): Promise<FaceVerifyResult> {
  try {
    const apiKey = process.env.FACEPP_API_KEY;
    const apiSecret = process.env.FACEPP_API_SECRET;

    if (!apiKey || !apiSecret) {
      return {
        success: false,
        verified: false,
        message: "Face verification service unavailable",
      };
    }

    if (!faceImageUrl) {
      return {
        success: false,
        verified: false,
        message: "Foto wajah referensi tidak ditemukan. Silakan enroll ulang.",
      };
    }

    // Fetch foto referensi dari Supabase Storage sebagai base64
    const referenceBase64 = await fetchImageAsBase64(faceImageUrl);
    if (!referenceBase64) {
      return {
        success: false,
        verified: false,
        message: "Gagal memuat foto referensi. Silakan enroll ulang.",
      };
    }

    const formData = new FormData();
    formData.append("api_key", apiKey);
    formData.append("api_secret", apiSecret);
    // Gunakan dua gambar base64, bukan face_token
    formData.append("image_base64_1", referenceBase64);
    formData.append(
      "image_base64_2",
      photoBase64.replace(/^data:image\/\w+;base64,/, ""),
    );

    const response = await fetch(
      "https://api-us.faceplusplus.com/facepp/v3/compare",
      {
        method: "POST",
        body: formData,
      },
    );

    if (!response.ok) {
      console.error(`Face++ API HTTP error: ${response.status}`);
      return {
        success: false,
        verified: false,
        message: "Face verification service unavailable",
      };
    }

    const result = await response.json();

    if (result.error_message) {
      // Bedakan error "no face" vs error lainnya
      if (
        result.error_message.includes("NO_FACE") ||
        result.error_message.includes("EMPTY_IMAGE")
      ) {
        return {
          success: false,
          verified: false,
          message:
            "Wajah tidak terdeteksi dalam foto. Pastikan wajah terlihat jelas.",
        };
      }
      return {
        success: false,
        verified: false,
        message: "Face verification service unavailable",
      };
    }

    // Face++ mengembalikan confidence 0-100, konversi ke 0-1
    const confidence = result.confidence / 100;
    const verified = confidence >= threshold;

    return {
      success: true,
      verified,
      confidence,
      message: verified
        ? "Wajah terverifikasi"
        : "Wajah tidak cocok. Pastikan pencahayaan cukup dan wajah terlihat jelas.",
    };
  } catch (error) {
    console.error("Face++ API error:", error);
    return {
      success: false,
      verified: false,
      message: "Face verification service unavailable",
    };
  }
}

/**
 * Fetch gambar dari URL dan konversi ke base64 string (tanpa prefix data:)
 */
async function fetchImageAsBase64(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`Failed to fetch reference image: ${response.status}`);
      return null;
    }
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    return buffer.toString("base64");
  } catch (error) {
    console.error("fetchImageAsBase64 error:", error);
    return null;
  }
}

interface FaceDetectResult {
  success: boolean;
  face_token?: string;
  face_quality?: number;
  message?: string;
}

/**
 * Deteksi wajah menggunakan Face++ API (untuk enroll)
 * face_token hanya digunakan sementara saat enroll — tidak disimpan ke DB lagi
 */
export async function detectFace(
  photoBase64: string,
): Promise<FaceDetectResult> {
  try {
    const apiKey = process.env.FACEPP_API_KEY;
    const apiSecret = process.env.FACEPP_API_SECRET;

    if (!apiKey || !apiSecret) {
      return { success: false, message: "Face detection service unavailable" };
    }

    const formData = new FormData();
    formData.append("api_key", apiKey);
    formData.append("api_secret", apiSecret);
    formData.append(
      "image_base64",
      photoBase64.replace(/^data:image\/\w+;base64,/, ""),
    );
    formData.append("return_attributes", "facequality");

    const response = await fetch(
      "https://api-us.faceplusplus.com/facepp/v3/detect",
      {
        method: "POST",
        body: formData,
      },
    );

    if (!response.ok) {
      return { success: false, message: "Face detection service unavailable" };
    }

    const result = await response.json();

    if (result.error_message) {
      return { success: false, message: result.error_message };
    }

    if (!result.faces || result.faces.length === 0) {
      return {
        success: false,
        message: "Tidak ada wajah terdeteksi. Coba foto ulang.",
      };
    }

    if (result.faces.length > 1) {
      return {
        success: false,
        message:
          "Terdeteksi lebih dari satu wajah. Pastikan hanya ada satu wajah.",
      };
    }

    const face = result.faces[0];
    const faceQuality = face.attributes?.facequality?.value || 0;

    if (faceQuality < 50) {
      return {
        success: false,
        message:
          "Kualitas foto kurang baik. Coba dengan pencahayaan lebih baik.",
      };
    }

    return {
      success: true,
      face_token: face.face_token, // hanya untuk validasi saat enroll, tidak disimpan
      face_quality: faceQuality,
    };
  } catch (error) {
    console.error("Face++ detect error:", error);
    return { success: false, message: "Face detection service unavailable" };
  }
}

// =====================================================
// PHOTO UPLOAD UTILITY
// =====================================================

export async function uploadAttendancePhoto(
  supabase: Awaited<ReturnType<typeof createClient>>,
  base64: string,
  employeeId: string,
  type: "check_in" | "check_out",
): Promise<string | null> {
  try {
    const base64Data = base64.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");
    const fileName = `${employeeId}/${type}_${Date.now()}.jpg`;

    const { error } = await supabase.storage
      .from("attendance-photos")
      .upload(fileName, buffer, {
        contentType: "image/jpeg",
        upsert: false,
      });

    if (error) {
      console.error("Upload attendance photo error:", error);
      return null;
    }

    const { data: urlData } = supabase.storage
      .from("attendance-photos")
      .getPublicUrl(fileName);

    return urlData.publicUrl;
  } catch (error) {
    console.error("uploadAttendancePhoto error:", error);
    return null;
  }
}

export async function uploadFacePhoto(
  supabase: Awaited<ReturnType<typeof createClient>>,
  base64: string,
  employeeId: string,
): Promise<string | null> {
  try {
    const base64Data = base64.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");
    const fileName = `faces/${employeeId}_${Date.now()}.jpg`;

    const { error } = await supabase.storage
      .from("employee-faces")
      .upload(fileName, buffer, {
        contentType: "image/jpeg",
        upsert: true,
      });

    if (error) {
      console.error("Upload face photo error:", error);
      return null;
    }

    const { data: urlData } = supabase.storage
      .from("employee-faces")
      .getPublicUrl(fileName);

    return urlData.publicUrl;
  } catch (error) {
    console.error("uploadFacePhoto error:", error);
    return null;
  }
}
