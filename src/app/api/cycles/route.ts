import { z } from "zod";
import { run } from "@/lib/api";
import { createCycle } from "@/lib/repo";
import { CycleId, Dates } from "@/lib/validation";

const Body = z.intersection(z.object({ cycleId: CycleId, copyFrom: z.union([z.literal("workbook"), CycleId]) }), Dates);

/** HR: create a monthly cycle with its own parameter sheet, copied from a previous cycle or the workbook. */
export async function POST(req: Request) {
  return run(req, Body, (user, b) => createCycle(user, b));
}
