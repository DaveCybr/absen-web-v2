"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  Plus,
  X,
  User,
  Mail,
  Lock,
  Building2,
  Briefcase,
  Phone,
  Shield,
  ChevronRight,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { Toast } from "@/components/ui/toast";

const STEPS = [
  { id: 1, label: "Akun", desc: "Info login" },
  { id: 2, label: "Profil", desc: "Data diri" },
  { id: 3, label: "Akses", desc: "Role & status" },
];

export function AddEmployeeButton() {
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    department: "",
    position: "",
    role: "employee",
    password: "",
  });

  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const validate = (field: string, value: string) => {
    if (field === "email" && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
      return "Format email tidak valid";
    if (field === "password" && value && value.length < 6)
      return "Minimal 6 karakter";
    if (field === "name" && value && value.length < 2)
      return "Nama terlalu pendek";
    return "";
  };

  const set = (field: string, value: string) => {
    setFormData((p) => ({ ...p, [field]: value }));
    if (touched[field]) {
      const err = validate(field, value);
      setFieldErrors((p) => ({ ...p, [field]: err }));
    }
  };

  const blur = (field: string) => {
    setTouched((p) => ({ ...p, [field]: true }));
    const err = validate(
      field,
      formData[field as keyof typeof formData] as string,
    );
    setFieldErrors((p) => ({ ...p, [field]: err }));
  };

  const stepValid = () => {
    if (step === 1)
      return (
        formData.name.length >= 2 &&
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email) &&
        formData.password.length >= 6
      );
    return true;
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Terjadi kesalahan");
      setOpen(false);
      setStep(1);
      setFormData({
        name: "",
        email: "",
        phone: "",
        department: "",
        position: "",
        role: "employee",
        password: "",
      });
      setTouched({});
      router.refresh();
      setToast({ message: "Karyawan berhasil ditambahkan", type: "success" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  };

  const close = () => {
    setOpen(false);
    setStep(1);
    setError("");
    setTouched({});
    setFieldErrors({});
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');

        .aeb-backdrop {
          position: fixed; inset: 0; z-index: 9000;
          background: rgba(8,10,16,0.72);
          backdrop-filter: blur(6px);
          display: flex; align-items: center; justify-content: center;
          padding: 20px;
          animation: aeb-fade-in 0.2s ease;
        }
        @keyframes aeb-fade-in { from { opacity: 0; } to { opacity: 1; } }

        .aeb-modal {
          font-family: 'DM Sans', sans-serif;
          width: 100%; max-width: 520px;
          background: #FAFAFA;
          border-radius: 20px;
          box-shadow: 0 32px 80px rgba(0,0,0,0.2), 0 0 0 1px rgba(0,0,0,0.06);
          overflow: hidden;
          animation: aeb-slide-up 0.28s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        @keyframes aeb-slide-up {
          from { opacity: 0; transform: translateY(24px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        .aeb-header {
          background: linear-gradient(135deg, #0F172A 0%, #1E293B 100%);
          padding: 28px 32px 24px;
          position: relative;
        }
        .aeb-header-accent {
          position: absolute; top: 0; right: 0;
          width: 200px; height: 100%;
          background: radial-gradient(ellipse at 80% 50%, rgba(99,102,241,0.25) 0%, transparent 70%);
          pointer-events: none;
        }
        .aeb-header-badge {
          display: inline-flex; align-items: center; gap: 6px;
          background: rgba(99,102,241,0.2); border: 1px solid rgba(99,102,241,0.35);
          color: #A5B4FC; border-radius: 100px;
          font-size: 11px; font-weight: 600; letter-spacing: 0.04em;
          padding: 4px 10px; margin-bottom: 10px;
          text-transform: uppercase;
        }
        .aeb-header-title {
          font-size: 22px; font-weight: 700; color: #fff;
          letter-spacing: -0.03em; margin: 0;
        }
        .aeb-header-sub {
          font-size: 13px; color: #94A3B8; margin-top: 4px;
        }
        .aeb-close {
          position: absolute; top: 20px; right: 20px;
          width: 32px; height: 32px; border-radius: 8px;
          background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12);
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; color: #94A3B8;
          transition: background 0.15s, color 0.15s;
        }
        .aeb-close:hover { background: rgba(255,255,255,0.16); color: #fff; }

        /* Stepper */
        .aeb-stepper {
          display: flex; align-items: center; gap: 0;
          padding: 20px 32px;
          background: #fff;
          border-bottom: 1px solid #EEF2F7;
        }
        .aeb-step {
          display: flex; align-items: center; gap: 10px; flex: 1;
          position: relative;
        }
        .aeb-step:not(:last-child)::after {
          content: '';
          position: absolute; left: calc(50% + 22px); right: calc(-50% + 22px);
          top: 50%; height: 1.5px;
          background: #E2E8F0;
          transition: background 0.3s;
        }
        .aeb-step.done::after { background: #6366F1; }
        .aeb-step-num {
          width: 32px; height: 32px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-size: 13px; font-weight: 700; flex-shrink: 0;
          transition: all 0.2s;
        }
        .aeb-step.pending .aeb-step-num { background: #F1F5F9; color: #94A3B8; border: 1.5px solid #E2E8F0; }
        .aeb-step.active .aeb-step-num { background: #6366F1; color: #fff; box-shadow: 0 0 0 4px rgba(99,102,241,0.15); }
        .aeb-step.done .aeb-step-num { background: #10B981; color: #fff; }
        .aeb-step-info { display: flex; flex-direction: column; }
        .aeb-step-label { font-size: 13px; font-weight: 600; color: #1E293B; line-height: 1; }
        .aeb-step.pending .aeb-step-label { color: #94A3B8; }
        .aeb-step-desc { font-size: 10.5px; color: #94A3B8; margin-top: 2px; }

        /* Body */
        .aeb-body { padding: 28px 32px; background: #FAFAFA; }

        /* Field */
        .aeb-field { margin-bottom: 18px; }
        .aeb-field:last-child { margin-bottom: 0; }
        .aeb-label {
          display: flex; align-items: center; gap: 6px;
          font-size: 12.5px; font-weight: 600; color: #374151;
          margin-bottom: 7px; letter-spacing: 0.01em;
        }
        .aeb-label-req { color: #6366F1; font-size: 14px; line-height: 1; }
        .aeb-input-wrap { position: relative; }
        .aeb-input-icon {
          position: absolute; left: 13px; top: 50%; transform: translateY(-50%);
          color: #9CA3AF; pointer-events: none;
          display: flex; align-items: center;
          transition: color 0.15s;
        }
        .aeb-input {
          width: 100%; height: 44px;
          padding: 0 14px 0 40px;
          background: #fff;
          border: 1.5px solid #E5E7EB;
          border-radius: 10px;
          font-size: 14px; font-family: 'DM Sans', sans-serif;
          color: #111827;
          transition: border-color 0.15s, box-shadow 0.15s;
          outline: none;
        }
        .aeb-input:focus {
          border-color: #6366F1;
          box-shadow: 0 0 0 3px rgba(99,102,241,0.1);
        }
        .aeb-input:focus + .aeb-input-icon-after,
        .aeb-input-wrap:focus-within .aeb-input-icon { color: #6366F1; }
        .aeb-input.error { border-color: #EF4444; }
        .aeb-input.error:focus { box-shadow: 0 0 0 3px rgba(239,68,68,0.1); }
        .aeb-input.no-icon { padding-left: 14px; }
        .aeb-field-err {
          display: flex; align-items: center; gap: 5px;
          font-size: 11.5px; color: #EF4444; margin-top: 5px;
        }
        .aeb-grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }

        .aeb-select {
          width: 100%; height: 44px;
          padding: 0 14px;
          background: #fff;
          border: 1.5px solid #E5E7EB;
          border-radius: 10px;
          font-size: 14px; font-family: 'DM Sans', sans-serif;
          color: #111827;
          appearance: none;
          cursor: pointer;
          transition: border-color 0.15s, box-shadow 0.15s;
          outline: none;
        }
        .aeb-select:focus {
          border-color: #6366F1;
          box-shadow: 0 0 0 3px rgba(99,102,241,0.1);
        }

        /* Role cards */
        .aeb-role-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .aeb-role-card {
          padding: 14px 16px;
          border: 2px solid #E5E7EB;
          border-radius: 12px;
          cursor: pointer;
          background: #fff;
          transition: all 0.15s;
          display: flex; flex-direction: column; gap: 4px;
        }
        .aeb-role-card:hover { border-color: #C7D2FE; background: #F5F3FF; }
        .aeb-role-card.selected { border-color: #6366F1; background: #F5F3FF; }
        .aeb-role-card-icon {
          width: 32px; height: 32px; border-radius: 8px;
          display: flex; align-items: center; justify-content: center;
          margin-bottom: 4px;
        }
        .aeb-role-card.employee .aeb-role-card-icon { background: #EEF2FF; color: #6366F1; }
        .aeb-role-card.admin .aeb-role-card-icon { background: #FFF7ED; color: #EA580C; }
        .aeb-role-card.selected.admin { border-color: #EA580C; background: #FFF7ED; }
        .aeb-role-label { font-size: 13px; font-weight: 700; color: #1E293B; }
        .aeb-role-desc { font-size: 11px; color: #64748B; }

        /* Password strength */
        .aeb-pw-strength { margin-top: 6px; display: flex; gap: 4px; align-items: center; }
        .aeb-pw-bar {
          height: 3px; flex: 1; border-radius: 99px;
          background: #E5E7EB;
          transition: background 0.3s;
        }
        .aeb-pw-bar.fill-weak { background: #EF4444; }
        .aeb-pw-bar.fill-ok { background: #F59E0B; }
        .aeb-pw-bar.fill-good { background: #10B981; }
        .aeb-pw-label { font-size: 11px; color: #64748B; min-width: 36px; text-align: right; }

        /* Error banner */
        .aeb-error-banner {
          display: flex; align-items: flex-start; gap: 10px;
          background: #FEF2F2; border: 1px solid #FCA5A5;
          border-radius: 10px; padding: 12px 14px;
          font-size: 13px; color: #B91C1C; margin-bottom: 18px;
        }

        /* Footer */
        .aeb-footer {
          display: flex; align-items: center; gap: 10px;
          padding: 20px 32px;
          background: #fff;
          border-top: 1px solid #EEF2F7;
        }
        .aeb-btn-cancel {
          height: 42px; padding: 0 18px;
          border: 1.5px solid #E5E7EB; border-radius: 10px;
          font-size: 13.5px; font-weight: 600; font-family: 'DM Sans', sans-serif;
          color: #6B7280; background: #fff;
          cursor: pointer; transition: all 0.15s;
        }
        .aeb-btn-cancel:hover { border-color: #D1D5DB; color: #374151; background: #F9FAFB; }
        .aeb-btn-next {
          height: 42px; padding: 0 20px;
          border: none; border-radius: 10px;
          font-size: 13.5px; font-weight: 700; font-family: 'DM Sans', sans-serif;
          color: #fff;
          background: linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%);
          cursor: pointer; transition: all 0.15s;
          display: flex; align-items: center; gap: 6px; margin-left: auto;
          box-shadow: 0 2px 10px rgba(99,102,241,0.35);
        }
        .aeb-btn-next:hover { box-shadow: 0 4px 16px rgba(99,102,241,0.45); transform: translateY(-1px); }
        .aeb-btn-next:disabled { opacity: 0.5; cursor: not-allowed; transform: none; box-shadow: none; }
        .aeb-btn-back {
          height: 42px; padding: 0 16px;
          border: 1.5px solid #E5E7EB; border-radius: 10px;
          font-size: 13.5px; font-weight: 600; font-family: 'DM Sans', sans-serif;
          color: #6B7280; background: #fff;
          cursor: pointer; transition: all 0.15s; display: flex; align-items: center; gap: 5px;
        }
        .aeb-btn-back:hover { border-color: #D1D5DB; color: #374151; }
        .aeb-btn-save {
          height: 42px; padding: 0 24px;
          border: none; border-radius: 10px;
          font-size: 13.5px; font-weight: 700; font-family: 'DM Sans', sans-serif;
          color: #fff;
          background: linear-gradient(135deg, #10B981 0%, #059669 100%);
          cursor: pointer; transition: all 0.15s;
          display: flex; align-items: center; gap: 7px; margin-left: auto;
          box-shadow: 0 2px 10px rgba(16,185,129,0.35);
        }
        .aeb-btn-save:hover { box-shadow: 0 4px 16px rgba(16,185,129,0.45); transform: translateY(-1px); }
        .aeb-btn-save:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

        .aeb-progress-hint {
          font-size: 11.5px; color: #94A3B8;
          padding: 0 32px 14px;
          background: #FAFAFA;
        }
      `}</style>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {!open && (
        <button
          onClick={() => setOpen(true)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            height: 40,
            padding: "0 18px",
            background: "linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)",
            border: "none",
            borderRadius: 10,
            cursor: "pointer",
            color: "#fff",
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 13.5,
            fontWeight: 700,
            boxShadow: "0 2px 10px rgba(99,102,241,0.35)",
            transition: "all 0.15s",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.transform =
              "translateY(-1px)";
            (e.currentTarget as HTMLButtonElement).style.boxShadow =
              "0 4px 18px rgba(99,102,241,0.45)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.transform = "";
            (e.currentTarget as HTMLButtonElement).style.boxShadow =
              "0 2px 10px rgba(99,102,241,0.35)";
          }}
        >
          <Plus size={15} strokeWidth={2.5} />
          Tambah Karyawan
        </button>
      )}

      {open && (
        <div
          className="aeb-backdrop"
          onClick={(e) => e.target === e.currentTarget && close()}
        >
          <div className="aeb-modal">
            {/* Header */}
            <div className="aeb-header">
              <div className="aeb-header-accent" />
              <div className="aeb-header-badge">
                <User size={10} />
                Karyawan Baru
              </div>
              <h2 className="aeb-header-title">Tambah Karyawan</h2>
              <p className="aeb-header-sub">
                Isi data karyawan dalam 3 langkah mudah
              </p>
              <button className="aeb-close" onClick={close}>
                <X size={15} />
              </button>
            </div>

            {/* Stepper */}
            <div className="aeb-stepper">
              {STEPS.map((s) => (
                <div
                  key={s.id}
                  className={`aeb-step ${step === s.id ? "active" : step > s.id ? "done" : "pending"}`}
                >
                  <div className="aeb-step-num">
                    {step > s.id ? (
                      <CheckCircle2 size={15} strokeWidth={2.5} />
                    ) : (
                      s.id
                    )}
                  </div>
                  <div className="aeb-step-info">
                    <span className="aeb-step-label">{s.label}</span>
                    <span className="aeb-step-desc">{s.desc}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Body */}
            <div className="aeb-body">
              {error && (
                <div className="aeb-error-banner">
                  <X size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                  {error}
                </div>
              )}

              {step === 1 && (
                <>
                  <div className="aeb-field">
                    <label className="aeb-label">
                      Nama Lengkap <span className="aeb-label-req">*</span>
                    </label>
                    <div className="aeb-input-wrap">
                      <span className="aeb-input-icon">
                        <User size={15} />
                      </span>
                      <input
                        className={`aeb-input${fieldErrors.name ? " error" : ""}`}
                        placeholder="Contoh: Budi Santoso"
                        value={formData.name}
                        onChange={(e) => set("name", e.target.value)}
                        onBlur={() => blur("name")}
                      />
                    </div>
                    {fieldErrors.name && (
                      <div className="aeb-field-err">
                        <X size={11} />
                        {fieldErrors.name}
                      </div>
                    )}
                  </div>

                  <div className="aeb-field">
                    <label className="aeb-label">
                      Email <span className="aeb-label-req">*</span>
                    </label>
                    <div className="aeb-input-wrap">
                      <span className="aeb-input-icon">
                        <Mail size={15} />
                      </span>
                      <input
                        className={`aeb-input${fieldErrors.email ? " error" : ""}`}
                        type="email"
                        placeholder="email@perusahaan.com"
                        value={formData.email}
                        onChange={(e) => set("email", e.target.value)}
                        onBlur={() => blur("email")}
                      />
                    </div>
                    {fieldErrors.email && (
                      <div className="aeb-field-err">
                        <X size={11} />
                        {fieldErrors.email}
                      </div>
                    )}
                  </div>

                  <div className="aeb-field">
                    <label className="aeb-label">
                      Password <span className="aeb-label-req">*</span>
                    </label>
                    <div className="aeb-input-wrap">
                      <span className="aeb-input-icon">
                        <Lock size={15} />
                      </span>
                      <input
                        className={`aeb-input${fieldErrors.password ? " error" : ""}`}
                        type="password"
                        placeholder="Minimal 6 karakter"
                        value={formData.password}
                        onChange={(e) => set("password", e.target.value)}
                        onBlur={() => blur("password")}
                      />
                    </div>
                    {formData.password.length > 0 && (
                      <div className="aeb-pw-strength">
                        {[1, 2, 3].map((i) => (
                          <div
                            key={i}
                            className={`aeb-pw-bar ${
                              formData.password.length >= 10
                                ? "fill-good"
                                : formData.password.length >= 6
                                  ? i <= 2
                                    ? "fill-ok"
                                    : ""
                                  : i === 1
                                    ? "fill-weak"
                                    : ""
                            }`}
                          />
                        ))}
                        <span className="aeb-pw-label">
                          {formData.password.length >= 10
                            ? "Kuat"
                            : formData.password.length >= 6
                              ? "Sedang"
                              : "Lemah"}
                        </span>
                      </div>
                    )}
                    {fieldErrors.password && (
                      <div className="aeb-field-err">
                        <X size={11} />
                        {fieldErrors.password}
                      </div>
                    )}
                  </div>
                </>
              )}

              {step === 2 && (
                <>
                  <div className="aeb-grid2">
                    <div className="aeb-field">
                      <label className="aeb-label">
                        <Building2 size={13} />
                        Departemen
                      </label>
                      <div className="aeb-input-wrap">
                        <input
                          className="aeb-input no-icon"
                          placeholder="Contoh: Produksi"
                          value={formData.department}
                          onChange={(e) => set("department", e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="aeb-field">
                      <label className="aeb-label">
                        <Briefcase size={13} />
                        Jabatan
                      </label>
                      <div className="aeb-input-wrap">
                        <input
                          className="aeb-input no-icon"
                          placeholder="Contoh: Staff"
                          value={formData.position}
                          onChange={(e) => set("position", e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="aeb-field">
                    <label className="aeb-label">
                      <Phone size={13} />
                      No. Telepon
                    </label>
                    <div className="aeb-input-wrap">
                      <span className="aeb-input-icon">
                        <Phone size={15} />
                      </span>
                      <input
                        className="aeb-input"
                        placeholder="08xx-xxxx-xxxx"
                        value={formData.phone}
                        onChange={(e) => set("phone", e.target.value)}
                      />
                    </div>
                  </div>
                </>
              )}

              {step === 3 && (
                <div className="aeb-field">
                  <label className="aeb-label">
                    <Shield size={13} />
                    Level Akses
                  </label>
                  <div className="aeb-role-grid">
                    {[
                      {
                        value: "employee",
                        label: "Karyawan",
                        desc: "Absensi & profil diri",
                        icon: <User size={16} />,
                      },
                      {
                        value: "admin",
                        label: "Admin",
                        desc: "Akses penuh ke sistem",
                        icon: <Shield size={16} />,
                      },
                    ].map((r) => (
                      <div
                        key={r.value}
                        className={`aeb-role-card ${r.value} ${formData.role === r.value ? "selected" : ""}`}
                        onClick={() => set("role", r.value)}
                      >
                        <div className="aeb-role-card-icon">{r.icon}</div>
                        <span className="aeb-role-label">{r.label}</span>
                        <span className="aeb-role-desc">{r.desc}</span>
                        {formData.role === r.value && (
                          <CheckCircle2
                            size={14}
                            style={{
                              color: "#6366F1",
                              marginTop: 4,
                              alignSelf: "flex-end",
                            }}
                          />
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Summary */}
                  <div
                    style={{
                      marginTop: 20,
                      background: "#F8FAFC",
                      border: "1px solid #E2E8F0",
                      borderRadius: 12,
                      padding: "16px 18px",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: "#94A3B8",
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        marginBottom: 12,
                      }}
                    >
                      Ringkasan
                    </div>
                    {[
                      { label: "Nama", value: formData.name },
                      { label: "Email", value: formData.email },
                      {
                        label: "Departemen",
                        value: formData.department || "—",
                      },
                      { label: "Jabatan", value: formData.position || "—" },
                    ].map((row) => (
                      <div
                        key={row.label}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          fontSize: 13,
                          marginBottom: 8,
                        }}
                      >
                        <span style={{ color: "#64748B" }}>{row.label}</span>
                        <span style={{ color: "#1E293B", fontWeight: 600 }}>
                          {row.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="aeb-progress-hint">
              Langkah {step} dari {STEPS.length}
            </div>

            {/* Footer */}
            <div className="aeb-footer">
              {step > 1 ? (
                <button
                  className="aeb-btn-back"
                  onClick={() => setStep(step - 1)}
                >
                  ← Kembali
                </button>
              ) : (
                <button className="aeb-btn-cancel" onClick={close}>
                  Batal
                </button>
              )}

              {step < 3 ? (
                <button
                  className="aeb-btn-next"
                  onClick={() => setStep(step + 1)}
                  disabled={!stepValid()}
                >
                  Lanjut <ChevronRight size={15} />
                </button>
              ) : (
                <button
                  className="aeb-btn-save"
                  onClick={handleSubmit}
                  disabled={loading}
                >
                  {loading ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <CheckCircle2 size={15} />
                  )}
                  {loading ? "Menyimpan..." : "Simpan Karyawan"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
