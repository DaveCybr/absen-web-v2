import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

interface CheckInRequest {
  employee_id: string;
  latitude: number;
  longitude: number;
  photo_base64: string;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body: CheckInRequest = await request.json();

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
    const photoUrl = await uploadPhoto(supabase, photo_base64, employee_id, "check_in");

    // Check for existing attendance today
    const today = new Date().toISOString().split("T")[0];
    const { data: existingAttendance } = await supabase
      .from("attendances")
      .select("*")
      .eq("employee_id", employee_id)
      .eq("attendance_date", today)
      .single();

    if (existingAttendance?.check_in_time) {
      return NextResponse.json(
        { error: "Already checked in today" },
        { status: 400 }
      );
    }

    // Calculate late minutes
    const now = new Date();
    const checkInTime = settings.default_check_in; // "08:00:00"
    const [hours, minutes] = checkInTime.split(":").map(Number);
    const expectedCheckIn = new Date(now);
    expectedCheckIn.setHours(hours, minutes, 0, 0);
    
    // Add late tolerance
    expectedCheckIn.setMinutes(expectedCheckIn.getMinutes() + settings.late_tolerance_minutes);

    let lateMinutes = 0;
    let status: "present" | "late" = "present";

    if (now > expectedCheckIn) {
      lateMinutes = Math.floor((now.getTime() - expectedCheckIn.getTime()) / 60000);
      status = "late";
    }

    // Create or update attendance record
    const attendanceData = {
      employee_id,
      attendance_date: today,
      check_in_time: now.toISOString(),
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
      // Update existing (e.g., was marked as leave but now checking in)
      const { data, error } = await supabase
        .from("attendances")
        .update(attendanceData)
        .eq("id", existingAttendance.id)
        .select()
        .single();

      if (error) throw error;
      attendance = data;
    } else {
      // Create new
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
      message: status === "late" 
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
