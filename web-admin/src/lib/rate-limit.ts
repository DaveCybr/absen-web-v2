/**
 * Simple in-memory rate limiter untuk API routes
 *
 * Catatan: In-memory rate limiter hanya bekerja dalam single instance.
 * Untuk production dengan multiple instances, gunakan Redis via Upstash.
 *
 * Untuk sekarang ini cukup karena:
 * 1. Vercel/Next.js serverless masih per-instance
 * 2. Supabase juga punya rate limiting bawaan
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// Map: key → { count, resetAt }
const rateLimitMap = new Map<string, RateLimitEntry>();

// Bersihkan entries expired setiap 5 menit
setInterval(
  () => {
    const now = Date.now();
    for (const [key, entry] of rateLimitMap.entries()) {
      if (entry.resetAt < now) {
        rateLimitMap.delete(key);
      }
    }
  },
  5 * 60 * 1000,
);

interface RateLimitOptions {
  /** Max requests dalam window */
  limit: number;
  /** Window dalam detik */
  windowSeconds: number;
}

interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetAt: number;
  retryAfter?: number;
}

/**
 * Check rate limit untuk sebuah key (biasanya IP atau employee_id)
 */
export function checkRateLimit(
  key: string,
  options: RateLimitOptions,
): RateLimitResult {
  const now = Date.now();
  const windowMs = options.windowSeconds * 1000;

  const entry = rateLimitMap.get(key);

  if (!entry || entry.resetAt < now) {
    // Buat entry baru
    rateLimitMap.set(key, {
      count: 1,
      resetAt: now + windowMs,
    });
    return {
      success: true,
      remaining: options.limit - 1,
      resetAt: now + windowMs,
    };
  }

  if (entry.count >= options.limit) {
    return {
      success: false,
      remaining: 0,
      resetAt: entry.resetAt,
      retryAfter: Math.ceil((entry.resetAt - now) / 1000),
    };
  }

  entry.count++;
  return {
    success: true,
    remaining: options.limit - entry.count,
    resetAt: entry.resetAt,
  };
}

// Preset limits untuk berbagai endpoint
export const RATE_LIMITS = {
  /** Check-in/out: 5 request per menit per employee */
  ATTENDANCE: { limit: 5, windowSeconds: 60 },
  /** Login: 10 request per menit per IP */
  AUTH: { limit: 10, windowSeconds: 60 },
  /** Face enroll: 10 request per jam per employee */
  FACE_ENROLL: { limit: 10, windowSeconds: 3600 },
  /** General API: 100 request per menit per IP */
  GENERAL: { limit: 100, windowSeconds: 60 },
} as const;
