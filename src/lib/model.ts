/**
 * Pure model logic shared by the server, the seed and the browser:
 * row ⇄ object conversion and the rules for which parameters apply, who scores what,
 * how totals are computed and what status an appraisal is in.
 */
import type { Row } from "./data/schema";
import {
  RATERS,
  RATER_LABEL,
  ROLES,
  type Appraisal,
  type AppraisalStatus,
  type AppliesTo,
  type Cycle,
  type CycleStatus,
  type Employee,
  type LineState,
  type Parameter,
  type Rater,
  type Role,
  type Score,
} from "./types";

/* ---------- cell parsing (sheet rows are strings) ---------- */

export const str = (v: string | undefined) => String(v ?? "").trim();
const bool = (v: string | undefined, d = true) => {
  const t = str(v).toLowerCase();
  if (t === "") return d;
  return ["true", "yes", "1", "y"].includes(t);
};
const num = (v: string | undefined, d = 0) => {
  const t = str(v);
  const n = Number(t);
  return t === "" || Number.isNaN(n) ? d : n;
};
const numOrNull = (v: string | undefined) => {
  const t = str(v);
  if (t === "") return null;
  const n = Number(t);
  return Number.isNaN(n) ? null : n;
};
const cell = (v: number | null) => (v === null ? "" : String(v));
const isRater = (v: string): v is Rater => (RATERS as string[]).includes(v);

export const splitList = (v: string) =>
  str(v)
    .split(/[;\n]/)
    .map((s) => s.trim())
    .filter(Boolean);

/* ---------- employees ---------- */

export const parseEmployee = (r: Row): Employee => ({
  employeeId: str(r.employeeId),
  name: str(r.name),
  email: str(r.email),
  department: str(r.department),
  designation: str(r.designation),
  role: (ROLES as string[]).includes(str(r.role).toLowerCase()) ? (str(r.role).toLowerCase() as Role) : "employee",
  managerId: str(r.managerId),
  active: bool(r.active),
});

export const employeeRow = (e: Employee): Row => ({
  ...e,
  active: e.active ? "TRUE" : "FALSE",
});

/* ---------- cycles ---------- */

export const parseCycle = (r: Row): Cycle => {
  const s = str(r.status).toLowerCase();
  return {
    cycleId: str(r.cycleId),
    name: str(r.name),
    periodStart: str(r.periodStart),
    periodEnd: str(r.periodEnd),
    selfDue: str(r.selfDue),
    reviewDue: str(r.reviewDue),
    status: (["draft", "open", "closed"].includes(s) ? s : "draft") as CycleStatus,
    copiedFrom: str(r.copiedFrom),
    createdAt: str(r.createdAt),
  };
};

export const cycleRow = (c: Cycle): Row => ({ ...c });

/* ---------- parameters ---------- */

export const parseParam = (r: Row): Parameter => {
  const rated = str(r.ratedBy).toLowerCase();
  return {
    paramId: str(r.paramId),
    department: str(r.department),
    designation: str(r.designation),
    section: str(r.section) || "General",
    appliesTo: (str(r.appliesTo).toLowerCase() === "project" ? "project" : "all") as AppliesTo,
    project: str(r.project),
    order: num(r.order),
    text: str(r.text),
    ratedBy: isRater(rated) ? rated : "manager",
    maxPoints: num(r.maxPoints, 10),
    minPoints: num(r.minPoints, 0),
    active: bool(r.active),
  };
};

export const paramRow = (p: Parameter): Row => ({
  paramId: p.paramId,
  department: p.department,
  designation: p.designation,
  section: p.section,
  appliesTo: p.appliesTo,
  project: p.appliesTo === "project" ? p.project : "",
  order: String(p.order),
  text: p.text,
  ratedBy: p.ratedBy,
  maxPoints: String(p.maxPoints),
  minPoints: String(p.minPoints),
  active: p.active ? "TRUE" : "FALSE",
});

/* ---------- appraisals ---------- */

export const parseAppraisal = (r: Row): Appraisal => ({
  appraisalId: str(r.appraisalId),
  cycleId: str(r.cycleId),
  employeeId: str(r.employeeId),
  department: str(r.department),
  designation: str(r.designation),
  managerId: str(r.managerId),
  projects: splitList(r.projects),
  lastReminderAt: str(r.lastReminderAt),
  approvedBy: str(r.approvedBy),
  approvedAt: str(r.approvedAt),
  earned: numOrNull(r.earned),
  maxPoints: numOrNull(r.maxPoints),
  scorePct: numOrNull(r.scorePct),
  updatedAt: str(r.updatedAt),
});

export const appraisalRow = (a: Appraisal): Row => ({
  appraisalId: a.appraisalId,
  cycleId: a.cycleId,
  employeeId: a.employeeId,
  department: a.department,
  designation: a.designation,
  managerId: a.managerId,
  projects: a.projects.join("; "),
  lastReminderAt: a.lastReminderAt,
  approvedBy: a.approvedBy,
  approvedAt: a.approvedAt,
  earned: cell(a.earned),
  maxPoints: cell(a.maxPoints),
  scorePct: cell(a.scorePct),
  updatedAt: a.updatedAt,
});

/* ---------- scores ---------- */

export const parseScore = (r: Row): Score => ({
  scoreId: str(r.scoreId),
  appraisalId: str(r.appraisalId),
  paramId: str(r.paramId),
  pointsRaw: str(r.points),
  comment: str(r.comment),
  remark: str(r.remark),
  evidence: str(r.evidence),
  status: str(r.status).toLowerCase() === "removed" ? "removed" : "",
  updatedAt: str(r.updatedAt),
});

/** The readable columns of a score row (what people see when filling the sheet). */
export function scoreLabels(p: Parameter, e: { name: string }, appraisalId: string): Row {
  return {
    scoreId: `${appraisalId}:${p.paramId}`,
    appraisalId,
    paramId: p.paramId,
    employee: e.name,
    department: p.department,
    designation: p.designation,
    section: p.section,
    project: p.appliesTo === "project" ? p.project : "",
    item: p.text,
    scoredBy: RATER_LABEL[p.ratedBy],
    minPoints: String(p.minPoints),
    maxPoints: String(p.maxPoints),
  };
}

/* ---------- rules ---------- */

/** Parameters that appear on this appraisal: its department + designation, plus project items for assigned projects. */
export function linesFor(a: Pick<Appraisal, "department" | "designation" | "projects">, params: Parameter[]) {
  const projects = new Set(a.projects.map((p) => p.toLowerCase()));
  return params
    .filter(
      (p) =>
        p.active &&
        p.department === a.department &&
        p.designation === a.designation &&
        (p.appliesTo === "all" || projects.has(p.project.toLowerCase()))
    )
    .sort((x, y) => x.order - y.order || x.paramId.localeCompare(y.paramId));
}

/** The parts (raters) present in this set of lines, in a fixed order. */
export function partsOf(lines: Pick<Parameter, "ratedBy">[]): Rater[] {
  const used = new Set(lines.map((l) => l.ratedBy));
  return RATERS.filter((r) => used.has(r));
}

/**
 * Read one item's points. HR items count as full marks unless HR has deducted.
 * Anything that isn't a number within the item's range is "invalid" and counts as not scored.
 */
export function evaluate(p: Pick<Parameter, "ratedBy" | "minPoints" | "maxPoints">, raw: string | undefined) {
  const t = str(raw).replace(",", ".");
  if (t === "") {
    return p.ratedBy === "hr"
      ? { points: p.maxPoints, state: "full_default" as LineState }
      : { points: null, state: "empty" as LineState };
  }
  const n = Number(t);
  if (Number.isNaN(n) || n < p.minPoints || n > p.maxPoints) return { points: null, state: "invalid" as LineState };
  return { points: n, state: "scored" as LineState };
}

/** Group lines into sections in order of first appearance. */
export function groupBySection<T extends { param: Parameter }>(lines: T[]) {
  const groups: { section: string; project: string; lines: T[] }[] = [];
  for (const l of lines) {
    const project = l.param.appliesTo === "project" ? l.param.project : "";
    let g = groups.find((x) => x.section === l.param.section && x.project === project);
    if (!g) groups.push((g = { section: l.param.section, project, lines: [] }));
    g.lines.push(l);
  }
  return groups;
}

/**
 * Total = points earned ÷ maximum points × 100.
 * A missing or invalid score is NEVER treated as zero: while any line is unscored the percentage is null (pending).
 */
export function totals(lines: { param: Pick<Parameter, "maxPoints">; points: number | null }[]) {
  let earned = 0;
  let max = 0;
  let scored = 0;
  for (const l of lines) {
    max += l.param.maxPoints;
    if (l.points !== null) {
      earned += l.points;
      scored++;
    }
  }
  earned = Math.round(earned * 100) / 100;
  const complete = lines.length > 0 && scored === lines.length;
  const pct = complete && max > 0 ? Math.round((earned / max) * 1000) / 10 : null;
  return { earned, max, scored, total: lines.length, complete, pct };
}

export function deriveStatus(approvedAt: string, complete: boolean): AppraisalStatus {
  if (approvedAt) return "approved";
  return complete ? "awaiting_approval" : "in_progress";
}

/** Projects HR has defined parameters for in a cycle. */
export function projectsIn(params: Parameter[]) {
  return [...new Set(params.filter((p) => p.appliesTo === "project" && p.project).map((p) => p.project))].sort();
}

/** "2026-11" → "November 2026" */
export function cycleName(cycleId: string) {
  const [y, m] = cycleId.split("-").map(Number);
  if (!y || !m) return cycleId;
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
}

/** Default dates for a month: period = the month, self due 3rd and reviews due 8th of the next month. */
export function defaultDates(cycleId: string) {
  const [y, m] = cycleId.split("-").map(Number);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return {
    periodStart: iso(new Date(Date.UTC(y, m - 1, 1))),
    periodEnd: iso(new Date(Date.UTC(y, m, 0))),
    selfDue: iso(new Date(Date.UTC(y, m, 3))),
    reviewDue: iso(new Date(Date.UTC(y, m, 8))),
  };
}
