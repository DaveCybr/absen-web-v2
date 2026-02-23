"use client";

import { useState, useMemo } from "react";
import { EmployeeActions } from "./employee-actions";
import type { Employee } from "@/types";
import {
  Search,
  Fingerprint,
  Shield,
  Users,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Filter,
} from "lucide-react";

interface EmployeeTableProps {
  employees: Employee[];
}

const DEPT_COLORS: Record<string, { bg: string; fg: string }> = {
  Engineering: { bg: "rgba(37,99,235,0.08)", fg: "#1D4ED8" },
  HR: { bg: "rgba(22,163,74,0.08)", fg: "#15803D" },
  Finance: { bg: "rgba(217,119,6,0.08)", fg: "#B45309" },
  Marketing: { bg: "rgba(124,58,237,0.08)", fg: "#6D28D9" },
  Operations: { bg: "rgba(220,38,38,0.08)", fg: "#B91C1C" },
  IT: { bg: "rgba(6,182,212,0.08)", fg: "#0E7490" },
};

const AVATAR_COLORS = [
  { bg: "rgba(37,99,235,0.12)", fg: "#1D4ED8" },
  { bg: "rgba(22,163,74,0.12)", fg: "#15803D" },
  { bg: "rgba(124,58,237,0.12)", fg: "#6D28D9" },
  { bg: "rgba(217,119,6,0.12)", fg: "#B45309" },
  { bg: "rgba(220,38,38,0.12)", fg: "#B91C1C" },
  { bg: "rgba(6,182,212,0.12)", fg: "#0E7490" },
];

function getAvatarColor(name: string) {
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
}

function getDeptStyle(dept: string | null) {
  if (!dept) return null;
  return DEPT_COLORS[dept] || { bg: "rgba(100,116,139,0.08)", fg: "#475569" };
}

export function EmployeeTable({ employees }: EmployeeTableProps) {
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState<"all" | "admin" | "employee">(
    "all",
  );
  const [filterStatus, setFilterStatus] = useState<
    "all" | "active" | "inactive"
  >("all");
  const [filterFace, setFilterFace] = useState<
    "all" | "registered" | "unregistered"
  >("all");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return employees.filter((e) => {
      const matchSearch =
        !q ||
        e.name.toLowerCase().includes(q) ||
        e.email.toLowerCase().includes(q) ||
        (e.department || "").toLowerCase().includes(q) ||
        (e.position || "").toLowerCase().includes(q);
      const matchRole = filterRole === "all" || e.role === filterRole;
      const matchStatus =
        filterStatus === "all" ||
        (filterStatus === "active" ? e.is_active : !e.is_active);
      const matchFace =
        filterFace === "all" ||
        (filterFace === "registered" ? !!e.face_image_url : !e.face_image_url);
      return matchSearch && matchRole && matchStatus && matchFace;
    });
  }, [employees, search, filterRole, filterStatus, filterFace]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const resetPage = () => setPage(1);

  const hasFilter =
    filterRole !== "all" ||
    filterStatus !== "all" ||
    filterFace !== "all" ||
    search;

  return (
    <>
      <style>{`
        /* ── Toolbar ── */
        .et-toolbar {
          padding: 14px 20px; border-bottom: 1px solid var(--border);
          display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
        }
        .et-search-wrap { position: relative; flex: 1; min-width: 200px; max-width: 300px; }
        .et-search-ico {
          position: absolute; left: 11px; top: 50%; transform: translateY(-50%);
          color: var(--text-3); pointer-events: none;
        }
        .et-search {
          width: 100%; padding: 8px 12px 8px 34px;
          background: var(--surface-2); border: 1.5px solid var(--border);
          border-radius: var(--r-md); font-size: 13.5px; color: var(--text-1);
          font-family: 'Plus Jakarta Sans', sans-serif; outline: none;
          transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
        }
        .et-search:focus {
          border-color: var(--blue-400); background: var(--surface);
          box-shadow: 0 0 0 3px var(--blue-glow);
        }
        .et-search::placeholder { color: var(--text-3); }

        .et-filters { display: flex; gap: 6px; flex-wrap: wrap; }
        .et-sel {
          padding: 7px 28px 7px 10px; border-radius: var(--r-md);
          border: 1.5px solid var(--border); background: var(--surface);
          font-size: 12.5px; font-weight: 500; color: var(--text-2);
          font-family: 'Plus Jakarta Sans', sans-serif; appearance: none; outline: none; cursor: pointer;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394A3B8' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
          background-repeat: no-repeat; background-position: right 8px center;
          transition: border-color 0.13s, background 0.13s;
        }
        .et-sel:focus { border-color: var(--blue-400); box-shadow: 0 0 0 3px var(--blue-glow); }
        .et-sel.active { border-color: var(--blue-400); color: var(--blue-400); background-color: rgba(59,130,246,0.05); }

        .et-clear {
          padding: 7px 12px; border-radius: var(--r-md);
          border: 1.5px solid var(--border); background: var(--surface);
          font-size: 12px; font-weight: 500; color: var(--text-3);
          font-family: 'Plus Jakarta Sans', sans-serif; cursor: pointer;
          transition: all 0.13s;
        }
        .et-clear:hover { border-color: var(--red); color: var(--red); background: var(--red-bg); }

        .et-count {
          margin-left: auto; font-size: 12px; color: var(--text-3);
          display: flex; align-items: center; gap: 5px; white-space: nowrap;
        }

        /* ── Table ── */
        .et-scroll { overflow-x: auto; }
        .et-table { width: 100%; border-collapse: collapse; }
        .et-table thead { background: var(--surface-2); }
        .et-table th {
          padding: 10px 16px; font-size: 10.5px; font-weight: 700;
          color: var(--text-3); text-transform: uppercase; letter-spacing: 0.08em;
          text-align: left; border-bottom: 1px solid var(--border); white-space: nowrap;
        }
        .et-table td { padding: 13px 16px; border-bottom: 1px solid var(--border); vertical-align: middle; }
        .et-table tr:last-child td { border-bottom: none; }
        .et-table tbody tr { transition: background 0.1s; }
        .et-table tbody tr:hover td { background: var(--surface-2); }

        /* Employee cell */
        .et-emp { display: flex; align-items: center; gap: 11px; }
        .et-avatar {
          width: 38px; height: 38px; border-radius: var(--r-md);
          display: flex; align-items: center; justify-content: center;
          font-size: 14px; font-weight: 800; flex-shrink: 0;
        }
        .et-name { font-size: 13.5px; font-weight: 600; color: var(--text-1); margin: 0; line-height: 1.3; }
        .et-email { font-size: 11.5px; color: var(--text-3); margin: 0; }

        /* Dept chip */
        .et-dept {
          display: inline-flex; padding: 3px 9px; border-radius: var(--r-sm);
          font-size: 12px; font-weight: 600; white-space: nowrap;
        }
        .et-pos { font-size: 11.5px; color: var(--text-3); margin-top: 3px; }

        /* Role */
        .et-role {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 4px 10px; border-radius: 999px; font-size: 11.5px; font-weight: 600;
        }
        .et-role-admin { background: rgba(217,119,6,0.09); color: #B45309; border: 1px solid rgba(217,119,6,0.2); }
        .et-role-emp   { background: var(--surface-2); color: var(--text-2); border: 1px solid var(--border); }

        /* Face */
        .et-face {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 4px 9px; border-radius: 999px; font-size: 11.5px; font-weight: 600;
        }
        .et-face-ok { background: rgba(124,58,237,0.08); color: #6D28D9; border: 1px solid rgba(124,58,237,0.18); }
        .et-face-no { background: var(--surface-2); color: var(--text-3); border: 1px solid var(--border); }

        /* Status */
        .et-status {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 4px 9px; border-radius: 999px; font-size: 11.5px; font-weight: 600;
        }
        .et-status-ok  { background: var(--green-bg);  color: var(--green);  border: 1px solid var(--green-border); }
        .et-status-off { background: var(--red-bg);    color: var(--red);    border: 1px solid var(--red-border); }
        .et-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }

        /* Empty */
        .et-empty { padding: 56px 24px; text-align: center; }
        .et-empty-ico {
          width: 56px; height: 56px; border-radius: var(--r-lg);
          background: var(--surface-2); border: 1px solid var(--border);
          display: flex; align-items: center; justify-content: center; margin: 0 auto 14px;
        }
        .et-empty-title { font-size: 14px; font-weight: 600; color: var(--text-2); margin-bottom: 6px; }
        .et-empty-desc  { font-size: 13px; color: var(--text-3); }

        /* Pagination */
        .et-pag {
          display: flex; align-items: center; justify-content: space-between;
          padding: 13px 20px; border-top: 1px solid var(--border); gap: 12px; flex-wrap: wrap;
        }
        .et-pag-info { font-size: 12.5px; color: var(--text-2); }
        .et-pag-btns { display: flex; gap: 4px; }
        .et-pag-btn {
          width: 32px; height: 32px; border-radius: var(--r-sm);
          border: 1.5px solid var(--border); background: var(--surface);
          font-size: 12.5px; font-weight: 500; color: var(--text-2);
          cursor: pointer; display: flex; align-items: center; justify-content: center;
          transition: background 0.13s, border-color 0.13s, color 0.13s;
          font-family: 'Plus Jakarta Sans', sans-serif;
        }
        .et-pag-btn:hover:not(:disabled) {
          background: var(--surface-2); border-color: var(--border-2); color: var(--text-1);
        }
        .et-pag-btn:disabled { opacity: 0.35; cursor: not-allowed; }
        .et-pag-cur {
          height: 32px; padding: 0 12px; border-radius: var(--r-sm);
          background: var(--navy-800); color: white; border: none;
          font-size: 12px; font-weight: 600;
          display: flex; align-items: center; justify-content: center; white-space: nowrap;
          font-family: 'Plus Jakarta Sans', sans-serif;
        }
      `}</style>

      {/* Toolbar */}
      <div className="et-toolbar">
        <div className="et-search-wrap">
          <span className="et-search-ico">
            <Search size={14} />
          </span>
          <input
            className="et-search"
            placeholder="Cari nama, email, departemen..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              resetPage();
            }}
          />
        </div>

        <div className="et-filters">
          <select
            className={`et-sel${filterRole !== "all" ? " active" : ""}`}
            value={filterRole}
            onChange={(e) => {
              setFilterRole(e.target.value as typeof filterRole);
              resetPage();
            }}
          >
            <option value="all">Semua Role</option>
            <option value="employee">Karyawan</option>
            <option value="admin">Admin</option>
          </select>

          <select
            className={`et-sel${filterStatus !== "all" ? " active" : ""}`}
            value={filterStatus}
            onChange={(e) => {
              setFilterStatus(e.target.value as typeof filterStatus);
              resetPage();
            }}
          >
            <option value="all">Semua Status</option>
            <option value="active">Aktif</option>
            <option value="inactive">Nonaktif</option>
          </select>

          <select
            className={`et-sel${filterFace !== "all" ? " active" : ""}`}
            value={filterFace}
            onChange={(e) => {
              setFilterFace(e.target.value as typeof filterFace);
              resetPage();
            }}
          >
            <option value="all">Semua Wajah</option>
            <option value="registered">Sudah Daftar</option>
            <option value="unregistered">Belum Daftar</option>
          </select>

          {hasFilter && (
            <button
              className="et-clear"
              onClick={() => {
                setSearch("");
                setFilterRole("all");
                setFilterStatus("all");
                setFilterFace("all");
                resetPage();
              }}
            >
              Reset
            </button>
          )}
        </div>

        <div className="et-count">
          <Users size={13} />
          {filtered.length} karyawan
        </div>
      </div>

      {/* Table */}
      <div className="et-scroll">
        {paginated.length === 0 ? (
          <div className="et-empty">
            <div className="et-empty-ico">
              <Users size={22} color="var(--text-3)" />
            </div>
            <p className="et-empty-title">
              {hasFilter ? "Tidak ada hasil yang cocok" : "Belum ada karyawan"}
            </p>
            <p className="et-empty-desc">
              {hasFilter
                ? "Coba ubah filter atau kata kunci pencarian"
                : "Tambah karyawan menggunakan tombol di atas"}
            </p>
          </div>
        ) : (
          <table className="et-table">
            <thead>
              <tr>
                <th>Karyawan</th>
                <th>Departemen & Jabatan</th>
                <th>Role</th>
                <th>Wajah</th>
                <th>Status</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((emp) => {
                const av = getAvatarColor(emp.name);
                const dept = getDeptStyle(emp.department);
                return (
                  <tr key={emp.id}>
                    <td>
                      <div className="et-emp">
                        <div
                          className="et-avatar"
                          style={{ background: av.bg, color: av.fg }}
                        >
                          {emp.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="et-name">{emp.name}</p>
                          <p className="et-email">{emp.email}</p>
                        </div>
                      </div>
                    </td>
                    <td>
                      {dept ? (
                        <span
                          className="et-dept"
                          style={{ background: dept.bg, color: dept.fg }}
                        >
                          {emp.department}
                        </span>
                      ) : (
                        <span style={{ fontSize: 12, color: "var(--text-3)" }}>
                          —
                        </span>
                      )}
                      {emp.position && (
                        <div className="et-pos">{emp.position}</div>
                      )}
                    </td>
                    <td>
                      {emp.role === "admin" ? (
                        <span className="et-role et-role-admin">
                          <Shield size={11} strokeWidth={2} /> Admin
                        </span>
                      ) : (
                        <span className="et-role et-role-emp">
                          <Users size={11} strokeWidth={2} /> Karyawan
                        </span>
                      )}
                    </td>
                    <td>
                      {emp.face_image_url ? (
                        <span className="et-face et-face-ok">
                          <span
                            className="et-dot"
                            style={{ background: "#7C3AED" }}
                          />
                          <Fingerprint size={11} /> Terdaftar
                        </span>
                      ) : (
                        <span className="et-face et-face-no">
                          <span
                            className="et-dot"
                            style={{ background: "var(--text-3)" }}
                          />
                          Belum
                        </span>
                      )}
                    </td>
                    <td>
                      {emp.is_active ? (
                        <span className="et-status et-status-ok">
                          <span
                            className="et-dot"
                            style={{ background: "#22C55E" }}
                          />{" "}
                          Aktif
                        </span>
                      ) : (
                        <span className="et-status et-status-off">
                          <span
                            className="et-dot"
                            style={{ background: "#EF4444" }}
                          />{" "}
                          Nonaktif
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <EmployeeActions employee={emp} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {filtered.length > PAGE_SIZE && (
        <div className="et-pag">
          <span className="et-pag-info">
            {(page - 1) * PAGE_SIZE + 1}–
            {Math.min(page * PAGE_SIZE, filtered.length)} dari {filtered.length}{" "}
            karyawan
          </span>
          <div className="et-pag-btns">
            <button
              className="et-pag-btn"
              onClick={() => setPage(1)}
              disabled={page === 1}
              title="Halaman pertama"
            >
              <ChevronsLeft size={14} />
            </button>
            <button
              className="et-pag-btn"
              onClick={() => setPage((p) => p - 1)}
              disabled={page === 1}
              title="Sebelumnya"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="et-pag-cur">
              {page} / {totalPages}
            </span>
            <button
              className="et-pag-btn"
              onClick={() => setPage((p) => p + 1)}
              disabled={page === totalPages}
              title="Berikutnya"
            >
              <ChevronRight size={14} />
            </button>
            <button
              className="et-pag-btn"
              onClick={() => setPage(totalPages)}
              disabled={page === totalPages}
              title="Halaman terakhir"
            >
              <ChevronsRight size={14} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
