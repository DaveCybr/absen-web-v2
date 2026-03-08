import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/admin/leave-types/sync-balances
 *
 * Sync leave_balances untuk semua karyawan aktif.
 * Berguna saat:
 * 1. Ada jenis Izin baru yang ditambahkan
 * 2. Ada karyawan baru yang balancenya tidak ter-create
 * 3. Migrasi data
 *
 * Hanya bisa diakses admin.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Verifikasi admin
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: adminEmployee } = await supabase
      .from("employees")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (!adminEmployee || adminEmployee.role !== "admin") {
      return NextResponse.json(
        { error: "Only admins can sync leave balances" },
        { status: 403 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const year = body.year || new Date().getFullYear();

    if (year < 2020 || year > 2100) {
      return NextResponse.json({ error: "Tahun tidak valid" }, { status: 400 });
    }

    const adminSupabase = createAdminClient();

    // Panggil stored function yang sudah dibuat di SQL migration
    const { data, error } = await adminSupabase.rpc("sync_all_leave_balances", {
      p_year: year,
    });

    if (error) throw error;

    const createdCount = Array.isArray(data) ? data.length : 0;

    // Ambil summary setelah sync
    const { data: summary } = await adminSupabase
      .from("leave_balances")
      .select("employee_id", { count: "exact", head: true })
      .eq("year", year);

    return NextResponse.json({
      success: true,
      message: `Sync selesai. ${createdCount} balance baru dibuat untuk tahun ${year}.`,
      created: createdCount,
      year,
    });
  } catch (error) {
    console.error("Sync leave balances error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * GET /api/admin/leave-types/sync-balances
 *
 * Cek karyawan yang belum punya balance (untuk diagnosa)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: adminEmployee } = await supabase
      .from("employees")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (!adminEmployee || adminEmployee.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const year = parseInt(
      searchParams.get("year") || String(new Date().getFullYear()),
    );

    const adminSupabase = createAdminClient();

    // Ambil semua karyawan aktif
    const { data: employees } = await adminSupabase
      .from("employees")
      .select("id, name")
      .eq("is_active", true)
      .eq("role", "employee");

    // Ambil semua leave types aktif
    const { data: leaveTypes } = await adminSupabase
      .from("leave_types")
      .select("id, name")
      .eq("is_active", true);

    // Ambil semua balance yang sudah ada
    const { data: existingBalances } = await adminSupabase
      .from("leave_balances")
      .select("employee_id, leave_type_id")
      .eq("year", year);

    const balanceSet = new Set(
      existingBalances?.map((b) => `${b.employee_id}:${b.leave_type_id}`) || [],
    );

    // Cari yang missing
    const missing: Array<{ employee: string; leave_type: string }> = [];
    for (const emp of employees || []) {
      for (const lt of leaveTypes || []) {
        if (!balanceSet.has(`${emp.id}:${lt.id}`)) {
          missing.push({ employee: emp.name, leave_type: lt.name });
        }
      }
    }

    return NextResponse.json({
      success: true,
      year,
      missing_count: missing.length,
      missing,
      message:
        missing.length === 0
          ? "Semua balance sudah lengkap"
          : `${missing.length} balance belum ada. Jalankan POST untuk sync.`,
    });
  } catch (error) {
    console.error("Check leave balances error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
