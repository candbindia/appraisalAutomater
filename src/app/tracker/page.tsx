import Link from "next/link";
import { AlertTriangle, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NotifyButtons } from "@/components/hr/notify-buttons";
import { SelfTracker, type TrackerRow } from "@/components/hr/self-tracker";
import { Stat } from "@/components/stat";
import { CycleBadge, RaterChip } from "@/components/status-badge";
import { emailConfigured, sheetUrl } from "@/lib/notify";
import { currentCycle, cycleViews, isHR, loadBase } from "@/lib/repo";
import { getCurrentUser } from "@/lib/session";
import { RATER_LABEL, type Rater } from "@/lib/types";
import { cn, daysUntil, formatDate } from "@/lib/utils";

export default async function TrackerPage({ searchParams }: { searchParams: Promise<{ cycle?: string }> }) {
  const [{ cycle: wanted }, user, base] = await Promise.all([searchParams, getCurrentUser(), loadBase()]);
  const live = base.cycles.filter((c) => c.status !== "draft");
  const cycle = live.find((c) => c.cycleId === wanted) ?? currentCycle(base.cycles);
  if (!cycle) return <Card className="p-6 text-sm text-grey">No cycle has been opened yet.</Card>;

  const views = await cycleViews(cycle.cycleId);
  const open = cycle.status === "open";
  const canNotify = isHR(user) && open;
  const emailEnabled = emailConfigured();
  const url = sheetUrl();

  const rows: TrackerRow[] = views
    .flatMap((v) => {
      const p = v.parts.find((x) => x.part === "self");
      if (!p) return [];
      return [
        {
          appraisalId: v.appraisal.appraisalId,
          name: v.employee.name,
          department: v.appraisal.department,
          designation: v.appraisal.designation,
          hasEmail: !!v.employee.email,
          scored: p.scored,
          total: p.total,
          invalid: p.invalid,
          complete: p.complete,
          overdue: p.overdue,
          lastReminderAt: v.appraisal.lastReminderAt,
        },
      ];
    })
    .sort((a, b) => Number(a.complete) - Number(b.complete) || Number(b.overdue) - Number(a.overdue) || a.name.localeCompare(b.name));

  // Other scorers who still owe items, grouped by person.
  const others = (["admin", "pc", "manager"] as Rater[]).flatMap((part) => {
    const byRater = new Map<string, { name: string; ids: string[]; people: string[]; left: number; overdue: boolean }>();
    for (const v of views) {
      const p = v.parts.find((x) => x.part === part);
      if (!p || p.complete || v.appraisal.approvedAt) continue;
      for (const r of p.raters) {
        const g = byRater.get(r.employeeId) ?? { name: r.name, ids: [], people: [], left: 0, overdue: false };
        g.ids.push(v.appraisal.appraisalId);
        g.people.push(v.employee.name);
        g.left += p.total - p.scored;
        g.overdue ||= p.overdue;
        byRater.set(r.employeeId, g);
      }
    }
    return [...byRater.values()].map((g) => ({ part, ...g }));
  });

  const invalid = views.flatMap((v) =>
    v.lines.filter((l) => l.state === "invalid").map((l) => ({ v, l }))
  );
  const days = daysUntil(cycle.selfDue);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-3xl font-bold">Tracker</h1>
            <CycleBadge status={cycle.status} />
          </div>
          <p className="mt-1 text-sm text-grey">
            {cycle.name} · self-assessment due {formatDate(cycle.selfDue)}
            {open && (days < 0 ? ` (${Math.abs(days)} days ago)` : days === 0 ? " (today)" : ` (in ${days} days)`)} · other scores due{" "}
            {formatDate(cycle.reviewDue)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {live.length > 1 && (
            <form className="flex items-center gap-2">
              <select name="cycle" defaultValue={cycle.cycleId} className="h-10 rounded-lg border border-line bg-card px-3 text-sm" aria-label="Cycle">
                {[...live].reverse().map((c) => (
                  <option key={c.cycleId} value={c.cycleId}>
                    {c.name}
                  </option>
                ))}
              </select>
              <button className="h-10 rounded-lg border border-line bg-card px-3 text-sm hover:bg-paper">Show</button>
            </form>
          )}
          {url && (
            <a href={url} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-line bg-card px-3 text-sm hover:bg-paper">
              Open Google Sheet <ExternalLink className="size-3.5" />
            </a>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Self-assessment complete" value={`${rows.filter((r) => r.complete).length}/${rows.length}`} tone="accent" />
        <Stat label="Not complete" value={rows.filter((r) => !r.complete).length} />
        <Stat label="Overdue" value={rows.filter((r) => r.overdue).length} tone="warn" />
        <Stat label="Entries to fix" value={invalid.length} hint="Not a number in range" tone={invalid.length ? "warn" : "default"} />
      </div>

      {!emailEnabled && canNotify && (
        <p className="text-xs text-grey">
          Email sending from the app isn&apos;t set up yet, so &ldquo;Send email&rdquo; is off. &ldquo;Open in my email&rdquo; drafts one
          email to all selected people (BCC) in your own mail app.
        </p>
      )}

      <section className="space-y-3">
        <h2 className="font-display text-xl font-bold">Self-assessment</h2>
        <SelfTracker cycleId={cycle.cycleId} rows={rows} emailEnabled={emailEnabled} open={canNotify} />
      </section>

      <section className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2 [&>*]:min-w-0">
        <Card>
          <CardHeader>
            <CardTitle>Other scores still pending</CardTitle>
          </CardHeader>
          <CardContent className="space-y-0 divide-y divide-line pt-3">
            {others.length === 0 && <p className="text-sm text-grey">Admin, PC and manager scores are all in.</p>}
            {others.map((g) => (
              <div key={`${g.part}-${g.name}`} className="flex flex-wrap items-start justify-between gap-3 py-3">
                <div className="min-w-0 flex-1 basis-56">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{g.name}</span>
                    <RaterChip rater={g.part} />
                    {g.overdue && <span className="text-xs font-medium text-warn">Overdue</span>}
                  </div>
                  <p className="mt-0.5 text-xs text-grey">
                    {g.left} {RATER_LABEL[g.part]} items left for {g.people.length} {g.people.length === 1 ? "person" : "people"}:{" "}
                    {g.people.slice(0, 6).join(", ")}
                    {g.people.length > 6 && ` +${g.people.length - 6}`}
                  </p>
                </div>
                {canNotify && <NotifyButtons cycleId={cycle.cycleId} part={g.part} appraisalIds={g.ids} emailEnabled={emailEnabled} size="sm" />}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className={cn(invalid.length > 0 && "border-[#f1c9ac]")}>
          <CardHeader>
            <CardTitle>Entries to fix in the sheet</CardTitle>
          </CardHeader>
          <CardContent className="pt-3">
            {invalid.length === 0 ? (
              <p className="text-sm text-grey">Every entry in the sheet is a valid number.</p>
            ) : (
              <ul className="divide-y divide-line text-sm">
                {invalid.map(({ v, l }) => (
                  <li key={l.score!.scoreId} className="flex items-start gap-2 py-2">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warn" />
                    <div className="min-w-0">
                      <Link href={`/appraisals/${v.appraisal.appraisalId}`} className="font-medium hover:underline">
                        {v.employee.name}
                      </Link>{" "}
                      <span className="text-grey">
                        entered <code className="rounded bg-paper px-1">{l.score?.pointsRaw}</code> — needs {l.param.minPoints} to{" "}
                        {l.param.maxPoints}
                      </span>
                      <p className="truncate text-xs text-grey">{l.param.text}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
