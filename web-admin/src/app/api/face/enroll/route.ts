import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { detectFace, uploadFacePhoto } from "@/lib/attendance";

interface EnrollFaceRequest {
  employee_id: string;
  photo_base64: string;
}

/**
 * POST /api/face/enroll
 *
 * ✅ FIX [C2]: Tambah validasi auth
 * - Karyawan hanya bisa enroll wajah SENDIRI
 * - Admin bisa enroll wajah siapapun
 *
 * ✅ FIX [C1]: face_token tidak disimpan lagi ke DB
 * - Hanya face_image_url yang disimpan (permanent, tidak expire)
 * - verifyFace() sekarang compare dua gambar, bukan pakai face_token
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Verifikasi user login
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Ambil data user yang login
    const { data: requestingEmployee, error: reqEmpError } = await supabase
      .from("employees")
      .select("id, role, is_active")
      .eq("user_id", user.id)
      .single();

    if (reqEmpError || !requestingEmployee) {
      return NextResponse.json(
        { error: "Data karyawan tidak ditemukan" },
        { status: 404 },
      );
    }

    if (!requestingEmployee.is_active) {
      return NextResponse.json(
        { error: "Akun Anda sudah dinonaktifkan" },
        { status: 403 },
      );
    }

    const body: EnrollFaceRequest = await request.json();
    const { employee_id, photo_base64 } = body;

    if (!employee_id || !photo_base64) {
      return NextResponse.json(
        { error: "Missing required fields" },
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

    // ✅ FIX [C2]: Validasi kepemilikan
    // Karyawan biasa hanya bisa enroll dirinya sendiri
    // Admin bisa enroll siapapun
    const isSelf = requestingEmployee.id === employee_id;
    const isAdmin = requestingEmployee.role === "admin";

    if (!isSelf && !isAdmin) {
      return NextResponse.json(
        {
          error:
            "Anda tidak memiliki izin untuk mendaftarkan wajah karyawan lain",
        },
        { status: 403 },
      );
    }

    // Ambil data target employee
    const { data: targetEmployee, error: empError } = await supabase
      .from("employees")
      .select("id, name, face_image_url")
      .eq("id", employee_id)
      .single();

    if (empError || !targetEmployee) {
      return NextResponse.json(
        { error: "Employee not found" },
        { status: 404 },
      );
    }

    // Deteksi wajah di foto
    const detectResult = await detectFace(photo_base64);

    if (!detectResult.success) {
      return NextResponse.json(
        { error: detectResult.message || "Deteksi wajah gagal" },
        { status: 400 },
      );
    }

    // Hapus foto lama dari storage jika ada
    if (targetEmployee.face_image_url) {
      await deleteOldFacePhoto(supabase, targetEmployee.face_image_url);
    }

    // Upload foto wajah baru ke storage
    const photoUrl = await uploadFacePhoto(supabase, photo_base64, employee_id);

    if (!photoUrl) {
      return NextResponse.json(
        { error: "Gagal menyimpan foto. Coba lagi." },
        { status: 500 },
      );
    }

    // ✅ FIX [C1]: Hanya simpan face_image_url, TIDAK simpan face_token
    // face_token expire 24 jam, face_image_url permanent
    const { error: updateError } = await supabase
      .from("employees")
      .update({
        face_image_url: photoUrl,
        // face_token: null — hapus token lama jika ada, tidak lagi digunakan
        face_token: null,
      })
      .eq("id", employee_id);

    if (updateError) throw updateError;

    return NextResponse.json({
      success: true,
      message: "Wajah berhasil didaftarkan",
      data: {
        face_image_url: photoUrl,
        face_quality: detectResult.face_quality,
        enrolled_for: targetEmployee.name,
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

/**
 * Hapus foto wajah lama dari Supabase Storage
 */
async function deleteOldFacePhoto(
  supabase: Awaited<
    ReturnType<typeof import("@/lib/supabase/server").createClient>
  >,
  faceImageUrl: string,
) {
  try {
    const url = new URL(faceImageUrl);
    const pathParts = url.pathname.split(
      "/storage/v1/object/public/employee-faces/",
    );
    if (pathParts.length < 2) return;

    const filePath = pathParts[1];
    const { error } = await supabase.storage
      .from("employee-faces")
      .remove([filePath]);

    if (error) {
      console.warn("Failed to delete old face photo:", error.message);
    }
  } catch (err) {
    console.warn("deleteOldFacePhoto error:", err);
  }
}
