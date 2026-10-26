/* ---------- people ---------- */

/** App permission role. Department and designation are separate fields. */
export type Role = "employee" | "hr" | "admin" | "pc" | "md";

export const ROLE_LABEL: Record<Role, string> = {
  employee: "Employee",
  hr: "HR",
  admin: "Admin",
  pc: "Project Coordinator",
  md: "Managing Director",
};

export const ROLES: Role[] = ["employee", "hr", "admin", "pc", "md"];

/** Who scores a parameter. Set by HR per parameter, per cycle. */
export type Rater = "self" | "hr" | "admin" | "pc" | "manager";

export const RATERS: Rater[] = ["self", "hr", "admin", "pc", "manager"];

export const RATER_LABEL: Record<Rater, string> = {
  self: "Self",
  hr: "HR",
  admin: "Admin",
  pc: "Project Coordinator",
  manager: "Reporting Manager",
};

/** Colours follow Appraisal.xlsx (purple = self, sandal = HR, green = admin, blue = PC). */
export const RATER_TONE: Record<Rater, string> = {
  self: "bg-[#ece7f7] text-[#4e3d86] border-[#d6cdee]",
  hr: "bg-[#fdf3d2] text-[#7a5a06] border-[#f3e1a0]",
  admin: "bg-[#e6f1e0] text-[#3c6a2b] border-[#c9e0bd]",
  pc: "bg-[#e3eef9] text-[#2f5a85] border-[#c4daf0]",
  manager: "bg-[#efeeea] text-[#4a4c4c] border-[#dcdad3]",
};

export const DEFAULT_DEPARTMENTS = [
  "Management Consulting",
  "Corporate Finance",
  "Internal Audit",
  "Taxation",
  "Support Staff",
];

export const DEFAULT_DESIGNATIONS: Record<string, string[]> = {
  "*": ["Analyst / Sr Analyst", "Team Lead", "Assistant Manager", "Manager"],
  "Support Staff": ["HR Executive", "Admin Executive", "Project Coordinator"],
};

export interface Employee {
  employeeId: string;
  name: string;
  email: string;
  department: string;
  designation: string;
  role: Role;
  managerId: string;
  active: boolean;
}

/* ---------- cycles & parameters ---------- */

export type CycleStatus = "draft" | "open" | "closed";

export const CYCLE_STATUS_LABEL: Record<CycleStatus, string> = {
  draft: "Setting up",
  open: "Open",
  closed: "Closed",
};

export interface Cycle {
  cycleId: string; // YYYY-MM
  name: string;
  periodStart: string; // YYYY-MM-DD
  periodEnd: string;
  selfDue: string;
  reviewDue: string;
  status: CycleStatus;
  copiedFrom: string;
  createdAt: string;
}

/** "all" = always on this designation's sheet; "project" = only when the employee is assigned to `project`. */
export type AppliesTo = "all" | "project";

export interface Parameter {
  paramId: string;
  department: string;
  designation: string;
  section: string;
  appliesTo: AppliesTo;
  project: string;
  order: number;
  text: string;
  ratedBy: Rater;
  maxPoints: number;
  minPoints: number;
  active: boolean;
}

/* ---------- appraisals ---------- */

/** Derived from the scores: an appraisal is ready once every item has a valid score. */
export type AppraisalStatus = "in_progress" | "awaiting_approval" | "approved";

export const STATUS_LABEL: Record<AppraisalStatus, string> = {
  in_progress: "Scoring in progress",
  awaiting_approval: "Ready for approval",
  approved: "Approved",
};

export interface Appraisal {
  appraisalId: string;
  cycleId: string;
  employeeId: string;
  department: string; // snapshot at cycle open
  designation: string; // snapshot at cycle open
  managerId: string;
  projects: string[];
  lastReminderAt: string;
  approvedBy: string;
  approvedAt: string;
  /** Snapshot taken at approval, so later sheet edits can't change an approved result. */
  earned: number | null;
  maxPoints: number | null;
  scorePct: number | null;
  updatedAt: string;
}

/**
 * One row of the "Scores YYYY-MM" tab. Self, Admin, PC and Reporting Manager points are typed
 * straight into the sheet; HR items start at full marks and HR deducts in the app.
 */
export interface Score {
  scoreId: string; // `${appraisalId}:${paramId}`
  appraisalId: string;
  paramId: string;
  pointsRaw: string; // exactly what is in the cell
  comment: string; // HR's reason for a deduction, or a rater's note
  remark: string; // employee's remark (e.g. WOW moment, names appreciated)
  evidence: string;
  status: "" | "removed";
  updatedAt: string;
}

/** How one item currently stands. */
export type LineState = "scored" | "empty" | "invalid" | "full_default";

export interface ChangeEntry {
  timestamp: string;
  userId: string;
  userName: string;
  action: string;
  cycleId: string;
  target: string;
  field: string;
  before: string;
  after: string;
  note: string;
}
