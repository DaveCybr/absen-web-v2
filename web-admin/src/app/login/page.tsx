"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  Eye,
  EyeOff,
  Fingerprint,
  ArrowRight,
  Loader2,
  ShieldCheck,
  Clock,
  MapPin,
} from "lucide-react";
export const dynamic = "force-dynamic";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword(
        { email, password },
      );
      if (authError) throw authError;
      const { data: employee, error: empError } = await supabase
        .from("employees")
        .select("role")
        .eq("user_id", data.user.id)
        .single();
      if (empError || !employee) {
        await supabase.auth.signOut();
        throw new Error("Akun tidak terdaftar");
      }
      if (employee.role !== "admin") {
        await supabase.auth.signOut();
        throw new Error("Akses ditolak. Hanya admin yang dapat masuk.");
      }
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  };

  const features = [
    {
      icon: ShieldCheck,
      label: "Verifikasi Wajah AI",
      desc: "Face recognition berbasis machine learning",
    },
    {
      icon: MapPin,
      label: "Validasi GPS Real-time",
      desc: "Radius check-in akurat hingga meter",
    },
    {
      icon: Clock,
      label: "Laporan Otomatis",
      desc: "Ringkasan kehadiran harian & bulanan",
    },
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { height: 100%; font-family: 'Plus Jakarta Sans', sans-serif; -webkit-font-smoothing: antialiased; }
        body { background: #060C1A; }

        .login-root {
          min-height: 100vh; display: flex;
        }

        /* ── LEFT PANEL ── */
        .lp-left {
          display: none; flex-direction: column; justify-content: space-between;
          width: 50%; padding: 48px;
          background: linear-gradient(160deg, #080F20 0%, #0C1630 40%, #0A1225 100%);
          border-right: 1px solid rgba(255,255,255,0.05);
          position: relative; overflow: hidden;
        }
        @media (min-width: 1024px) { .lp-left { display: flex; } }

        /* Mesh gradient orbs */
        .lp-orb {
          position: absolute; border-radius: 50%;
          filter: blur(80px); pointer-events: none; opacity: 0.5;
        }
        .lp-orb-1 { width: 400px; height: 400px; top: -120px; left: -120px; background: radial-gradient(circle, rgba(37,99,235,0.25) 0%, transparent 70%); }
        .lp-orb-2 { width: 300px; height: 300px; bottom: -80px; right: -60px; background: radial-gradient(circle, rgba(124,58,237,0.2) 0%, transparent 70%); }
        .lp-orb-3 { width: 200px; height: 200px; top: 40%; left: 50%; transform: translate(-50%, -50%); background: radial-gradient(circle, rgba(59,130,246,0.1) 0%, transparent 70%); }

        /* Grid lines */
        .lp-grid {
          position: absolute; inset: 0;
          background-image:
            linear-gradient(rgba(59,130,246,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(59,130,246,0.04) 1px, transparent 1px);
          background-size: 52px 52px;
          pointer-events: none;
        }

        .lp-logo { display: flex; align-items: center; gap: 12px; position: relative; z-index: 1; }
        .lp-logo-mark {
          width: 44px; height: 44px; border-radius: 12px;
          background: linear-gradient(135deg, #2563EB, #3B82F6);
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 0 0 1px rgba(59,130,246,0.4), 0 8px 24px rgba(37,99,235,0.4);
        }
        .lp-logo-name { font-size: 17px; font-weight: 800; color: rgba(255,255,255,0.92); letter-spacing: -0.01em; }
        .lp-logo-sub { font-size: 11px; color: rgba(255,255,255,0.3); font-weight: 400; letter-spacing: 0.04em; margin-top: 1px; }

        .lp-hero { position: relative; z-index: 1; }
        .lp-eyebrow {
          display: inline-flex; align-items: center; gap: 6px;
          background: rgba(37,99,235,0.12); border: 1px solid rgba(59,130,246,0.2);
          border-radius: 999px; padding: 4px 12px; margin-bottom: 20px;
          font-size: 11px; font-weight: 600; color: #93C5FD; letter-spacing: 0.06em;
          text-transform: uppercase;
        }
        .lp-hero h2 {
          font-size: 38px; font-weight: 800; letter-spacing: -0.04em; line-height: 1.15;
          color: rgba(255,255,255,0.92); margin-bottom: 16px;
        }
        .lp-hero h2 em { font-style: normal; color: #60A5FA; }
        .lp-hero p { font-size: 15px; color: rgba(255,255,255,0.45); line-height: 1.7; font-weight: 400; }

        .lp-features { position: relative; z-index: 1; display: flex; flex-direction: column; gap: 12px; }
        .lp-feature {
          display: flex; align-items: center; gap: 14px; padding: 14px 16px;
          background: rgba(255,255,255,0.035); border: 1px solid rgba(255,255,255,0.06);
          border-radius: 12px; transition: background 0.15s;
        }
        .lp-feature:hover { background: rgba(255,255,255,0.055); }
        .lp-feature-icon {
          width: 38px; height: 38px; border-radius: 10px;
          background: rgba(37,99,235,0.18); border: 1px solid rgba(59,130,246,0.2);
          display: flex; align-items: center; justify-content: center; flex-shrink: 0;
        }
        .lp-feature-label { font-size: 13.5px; font-weight: 600; color: rgba(255,255,255,0.8); line-height: 1.2; }
        .lp-feature-desc { font-size: 12px; color: rgba(255,255,255,0.35); margin-top: 1px; }

        /* ── RIGHT PANEL ── */
        .lp-right {
          flex: 1; display: flex; align-items: center; justify-content: center;
          padding: 32px 24px;
          background: #F4F6FA;
        }

        .login-card {
          width: 100%; max-width: 420px;
          background: #FFFFFF; border: 1px solid #E2E8F0;
          border-radius: 20px; padding: 40px;
          box-shadow: 0 4px 6px rgba(15,23,42,0.06), 0 20px 40px rgba(15,23,42,0.08);
        }

        .lc-badge {
          display: inline-flex; align-items: center; gap: 6px;
          background: rgba(37,99,235,0.08); border: 1px solid rgba(37,99,235,0.16);
          border-radius: 999px; padding: 4px 12px; margin-bottom: 18px;
          font-size: 11px; font-weight: 600; color: #2563EB; letter-spacing: 0.05em; text-transform: uppercase;
        }
        .lc-title { font-size: 26px; font-weight: 800; color: #0F172A; letter-spacing: -0.03em; margin-bottom: 6px; }
        .lc-sub { font-size: 14px; color: #64748B; font-weight: 400; margin-bottom: 28px; }

        .form-group { margin-bottom: 16px; }
        .form-label { display: block; font-size: 12.5px; font-weight: 600; color: #374151; margin-bottom: 6px; letter-spacing: 0.01em; }
        .form-input {
          width: 100%; padding: 11px 14px;
          background: #F8FAFC; border: 1.5px solid #E2E8F0;
          border-radius: 10px; font-size: 14px; color: #0F172A;
          font-family: 'Plus Jakarta Sans', sans-serif;
          outline: none; transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
        }
        .form-input:focus {
          border-color: #2563EB; background: #FFFFFF;
          box-shadow: 0 0 0 3px rgba(37,99,235,0.1);
        }
        .form-input::placeholder { color: #94A3B8; }
        .form-input.err { border-color: #DC2626; box-shadow: 0 0 0 3px rgba(220,38,38,0.08); }

        .pwd-wrap { position: relative; }
        .pwd-eye {
          position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
          background: none; border: none; cursor: pointer; color: #94A3B8; padding: 4px;
          display: flex; align-items: center; justify-content: center;
          transition: color 0.13s;
        }
        .pwd-eye:hover { color: #475569; }

        .err-banner {
          display: flex; align-items: flex-start; gap: 10px;
          background: #FEF2F2; border: 1px solid #FECACA;
          border-radius: 10px; padding: 11px 14px; margin-bottom: 18px;
        }
        .err-txt { font-size: 13px; color: #B91C1C; line-height: 1.5; }

        .submit-btn {
          width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px;
          padding: 13px 20px; margin-top: 24px;
          background: #1D4ED8;
          color: white; border: none; border-radius: 10px;
          font-size: 14px; font-weight: 700; font-family: 'Plus Jakarta Sans', sans-serif;
          cursor: pointer; letter-spacing: 0.01em;
          transition: background 0.15s, transform 0.1s, box-shadow 0.15s;
          box-shadow: 0 1px 2px rgba(29,78,216,0.3), 0 4px 16px rgba(29,78,216,0.25);
        }
        .submit-btn:hover:not(:disabled) {
          background: #1E40AF;
          box-shadow: 0 1px 2px rgba(29,78,216,0.4), 0 8px 24px rgba(29,78,216,0.35);
          transform: translateY(-1px);
        }
        .submit-btn:active:not(:disabled) { transform: translateY(0); }
        .submit-btn:disabled { opacity: 0.6; cursor: not-allowed; }

        .lc-footer { margin-top: 20px; text-align: center; font-size: 12px; color: #94A3B8; }

        @keyframes spin { to { transform: rotate(360deg); } }
        .spin { animation: spin 0.7s linear infinite; }
      `}</style>

      <div className="login-root">
        {/* Left decorative */}
        <div className="lp-left">
          <div className="lp-grid" />
          <div className="lp-orb lp-orb-1" />
          <div className="lp-orb lp-orb-2" />
          <div className="lp-orb lp-orb-3" />

          <div className="lp-logo">
            <div className="lp-logo-mark">
              <Fingerprint size={22} color="white" strokeWidth={1.75} />
            </div>
            <div>
              <div className="lp-logo-name">JTI Innovation</div>
              <div className="lp-logo-sub">Sistem Presensi</div>
            </div>
          </div>

          <div className="lp-hero">
            <div className="lp-eyebrow">
              <span>●</span> Enterprise Grade
            </div>
            <h2>
              Kelola Kehadiran
              <br />
              dengan <em>Presisi</em>
            </h2>
            <p>
              Platform manajemen kehadiran karyawan modern berbasis verifikasi
              wajah dan validasi GPS real-time.
            </p>
          </div>

          <div className="lp-features">
            {features.map((f) => (
              <div key={f.label} className="lp-feature">
                <div className="lp-feature-icon">
                  <f.icon size={17} color="#60A5FA" strokeWidth={1.75} />
                </div>
                <div>
                  <div className="lp-feature-label">{f.label}</div>
                  <div className="lp-feature-desc">{f.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right form */}
        <div className="lp-right">
          <div className="login-card">
            <div className="lc-badge">
              <Fingerprint size={11} /> Admin Portal
            </div>
            <h1 className="lc-title">Selamat Datang</h1>
            <p className="lc-sub">Masuk untuk mengelola sistem presensi</p>

            <form onSubmit={handleLogin}>
              {error && (
                <div className="err-banner">
                  <span className="err-txt">{error}</span>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Alamat Email</label>
                <input
                  className={`form-input${error ? " err" : ""}`}
                  type="email"
                  placeholder="admin@perusahaan.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Password</label>
                <div className="pwd-wrap">
                  <input
                    className={`form-input${error ? " err" : ""}`}
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    style={{ paddingRight: 44 }}
                  />
                  <button
                    type="button"
                    className="pwd-eye"
                    onClick={() => setShowPassword((p) => !p)}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button type="submit" className="submit-btn" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 size={16} className="spin" /> Memverifikasi...
                  </>
                ) : (
                  <>
                    Masuk ke Dashboard <ArrowRight size={15} />
                  </>
                )}
              </button>
            </form>

            <div className="lc-footer">
              Akses terbatas untuk administrator sistem
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
