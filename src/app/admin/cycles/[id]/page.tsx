import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Card } from "@/components/ui/card";
import { CycleActions } from "@/components/admin/cycle-actions";
import { ParamEditor } from "@/components/admin/param-editor";
import { ProjectsEditor } from "@/components/projects-editor";
import { CycleBadge, StatusBadge } from "@/components/status-badge";
import { linesFor, projectsIn } from "@/lib/model";
import { cycleViews, departmentsAndDesignations, isHR, loadBase, loadCycle } from "@/lib/repo";
import { getCurrentUser } from "@/lib/session";
import { cn, formatDate } from "@/lib/utils";

export default async function CyclePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const [{ id }, { tab }] = await Promise.all([params, searchParams]);
  const [user, base] = await Promise.all([getCurrentUser(), loadBase()]);
  if (!isHR(user)) return <Card className="p-6 text-sm text-grey">Only HR can manage review cycles and parameters.</Card>;
  const cycle = base.cycles.find((c) => c.cycleId === id);
  if (!cycle) notFound();
  const cyc = await loadCycle(cycle.cycleId);
  const { departments, designations } = departmentsAndDesignations(base, cyc.params);

  const staff = base.employees.filter((e) => e.active && e.role !== "md");
  const headcount: Record<string, number> = {};
  for (const e of staff) headcount[`${e.department}|${e.designation}`] = (headcount[`${e.department}|${e.designation}`] ?? 0) + 1;
  const withoutParams = staff
    .filter((e) => linesFor({ department: e.department, designation: e.designation, projects: [] }, cyc.params).length === 0)
    .map((e) => `${e.name} (${e.department} · ${e.designation})`);

  const activeTab = cycle.status === "draft" ? "parameters" : tab === "parameters" ? "parameters" : "people";
  const views = activeTab === "people" ? await cycleViews(cycle.cycleId) : [];
  const projectOptions = projectsIn(cyc.params);

  return (
    <div className="space-y-6">
      <Link href="/admin/cycles" className="inline-flex items-center gap-1 text-sm text-grey hover:text-ink">
        <ArrowLeft className="size-4" /> Cycles &amp; Parameters
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-3xl font-bold">{cycle.name}</h1>
            <CycleBadge status={cycle.status} />
          </div>
          <p className="mt-1 text-sm text-grey">
            {formatDate(cycle.periodStart)} – {formatDate(cycle.periodEnd)} · self due {formatDate(cycle.selfDue)} · reviews due{" "}
            {formatDate(cycle.reviewDue)}
          </p>
          <p className="mt-1 text-xs text-grey">
            Sheet tabs: <code>Params {cycle.cycleId}</code> (HR&apos;s parameters) and <code>Scores {cycle.cycleId}</code> (where
            everyone enters points)
          </p>
        </div>
        <CycleActions cycle={cycle} peopleWithoutParams={withoutParams} />
      </div>

      {cycle.status === "draft" && withoutParams.length > 0 && (
        <Card className="border-[#f1c9ac] bg-warn-soft p-4 text-sm text-warn">
          {withoutParams.length} employee(s) have no parameters yet and would be left out when the cycle opens:{" "}
          {withoutParams.join(", ")}.
        </Card>
      )}

      {cycle.status !== "draft" && (
        <div className="flex gap-1 border-b border-line">
          {(
            [
              ["people", "People & projects"],
              ["parameters", "Parameters"],
            ] as const
          ).map(([t, label]) => (
            <Link
              key={t}
              href={`/admin/cycles/${cycle.cycleId}?tab=${t}`}
              className={cn(
                "-mb-px border-b-2 px-4 py-2 text-sm",
                activeTab === t ? "border-amber font-medium text-ink" : "border-transparent text-grey hover:text-ink"
              )}
            >
              {label}
            </Link>
          ))}
        </div>
      )}

      {activeTab === "parameters" ? (
        <ParamEditor
          cycleId={cycle.cycleId}
          params={cyc.params}
          departments={departments}
          designations={designations}
          headcount={headcount}
          readOnly={cycle.status === "closed"}
          live={cycle.status === "open"}
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-paper text-left text-xs text-grey">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Employee</th>
                  <th className="px-4 py-2.5 font-medium">Projects this month</th>
                  <th className="px-4 py-2.5 text-right font-medium">Items</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {views
                  .sort((a, b) => a.appraisal.department.localeCompare(b.appraisal.department) || a.employee.name.localeCompare(b.employee.name))
                  .map((v) => (
                    <tr key={v.appraisal.appraisalId} className="border-t border-line align-top">
                      <td className="px-4 py-3">
                        <Link href={`/appraisals/${v.appraisal.appraisalId}`} className="font-medium hover:underline">
                          {v.employee.name}
                        </Link>
                        <div className="text-xs text-grey">
                          {v.appraisal.designation} · {v.appraisal.department}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <ProjectsEditor
                          appraisalId={v.appraisal.appraisalId}
                          projects={v.appraisal.projects}
                          options={projectOptions}
                          disabled={cycle.status !== "open" || !!v.appraisal.approvedAt}
                          compact
                        />
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{v.lines.length}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={v.status} />
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
