import { RiskLevel } from "../types";
import { cn } from "../lib/utils";

const CONFIG: Record<RiskLevel, { label: string; className: string }> = {
  low:      { label: "Baixo",    className: "bg-green-100 text-green-700" },
  medium:   { label: "Médio",    className: "bg-amber-100 text-amber-700" },
  high:     { label: "Alto",     className: "bg-orange-100 text-orange-700" },
  critical: { label: "Crítico",  className: "bg-red-100 text-red-700 font-semibold" },
};

export function RiskBadge({ level, className }: { level: RiskLevel; className?: string }) {
  const { label, className: cfg } = CONFIG[level];
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", cfg, className)}>
      {label}
    </span>
  );
}
