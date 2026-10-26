import { z } from "zod";
import { RATERS } from "./types";

export const RaterSchema = z.enum(RATERS as [string, ...string[]]).transform((v) => v as (typeof RATERS)[number]);
export const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
export const CycleId = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Use YYYY-MM");

export const Dates = z
  .object({ periodStart: IsoDate, periodEnd: IsoDate, selfDue: IsoDate, reviewDue: IsoDate })
  .refine((d) => d.periodStart <= d.periodEnd, { message: "Period end must be after period start." });

export const ParameterSchema = z.object({
  paramId: z.string().max(40),
  department: z.string().max(80),
  designation: z.string().max(80),
  section: z.string().max(120),
  appliesTo: z.enum(["all", "project"]),
  project: z.string().max(80),
  order: z.number(),
  text: z.string().max(3000),
  ratedBy: RaterSchema,
  maxPoints: z.number().int().min(1).max(1000),
  minPoints: z.number().int().min(-1000).max(1000),
  active: z.boolean(),
});
