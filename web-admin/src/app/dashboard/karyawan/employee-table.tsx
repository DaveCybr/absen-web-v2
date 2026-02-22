"use client";

import { DataTable } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { EmployeeActions } from "./employee-actions";
import type { Employee } from "@/types";

interface EmployeeTableProps {
  employees: Employee[];
}

export function EmployeeTable({ employees }: EmployeeTableProps) {
  const columns = [
    {
      key: "name",
      label: "Nama",
      sortable: true,
      render: (employee: Employee) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
            {employee.name.charAt(0).toUpperCase()}
          </div>
          <span className="font-medium">{employee.name}</span>
        </div>
      ),
    },
    {
      key: "email",
      label: "Email",
      sortable: true,
    },
    {
      key: "department",
      label: "Departemen",
      sortable: true,
      render: (employee: Employee) => employee.department || "—",
    },
    {
      key: "position",
      label: "Jabatan",
      sortable: true,
      render: (employee: Employee) => employee.position || "—",
    },
    {
      key: "role",
      label: "Role",
      sortable: true,
      render: (employee: Employee) => (
        <Badge variant={employee.role === "admin" ? "default" : "secondary"}>
          {employee.role === "admin" ? "Admin" : "Karyawan"}
        </Badge>
      ),
    },
    {
      key: "face_token",
      label: "Wajah",
      render: (employee: Employee) =>
        employee.face_token ? (
          <Badge variant="success">Terdaftar</Badge>
        ) : (
          <Badge variant="outline">Belum</Badge>
        ),
    },
    {
      key: "is_active",
      label: "Status",
      sortable: true,
      render: (employee: Employee) => (
        <Badge variant={employee.is_active ? "success" : "destructive"}>
          {employee.is_active ? "Aktif" : "Nonaktif"}
        </Badge>
      ),
    },
    {
      key: "actions",
      label: "Aksi",
      render: (employee: Employee) => <EmployeeActions employee={employee} />,
    },
  ];

  return (
    <DataTable
      data={employees}
      columns={columns}
      searchKeys={["name", "email", "department", "position"]}
      searchPlaceholder="Cari karyawan..."
      pageSize={10}
    />
  );
}
