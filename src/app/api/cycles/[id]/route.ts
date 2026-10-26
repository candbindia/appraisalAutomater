import { z } from "zod";
import { run } from "@/lib/api";
import { closeCycle, openCycle, updateCycleDates } from "@/lib/repo";
import { Dates } from "@/lib/validation";

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("dates"), dates: Dates }),
  z.object({ action: z.literal("open") }),
  z.object({ action: z.literal("close") }),
]);

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return run(req, Body, (user, b) => {
    if (b.action === "open") return openCycle(user, id);
    if (b.action === "close") return closeCycle(user, id);
    return updateCycleDates(user, id, b.dates);
  });
}
