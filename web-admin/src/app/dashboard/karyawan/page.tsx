import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AddEmployeeButton } from "./add-employee-button";
import { EmployeeTable } from "./employee-table";
import type { Employee } from "@/types";

async function getEmployees(): Promise<Employee[]> {
  try {
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from("employees")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching employees:", error);
      return [];
    }

    return (data || []) as Employee[];
  } catch (error) {
    console.error("Error in getEmployees:", error);
    return [];
  }
}

export default async function KaryawanPage() {
  const employees = await getEmployees();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Karyawan</h1>
          <p className="text-muted-foreground">
            Kelola data karyawan dan pendaftaran wajah
          </p>
        </div>
        <AddEmployeeButton />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Daftar Karyawan</CardTitle>
        </CardHeader>
        <CardContent>
          <EmployeeTable employees={employees} />
        </CardContent>
      </Card>
    </div>
  );
}
