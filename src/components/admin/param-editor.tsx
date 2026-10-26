"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, CheckCircle2, Loader2, Lock, Plus, Save, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { RaterChip } from "@/components/status-badge";
import { RATERS, RATER_LABEL, type Parameter, type Rater } from "@/lib/types";
import { cn } from "@/lib/utils";

type Draft = Parameter & { key: string };
let seq = 0;
const k = () => `k${++seq}`;

export function ParamEditor({
  cycleId,
  params: initial,
  departments,
  designations,
  headcount,
  readOnly,
  live,
}: {
  cycleId: string;
  params: Parameter[];
  departments: string[];
  designations: Record<string, string[]>;
  headcount: Record<string, number>; // "dept|desig" → active employees
  readOnly: boolean;
  /** The cycle is open: saving updates everyone's score sheet straight away. */
  live: boolean;
}) {
  const router = useRouter();
  const [all, setAll] = useState(initial);
  const [sel, setSel] = useState<{ dept: string; desig: string }>(() => {
    const dept = departments[0] ?? "";
    return { dept, desig: designations[dept]?.[0] ?? "" };
  });
  const [rows, setRows] = useState<Draft[]>([]);
  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const [bulk, setBulk] = useState({ min: 0, max: 10 });
  const [copySrc, setCopySrc] = useState("");

  const of = (dept: string, desig: string) =>
    all.filter((p) => p.department === dept && p.designation === desig).sort((a, b) => a.order - b.order);

  useEffect(() => {
    setRows(of(sel.dept, sel.desig).map((p) => ({ ...p, key: k() })));
    setDirty(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel, all]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const sections = useMemo(() => [...new Set(all.map((p) => p.section))], [all]);
  const projects = useMemo(() => [...new Set(all.filter((p) => p.project).map((p) => p.project))].sort(), [all]);

  function select(dept: string, desig: string) {
    if (dirty && !window.confirm("Discard unsaved changes to this sheet?")) return;
    setMsg(null);
    setSel({ dept, desig });
  }

  function change(key: string, patch: Partial<Parameter>) {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
    setDirty(true);
    setMsg(null);
  }

  function move(i: number, d: -1 | 1) {
    setRows((rs) => {
      const j = i + d;
      if (j < 0 || j >= rs.length) return rs;
      const next = rs.slice();
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
    setDirty(true);
  }

  function add(afterIndex: number, section: string, project = "") {
    const blank: Draft = {
      key: k(),
      paramId: "",
      department: sel.dept,
      designation: sel.desig,
      section,
      appliesTo: project ? "project" : "all",
      project,
      order: 0,
      text: "",
      ratedBy: "self",
      maxPoints: bulk.max,
      minPoints: bulk.min,
      active: true,
    };
    setRows((rs) => [...rs.slice(0, afterIndex + 1), blank, ...rs.slice(afterIndex + 1)]);
    setDirty(true);
  }

  function copyFrom(src: string) {
    const [dept, desig] = src.split("|");
    const source = of(dept, desig);
    if (!source.length) return;
    if (rows.length && !window.confirm(`Replace the ${rows.length} items here with ${source.length} items from ${dept} · ${desig}?`)) return;
    setRows(source.map((p) => ({ ...p, key: k(), paramId: "", department: sel.dept, designation: sel.desig })));
    setDirty(true);
    setCopySrc("");
  }

  function save() {
    if (live && !window.confirm(`Save changes to ${sel.dept} · ${sel.desig}? This cycle is open, so the score sheet updates immediately.`)) return;
    setMsg(null);
    start(async () => {
      const res = await fetch(`/api/cycles/${cycleId}/parameters`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          department: sel.dept,
          designation: sel.desig,
          params: rows.map((r) => {
            const { key, ...p } = r;
            void key;
            return p;
          }),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setMsg({ ok: false, text: (data && (data.error ?? data.issues?.[0]?.message)) || "Could not save." });
        return;
      }
      const saved = data.params as Parameter[];
      setAll((cur) => [...cur.filter((p) => !(p.department === sel.dept && p.designation === sel.desig)), ...saved]);
      const sync = data.sync ? ` Score sheet: ${data.sync.added} rows added, ${data.sync.removed} marked removed.` : "";
      setMsg({
        ok: true,
        text: data.changes ? `Saved — ${data.changes} change(s) logged.${sync}` : "No changes to save.",
      });
      router.refresh();
    });
  }

  const active = rows.filter((r) => r.active);
  const maxTotal = active.filter((r) => r.appliesTo === "all").reduce((s, r) => s + r.maxPoints, 0);
  const field = "h-9 rounded-lg border border-line bg-card px-2 text-sm disabled:bg-paper disabled:text-ink";

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
      {/* ---------- sheet picker ---------- */}
      <Card className="overflow-hidden lg:sticky lg:top-4">
        <div className="max-h-[70vh] overflow-y-auto">
          {departments.map((dept) => (
            <div key={dept} className="border-b border-line last:border-0">
              <div className="bg-paper px-4 py-2 text-xs font-semibold uppercase tracking-wide text-grey">{dept}</div>
              {(designations[dept] ?? []).map((desig) => {
                const n = all.filter((p) => p.department === dept && p.designation === desig && p.active).length;
                const people = headcount[`${dept}|${desig}`] ?? 0;
                const on = sel.dept === dept && sel.desig === desig;
                return (
                  <button
                    key={desig}
                    onClick={() => select(dept, desig)}
                    className={cn(
                      "flex w-full items-center gap-2 px-4 py-2 text-left text-sm transition-colors",
                      on ? "bg-amber-soft font-medium" : "hover:bg-paper"
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate">{desig}</span>
                    {people > 0 && (
                      <span className="inline-flex items-center gap-0.5 text-xs text-grey" title={`${people} employee(s)`}>
                        <Users className="size-3" />
                        {people}
                      </span>
                    )}
                    <span className={cn("w-8 text-right text-xs tabular-nums", n === 0 ? (people ? "font-semibold text-warn" : "text-grey") : "text-grey")}>
                      {n}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </Card>

      {/* ---------- sheet ---------- */}
      <div className="min-w-0 space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm text-grey">{sel.dept}</p>
            <h2 className="font-display text-2xl font-bold">{sel.desig}</h2>
            <p className="mt-1 text-sm text-grey">
              {active.length} items · up to {maxTotal} points (excluding project items)
            </p>
            <div className="mt-2 flex flex-wrap gap-1">
              {RATERS.map((r) => {
                const c = active.filter((x) => x.ratedBy === r).length;
                return c ? (
                  <RaterChip key={r} rater={r}>
                    {RATER_LABEL[r]} · {c}
                  </RaterChip>
                ) : null;
              })}
            </div>
          </div>
          {readOnly ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-card px-3 py-1 text-xs text-grey">
              <Lock className="size-3.5" /> This cycle is closed. Change the parameters in an open or upcoming cycle.
            </span>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <select value={copySrc} onChange={(e) => copyFrom(e.target.value)} className={field} aria-label="Copy items from another sheet">
                <option value="">Copy from…</option>
                {departments.flatMap((d) =>
                  (designations[d] ?? [])
                    .filter((g) => !(d === sel.dept && g === sel.desig) && of(d, g).length > 0)
                    .map((g) => (
                      <option key={`${d}|${g}`} value={`${d}|${g}`}>
                        {d} · {g} ({of(d, g).length})
                      </option>
                    ))
                )}
              </select>
            </div>
          )}
        </div>

        {live && !readOnly && (
          <p className="rounded-xl border border-[#f3d6a3] bg-amber-soft px-3 py-2 text-sm text-[#8a5a12]">
            This cycle is open. Saving updates everyone&apos;s score sheet straight away: new items get rows, removed items are
            marked &ldquo;removed&rdquo;, and points already entered are kept. Every change is written to the Change Log.
          </p>
        )}

        {!readOnly && rows.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-line px-3 py-2 text-sm">
            <span className="text-grey">Set points for every item:</span>
            <label className="inline-flex items-center gap-1">
              min
              <input type="number" value={bulk.min} onChange={(e) => setBulk({ ...bulk, min: Number(e.target.value) })} className={cn(field, "w-16")} />
            </label>
            <label className="inline-flex items-center gap-1">
              max
              <input type="number" value={bulk.max} onChange={(e) => setBulk({ ...bulk, max: Number(e.target.value) })} className={cn(field, "w-16")} />
            </label>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setRows((rs) => rs.map((r) => ({ ...r, minPoints: bulk.min, maxPoints: bulk.max })));
                setDirty(true);
              }}
            >
              Apply to all
            </Button>
          </div>
        )}

        {rows.length === 0 && (
          <Card className="p-6 text-sm text-grey">
            No items on this sheet yet.{" "}
            {!readOnly && "Add items below or copy them from another department or designation."}
          </Card>
        )}

        <div className="space-y-2">
          {rows.map((r, i) => {
            const prev = rows[i - 1];
            const header = !prev || prev.section !== r.section || prev.project !== r.project;
            const lastOfGroup = !rows[i + 1] || rows[i + 1].section !== r.section || rows[i + 1].project !== r.project;
            return (
              <div key={r.key}>
                {header && (
                  <h3 className="font-display mb-2 mt-5 flex items-center gap-2 text-lg font-bold first:mt-0">
                    {r.section}
                    {r.appliesTo === "project" && <span className="rounded-md bg-ink px-2 py-0.5 text-xs font-medium text-paper">{r.project}</span>}
                  </h3>
                )}
                <Card className={cn("p-3 md:p-4", !r.active && "opacity-55")}>
                  {readOnly ? (
                    <div className="flex flex-wrap items-start gap-3">
                      <span className="w-6 text-right text-xs tabular-nums text-grey">{i + 1}</span>
                      <p className="min-w-0 flex-1 text-sm whitespace-pre-line">{r.text}</p>
                      <RaterChip rater={r.ratedBy} />
                      <span className="text-xs tabular-nums text-grey">
                        {r.minPoints} – {r.maxPoints} pts
                      </span>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <span className="w-6 pt-2 text-right text-xs tabular-nums text-grey">{i + 1}</span>
                        <textarea
                          value={r.text}
                          onChange={(e) => change(r.key, { text: e.target.value })}
                          rows={Math.min(6, Math.max(2, Math.ceil(r.text.length / 110)))}
                          placeholder="What is being assessed?"
                          className="min-w-0 flex-1 rounded-lg border border-line bg-card px-3 py-2 text-sm"
                        />
                      </div>
                      <div className="flex flex-wrap items-center gap-2 pl-8">
                        <input
                          list="sections"
                          value={r.section}
                          onChange={(e) => change(r.key, { section: e.target.value })}
                          aria-label="Section"
                          className={cn(field, "w-44")}
                        />
                        <select
                          value={r.appliesTo}
                          onChange={(e) => change(r.key, { appliesTo: e.target.value as Parameter["appliesTo"] })}
                          aria-label="Applies to"
                          className={field}
                        >
                          <option value="all">Everyone</option>
                          <option value="project">Only on project</option>
                        </select>
                        {r.appliesTo === "project" && (
                          <input
                            list="projects"
                            value={r.project}
                            onChange={(e) => change(r.key, { project: e.target.value })}
                            placeholder="Project / client"
                            aria-label="Project"
                            className={cn(field, "w-32")}
                          />
                        )}
                        <select
                          value={r.ratedBy}
                          onChange={(e) => change(r.key, { ratedBy: e.target.value as Rater })}
                          aria-label="Scored by"
                          className={field}
                        >
                          {RATERS.map((x) => (
                            <option key={x} value={x}>
                              Scored by {RATER_LABEL[x]}
                            </option>
                          ))}
                        </select>
                        <label className="inline-flex items-center gap-1 text-xs text-grey">
                          min
                          <input
                            type="number"
                            value={r.minPoints}
                            onChange={(e) => change(r.key, { minPoints: Number(e.target.value) })}
                            className={cn(field, "w-16")}
                          />
                        </label>
                        <label className="inline-flex items-center gap-1 text-xs text-grey">
                          max
                          <input
                            type="number"
                            value={r.maxPoints}
                            onChange={(e) => change(r.key, { maxPoints: Number(e.target.value) })}
                            className={cn(field, "w-16")}
                          />
                        </label>
                        <label className="inline-flex items-center gap-1.5 text-xs text-grey">
                          <input type="checkbox" checked={r.active} onChange={(e) => change(r.key, { active: e.target.checked })} className="size-4 accent-[#f2ac3c]" />
                          Active
                        </label>
                        <span className="ml-auto flex gap-1">
                          <IconBtn label="Move up" onClick={() => move(i, -1)} disabled={i === 0}>
                            <ArrowUp />
                          </IconBtn>
                          <IconBtn label="Move down" onClick={() => move(i, 1)} disabled={i === rows.length - 1}>
                            <ArrowDown />
                          </IconBtn>
                          <IconBtn
                            label="Delete item"
                            onClick={() => {
                              setRows((rs) => rs.filter((x) => x.key !== r.key));
                              setDirty(true);
                            }}
                          >
                            <Trash2 />
                          </IconBtn>
                        </span>
                      </div>
                    </div>
                  )}
                </Card>
                {!readOnly && lastOfGroup && (
                  <button
                    onClick={() => add(i, r.section, r.appliesTo === "project" ? r.project : "")}
                    className="mt-1 inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-grey hover:text-ink"
                  >
                    <Plus className="size-3.5" /> Add item to {r.section}
                    {r.appliesTo === "project" ? ` · ${r.project}` : ""}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {!readOnly && (
          <>
            <Button variant="outline" onClick={() => add(rows.length - 1, "New section")}>
              <Plus /> Add section
            </Button>
            <div className="sticky bottom-0 z-10 -mx-1 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-paper/95 px-4 py-3 backdrop-blur">
              <span className="text-sm" role="status" aria-live="polite">
                {msg ? (
                  <span className={cn("inline-flex items-center gap-1.5", msg.ok ? "text-ok" : "text-warn")}>
                    {msg.ok && <CheckCircle2 className="size-4" />}
                    {msg.text}
                  </span>
                ) : (
                  <span className="text-grey">{dirty ? "Unsaved changes" : "All changes saved"}</span>
                )}
              </span>
              <Button onClick={save} disabled={pending || !dirty}>
                {pending ? <Loader2 className="animate-spin" /> : <Save />} Save {sel.desig}
              </Button>
            </div>
          </>
        )}

        <datalist id="sections">
          {sections.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
        <datalist id="projects">
          {projects.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </div>
    </div>
  );
}

function IconBtn({ label, children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className="inline-flex size-8 items-center justify-center rounded-lg text-grey transition-colors hover:bg-amber-soft hover:text-ink disabled:opacity-30 [&_svg]:size-4"
      {...props}
    >
      {children}
    </button>
  );
}
