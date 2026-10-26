"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Mail, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Rater } from "@/lib/types";

/** "Send email" (Resend, when configured) and "Open in my email" (HR's own mail app). Both are logged. */
export function NotifyButtons({
  cycleId,
  part,
  appraisalIds,
  emailEnabled,
  size = "default",
}: {
  cycleId: string;
  part: Rater;
  appraisalIds: string[];
  emailEnabled: boolean;
  size?: "default" | "sm";
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<"email" | "mailto" | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function send(channel: "email" | "mailto") {
    if (channel === "email" && !window.confirm(`Send reminder emails for ${appraisalIds.length} appraisal(s)?`)) return;
    setBusy(channel);
    setMsg(null);
    start(async () => {
      try {
        const res = await fetch("/api/notify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cycleId, part, appraisalIds, channel }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setMsg({ ok: false, text: data.error ?? "Could not send." });
          return;
        }
        if (channel === "mailto") {
          window.location.href = data.mailto;
          setMsg({ ok: true, text: `Email drafted for ${data.recipients} recipient(s) — send it from your mail app.` });
        } else {
          setMsg({
            ok: true,
            text: `Sent to ${data.sent} recipient(s).${data.noEmail?.length ? ` No email address for ${data.noEmail.join(", ")}.` : ""}`,
          });
        }
        router.refresh();
      } finally {
        setBusy(null);
      }
    });
  }

  const disabled = pending || appraisalIds.length === 0;
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          size={size}
          onClick={() => send("email")}
          disabled={disabled || !emailEnabled}
          title={emailEnabled ? "Send one reminder email per person" : "Set RESEND_API_KEY and NOTIFY_FROM to send emails from the app"}
        >
          {busy === "email" ? <Loader2 className="animate-spin" /> : <Send />} Send email
        </Button>
        <Button size={size} variant="outline" onClick={() => send("mailto")} disabled={disabled}>
          {busy === "mailto" ? <Loader2 className="animate-spin" /> : <Mail />} Open in my email
        </Button>
      </div>
      {msg && <p className={msg.ok ? "text-xs text-ok" : "text-xs text-warn"}>{msg.text}</p>}
    </div>
  );
}
