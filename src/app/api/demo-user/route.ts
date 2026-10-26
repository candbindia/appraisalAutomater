import { NextResponse } from "next/server";
import { z } from "zod";
import { DEMO_COOKIE } from "@/lib/session";

/** DEMO ONLY — switches the simulated user. Remove when real sign-in is added. */
export async function POST(req: Request) {
  const parsed = z.object({ employeeId: z.string().regex(/^[A-Za-z0-9_-]{1,40}$/) }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid employee." }, { status: 400 });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(DEMO_COOKIE, parsed.data.employeeId, { httpOnly: true, sameSite: "lax", path: "/" });
  return res;
}
