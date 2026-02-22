import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

// POST - Create new employee
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

    // Check if current user is admin (using admin client to bypass RLS)
    const { data: adminEmployee } = await adminSupabase
      .from("employees")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (!adminEmployee || adminEmployee.role !== "admin") {
      return NextResponse.json(
        { error: "Only admins can create employees" },
        { status: 403 },
      );
    }

    const body = await request.json();
    const { name, email, password, phone, department, position, role } = body;

    // Validation
    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Nama, email, dan password wajib diisi" },
        { status: 400 },
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password minimal 6 karakter" },
        { status: 400 },
      );
    }

    // Check if email already exists
    const { data: existingEmployee } = await adminSupabase
      .from("employees")
      .select("id")
      .eq("email", email)
      .single();

    if (existingEmployee) {
      return NextResponse.json(
        { error: "Email sudah terdaftar" },
        { status: 400 },
      );
    }

    // Create auth user using admin client
    const { data: authData, error: authError } =
      await adminSupabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

    if (authError) {
      console.error("Auth error:", authError);
      if (authError.message.includes("already")) {
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

    // Create employee record
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
      console.error("Employee insert error:", empError);
      // Rollback - delete auth user
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

// GET - List all employees
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Verify user is authenticated
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Use admin client to bypass RLS
    const adminSupabase = createAdminClient();

    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get("active") === "true";

    let query = adminSupabase
      .from("employees")
      .select("*")
      .order("created_at", { ascending: false });

    if (activeOnly) {
      query = query.eq("is_active", true);
    }

    const { data, error } = await query;

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
