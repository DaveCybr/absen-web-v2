import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { OfficeSettingsForm } from "./office-settings-form";
import type { OfficeSettings } from "@/types";

async function getOfficeSettings() {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from("office_settings")
    .select("*")
    .single();

  if (error) {
    console.error("Error fetching office settings:", error);
    return null;
  }

  return data as OfficeSettings;
}

export default async function PengaturanPage() {
  const settings = await getOfficeSettings();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Pengaturan</h1>
        <p className="text-muted-foreground">
          Konfigurasi lokasi kantor dan jam kerja
        </p>
      </div>

      {/* Office Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Pengaturan Kantor</CardTitle>
          <CardDescription>
            Atur lokasi kantor untuk validasi GPS saat absensi
          </CardDescription>
        </CardHeader>
        <CardContent>
          <OfficeSettingsForm settings={settings} />
        </CardContent>
      </Card>
    </div>
  );
}
