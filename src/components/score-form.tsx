"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ExternalLink, Loader2, MessageSquarePlus, Save, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PointsPicker } from "@/components/points-picker";
import { RaterChip } from "@/components/status-badge";
import { RATER_LABEL, type Rater } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface FormLine {
  paramId: string;
  section: string;
  project: string;
  text: string;
  ratedBy: Rater;
  minPoints: number;
  maxPoints: number;
  points: number | null;
  /** Points/comment withheld from the employee until approval. */
  hidden: boolean;
  raterComment: string;
  remark: string;
  evidence: string;
}

type Msg = { kind: "ok" | "error"; text: string } | null;
type Edit = Pick<FormLine, "points" | "raterComment" | "remark" | "evidence">;

export function ScoreForm({
  appraisalId,
  lines,
  editableParts,
  isOwner,
}: {
  appraisalId: string;
  lines: FormLine[];
  editableParts: Rater[];
  isOwner: boolean;
}) {
  const router = useRouter();
  const [edits, setEdits] = useState<Record<string, Edit>>(() =>
    Object.fromEntries(lines.map((l) => [l.paramId, { points: l.points, raterComment: l.raterComment, remark: l.remark, evidence: l.evidence }]))
  );
  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);

  const parts = useMemo(() => [...new Set(lines.map((l) => l.ratedBy))], [lines]);
  const canWrite = editableParts.length > 0;
  const ownerEditing = isOwner && editableParts.includes("self");
  // Raters land on their own items; the employee sees everything (they can add remarks to any item).
  const [filter, setFilter] = useState<Rater | "all">(!isOwner && editableParts.length ? editableParts[0] : "all");

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const shown = lines.filter((l) => filter === "all" || l.ratedBy === filter);
  const groups = useMemo(() => {
    const g: { key: string; section: string; project: string; lines: FormLine[] }[] = [];
    for (const l of shown) {
      const key = `${l.section}|${l.project}`;
      let x = g.find((y) => y.key === key);
      if (!x) g.push((x = { key, section: l.section, project: l.project, lines: [] }));
      x.lines.push(l);
    }
    return g;
  }, [shown]);

  const number = new Map(lines.map((l, i) => [l.paramId, i + 1]));

  function update(id: string, patch: Partial<Edit>) {
    setEdits((e) => ({ ...e, [id]: { ...e[id], ...patch } }));
    setDirty(true);
    setMsg(null);
  }

  function remaining(part: Rater) {
    return lines.filter((l) => l.ratedBy === part && edits[l.paramId].points === null).length;
  }

  function send(submit: Rater[]) {
    for (const p of submit) {
      const left = remaining(p);
      if (left) {
        setMsg({ kind: "error", text: `Score every ${RATER_LABEL[p]} item before submitting (${left} left).` });
        setFilter(p);
        return;
      }
      if (!window.confirm(`Submit the ${RATER_LABEL[p]} part? You won't be able to change it unless it is sent back.`)) return;
    }
    const payload = lines
      .map((l) => {
        const e = edits[l.paramId];
        const out: Record<string, unknown> = { paramId: l.paramId };
        let any = false;
        const set = (field: string, value: unknown) => {
          out[field] = value;
          any = true;
        };
        if (editableParts.includes(l.ratedBy)) {
          if (e.points !== l.points) set("points", e.points);
          if (e.raterComment !== l.raterComment && l.ratedBy !== "self") set("raterComment", e.raterComment);
        }
        if (ownerEditing) {
          if (e.remark !== l.remark) set("remark", e.remark);
          if (e.evidence !== l.evidence) set("evidence", e.evidence);
        }
        return any ? out : null;
      })
      .filter(Boolean);

    setBusy(submit.length ? submit.join(",") : "save");
    start(async () => {
      try {
        const res = await fetch(`/api/appraisals/${encodeURIComponent(appraisalId)}/scores`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lines: payload, submit }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          setMsg({ kind: "error", text: body.error ?? "Could not save. Please try again." });
          return;
        }
        setDirty(false);
        setMsg({ kind: "ok", text: submit.length ? `${submit.map((p) => RATER_LABEL[p]).join(", ")} part submitted.` : "Draft saved." });
        router.refresh();
      } catch {
        setMsg({ kind: "error", text: "Network error — your changes were not saved." });
      } finally {
        setBusy(null);
      }
    });
  }

  return (
    <div className={cn("space-y-4", canWrite && "pb-28")}>
      {parts.length > 1 && (
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter items by who scores them">
          {(["all", ...parts] as const).map((p) => {
            const count = p === "all" ? lines.length : lines.filter((l) => l.ratedBy === p).length;
            const mine = p !== "all" && editableParts.includes(p);
            return (
              <button
                key={p}
                role="tab"
                aria-selected={filter === p}
                onClick={() => setFilter(p)}
                className={cn(
                  "inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors",
                  filter === p ? "border-ink bg-ink text-paper" : "border-line bg-card hover:bg-paper"
                )}
              >
                {p === "all" ? "All items" : RATER_LABEL[p]}
                <span className={cn("text-xs", filter === p ? "text-[#c9cbcb]" : "text-grey")}>{count}</span>
                {mine && <span className="size-1.5 rounded-full bg-amber" title="You score these" />}
              </button>
            );
          })}
        </div>
      )}

      {groups.map((g) => {
        const visible = g.lines.filter((l) => !l.hidden);
        const earned = visible.reduce((s, l) => s + (edits[l.paramId].points ?? 0), 0);
        const max = visible.reduce((s, l) => s + l.maxPoints, 0);
        return (
          <section key={g.key} className="space-y-2">
            <div className="flex flex-wrap items-baseline justify-between gap-2 pt-2">
              <h2 className="font-display text-lg font-bold">
                {g.section}
                {g.project && <span className="ml-2 rounded-md bg-ink px-2 py-0.5 align-middle text-xs font-medium text-paper">{g.project}</span>}
              </h2>
              {max > 0 && (
                <span className="text-sm tabular-nums text-grey">
                  {earned} / {max} pts{visible.length < g.lines.length && " (visible items)"}
                </span>
              )}
            </div>
            <Card className="divide-y divide-line">
              {g.lines.map((l) => (
                <LineRow
                  key={l.paramId}
                  n={number.get(l.paramId)!}
                  line={l}
                  edit={edits[l.paramId]}
                  canScore={editableParts.includes(l.ratedBy)}
                  canRemark={ownerEditing}
                  onChange={(p) => update(l.paramId, p)}
                />
              ))}
            </Card>
          </section>
        );
      })}

      {canWrite && (
        <div className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-paper/95 backdrop-blur md:left-[248px]">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-8">
            <div className="min-h-5 text-sm" role="status" aria-live="polite">
              {msg ? (
                <span className={cn("inline-flex items-center gap-1.5", msg.kind === "ok" ? "text-ok" : "text-warn")}>
                  {msg.kind === "ok" && <CheckCircle2 className="size-4" />}
                  {msg.text}
                </span>
              ) : (
                <span className="text-grey">
                  {dirty ? "Unsaved changes · " : ""}
                  {editableParts.map((p) => `${RATER_LABEL[p]}: ${remaining(p)} left`).join(" · ")}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => send([])} disabled={pending}>
                {busy === "save" ? <Loader2 className="animate-spin" /> : <Save />}
                Save draft
              </Button>
              {editableParts.map((p) => (
                <Button key={p} onClick={() => send([p])} disabled={pending}>
                  {busy === p ? <Loader2 className="animate-spin" /> : <Send />}
                  {editableParts.length > 1 || p !== "self" ? `Submit ${RATER_LABEL[p]} part` : "Submit"}
                </Button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function LineRow({
  n,
  line: l,
  edit,
  canScore,
  canRemark,
  onChange,
}: {
  n: number;
  line: FormLine;
  edit: Edit;
  canScore: boolean;
  canRemark: boolean;
  onChange: (p: Partial<Edit>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState(!!(edit.remark || edit.evidence));
  const long = l.text.length > 220;

  return (
    <div className={cn("p-4 md:p-5", canScore && edit.points === null && "bg-[#fffcf5]")}>
      <div className="flex gap-3">
        <span className="mt-0.5 w-6 shrink-0 text-right text-xs tabular-nums text-grey">{n}</span>
        <div className="min-w-0 flex-1 space-y-3">
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
              {!canScore && (
                <span className="min-w-16 text-right text-sm font-semibold tabular-nums">
                  {l.hidden ? (
                    <span className="text-xs font-normal text-grey">After approval</span>
                  ) : edit.points === null ? (
                    <span className="text-xs font-normal text-grey">Pending</span>
                  ) : (
                    <>
                      <span className={cn(edit.points < 0 && "text-warn")}>{edit.points}</span>
                      <span className="font-normal text-grey"> / {l.maxPoints}</span>
                    </>
                  )}
                </span>
              )}
            </div>
          </div>

          {canScore && (
            <div className="flex flex-wrap items-center gap-3">
              <PointsPicker value={edit.points} min={l.minPoints} max={l.maxPoints} onChange={(v) => onChange({ points: v })} label={`Points for item ${n}`} />
              <span className="text-xs text-grey">
                {l.minPoints} to {l.maxPoints} pts
              </span>
              {l.ratedBy !== "self" && (
                <input
                  value={edit.raterComment}
                  onChange={(e) => onChange({ raterComment: e.target.value })}
                  maxLength={2000}
                  placeholder="Comment (optional)"
                  className="h-9 min-w-48 flex-1 rounded-lg border border-line bg-card px-3 text-sm placeholder:text-[#a3a5a5]"
                />
              )}
            </div>
          )}

          {!canScore && !l.hidden && l.raterComment && (
            <p className="text-xs text-grey">
              <span className="font-medium text-ink">{RATER_LABEL[l.ratedBy]}:</span> {l.raterComment}
            </p>
          )}

          {canRemark ? (
            notes ? (
              <div className="grid gap-2 md:grid-cols-[1.5fr_1fr]">
                <textarea
                  value={edit.remark}
                  onChange={(e) => onChange({ remark: e.target.value })}
                  rows={2}
                  maxLength={3000}
                  placeholder="Your remark — what you did, names appreciated, WOW moment…"
                  className="w-full rounded-lg border border-line bg-card px-3 py-2 text-sm placeholder:text-[#a3a5a5]"
                />
                <input
                  value={edit.evidence}
                  onChange={(e) => onChange({ evidence: e.target.value })}
                  maxLength={1000}
                  placeholder="Evidence link (Drive, Keka…)"
                  className="h-10 w-full rounded-lg border border-line bg-card px-3 text-sm placeholder:text-[#a3a5a5]"
                />
              </div>
            ) : (
              <button onClick={() => setNotes(true)} className="inline-flex items-center gap-1 text-xs font-medium text-grey hover:text-ink">
                <MessageSquarePlus className="size-3.5" /> Add remark / evidence
              </button>
            )
          ) : (
            (l.remark || l.evidence) && (
              <div className="rounded-lg bg-paper px-3 py-2 text-xs">
                {l.remark && (
                  <p className="whitespace-pre-line">
                    <span className="font-medium">Employee remark:</span> {l.remark}
                  </p>
                )}
                {l.evidence && <Evidence value={l.evidence} />}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}

function Evidence({ value }: { value: string }) {
  const isUrl = /^https?:\/\//i.test(value);
  return isUrl ? (
    <a href={value} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-[#8a5a12] underline">
      Evidence <ExternalLink className="size-3" />
    </a>
  ) : (
    <p className="mt-1 text-grey">Evidence: {value}</p>
  );
}
