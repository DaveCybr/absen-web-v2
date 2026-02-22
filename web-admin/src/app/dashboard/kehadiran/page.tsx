import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate, formatTime, formatDuration, getStatusColor, getStatusLabel } from "@/lib/utils";
import { AttendanceFilters } from "./attendance-filters";
import type { Attendance, Employee } from "@/types";

interface PageProps {
  searchParams: Promise<{
    date?: string;
    status?: string;
    department?: string;
  }>;
}

async function getAttendances(filters: {
  date?: string;
  status?: string;
  department?: string;
}) {
  const supabase = await createClient();
  
  let query = supabase
    .from("attendances")
    .select("*, employee:employees(*)")
    .order("check_in_time", { ascending: false });

  // Filter by date
  if (filters.date) {
    query = query.eq("attendance_date", filters.date);
  } else {
    // Default to today
    const today = new Date().toISOString().split("T")[0];
    query = query.eq("attendance_date", today);
  }

  // Filter by status
  if (filters.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching attendances:", error);
    return [];
  }

  // Filter by department (after fetch since it's in joined table)
  let result = data as (Attendance & { employee: Employee })[];
  
  if (filters.department && filters.department !== "all") {
    result = result.filter(
      (a) => a.employee?.department === filters.department
    );
  }

  return result;
}

async function getDepartments() {
  const supabase = await createClient();
  
  const { data } = await supabase
    .from("employees")
    .select("department")
    .not("department", "is", null);

  const departments = [...new Set(data?.map((e) => e.department).filter(Boolean))];
  return departments as string[];
}

export default async function KehadiranPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const attendances = await getAttendances(params);
  const departments = await getDepartments();

  const displayDate = params.date || new Date().toISOString().split("T")[0];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Kehadiran</h1>
        <p className="text-muted-foreground">
          Monitoring kehadiran karyawan
        </p>
      </div>

      {/* Filters */}
      <AttendanceFilters departments={departments} />

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Kehadiran {formatDate(displayDate)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {attendances.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              Tidak ada data kehadiran
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Karyawan</TableHead>
                  <TableHead>Departemen</TableHead>
                  <TableHead>Check In</TableHead>
                  <TableHead>Check Out</TableHead>
                  <TableHead>Durasi</TableHead>
                  <TableHead>Terlambat</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Verifikasi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attendances.map((attendance) => (
                  <TableRow key={attendance.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                          {attendance.employee?.name?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium">{attendance.employee?.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {attendance.employee?.position || "—"}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{attendance.employee?.department || "—"}</TableCell>
                    <TableCell>
                      {attendance.check_in_time
                        ? formatTime(attendance.check_in_time)
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {attendance.check_out_time
                        ? formatTime(attendance.check_out_time)
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {attendance.work_duration_minutes
                        ? formatDuration(attendance.work_duration_minutes)
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {attendance.late_minutes > 0 ? (
                        <span className="text-yellow-600">
                          {attendance.late_minutes} menit
                        </span>
                      ) : (
                        <span className="text-green-600">Tepat waktu</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(attendance.status)}>
                        {getStatusLabel(attendance.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {attendance.check_in_face_verified && (
                          <Badge variant="outline" className="text-xs">
                            👤 Wajah
                          </Badge>
                        )}
                        {attendance.check_in_location_verified && (
                          <Badge variant="outline" className="text-xs">
                            📍 Lokasi
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
