import { z } from "zod";
import { run } from "@/lib/api";
import { sendBack } from "@/lib/repo";
import { RaterSchema } from "@/lib/validation";

const Body = z.object({ part: RaterSchema, note: z.string().trim().min(3, "Say what needs to change.").max(1000) });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return run(req, Body, (user, b) => sendBack(user, id, b.part, b.note));
}
