import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// POST - Login (untuk mobile app)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { email, password, fcm_token } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email dan password wajib diisi" },
        { status: 400 },
      );
    }

    // Sign in via Supabase Auth
    const { data: authData, error: authError } =
      await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      return NextResponse.json(
        { error: "Email atau password salah" },
        { status: 401 },
      );
    }

    // Ambil data karyawan
    const { data: employee, error: empError } = await supabase
      .from("employees")
      .select("*")
      .eq("user_id", authData.user.id)
      .single();

    if (empError || !employee) {
      await supabase.auth.signOut();
      return NextResponse.json(
        { error: "Akun karyawan tidak ditemukan" },
        { status: 404 },
      );
    }

    if (!employee.is_active) {
      await supabase.auth.signOut();
      return NextResponse.json(
        { error: "Akun Anda telah dinonaktifkan. Hubungi admin." },
        { status: 403 },
      );
    }

    // ✅ Simpan FCM token jika dikirim saat login
    if (fcm_token) {
      await supabase
        .from("employees")
        .update({ fcm_token })
        .eq("id", employee.id);

      employee.fcm_token = fcm_token;
    }

    // Ambil pengaturan kantor
    const { data: settings } = await supabase
      .from("office_settings")
      .select("*")
      .single();

    return NextResponse.json({
      success: true,
      data: {
        // ✅ Return session lengkap untuk mobile
        session: {
          access_token: authData.session!.access_token,
          refresh_token: authData.session!.refresh_token,
          expires_at: authData.session!.expires_at,
          expires_in: authData.session!.expires_in,
          token_type: "Bearer",
        },
        user: authData.user,
        employee,
        office_settings: settings,
      },
    });
  } catch (error) {
    console.error("Employee login error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// GET - Get current employee via Bearer token (untuk mobile app)
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { data: employee, error: empError } = await supabase
      .from("employees")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (empError || !employee) {
      return NextResponse.json(
        { error: "Employee not found" },
        { status: 404 },
      );
    }

    const { data: settings } = await supabase
      .from("office_settings")
      .select("*")
      .single();

    return NextResponse.json({
      success: true,
      data: {
        user,
        employee,
        office_settings: settings,
      },
    });
  } catch (error) {
    console.error("Get employee error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
