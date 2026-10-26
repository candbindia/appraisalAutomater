import { z } from "zod";
import { run } from "@/lib/api";
import { adjustHR } from "@/lib/repo";

const Body = z.object({
  lines: z
    .array(z.object({ paramId: z.string().min(1).max(40), points: z.number().min(-1000).max(1000).nullable(), comment: z.string().max(1000) }))
    .min(1)
    .max(100),
});

/** HR: deduct points on HR items (or restore full marks). Every change goes to the ChangeLog. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return run(req, Body, (user, b) => adjustHR(user, id, b.lines));
}
