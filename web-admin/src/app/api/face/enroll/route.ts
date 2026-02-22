import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

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
        { status: 400 }
      );
    }

    // Check if employee exists
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

    // Detect face using Face++ API
    const detectResult = await detectFace(photo_base64);

    if (!detectResult.success) {
      return NextResponse.json(
        { error: detectResult.message || "Face detection failed" },
        { status: 400 }
      );
    }

    if (!detectResult.face_token) {
      return NextResponse.json(
        { error: "No face detected in the image. Please try again with a clearer photo." },
        { status: 400 }
      );
    }

    // Upload photo to storage
    const photoUrl = await uploadFacePhoto(supabase, photo_base64, employee_id);

    // Update employee with face_token
    const { error: updateError } = await supabase
      .from("employees")
      .update({
        face_token: detectResult.face_token,
        face_image_url: photoUrl,
      })
      .eq("id", employee_id);

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({
      success: true,
      message: "Face enrolled successfully",
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
      { status: 500 }
    );
  }
}

// Detect face using Face++ API
async function detectFace(photoBase64: string): Promise<{
  success: boolean;
  face_token?: string;
  face_quality?: number;
  message?: string;
}> {
  try {
    const formData = new FormData();
    formData.append("api_key", process.env.FACEPP_API_KEY!);
    formData.append("api_secret", process.env.FACEPP_API_SECRET!);
    formData.append("image_base64", photoBase64.replace(/^data:image\/\w+;base64,/, ""));
    formData.append("return_attributes", "facequality");

    const response = await fetch("https://api-us.faceplusplus.com/facepp/v3/detect", {
      method: "POST",
      body: formData,
    });

    const result = await response.json();

    if (result.error_message) {
      return { success: false, message: result.error_message };
    }

    if (!result.faces || result.faces.length === 0) {
      return { success: false, message: "No face detected" };
    }

    if (result.faces.length > 1) {
      return { success: false, message: "Multiple faces detected. Please ensure only one face is visible." };
    }

    const face = result.faces[0];
    const faceQuality = face.attributes?.facequality?.value || 0;

    // Check face quality threshold
    if (faceQuality < 50) {
      return { 
        success: false, 
        message: "Face quality is too low. Please try again with better lighting and a clearer photo." 
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

// Upload face photo to Supabase storage
async function uploadFacePhoto(
  supabase: Awaited<ReturnType<typeof createClient>>,
  base64: string,
  employeeId: string
): Promise<string | null> {
  try {
    // Remove base64 prefix
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
