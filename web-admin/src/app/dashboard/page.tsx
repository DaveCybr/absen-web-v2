import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatTime, getStatusColor, getStatusLabel } from "@/lib/utils";
import {
  Users,
  UserCheck,
  Clock,
  UserX,
  CalendarDays,
  AlertCircle,
} from "lucide-react";
import type { Attendance, Employee } from "@/types";

async function getDashboardStats() {
  const supabase = await createClient();
  const today = new Date().toISOString().split("T")[0];

  // Get total active employees
  const { count: totalEmployees } = await supabase
    .from("employees")
    .select("*", { count: "exact", head: true })
    .eq("is_active", true);

  // Get today's attendances
  const { data: todayAttendances } = await supabase
    .from("attendances")
    .select("*, employee:employees(*)")
    .eq("attendance_date", today);

  const presentToday = todayAttendances?.filter(
    (a) => a.status === "present" || a.status === "late"
  ).length || 0;

  const lateToday = todayAttendances?.filter(
    (a) => a.status === "late"
  ).length || 0;

  const onLeaveToday = todayAttendances?.filter(
    (a) => a.status === "leave"
  ).length || 0;

  // Get pending leave requests
  const { count: pendingLeaveRequests } = await supabase
    .from("leave_requests")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending");

  // Calculate absent (employees who haven't checked in and not on leave)
  const absentToday = (totalEmployees || 0) - presentToday - onLeaveToday;

  return {
    totalEmployees: totalEmployees || 0,
    presentToday,
    lateToday,
    absentToday: absentToday > 0 ? absentToday : 0,
    onLeaveToday,
    pendingLeaveRequests: pendingLeaveRequests || 0,
    recentAttendances: todayAttendances || [],
  };
}

export default async function DashboardPage() {
  const stats = await getDashboardStats();

  const statCards = [
    {
      title: "Total Karyawan",
      value: stats.totalEmployees,
      icon: Users,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      title: "Hadir Hari Ini",
      value: stats.presentToday,
      icon: UserCheck,
      color: "text-green-600",
      bg: "bg-green-50",
    },
    {
      title: "Terlambat",
      value: stats.lateToday,
      icon: Clock,
      color: "text-yellow-600",
      bg: "bg-yellow-50",
    },
    {
      title: "Tidak Hadir",
      value: stats.absentToday,
      icon: UserX,
      color: "text-red-600",
      bg: "bg-red-50",
    },
    {
      title: "Cuti/Izin",
      value: stats.onLeaveToday,
      icon: CalendarDays,
      color: "text-purple-600",
      bg: "bg-purple-50",
    },
    {
      title: "Pengajuan Cuti",
      value: stats.pendingLeaveRequests,
      icon: AlertCircle,
      color: "text-orange-600",
      bg: "bg-orange-50",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-muted-foreground">
          Selamat datang! Berikut ringkasan kehadiran hari ini.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {statCards.map((stat) => (
          <Card key={stat.title}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`rounded-lg p-2.5 ${stat.bg}`}>
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.title}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Attendance */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Kehadiran Hari Ini</CardTitle>
        </CardHeader>
        <CardContent>
          {stats.recentAttendances.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              Belum ada data kehadiran hari ini
            </div>
          ) : (
            <div className="space-y-3">
              {stats.recentAttendances.slice(0, 10).map((attendance: Attendance & { employee: Employee }) => (
                <div
                  key={attendance.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                      {attendance.employee?.name?.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium">{attendance.employee?.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {attendance.employee?.department || "—"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <div className="text-right">
                      <p className="text-muted-foreground">Masuk</p>
                      <p className="font-medium">
                        {attendance.check_in_time
                          ? formatTime(attendance.check_in_time)
                          : "—"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-muted-foreground">Pulang</p>
                      <p className="font-medium">
                        {attendance.check_out_time
                          ? formatTime(attendance.check_out_time)
                          : "—"}
                      </p>
                    </div>
                    <Badge className={getStatusColor(attendance.status)}>
                      {getStatusLabel(attendance.status)}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
