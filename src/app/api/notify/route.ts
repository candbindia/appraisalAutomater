import { z } from "zod";
import { run } from "@/lib/api";
import { notify } from "@/lib/repo";
import { CycleId, RaterSchema } from "@/lib/validation";

const Body = z.object({
  cycleId: CycleId,
  part: RaterSchema,
  appraisalIds: z.array(z.string().max(60)).min(1, "Select at least one person.").max(500),
  channel: z.enum(["email", "mailto"]),
});

/** HR: remind people who still have items to fill in the sheet. */
export async function POST(req: Request) {
  return run(req, Body, (user, b) => notify(user, b.cycleId, b.part, b.appraisalIds, b.channel));
}
