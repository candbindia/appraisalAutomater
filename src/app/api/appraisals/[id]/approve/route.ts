import { z } from "zod";
import { run } from "@/lib/api";
import { approve } from "@/lib/repo";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return run(req, z.object({}), (user) => approve(user, id));
}
