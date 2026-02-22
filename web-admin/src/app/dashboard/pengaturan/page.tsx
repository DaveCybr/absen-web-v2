import { createClient } from "@/lib/supabase/server";
import { OfficeSettingsForm } from "./office-settings-form";
import type { OfficeSettings } from "@/types";
import {
  Settings,
  MapPin,
  Clock,
  Fingerprint,
  Info,
  CheckCircle2,
} from "lucide-react";

async function getOfficeSettings() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("office_settings")
    .select("*")
    .single();
  if (error) return null;
  return data as OfficeSettings;
}

export default async function PengaturanPage() {
  const settings = await getOfficeSettings();

  const isConfigured = !!(settings?.latitude && settings?.longitude);

  const sections = [
    { icon: MapPin, label: "Lokasi Kantor", desc: "GPS & radius absensi" },
    { icon: Clock, label: "Jam Kerja", desc: "Jam masuk & pulang" },
    {
      icon: Fingerprint,
      label: "Face Recognition",
      desc: "Threshold kecocokan",
    },
  ];

  return (
    <>
      <style>{`
        .pg-page { display: flex; flex-direction: column; gap: 20px; }

        /* ── Header ── */
        .pg-header {
          display: flex; align-items: flex-start; justify-content: space-between;
          gap: 16px; flex-wrap: wrap;
        }
        .pg-title {
          font-size: 24px; font-weight: 800; color: var(--text-1);
          letter-spacing: -0.03em; margin-bottom: 4px;
        }
        .pg-sub { font-size: 13.5px; color: var(--text-2); }

        /* ── Status banner ── */
        .pg-status {
          display: flex; align-items: center; gap: 12px;
          padding: 14px 18px; border-radius: var(--r-lg);
          border: 1px solid; box-shadow: var(--shadow-xs);
          animation: fade-up 0.3s var(--ease-out) both;
        }
        .pg-status.ok {
          background: var(--green-bg); border-color: var(--green-border);
        }
        .pg-status.warn {
          background: #FFFBEB; border-color: #FDE68A;
        }
        .pg-status-icon {
          width: 36px; height: 36px; border-radius: var(--r-md);
          display: flex; align-items: center; justify-content: center; flex-shrink: 0;
        }
        .pg-status.ok  .pg-status-icon { background: rgba(22,163,74,0.12); }
        .pg-status.warn .pg-status-icon { background: rgba(217,119,6,0.12); }
        .pg-status-title {
          font-size: 13.5px; font-weight: 700;
        }
        .pg-status.ok   .pg-status-title { color: #15803D; }
        .pg-status.warn .pg-status-title { color: #B45309; }
        .pg-status-desc { font-size: 12.5px; color: var(--text-2); margin-top: 1px; }

        /* ── Section chips (overview) ── */
        .pg-overview {
          display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;
        }
        @media (max-width: 640px) { .pg-overview { grid-template-columns: 1fr; } }
        .pg-chip {
          display: flex; align-items: center; gap: 10px;
          background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--r-md); padding: 12px 14px;
          box-shadow: var(--shadow-xs);
        }
        .pg-chip-icon {
          width: 34px; height: 34px; border-radius: var(--r-sm);
          display: flex; align-items: center; justify-content: center; flex-shrink: 0;
          background: rgba(37,99,235,0.07);
        }
        .pg-chip-label { font-size: 13px; font-weight: 600; color: var(--text-1); line-height: 1.3; }
        .pg-chip-desc  { font-size: 11.5px; color: var(--text-3); }

        /* ── Main form panel ── */
        .pg-panel {
          background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--r-lg); box-shadow: var(--shadow-sm); overflow: hidden;
        }
        .pg-panel-head {
          padding: 18px 24px; border-bottom: 1px solid var(--border);
          display: flex; align-items: center; gap: 12px;
          background: var(--surface-2);
        }
        .pg-panel-icon {
          width: 38px; height: 38px; border-radius: var(--r-md);
          background: rgba(37,99,235,0.08);
          display: flex; align-items: center; justify-content: center; flex-shrink: 0;
        }
        .pg-panel-title { font-size: 15px; font-weight: 700; color: var(--text-1); margin-bottom: 2px; }
        .pg-panel-desc  { font-size: 12.5px; color: var(--text-2); }
        .pg-panel-body  { padding: 28px 24px; }

        @keyframes fade-up {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div className="pg-page">
        {/* Header */}
        <div className="pg-header">
          <div>
            <h1 className="pg-title">Pengaturan</h1>
            <p className="pg-sub">
              Konfigurasi kantor, jam kerja, dan sistem verifikasi wajah
            </p>
          </div>
        </div>

        {/* Config status banner */}
        <div className={`pg-status ${isConfigured ? "ok" : "warn"}`}>
          <div className="pg-status-icon">
            {isConfigured ? (
              <CheckCircle2 size={18} color="#15803D" strokeWidth={2} />
            ) : (
              <Info size={18} color="#B45309" strokeWidth={2} />
            )}
          </div>
          <div>
            <div className="pg-status-title">
              {isConfigured
                ? "Sistem Sudah Dikonfigurasi"
                : "Konfigurasi Diperlukan"}
            </div>
            <div className="pg-status-desc">
              {isConfigured
                ? `Kantor "${settings?.office_name}" · Radius ${settings?.radius_meters}m · Jam ${settings?.default_check_in}–${settings?.default_check_out}`
                : "Lengkapi pengaturan kantor agar karyawan dapat melakukan absensi."}
            </div>
          </div>
        </div>

        {/* Overview chips */}
        <div className="pg-overview">
          {sections.map((s) => (
            <div key={s.label} className="pg-chip">
              <div className="pg-chip-icon">
                <s.icon size={16} color="#2563EB" strokeWidth={1.75} />
              </div>
              <div>
                <div className="pg-chip-label">{s.label}</div>
                <div className="pg-chip-desc">{s.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Form panel */}
        <div className="pg-panel">
          <div className="pg-panel-head">
            <div className="pg-panel-icon">
              <Settings size={18} color="#2563EB" strokeWidth={1.75} />
            </div>
            <div>
              <div className="pg-panel-title">Konfigurasi Sistem Absensi</div>
              <div className="pg-panel-desc">
                Atur lokasi GPS, jam kerja, dan parameter verifikasi wajah
              </div>
            </div>
          </div>
          <div className="pg-panel-body">
            <OfficeSettingsForm settings={settings} />
          </div>
        </div>
      </div>
    </>
  );
}
