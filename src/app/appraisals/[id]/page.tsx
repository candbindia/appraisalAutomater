import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft, CheckCircle2, Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { AppraisalItems } from "@/components/hr/appraisal-items";
import { ApproveButton } from "@/components/hr/approve-button";
import { ProjectsEditor } from "@/components/projects-editor";
import { RaterChip, StatusBadge } from "@/components/status-badge";
import { projectsIn } from "@/lib/model";
import { buildView, canAdjustHR, canApprove, canUseApp, isHR, loadBase, loadCycle } from "@/lib/repo";
import { getCurrentUser } from "@/lib/session";
import { cn, daysUntil, formatDate } from "@/lib/utils";

export default async function AppraisalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [user, base] = await Promise.all([getCurrentUser(), loadBase()]);
  if (!canUseApp(user)) notFound();
  const a = base.appraisals.find((x) => x.appraisalId === decodeURIComponent(id));
  if (!a) notFound();
  const cyc = await loadCycle(a.cycleId);
  const v = buildView(a, base, cyc);
  if (!v) notFound();

  const t = v.totals;
  const approved = !!v.appraisal.approvedAt;
  const history = base.appraisals.filter((x) => x.employeeId === v.employee.employeeId).sort((x, y) => x.cycleId.localeCompare(y.cycleId));
  const invalid = v.lines.filter((l) => l.state === "invalid").length;

  return (
    <div className="space-y-6">
      <Link href="/employees" className="inline-flex items-center gap-1 text-sm text-grey hover:text-ink">
        <ArrowLeft className="size-4" /> Employees
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm text-grey">
            {v.cycle.name} · {formatDate(v.cycle.periodStart)} – {formatDate(v.cycle.periodEnd)}
          </p>
          <h1 className="font-display mt-1 text-3xl font-bold">{v.employee.name}</h1>
          <p className="mt-1 text-sm text-grey">
            {v.appraisal.designation} · {v.appraisal.department} · Reports to {v.manager?.name ?? "—"}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-grey">Projects:</span>
            {isHR(user) && !approved && v.cycle.status === "open" ? (
              <ProjectsEditor appraisalId={v.appraisal.appraisalId} projects={v.appraisal.projects} options={projectsIn(cyc.params)} />
            ) : v.appraisal.projects.length ? (
              v.appraisal.projects.map((p) => (
                <span key={p} className="rounded-full bg-ink px-2.5 py-0.5 text-xs text-paper">
                  {p}
                </span>
              ))
            ) : (
              <span className="text-grey">None (bench)</span>
            )}
          </div>
          {history.length > 1 && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5 text-sm">
              <span className="text-grey">History:</span>
              {history.map((h) => {
                const c = base.cycles.find((x) => x.cycleId === h.cycleId);
                return (
                  <Link
                    key={h.appraisalId}
                    href={`/appraisals/${h.appraisalId}`}
                    className={cn(
                      "rounded-full border px-2.5 py-0.5 text-xs",
                      h.appraisalId === v.appraisal.appraisalId ? "border-ink bg-ink text-paper" : "border-line bg-card hover:border-ink"
                    )}
                  >
                    {c?.name ?? h.cycleId}
                    {h.scorePct !== null && ` · ${h.scorePct}%`}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          <StatusBadge status={v.status} className="text-sm" />
          {canApprove(user, v) && <ApproveButton appraisalId={v.appraisal.appraisalId} label={`${v.employee.name}'s ${v.cycle.name} appraisal`} />}
        </div>
      </div>

      {v.changedAfterApproval && (
        <div className="flex gap-2 rounded-xl border border-[#f1c9ac] bg-warn-soft p-4 text-sm text-warn">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>
            The sheet was edited after approval: it now adds up to {t.earned}/{t.max}. The approved score of {v.appraisal.earned}/
            {v.appraisal.maxPoints} still stands.
          </span>
        </div>
      )}
      {invalid > 0 && (
        <div className="flex gap-2 rounded-xl border border-[#f1c9ac] bg-warn-soft p-4 text-sm text-warn">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>
            {invalid} entr{invalid === 1 ? "y" : "ies"} in the sheet {invalid === 1 ? "isn't" : "aren't"} a valid number and {invalid === 1 ? "counts" : "count"} as
            not filled. Fix {invalid === 1 ? "it" : "them"} in the <code>Scores {v.cycle.cycleId}</code> tab.
          </span>
        </div>
      )}

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <Card className="p-5">
          <div className="text-xs text-grey">{approved ? "Approved score" : "Total score"}</div>
          {approved ? (
            <>
              <div className="font-display mt-1 text-4xl font-bold tabular-nums">{v.appraisal.scorePct}%</div>
              <div className="mt-1 text-sm text-grey tabular-nums">
                {v.appraisal.earned} of {v.appraisal.maxPoints} points · approved {formatDate(v.appraisal.approvedAt)} by{" "}
                {base.employees.find((e) => e.employeeId === v.appraisal.approvedBy)?.name ?? "—"}
              </div>
            </>
          ) : t.complete ? (
            <>
              <div className="font-display mt-1 text-4xl font-bold tabular-nums">{t.pct}%</div>
              <div className="mt-1 text-sm text-grey tabular-nums">
                {t.earned} of {t.max} points · ready for approval
              </div>
            </>
          ) : (
            <>
              <div className="font-display mt-1 text-4xl font-bold tabular-nums">
                {t.earned}
                <span className="text-lg text-grey"> / {t.max} pts so far</span>
              </div>
              <div className="mt-1 text-sm text-grey">
                Pending — {t.scored} of {t.total} items have a valid score
              </div>
            </>
          )}
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-paper">
            <div className={cn("h-full rounded-full", t.complete ? "bg-ok" : "bg-amber")} style={{ width: `${(t.scored / Math.max(1, t.total)) * 100}%` }} />
          </div>
        </Card>

        <Card className="p-5">
          <div className="text-xs text-grey">Who fills what</div>
          <ul className="mt-2 divide-y divide-line">
            {v.parts.map((p) => {
              const d = daysUntil(p.due);
              return (
                <li key={p.part} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
                  <RaterChip rater={p.part} className="w-36 justify-center" />
                  <span className="min-w-0 flex-1 truncate text-grey">
                    {p.part === "hr" ? "HR · full marks unless deducted" : p.raters.map((r) => r.name).join(", ") || "Nobody assigned"}
                  </span>
                  <span className="tabular-nums text-grey">
                    {p.scored}/{p.total}
                    {p.invalid > 0 && <span className="ml-1 text-warn">({p.invalid} invalid)</span>}
                  </span>
                  {p.complete ? (
                    <span className="inline-flex w-32 items-center gap-1 text-ok">
                      <CheckCircle2 className="size-4" /> Complete
                    </span>
                  ) : (
                    <span className={cn("inline-flex w-32 items-center gap-1", p.overdue ? "text-warn" : "text-grey")}>
                      <Clock className="size-4" />
                      {p.overdue ? `${Math.abs(d)}d overdue` : `Due ${formatDate(p.due)}`}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      </div>

      <AppraisalItems
        key={v.lines.map((l) => `${l.param.paramId}=${l.score?.pointsRaw ?? ""}|${l.score?.comment ?? ""}`).join(",")}
        appraisalId={v.appraisal.appraisalId}
        hrEditable={canAdjustHR(user, v)}
        lines={v.lines.map((l) => ({
          paramId: l.param.paramId,
          section: l.param.section,
          project: l.param.appliesTo === "project" ? l.param.project : "",
          text: l.param.text,
          ratedBy: l.param.ratedBy,
          minPoints: l.param.minPoints,
          maxPoints: l.param.maxPoints,
          points: l.points,
          state: l.state,
          raw: l.score?.pointsRaw ?? "",
          comment: l.score?.comment ?? "",
          remark: l.score?.remark ?? "",
          evidence: l.score?.evidence ?? "",
        }))}
      />
    </div>
  );
}
