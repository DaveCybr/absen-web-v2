import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  // ✅ Handle CORS preflight request dari mobile app
  // Flutter/HTTP client mengirim OPTIONS request sebelum POST/PUT
  if (request.method === "OPTIONS") {
    return new NextResponse(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers":
          "Content-Type, Authorization, X-Requested-With",
        "Access-Control-Max-Age": "86400",
      },
    });
  }

  // Skip auth check untuk API routes yang diakses mobile
  // (mobile pakai Bearer token, bukan cookie session)
  const isMobileApiRoute = request.nextUrl.pathname.startsWith("/api/");
  const hasAuthHeader = request.headers
    .get("Authorization")
    ?.startsWith("Bearer ");

  if (isMobileApiRoute && hasAuthHeader) {
    // API route dengan Bearer token — lewati redirect logic
    return NextResponse.next();
  }

  // Jalankan session update normal untuk web
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
