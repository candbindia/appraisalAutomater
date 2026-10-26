"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

/** HR: tick the projects an employee is on this month. Project items appear on their sheet automatically. */
export function ProjectsEditor({
  appraisalId,
  projects: initial,
  options,
  disabled = false,
  compact = false,
}: {
  appraisalId: string;
  projects: string[];
  options: string[];
  disabled?: boolean;
  compact?: boolean;
}) {
  const router = useRouter();
  const [projects, setProjects] = useState(initial);
  const [other, setOther] = useState("");
  const [msg, setMsg] = useState("");
  const [pending, start] = useTransition();
  const all = [...new Set([...options, ...projects])];
  const dirty = projects.slice().sort().join("|") !== initial.slice().sort().join("|");

  function toggle(p: string) {
    setProjects((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]));
    setMsg("");
  }

  function save() {
    start(async () => {
      const res = await fetch(`/api/appraisals/${encodeURIComponent(appraisalId)}/projects`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projects }),
      });
      const data = await res.json().catch(() => ({}));
      setMsg(res.ok ? "Saved" : data.error ?? "Could not save");
      if (res.ok) router.refresh();
    });
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", compact && "gap-1")}>
      {all.map((p) => (
        <button
          key={p}
          type="button"
          disabled={disabled || pending}
          onClick={() => toggle(p)}
          aria-pressed={projects.includes(p)}
          className={cn(
            "inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-xs transition-colors disabled:opacity-60",
            projects.includes(p) ? "border-ink bg-ink text-paper" : "border-line bg-card text-grey hover:border-ink"
          )}
        >
          {projects.includes(p) && <Check className="size-3" />}
          {p}
        </button>
      ))}
      {!disabled && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (other.trim()) {
              setProjects((c) => [...new Set([...c, other.trim()])]);
              setOther("");
            }
          }}
          className="inline-flex items-center"
        >
          <input
            value={other}
            onChange={(e) => setOther(e.target.value)}
            placeholder="Other project"
            maxLength={80}
            className="h-7 w-28 rounded-l-full border border-line bg-card px-2.5 text-xs"
          />
          <button type="submit" aria-label="Add project" className="h-7 rounded-r-full border border-l-0 border-line bg-card px-2 text-grey hover:text-ink">
            <Plus className="size-3" />
          </button>
        </form>
      )}
      {all.length === 0 && disabled && <span className="text-xs text-grey">Bench</span>}
      {dirty && (
        <button onClick={save} disabled={pending} className="inline-flex h-7 items-center gap-1 rounded-full bg-amber px-3 text-xs font-medium text-ink">
          {pending && <Loader2 className="size-3 animate-spin" />} Save
        </button>
      )}
      {msg && !dirty && <span className="text-xs text-grey">{msg}</span>}
    </div>
  );
}
