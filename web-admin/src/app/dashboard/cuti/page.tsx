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
    page?: string;
  }>;
}

const PAGE_SIZE = 50;

async function getLeaveRequests(status?: string, page = 1) {
  const supabase = await createClient();
  const offset = (page - 1) * PAGE_SIZE;

  let query = supabase
    .from("leave_requests")
    .select(
      `
      *,
      employee:employees!leave_requests_employee_id_fkey(*),
      leave_type:leave_types(*),
      approver:employees!leave_requests_approved_by_fkey(id, name)
    `,
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (status && status !== "all") {
    query = query.eq("status", status);
  }

  const { data, error, count } = await query;

  if (error) {
    console.error("Error fetching leave requests:", error);
    return { data: [], count: 0 };
  }

  return {
    data: data as (LeaveRequest & {
      employee: Employee;
      leave_type: LeaveType;
    })[],
    count: count || 0,
  };
}

async function getLeaveStats() {
  const supabase = await createClient();

  const { data } = await supabase.from("leave_requests").select("status");

  if (!data) return { pending: 0, approved: 0, rejected: 0, total: 0 };

  return {
    pending: data.filter((r) => r.status === "pending").length,
    approved: data.filter((r) => r.status === "approved").length,
    rejected: data.filter((r) => r.status === "rejected").length,
    total: data.length,
  };
}

export default async function CutiPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const page = parseInt(params.page || "1");

  const [{ data: leaveRequests, count }, stats] = await Promise.all([
    getLeaveRequests(params.status, page),
    getLeaveStats(),
  ]);

  const totalPages = Math.ceil(count / PAGE_SIZE);

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
            <p className="text-2xl font-bold text-yellow-600">
              {stats.pending}
            </p>
            <p className="text-sm text-muted-foreground">
              Menunggu Persetujuan
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-green-600">
              {stats.approved}
            </p>
            <p className="text-sm text-muted-foreground">Disetujui</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-red-600">{stats.rejected}</p>
            <p className="text-sm text-muted-foreground">Ditolak</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-sm text-muted-foreground">Total Pengajuan</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {[
          { label: "Semua", value: "all" },
          { label: "Menunggu", value: "pending" },
          { label: "Disetujui", value: "approved" },
          { label: "Ditolak", value: "rejected" },
        ].map((tab) => {
          const isActive = (params.status || "all") === tab.value;
          return (
            <a
              key={tab.value}
              href={`/dashboard/cuti?status=${tab.value}`}
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-primary text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {tab.label}
            </a>
          );
        })}
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Daftar Pengajuan
            {count > 0 && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                ({count} total)
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {leaveRequests.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              Tidak ada pengajuan cuti
            </div>
          ) : (
            <>
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
                            {formatDate(request.start_date, {
                              month: "short",
                            })}
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

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Halaman {page} dari {totalPages}
                  </p>
                  <div className="flex gap-2">
                    {page > 1 && (
                      <a
                        href={`/dashboard/cuti?status=${params.status || "all"}&page=${page - 1}`}
                        className="rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50"
                      >
                        ‹ Sebelumnya
                      </a>
                    )}
                    {page < totalPages && (
                      <a
                        href={`/dashboard/cuti?status=${params.status || "all"}&page=${page + 1}`}
                        className="rounded-md border px-3 py-1.5 text-sm hover:bg-gray-50"
                      >
                        Berikutnya ›
                      </a>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
