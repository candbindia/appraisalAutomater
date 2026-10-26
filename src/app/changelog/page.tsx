import { Download } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cycleName } from "@/lib/model";
import { loadChangeLog } from "@/lib/repo";

const ACTION_LABEL: Record<string, string> = {
  cycle_created: "Cycle created",
  cycle_opened: "Cycle opened",
  cycle_closed: "Cycle closed",
  cycle_dates_changed: "Dates changed",
  parameter_added: "Parameter added",
  parameter_changed: "Parameter changed",
  parameter_deleted: "Parameter deleted",
  parameters_reordered: "Parameters reordered",
  score_sheet_synced: "Score sheet updated",
  projects_changed: "Projects changed",
  hr_deduction: "HR deduction",
  hr_deduction_removed: "Deduction removed",
  reminder_emailed: "Reminder emailed",
  reminder_drafted: "Reminder drafted",
  approved: "Approved",
};

export default async function ChangeLogPage({ searchParams }: { searchParams: Promise<{ action?: string; cycle?: string }> }) {
  const [{ action = "", cycle = "" }, all] = await Promise.all([searchParams, loadChangeLog()]);
  const rows = all.filter((r) => (!action || r.action === action) && (!cycle || r.cycleId === cycle));
  const actions = [...new Set(all.map((r) => r.action))].sort();
  const cycles = [...new Set(all.map((r) => r.cycleId).filter(Boolean))].sort().reverse();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Change Log</h1>
          <p className="mt-1 max-w-2xl text-sm text-grey">
            Every change made in the app — parameters (with before and after), deductions, projects, reminders, cycle changes and
            approvals. Stored in the <code>ChangeLog</code> tab of the Google Sheet.
          </p>
        </div>
        <a href="/api/changelog" className={buttonVariants({ variant: "outline" })}>
          <Download /> Download CSV
        </a>
      </div>

      <form className="flex flex-wrap gap-2">
        <select name="action" defaultValue={action} className="h-10 rounded-lg border border-line bg-card px-3 text-sm" aria-label="Action">
          <option value="">All actions</option>
          {actions.map((a) => (
            <option key={a} value={a}>
              {ACTION_LABEL[a] ?? a}
            </option>
          ))}
        </select>
        <select name="cycle" defaultValue={cycle} className="h-10 rounded-lg border border-line bg-card px-3 text-sm" aria-label="Cycle">
          <option value="">All cycles</option>
          {cycles.map((c) => (
            <option key={c} value={c}>
              {cycleName(c)}
            </option>
          ))}
        </select>
        <button className="h-10 rounded-lg border border-line bg-card px-3 text-sm hover:bg-paper">Filter</button>
        <span className="self-center text-sm text-grey">{rows.length} entries</span>
      </form>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-paper text-left text-xs text-grey">
              <tr>
                <th className="px-4 py-2.5 font-medium">When</th>
                <th className="px-4 py-2.5 font-medium">Who</th>
                <th className="px-4 py-2.5 font-medium">What</th>
                <th className="px-4 py-2.5 font-medium">Change</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-grey">
                    No changes recorded yet.
                  </td>
                </tr>
              )}
              {rows.slice(0, 500).map((r, i) => (
                <tr key={i} className="border-t border-line align-top">
                  <td className="whitespace-nowrap px-4 py-2.5 tabular-nums text-grey">
                    {new Date(r.timestamp).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </td>
                  <td className="px-4 py-2.5">{r.userName}</td>
                  <td className="px-4 py-2.5">
                    <div className="font-medium">{ACTION_LABEL[r.action] ?? r.action}</div>
                    <div className="text-xs text-grey">
                      {r.target}
                      {r.cycleId && ` · ${cycleName(r.cycleId)}`}
                    </div>
                  </td>
                  <td className="max-w-xl px-4 py-2.5">
                    {r.field && <span className="mr-1 rounded bg-paper px-1.5 py-0.5 text-xs">{r.field}</span>}
                    {(r.before || r.after) && (
                      <span className="text-sm">
                        {r.before && <span className="text-grey line-through decoration-[#c9c6bd]">{clip(r.before)}</span>}
                        {r.before && r.after && <span className="px-1 text-grey">→</span>}
                        {r.after && <span>{clip(r.after)}</span>}
                      </span>
                    )}
                    {r.note && <div className="mt-0.5 text-xs text-grey">{r.note}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      {rows.length > 500 && <p className="text-xs text-grey">Showing the latest 500. Download the CSV for everything.</p>}
    </div>
  );
}

const clip = (s: string) => (s.length > 160 ? s.slice(0, 157) + "…" : s);
