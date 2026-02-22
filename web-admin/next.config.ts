import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        port: "",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  logging: {
    fetches: {
      fullUrl: process.env.NODE_ENV === "development",
    },
  },
  // ✅ CORS untuk mobile app Flutter
  async headers() {
    return [
      {
        // Terapkan ke semua API routes
        source: "/api/:path*",
        headers: [
          // Izinkan semua origin (untuk development)
          // Di production, ganti * dengan domain spesifik jika ada web client
          { key: "Access-Control-Allow-Origin", value: "*" },
          {
            key: "Access-Control-Allow-Methods",
            value: "GET, POST, PUT, DELETE, OPTIONS",
          },
          {
            key: "Access-Control-Allow-Headers",
            value: "Content-Type, Authorization, X-Requested-With",
          },
          { key: "Access-Control-Max-Age", value: "86400" }, // Cache preflight 24 jam
        ],
      },
    ];
  },
};

export default nextConfig;
