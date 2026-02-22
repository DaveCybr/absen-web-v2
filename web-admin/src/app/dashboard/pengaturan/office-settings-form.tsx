"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Clock, Shield, MapPin } from "lucide-react";
import { LocationMapPicker } from "@/components/location-map-picker";
import type { OfficeSettings } from "@/types";

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

  const handleMapChange = (lat: number, lng: number) => {
    setFormData((prev) => ({ ...prev, latitude: lat, longitude: lng }));
  };

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
        const { error: updateError } = await supabase
          .from("office_settings")
          .update(data)
          .eq("id", settings.id);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from("office_settings")
          .insert(data);
        if (insertError) throw insertError;
      }

      setSuccess(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {error && (
        <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive border border-destructive/20">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-lg bg-green-50 p-3 text-sm text-green-700 border border-green-200">
          ✓ Pengaturan berhasil disimpan
        </div>
      )}

      {/* ── Informasi Kantor ── */}
      <section className="space-y-4">
        <h3 className="flex items-center gap-2 text-base font-semibold">
          <MapPin className="h-4 w-4 text-primary" />
          Informasi Kantor
        </h3>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="office_name" required>
              Nama Kantor
            </Label>
            <Input
              id="office_name"
              value={formData.office_name}
              onChange={(e) =>
                setFormData({ ...formData, office_name: e.target.value })
              }
              placeholder="TEFA JTI INNOVATION"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="office_address">Alamat</Label>
            <Input
              id="office_address"
              value={formData.office_address}
              onChange={(e) =>
                setFormData({ ...formData, office_address: e.target.value })
              }
              placeholder="Jl. Contoh No. 123, Kota"
            />
          </div>
        </div>
      </section>

      {/* ── Lokasi GPS ── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-base font-semibold">
            <MapPin className="h-4 w-4 text-primary" />
            Lokasi Kantor
          </h3>
          {formData.latitude && formData.longitude && (
            <a
              href={`https://www.google.com/maps?q=${formData.latitude},${formData.longitude}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline"
            >
              Buka di Google Maps ↗
            </a>
          )}
        </div>

        <p className="text-sm text-muted-foreground -mt-2">
          Klik pada peta atau seret marker untuk menentukan lokasi kantor.
          Lingkaran biru menunjukkan radius absensi.
        </p>

        {/* Map picker */}
        <LocationMapPicker
          latitude={formData.latitude}
          longitude={formData.longitude}
          radiusMeters={formData.radius_meters}
          onChange={handleMapChange}
        />

        {/* Radius input */}
        <div className="max-w-xs space-y-2">
          <Label htmlFor="radius_meters" required>
            Radius Absensi (meter)
          </Label>
          <div className="flex items-center gap-3">
            <Input
              id="radius_meters"
              type="number"
              min={10}
              max={5000}
              value={formData.radius_meters}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  radius_meters: parseInt(e.target.value) || 100,
                })
              }
              required
            />
            <span className="text-sm text-muted-foreground whitespace-nowrap">
              meter
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Karyawan harus berada dalam radius ini saat absen
          </p>
        </div>
      </section>

      {/* ── Jam Kerja ── */}
      <section className="space-y-4">
        <h3 className="flex items-center gap-2 text-base font-semibold">
          <Clock className="h-4 w-4 text-primary" />
          Jam Kerja
        </h3>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="default_check_in" required>
              Jam Masuk
            </Label>
            <Input
              id="default_check_in"
              type="time"
              value={formData.default_check_in}
              onChange={(e) =>
                setFormData({ ...formData, default_check_in: e.target.value })
              }
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="default_check_out" required>
              Jam Pulang
            </Label>
            <Input
              id="default_check_out"
              type="time"
              value={formData.default_check_out}
              onChange={(e) =>
                setFormData({ ...formData, default_check_out: e.target.value })
              }
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="late_tolerance_minutes" required>
              Toleransi Terlambat
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id="late_tolerance_minutes"
                type="number"
                min={0}
                max={120}
                value={formData.late_tolerance_minutes}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    late_tolerance_minutes: parseInt(e.target.value) || 0,
                  })
                }
                required
              />
              <span className="text-sm text-muted-foreground whitespace-nowrap">
                menit
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Face Recognition ── */}
      <section className="space-y-4">
        <h3 className="flex items-center gap-2 text-base font-semibold">
          <Shield className="h-4 w-4 text-primary" />
          Face Recognition
        </h3>

        <div className="max-w-xs space-y-2">
          <Label htmlFor="face_similarity_threshold" required>
            Threshold Kecocokan Wajah
          </Label>
          <div className="flex items-center gap-3">
            <Input
              id="face_similarity_threshold"
              type="number"
              step="0.01"
              min="0.5"
              max="1"
              value={formData.face_similarity_threshold}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  face_similarity_threshold: parseFloat(e.target.value) || 0.8,
                })
              }
              required
            />
            <span className="text-sm text-muted-foreground">/ 1.0</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Semakin tinggi = semakin ketat (rekomendasi: 0.75 – 0.85)
          </p>
        </div>
      </section>

      {/* Submit */}
      <div className="flex justify-end pt-2 border-t">
        <Button type="submit" loading={loading}>
          Simpan Pengaturan
        </Button>
      </div>
    </form>
  );
}
