"use client";

import { cn } from "@/lib/utils";

/** Buttons for short ranges (e.g. 0–10), a dropdown for longer ones (e.g. −5–10). Clicking the selected value clears it. */
export function PointsPicker({
  value,
  min,
  max,
  onChange,
  label,
}: {
  value: number | null;
  min: number;
  max: number;
  onChange: (v: number | null) => void;
  label: string;
}) {
  const values = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  if (values.length > 11) {
    return (
      <select
        aria-label={label}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        className={cn("h-10 rounded-lg border bg-card px-3 text-sm tabular-nums", value === null ? "border-line" : "border-amber")}
      >
        <option value="">Points…</option>
        {values
          .slice()
          .reverse()
          .map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
      </select>
    );
  }
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
      {values.map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          onClick={() => onChange(value === n ? null : n)}
          className={cn(
            "h-9 min-w-9 rounded-lg border px-2 text-sm font-semibold tabular-nums transition-colors",
            value === n ? "border-amber bg-amber text-ink" : "border-line bg-card hover:border-amber hover:bg-amber-soft",
            n < 0 && value !== n && "text-warn"
          )}
        >
          {n}
        </button>
      ))}
    </div>
  );
}
