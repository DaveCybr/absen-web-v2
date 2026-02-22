// Database types
export interface Employee {
  id: string;
  user_id: string | null;
  name: string;
  email: string;
  phone: string | null;
  department: string | null;
  position: string | null;
  face_token: string | null;
  face_image_url: string | null;
  is_active: boolean;
  role: "admin" | "employee";
  created_at: string;
  updated_at: string;
}

export interface OfficeSettings {
  id: string;
  office_name: string;
  office_address: string | null;
  latitude: number;
  longitude: number;
  radius_meters: number;
  default_check_in: string;
  default_check_out: string;
  late_tolerance_minutes: number;
  face_similarity_threshold: number;
  created_at: string;
  updated_at: string;
}

export interface Attendance {
  id: string;
  employee_id: string;
  attendance_date: string;
  check_in_time: string | null;
  check_in_latitude: number | null;
  check_in_longitude: number | null;
  check_in_photo_url: string | null;
  check_in_face_verified: boolean;
  check_in_location_verified: boolean;
  check_out_time: string | null;
  check_out_latitude: number | null;
  check_out_longitude: number | null;
  check_out_photo_url: string | null;
  check_out_face_verified: boolean;
  check_out_location_verified: boolean;
  late_minutes: number;
  early_leave_minutes: number;
  work_duration_minutes: number | null;
  status: "present" | "late" | "absent" | "leave" | "half_day";
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  employee?: Employee;
}

export interface LeaveType {
  id: string;
  name: string;
  code: string;
  description: string | null;
  default_quota: number;
  is_paid: boolean;
  requires_attachment: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface LeaveBalance {
  id: string;
  employee_id: string;
  leave_type_id: string;
  year: number;
  quota: number;
  used: number;
  remaining: number;
  created_at: string;
  updated_at: string;
  // Joined
  leave_type?: LeaveType;
  employee?: Employee;
}

export interface LeaveRequest {
  id: string;
  employee_id: string;
  leave_type_id: string;
  start_date: string;
  end_date: string;
  total_days: number;
  reason: string | null;
  attachment_url: string | null;
  status: "pending" | "approved" | "rejected" | "cancelled";
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  employee?: Employee;
  leave_type?: LeaveType;
  approver?: Employee;
}

// API Response types
export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
}

// Dashboard Stats
export interface DashboardStats {
  totalEmployees: number;
  presentToday: number;
  lateToday: number;
  absentToday: number;
  onLeaveToday: number;
  pendingLeaveRequests: number;
}

// Form types
export interface EmployeeFormData {
  name: string;
  email: string;
  phone?: string;
  department?: string;
  position?: string;
  role: "admin" | "employee";
  is_active: boolean;
}

export interface LeaveRequestFormData {
  leave_type_id: string;
  start_date: string;
  end_date: string;
  reason?: string;
}

export interface OfficeSettingsFormData {
  office_name: string;
  office_address?: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
  default_check_in: string;
  default_check_out: string;
  late_tolerance_minutes: number;
  face_similarity_threshold: number;
}
