import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { currentCycle, cycleViews, loadBase } from "@/lib/repo";
import { cn } from "@/lib/utils";

export default async function EmployeesPage({ searchParams }: { searchParams: Promise<{ q?: string; dept?: string }> }) {
  const [{ q = "", dept = "" }, base] = await Promise.all([searchParams, loadBase()]);
  const cycle = currentCycle(base.cycles);
  const views = cycle ? await cycleViews(cycle.cycleId) : [];
  const people = base.employees
    .filter((e) => e.role !== "md")
    .filter((e) => !dept || e.department === dept)
    .filter((e) => !q || `${e.name} ${e.designation} ${e.employeeId}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => a.department.localeCompare(b.department) || a.name.localeCompare(b.name));
  const depts = [...new Set(base.employees.filter((e) => e.role !== "md").map((e) => e.department))].sort();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Employees</h1>
          <p className="mt-1 text-sm text-grey">
            Open anyone&apos;s appraisal to see every item, who scored it and their history. {cycle && `Current cycle: ${cycle.name}.`}
          </p>
        </div>
        <form className="flex flex-wrap gap-2">
          <input name="q" defaultValue={q} placeholder="Search name or designation" className="h-10 w-56 rounded-lg border border-line bg-card px-3 text-sm" />
          <select name="dept" defaultValue={dept} className="h-10 rounded-lg border border-line bg-card px-3 text-sm" aria-label="Department">
            <option value="">All departments</option>
            {depts.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
          <button className="h-10 rounded-lg border border-line bg-card px-3 text-sm hover:bg-paper">Filter</button>
        </form>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-paper text-left text-xs text-grey">
              <tr>
                <th className="px-4 py-2.5 font-medium">Employee</th>
                <th className="px-4 py-2.5 font-medium">Reports to</th>
                <th className="px-4 py-2.5 font-medium">{cycle?.name ?? "Current"} · self items</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 text-right font-medium">Last approved</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {people.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-grey">
                    No one matches.
                  </td>
                </tr>
              )}
              {people.map((e) => {
                const v = views.find((x) => x.employee.employeeId === e.employeeId);
                const self = v?.parts.find((p) => p.part === "self");
                const last = base.appraisals
                  .filter((a) => a.employeeId === e.employeeId && a.approvedAt)
                  .sort((a, b) => b.cycleId.localeCompare(a.cycleId))[0];
                const latest = v?.appraisal ?? base.appraisals.filter((a) => a.employeeId === e.employeeId).sort((a, b) => b.cycleId.localeCompare(a.cycleId))[0];
                const href = latest ? `/appraisals/${latest.appraisalId}` : null;
                return (
                  <tr key={e.employeeId} className={cn("border-t border-line", href && "hover:bg-paper")}>
                    <td className="px-4 py-2.5">
                      {href ? (
                        <Link href={href} className="font-medium hover:underline">
                          {e.name}
                        </Link>
                      ) : (
                        <span className="font-medium">{e.name}</span>
                      )}
                      <div className="text-xs text-grey">
                        {e.designation} · {e.department}
                        {!e.active && <span className="ml-1 text-warn">· inactive</span>}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-grey">{base.employees.find((m) => m.employeeId === e.managerId)?.name ?? "—"}</td>
                    <td className="px-4 py-2.5">
                      {self ? (
                        <span className={cn("tabular-nums", self.complete ? "text-ok" : self.overdue ? "text-warn" : "text-grey")}>
                          {self.scored}/{self.total} {self.complete ? "· complete" : self.overdue ? "· overdue" : ""}
                        </span>
                      ) : (
                        <span className="text-grey">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">{v ? <StatusBadge status={v.status} /> : <span className="text-xs text-grey">Not in this cycle</span>}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{last?.scorePct != null ? `${last.scorePct}%` : "—"}</td>
                    <td className="pr-3">{href && <ChevronRight className="size-4 text-grey" />}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
