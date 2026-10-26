import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { RaterChip, StatusBadge } from "@/components/status-badge";
import { canApprove, cycleViews, editableParts, loadBase, type AppraisalView } from "@/lib/repo";
import { getCurrentUser } from "@/lib/session";
import { RATERS, RATER_LABEL } from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";

export default async function ReviewsPage() {
  const [user, base] = await Promise.all([getCurrentUser(), loadBase()]);
  const open = base.cycles.filter((c) => c.status === "open");
  const views = (await Promise.all(open.map((c) => cycleViews(c.cycleId)))).flat();

  const toScore = views
    .filter((v) => v.employee.employeeId !== user.employeeId)
    .map((v) => ({ v, parts: editableParts(user, v) }))
    .filter((x) => x.parts.length > 0);
  const toApprove = views.filter((v) => canApprove(user, v));

  const byPart = RATERS.map((part) => ({ part, rows: toScore.filter((x) => x.parts.includes(part)).map((x) => x.v) })).filter(
    (g) => g.rows.length > 0
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-bold">To Score</h1>
        <p className="mt-1 text-sm text-grey">
          {open.length ? `Open cycle${open.length > 1 ? "s" : ""}: ${open.map((c) => c.name).join(", ")}` : "No cycle is open right now."}
        </p>
      </div>

      {toApprove.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-display text-xl font-bold">Awaiting your approval</h2>
          <QueueTable rows={toApprove} part={null} />
        </section>
      )}

      {byPart.map((g) => (
        <section key={g.part} className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-xl font-bold">{RATER_LABEL[g.part]} items</h2>
            <RaterChip rater={g.part}>{g.rows.length} to score</RaterChip>
          </div>
          <QueueTable rows={g.rows} part={g.part} />
        </section>
      ))}

      {toApprove.length === 0 && byPart.length === 0 && (
        <Card className="p-6 text-sm text-grey">Nothing is waiting for you. Your own self-assessment is under My Appraisals.</Card>
      )}
    </div>
  );
}

function QueueTable({ rows, part }: { rows: AppraisalView[]; part: (typeof RATERS)[number] | null }) {
  return (
    <Card className="divide-y divide-line overflow-hidden">
      {rows
        .sort((a, b) => a.employee.department.localeCompare(b.employee.department) || a.employee.name.localeCompare(b.employee.name))
        .map((v) => {
          const p = part ? v.parts.find((x) => x.part === part) : null;
          return (
            <Link
              key={v.appraisal.appraisalId}
              href={`/appraisals/${v.appraisal.appraisalId}`}
              className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-paper"
            >
              <div className="min-w-0 flex-1">
                <div className="font-medium">{v.employee.name}</div>
                <div className="text-xs text-grey">
                  {v.appraisal.designation} · {v.appraisal.department}
                  {v.appraisal.projects.length > 0 && ` · ${v.appraisal.projects.join(", ")}`}
                </div>
              </div>
              {p ? (
                <div className="text-right text-sm">
                  <div className="tabular-nums">
                    {p.scored}/{p.total} scored
                  </div>
                  <div className={cn("text-xs", p.overdue ? "text-warn" : "text-grey")}>
                    {p.overdue ? "Overdue · " : "Due "}
                    {formatDate(p.due)}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <span className="font-display text-lg font-bold tabular-nums">{v.totals.pct ?? "—"}%</span>
                  <StatusBadge status={v.appraisal.status} />
                </div>
              )}
              <ChevronRight className="size-5 text-grey" />
            </Link>
          );
        })}
    </Card>
  );
}
