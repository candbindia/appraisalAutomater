import Link from "next/link";
import { AlertTriangle, ArrowRight, ListChecks, Settings2 } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DeptProgress, ScoreTrend } from "@/components/charts";
import { Stat } from "@/components/stat";
import { RaterChip, StatusBadge } from "@/components/status-badge";
import { currentCycle, cycleViews, isHR, isMD, loadBase } from "@/lib/repo";
import { getCurrentUser } from "@/lib/session";
import { RATERS } from "@/lib/types";
import { daysUntil, formatDate } from "@/lib/utils";

export default async function DashboardPage() {
  const [user, base] = await Promise.all([getCurrentUser(), loadBase()]);
  const cycle = currentCycle(base.cycles);
  const views = cycle ? await cycleViews(cycle.cycleId) : [];
  const draft = base.cycles.find((c) => c.status === "draft");

  const n = views.length;
  const selfDone = views.filter((v) => v.parts.find((p) => p.part === "self")?.complete).length;
  const withSelf = views.filter((v) => v.parts.some((p) => p.part === "self")).length;
  const overdueSelf = views.filter((v) => v.parts.find((p) => p.part === "self")?.overdue);
  const ready = views.filter((v) => v.status === "awaiting_approval");
  const approved = views.filter((v) => v.status === "approved").length;
  const invalid = views.reduce((s, v) => s + v.lines.filter((l) => l.state === "invalid").length, 0);
  const deductions = views.reduce((s, v) => s + v.lines.filter((l) => l.param.ratedBy === "hr" && l.state === "scored" && l.points! < l.param.maxPoints).length, 0);

  const trend = base.cycles
    .filter((c) => c.status !== "draft")
    .map((c) => {
      const done = base.appraisals.filter((a) => a.cycleId === c.cycleId && a.scorePct !== null && a.approvedAt);
      return {
        cycle: c.name.slice(0, 3),
        score: done.length ? Math.round((done.reduce((s, a) => s + a.scorePct!, 0) / done.length) * 10) / 10 : null,
      };
    });

  const partStats = RATERS.filter((r) => r !== "hr")
    .map((part) => {
      const withPart = views.filter((v) => v.parts.some((p) => p.part === part));
      return {
        part,
        total: withPart.length,
        done: withPart.filter((v) => v.parts.find((p) => p.part === part)?.complete).length,
        overdue: withPart.filter((v) => v.parts.find((p) => p.part === part)?.overdue).length,
      };
    })
    .filter((p) => p.total > 0);
  const depts = [...new Set(views.map((v) => v.appraisal.department))].sort();
  const selfDays = cycle ? daysUntil(cycle.selfDue) : 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-grey">{cycle ? `${cycle.name} review cycle` : "No review cycle yet"}</p>
          <h1 className="font-display mt-1 text-3xl font-bold md:text-4xl">Hello, {user.name.split(" ")[0]}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/tracker" className={buttonVariants({ variant: "outline" })}>
            <ListChecks /> Tracker
          </Link>
          {isHR(user) && (
            <Link href={draft ? `/admin/cycles/${draft.cycleId}` : "/admin/cycles"} className={buttonVariants()}>
              <Settings2 /> {draft ? `Set up ${draft.name}` : "Cycles & parameters"}
            </Link>
          )}
        </div>
      </div>

      {!cycle ? (
        <Card className="p-6 text-sm text-grey">
          No cycle has been opened yet. {isHR(user) && "Create one under Cycles & Parameters to get started."}
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat
              label="Self-assessments complete"
              value={`${selfDone}/${withSelf}`}
              hint={cycle.status === "open" ? `Due ${formatDate(cycle.selfDue)}${selfDays < 0 ? " · passed" : ` · ${selfDays} days left`}` : undefined}
              tone="accent"
            />
            <Stat label="Self-assessment overdue" value={overdueSelf.length} tone={overdueSelf.length ? "warn" : "default"} />
            <Stat label="Ready for approval" value={ready.length} />
            <Stat label="Approved" value={`${approved}/${n}`} hint={`${Math.round((approved / Math.max(1, n)) * 100)}% of the cycle`} />
          </div>

          {(overdueSelf.length > 0 || invalid > 0) && isHR(user) && (
            <Card className="border-[#f1c9ac]">
              <CardContent className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-start gap-2 text-sm">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warn" />
                  <span>
                    {overdueSelf.length > 0 && (
                      <>
                        <strong>{overdueSelf.length}</strong> self-assessment{overdueSelf.length === 1 ? " is" : "s are"} overdue
                        {overdueSelf.length <= 4 && `: ${overdueSelf.map((v) => v.employee.name).join(", ")}`}.{" "}
                      </>
                    )}
                    {invalid > 0 && (
                      <>
                        <strong>{invalid}</strong> sheet entr{invalid === 1 ? "y needs" : "ies need"} fixing.
                      </>
                    )}
                  </span>
                </div>
                <Link href="/tracker" className={buttonVariants({ size: "sm" })}>
                  Notify defaulters <ArrowRight />
                </Link>
              </CardContent>
            </Card>
          )}

          {isMD(user) && (
            <section className="space-y-3">
              <h2 className="font-display text-xl font-bold">Ready for your approval</h2>
              {ready.length === 0 ? (
                <Card className="p-5 text-sm text-grey">Nothing waiting. Appraisals show up here once every item has a valid score.</Card>
              ) : (
                <Card className="divide-y divide-line overflow-hidden">
                  {ready.map((v) => (
                    <Link
                      key={v.appraisal.appraisalId}
                      href={`/appraisals/${v.appraisal.appraisalId}`}
                      className="flex items-center gap-4 px-5 py-3 hover:bg-paper"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-medium">{v.employee.name}</div>
                        <div className="text-xs text-grey">
                          {v.appraisal.designation} · {v.appraisal.department}
                        </div>
                      </div>
                      <span className="font-display text-lg font-bold tabular-nums">{v.totals.pct}%</span>
                      <ArrowRight className="size-4 text-grey" />
                    </Link>
                  ))}
                </Card>
              )}
            </section>
          )}

          <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2 [&>*]:min-w-0">
            <Card>
              <CardHeader>
                <CardTitle>Scores entered in the sheet</CardTitle>
                <span className="text-xs text-grey">{deductions} HR deduction(s) this cycle</span>
              </CardHeader>
              <CardContent className="space-y-3">
                {partStats.map((p) => (
                  <div key={p.part}>
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <RaterChip rater={p.part} />
                      <span className="tabular-nums text-grey">
                        {p.done}/{p.total} complete
                        {p.overdue > 0 && <span className="ml-2 text-warn">{p.overdue} overdue</span>}
                      </span>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-paper">
                      <div className="h-full rounded-full bg-amber" style={{ width: `${(p.done / p.total) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Progress by department</CardTitle>
              </CardHeader>
              <CardContent>
                <DeptProgress
                  data={depts.map((dept) => {
                    const d = views.filter((v) => v.appraisal.department === dept);
                    return {
                      dept,
                      approved: d.filter((v) => v.status === "approved").length,
                      awaiting: d.filter((v) => v.status === "awaiting_approval").length,
                      inProgress: d.filter((v) => v.status === "in_progress").length,
                    };
                  })}
                />
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1fr_1.2fr] [&>*]:min-w-0">
            <Card>
              <CardHeader>
                <CardTitle>Average approved score</CardTitle>
              </CardHeader>
              <CardContent className="pt-3">
                <ScoreTrend data={trend} />
              </CardContent>
            </Card>
            <Card className="overflow-hidden">
              <CardHeader>
                <CardTitle>Recently ready or approved</CardTitle>
                <Link href="/employees" className="text-sm text-grey hover:text-ink">
                  All employees →
                </Link>
              </CardHeader>
              <CardContent className="p-0 pt-3">
                <ul className="divide-y divide-line text-sm">
                  {views
                    .filter((v) => v.status !== "in_progress")
                    .slice(0, 6)
                    .map((v) => (
                      <li key={v.appraisal.appraisalId}>
                        <Link href={`/appraisals/${v.appraisal.appraisalId}`} className="flex items-center gap-3 px-5 py-2.5 hover:bg-paper">
                          <span className="min-w-0 flex-1 truncate">{v.employee.name}</span>
                          <StatusBadge status={v.status} />
                          <span className="w-14 text-right tabular-nums">{(v.appraisal.scorePct ?? v.totals.pct) ?? "—"}%</span>
                        </Link>
                      </li>
                    ))}
                  {views.every((v) => v.status === "in_progress") && <li className="px-5 py-3 text-grey">None yet this cycle.</li>}
                </ul>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
