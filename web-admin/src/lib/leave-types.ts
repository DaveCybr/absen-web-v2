export const LEAVE_TYPES = [
  { code: "sakit", label: "Sakit" },
  { code: "bepergian", label: "Bepergian" },
  { code: "kepentingan", label: "Kepentingan Pribadi" },
] as const;

export type LeaveTypeCode = (typeof LEAVE_TYPES)[number]["code"];
