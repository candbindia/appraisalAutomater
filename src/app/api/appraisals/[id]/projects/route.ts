import { z } from "zod";
import { run } from "@/lib/api";
import { setProjects } from "@/lib/repo";

const Body = z.object({ projects: z.array(z.string().max(80)).max(10) });

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return run(req, Body, (user, b) => setProjects(user, id, b.projects));
}
