import { canUseApp, loadChangeLog } from "@/lib/repo";
import { getCurrentUser } from "@/lib/session";

const COLS = ["timestamp", "userName", "action", "cycleId", "target", "field", "before", "after", "note"] as const;
const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/** Download the full change log as CSV (opens in Excel). */
export async function GET() {
  const user = await getCurrentUser();
  if (!canUseApp(user)) return new Response("Forbidden", { status: 403 });
  const rows = await loadChangeLog();
  const csv = "﻿" + [COLS.join(","), ...rows.map((r) => COLS.map((c) => esc(r[c])).join(","))].join("\r\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="cb-appraisal-changelog-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
