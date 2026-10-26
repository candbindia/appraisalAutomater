/**
 * Starting parameter set built from Appraisal.xlsx. Used when HR creates the very first
 * cycle (or chooses "Start from Appraisal.xlsx") — later cycles copy the previous month.
 *
 * - MC items come straight from the workbook.
 * - Corporate Finance, Internal Audit and Taxation start as a copy of MC ("almost the same") for HR to adjust.
 * - Assistant Manager has no column in the workbook; it starts as a copy of Manager.
 * - Support Staff parameters are different and not in the workbook yet; they start with the
 *   HR / Admin & General section only.
 * - Project-specific rows are blank in the workbook; a few clearly-labelled SAMPLE items are added
 *   under the Pothys and Maharaja projects so the flow can be tested. HR should replace them.
 */
import type { Parameter, Rater } from "../types";
import { MC_WORKBOOK_ITEMS } from "./workbook-params";

const DEPT_CODE: Record<string, string> = {
  "Management Consulting": "MC",
  "Corporate Finance": "CF",
  "Internal Audit": "IA",
  Taxation: "TX",
  "Support Staff": "SS",
};

const DESIG_CODE: Record<string, string> = {
  "Analyst / Sr Analyst": "AN",
  "Team Lead": "TL",
  "Assistant Manager": "AM",
  Manager: "MG",
  "HR Executive": "HR",
  "Admin Executive": "AD",
  "Project Coordinator": "PC",
};

export const deptCode = (d: string) => DEPT_CODE[d] ?? d.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase();
export const desigCode = (d: string) => DESIG_CODE[d] ?? d.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase();

const SAMPLE_PROJECT_ITEMS: [string, Rater][] = [
  ["SAMPLE – Project deliverables completed as per the agreed milestones (HR to replace with real project parameters)", "manager"],
  ["SAMPLE – Quality of observations and reports submitted to the project lead (HR to replace)", "manager"],
  ["SAMPLE – Project trackers and MoM updated in the designated location (HR to replace)", "self"],
];

interface Item {
  designation: string;
  section: string;
  appliesTo: "all" | "project";
  project: string;
  ratedBy: Rater;
  text: string;
}

function mcItems(): Item[] {
  const base: Item[] = MC_WORKBOOK_ITEMS.map(([designation, section, appliesTo, project, ratedBy, , text]) => ({
    designation,
    section,
    appliesTo,
    project,
    ratedBy,
    text,
  }));
  const am = base.filter((i) => i.designation === "Manager").map((i) => ({ ...i, designation: "Assistant Manager" }));
  const samples: Item[] = [];
  for (const designation of ["Analyst / Sr Analyst", "Team Lead"]) {
    for (const project of ["Pothys", "Maharaja"]) {
      for (const [text, ratedBy] of SAMPLE_PROJECT_ITEMS) {
        samples.push({ designation, section: "Project-specific", appliesTo: "project", project, ratedBy, text });
      }
    }
  }
  return [...base, ...am, ...samples];
}

function supportItems(): Item[] {
  const general = MC_WORKBOOK_ITEMS.filter(([d, s]) => d === "Analyst / Sr Analyst" && s === "HR / Admin & General");
  return ["HR Executive", "Admin Executive", "Project Coordinator"].flatMap((designation) =>
    general.map(([, section, appliesTo, project, ratedBy, , text]) => ({ designation, section, appliesTo, project, ratedBy, text }))
  );
}

export function templateParameters(): Parameter[] {
  const out: Parameter[] = [];
  const build = (department: string, items: Item[]) => {
    const counters = new Map<string, number>();
    for (const i of items) {
      const n = (counters.get(i.designation) ?? 0) + 1;
      counters.set(i.designation, n);
      out.push({
        paramId: `${deptCode(department)}-${desigCode(i.designation)}-${String(n).padStart(3, "0")}`,
        department,
        designation: i.designation,
        section: i.section,
        appliesTo: i.appliesTo,
        project: i.project,
        order: n * 10,
        text: i.text,
        ratedBy: i.ratedBy,
        maxPoints: 10,
        minPoints: /negative point/i.test(i.text) ? -5 : 0,
        active: true,
      });
    }
  };
  const mc = mcItems();
  for (const d of ["Management Consulting", "Corporate Finance", "Internal Audit", "Taxation"]) build(d, mc);
  build("Support Staff", supportItems());
  return out;
}
