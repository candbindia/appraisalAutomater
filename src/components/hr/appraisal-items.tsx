"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, ExternalLink, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PointsPicker } from "@/components/points-picker";
import { RaterChip } from "@/components/status-badge";
import { RATER_LABEL, type LineState, type Rater } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface ItemLine {
  paramId: string;
  section: string;
  project: string;
  text: string;
  ratedBy: Rater;
  minPoints: number;
  maxPoints: number;
  points: number | null;
  state: LineState;
  raw: string;
  comment: string;
  remark: string;
  evidence: string;
}

type Edit = { points: number; comment: string };

/** All items of one appraisal, read-only — except HR items, which HR can deduct while the cycle is open. */
export function AppraisalItems({ appraisalId, lines, hrEditable }: { appraisalId: string; lines: ItemLine[]; hrEditable: boolean }) {
  const router = useRouter();
  const initial = useMemo(
    () => Object.fromEntries(lines.filter((l) => l.ratedBy === "hr").map((l) => [l.paramId, { points: l.points ?? l.maxPoints, comment: l.comment }])),
    [lines]
  );
  const [edits, setEdits] = useState<Record<string, Edit>>(initial);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const [filter, setFilter] = useState<Rater | "all">("all");

  const changed = Object.keys(edits).filter((id) => edits[id].points !== initial[id].points || edits[id].comment !== initial[id].comment);
  const dirty = changed.length > 0;

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const parts = [...new Set(lines.map((l) => l.ratedBy))];
  const shown = lines.filter((l) => filter === "all" || l.ratedBy === filter);
  const number = new Map(lines.map((l, i) => [l.paramId, i + 1]));
  const groups: { key: string; section: string; project: string; lines: ItemLine[] }[] = [];
  for (const l of shown) {
    const key = `${l.section}|${l.project}`;
    let g = groups.find((x) => x.key === key);
    if (!g) groups.push((g = { key, section: l.section, project: l.project, lines: [] }));
    g.lines.push(l);
  }

  function save() {
    const missingReason = changed.find((id) => {
      const l = lines.find((x) => x.paramId === id)!;
      return edits[id].points < l.maxPoints && edits[id].comment.trim().length < 3;
    });
    if (missingReason) {
      setMsg({ ok: false, text: `Add a reason for the deduction on item ${number.get(missingReason)}.` });
      return;
    }
    setMsg(null);
    start(async () => {
      const res = await fetch(`/api/appraisals/${encodeURIComponent(appraisalId)}/hr`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lines: changed.map((id) => {
            const l = lines.find((x) => x.paramId === id)!;
            const full = edits[id].points === l.maxPoints;
            return { paramId: id, points: full ? null : edits[id].points, comment: full ? "" : edits[id].comment };
          }),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg({ ok: false, text: data.error ?? "Could not save." });
        return;
      }
      setMsg({ ok: true, text: `Saved ${data.changed} change(s) — logged in the Change Log.` });
      router.refresh();
    });
  }

  return (
    <div className={cn("space-y-4", hrEditable && "pb-24")}>
      {parts.length > 1 && (
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter items by who scores them">
          {(["all", ...parts] as const).map((p) => (
            <button
              key={p}
              role="tab"
              aria-selected={filter === p}
              onClick={() => setFilter(p)}
              className={cn(
                "inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm",
                filter === p ? "border-ink bg-ink text-paper" : "border-line bg-card hover:bg-paper"
              )}
            >
              {p === "all" ? "All items" : RATER_LABEL[p]}
              <span className={cn("text-xs", filter === p ? "text-[#c9cbcb]" : "text-grey")}>
                {p === "all" ? lines.length : lines.filter((l) => l.ratedBy === p).length}
              </span>
            </button>
          ))}
        </div>
      )}

      {groups.map((g) => {
        const earned = g.lines.reduce((s, l) => s + (l.ratedBy === "hr" && hrEditable ? edits[l.paramId].points : l.points ?? 0), 0);
        const max = g.lines.reduce((s, l) => s + l.maxPoints, 0);
        return (
          <section key={g.key} className="space-y-2">
            <div className="flex flex-wrap items-baseline justify-between gap-2 pt-2">
              <h2 className="font-display text-lg font-bold">
                {g.section}
                {g.project && <span className="ml-2 rounded-md bg-ink px-2 py-0.5 align-middle text-xs font-medium text-paper">{g.project}</span>}
              </h2>
              <span className="text-sm tabular-nums text-grey">
                {Math.round(earned * 100) / 100} / {max} pts
              </span>
            </div>
            <Card className="divide-y divide-line">
              {g.lines.map((l) => (
                <Row
                  key={l.paramId}
                  n={number.get(l.paramId)!}
                  l={l}
                  edit={l.ratedBy === "hr" && hrEditable ? edits[l.paramId] : null}
                  onChange={(patch) => {
                    setEdits((e) => ({ ...e, [l.paramId]: { ...e[l.paramId], ...patch } }));
                    setMsg(null);
                  }}
                />
              ))}
            </Card>
          </section>
        );
      })}

      {hrEditable && (
        <div className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-paper/95 backdrop-blur md:left-[248px]">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-8">
            <span className="text-sm" role="status" aria-live="polite">
              {msg ? (
                <span className={cn("inline-flex items-center gap-1.5", msg.ok ? "text-ok" : "text-warn")}>
                  {msg.ok && <CheckCircle2 className="size-4" />}
                  {msg.text}
                </span>
              ) : (
                <span className="text-grey">
                  {dirty ? `${changed.length} unsaved HR change(s)` : "HR items are full marks unless you deduct. Other scores come from the sheet."}
                </span>
              )}
            </span>
            <Button onClick={save} disabled={pending || !dirty}>
              {pending ? <Loader2 className="animate-spin" /> : <Save />} Save HR changes
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ n, l, edit, onChange }: { n: number; l: ItemLine; edit: Edit | null; onChange: (p: Partial<Edit>) => void }) {
  const [open, setOpen] = useState(false);
  const long = l.text.length > 220;
  const deducted = edit ? edit.points < l.maxPoints : l.ratedBy === "hr" && l.points !== null && l.points < l.maxPoints;

  return (
    <div className={cn("p-4 md:p-5", l.state === "invalid" && "bg-warn-soft/50", deducted && "bg-[#fffaf0]")}>
      <div className="flex gap-3">
        <span className="mt-0.5 w-6 shrink-0 text-right text-xs tabular-nums text-grey">{n}</span>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
            <div className="min-w-0 max-w-3xl flex-1">
              <p className={cn("text-sm leading-relaxed whitespace-pre-line", long && !open && "line-clamp-3")}>{l.text}</p>
              {long && (
                <button onClick={() => setOpen(!open)} className="mt-1 text-xs font-medium text-[#8a5a12] hover:underline">
                  {open ? "Show less" : "Show full text"}
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <RaterChip rater={l.ratedBy} />
              {!edit && <Value l={l} />}
            </div>
          </div>

          {edit && (
            <div className="flex flex-wrap items-center gap-3">
              <PointsPicker
                value={edit.points}
                min={l.minPoints}
                max={l.maxPoints}
                onChange={(v) => onChange({ points: v ?? l.maxPoints })}
                label={`HR points for item ${n}`}
              />
              {edit.points < l.maxPoints ? (
                <input
                  value={edit.comment}
                  onChange={(e) => onChange({ comment: e.target.value })}
                  maxLength={1000}
                  placeholder="Reason for the deduction (required)"
                  className="h-9 min-w-56 flex-1 rounded-lg border border-amber bg-card px-3 text-sm"
                />
              ) : (
                <span className="text-xs text-grey">Full marks — pick a lower number to deduct</span>
              )}
            </div>
          )}

          {!edit && l.comment && (
            <p className="text-xs text-grey">
              <span className="font-medium text-ink">{l.ratedBy === "hr" ? "Deduction reason" : "Comment"}:</span> {l.comment}
            </p>
          )}
          {(l.remark || l.evidence) && (
            <div className="rounded-lg bg-paper px-3 py-2 text-xs">
              {l.remark && (
                <p className="whitespace-pre-line">
                  <span className="font-medium">Employee remark:</span> {l.remark}
                </p>
              )}
              {l.evidence &&
                (/^https?:\/\//i.test(l.evidence) ? (
                  <a href={l.evidence} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-[#8a5a12] underline">
                    Evidence <ExternalLink className="size-3" />
                  </a>
                ) : (
                  <p className="mt-1 text-grey">Evidence: {l.evidence}</p>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Value({ l }: { l: ItemLine }) {
  if (l.state === "empty") return <span className="min-w-20 text-right text-xs text-grey">Not filled</span>;
  if (l.state === "invalid")
    return (
      <span className="inline-flex min-w-20 items-center justify-end gap-1 text-xs font-medium text-warn" title={`Needs ${l.minPoints}–${l.maxPoints}`}>
        <AlertTriangle className="size-3.5" /> &ldquo;{l.raw}&rdquo;
      </span>
    );
  return (
    <span className="min-w-20 text-right text-sm font-semibold tabular-nums">
      <span className={cn(l.points! < 0 && "text-warn")}>{l.points}</span>
      <span className="font-normal text-grey"> / {l.maxPoints}</span>
      {l.state === "full_default" && <span className="block text-[10px] font-normal text-grey">full marks</span>}
    </span>
  );
}
