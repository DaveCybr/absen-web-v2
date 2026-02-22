import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

interface CheckOutRequest {
  employee_id: string;
  latitude: number;
  longitude: number;
  photo_base64: string;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body: CheckOutRequest = await request.json();

    const { employee_id, latitude, longitude, photo_base64 } = body;

    // Validate required fields
    if (!employee_id || !latitude || !longitude || !photo_base64) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Get employee data
    const { data: employee, error: empError } = await supabase
      .from("employees")
      .select("*")
      .eq("id", employee_id)
      .single();

    if (empError || !employee) {
      return NextResponse.json(
        { error: "Employee not found" },
        { status: 404 }
      );
    }

    if (!employee.face_token) {
      return NextResponse.json(
        { error: "Face not registered. Please register your face first." },
        { status: 400 }
      );
    }

    // Get office settings
    const { data: settings, error: settingsError } = await supabase
      .from("office_settings")
      .select("*")
      .single();

    if (settingsError || !settings) {
      return NextResponse.json(
        { error: "Office settings not configured" },
        { status: 500 }
      );
    }

    // Check for existing attendance today
    const today = new Date().toISOString().split("T")[0];
    const { data: attendance, error: attError } = await supabase
      .from("attendances")
      .select("*")
      .eq("employee_id", employee_id)
      .eq("attendance_date", today)
      .single();

    if (attError || !attendance) {
      return NextResponse.json(
        { error: "You haven't checked in today" },
        { status: 400 }
      );
    }

    if (attendance.check_out_time) {
      return NextResponse.json(
        { error: "Already checked out today" },
        { status: 400 }
      );
    }

    // Validate GPS location
    const distance = calculateDistance(
      latitude,
      longitude,
      settings.latitude,
      settings.longitude
    );

    const locationVerified = distance <= settings.radius_meters;

    // Verify face using Face++ API
    const faceVerified = await verifyFace(photo_base64, employee.face_token, settings.face_similarity_threshold);

    if (!faceVerified.success) {
      return NextResponse.json(
        { error: faceVerified.message || "Face verification failed" },
        { status: 400 }
      );
    }

    // Upload photo to storage
    const photoUrl = await uploadPhoto(supabase, photo_base64, employee_id, "check_out");

    // Calculate early leave minutes
    const now = new Date();
    const checkOutTime = settings.default_check_out; // "17:00:00"
    const [hours, minutes] = checkOutTime.split(":").map(Number);
    const expectedCheckOut = new Date(now);
    expectedCheckOut.setHours(hours, minutes, 0, 0);

    let earlyLeaveMinutes = 0;
    if (now < expectedCheckOut) {
      earlyLeaveMinutes = Math.floor((expectedCheckOut.getTime() - now.getTime()) / 60000);
    }

    // Update attendance record
    const { data: updatedAttendance, error: updateError } = await supabase
      .from("attendances")
      .update({
        check_out_time: now.toISOString(),
        check_out_latitude: latitude,
        check_out_longitude: longitude,
        check_out_photo_url: photoUrl,
        check_out_face_verified: faceVerified.verified,
        check_out_location_verified: locationVerified,
        early_leave_minutes: earlyLeaveMinutes,
        // work_duration_minutes is calculated by trigger
      })
      .eq("id", attendance.id)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    // Calculate work duration for response
    const checkInTime = new Date(attendance.check_in_time);
    const workDurationMinutes = Math.floor((now.getTime() - checkInTime.getTime()) / 60000);
    const hours_worked = Math.floor(workDurationMinutes / 60);
    const minutes_worked = workDurationMinutes % 60;

    return NextResponse.json({
      success: true,
      data: updatedAttendance,
      message: "Check-out berhasil. Selamat beristirahat!",
      summary: {
        work_duration: `${hours_worked} jam ${minutes_worked} menit`,
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
      { status: 500 }
    );
  }
}

// Calculate distance between two coordinates using Haversine formula
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth's radius in meters
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

// Verify face using Face++ API
async function verifyFace(
  photoBase64: string,
  faceToken: string,
  threshold: number
): Promise<{ success: boolean; verified: boolean; confidence?: number; message?: string }> {
  try {
    const formData = new FormData();
    formData.append("api_key", process.env.FACEPP_API_KEY!);
    formData.append("api_secret", process.env.FACEPP_API_SECRET!);
    formData.append("face_token1", faceToken);
    formData.append("image_base64_2", photoBase64.replace(/^data:image\/\w+;base64,/, ""));

    const response = await fetch("https://api-us.faceplusplus.com/facepp/v3/compare", {
      method: "POST",
      body: formData,
    });

    const result = await response.json();

    if (result.error_message) {
      return { success: false, verified: false, message: result.error_message };
    }

    const confidence = result.confidence / 100; // Convert to 0-1 scale
    const verified = confidence >= threshold;

    return {
      success: true,
      verified,
      confidence,
      message: verified ? "Face verified" : "Face does not match",
    };
  } catch (error) {
    console.error("Face++ API error:", error);
    return { success: false, verified: false, message: "Face verification service unavailable" };
  }
}

// Upload photo to Supabase storage
async function uploadPhoto(
  supabase: Awaited<ReturnType<typeof createClient>>,
  base64: string,
  employeeId: string,
  type: "check_in" | "check_out"
): Promise<string | null> {
  try {
    // Remove base64 prefix
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
