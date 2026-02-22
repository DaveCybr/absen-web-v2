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
import { formatDate } from "@/lib/utils";
import { EmployeeActions } from "./employee-actions";
import { AddEmployeeButton } from "./add-employee-button";
import type { Employee } from "@/types";

async function getEmployees() {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from("employees")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching employees:", error);
    return [];
  }

  return data as Employee[];
}

export default async function KaryawanPage() {
  const employees = await getEmployees();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Karyawan</h1>
          <p className="text-muted-foreground">
            Kelola data karyawan dan pendaftaran wajah
          </p>
        </div>
        <AddEmployeeButton />
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Daftar Karyawan</CardTitle>
        </CardHeader>
        <CardContent>
          {employees.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              Belum ada data karyawan
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Departemen</TableHead>
                  <TableHead>Jabatan</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Wajah</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.map((employee) => (
                  <TableRow key={employee.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                          {employee.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium">{employee.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>{employee.email}</TableCell>
                    <TableCell>{employee.department || "—"}</TableCell>
                    <TableCell>{employee.position || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={employee.role === "admin" ? "default" : "secondary"}>
                        {employee.role === "admin" ? "Admin" : "Karyawan"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {employee.face_token ? (
                        <Badge variant="success">Terdaftar</Badge>
                      ) : (
                        <Badge variant="outline">Belum</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={employee.is_active ? "success" : "destructive"}>
                        {employee.is_active ? "Aktif" : "Nonaktif"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <EmployeeActions employee={employee} />
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
