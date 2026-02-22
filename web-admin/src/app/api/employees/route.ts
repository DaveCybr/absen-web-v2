import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

// Batas ukuran base64 foto: ~5MB
const MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024;

// POST - Create new employee
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminSupabase = createAdminClient();

    // Verifikasi user adalah admin
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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

    // Validasi
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

    // Validasi format email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Format email tidak valid" },
        { status: 400 },
      );
    }

    // Cek email sudah ada
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

    if (!authData.user) {
      throw new Error("Failed to create user");
    }

    // Buat employee record
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
      // Rollback - hapus auth user
      await adminSupabase.auth.admin.deleteUser(authData.user.id);
      throw empError;
    }

    // ✅ FIX: Inisialisasi leave balances untuk karyawan baru
    await initLeaveBalances(adminSupabase, employee.id);

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

/**
 * Inisialisasi leave balances untuk karyawan baru
 * berdasarkan semua leave types yang aktif
 */
async function initLeaveBalances(
  adminSupabase: ReturnType<typeof createAdminClient>,
  employeeId: string,
) {
  try {
    const currentYear = new Date().getFullYear();

    // Ambil semua leave types aktif
    const { data: leaveTypes, error } = await adminSupabase
      .from("leave_types")
      .select("id, default_quota")
      .eq("is_active", true);

    if (error || !leaveTypes?.length) return;

    // Buat balance records
    const balances = leaveTypes.map((lt) => ({
      employee_id: employeeId,
      leave_type_id: lt.id,
      year: currentYear,
      quota: lt.default_quota,
      used: 0,
    }));

    const { error: insertError } = await adminSupabase
      .from("leave_balances")
      .insert(balances);

    if (insertError) {
      console.error("Failed to init leave balances:", insertError);
    }
  } catch (err) {
    console.error("initLeaveBalances error:", err);
  }
}

// GET - List all employees
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminSupabase = createAdminClient();
    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get("active") === "true";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "100");
    const offset = (page - 1) * limit;

    let query = adminSupabase
      .from("employees")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (activeOnly) {
      query = query.eq("is_active", true);
    }

    const { data, error, count } = await query;

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data,
      pagination: {
        total: count || 0,
        page,
        limit,
      },
    });
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
