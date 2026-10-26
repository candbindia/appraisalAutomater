/**
 * Google Sheets layout: one tab per table, row 1 = headers (exact names below).
 * Columns are matched by header name, so columns can be reordered or extra columns
 * added to the right without breaking the app.
 *
 * Fixed tabs: Employees, Cycles, Appraisals, ChangeLog.
 * Per-cycle tabs, created when HR creates a cycle:
 *   "Params 2026-11" – the parameters HR set for that month
 *   "Scores 2026-11" – one row per employee per item. Self, Admin, PC and Reporting Manager
 *                      type their points into the `points` column. HR items start at full marks.
 */
export const BASE_TABLES = {
  Employees: ["employeeId", "name", "email", "department", "designation", "role", "managerId", "active"],
  Cycles: ["cycleId", "name", "periodStart", "periodEnd", "selfDue", "reviewDue", "status", "copiedFrom", "createdAt"],
  Appraisals: [
    "appraisalId",
    "cycleId",
    "employeeId",
    "department",
    "designation",
    "managerId",
    "projects",
    "lastReminderAt",
    "approvedBy",
    "approvedAt",
    "earned",
    "maxPoints",
    "scorePct",
    "updatedAt",
  ],
  ChangeLog: ["timestamp", "userId", "userName", "action", "cycleId", "target", "field", "before", "after", "note"],
} as const;

export const PARAM_HEADERS = [
  "paramId",
  "department",
  "designation",
  "section",
  "appliesTo",
  "project",
  "order",
  "text",
  "ratedBy",
  "maxPoints",
  "minPoints",
  "active",
] as const;

/** Readable columns first so people can find and fill their own rows. */
export const SCORE_HEADERS = [
  "employee",
  "department",
  "designation",
  "section",
  "project",
  "item",
  "scoredBy",
  "minPoints",
  "maxPoints",
  "points",
  "remark",
  "evidence",
  "comment",
  "status",
  "scoreId",
  "appraisalId",
  "paramId",
  "updatedAt",
] as const;

export type BaseTable = keyof typeof BASE_TABLES;
export type TableName = string;
export type Row = Record<string, string>;

export const paramsTable = (cycleId: string) => `Params ${cycleId}`;
export const scoresTable = (cycleId: string) => `Scores ${cycleId}`;

export function headersFor(table: TableName): readonly string[] {
  if (table in BASE_TABLES) return BASE_TABLES[table as BaseTable];
  if (table.startsWith("Params ")) return PARAM_HEADERS;
  if (table.startsWith("Scores ")) return SCORE_HEADERS;
  throw new Error(`Unknown table "${table}"`);
}

/** Primary key column per table (ChangeLog is append-only). */
export function keyFor(table: TableName): string | null {
  if (table === "ChangeLog") return null;
  if (table === "Employees") return "employeeId";
  if (table === "Cycles") return "cycleId";
  if (table === "Appraisals") return "appraisalId";
  if (table.startsWith("Params ")) return "paramId";
  if (table.startsWith("Scores ")) return "scoreId";
  throw new Error(`Unknown table "${table}"`);
}
