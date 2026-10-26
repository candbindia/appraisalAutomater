import "server-only";
import { NextResponse } from "next/server";
import type { z } from "zod";
import { canUseApp, WorkflowError } from "./repo";
import { getCurrentUser } from "./session";
import type { Employee } from "./types";

/** Parse the JSON body with a zod schema, run the action as the current user, map errors to JSON. Only HR and the MD get in. */
export async function run<S extends z.ZodTypeAny>(
  req: Request,
  schema: S,
  action: (user: Employee, body: z.infer<S>) => Promise<unknown>
) {
  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request.", issues: parsed.error.issues }, { status: 400 });
  }
  try {
    const user = await getCurrentUser();
    if (!canUseApp(user)) return NextResponse.json({ error: "Only HR and the MD can use this app." }, { status: 403 });
    return NextResponse.json((await action(user, parsed.data)) ?? { ok: true });
  } catch (e) {
    if (e instanceof WorkflowError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error(e);
    return NextResponse.json({ error: e instanceof Error && /Resend/.test(e.message) ? e.message : "Something went wrong. Please try again." }, { status: 500 });
  }
}
