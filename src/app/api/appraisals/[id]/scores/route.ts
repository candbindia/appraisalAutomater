import { z } from "zod";
import { run } from "@/lib/api";
import { saveScores } from "@/lib/repo";
import { RaterSchema } from "@/lib/validation";

const Body = z.object({
  lines: z
    .array(
      z.object({
        paramId: z.string().min(1).max(40),
        points: z.number().int().min(-1000).max(1000).nullable().optional(),
        raterComment: z.string().max(2000).optional(),
        remark: z.string().max(3000).optional(),
        evidence: z.string().max(1000).optional(),
      })
    )
    .max(300),
  submit: z.array(RaterSchema).max(5).default([]),
});

/** Save points/comments for the parts the current user scores; optionally submit those parts. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return run(req, Body, (user, b) => saveScores(user, id, b.lines, b.submit));
}
