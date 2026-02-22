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

interface CheckOutRequest {
  employee_id: string;
  latitude: number;
  longitude: number;
  photo_base64: string;
}

// ✅ Batas ukuran foto base64: ~5MB
const MAX_PHOTO_BASE64_LENGTH = 7 * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body: CheckOutRequest = await request.json();
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

    // ✅ FIX: Cek kehadiran hari ini menggunakan WIB
    const today = getTodayWIB();
    const { data: attendance, error: attError } = await supabase
      .from("attendances")
      .select("*")
      .eq("employee_id", employee_id)
      .eq("attendance_date", today)
      .single();

    if (attError || !attendance) {
      return NextResponse.json(
        { error: "Anda belum melakukan check-in hari ini" },
        { status: 400 },
      );
    }

    if (attendance.check_out_time) {
      return NextResponse.json(
        { error: "Anda sudah melakukan check-out hari ini" },
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
      "check_out",
    );

    // Hitung pulang lebih awal (WIB)
    const now = getNowWIB();
    const expectedCheckOut = parseWorkTime(settings.default_check_out);

    let earlyLeaveMinutes = 0;
    if (now < expectedCheckOut) {
      earlyLeaveMinutes = Math.floor(
        (expectedCheckOut.getTime() - now.getTime()) / 60000,
      );
    }

    // Update record absensi
    const { data: updatedAttendance, error: updateError } = await supabase
      .from("attendances")
      .update({
        check_out_time: new Date().toISOString(),
        check_out_latitude: latitude,
        check_out_longitude: longitude,
        check_out_photo_url: photoUrl,
        check_out_face_verified: faceVerified.verified,
        check_out_location_verified: locationVerified,
        early_leave_minutes: earlyLeaveMinutes,
      })
      .eq("id", attendance.id)
      .select()
      .single();

    if (updateError) throw updateError;

    // Hitung durasi kerja untuk response
    const checkInTime = new Date(attendance.check_in_time);
    const workDurationMinutes = Math.floor(
      (now.getTime() - checkInTime.getTime()) / 60000,
    );
    const hoursWorked = Math.floor(workDurationMinutes / 60);
    const minutesWorked = workDurationMinutes % 60;

    return NextResponse.json({
      success: true,
      data: updatedAttendance,
      message: "Check-out berhasil. Selamat beristirahat!",
      summary: {
        work_duration: `${hoursWorked} jam ${minutesWorked} menit`,
        work_duration_minutes: workDurationMinutes,
        early_leave_minutes: earlyLeaveMinutes,
      },
      warnings: {
        face_verified: faceVerified.verified,
        location_verified: locationVerified,
        distance_meters: Math.round(distance),
      },
    });
  } catch (error) {
    console.error("Check-out error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
