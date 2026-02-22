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
  latitude: number;
  longitude: number;
  photo_base64: string;
}

const MAX_PHOTO_BASE64_LENGTH = 7 * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // ✅ FIX [C3]: Ambil user dari session, bukan dari request body
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Ambil employee dari user yang sedang login
    const { data: employee, error: empError } = await supabase
      .from("employees")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (empError || !employee) {
      return NextResponse.json(
        { error: "Data karyawan tidak ditemukan" },
        { status: 404 },
      );
    }

    // ✅ FIX [C1]: Cek face_image_url bukan face_token
    if (!employee.face_image_url) {
      return NextResponse.json(
        {
          error:
            "Wajah belum terdaftar. Silakan daftarkan wajah terlebih dahulu.",
        },
        { status: 400 },
      );
    }

    const body: CheckOutRequest = await request.json();
    const { latitude, longitude, photo_base64 } = body;

    if (!latitude || !longitude || !photo_base64) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    if (photo_base64.length > MAX_PHOTO_BASE64_LENGTH) {
      return NextResponse.json(
        { error: "Ukuran foto terlalu besar. Maksimal 5MB." },
        { status: 400 },
      );
    }

    if (!photo_base64.startsWith("data:image/")) {
      return NextResponse.json(
        { error: "Format foto tidak valid" },
        { status: 400 },
      );
    }

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

    // Cek kehadiran hari ini (WIB)
    const today = getTodayWIB();
    const { data: attendance, error: attError } = await supabase
      .from("attendances")
      .select("*")
      .eq("employee_id", employee.id)
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

    // ✅ FIX [C1]: Gunakan face_image_url bukan face_token
    const faceVerified = await verifyFace(
      photo_base64,
      employee.face_image_url,
      settings.face_similarity_threshold,
    );

    if (!faceVerified.success) {
      const isServiceDown =
        faceVerified.message?.includes("unavailable") ||
        faceVerified.message?.includes("API error");
      return NextResponse.json(
        { error: faceVerified.message || "Verifikasi wajah gagal" },
        { status: isServiceDown ? 503 : 400 },
      );
    }

    // Upload foto
    const photoUrl = await uploadAttendancePhoto(
      supabase,
      photo_base64,
      employee.id,
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

    // Hitung durasi kerja
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
