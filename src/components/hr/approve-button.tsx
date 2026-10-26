"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ApproveButton({ appraisalId, label }: { appraisalId: string; label: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        disabled={pending}
        onClick={() => {
          if (!window.confirm(`Approve ${label}? The score is locked as it is now.`)) return;
          setError("");
          start(async () => {
            const res = await fetch(`/api/appraisals/${encodeURIComponent(appraisalId)}/approve`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: "{}",
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) setError(data.error ?? "Could not approve.");
            else router.refresh();
          });
        }}
      >
        {pending ? <Loader2 className="animate-spin" /> : <CheckCircle2 />} Approve
      </Button>
      {error && <p className="text-xs text-warn">{error}</p>}
    </div>
  );
}
