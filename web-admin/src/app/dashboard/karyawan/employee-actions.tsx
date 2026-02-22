"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Toast } from "@/components/ui/toast";
import { MoreHorizontal, Pencil, Trash2, X } from "lucide-react";
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

      if (spaceBelow < 100) {
        setMenuStyle({
          position: "fixed",
          top: rect.top - 80,
          left: rect.right - 144,
          zIndex: 9999,
        });
      } else {
        setMenuStyle({
          position: "fixed",
          top: rect.bottom + 4,
          left: rect.right - 144,
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
      const response = await fetch(`/api/employees/${employee.id}`, {
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

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Gagal memperbarui karyawan");
      }

      setShowEdit(false);
      setToast({ message: "Karyawan berhasil diperbarui", type: "success" });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan");
      setToast({
        message: err instanceof Error ? err.message : "Terjadi kesalahan",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/employees/${employee.id}`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Gagal menghapus karyawan");
      }

      setShowDelete(false);
      setToast({ message: "Karyawan berhasil dihapus", type: "success" });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan");
      setToast({
        message: err instanceof Error ? err.message : "Terjadi kesalahan",
        type: "error",
      });
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
        className="w-36 rounded-md border bg-white py-1 shadow-lg"
        style={menuStyle}
      >
        <button
          className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100"
          onClick={() => {
            setShowMenu(false);
            setShowEdit(true);
          }}
        >
          <Pencil className="h-4 w-4" />
          Edit
        </button>
        <button
          className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-gray-100"
          onClick={() => {
            setShowMenu(false);
            setShowDelete(true);
          }}
        >
          <Trash2 className="h-4 w-4" />
          Hapus
        </button>
      </div>
    </>
  );

  return (
    <>
      <Button
        ref={buttonRef}
        variant="ghost"
        size="icon"
        onClick={() => setShowMenu(!showMenu)}
      >
        <MoreHorizontal className="h-4 w-4" />
      </Button>

      {showMenu && mounted && createPortal(<DropdownMenu />, document.body)}

      {/* Toast */}
      {toast && mounted && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Edit Modal */}
      {showEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Edit Karyawan</h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowEdit(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <form onSubmit={handleUpdate} className="space-y-4">
              {error && (
                <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">
                  {error}
                </div>
              )}

              <div>
                <Label htmlFor="edit-name" required>
                  Nama Lengkap
                </Label>
                <Input
                  id="edit-name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  required
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="edit-email">Email</Label>
                <Input
                  id="edit-email"
                  value={formData.email}
                  disabled
                  className="mt-1"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Email tidak dapat diubah
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-department">Departemen</Label>
                  <Input
                    id="edit-department"
                    value={formData.department}
                    onChange={(e) =>
                      setFormData({ ...formData, department: e.target.value })
                    }
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="edit-position">Jabatan</Label>
                  <Input
                    id="edit-position"
                    value={formData.position}
                    onChange={(e) =>
                      setFormData({ ...formData, position: e.target.value })
                    }
                    className="mt-1"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="edit-phone">No. Telepon</Label>
                <Input
                  id="edit-phone"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                  className="mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-role">Role</Label>
                  <Select
                    id="edit-role"
                    value={formData.role}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        role: e.target.value as "admin" | "employee",
                      })
                    }
                    className="mt-1"
                  >
                    <option value="employee">Karyawan</option>
                    <option value="admin">Admin</option>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="edit-status">Status</Label>
                  <Select
                    id="edit-status"
                    value={formData.is_active ? "active" : "inactive"}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        is_active: e.target.value === "active",
                      })
                    }
                    className="mt-1"
                  >
                    <option value="active">Aktif</option>
                    <option value="inactive">Nonaktif</option>
                  </Select>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowEdit(false)}
                >
                  Batal
                </Button>
                <Button type="submit" className="flex-1" loading={loading}>
                  Simpan
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {showDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold">Hapus Karyawan</h2>
            <p className="mt-2 text-gray-600">
              Apakah Anda yakin ingin menghapus <strong>{employee.name}</strong>
              ? Tindakan ini tidak dapat dibatalkan.
            </p>

            {error && (
              <div className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-600">
                {error}
              </div>
            )}

            <div className="mt-6 flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowDelete(false)}
              >
                Batal
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={handleDelete}
                loading={loading}
              >
                Hapus
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
