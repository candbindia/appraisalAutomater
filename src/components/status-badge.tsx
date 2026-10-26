import { cn } from "@/lib/utils";
import {
  CYCLE_STATUS_LABEL,
  RATER_LABEL,
  RATER_TONE,
  STATUS_LABEL,
  type AppraisalStatus,
  type CycleStatus,
  type Rater,
} from "@/lib/types";

const tone: Record<AppraisalStatus, string> = {
  in_progress: "bg-amber-soft text-[#8a5a12] border-[#f3d6a3]",
  awaiting_approval: "bg-[#eef0f7] text-[#3b4a7a] border-[#d5daea]",
  approved: "bg-ok-soft text-ok border-[#c2e1cd]",
};

const cycleTone: Record<CycleStatus, string> = {
  draft: "bg-paper text-grey border-line",
  open: "bg-amber-soft text-[#8a5a12] border-[#f3d6a3]",
  closed: "bg-ok-soft text-ok border-[#c2e1cd]",
};

const pill = "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap";

export function StatusBadge({ status, className }: { status: AppraisalStatus; className?: string }) {
  return <span className={cn(pill, tone[status], className)}>{STATUS_LABEL[status]}</span>;
}

export function CycleBadge({ status, className }: { status: CycleStatus; className?: string }) {
  return <span className={cn(pill, cycleTone[status], className)}>{CYCLE_STATUS_LABEL[status]}</span>;
}

export function RaterChip({ rater, className, children }: { rater: Rater; className?: string; children?: React.ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap", RATER_TONE[rater], className)}>
      {children ?? RATER_LABEL[rater]}
    </span>
  );
}
