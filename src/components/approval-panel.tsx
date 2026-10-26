"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { RATER_LABEL, type Rater } from "@/lib/types";

export function ApprovalPanel({
  appraisalId,
  canApprove,
  submittedParts,
  scoreLine,
}: {
  appraisalId: string;
  canApprove: boolean;
  submittedParts: Rater[];
  scoreLine: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [mode, setMode] = useState<"idle" | "back">("idle");
  const [part, setPart] = useState<Rater>(submittedParts[0]);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  function post(path: string, body: object) {
    setError("");
    start(async () => {
      const res = await fetch(`/api/appraisals/${encodeURIComponent(appraisalId)}/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? data.issues?.[0]?.message ?? "Could not complete that.");
        return;
      }
      setMode("idle");
      setNote("");
      router.refresh();
    });
  }

  return (
    <Card className="border-amber p-4 md:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-medium">{canApprove ? "Ready for your approval" : "Review in progress"}</div>
          <div className="text-sm text-grey">{scoreLine}</div>
        </div>
        <div className="flex flex-wrap gap-2">
          {submittedParts.length > 0 && (
            <Button variant="outline" onClick={() => setMode(mode === "back" ? "idle" : "back")} disabled={pending}>
              <Undo2 /> Send back
            </Button>
          )}
          {canApprove && (
            <Button
              onClick={() => window.confirm("Approve and lock this appraisal?") && post("approve", {})}
              disabled={pending}
            >
              {pending && mode === "idle" ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
              Approve
            </Button>
          )}
        </div>
      </div>
      {mode === "back" && (
        <div className="mt-4 grid gap-2 md:grid-cols-[200px_1fr_auto]">
          <select value={part} onChange={(e) => setPart(e.target.value as Rater)} className="h-10 rounded-lg border border-line bg-card px-2 text-sm" aria-label="Part to send back">
            {submittedParts.map((p) => (
              <option key={p} value={p}>
                {RATER_LABEL[p]} part
              </option>
            ))}
          </select>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={1000}
            placeholder="What needs to be clarified or corrected?"
            className="h-10 rounded-lg border border-line bg-card px-3 text-sm"
          />
          <Button variant="dark" onClick={() => post("send-back", { part, note })} disabled={pending || note.trim().length < 3}>
            {pending ? <Loader2 className="animate-spin" /> : <Undo2 />} Send back
          </Button>
        </div>
      )}
      {error && <p className="mt-2 text-sm text-warn">{error}</p>}
    </Card>
  );
}
