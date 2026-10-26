"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Loader2, Lock, PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Cycle } from "@/lib/types";

type Dates = Pick<Cycle, "periodStart" | "periodEnd" | "selfDue" | "reviewDue">;

export function CycleActions({ cycle, peopleWithoutParams }: { cycle: Cycle; peopleWithoutParams: string[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editDates, setEditDates] = useState(false);
  const [dates, setDates] = useState<Dates>({
    periodStart: cycle.periodStart,
    periodEnd: cycle.periodEnd,
    selfDue: cycle.selfDue,
    reviewDue: cycle.reviewDue,
  });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function patch(body: object, done?: (data: Record<string, unknown>) => string) {
    setMsg(null);
    start(async () => {
      const res = await fetch(`/api/cycles/${cycle.cycleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg({ ok: false, text: data.error ?? data.issues?.[0]?.message ?? "Could not complete that." });
        return;
      }
      setEditDates(false);
      if (done) setMsg({ ok: true, text: done(data) });
      router.refresh();
    });
  }

  function openCycle() {
    const warn = peopleWithoutParams.length
      ? `\n\n${peopleWithoutParams.length} employee(s) have no parameters for their department/designation and will be left out:\n• ${peopleWithoutParams.join("\n• ")}`
      : "";
    if (!window.confirm(`Open ${cycle.name}? Every employee gets their rows in the Scores ${cycle.cycleId} tab, ready to fill in.${warn}`)) return;
    patch({ action: "open" }, (d) => `Cycle opened — ${d.created} appraisals, ${d.rows} rows added to the score sheet.`);
  }

  const field = "h-9 rounded-lg border border-line bg-card px-2 text-sm";
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {cycle.status !== "closed" && (
          <Button variant="outline" onClick={() => setEditDates(!editDates)} disabled={pending}>
            <CalendarDays /> Dates
          </Button>
        )}
        {cycle.status === "draft" && (
          <Button onClick={openCycle} disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : <PlayCircle />} Open cycle
          </Button>
        )}
        {cycle.status === "open" && (
          <Button
            variant="dark"
            onClick={() => window.confirm(`Close ${cycle.name}? Parameters lock and HR deductions stop. Unapproved appraisals stay as they are.`) && patch({ action: "close" }, () => "Cycle closed.")}
            disabled={pending}
          >
            <Lock /> Close cycle
          </Button>
        )}
      </div>
      {editDates && (
        <div className="flex flex-wrap items-end gap-2 rounded-xl border border-line bg-card p-3">
          {(
            [
              ["periodStart", "Period starts"],
              ["periodEnd", "Period ends"],
              ["selfDue", "Self due"],
              ["reviewDue", "Reviews due"],
            ] as const
          ).map(([k, label]) => (
            <label key={k} className="text-xs text-grey">
              <span className="mb-1 block">{label}</span>
              <input type="date" value={dates[k]} onChange={(e) => setDates({ ...dates, [k]: e.target.value })} className={field} />
            </label>
          ))}
          <Button size="sm" onClick={() => patch({ action: "dates", dates }, () => "Dates saved.")} disabled={pending}>
            Save dates
          </Button>
        </div>
      )}
      {msg && <p className={msg.ok ? "text-sm text-ok" : "text-sm text-warn"}>{msg.text}</p>}
    </div>
  );
}
