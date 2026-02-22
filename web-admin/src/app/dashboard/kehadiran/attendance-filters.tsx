"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface AttendanceFiltersProps {
  departments: string[];
}

export function AttendanceFilters({ departments }: AttendanceFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentDate = searchParams.get("date") || new Date().toISOString().split("T")[0];
  const currentStatus = searchParams.get("status") || "all";
  const currentDepartment = searchParams.get("department") || "all";

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    
    if (value === "all" || !value) {
      params.delete(key);
    } else {
      params.set(key, value);
    }

    router.push(`/dashboard/kehadiran?${params.toString()}`);
  };

  return (
    <div className="flex flex-wrap gap-4">
      <div className="space-y-1">
        <Label htmlFor="date">Tanggal</Label>
        <Input
          id="date"
          type="date"
          value={currentDate}
          onChange={(e) => updateFilter("date", e.target.value)}
          className="w-44"
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="status">Status</Label>
        <Select
          id="status"
          value={currentStatus}
          onChange={(e) => updateFilter("status", e.target.value)}
          className="w-40"
        >
          <option value="all">Semua Status</option>
          <option value="present">Hadir</option>
          <option value="late">Terlambat</option>
          <option value="absent">Tidak Hadir</option>
          <option value="leave">Cuti</option>
        </Select>
      </div>

      <div className="space-y-1">
        <Label htmlFor="department">Departemen</Label>
        <Select
          id="department"
          value={currentDepartment}
          onChange={(e) => updateFilter("department", e.target.value)}
          className="w-44"
        >
          <option value="all">Semua Departemen</option>
          {departments.map((dept) => (
            <option key={dept} value={dept}>
              {dept}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}
