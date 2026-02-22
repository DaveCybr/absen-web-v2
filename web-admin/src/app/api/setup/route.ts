import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

// GET - Cek apakah sudah ada admin
export async function GET() {
  try {
    const adminSupabase = createAdminClient();

    const { count } = await adminSupabase
      .from("employees")
      .select("*", { count: "exact", head: true })
      .eq("role", "admin")
      .eq("is_active", true);

    return NextResponse.json({
      has_admin: (count || 0) > 0,
    });
  } catch (error) {
    console.error("Check admin error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// POST - Buat admin pertama kali
export async function POST(request: NextRequest) {
  try {
    const adminSupabase = createAdminClient();

    // Cek dulu apakah sudah ada admin (keamanan)
    const { count } = await adminSupabase
      .from("employees")
      .select("*", { count: "exact", head: true })
      .eq("role", "admin")
      .eq("is_active", true);

    if ((count || 0) > 0) {
      return NextResponse.json(
        { error: "Admin sudah ada. Setup tidak diperlukan." },
        { status: 400 },
      );
    }

    const body = await request.json();
    const { name, email, password, setup_key } = body;

    // Validasi setup key (keamanan tambahan)
    const expectedSetupKey = process.env.SETUP_SECRET_KEY;
    if (expectedSetupKey && setup_key !== expectedSetupKey) {
      return NextResponse.json(
        { error: "Setup key tidak valid" },
        { status: 403 },
      );
    }

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Nama, email, dan password wajib diisi" },
        { status: 400 },
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password minimal 8 karakter" },
        { status: 400 },
      );
    }

    // Buat auth user
    const { data: authData, error: authError } =
      await adminSupabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

    if (authError) {
      if (authError.message.includes("already")) {
        return NextResponse.json(
          { error: "Email sudah terdaftar" },
          { status: 400 },
        );
      }
      throw authError;
    }

    // Buat employee record sebagai admin
    const { data: employee, error: empError } = await adminSupabase
      .from("employees")
      .insert({
        user_id: authData.user.id,
        name,
        email,
        role: "admin",
        is_active: true,
      })
      .select()
      .single();

    if (empError) {
      await adminSupabase.auth.admin.deleteUser(authData.user.id);
      throw empError;
    }

    return NextResponse.json({
      success: true,
      message: "Admin berhasil dibuat! Silakan login.",
      data: {
        id: employee.id,
        name: employee.name,
        email: employee.email,
        role: employee.role,
      },
    });
  } catch (error) {
    console.error("Create admin error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}
