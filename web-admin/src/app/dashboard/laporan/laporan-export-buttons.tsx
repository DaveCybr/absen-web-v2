"use client";

import { useState } from "react";
import { FileSpreadsheet, FileText, ChevronDown } from "lucide-react";

interface LaporanExportButtonsProps {
  baseParams: string;
  tab: string;
}

// Map tab ke type export yang relevan
const TAB_TO_EXPORT: Record<string, { label: string; type: string }[]> = {
  rekap: [{ label: "Rekap Karyawan", type: "rekap" }],
  departemen: [{ label: "Rekap Karyawan", type: "rekap" }],
  kehadiran: [{ label: "Kehadiran Harian", type: "kehadiran" }],
  izin: [{ label: "Izin", type: "izin" }],
};

export function LaporanExportButtons({
  baseParams,
  tab,
}: LaporanExportButtonsProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);

  const exports = TAB_TO_EXPORT[tab] || TAB_TO_EXPORT.rekap;
  const exp = exports[0];

  const download = async (format: "excel" | "pdf") => {
    const key = `${format}-${exp.type}`;
    setLoading(key);
    setOpen(false);
    try {
      const endpoint =
        format === "excel"
          ? `/api/laporan/export/excel?type=${exp.type}&${baseParams}`
          : `/api/laporan/export/pdf?type=${exp.type}&${baseParams}`;
      const res = await fetch(endpoint);
      if (!res.ok) throw new Error("Export gagal");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        res.headers
          .get("content-disposition")
          ?.split('filename="')[1]
          ?.replace('"', "") ||
        `laporan.${format === "excel" ? "xlsx" : "pdf"}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert("Gagal mengunduh laporan. Coba lagi.");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div style={{ position: "relative", display: "flex", gap: 8 }}>
      {/* Excel */}
      <button
        onClick={() => download("excel")}
        disabled={!!loading}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "7px 14px",
          background:
            loading === `excel-${exp.type}`
              ? "var(--surface-2)"
              : "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-md)",
          fontSize: 13,
          fontWeight: 600,
          color: loading ? "var(--text-3)" : "#16A34A",
          cursor: loading ? "not-allowed" : "pointer",
          fontFamily: "inherit",
          transition: "background 0.13s, color 0.13s",
          whiteSpace: "nowrap",
        }}
      >
        <FileSpreadsheet size={15} />
        {loading === `excel-${exp.type}` ? "Mengunduh…" : "Excel"}
      </button>

      {/* PDF */}
      <button
        onClick={() => download("pdf")}
        disabled={!!loading}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "7px 14px",
          background:
            loading === `pdf-${exp.type}`
              ? "var(--surface-2)"
              : "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-md)",
          fontSize: 13,
          fontWeight: 600,
          color: loading ? "var(--text-3)" : "#DC2626",
          cursor: loading ? "not-allowed" : "pointer",
          fontFamily: "inherit",
          transition: "background 0.13s, color 0.13s",
          whiteSpace: "nowrap",
        }}
      >
        <FileText size={15} />
        {loading === `pdf-${exp.type}` ? "Mengunduh…" : "PDF"}
      </button>
    </div>
  );
}
