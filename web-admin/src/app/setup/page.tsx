"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Shield, CheckCircle, Eye, EyeOff, Loader2 } from "lucide-react";

export const dynamic = "force-dynamic";

export default function SetupPage() {
  const router = useRouter();

  const [checking, setChecking] = useState(true);
  const [hasAdmin, setHasAdmin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    setup_key: "",
  });

  // Cek apakah admin sudah ada
  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const res = await fetch("/api/setup");
        const data = await res.json();
        if (data.has_admin) {
          setHasAdmin(true);
          setTimeout(() => router.push("/login"), 2000);
        }
      } catch {
        // ignore
      } finally {
        setChecking(false);
      }
    };
    checkAdmin();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (form.password !== form.confirmPassword) {
      setError("Password dan konfirmasi password tidak cocok");
      return;
    }

    if (form.password.length < 8) {
      setError("Password minimal 8 karakter");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          password: form.password,
          setup_key: form.setup_key || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Terjadi kesalahan");
      }

      setSuccess(true);
      setTimeout(() => router.push("/login"), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  };

  // Loading state
  if (checking) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 text-blue-400 animate-spin" />
          <p className="text-gray-400 text-sm">Memeriksa sistem...</p>
        </div>
      </div>
    );
  }

  // Admin sudah ada
  if (hasAdmin) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10 border border-green-500/20">
            <CheckCircle className="h-8 w-8 text-green-400" />
          </div>
          <h1 className="text-xl font-semibold text-white">Admin Sudah Ada</h1>
          <p className="mt-2 text-gray-400 text-sm">
            Mengarahkan ke halaman login...
          </p>
        </div>
      </div>
    );
  }

  // Success state
  if (success) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10 border border-green-500/20 animate-pulse">
            <CheckCircle className="h-8 w-8 text-green-400" />
          </div>
          <h1 className="text-xl font-semibold text-white">
            Admin Berhasil Dibuat!
          </h1>
          <p className="mt-2 text-gray-400 text-sm">
            Mengarahkan ke halaman login...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      {/* Background decoration */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-600/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-indigo-600/5 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600/10 border border-blue-500/20">
            <Shield className="h-7 w-7 text-blue-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">Setup Pertama Kali</h1>
          <p className="mt-2 text-gray-400 text-sm">
            Buat akun admin untuk memulai menggunakan sistem absensi
          </p>
        </div>

        {/* Warning banner */}
        <div className="mb-6 rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-4">
          <p className="text-yellow-400 text-xs font-medium">
            ⚠️ Halaman ini hanya tersedia saat belum ada admin. Setelah admin
            dibuat, halaman ini akan otomatis dinonaktifkan.
          </p>
        </div>

        {/* Form */}
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            {/* Nama */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-300">
                Nama Lengkap <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Super Admin"
                required
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-gray-500 focus:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500/30 transition-colors"
              />
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-300">
                Email <span className="text-red-400">*</span>
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="admin@perusahaan.com"
                required
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-gray-500 focus:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500/30 transition-colors"
              />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-300">
                Password <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={(e) =>
                    setForm({ ...form, password: e.target.value })
                  }
                  placeholder="Minimal 8 karakter"
                  required
                  minLength={8}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 pr-10 text-sm text-white placeholder:text-gray-500 focus:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500/30 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {/* Password strength indicator */}
              {form.password && (
                <div className="flex gap-1 mt-1">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className={`h-1 flex-1 rounded-full transition-colors ${
                        form.password.length >= i * 3
                          ? form.password.length >= 12
                            ? "bg-green-500"
                            : form.password.length >= 8
                              ? "bg-yellow-500"
                              : "bg-red-500"
                          : "bg-white/10"
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Konfirmasi Password */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-300">
                Konfirmasi Password <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <input
                  type={showConfirm ? "text" : "password"}
                  value={form.confirmPassword}
                  onChange={(e) =>
                    setForm({ ...form, confirmPassword: e.target.value })
                  }
                  placeholder="Ulangi password"
                  required
                  className={`w-full rounded-lg border px-3 py-2.5 pr-10 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-1 transition-colors bg-white/5 ${
                    form.confirmPassword &&
                    form.password !== form.confirmPassword
                      ? "border-red-500/50 focus:border-red-500/50 focus:ring-red-500/30"
                      : form.confirmPassword &&
                          form.password === form.confirmPassword
                        ? "border-green-500/50 focus:border-green-500/50 focus:ring-green-500/30"
                        : "border-white/10 focus:border-blue-500/50 focus:ring-blue-500/30"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                >
                  {showConfirm ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {form.confirmPassword &&
                form.password !== form.confirmPassword && (
                  <p className="text-red-400 text-xs">Password tidak cocok</p>
                )}
            </div>

            {/* Setup Key (opsional) */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-300">
                Setup Key{" "}
                <span className="text-gray-500 font-normal">(opsional)</span>
              </label>
              <input
                type="password"
                value={form.setup_key}
                onChange={(e) =>
                  setForm({ ...form, setup_key: e.target.value })
                }
                placeholder="Isi jika dikonfigurasi di .env"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-gray-500 focus:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500/30 transition-colors"
              />
              <p className="text-gray-500 text-xs">
                Tambahkan SETUP_SECRET_KEY di .env.local untuk keamanan ekstra
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Membuat Admin...
                </>
              ) : (
                "Buat Admin Pertama"
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-gray-600 text-xs mt-6">
          Sistem Absensi — Setup Awal
        </p>
      </div>
    </div>
  );
}
