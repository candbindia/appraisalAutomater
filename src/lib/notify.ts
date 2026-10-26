import "server-only";
import { RATER_LABEL, type Rater } from "./types";
import { formatDate } from "./utils";

/**
 * Reminder emails. Sent through Resend when RESEND_API_KEY and NOTIFY_FROM are set;
 * otherwise HR gets a ready-made email to send from their own mail app.
 */

export interface Recipient {
  name: string;
  email: string;
  /** For self reminders: one entry (the employee). For other parts: every person they still need to score. */
  pending: { employee: string; left: number; total: number }[];
}

export const emailConfigured = () => !!(process.env.RESEND_API_KEY && process.env.NOTIFY_FROM);

export function sheetUrl() {
  const id = process.env.GOOGLE_SHEETS_ID;
  return id ? `https://docs.google.com/spreadsheets/d/${id}/edit` : "";
}

export function reminderEmail(part: Rater, cycle: { name: string; cycleId: string; selfDue: string; reviewDue: string }, r: Recipient) {
  const due = formatDate(part === "self" ? cycle.selfDue : cycle.reviewDue);
  const where = `the "Scores ${cycle.cycleId}" tab${sheetUrl() ? `: ${sheetUrl()}` : ""}`;
  if (part === "self") {
    const p = r.pending[0];
    return {
      subject: `Reminder: your ${cycle.name} self-assessment is pending`,
      text: [
        `Hi ${r.name.split(" ")[0]},`,
        "",
        `Your self-assessment for ${cycle.name} still has ${p.left} of ${p.total} items without points. It was due on ${due}.`,
        `Please fill in your rows (Scored by = Self) in ${where}`,
        "",
        "Thank you,",
        "HR, Consulting & Beyond",
      ].join("\n"),
    };
  }
  return {
    subject: `Reminder: ${RATER_LABEL[part]} scores pending for ${cycle.name}`,
    text: [
      `Hi ${r.name.split(" ")[0]},`,
      "",
      `The ${RATER_LABEL[part]} items for ${cycle.name} are still pending for:`,
      ...r.pending.map((p) => `  • ${p.employee} — ${p.left} of ${p.total} items left`),
      "",
      `They were due on ${due}. Please fill in the rows marked "Scored by = ${RATER_LABEL[part]}" in ${where}`,
      "",
      "Thank you,",
      "HR, Consulting & Beyond",
    ].join("\n"),
  };
}

/** One message per recipient, in batches of 100 (Resend's batch limit). */
export async function sendWithResend(messages: { to: string; subject: string; text: string }[]) {
  const key = process.env.RESEND_API_KEY!;
  const from = process.env.NOTIFY_FROM!;
  for (let i = 0; i < messages.length; i += 100) {
    const res = await fetch("https://api.resend.com/emails/batch", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(messages.slice(i, i + 100).map((m) => ({ from, to: [m.to], subject: m.subject, text: m.text }))),
    });
    if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
}

/** A single email for HR's own mail app: everyone in BCC, generic wording. */
export function mailtoLink(part: Rater, cycle: { name: string; cycleId: string; selfDue: string; reviewDue: string }, recipients: Recipient[]) {
  const due = formatDate(part === "self" ? cycle.selfDue : cycle.reviewDue);
  const subject =
    part === "self" ? `Reminder: ${cycle.name} self-assessment pending` : `Reminder: ${RATER_LABEL[part]} scores pending for ${cycle.name}`;
  const body = [
    "Hi,",
    "",
    part === "self"
      ? `Your self-assessment for ${cycle.name} is still incomplete (due ${due}).`
      : `Some ${RATER_LABEL[part]} items for ${cycle.name} are still pending (due ${due}):\n${recipients
          .flatMap((r) => r.pending.map((p) => `  • ${p.employee} — ${p.left} left`))
          .join("\n")}`,
    `Please fill in your rows in the "Scores ${cycle.cycleId}" tab${sheetUrl() ? `: ${sheetUrl()}` : "."}`,
    "",
    "Thank you,",
    "HR, Consulting & Beyond",
  ].join("\n");
  const bcc = recipients.map((r) => r.email).filter(Boolean).join(",");
  return `mailto:?bcc=${encodeURIComponent(bcc)}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
