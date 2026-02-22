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
import { formatDate, getStatusColor, getStatusLabel } from "@/lib/utils";
import { LeaveRequestActions } from "./leave-request-actions";
import type { LeaveRequest, Employee, LeaveType } from "@/types";

interface PageProps {
  searchParams: Promise<{
    status?: string;
  }>;
}

async function getLeaveRequests(status?: string) {
  const supabase = await createClient();

  // ✅ FIX: Gunakan FK hint eksplisit untuk menghindari ambiguous relationship
  // leave_requests punya 2 FK ke employees: employee_id dan approved_by
  let query = supabase
    .from("leave_requests")
    .select(
      `
      *,
      employee:employees!leave_requests_employee_id_fkey(*),
      leave_type:leave_types(*),
      approver:employees!leave_requests_approved_by_fkey(id, name)
    `,
    )
    .order("created_at", { ascending: false });

  if (status && status !== "all") {
    query = query.eq("status", status);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching leave requests:", error);
    return [];
  }

  return data as (LeaveRequest & {
    employee: Employee;
    leave_type: LeaveType;
  })[];
}

export default async function CutiPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const leaveRequests = await getLeaveRequests(params.status);

  const pendingCount = leaveRequests.filter(
    (r) => r.status === "pending",
  ).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Cuti & Izin</h1>
        <p className="text-muted-foreground">
          Kelola pengajuan cuti dan izin karyawan
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-yellow-600">{pendingCount}</p>
            <p className="text-sm text-muted-foreground">
              Menunggu Persetujuan
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-green-600">
              {leaveRequests.filter((r) => r.status === "approved").length}
            </p>
            <p className="text-sm text-muted-foreground">Disetujui</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-red-600">
              {leaveRequests.filter((r) => r.status === "rejected").length}
            </p>
            <p className="text-sm text-muted-foreground">Ditolak</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-bold">{leaveRequests.length}</p>
            <p className="text-sm text-muted-foreground">Total Pengajuan</p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Daftar Pengajuan</CardTitle>
        </CardHeader>
        <CardContent>
          {leaveRequests.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              Tidak ada pengajuan cuti
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Karyawan</TableHead>
                  <TableHead>Jenis Cuti</TableHead>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Durasi</TableHead>
                  <TableHead>Alasan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Diajukan</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leaveRequests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                          {request.employee?.name?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium">
                            {request.employee?.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {request.employee?.department || "—"}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {request.leave_type?.name}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <p>
                          {formatDate(request.start_date, { month: "short" })}
                        </p>
                        {request.start_date !== request.end_date && (
                          <p className="text-muted-foreground">
                            s/d{" "}
                            {formatDate(request.end_date, { month: "short" })}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{request.total_days} hari</TableCell>
                    <TableCell>
                      <p
                        className="max-w-[200px] truncate"
                        title={request.reason || ""}
                      >
                        {request.reason || "—"}
                      </p>
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(request.status)}>
                        {getStatusLabel(request.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(request.created_at, { month: "short" })}
                    </TableCell>
                    <TableCell className="text-right">
                      {request.status === "pending" && (
                        <LeaveRequestActions request={request} />
                      )}
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
