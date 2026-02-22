import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { detectFace, uploadFacePhoto } from "@/lib/attendance";

interface EnrollFaceRequest {
  employee_id: string;
  photo_base64: string;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body: EnrollFaceRequest = await request.json();
    const { employee_id, photo_base64 } = body;

    if (!employee_id || !photo_base64) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

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

    // Detect face
    const detectResult = await detectFace(photo_base64);

    if (!detectResult.success) {
      return NextResponse.json(
        { error: detectResult.message || "Face detection failed" },
        { status: 400 },
      );
    }

    if (!detectResult.face_token) {
      return NextResponse.json(
        { error: "Tidak ada wajah terdeteksi. Coba foto ulang." },
        { status: 400 },
      );
    }

    // Upload face photo
    const photoUrl = await uploadFacePhoto(supabase, photo_base64, employee_id);

    // Update employee with face_token
    const { error: updateError } = await supabase
      .from("employees")
      .update({
        face_token: detectResult.face_token,
        face_image_url: photoUrl,
      })
      .eq("id", employee_id);

    if (updateError) throw updateError;

    return NextResponse.json({
      success: true,
      message: "Wajah berhasil didaftarkan",
      data: {
        face_token: detectResult.face_token,
        face_image_url: photoUrl,
        face_quality: detectResult.face_quality,
      },
    });
  } catch (error) {
    console.error("Face enrollment error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
