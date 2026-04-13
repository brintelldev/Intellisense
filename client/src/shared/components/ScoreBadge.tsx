import { ScoreTier } from "../types";
import { cn } from "../lib/utils";

const CONFIG: Record<ScoreTier, { label: string; className: string }> = {
  hot:          { label: "Hot",           className: "bg-emerald-100 text-emerald-700 font-semibold" },
  warm:         { label: "Warm",          className: "bg-amber-100 text-amber-700" },
  cold:         { label: "Cold",          className: "bg-slate-100 text-slate-600" },
  disqualified: { label: "Desqualificado", className: "bg-red-100 text-red-600" },
};

export function ScoreBadge({ tier, className }: { tier: ScoreTier; className?: string }) {
  const { label, className: cfg } = CONFIG[tier];
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", cfg, className)}>
      {label}
    </span>
  );
}
