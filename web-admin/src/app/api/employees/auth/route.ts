import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// POST - Login employee (for mobile app)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    // Sign in with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    // Get employee data
    const { data: employee, error: empError } = await supabase
      .from("employees")
      .select("*")
      .eq("user_id", authData.user.id)
      .single();

    if (empError || !employee) {
      await supabase.auth.signOut();
      return NextResponse.json(
        { error: "Employee account not found" },
        { status: 404 }
      );
    }

    if (!employee.is_active) {
      await supabase.auth.signOut();
      return NextResponse.json(
        { error: "Your account has been deactivated" },
        { status: 403 }
      );
    }

    // Get office settings
    const { data: settings } = await supabase
      .from("office_settings")
      .select("*")
      .single();

    return NextResponse.json({
      success: true,
      data: {
        user: authData.user,
        session: authData.session,
        employee,
        office_settings: settings,
      },
    });
  } catch (error) {
    console.error("Employee login error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// GET - Get current employee (for mobile app)
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    // Get employee data
    const { data: employee, error: empError } = await supabase
      .from("employees")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (empError || !employee) {
      return NextResponse.json(
        { error: "Employee not found" },
        { status: 404 }
      );
    }

    // Get office settings
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
      { status: 500 }
    );
  }
}
