import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { getTodayWIB } from "@/lib/attendance";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // ✅ FIX [C3]: Validasi user login
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: currentEmployee } = await supabase
      .from("employees")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!currentEmployee) {
      return NextResponse.json(
        { error: "Employee not found" },
        { status: 404 },
      );
    }

    const { searchParams } = new URL(request.url);

    // ✅ FIX [C3]: Employee hanya bisa lihat history miliknya sendiri
    // Admin bisa lihat semua dengan query param employee_id
    let targetEmployeeId: string;

    if (currentEmployee.role === "admin") {
      targetEmployeeId = searchParams.get("employee_id") || currentEmployee.id;
    } else {
      // Karyawan biasa hanya bisa lihat miliknya
      targetEmployeeId = currentEmployee.id;
    }

    const startDate = searchParams.get("start_date");
    const endDate = searchParams.get("end_date");
    const limit = Math.min(parseInt(searchParams.get("limit") || "30"), 100);
    const offset = parseInt(searchParams.get("offset") || "0");

    // ✅ FIX [H1]: Query data PAGINATED untuk tampil di list
    let dataQuery = supabase
      .from("attendances")
      .select("*", { count: "exact" })
      .eq("employee_id", targetEmployeeId)
      .order("attendance_date", { ascending: false })
      .range(offset, offset + limit - 1);

    // ✅ FIX [H1]: Query SUMMARY terpisah tanpa limit/offset
    // Sehingga summary akurat untuk semua data, bukan hanya halaman ini
    let summaryQuery = supabase
      .from("attendances")
      .select("status, late_minutes, work_duration_minutes")
      .eq("employee_id", targetEmployeeId);

    if (startDate) {
      dataQuery = dataQuery.gte("attendance_date", startDate);
      summaryQuery = summaryQuery.gte("attendance_date", startDate);
    }

    if (endDate) {
      dataQuery = dataQuery.lte("attendance_date", endDate);
      summaryQuery = summaryQuery.lte("attendance_date", endDate);
    }

    // Jalankan kedua query secara paralel
    const [dataResult, summaryResult] = await Promise.all([
      dataQuery,
      summaryQuery,
    ]);

    if (dataResult.error) throw dataResult.error;
    if (summaryResult.error) throw summaryResult.error;

    // Hitung summary dari SEMUA data (bukan hanya yang di-paginate)
    const allData = summaryResult.data || [];
    const summary = {
      total_days: allData.length,
      present_days: allData.filter((a) => a.status === "present").length,
      late_days: allData.filter((a) => a.status === "late").length,
      absent_days: allData.filter((a) => a.status === "absent").length,
      leave_days: allData.filter((a) => a.status === "leave").length,
      total_work_minutes: allData.reduce(
        (acc, a) => acc + (a.work_duration_minutes || 0),
        0,
      ),
      total_late_minutes: allData.reduce(
        (acc, a) => acc + (a.late_minutes || 0),
        0,
      ),
    };

    return NextResponse.json({
      success: true,
      data: dataResult.data,
      summary,
      pagination: {
        total: dataResult.count,
        limit,
        offset,
        has_more: (dataResult.count || 0) > offset + limit,
      },
    });
  } catch (error) {
    console.error("Get attendance history error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
