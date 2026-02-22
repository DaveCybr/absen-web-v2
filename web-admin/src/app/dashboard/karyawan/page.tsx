import { createAdminClient } from "@/lib/supabase/admin";
import { AddEmployeeButton } from "./add-employee-button";
import { EmployeeTable } from "./employee-table";
import type { Employee } from "@/types";
import { Users, UserCheck, UserX, Fingerprint, Shield } from "lucide-react";

async function getEmployees(): Promise<Employee[]> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("employees")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) return [];
    return (data || []) as Employee[];
  } catch {
    return [];
  }
}

export default async function KaryawanPage() {
  const employees = await getEmployees();

  const total = employees.length;
  const active = employees.filter((e) => e.is_active).length;
  const inactive = employees.filter((e) => !e.is_active).length;
  const faceRegistered = employees.filter((e) => e.face_image_url).length;
  const adminCount = employees.filter((e) => e.role === "admin").length;
  const facePercent =
    total > 0 ? Math.round((faceRegistered / total) * 100) : 0;

  const statCards = [
    {
      label: "Total Karyawan",
      value: total,
      icon: Users,
      accent: "#2563EB",
      bg: "rgba(37,99,235,0.08)",
      sub: "terdaftar",
    },
    {
      label: "Aktif",
      value: active,
      icon: UserCheck,
      accent: "#16A34A",
      bg: "rgba(22,163,74,0.08)",
      sub: "karyawan aktif",
    },
    {
      label: "Nonaktif",
      value: inactive,
      icon: UserX,
      accent: "#DC2626",
      bg: "rgba(220,38,38,0.08)",
      sub: "karyawan nonaktif",
    },
    {
      label: "Wajah Terdaftar",
      value: faceRegistered,
      icon: Fingerprint,
      accent: "#7C3AED",
      bg: "rgba(124,58,237,0.08)",
      sub: `${facePercent}% dari total`,
    },
    {
      label: "Admin",
      value: adminCount,
      icon: Shield,
      accent: "#D97706",
      bg: "rgba(217,119,6,0.08)",
      sub: "hak akses admin",
    },
  ];

  return (
    <>
      <style>{`
        .ky-page { display: flex; flex-direction: column; gap: 20px; }

        /* ── Header ── */
        .ky-header {
          display: flex; align-items: flex-start; justify-content: space-between;
          gap: 16px; flex-wrap: wrap;
        }
        .ky-title {
          font-size: 24px; font-weight: 800; color: var(--text-1);
          letter-spacing: -0.03em; margin-bottom: 4px;
        }
        .ky-sub { font-size: 13.5px; color: var(--text-2); }

        /* ── Stats ── */
        .ky-stats {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
        }
        @media (min-width: 768px) { .ky-stats { grid-template-columns: repeat(3, 1fr); } }
        @media (min-width: 1280px) { .ky-stats { grid-template-columns: repeat(5, 1fr); } }

        .ky-stat {
          background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--r-lg); padding: 18px 16px;
          display: flex; align-items: center; gap: 13px;
          box-shadow: var(--shadow-sm);
          transition: transform 0.16s var(--ease), box-shadow 0.16s, border-color 0.16s;
          animation: fade-up 0.35s var(--ease-out) both;
        }
        .ky-stat:nth-child(1) { animation-delay: 0ms; }
        .ky-stat:nth-child(2) { animation-delay: 50ms; }
        .ky-stat:nth-child(3) { animation-delay: 100ms; }
        .ky-stat:nth-child(4) { animation-delay: 150ms; }
        .ky-stat:nth-child(5) { animation-delay: 200ms; }
        .ky-stat:hover {
          transform: translateY(-2px);
          box-shadow: var(--shadow-lg);
          border-color: var(--border-2);
        }
        .ky-stat-icon {
          width: 42px; height: 42px; border-radius: var(--r-md);
          display: flex; align-items: center; justify-content: center; flex-shrink: 0;
        }
        .ky-stat-lbl {
          font-size: 10.5px; font-weight: 700; color: var(--text-3);
          text-transform: uppercase; letter-spacing: 0.07em; margin-bottom: 3px;
        }
        .ky-stat-val {
          font-size: 28px; font-weight: 800; color: var(--text-1);
          letter-spacing: -0.04em; line-height: 1; margin-bottom: 3px;
        }
        .ky-stat-sub { font-size: 11.5px; color: var(--text-3); }

        /* ── Face enrollment bar ── */
        .ky-enroll-bar {
          display: flex; align-items: center; gap: 10px;
          background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--r-lg); padding: 12px 18px;
          box-shadow: var(--shadow-xs);
        }
        .ky-enroll-label { font-size: 12.5px; font-weight: 600; color: var(--text-2); flex-shrink: 0; }
        .ky-enroll-track {
          flex: 1; height: 6px; background: var(--border);
          border-radius: 999px; overflow: hidden;
        }
        .ky-enroll-fill {
          height: 100%; border-radius: 999px;
          background: linear-gradient(90deg, #7C3AED, #A855F7);
          transition: width 0.6s var(--ease);
        }
        .ky-enroll-pct {
          font-size: 12px; font-weight: 700; color: #7C3AED; flex-shrink: 0;
          min-width: 36px; text-align: right;
        }
        .ky-enroll-detail { font-size: 11.5px; color: var(--text-3); flex-shrink: 0; }

        /* ── Table panel ── */
        .ky-panel {
          background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--r-lg); box-shadow: var(--shadow-sm); overflow: hidden;
        }
        .ky-panel-head {
          padding: 14px 20px; border-bottom: 1px solid var(--border);
          display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;
        }
        .ky-panel-title { font-size: 14.5px; font-weight: 700; color: var(--text-1); }
        .ky-panel-meta { font-size: 12px; color: var(--text-3); margin-left: 6px; }

        @keyframes fade-up {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div className="ky-page">
        {/* Header */}
        <div className="ky-header">
          <div>
            <h1 className="ky-title">Karyawan</h1>
            <p className="ky-sub">Kelola data karyawan dan pendaftaran wajah</p>
          </div>
          <AddEmployeeButton />
        </div>

        {/* Stats */}
        <div className="ky-stats">
          {statCards.map((card) => (
            <div key={card.label} className="ky-stat">
              <div className="ky-stat-icon" style={{ background: card.bg }}>
                <card.icon size={19} color={card.accent} strokeWidth={1.75} />
              </div>
              <div>
                <div className="ky-stat-lbl">{card.label}</div>
                <div className="ky-stat-val">{card.value}</div>
                <div className="ky-stat-sub">{card.sub}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Face enrollment progress */}
        {total > 0 && (
          <div className="ky-enroll-bar">
            <span className="ky-enroll-label">
              <Fingerprint
                size={13}
                style={{
                  display: "inline",
                  marginRight: 5,
                  verticalAlign: "middle",
                  color: "#7C3AED",
                }}
              />
              Pendaftaran Wajah
            </span>
            <div className="ky-enroll-track">
              <div
                className="ky-enroll-fill"
                style={{ width: `${facePercent}%` }}
              />
            </div>
            <span className="ky-enroll-pct">{facePercent}%</span>
            <span className="ky-enroll-detail">
              {faceRegistered}/{total} karyawan
            </span>
          </div>
        )}

        {/* Table */}
        <div className="ky-panel">
          <div className="ky-panel-head">
            <div>
              <span className="ky-panel-title">Daftar Karyawan</span>
              <span className="ky-panel-meta">({total} total)</span>
            </div>
          </div>
          <EmployeeTable employees={employees} />
        </div>
      </div>
    </>
  );
}
