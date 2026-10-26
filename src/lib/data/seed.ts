/**
 * Sample data for building and testing without Google Sheets.
 * PEOPLE ARE FICTIONAL. Parameters come from Appraisal.xlsx (see template.ts);
 * points per item are placeholders until HR sets them.
 */
import { appraisalRow, cycleName, cycleRow, defaultDates, employeeRow, evaluate, linesFor, paramRow, partsOf, scoreLabels, totals } from "../model";
import type { Appraisal, Cycle, Employee, Rater } from "../types";
import { paramsTable, scoresTable, type Row, type TableName } from "./schema";
import { templateParameters } from "./template";

const MC = "Management Consulting";
const AN = "Analyst / Sr Analyst";

const employees: Employee[] = (
  [
    ["E001", "Arjun Mehta", "Leadership", "Managing Director", "md", ""],
    ["E002", "Kavya Raman", "Support Staff", "HR Executive", "hr", "E001"],
    ["E003", "Suresh Babu", "Support Staff", "Admin Executive", "admin", "E001"],
    ["E004", "Divya Nair", "Support Staff", "Project Coordinator", "pc", "E001"],
    ["E005", "Rahul Iyer", MC, "Manager", "employee", "E001"],
    ["E006", "Priya Shankar", MC, "Team Lead", "employee", "E005"],
    ["E007", "Arun Kumar", MC, AN, "employee", "E006"],
    ["E008", "Meena Joseph", MC, AN, "employee", "E006"],
    ["E009", "Vignesh Ramesh", MC, AN, "employee", "E006"],
    ["E010", "Lakshmi Prasad", MC, "Assistant Manager", "employee", "E005"],
    ["E011", "Anand Krishnan", "Corporate Finance", "Manager", "employee", "E001"],
    ["E012", "Sneha Pillai", "Corporate Finance", AN, "employee", "E011"],
    ["E013", "Farhan Ali", "Internal Audit", "Team Lead", "employee", "E001"],
    ["E014", "Deepa Mohan", "Internal Audit", AN, "employee", "E013"],
    ["E015", "Nithya Sekar", "Taxation", AN, "employee", "E001"],
  ] as const
).map(([employeeId, name, department, designation, role, managerId]) => ({
  employeeId,
  name,
  email: `${name.toLowerCase().replace(/\s+/g, ".")}@example.com`,
  department,
  designation,
  role,
  managerId,
  active: true,
}));

const PROJECTS: Record<string, string[]> = {
  E005: ["Pothys", "Maharaja"],
  E006: ["Pothys"],
  E007: ["Pothys"],
  E009: ["Maharaja"],
  E010: ["Maharaja"],
};

/** Deterministic pseudo-random numbers so the sample looks the same on every restart. */
function rng(seed: string) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Progress = "done" | "partial" | "none";

/** How far each part of the open (October) sheet has been filled in, per employee. HR items start at full marks. */
const OPEN_PROGRESS: Record<string, Partial<Record<Rater, Progress>>> = {
  E005: { self: "done", admin: "done", pc: "partial" },
  E006: { self: "partial", admin: "partial" },
  E007: { self: "done", admin: "done", pc: "done", manager: "done" }, // ready for approval
  E008: {},
  E009: { self: "partial", admin: "done", pc: "partial", manager: "partial" },
  E010: { self: "done" },
  E011: { self: "done", admin: "done", pc: "done", manager: "partial" },
  E012: { self: "done", admin: "done", pc: "done" }, // ready for approval
  E013: { admin: "done" },
  E014: { self: "done", admin: "done" },
  E002: { self: "done", admin: "done", pc: "done" },
  E003: { self: "partial" },
};

/** A few HR deductions so the sample shows how they look. */
const HR_DEDUCTIONS: Record<string, [number, number, string]> = {
  "2026-10-E006": [1, 6, "Keka regularisation submitted 4 days late twice this month."],
  "2026-10-E009": [3, 7, "Slow to respond on the official WhatsApp group during audit week."],
};

export function buildSeed(): Record<TableName, Row[]> {
  const db: Record<TableName, Row[]> = { Employees: employees.map(employeeRow), Cycles: [], Appraisals: [], ChangeLog: [] };
  const template = templateParameters();

  const cycles: [string, Cycle["status"]][] = [
    ["2026-08", "closed"],
    ["2026-09", "closed"],
    ["2026-10", "open"],
    ["2026-11", "draft"],
  ];

  let prev = "workbook";
  for (const [cycleId, status] of cycles) {
    const cycle: Cycle = {
      cycleId,
      name: cycleName(cycleId),
      ...defaultDates(cycleId),
      status,
      copiedFrom: prev,
      createdAt: `${cycleId}-01T09:00:00.000Z`,
    };
    prev = cycleId;
    db.Cycles.push(cycleRow(cycle));
    db[paramsTable(cycleId)] = template.map(paramRow);
    db[scoresTable(cycleId)] = [];
    if (status === "draft") continue;

    for (const e of employees) {
      if (e.role === "md") continue;
      const appraisalId = `${cycleId}-${e.employeeId}`;
      const a: Appraisal = {
        appraisalId,
        cycleId,
        employeeId: e.employeeId,
        department: e.department,
        designation: e.designation,
        managerId: e.managerId,
        projects: PROJECTS[e.employeeId] ?? [],
        lastReminderAt: "",
        approvedBy: "",
        approvedAt: "",
        earned: null,
        maxPoints: null,
        scorePct: null,
        updatedAt: `${cycleId}-20T10:00:00.000Z`,
      };
      const lines = linesFor(a, template);
      const rand = rng(appraisalId);
      const progress: Partial<Record<Rater, Progress>> =
        status === "closed" ? Object.fromEntries(partsOf(lines).map((p) => [p, "done"])) : OPEN_PROGRESS[e.employeeId] ?? {};
      const ts = status === "closed" ? defaultDates(cycleId).reviewDue + "T12:00:00.000Z" : "2026-10-24T11:30:00.000Z";
      const rows: Row[] = [];
      const hrCut = HR_DEDUCTIONS[appraisalId];
      let hrIndex = 0;

      for (const l of lines) {
        const row: Row = { ...scoreLabels(l, e, appraisalId), points: "", remark: "", evidence: "", comment: "", status: "", updatedAt: ts };
        if (l.ratedBy === "hr") {
          hrIndex++;
          if (hrCut && hrCut[0] === hrIndex) {
            row.points = String(hrCut[1]);
            row.comment = hrCut[2];
          } else if (status === "closed" && rand() < 0.15) {
            row.points = String(l.maxPoints - 2);
            row.comment = "Minor lapse noted by HR.";
          }
        } else {
          const pr = progress[l.ratedBy] ?? "none";
          const partLines = lines.filter((x) => x.ratedBy === l.ratedBy);
          const idx = partLines.indexOf(l);
          if (pr === "done" || (pr === "partial" && idx < Math.ceil(partLines.length / 2))) {
            const bias = l.ratedBy === "self" ? 7 : 6;
            row.points = String(Math.max(l.minPoints, Math.min(l.maxPoints, bias + Math.floor(rand() * 4) - (rand() < 0.05 ? 4 : 0))));
          }
          if (l.ratedBy === "self" && /WOW/i.test(l.text) && row.points) row.remark = "Closed the store walkthrough report two days early.";
        }
        rows.push(row);
      }
      // One typo in the open sheet, to show how the app flags entries it can't read.
      if (e.employeeId === "E010" && status === "open") {
        const r = rows.find((x) => x.scoredBy === "Self");
        if (r) r.points = "8/10";
      }

      if (status === "closed") {
        const t = totals(lines.map((l) => ({ param: l, points: evaluate(l, rows.find((r) => r.paramId === l.paramId)?.points).points })));
        a.approvedAt = ts;
        a.approvedBy = "E001";
        a.earned = t.earned;
        a.maxPoints = t.max;
        a.scorePct = t.pct;
      }
      db.Appraisals.push(appraisalRow(a));
      db[scoresTable(cycleId)].push(...rows);
    }
  }
  return db;
}
