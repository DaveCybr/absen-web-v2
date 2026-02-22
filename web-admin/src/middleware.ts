import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

/**
 * Helper: ambil IP client dari request headers
 */
function getClientIP(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

/**
 * Helper: ambil employee_id dari request body (untuk attendance routes)
 * Returns null jika tidak bisa parse
 */
async function getEmployeeIdFromBody(
  request: NextRequest,
): Promise<string | null> {
  try {
    const cloned = request.clone();
    const body = await cloned.json();
    return body.employee_id || null;
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // ✅ Handle CORS preflight request dari mobile app
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

  if (pathname.startsWith("/setup") || pathname.startsWith("/api/setup")) {
    return NextResponse.next();
  }

  // ✅ Rate limiting untuk API routes
  if (pathname.startsWith("/api/")) {
    const ip = getClientIP(request);

    // Attendance endpoints — rate limit per employee_id
    if (
      pathname.includes("/attendance/check-in") ||
      pathname.includes("/attendance/check-out")
    ) {
      const employeeId = await getEmployeeIdFromBody(request);
      const key = `attendance:${employeeId || ip}`;
      const result = checkRateLimit(key, RATE_LIMITS.ATTENDANCE);

      if (!result.success) {
        return NextResponse.json(
          {
            error: `Terlalu banyak permintaan. Coba lagi dalam ${result.retryAfter} detik.`,
          },
          {
            status: 429,
            headers: {
              "Retry-After": String(result.retryAfter),
              "X-RateLimit-Limit": String(RATE_LIMITS.ATTENDANCE.limit),
              "X-RateLimit-Remaining": "0",
              "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
            },
          },
        );
      }
    }

    // Auth login endpoint — rate limit per IP
    else if (
      pathname.includes("/employees/auth") &&
      request.method === "POST"
    ) {
      const key = `auth:${ip}`;
      const result = checkRateLimit(key, RATE_LIMITS.AUTH);

      if (!result.success) {
        return NextResponse.json(
          {
            error: `Terlalu banyak percobaan login. Coba lagi dalam ${result.retryAfter} detik.`,
          },
          {
            status: 429,
            headers: {
              "Retry-After": String(result.retryAfter),
            },
          },
        );
      }
    }

    // Face enroll — rate limit per IP
    else if (pathname.includes("/face/enroll")) {
      const key = `face:${ip}`;
      const result = checkRateLimit(key, RATE_LIMITS.FACE_ENROLL);

      if (!result.success) {
        return NextResponse.json(
          {
            error: `Terlalu banyak percobaan enroll wajah. Coba lagi dalam ${result.retryAfter} detik.`,
          },
          {
            status: 429,
            headers: {
              "Retry-After": String(result.retryAfter),
            },
          },
        );
      }
    }
  }

  // Skip auth check untuk API routes yang diakses mobile dengan Bearer token
  const isMobileApiRoute = pathname.startsWith("/api/");
  const hasAuthHeader = request.headers
    .get("Authorization")
    ?.startsWith("Bearer ");

  if (isMobileApiRoute && hasAuthHeader) {
    const response = NextResponse.next();
    // Tambahkan CORS headers ke response
    response.headers.set("Access-Control-Allow-Origin", "*");
    response.headers.set(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, DELETE, OPTIONS",
    );
    response.headers.set(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, X-Requested-With",
    );
    return response;
  }

  // Jalankan session update normal untuk web
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
