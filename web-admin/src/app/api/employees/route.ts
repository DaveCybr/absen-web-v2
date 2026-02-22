import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    // Verify current user is admin
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Pakai adminSupabase untuk query employees (bypass RLS)
    const { data: adminEmployee } = await adminSupabase
      .from("employees")
      .select("role")
      .eq("user_id", user.id)
      .single();

    console.log("Admin employee data:", adminEmployee);

    if (!adminEmployee || adminEmployee.role !== "admin") {
      return NextResponse.json(
        { error: "Only admins can create employees" },
        { status: 403 },
      );
    }

    const body = await request.json();
    const { name, email, password, phone, department, position, role } = body;

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Name, email, and password are required" },
        { status: 400 },
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 },
      );
    }

    // Create auth user
    const { data: authData, error: authError } =
      await adminSupabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

    if (authError) {
      if (
        authError.message.includes("already registered") ||
        authError.message.includes("already been registered")
      ) {
        return NextResponse.json(
          { error: "Email sudah terdaftar" },
          { status: 400 },
        );
      }
      throw authError;
    }

    if (!authData.user) {
      throw new Error("Failed to create user");
    }

    // Insert employee pakai adminSupabase (bypass RLS)
    const { data: employee, error: empError } = await adminSupabase
      .from("employees")
      .insert({
        user_id: authData.user.id,
        name,
        email,
        phone: phone || null,
        department: department || null,
        position: position || null,
        role: role || "employee",
        is_active: true,
      })
      .select()
      .single();

    if (empError) {
      // Rollback
      await adminSupabase.auth.admin.deleteUser(authData.user.id);
      throw empError;
    }

    return NextResponse.json({
      success: true,
      data: employee,
      message: "Karyawan berhasil ditambahkan",
    });
  } catch (error) {
    console.error("Create employee error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminSupabase = createAdminClient();
    const { data, error } = await adminSupabase
      .from("employees")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Get employees error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}
