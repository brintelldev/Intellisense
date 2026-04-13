import { AlertTriangle } from "lucide-react";
import { FunnelStage } from "../types";
import { cn } from "../lib/utils";

interface FunnelChartProps {
  stages: FunnelStage[];
  className?: string;
  compact?: boolean;
}

export function FunnelChart({ stages, className, compact = false }: FunnelChartProps) {
  const maxLeads = stages[0]?.leadsCount ?? 1;

  return (
    <div className={cn("flex items-stretch gap-0", className)}>
      {stages.map((stage, i) => {
        const pct = (stage.leadsCount / maxLeads) * 100;
        const isBottleneck = stage.isBottleneck;
        const dropOff = stage.dropOffRate > 0 ? `${(stage.dropOffRate * 100).toFixed(0)}% perdidos` : null;
        const isLast = i === stages.length - 1;

        return (
          <div key={stage.id} className="flex items-center flex-1 min-w-0">
            {/* Stage block */}
            <div
              className={cn(
                "flex-1 rounded-lg p-3 text-center transition-all border-2",
                isBottleneck
                  ? "border-red-400 bg-red-50"
                  : "border-transparent bg-emerald-50",
                compact ? "py-2" : "py-4"
              )}
              style={{
                opacity: 0.4 + (pct / 100) * 0.6,
              }}
            >
              <div className="text-xs font-medium text-slate-500 truncate">{stage.name}</div>
              <div className={cn("font-bold text-slate-800 tabular-nums", compact ? "text-lg" : "text-2xl")}>
                {stage.leadsCount}
              </div>
              <div className="text-xs text-slate-400">{pct.toFixed(0)}%</div>
              {isBottleneck && (
                <div className="mt-1 flex justify-center">
                  <span className="inline-flex items-center gap-1 text-[10px] bg-red-100 text-red-600 rounded px-1.5 py-0.5 font-medium">
                    <AlertTriangle className="w-2.5 h-2.5" />
                    Gargalo
                  </span>
                </div>
              )}
            </div>

            {/* Arrow + drop-off */}
            {!isLast && (
              <div className="flex flex-col items-center mx-1 flex-shrink-0">
                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                {dropOff && !compact && (
                  <span className="text-[10px] text-red-400 font-medium whitespace-nowrap mt-0.5">{dropOff}</span>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
