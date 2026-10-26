"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cycleName, defaultDates } from "@/lib/model";

export function NewCycleForm({
  suggested,
  copyOptions,
}: {
  suggested: string;
  copyOptions: { value: string; label: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [cycleId, setCycleId] = useState(suggested);
  const [dates, setDates] = useState(defaultDates(suggested));
  const [copyFrom, setCopyFrom] = useState(copyOptions[0]?.value ?? "workbook");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  function changeMonth(v: string) {
    setCycleId(v);
    if (/^\d{4}-\d{2}$/.test(v)) setDates(defaultDates(v));
  }

  function create() {
    setError("");
    start(async () => {
      const res = await fetch("/api/cycles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cycleId, copyFrom, ...dates }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? data.issues?.[0]?.message ?? "Could not create the cycle.");
        return;
      }
      router.push(`/admin/cycles/${cycleId}`);
      router.refresh();
    });
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)}>
        <Plus /> New cycle
      </Button>
    );
  }

  const field = "h-10 w-full rounded-lg border border-line bg-card px-3 text-sm";
  return (
    <Card className="w-full p-5">
      <h2 className="font-display text-lg font-bold">New monthly cycle</h2>
      <p className="mt-1 text-sm text-grey">
        Creates a parameter sheet for the month as a copy of an earlier one. Edit it, then open the cycle when it&apos;s ready.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Month</span>
          <input type="month" value={cycleId} onChange={(e) => changeMonth(e.target.value)} className={field} />
          <span className="mt-1 block text-xs text-grey">{/^\d{4}-\d{2}$/.test(cycleId) ? cycleName(cycleId) : ""}</span>
        </label>
        <label className="block text-sm lg:col-span-2">
          <span className="mb-1 block font-medium">Copy parameters from</span>
          <select value={copyFrom} onChange={(e) => setCopyFrom(e.target.value)} className={field}>
            {copyOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        {(
          [
            ["periodStart", "Period starts"],
            ["periodEnd", "Period ends"],
            ["selfDue", "Self-assessment due"],
            ["reviewDue", "HR / Admin / PC / Manager scores due"],
          ] as const
        ).map(([k, label]) => (
          <label key={k} className="block text-sm">
            <span className="mb-1 block font-medium">{label}</span>
            <input type="date" value={dates[k]} onChange={(e) => setDates({ ...dates, [k]: e.target.value })} className={field} />
          </label>
        ))}
      </div>
      {error && <p className="mt-3 text-sm text-warn">{error}</p>}
      <div className="mt-4 flex gap-2">
        <Button onClick={create} disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <Plus />} Create cycle
        </Button>
        <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
          Cancel
        </Button>
      </div>
    </Card>
  );
}
