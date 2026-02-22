import { createClient } from "@/lib/supabase/server";

// =====================================================
// TIMEZONE UTILITY
// =====================================================

const TIMEZONE = "Asia/Jakarta"; // WIB (UTC+7)

/**
 * Mendapatkan tanggal hari ini dalam format YYYY-MM-DD (timezone WIB)
 */
export function getTodayWIB(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: TIMEZONE });
}

/**
 * Mendapatkan waktu sekarang dalam WIB
 */
export function getNowWIB(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: TIMEZONE }));
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
  const R = 6371e3; // Radius bumi dalam meter
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
 * Verifikasi wajah menggunakan Face++ API
 */
export async function verifyFace(
  photoBase64: string,
  faceToken: string,
  threshold: number,
): Promise<FaceVerifyResult> {
  try {
    const apiKey = process.env.FACEPP_API_KEY;
    const apiSecret = process.env.FACEPP_API_SECRET;

    if (!apiKey || !apiSecret) {
      throw new Error("Face++ API credentials not configured");
    }

    const formData = new FormData();
    formData.append("api_key", apiKey);
    formData.append("api_secret", apiSecret);
    formData.append("face_token1", faceToken);
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
      throw new Error(`Face++ API error: ${response.status}`);
    }

    const result = await response.json();

    if (result.error_message) {
      return { success: false, verified: false, message: result.error_message };
    }

    // Face++ mengembalikan confidence dalam skala 0-100
    const confidence = result.confidence / 100;
    const verified = confidence >= threshold;

    return {
      success: true,
      verified,
      confidence,
      message: verified ? "Face verified" : "Face does not match",
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

interface FaceDetectResult {
  success: boolean;
  face_token?: string;
  face_quality?: number;
  message?: string;
}

/**
 * Deteksi wajah menggunakan Face++ API
 */
export async function detectFace(
  photoBase64: string,
): Promise<FaceDetectResult> {
  try {
    const apiKey = process.env.FACEPP_API_KEY;
    const apiSecret = process.env.FACEPP_API_SECRET;

    if (!apiKey || !apiSecret) {
      throw new Error("Face++ API credentials not configured");
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
      throw new Error(`Face++ API error: ${response.status}`);
    }

    const result = await response.json();

    if (result.error_message) {
      return { success: false, message: result.error_message };
    }

    if (!result.faces || result.faces.length === 0) {
      return { success: false, message: "Tidak ada wajah terdeteksi" };
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
      face_token: face.face_token,
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

/**
 * Upload foto absensi ke Supabase Storage
 */
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
      console.error("Upload error:", error);
      return null;
    }

    const { data: urlData } = supabase.storage
      .from("attendance-photos")
      .getPublicUrl(fileName);

    return urlData.publicUrl;
  } catch (error) {
    console.error("Upload photo error:", error);
    return null;
  }
}

/**
 * Upload foto wajah ke Supabase Storage
 */
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
      console.error("Upload error:", error);
      return null;
    }

    const { data: urlData } = supabase.storage
      .from("employee-faces")
      .getPublicUrl(fileName);

    return urlData.publicUrl;
  } catch (error) {
    console.error("Upload face photo error:", error);
    return null;
  }
}
