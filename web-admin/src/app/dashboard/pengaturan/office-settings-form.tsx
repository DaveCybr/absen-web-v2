"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LocationMapPicker } from "@/components/location-map-picker";
import type { OfficeSettings } from "@/types";
import {
  Clock,
  Shield,
  MapPin,
  Building2,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Save,
} from "lucide-react";

interface OfficeSettingsFormProps {
  settings: OfficeSettings | null;
}

export function OfficeSettingsForm({ settings }: OfficeSettingsFormProps) {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    office_name: settings?.office_name || "",
    office_address: settings?.office_address || "",
    latitude: settings?.latitude ?? (null as number | null),
    longitude: settings?.longitude ?? (null as number | null),
    radius_meters: settings?.radius_meters ?? 100,
    default_check_in: settings?.default_check_in || "08:00",
    default_check_out: settings?.default_check_out || "17:00",
    late_tolerance_minutes: settings?.late_tolerance_minutes ?? 15,
    face_similarity_threshold: settings?.face_similarity_threshold ?? 0.8,
  });

  const set = (key: string, val: unknown) =>
    setFormData((prev) => ({ ...prev, [key]: val }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess(false);

    if (!formData.latitude || !formData.longitude) {
      setError("Pilih lokasi kantor pada peta terlebih dahulu");
      setLoading(false);
      return;
    }

    try {
      const data = {
        office_name: formData.office_name,
        office_address: formData.office_address || null,
        latitude: formData.latitude,
        longitude: formData.longitude,
        radius_meters: formData.radius_meters,
        default_check_in: formData.default_check_in,
        default_check_out: formData.default_check_out,
        late_tolerance_minutes: formData.late_tolerance_minutes,
        face_similarity_threshold: formData.face_similarity_threshold,
      };

      if (settings?.id) {
        const { error: e } = await supabase
          .from("office_settings")
          .update(data)
          .eq("id", settings.id);
        if (e) throw e;
      } else {
        const { error: e } = await supabase
          .from("office_settings")
          .insert(data);
        if (e) throw e;
      }

      setSuccess(true);
      router.refresh();
      setTimeout(() => setSuccess(false), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  };

  const workHours = (() => {
    const [ih, im] = formData.default_check_in.split(":").map(Number);
    const [oh, om] = formData.default_check_out.split(":").map(Number);
    const total = oh * 60 + om - (ih * 60 + im);
    if (total <= 0) return null;
    return `${Math.floor(total / 60)} jam ${total % 60 > 0 ? `${total % 60} menit` : ""}`.trim();
  })();

  const thresholdLabel =
    formData.face_similarity_threshold >= 0.9
      ? { txt: "Sangat Ketat", col: "#DC2626" }
      : formData.face_similarity_threshold >= 0.8
        ? { txt: "Ketat (Rekomendasi)", col: "#16A34A" }
        : formData.face_similarity_threshold >= 0.7
          ? { txt: "Sedang", col: "#D97706" }
          : { txt: "Longgar", col: "#7C3AED" };

  return (
    <>
      <style>{`
        /* ── Form sections ── */
        .sf-sections { display: flex; flex-direction: column; gap: 32px; }

        .sf-section { }
        .sf-section-head {
          display: flex; align-items: center; gap: 10px; margin-bottom: 18px;
          padding-bottom: 12px; border-bottom: 1px solid var(--border);
        }
        .sf-section-icon {
          width: 34px; height: 34px; border-radius: var(--r-sm);
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .sf-section-title { font-size: 14px; font-weight: 700; color: var(--text-1); }
        .sf-section-desc  { font-size: 12px; color: var(--text-3); margin-top: 1px; }

        .sf-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .sf-grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }
        @media (max-width: 640px) {
          .sf-grid-2, .sf-grid-3 { grid-template-columns: 1fr; }
        }
        .sf-field { display: flex; flex-direction: column; gap: 6px; }
        .sf-label {
          font-size: 12px; font-weight: 600; color: var(--text-2);
          text-transform: uppercase; letter-spacing: 0.06em;
        }
        .sf-label span { color: var(--red); margin-left: 2px; }

        /* Inputs */
        .sf-input {
          padding: 10px 13px; border-radius: var(--r-md);
          border: 1.5px solid var(--border); background: var(--surface-2);
          font-size: 14px; color: var(--text-1);
          font-family: 'Plus Jakarta Sans', sans-serif; outline: none;
          transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
          width: 100%;
        }
        .sf-input:focus {
          border-color: var(--blue-400); background: var(--surface);
          box-shadow: 0 0 0 3px var(--blue-glow);
        }
        .sf-input::placeholder { color: var(--text-3); }
        .sf-input:disabled { opacity: 0.5; cursor: not-allowed; }

        .sf-input-wrap { position: relative; }
        .sf-input-suffix {
          position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
          font-size: 12.5px; color: var(--text-3); font-weight: 500; pointer-events: none;
        }
        .sf-input.has-suffix { padding-right: 48px; }

        .sf-hint { font-size: 11.5px; color: var(--text-3); line-height: 1.5; margin-top: 2px; }

        /* Range slider */
        .sf-slider-wrap { display: flex; align-items: center; gap: 12px; }
        .sf-slider {
          flex: 1; -webkit-appearance: none; appearance: none;
          height: 4px; border-radius: 999px; background: var(--border); outline: none; cursor: pointer;
        }
        .sf-slider::-webkit-slider-thumb {
          -webkit-appearance: none; width: 18px; height: 18px; border-radius: 50%;
          background: var(--blue-400); border: 2px solid white; box-shadow: 0 1px 4px rgba(59,130,246,0.4);
          cursor: pointer;
        }
        .sf-slider-val {
          min-width: 52px; text-align: right;
          font-size: 14px; font-weight: 700; color: var(--text-1);
          font-family: 'JetBrains Mono', monospace;
        }
        .sf-threshold-label {
          display: inline-flex; align-items: center;
          padding: 3px 10px; border-radius: 999px;
          font-size: 11.5px; font-weight: 600;
          margin-top: 6px;
        }

        /* Radius display */
        .sf-radius-row { display: flex; gap: 12px; align-items: flex-start; }
        .sf-radius-input-wrap { flex: 1; }
        .sf-radius-hint {
          display: flex; align-items: center; gap: 6px; padding: 10px 13px;
          background: rgba(37,99,235,0.05); border: 1px solid rgba(37,99,235,0.12);
          border-radius: var(--r-md); flex-shrink: 0; align-self: flex-end;
        }
        .sf-radius-val { font-size: 16px; font-weight: 800; color: #2563EB; font-family: 'JetBrains Mono', monospace; }
        .sf-radius-unit { font-size: 11.5px; color: var(--text-3); font-weight: 500; }

        /* Maps link */
        .sf-maps-link {
          display: inline-flex; align-items: center; gap: 5px;
          font-size: 12px; color: var(--blue-400); text-decoration: none;
          padding: 5px 10px; border-radius: var(--r-sm);
          border: 1px solid rgba(59,130,246,0.2); background: rgba(59,130,246,0.05);
          transition: background 0.13s;
        }
        .sf-maps-link:hover { background: rgba(59,130,246,0.1); }

        /* Work hours summary */
        .sf-hours-summary {
          display: flex; align-items: center; gap: 8px; margin-top: 12px;
          padding: 10px 14px; background: rgba(22,163,74,0.06);
          border: 1px solid rgba(22,163,74,0.15); border-radius: var(--r-md);
        }
        .sf-hours-summary-txt { font-size: 13px; color: #15803D; font-weight: 500; }

        /* Divider */
        .sf-divider { height: 1px; background: var(--border); margin: 4px 0; }

        /* Toast */
        .sf-alert {
          display: flex; align-items: flex-start; gap: 10px;
          padding: 12px 14px; border-radius: var(--r-md); margin-bottom: 20px;
          border: 1px solid;
        }
        .sf-alert.success { background: var(--green-bg); border-color: var(--green-border); }
        .sf-alert.error   { background: var(--red-bg);   border-color: var(--red-border); }
        .sf-alert-txt { font-size: 13.5px; }
        .sf-alert.success .sf-alert-txt { color: #15803D; }
        .sf-alert.error   .sf-alert-txt { color: #B91C1C; }

        /* Submit row */
        .sf-footer {
          display: flex; align-items: center; justify-content: space-between;
          padding-top: 20px; border-top: 1px solid var(--border); gap: 12px; flex-wrap: wrap;
          margin-top: 12px;
        }
        .sf-footer-hint { font-size: 12.5px; color: var(--text-3); }

        .sf-btn {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 11px 24px; border-radius: var(--r-md);
          background: var(--navy-800); color: white; border: none;
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-size: 14px; font-weight: 700; cursor: pointer;
          transition: background 0.15s, transform 0.1s, box-shadow 0.15s;
          box-shadow: 0 1px 2px rgba(6,12,26,0.3), 0 4px 12px rgba(6,12,26,0.2);
        }
        .sf-btn:hover:not(:disabled) {
          background: #172240;
          box-shadow: 0 4px 16px rgba(6,12,26,0.35);
          transform: translateY(-1px);
        }
        .sf-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

        @keyframes sf-spin { to { transform: rotate(360deg); } }
        .sf-spin { animation: sf-spin 0.7s linear infinite; }
      `}</style>

      <form onSubmit={handleSubmit}>
        {/* Alerts */}
        {error && (
          <div className="sf-alert error">
            <AlertCircle
              size={16}
              color="#B91C1C"
              style={{ flexShrink: 0, marginTop: 1 }}
            />
            <p className="sf-alert-txt">{error}</p>
          </div>
        )}
        {success && (
          <div className="sf-alert success">
            <CheckCircle2
              size={16}
              color="#15803D"
              style={{ flexShrink: 0, marginTop: 1 }}
            />
            <p className="sf-alert-txt">Pengaturan berhasil disimpan</p>
          </div>
        )}

        <div className="sf-sections">
          {/* ── 1. Informasi Kantor ── */}
          <div className="sf-section">
            <div className="sf-section-head">
              <div
                className="sf-section-icon"
                style={{ background: "rgba(37,99,235,0.08)" }}
              >
                <Building2 size={16} color="#2563EB" strokeWidth={1.75} />
              </div>
              <div>
                <div className="sf-section-title">Informasi Kantor</div>
                <div className="sf-section-desc">
                  Nama dan alamat kantor untuk identifikasi sistem
                </div>
              </div>
            </div>
            <div className="sf-grid-2">
              <div className="sf-field">
                <label className="sf-label">
                  Nama Kantor <span>*</span>
                </label>
                <input
                  className="sf-input"
                  value={formData.office_name}
                  onChange={(e) => set("office_name", e.target.value)}
                  placeholder="TEFA JTI Innovation"
                  required
                />
              </div>
              <div className="sf-field">
                <label className="sf-label">Alamat Lengkap</label>
                <input
                  className="sf-input"
                  value={formData.office_address}
                  onChange={(e) => set("office_address", e.target.value)}
                  placeholder="Jl. Contoh No. 123, Kota"
                />
              </div>
            </div>
          </div>

          {/* ── 2. Lokasi GPS ── */}
          <div className="sf-section">
            <div className="sf-section-head">
              <div
                className="sf-section-icon"
                style={{ background: "rgba(37,99,235,0.08)" }}
              >
                <MapPin size={16} color="#2563EB" strokeWidth={1.75} />
              </div>
              <div style={{ flex: 1 }}>
                <div className="sf-section-title">Lokasi GPS Kantor</div>
                <div className="sf-section-desc">
                  Klik peta atau seret pin untuk mengatur lokasi absensi
                </div>
              </div>
              {formData.latitude && formData.longitude && (
                <a
                  className="sf-maps-link"
                  href={`https://www.google.com/maps?q=${formData.latitude},${formData.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink size={12} /> Buka Google Maps
                </a>
              )}
            </div>

            <LocationMapPicker
              latitude={formData.latitude}
              longitude={formData.longitude}
              radiusMeters={formData.radius_meters}
              onChange={(lat, lng) => {
                set("latitude", lat);
                set("longitude", lng);
              }}
            />

            {/* Radius */}
            <div style={{ marginTop: 18 }}>
              <label
                className="sf-label"
                style={{ display: "block", marginBottom: 8 }}
              >
                Radius Absensi <span style={{ color: "var(--red)" }}>*</span>
              </label>
              <div className="sf-radius-row">
                <div
                  className="sf-radius-input-wrap sf-field"
                  style={{ gap: 6 }}
                >
                  <div className="sf-slider-wrap">
                    <input
                      className="sf-slider"
                      type="range"
                      min={10}
                      max={1000}
                      step={10}
                      value={formData.radius_meters}
                      onChange={(e) =>
                        set("radius_meters", parseInt(e.target.value))
                      }
                    />
                    <span className="sf-slider-val">
                      {formData.radius_meters}m
                    </span>
                  </div>
                  <p className="sf-hint">
                    Karyawan harus berada dalam radius ini saat melakukan
                    absensi. Lingkaran biru pada peta menunjukkan area yang
                    valid.
                  </p>
                </div>
                <div className="sf-radius-hint">
                  <MapPin size={14} color="#2563EB" />
                  <span className="sf-radius-val">
                    {formData.radius_meters}
                  </span>
                  <span className="sf-radius-unit">meter</span>
                </div>
              </div>
            </div>
          </div>

          {/* ── 3. Jam Kerja ── */}
          <div className="sf-section">
            <div className="sf-section-head">
              <div
                className="sf-section-icon"
                style={{ background: "rgba(22,163,74,0.08)" }}
              >
                <Clock size={16} color="#16A34A" strokeWidth={1.75} />
              </div>
              <div>
                <div className="sf-section-title">Jam Kerja</div>
                <div className="sf-section-desc">
                  Atur jam operasional dan toleransi keterlambatan
                </div>
              </div>
            </div>

            <div className="sf-grid-3">
              <div className="sf-field">
                <label className="sf-label">
                  Jam Masuk <span>*</span>
                </label>
                <input
                  className="sf-input"
                  type="time"
                  value={formData.default_check_in}
                  onChange={(e) => set("default_check_in", e.target.value)}
                  required
                />
              </div>
              <div className="sf-field">
                <label className="sf-label">
                  Jam Pulang <span>*</span>
                </label>
                <input
                  className="sf-input"
                  type="time"
                  value={formData.default_check_out}
                  onChange={(e) => set("default_check_out", e.target.value)}
                  required
                />
              </div>
              <div className="sf-field">
                <label className="sf-label">
                  Toleransi Terlambat <span>*</span>
                </label>
                <div className="sf-input-wrap">
                  <input
                    className="sf-input has-suffix"
                    type="number"
                    min={0}
                    max={120}
                    value={formData.late_tolerance_minutes}
                    onChange={(e) =>
                      set(
                        "late_tolerance_minutes",
                        parseInt(e.target.value) || 0,
                      )
                    }
                    required
                  />
                  <span className="sf-input-suffix">menit</span>
                </div>
              </div>
            </div>

            {workHours && (
              <div className="sf-hours-summary">
                <Clock size={14} color="#15803D" />
                <span className="sf-hours-summary-txt">
                  Total jam kerja: <strong>{workHours}</strong> per hari
                  {formData.late_tolerance_minutes > 0 && (
                    <>
                      {" "}
                      · Toleransi terlambat:{" "}
                      <strong>{formData.late_tolerance_minutes} menit</strong>
                    </>
                  )}
                </span>
              </div>
            )}
          </div>

          {/* ── 4. Face Recognition ── */}
          <div className="sf-section">
            <div className="sf-section-head">
              <div
                className="sf-section-icon"
                style={{ background: "rgba(124,58,237,0.08)" }}
              >
                <Shield size={16} color="#7C3AED" strokeWidth={1.75} />
              </div>
              <div>
                <div className="sf-section-title">Face Recognition</div>
                <div className="sf-section-desc">
                  Tingkat keketatan verifikasi wajah saat absensi
                </div>
              </div>
            </div>

            <div style={{ maxWidth: 480 }}>
              <label
                className="sf-label"
                style={{ display: "block", marginBottom: 10 }}
              >
                Threshold Kecocokan Wajah{" "}
                <span style={{ color: "var(--red)" }}>*</span>
              </label>
              <div className="sf-slider-wrap">
                <input
                  className="sf-slider"
                  type="range"
                  min={0.5}
                  max={1}
                  step={0.01}
                  value={formData.face_similarity_threshold}
                  onChange={(e) =>
                    set("face_similarity_threshold", parseFloat(e.target.value))
                  }
                />
                <span className="sf-slider-val">
                  {formData.face_similarity_threshold.toFixed(2)}
                </span>
              </div>

              {/* Threshold scale bar */}
              <div style={{ display: "flex", marginTop: 6, gap: 2 }}>
                {["0.5", "0.6", "0.7", "0.8", "0.9", "1.0"].map((v) => (
                  <div
                    key={v}
                    style={{
                      flex: 1,
                      height: 3,
                      borderRadius: 999,
                      background:
                        parseFloat(v) <= formData.face_similarity_threshold
                          ? "#7C3AED"
                          : "var(--border)",
                      transition: "background 0.2s",
                    }}
                  />
                ))}
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginTop: 4,
                }}
              >
                <span className="sf-hint">Longgar (0.5)</span>
                <span className="sf-hint">Sangat Ketat (1.0)</span>
              </div>

              <div
                className="sf-threshold-label"
                style={{
                  background: `${thresholdLabel.col}18`,
                  color: thresholdLabel.col,
                  border: `1px solid ${thresholdLabel.col}30`,
                }}
              >
                {thresholdLabel.txt}
              </div>

              <p className="sf-hint" style={{ marginTop: 8 }}>
                Semakin tinggi nilai, semakin ketat verifikasi wajah. Nilai
                terlalu tinggi bisa menyebabkan karyawan gagal absen.
                Rekomendasi: <strong>0.75 – 0.85</strong>
              </p>
            </div>
          </div>
        </div>

        {/* Footer / Submit */}
        <div className="sf-footer">
          <span className="sf-footer-hint">
            {settings
              ? "Perubahan akan berlaku segera setelah disimpan"
              : "Pengaturan awal sistem absensi"}
          </span>
          <button type="submit" className="sf-btn" disabled={loading}>
            {loading ? (
              <>
                <Loader2 size={15} className="sf-spin" /> Menyimpan...
              </>
            ) : (
              <>
                <Save size={15} /> Simpan Pengaturan
              </>
            )}
          </button>
        </div>
      </form>
    </>
  );
}
