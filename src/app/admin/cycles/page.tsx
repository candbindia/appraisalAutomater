import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { NewCycleForm } from "@/components/admin/new-cycle-form";
import { CycleBadge } from "@/components/status-badge";
import { cycleName } from "@/lib/model";
import { isHR, loadBase } from "@/lib/repo";
import { getCurrentUser } from "@/lib/session";
import { formatDate } from "@/lib/utils";

function nextMonth(cycleId?: string) {
  const base = cycleId ? new Date(`${cycleId}-01T00:00:00Z`) : new Date();
  const d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + (cycleId ? 1 : 0), 1));
  return d.toISOString().slice(0, 7);
}

export default async function CyclesPage() {
  const [user, base] = await Promise.all([getCurrentUser(), loadBase()]);
  if (!isHR(user)) {
    return <Card className="p-6 text-sm text-grey">Only HR can manage review cycles and parameters.</Card>;
  }
  const cycles = [...base.cycles].reverse();
  const copyOptions = [
    ...cycles.map((c) => ({ value: c.cycleId, label: `${c.name} (${c.status === "draft" ? "being set up" : c.status})` })),
    { value: "workbook", label: "Appraisal.xlsx template (MC sheet)" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Cycles &amp; Parameters</h1>
          <p className="mt-1 max-w-2xl text-sm text-grey">
            Each month gets its own parameter sheet. Create the cycle (it copies last month), review and adjust the items, points and who scores
            them for every department and designation, then open it.
          </p>
        </div>
      </div>

      <NewCycleForm suggested={nextMonth(base.cycles.at(-1)?.cycleId)} copyOptions={copyOptions} />

      <Card className="divide-y divide-line overflow-hidden">
        {cycles.length === 0 && <div className="p-6 text-sm text-grey">No cycles yet. Create the first one above.</div>}
        {cycles.map((c) => {
          const apps = base.appraisals.filter((a) => a.cycleId === c.cycleId);
          const approved = apps.filter((a) => a.approvedAt).length;
          return (
            <Link key={c.cycleId} href={`/admin/cycles/${c.cycleId}`} className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-paper">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-display text-lg font-semibold">{c.name}</span>
                  <CycleBadge status={c.status} />
                </div>
                <p className="mt-0.5 text-sm text-grey">
                  Self due {formatDate(c.selfDue)} · reviews due {formatDate(c.reviewDue)} · copied from{" "}
                  {c.copiedFrom === "workbook" ? "Appraisal.xlsx" : c.copiedFrom ? cycleName(c.copiedFrom) : "—"}
                </p>
              </div>
              <div className="hidden text-right text-sm sm:block">
                {c.status === "draft" ? (
                  <span className="text-grey">Parameters editable</span>
                ) : (
                  <>
                    <div className="tabular-nums">
                      {approved}/{apps.length} approved
                    </div>
                    <div className="text-xs text-grey">{apps.length} appraisals</div>
                  </>
                )}
              </div>
              <ChevronRight className="size-5 text-grey" />
            </Link>
          );
        })}
      </Card>
    </div>
  );
}
