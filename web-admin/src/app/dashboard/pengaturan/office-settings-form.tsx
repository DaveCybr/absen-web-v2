"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { MapPin, Clock, Shield } from "lucide-react";
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
    latitude: settings?.latitude?.toString() || "",
    longitude: settings?.longitude?.toString() || "",
    radius_meters: settings?.radius_meters?.toString() || "100",
    default_check_in: settings?.default_check_in || "08:00",
    default_check_out: settings?.default_check_out || "17:00",
    late_tolerance_minutes: settings?.late_tolerance_minutes?.toString() || "15",
    face_similarity_threshold: settings?.face_similarity_threshold?.toString() || "0.80",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess(false);

    try {
      const data = {
        office_name: formData.office_name,
        office_address: formData.office_address || null,
        latitude: parseFloat(formData.latitude),
        longitude: parseFloat(formData.longitude),
        radius_meters: parseInt(formData.radius_meters),
        default_check_in: formData.default_check_in,
        default_check_out: formData.default_check_out,
        late_tolerance_minutes: parseInt(formData.late_tolerance_minutes),
        face_similarity_threshold: parseFloat(formData.face_similarity_threshold),
      };

      if (settings?.id) {
        // Update existing
        const { error: updateError } = await supabase
          .from("office_settings")
          .update(data)
          .eq("id", settings.id);

        if (updateError) throw updateError;
      } else {
        // Insert new
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

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError("Geolocation tidak didukung browser ini");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setFormData({
          ...formData,
          latitude: position.coords.latitude.toFixed(8),
          longitude: position.coords.longitude.toFixed(8),
        });
      },
      (err) => {
        setError("Gagal mendapatkan lokasi: " + err.message);
      }
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-md bg-green-50 p-3 text-sm text-green-700">
          Pengaturan berhasil disimpan
        </div>
      )}

      {/* Office Info */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-lg font-semibold">
          <MapPin className="h-5 w-5 text-primary" />
          Informasi Kantor
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="office_name" required>Nama Kantor</Label>
            <Input
              id="office_name"
              value={formData.office_name}
              onChange={(e) => setFormData({ ...formData, office_name: e.target.value })}
              placeholder="PT Nano Indonesia Sakti"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="office_address">Alamat</Label>
            <Input
              id="office_address"
              value={formData.office_address}
              onChange={(e) => setFormData({ ...formData, office_address: e.target.value })}
              placeholder="Jl. Contoh No. 123, Kota"
            />
          </div>
        </div>
      </div>

      {/* GPS Location */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-lg font-semibold">
            <MapPin className="h-5 w-5 text-primary" />
            Lokasi GPS
          </div>
          <Button type="button" variant="outline" size="sm" onClick={handleGetCurrentLocation}>
            📍 Lokasi Saat Ini
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="latitude" required>Latitude</Label>
            <Input
              id="latitude"
              type="number"
              step="any"
              value={formData.latitude}
              onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
              placeholder="-8.1845"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="longitude" required>Longitude</Label>
            <Input
              id="longitude"
              type="number"
              step="any"
              value={formData.longitude}
              onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
              placeholder="113.6681"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="radius_meters" required>Radius (meter)</Label>
            <Input
              id="radius_meters"
              type="number"
              value={formData.radius_meters}
              onChange={(e) => setFormData({ ...formData, radius_meters: e.target.value })}
              placeholder="100"
              required
            />
          </div>
        </div>

        {formData.latitude && formData.longitude && (
          <Card>
            <CardContent className="p-3">
              <p className="text-sm text-muted-foreground">
                Preview lokasi:{" "}
                <a
                  href={`https://www.google.com/maps?q=${formData.latitude},${formData.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Lihat di Google Maps ↗
                </a>
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Working Hours */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-lg font-semibold">
          <Clock className="h-5 w-5 text-primary" />
          Jam Kerja
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="default_check_in" required>Jam Masuk</Label>
            <Input
              id="default_check_in"
              type="time"
              value={formData.default_check_in}
              onChange={(e) => setFormData({ ...formData, default_check_in: e.target.value })}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="default_check_out" required>Jam Pulang</Label>
            <Input
              id="default_check_out"
              type="time"
              value={formData.default_check_out}
              onChange={(e) => setFormData({ ...formData, default_check_out: e.target.value })}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="late_tolerance_minutes" required>Toleransi Terlambat (menit)</Label>
            <Input
              id="late_tolerance_minutes"
              type="number"
              value={formData.late_tolerance_minutes}
              onChange={(e) => setFormData({ ...formData, late_tolerance_minutes: e.target.value })}
              placeholder="15"
              required
            />
          </div>
        </div>
      </div>

      {/* Face Recognition */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-lg font-semibold">
          <Shield className="h-5 w-5 text-primary" />
          Face Recognition
        </div>

        <div className="max-w-xs space-y-2">
          <Label htmlFor="face_similarity_threshold" required>
            Threshold Kecocokan Wajah (0-1)
          </Label>
          <Input
            id="face_similarity_threshold"
            type="number"
            step="0.01"
            min="0"
            max="1"
            value={formData.face_similarity_threshold}
            onChange={(e) => setFormData({ ...formData, face_similarity_threshold: e.target.value })}
            placeholder="0.80"
            required
          />
          <p className="text-xs text-muted-foreground">
            Nilai lebih tinggi = lebih ketat (recommended: 0.75 - 0.85)
          </p>
        </div>
      </div>

      {/* Submit */}
      <div className="flex justify-end">
        <Button type="submit" loading={loading}>
          Simpan Pengaturan
        </Button>
      </div>
    </form>
  );
}
