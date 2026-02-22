import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import {
  getTodayWIB,
  getNowWIB,
  parseWorkTime,
  calculateDistance,
  verifyFace,
  uploadAttendancePhoto,
} from "@/lib/attendance";

interface CheckInRequest {
  employee_id: string;
  latitude: number;
  longitude: number;
  photo_base64: string;
}

// ✅ Batas ukuran foto base64: ~5MB
const MAX_PHOTO_BASE64_LENGTH = 7 * 1024 * 1024; // 7MB string ≈ ~5MB file

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body: CheckInRequest = await request.json();
    const { employee_id, latitude, longitude, photo_base64 } = body;

    // Validasi field wajib
    if (!employee_id || !latitude || !longitude || !photo_base64) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    // ✅ FIX: Validasi ukuran foto
    if (photo_base64.length > MAX_PHOTO_BASE64_LENGTH) {
      return NextResponse.json(
        { error: "Ukuran foto terlalu besar. Maksimal 5MB." },
        { status: 400 },
      );
    }

    // Validasi format base64
    if (!photo_base64.startsWith("data:image/")) {
      return NextResponse.json(
        { error: "Format foto tidak valid" },
        { status: 400 },
      );
    }

    // Validasi koordinat
    if (
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      return NextResponse.json(
        { error: "Koordinat GPS tidak valid" },
        { status: 400 },
      );
    }

    // Ambil data karyawan
    const { data: employee, error: empError } = await supabase
      .from("employees")
      .select("*")
      .eq("id", employee_id)
      .single();

    if (empError || !employee) {
      return NextResponse.json(
        { error: "Employee not found" },
        { status: 404 },
      );
    }

    if (!employee.is_active) {
      return NextResponse.json(
        { error: "Akun Anda sudah dinonaktifkan" },
        { status: 403 },
      );
    }

    if (!employee.face_token) {
      return NextResponse.json(
        {
          error:
            "Wajah belum terdaftar. Silakan daftarkan wajah terlebih dahulu.",
        },
        { status: 400 },
      );
    }

    // Ambil pengaturan kantor
    const { data: settings, error: settingsError } = await supabase
      .from("office_settings")
      .select("*")
      .single();

    if (settingsError || !settings) {
      return NextResponse.json(
        { error: "Pengaturan kantor belum dikonfigurasi" },
        { status: 500 },
      );
    }

    // ✅ FIX: Cek sudah check-in hari ini menggunakan WIB
    const today = getTodayWIB();
    const { data: existingAttendance } = await supabase
      .from("attendances")
      .select("*")
      .eq("employee_id", employee_id)
      .eq("attendance_date", today)
      .single();

    if (existingAttendance?.check_in_time) {
      return NextResponse.json(
        { error: "Anda sudah melakukan check-in hari ini" },
        { status: 400 },
      );
    }

    // Validasi lokasi GPS
    const distance = calculateDistance(
      latitude,
      longitude,
      settings.latitude,
      settings.longitude,
    );
    const locationVerified = distance <= settings.radius_meters;

    // Verifikasi wajah
    const faceVerified = await verifyFace(
      photo_base64,
      employee.face_token,
      settings.face_similarity_threshold,
    );

    if (!faceVerified.success) {
      return NextResponse.json(
        { error: faceVerified.message || "Verifikasi wajah gagal" },
        { status: 400 },
      );
    }

    // Upload foto
    const photoUrl = await uploadAttendancePhoto(
      supabase,
      photo_base64,
      employee_id,
      "check_in",
    );

    // Hitung keterlambatan (WIB)
    const now = getNowWIB();
    const expectedCheckIn = parseWorkTime(settings.default_check_in);
    expectedCheckIn.setMinutes(
      expectedCheckIn.getMinutes() + settings.late_tolerance_minutes,
    );

    let lateMinutes = 0;
    let status: "present" | "late" = "present";

    if (now > expectedCheckIn) {
      lateMinutes = Math.floor(
        (now.getTime() - expectedCheckIn.getTime()) / 60000,
      );
      status = "late";
    }

    // Buat atau update record absensi
    const attendanceData = {
      employee_id,
      attendance_date: today,
      check_in_time: new Date().toISOString(),
      check_in_latitude: latitude,
      check_in_longitude: longitude,
      check_in_photo_url: photoUrl,
      check_in_face_verified: faceVerified.verified,
      check_in_location_verified: locationVerified,
      late_minutes: lateMinutes,
      status,
    };

    let attendance;
    if (existingAttendance) {
      const { data, error } = await supabase
        .from("attendances")
        .update(attendanceData)
        .eq("id", existingAttendance.id)
        .select()
        .single();
      if (error) throw error;
      attendance = data;
    } else {
      const { data, error } = await supabase
        .from("attendances")
        .insert(attendanceData)
        .select()
        .single();
      if (error) throw error;
      attendance = data;
    }

    return NextResponse.json({
      success: true,
      data: attendance,
      message:
        status === "late"
          ? `Check-in berhasil. Anda terlambat ${lateMinutes} menit.`
          : "Check-in berhasil. Selamat bekerja!",
      warnings: {
        face_verified: faceVerified.verified,
        location_verified: locationVerified,
        distance_meters: Math.round(distance),
      },
    });
  } catch (error) {
    console.error("Check-in error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
