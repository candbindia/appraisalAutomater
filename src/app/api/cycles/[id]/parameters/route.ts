import { z } from "zod";
import { run } from "@/lib/api";
import { saveParameters } from "@/lib/repo";
import { ParameterSchema } from "@/lib/validation";

const Body = z.object({
  department: z.string().min(1).max(80),
  designation: z.string().min(1).max(80),
  params: z.array(ParameterSchema).max(200),
});

/** HR: replace the parameters for one department + designation in a draft cycle. */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return run(req, Body, (user, b) => saveParameters(user, id, b.department, b.designation, b.params));
}
