"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { NotifyButtons } from "@/components/hr/notify-buttons";
import { cn, formatDate } from "@/lib/utils";

export interface TrackerRow {
  appraisalId: string;
  name: string;
  department: string;
  designation: string;
  hasEmail: boolean;
  scored: number;
  total: number;
  invalid: number;
  complete: boolean;
  overdue: boolean;
  lastReminderAt: string;
}

type Filter = "pending" | "overdue" | "complete" | "all";

export function SelfTracker({
  cycleId,
  rows,
  emailEnabled,
  open,
}: {
  cycleId: string;
  rows: TrackerRow[];
  emailEnabled: boolean;
  open: boolean;
}) {
  const [filter, setFilter] = useState<Filter>("pending");
  const [dept, setDept] = useState("");
  const depts = useMemo(() => [...new Set(rows.map((r) => r.department))].sort(), [rows]);
  const shown = rows.filter(
    (r) =>
      (!dept || r.department === dept) &&
      (filter === "all" || (filter === "complete" ? r.complete : filter === "overdue" ? r.overdue : !r.complete))
  );
  const defaulters = shown.filter((r) => !r.complete);
  const [picked, setPicked] = useState<Set<string> | null>(null);
  const selected = picked ?? new Set(defaulters.map((r) => r.appraisalId));
  const selectedIds = defaulters.filter((r) => selected.has(r.appraisalId)).map((r) => r.appraisalId);

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setPicked(next);
  }

  const counts = {
    all: rows.length,
    complete: rows.filter((r) => r.complete).length,
    pending: rows.filter((r) => !r.complete).length,
    overdue: rows.filter((r) => r.overdue).length,
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2" role="tablist">
          {(
            [
              ["pending", "Not complete"],
              ["overdue", "Overdue"],
              ["complete", "Complete"],
              ["all", "Everyone"],
            ] as const
          ).map(([f, label]) => (
            <button
              key={f}
              role="tab"
              aria-selected={filter === f}
              onClick={() => {
                setFilter(f);
                setPicked(null);
              }}
              className={cn(
                "inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm",
                filter === f ? "border-ink bg-ink text-paper" : "border-line bg-card hover:bg-paper"
              )}
            >
              {label} <span className={cn("text-xs", filter === f ? "text-[#c9cbcb]" : "text-grey")}>{counts[f]}</span>
            </button>
          ))}
          <select
            value={dept}
            onChange={(e) => {
              setDept(e.target.value);
              setPicked(null);
            }}
            className="h-9 rounded-full border border-line bg-card px-3 text-sm"
            aria-label="Department"
          >
            <option value="">All departments</option>
            {depts.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        </div>
        {open && defaulters.length > 0 && (
          <div className="flex flex-wrap items-center justify-end gap-3">
            <span className="whitespace-nowrap text-sm text-grey">{selectedIds.length} selected</span>
            <NotifyButtons cycleId={cycleId} part="self" appraisalIds={selectedIds} emailEnabled={emailEnabled} />
          </div>
        )}
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-paper text-left text-xs text-grey">
              <tr>
                <th className="w-10 px-4 py-2.5">
                  {open && defaulters.length > 0 && (
                    <input
                      type="checkbox"
                      aria-label="Select all defaulters"
                      checked={selectedIds.length === defaulters.length}
                      onChange={(e) => setPicked(new Set(e.target.checked ? defaulters.map((r) => r.appraisalId) : []))}
                      className="size-4 accent-[#f2ac3c]"
                    />
                  )}
                </th>
                <th className="px-4 py-2.5 font-medium">Employee</th>
                <th className="px-4 py-2.5 font-medium">Self-scored items</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Last reminder</th>
              </tr>
            </thead>
            <tbody>
              {shown.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-grey">
                    Nobody here.
                  </td>
                </tr>
              )}
              {shown.map((r) => (
                <tr key={r.appraisalId} className="border-t border-line">
                  <td className="px-4 py-2.5">
                    {open && !r.complete && (
                      <input
                        type="checkbox"
                        aria-label={`Select ${r.name}`}
                        checked={selected.has(r.appraisalId)}
                        onChange={() => toggle(r.appraisalId)}
                        className="size-4 accent-[#f2ac3c]"
                      />
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <Link href={`/appraisals/${r.appraisalId}`} className="font-medium hover:underline">
                      {r.name}
                    </Link>
                    <div className="text-xs text-grey">
                      {r.designation} · {r.department}
                      {!r.hasEmail && <span className="ml-1 text-warn">· no email</span>}
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-28 overflow-hidden rounded-full bg-paper">
                        <div className={cn("h-full rounded-full", r.complete ? "bg-ok" : "bg-amber")} style={{ width: `${(r.scored / Math.max(1, r.total)) * 100}%` }} />
                      </div>
                      <span className="tabular-nums text-grey">
                        {r.scored}/{r.total}
                      </span>
                      {r.invalid > 0 && (
                        <span className="inline-flex items-center gap-1 text-xs text-warn" title="Entries that aren't a number in range">
                          <AlertTriangle className="size-3.5" /> {r.invalid} invalid
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    {r.complete ? (
                      <span className="inline-flex items-center gap-1 text-ok">
                        <CheckCircle2 className="size-4" /> Complete
                      </span>
                    ) : r.overdue ? (
                      <span className="inline-flex items-center gap-1 font-medium text-warn">
                        <Clock className="size-4" /> Overdue
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-grey">
                        <Clock className="size-4" /> Pending
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-grey">{r.lastReminderAt ? formatDate(r.lastReminderAt) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
