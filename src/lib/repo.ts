import "server-only";
import { cache } from "react";
import { getStore } from "./data";
import { paramsTable, scoresTable, type Row } from "./data/schema";
import { deptCode, desigCode, templateParameters } from "./data/template";
import {
  appraisalRow,
  cycleName,
  cycleRow,
  deriveStatus,
  evaluate,
  linesFor,
  paramRow,
  parseAppraisal,
  parseCycle,
  parseEmployee,
  parseParam,
  parseScore,
  partsOf,
  scoreLabels,
  str,
  totals,
} from "./model";
import { emailConfigured, mailtoLink, reminderEmail, sendWithResend, type Recipient } from "./notify";
import {
  DEFAULT_DEPARTMENTS,
  DEFAULT_DESIGNATIONS,
  RATER_LABEL,
  type Appraisal,
  type AppraisalStatus,
  type ChangeEntry,
  type Cycle,
  type Employee,
  type LineState,
  type Parameter,
  type Rater,
  type Score,
} from "./types";

/* ====================================================================== */
/* reads                                                                   */
/* ====================================================================== */

export interface Base {
  source: "sheets" | "memory";
  employees: Employee[];
  cycles: Cycle[];
  appraisals: Appraisal[];
}

export interface CycleData {
  params: Parameter[];
  scores: Score[];
}

async function readBase(): Promise<Base> {
  const store = getStore();
  const t = await store.readTables(["Employees", "Cycles", "Appraisals"]);
  return {
    source: store.kind,
    employees: t.Employees.map(parseEmployee).filter((e) => e.employeeId),
    cycles: t.Cycles.map(parseCycle)
      .filter((c) => c.cycleId)
      .sort((a, b) => a.cycleId.localeCompare(b.cycleId)),
    appraisals: t.Appraisals.map(parseAppraisal).filter((a) => a.appraisalId),
  };
}

async function readCycle(cycleId: string): Promise<CycleData> {
  const t = await getStore().readTables([paramsTable(cycleId), scoresTable(cycleId)]);
  return {
    params: (t[paramsTable(cycleId)] ?? []).map(parseParam).filter((p) => p.paramId),
    scores: (t[scoresTable(cycleId)] ?? []).map(parseScore).filter((s) => s.scoreId),
  };
}

/** One batched read per request (deduplicated across server components). */
export const loadBase = cache(readBase);
export const loadCycle = cache(readCycle);

export async function loadChangeLog(): Promise<ChangeEntry[]> {
  const t = await getStore().readTables(["ChangeLog"]);
  return (t.ChangeLog ?? [])
    .map((r) => ({
      timestamp: str(r.timestamp),
      userId: str(r.userId),
      userName: str(r.userName),
      action: str(r.action),
      cycleId: str(r.cycleId),
      target: str(r.target),
      field: str(r.field),
      before: str(r.before),
      after: str(r.after),
      note: str(r.note),
    }))
    .filter((e) => e.timestamp)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

/** The cycle people are working on: the latest open one, else the latest closed one. */
export function currentCycle(cycles: Cycle[]) {
  return [...cycles].reverse().find((c) => c.status === "open") ?? [...cycles].reverse().find((c) => c.status === "closed");
}

export function departmentsAndDesignations(base: Base, params: Parameter[] = []) {
  const departments = [...new Set([...DEFAULT_DEPARTMENTS, ...params.map((p) => p.department)])].filter(Boolean);
  const designations: Record<string, string[]> = {};
  for (const d of departments) {
    designations[d] = [
      ...new Set([
        ...(DEFAULT_DESIGNATIONS[d] ?? DEFAULT_DESIGNATIONS["*"]),
        ...base.employees.filter((e) => e.department === d && e.role !== "md").map((e) => e.designation),
        ...params.filter((p) => p.department === d).map((p) => p.designation),
      ]),
    ].filter(Boolean);
  }
  return { departments, designations };
}

/* ---------- appraisal view ---------- */

export interface Line {
  param: Parameter;
  score: Score | null;
  points: number | null;
  state: LineState;
}

export interface PartState {
  part: Rater;
  total: number;
  scored: number;
  invalid: number;
  complete: boolean;
  raters: Employee[];
  due: string;
  overdue: boolean;
}

export interface AppraisalView {
  appraisal: Appraisal;
  employee: Employee;
  manager: Employee | null;
  cycle: Cycle;
  lines: Line[];
  parts: PartState[];
  totals: ReturnType<typeof totals>;
  status: AppraisalStatus;
  /** Approved, but the sheet has been edited since — the approved snapshot still stands. */
  changedAfterApproval: boolean;
}

/** Who is expected to fill a part in the sheet (used for reminders). */
export function eligibleRaters(part: Rater, a: Appraisal, employees: Employee[]): Employee[] {
  const active = employees.filter((e) => e.active);
  const mds = active.filter((e) => e.role === "md" && e.employeeId !== a.employeeId);
  if (part === "self") return active.filter((e) => e.employeeId === a.employeeId);
  if (part === "manager") {
    const m = active.find((e) => e.employeeId === a.managerId && e.employeeId !== a.employeeId);
    return m ? [m] : mds;
  }
  const holders = active.filter((e) => e.role === part && e.employeeId !== a.employeeId);
  return holders.length ? holders : mds;
}

export function buildView(a: Appraisal, base: Base, cyc: CycleData, today = todayISO()): AppraisalView | null {
  const employee = base.employees.find((e) => e.employeeId === a.employeeId);
  const cycle = base.cycles.find((c) => c.cycleId === a.cycleId);
  if (!employee || !cycle) return null;
  const manager = base.employees.find((e) => e.employeeId === a.managerId) ?? null;

  const byParam = new Map(cyc.scores.filter((s) => s.appraisalId === a.appraisalId).map((s) => [s.paramId, s]));
  const lines: Line[] = linesFor(a, cyc.params).map((param) => {
    const score = byParam.get(param.paramId) ?? null;
    const { points, state } = evaluate(param, score?.pointsRaw);
    return { param, score, points, state };
  });

  const parts: PartState[] = partsOf(lines.map((l) => l.param)).map((part) => {
    const mine = lines.filter((l) => l.param.ratedBy === part);
    const scored = mine.filter((l) => l.points !== null).length;
    const due = part === "self" ? cycle.selfDue : cycle.reviewDue;
    const complete = scored === mine.length;
    return {
      part,
      total: mine.length,
      scored,
      invalid: mine.filter((l) => l.state === "invalid").length,
      complete,
      raters: eligibleRaters(part, a, base.employees),
      due,
      overdue: !complete && !a.approvedAt && cycle.status === "open" && today > due,
    };
  });

  const t = totals(lines);
  return {
    appraisal: a,
    employee,
    manager,
    cycle,
    lines,
    parts,
    totals: t,
    status: deriveStatus(a.approvedAt, t.complete),
    changedAfterApproval: !!a.approvedAt && (a.earned !== t.earned || a.maxPoints !== t.max),
  };
}

/** Views for every appraisal in a cycle with a single read of that cycle's tabs. */
export async function cycleViews(cycleId: string) {
  const [base, cyc] = await Promise.all([loadBase(), loadCycle(cycleId)]);
  return base.appraisals
    .filter((a) => a.cycleId === cycleId)
    .map((a) => buildView(a, base, cyc))
    .filter((v): v is AppraisalView => v !== null);
}

/* ====================================================================== */
/* permissions — only HR and the MD use the app                            */
/* ====================================================================== */

export const isHR = (u: Employee) => u.role === "hr";
export const isMD = (u: Employee) => u.role === "md";
export const canUseApp = (u: Employee) => isHR(u) || isMD(u);

export const canApprove = (u: Employee, v: AppraisalView) => isMD(u) && v.status === "awaiting_approval" && v.cycle.status !== "draft";
/** HR deducts on HR items — never on their own appraisal. */
export const canAdjustHR = (u: Employee, v: AppraisalView) =>
  isHR(u) && u.employeeId !== v.employee.employeeId && v.cycle.status === "open" && !v.appraisal.approvedAt;

/* ====================================================================== */
/* writes                                                                  */
/* ====================================================================== */

export class WorkflowError extends Error {
  constructor(
    message: string,
    public status = 400
  ) {
    super(message);
  }
}

const now = () => new Date().toISOString();

type Change = Partial<Omit<ChangeEntry, "timestamp" | "userId" | "userName">> & { action: string };

/** Every change HR or the MD makes is appended to the ChangeLog tab. */
async function log(user: Employee, changes: Change[]) {
  if (changes.length === 0) return;
  const ts = now();
  await getStore().append(
    "ChangeLog",
    changes.map((c) => ({
      timestamp: ts,
      userId: user.employeeId,
      userName: user.name,
      action: c.action,
      cycleId: c.cycleId ?? "",
      target: c.target ?? "",
      field: c.field ?? "",
      before: c.before ?? "",
      after: c.after ?? "",
      note: c.note ?? "",
    }))
  );
}

function requireHR(user: Employee) {
  if (!isHR(user)) throw new WorkflowError("Only HR can do this.", 403);
}

async function freshView(appraisalId: string) {
  const base = await readBase();
  const a = base.appraisals.find((x) => x.appraisalId === appraisalId);
  if (!a) throw new WorkflowError("Appraisal not found.", 404);
  const cyc = await readCycle(a.cycleId);
  const v = buildView(a, base, cyc);
  if (!v) throw new WorkflowError("Appraisal is missing its employee or cycle record.", 409);
  return { base, cyc, v };
}

/**
 * Make the "Scores" tab match the current parameters and project assignments:
 * add rows for new items, refresh the readable columns, and mark rows for items that no longer
 * apply as "removed". Points, remarks and evidence people typed in are never touched.
 * Approved appraisals are left exactly as they are.
 */
async function syncScores(cycleId: string, onlyAppraisal?: string) {
  const base = await readBase();
  const cyc = await readCycle(cycleId);
  const ts = now();
  const rows: Row[] = [];
  const existing = new Map(cyc.scores.map((s) => [s.scoreId, s]));
  let added = 0;
  let removed = 0;

  for (const a of base.appraisals) {
    if (a.cycleId !== cycleId || a.approvedAt || (onlyAppraisal && a.appraisalId !== onlyAppraisal)) continue;
    const e = base.employees.find((x) => x.employeeId === a.employeeId);
    if (!e) continue;
    const wanted = new Set<string>();
    for (const p of linesFor(a, cyc.params)) {
      const labels = scoreLabels(p, e, a.appraisalId);
      wanted.add(labels.scoreId);
      if (!existing.has(labels.scoreId)) {
        rows.push({ ...labels, points: "", remark: "", evidence: "", comment: "", status: "", updatedAt: ts });
        added++;
      } else {
        rows.push({ ...labels, status: "" });
      }
    }
    for (const s of cyc.scores) {
      if (s.appraisalId === a.appraisalId && !wanted.has(s.scoreId) && s.status !== "removed") {
        rows.push({ scoreId: s.scoreId, status: "removed", updatedAt: ts });
        removed++;
      }
    }
  }
  await getStore().upsert(scoresTable(cycleId), rows);
  return { added, removed };
}

/* ---------- HR deductions ---------- */

export interface HrAdjustment {
  paramId: string;
  /** null = back to full marks */
  points: number | null;
  comment: string;
}

export async function adjustHR(user: Employee, appraisalId: string, input: HrAdjustment[]) {
  requireHR(user);
  const { v } = await freshView(appraisalId);
  if (!canAdjustHR(user, v)) {
    throw new WorkflowError(
      user.employeeId === v.employee.employeeId
        ? "You can't change HR points on your own appraisal."
        : "HR points can only be changed while the cycle is open and before approval.",
      403
    );
  }
  const byId = new Map(v.lines.map((l) => [l.param.paramId, l]));
  const ts = now();
  const rows: Row[] = [];
  const changes: Change[] = [];

  for (const i of input) {
    const l = byId.get(i.paramId);
    if (!l) throw new WorkflowError(`Item ${i.paramId} is not on this appraisal.`);
    if (l.param.ratedBy !== "hr") throw new WorkflowError("HR can only change HR items. Other scores are entered in the sheet.", 403);
    const p = i.points;
    if (p !== null && (Number.isNaN(p) || p < l.param.minPoints || p > l.param.maxPoints)) {
      throw new WorkflowError(`Points for "${short(l.param.text)}" must be from ${l.param.minPoints} to ${l.param.maxPoints}.`);
    }
    const full = p === null || p === l.param.maxPoints;
    const comment = full ? "" : i.comment.trim();
    if (!full && comment.length < 3) throw new WorkflowError(`Give a reason for the deduction on "${short(l.param.text)}".`);
    const before = l.points;
    const after = full ? l.param.maxPoints : p;
    if (before === after && (l.score?.comment ?? "") === comment) continue;
    rows.push({ scoreId: `${appraisalId}:${i.paramId}`, points: full ? "" : String(p), comment, updatedAt: ts });
    changes.push({
      action: full ? "hr_deduction_removed" : "hr_deduction",
      cycleId: v.cycle.cycleId,
      target: `${v.employee.name} · ${i.paramId}`,
      field: "points",
      before: before === null ? "" : String(before),
      after: String(after),
      note: comment || short(l.param.text),
    });
  }
  if (rows.length) await getStore().upsert(scoresTable(v.cycle.cycleId), rows);
  await log(user, changes);
  return { changed: rows.length };
}

const short = (t: string) => (t.length > 60 ? t.slice(0, 57) + "…" : t);

/* ---------- approval (MD) ---------- */

export async function approve(user: Employee, appraisalId: string) {
  const { v } = await freshView(appraisalId);
  if (!canApprove(user, v)) throw new WorkflowError("Only the MD can approve, and only once every item has a valid score.", 403);
  const a = v.appraisal;
  a.approvedAt = now();
  a.approvedBy = user.employeeId;
  a.earned = v.totals.earned;
  a.maxPoints = v.totals.max;
  a.scorePct = v.totals.pct;
  a.updatedAt = a.approvedAt;
  await getStore().upsert("Appraisals", [appraisalRow(a)]);
  await log(user, [
    {
      action: "approved",
      cycleId: a.cycleId,
      target: v.employee.name,
      field: "score",
      after: `${v.totals.earned}/${v.totals.max} (${v.totals.pct}%)`,
    },
  ]);
  return { status: "approved" };
}

/* ---------- projects ---------- */

export async function setProjects(user: Employee, appraisalId: string, projects: string[]) {
  requireHR(user);
  const { v } = await freshView(appraisalId);
  const a = v.appraisal;
  if (a.approvedAt) throw new WorkflowError("This appraisal is already approved.");
  if (v.cycle.status !== "open") throw new WorkflowError("Projects can only be changed while the cycle is open.");
  const before = a.projects.join("; ");
  a.projects = [...new Set(projects.map((p) => p.trim()).filter(Boolean))];
  a.updatedAt = now();
  await getStore().upsert("Appraisals", [{ appraisalId, projects: a.projects.join("; "), updatedAt: a.updatedAt }]);
  const sync = await syncScores(a.cycleId, appraisalId);
  await log(user, [
    {
      action: "projects_changed",
      cycleId: a.cycleId,
      target: v.employee.name,
      field: "projects",
      before: before || "(bench)",
      after: a.projects.join("; ") || "(bench)",
      note: `${sync.added} sheet rows added, ${sync.removed} removed`,
    },
  ]);
  return { projects: a.projects };
}

/* ---------- reminders ---------- */

export async function notify(user: Employee, cycleId: string, part: Rater, appraisalIds: string[], channel: "email" | "mailto") {
  requireHR(user);
  const base = await readBase();
  const cycle = base.cycles.find((c) => c.cycleId === cycleId);
  if (!cycle) throw new WorkflowError("Cycle not found.", 404);
  if (cycle.status !== "open") throw new WorkflowError("Reminders can only be sent for an open cycle.");
  const cyc = await readCycle(cycleId);

  const recipients = new Map<string, Recipient>();
  const remindedSelf: string[] = [];
  for (const id of appraisalIds) {
    const a = base.appraisals.find((x) => x.appraisalId === id && x.cycleId === cycleId);
    if (!a) continue;
    const v = buildView(a, base, cyc);
    const p = v?.parts.find((x) => x.part === part);
    if (!v || !p || p.complete) continue;
    for (const r of p.raters) {
      const rec = recipients.get(r.employeeId) ?? { name: r.name, email: r.email, pending: [] };
      rec.pending.push({ employee: v.employee.name, left: p.total - p.scored, total: p.total });
      recipients.set(r.employeeId, rec);
    }
    if (part === "self") remindedSelf.push(a.appraisalId);
  }
  const list = [...recipients.values()];
  if (list.length === 0) throw new WorkflowError("Nobody selected still has pending items.");
  const noEmail = list.filter((r) => !r.email).map((r) => r.name);

  let mailto = "";
  if (channel === "email") {
    if (!emailConfigured()) throw new WorkflowError("Email sending isn't set up (RESEND_API_KEY / NOTIFY_FROM). Use “Open in my email” instead.");
    await sendWithResend(list.filter((r) => r.email).map((r) => ({ to: r.email, ...reminderEmail(part, cycle, r) })));
  } else {
    mailto = mailtoLink(part, cycle, list);
  }

  const ts = now();
  if (remindedSelf.length) await getStore().upsert("Appraisals", remindedSelf.map((appraisalId) => ({ appraisalId, lastReminderAt: ts })));
  await log(user, [
    {
      action: channel === "email" ? "reminder_emailed" : "reminder_drafted",
      cycleId,
      target: list.map((r) => r.name).join(", "),
      field: RATER_LABEL[part],
      note: `${list.length} recipient(s)${noEmail.length ? `; no email address for ${noEmail.join(", ")}` : ""}`,
    },
  ]);
  return { sent: channel === "email" ? list.length - noEmail.length : 0, recipients: list.length, noEmail, mailto };
}

/* ---------- cycles ---------- */

export async function createCycle(
  user: Employee,
  input: { cycleId: string; copyFrom: string; periodStart: string; periodEnd: string; selfDue: string; reviewDue: string }
) {
  requireHR(user);
  const base = await readBase();
  if (base.cycles.some((c) => c.cycleId === input.cycleId)) throw new WorkflowError(`A cycle for ${cycleName(input.cycleId)} already exists.`);

  let params: Parameter[];
  if (input.copyFrom === "workbook") params = templateParameters();
  else {
    if (!base.cycles.some((c) => c.cycleId === input.copyFrom)) throw new WorkflowError("The cycle to copy from doesn't exist.");
    params = (await readCycle(input.copyFrom)).params;
  }

  const store = getStore();
  await store.ensureTable(paramsTable(input.cycleId));
  await store.ensureTable(scoresTable(input.cycleId));
  await store.replaceAll(paramsTable(input.cycleId), params.map(paramRow));
  const cycle: Cycle = {
    cycleId: input.cycleId,
    name: cycleName(input.cycleId),
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    selfDue: input.selfDue,
    reviewDue: input.reviewDue,
    status: "draft",
    copiedFrom: input.copyFrom,
    createdAt: now(),
  };
  await store.upsert("Cycles", [cycleRow(cycle)]);
  await log(user, [
    {
      action: "cycle_created",
      cycleId: cycle.cycleId,
      target: cycle.name,
      note: `${params.length} parameters copied from ${input.copyFrom === "workbook" ? "Appraisal.xlsx" : cycleName(input.copyFrom)}`,
    },
  ]);
  return cycle;
}

export async function updateCycleDates(
  user: Employee,
  cycleId: string,
  dates: { periodStart: string; periodEnd: string; selfDue: string; reviewDue: string }
) {
  requireHR(user);
  const base = await readBase();
  const c = base.cycles.find((x) => x.cycleId === cycleId);
  if (!c) throw new WorkflowError("Cycle not found.", 404);
  if (c.status === "closed") throw new WorkflowError("This cycle is closed.");
  await getStore().upsert("Cycles", [{ cycleId, ...dates }]);
  await log(
    user,
    (Object.keys(dates) as (keyof typeof dates)[])
      .filter((k) => c[k] !== dates[k])
      .map((k) => ({ action: "cycle_dates_changed", cycleId, target: c.name, field: k, before: c[k], after: dates[k] }))
  );
}

const PARAM_FIELDS: (keyof Parameter)[] = ["text", "section", "appliesTo", "project", "ratedBy", "minPoints", "maxPoints", "active"];

/** Field-by-field differences between the old and new parameter list for one sheet. */
function diffParams(cycleId: string, sheet: string, before: Parameter[], after: Parameter[]): Change[] {
  const out: Change[] = [];
  const old = new Map(before.map((p) => [p.paramId, p]));
  const fmt = (v: unknown) => String(v ?? "");
  for (const p of after) {
    const o = old.get(p.paramId);
    if (!o) {
      out.push({
        action: "parameter_added",
        cycleId,
        target: `${sheet} · ${p.paramId}`,
        after: p.text,
        note: `${p.section}; ${RATER_LABEL[p.ratedBy]}; ${p.minPoints}–${p.maxPoints} pts${p.appliesTo === "project" ? `; project ${p.project}` : ""}`,
      });
      continue;
    }
    for (const f of PARAM_FIELDS) {
      if (fmt(o[f]) !== fmt(p[f])) {
        out.push({ action: "parameter_changed", cycleId, target: `${sheet} · ${p.paramId}`, field: f, before: fmt(o[f]), after: fmt(p[f]) });
      }
    }
  }
  for (const o of before) {
    if (!after.some((p) => p.paramId === o.paramId)) {
      out.push({ action: "parameter_deleted", cycleId, target: `${sheet} · ${o.paramId}`, before: o.text });
    }
  }
  const order = (l: Parameter[]) => l.filter((p) => old.has(p.paramId)).map((p) => p.paramId).join(",");
  const beforeOrder = before.filter((p) => after.some((x) => x.paramId === p.paramId)).map((p) => p.paramId).join(",");
  if (order(after) !== beforeOrder) out.push({ action: "parameters_reordered", cycleId, target: sheet });
  return out;
}

export async function saveParameters(user: Employee, cycleId: string, department: string, designation: string, input: Parameter[]) {
  requireHR(user);
  const base = await readBase();
  const c = base.cycles.find((x) => x.cycleId === cycleId);
  if (!c) throw new WorkflowError("Cycle not found.", 404);
  if (c.status === "closed") throw new WorkflowError("This cycle is closed. Change the parameters in an open or upcoming cycle.");

  const { params } = await readCycle(cycleId);
  const mine = params.filter((p) => p.department === department && p.designation === designation).sort((a, b) => a.order - b.order);
  const others = params.filter((p) => !(p.department === department && p.designation === designation));
  const prefix = `${deptCode(department)}-${desigCode(designation)}-`;
  const used = new Set(params.map((p) => p.paramId));
  let next = Math.max(0, ...params.filter((p) => p.paramId.startsWith(prefix)).map((p) => Number(p.paramId.slice(prefix.length)) || 0)) + 1;

  const cleaned = input.map((p, i) => {
    const text = p.text.trim();
    if (!text) throw new WorkflowError(`Item ${i + 1} has no text.`);
    if (!(p.maxPoints > p.minPoints)) throw new WorkflowError(`Item ${i + 1}: maximum points must be higher than minimum points.`);
    if (p.appliesTo === "project" && !p.project.trim()) throw new WorkflowError(`Item ${i + 1} is project-specific but has no project name.`);
    let id = p.paramId;
    if (!mine.some((x) => x.paramId === id)) {
      while (used.has(`${prefix}${String(next).padStart(3, "0")}`)) next++;
      id = `${prefix}${String(next++).padStart(3, "0")}`;
      used.add(id);
    }
    return {
      ...p,
      paramId: id,
      department,
      designation,
      text,
      section: p.section.trim() || "General",
      project: p.appliesTo === "project" ? p.project.trim() : "",
      order: (i + 1) * 10,
    };
  });

  const changes = diffParams(cycleId, `${department} / ${designation}`, mine, cleaned);
  if (changes.length === 0) return { params: cleaned, changes: 0, sync: null };

  await getStore().replaceAll(paramsTable(cycleId), [...others, ...cleaned].map(paramRow));
  const sync = c.status === "open" ? await syncScores(cycleId) : null;
  if (sync) changes.push({ action: "score_sheet_synced", cycleId, target: `Scores ${cycleId}`, note: `${sync.added} rows added, ${sync.removed} marked removed` });
  await log(user, changes);
  return { params: cleaned, changes: changes.length, sync };
}

export async function openCycle(user: Employee, cycleId: string) {
  requireHR(user);
  const base = await readBase();
  const c = base.cycles.find((x) => x.cycleId === cycleId);
  if (!c) throw new WorkflowError("Cycle not found.", 404);
  if (c.status !== "draft") throw new WorkflowError("This cycle is already open or closed.");
  const { params } = await readCycle(cycleId);

  const created: Appraisal[] = [];
  const skipped: string[] = [];
  for (const e of base.employees.filter((x) => x.active && x.role !== "md")) {
    const prev = base.appraisals
      .filter((a) => a.employeeId === e.employeeId && a.cycleId < cycleId)
      .sort((x, y) => y.cycleId.localeCompare(x.cycleId))[0];
    const a: Appraisal = {
      appraisalId: `${cycleId}-${e.employeeId}`,
      cycleId,
      employeeId: e.employeeId,
      department: e.department,
      designation: e.designation,
      managerId: e.managerId,
      projects: prev?.projects ?? [],
      lastReminderAt: "",
      approvedBy: "",
      approvedAt: "",
      earned: null,
      maxPoints: null,
      scorePct: null,
      updatedAt: now(),
    };
    if (linesFor(a, params).length === 0) {
      skipped.push(`${e.name} (${e.department} · ${e.designation})`);
      continue;
    }
    created.push(a);
  }
  if (created.length === 0) throw new WorkflowError("No employee has any parameters in this cycle yet.");

  const store = getStore();
  await store.ensureTable(scoresTable(cycleId));
  await store.upsert("Appraisals", created.map(appraisalRow));
  await store.upsert("Cycles", [{ cycleId, status: "open" }]);
  const sync = await syncScores(cycleId);
  await log(user, [
    {
      action: "cycle_opened",
      cycleId,
      target: c.name,
      note: `${created.length} appraisals, ${sync.added} score rows created${skipped.length ? `; skipped ${skipped.join(", ")}` : ""}`,
    },
  ]);
  return { created: created.length, rows: sync.added, skipped };
}

export async function closeCycle(user: Employee, cycleId: string) {
  requireHR(user);
  const base = await readBase();
  const c = base.cycles.find((x) => x.cycleId === cycleId);
  if (!c || c.status !== "open") throw new WorkflowError("Only an open cycle can be closed.");
  await getStore().upsert("Cycles", [{ cycleId, status: "closed" }]);
  const pending = base.appraisals.filter((a) => a.cycleId === cycleId && !a.approvedAt).length;
  await log(user, [{ action: "cycle_closed", cycleId, target: c.name, note: pending ? `${pending} appraisal(s) not approved` : "" }]);
}
