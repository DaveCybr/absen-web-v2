"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Toast } from "@/components/ui/toast";
import {
  MoreHorizontal,
  Pencil,
  Trash2,
  X,
  User,
  Phone,
  Building2,
  Briefcase,
  Shield,
  CheckCircle2,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import type { Employee } from "@/types";

interface EmployeeActionsProps {
  employee: Employee;
}

export function EmployeeActions({ employee }: EmployeeActionsProps) {
  const router = useRouter();
  const buttonRef = useRef<HTMLButtonElement>(null);

  const [showMenu, setShowMenu] = useState(false);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  const [formData, setFormData] = useState({
    name: employee.name,
    email: employee.email,
    phone: employee.phone || "",
    department: employee.department || "",
    position: employee.position || "",
    role: employee.role,
    is_active: employee.is_active,
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (showMenu && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      if (spaceBelow < 110) {
        setMenuStyle({
          position: "fixed",
          top: rect.top - 90,
          left: rect.right - 160,
          zIndex: 9999,
        });
      } else {
        setMenuStyle({
          position: "fixed",
          top: rect.bottom + 6,
          left: rect.right - 160,
          zIndex: 9999,
        });
      }
    }
  }, [showMenu]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/employees/${employee.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          phone: formData.phone || null,
          department: formData.department || null,
          position: formData.position || null,
          role: formData.role,
          is_active: formData.is_active,
        }),
      });
      const result = await res.json();
      if (!res.ok)
        throw new Error(result.error || "Gagal memperbarui karyawan");
      setShowEdit(false);
      setToast({ message: "Perubahan berhasil disimpan", type: "success" });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/employees/${employee.id}`, {
        method: "DELETE",
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Gagal menghapus karyawan");
      setShowDelete(false);
      setToast({ message: "Karyawan berhasil dihapus", type: "success" });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  };

  const DropdownMenu = () => (
    <>
      <div
        className="fixed inset-0"
        style={{ zIndex: 9998 }}
        onClick={() => setShowMenu(false)}
      />
      <div
        style={{
          ...menuStyle,
          width: 160,
          borderRadius: 12,
          border: "1px solid #E5E7EB",
          background: "#fff",
          boxShadow: "0 10px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)",
          overflow: "hidden",
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        <div style={{ padding: "4px" }}>
          <button
            style={{
              display: "flex",
              alignItems: "center",
              gap: 9,
              width: "100%",
              padding: "9px 12px",
              borderRadius: 8,
              border: "none",
              background: "transparent",
              fontSize: 13.5,
              fontWeight: 500,
              color: "#374151",
              cursor: "pointer",
              fontFamily: "inherit",
              transition: "background 0.12s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#F3F4F6")}
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = "transparent")
            }
            onClick={() => {
              setShowMenu(false);
              setShowEdit(true);
            }}
          >
            <Pencil size={14} style={{ color: "#6366F1" }} /> Edit Karyawan
          </button>
          <div style={{ height: 1, background: "#F3F4F6", margin: "3px 0" }} />
          <button
            style={{
              display: "flex",
              alignItems: "center",
              gap: 9,
              width: "100%",
              padding: "9px 12px",
              borderRadius: 8,
              border: "none",
              background: "transparent",
              fontSize: 13.5,
              fontWeight: 500,
              color: "#EF4444",
              cursor: "pointer",
              fontFamily: "inherit",
              transition: "background 0.12s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#FEF2F2")}
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = "transparent")
            }
            onClick={() => {
              setShowMenu(false);
              setShowDelete(true);
            }}
          >
            <Trash2 size={14} /> Hapus
          </button>
        </div>
      </div>
    </>
  );

  const inputStyle: React.CSSProperties = {
    width: "100%",
    height: 42,
    padding: "0 13px",
    background: "#fff",
    border: "1.5px solid #E5E7EB",
    borderRadius: 9,
    fontSize: 13.5,
    fontFamily: "'DM Sans', sans-serif",
    color: "#111827",
    outline: "none",
    transition: "border-color 0.15s, box-shadow 0.15s",
    boxSizing: "border-box",
  };

  const labelStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontSize: 12,
    fontWeight: 600,
    color: "#374151",
    marginBottom: 6,
    letterSpacing: "0.01em",
  };

  const fieldStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap');
        .ea-input:focus { border-color: #6366F1 !important; box-shadow: 0 0 0 3px rgba(99,102,241,0.1) !important; }
        .ea-select:focus { border-color: #6366F1 !important; box-shadow: 0 0 0 3px rgba(99,102,241,0.1) !important; }
        .ea-modal-anim { animation: ea-modal-in 0.25s cubic-bezier(0.34, 1.56, 0.64, 1); }
        @keyframes ea-modal-in {
          from { opacity: 0; transform: scale(0.96) translateY(12px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        .ea-status-toggle { display: flex; gap: 0; border: 1.5px solid #E5E7EB; border-radius: 9px; overflow: hidden; }
        .ea-status-opt {
          flex: 1; height: 38px; border: none; cursor: pointer;
          font-size: 13px; font-weight: 600; font-family: 'DM Sans', sans-serif;
          transition: all 0.15s;
        }
        .ea-status-opt.active-opt { background: #10B981; color: #fff; }
        .ea-status-opt.inactive-opt { background: #EF4444; color: #fff; }
        .ea-status-opt.unsel { background: transparent; color: #9CA3AF; }
        .ea-status-opt.unsel:hover { background: #F9FAFB; color: #374151; }
      `}</style>

      <button
        ref={buttonRef}
        style={{
          width: 32,
          height: 32,
          border: "1px solid #E5E7EB",
          borderRadius: 8,
          background: "#fff",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#6B7280",
          transition: "all 0.12s",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = "#F3F4F6";
          (e.currentTarget as HTMLButtonElement).style.borderColor = "#D1D5DB";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = "#fff";
          (e.currentTarget as HTMLButtonElement).style.borderColor = "#E5E7EB";
        }}
        onClick={() => setShowMenu(!showMenu)}
      >
        <MoreHorizontal size={15} />
      </button>

      {showMenu && mounted && createPortal(<DropdownMenu />, document.body)}
      {toast && mounted && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* ── Edit Modal ── */}
      {showEdit && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9050,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
            background: "rgba(8,10,16,0.7)",
            backdropFilter: "blur(6px)",
          }}
          onClick={(e) => e.target === e.currentTarget && setShowEdit(false)}
        >
          <div
            className="ea-modal-anim"
            style={{
              width: "100%",
              maxWidth: 520,
              background: "#FAFAFA",
              borderRadius: 20,
              boxShadow:
                "0 32px 80px rgba(0,0,0,0.2), 0 0 0 1px rgba(0,0,0,0.06)",
              overflow: "hidden",
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            {/* Header */}
            <div
              style={{
                background: "linear-gradient(135deg, #1E293B 0%, #0F172A 100%)",
                padding: "22px 28px 20px",
                position: "relative",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background:
                    "radial-gradient(ellipse at 80% 50%, rgba(99,102,241,0.2) 0%, transparent 70%)",
                  pointerEvents: "none",
                }}
              />
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    background: "rgba(99,102,241,0.2)",
                    border: "1px solid rgba(99,102,241,0.3)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Pencil size={17} color="#A5B4FC" />
                </div>
                <div>
                  <h2
                    style={{
                      margin: 0,
                      fontSize: 18,
                      fontWeight: 700,
                      color: "#fff",
                      letterSpacing: "-0.02em",
                    }}
                  >
                    Edit Karyawan
                  </h2>
                  <p
                    style={{
                      margin: "3px 0 0",
                      fontSize: 12.5,
                      color: "#94A3B8",
                    }}
                  >
                    {employee.name}
                  </p>
                </div>
              </div>
              <button
                style={{
                  position: "absolute",
                  top: 16,
                  right: 16,
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  color: "#94A3B8",
                }}
                onClick={() => setShowEdit(false)}
              >
                <X size={14} />
              </button>
            </div>

            <form onSubmit={handleUpdate}>
              <div
                style={{
                  padding: "24px 28px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 16,
                }}
              >
                {error && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 9,
                      background: "#FEF2F2",
                      border: "1px solid #FCA5A5",
                      borderRadius: 10,
                      padding: "11px 14px",
                      fontSize: 13,
                      color: "#B91C1C",
                    }}
                  >
                    <X size={14} style={{ flexShrink: 0 }} />
                    {error}
                  </div>
                )}

                <div style={fieldStyle}>
                  <label style={labelStyle}>
                    <User size={13} />
                    Nama Lengkap
                  </label>
                  <input
                    className="ea-input"
                    style={inputStyle}
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    required
                  />
                </div>

                <div style={fieldStyle}>
                  <label style={labelStyle}>
                    <User size={13} />
                    Email
                  </label>
                  <input
                    style={{
                      ...inputStyle,
                      background: "#F8FAFC",
                      color: "#6B7280",
                    }}
                    value={formData.email}
                    disabled
                  />
                  <p style={{ fontSize: 11, color: "#9CA3AF", marginTop: 4 }}>
                    Email tidak dapat diubah
                  </p>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 14,
                  }}
                >
                  <div style={fieldStyle}>
                    <label style={labelStyle}>
                      <Building2 size={13} />
                      Departemen
                    </label>
                    <input
                      className="ea-input"
                      style={inputStyle}
                      value={formData.department}
                      onChange={(e) =>
                        setFormData({ ...formData, department: e.target.value })
                      }
                      placeholder="—"
                    />
                  </div>
                  <div style={fieldStyle}>
                    <label style={labelStyle}>
                      <Briefcase size={13} />
                      Jabatan
                    </label>
                    <input
                      className="ea-input"
                      style={inputStyle}
                      value={formData.position}
                      onChange={(e) =>
                        setFormData({ ...formData, position: e.target.value })
                      }
                      placeholder="—"
                    />
                  </div>
                </div>

                <div style={fieldStyle}>
                  <label style={labelStyle}>
                    <Phone size={13} />
                    No. Telepon
                  </label>
                  <input
                    className="ea-input"
                    style={inputStyle}
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: e.target.value })
                    }
                    placeholder="08xx-xxxx-xxxx"
                  />
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 14,
                  }}
                >
                  <div style={fieldStyle}>
                    <label style={labelStyle}>
                      <Shield size={13} />
                      Role
                    </label>
                    <select
                      className="ea-select"
                      style={{
                        ...inputStyle,
                        appearance: "none" as const,
                        cursor: "pointer",
                      }}
                      value={formData.role}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          role: e.target.value as "admin" | "employee",
                        })
                      }
                    >
                      <option value="employee">Karyawan</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <div style={fieldStyle}>
                    <label style={labelStyle}>Status</label>
                    <div className="ea-status-toggle">
                      <button
                        type="button"
                        className={`ea-status-opt ${formData.is_active ? "active-opt" : "unsel"}`}
                        onClick={() =>
                          setFormData({ ...formData, is_active: true })
                        }
                      >
                        Aktif
                      </button>
                      <button
                        type="button"
                        className={`ea-status-opt ${!formData.is_active ? "inactive-opt" : "unsel"}`}
                        onClick={() =>
                          setFormData({ ...formData, is_active: false })
                        }
                      >
                        Nonaktif
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: 10,
                  padding: "16px 28px",
                  background: "#fff",
                  borderTop: "1px solid #EEF2F7",
                }}
              >
                <button
                  type="button"
                  style={{
                    height: 40,
                    padding: "0 18px",
                    border: "1.5px solid #E5E7EB",
                    borderRadius: 9,
                    background: "#fff",
                    fontSize: 13.5,
                    fontWeight: 600,
                    fontFamily: "'DM Sans', sans-serif",
                    color: "#6B7280",
                    cursor: "pointer",
                  }}
                  onClick={() => setShowEdit(false)}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    height: 40,
                    padding: "0 22px",
                    marginLeft: "auto",
                    border: "none",
                    borderRadius: 9,
                    background:
                      "linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)",
                    fontSize: 13.5,
                    fontWeight: 700,
                    fontFamily: "'DM Sans', sans-serif",
                    color: "#fff",
                    cursor: loading ? "not-allowed" : "pointer",
                    opacity: loading ? 0.7 : 1,
                    display: "flex",
                    alignItems: "center",
                    gap: 7,
                    boxShadow: "0 2px 10px rgba(99,102,241,0.3)",
                  }}
                >
                  {loading ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <CheckCircle2 size={14} />
                  )}
                  {loading ? "Menyimpan..." : "Simpan Perubahan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete Modal ── */}
      {showDelete && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9050,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
            background: "rgba(8,10,16,0.72)",
            backdropFilter: "blur(6px)",
          }}
          onClick={(e) => e.target === e.currentTarget && setShowDelete(false)}
        >
          <div
            className="ea-modal-anim"
            style={{
              width: "100%",
              maxWidth: 420,
              background: "#fff",
              borderRadius: 20,
              boxShadow: "0 32px 80px rgba(0,0,0,0.2)",
              overflow: "hidden",
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            <div
              style={{
                padding: "28px 28px 24px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: "50%",
                  background: "#FEF2F2",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 16,
                }}
              >
                <AlertTriangle size={26} color="#EF4444" />
              </div>
              <h2
                style={{
                  margin: "0 0 8px",
                  fontSize: 20,
                  fontWeight: 700,
                  color: "#111827",
                  letterSpacing: "-0.02em",
                }}
              >
                Hapus Karyawan?
              </h2>
              <p
                style={{
                  margin: 0,
                  fontSize: 13.5,
                  color: "#6B7280",
                  lineHeight: 1.6,
                }}
              >
                Data{" "}
                <strong style={{ color: "#111827" }}>{employee.name}</strong>{" "}
                akan dihapus secara permanen dan tidak dapat dikembalikan.
              </p>

              <div
                style={{
                  margin: "20px 0 0",
                  width: "100%",
                  background: "#FFF8F8",
                  border: "1px solid #FECACA",
                  borderRadius: 10,
                  padding: "14px 16px",
                  textAlign: "left",
                }}
              >
                <p
                  style={{
                    margin: "0 0 8px",
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#991B1B",
                  }}
                >
                  Ketik nama karyawan untuk konfirmasi:
                </p>
                <input
                  style={{ ...inputStyle, background: "#fff", fontSize: 13 }}
                  className="ea-input"
                  placeholder={employee.name}
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                />
              </div>

              {error && (
                <div
                  style={{
                    width: "100%",
                    marginTop: 12,
                    display: "flex",
                    alignItems: "center",
                    gap: 9,
                    background: "#FEF2F2",
                    border: "1px solid #FCA5A5",
                    borderRadius: 10,
                    padding: "11px 14px",
                    fontSize: 13,
                    color: "#B91C1C",
                  }}
                >
                  <X size={14} />
                  {error}
                </div>
              )}
            </div>

            <div
              style={{
                display: "flex",
                gap: 10,
                padding: "16px 24px",
                background: "#F9FAFB",
                borderTop: "1px solid #F3F4F6",
              }}
            >
              <button
                style={{
                  flex: 1,
                  height: 42,
                  border: "1.5px solid #E5E7EB",
                  borderRadius: 9,
                  background: "#fff",
                  fontSize: 13.5,
                  fontWeight: 600,
                  fontFamily: "'DM Sans', sans-serif",
                  color: "#6B7280",
                  cursor: "pointer",
                }}
                onClick={() => {
                  setShowDelete(false);
                  setDeleteConfirmText("");
                  setError("");
                }}
              >
                Batalkan
              </button>
              <button
                disabled={loading || deleteConfirmText !== employee.name}
                onClick={handleDelete}
                style={{
                  flex: 1,
                  height: 42,
                  border: "none",
                  borderRadius: 9,
                  background:
                    deleteConfirmText === employee.name
                      ? "linear-gradient(135deg, #EF4444 0%, #DC2626 100%)"
                      : "#E5E7EB",
                  fontSize: 13.5,
                  fontWeight: 700,
                  fontFamily: "'DM Sans', sans-serif",
                  color:
                    deleteConfirmText === employee.name ? "#fff" : "#9CA3AF",
                  cursor:
                    loading || deleteConfirmText !== employee.name
                      ? "not-allowed"
                      : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 7,
                  boxShadow:
                    deleteConfirmText === employee.name
                      ? "0 2px 10px rgba(239,68,68,0.35)"
                      : "none",
                  transition: "all 0.2s",
                }}
              >
                {loading ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Trash2 size={14} />
                )}
                {loading ? "Menghapus..." : "Hapus Sekarang"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
