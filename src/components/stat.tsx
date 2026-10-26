import { cn } from "@/lib/utils";

export function Stat({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: "default" | "warn" | "accent";
}) {
  return (
    <div
      className={cn(
        "rounded-xl border bg-card p-4",
        tone === "warn" ? "border-[#f1c9ac]" : tone === "accent" ? "border-amber" : "border-line"
      )}
    >
      <div className="text-xs text-grey">{label}</div>
      <div className={cn("font-display mt-1 text-3xl font-bold", tone === "warn" && "text-warn")}>{value}</div>
      {hint && <div className="mt-1 text-xs text-grey">{hint}</div>}
    </div>
  );
}
