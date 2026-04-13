import { ShapValue } from "../types";
import { cn } from "../lib/utils";

interface ShapWaterfallProps {
  factors: ShapValue[];
  baseProbability: number;
  finalProbability: number;
  variant?: "retain" | "obtain";
  className?: string;
}

export function ShapWaterfall({ factors, baseProbability, finalProbability, variant = "retain", className }: ShapWaterfallProps) {
  // In Retain: positive direction = increases churn (bad = red), negative = protects (good = green)
  // In Obtain: positive direction = increases conversion (good = green), negative = decreases (bad = red)
  const positiveColor = variant === "retain" ? "#ef4444" : "#10B981";
  const negativeColor = variant === "retain" ? "#10B981" : "#ef4444";

  const maxImpact = Math.max(...factors.map(f => Math.abs(f.impact)));

  return (
    <div className={cn("space-y-3", className)}>
      {/* Base probability */}
      <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
        <span>Probabilidade base</span>
        <span className="font-medium">{(baseProbability * 100).toFixed(0)}%</span>
      </div>
      <div className="border-t border-dashed border-slate-200" />

      {/* Factors */}
      {factors.map((factor, i) => {
        const barColor = factor.direction === "positive" ? positiveColor : negativeColor;
        const pct = (Math.abs(factor.impact) / maxImpact) * 100;
        const isPos = factor.direction === "positive";
        const impactLabel = `${isPos ? "+" : "−"}${(Math.abs(factor.impact) * 100).toFixed(0)}%`;

        return (
          <div key={i} className="flex items-center gap-3">
            {/* Factor name */}
            <div className="flex-1 min-w-0">
              <p className="text-xs text-slate-700 truncate">{factor.label}</p>
            </div>
            {/* Bar */}
            <div className="flex items-center gap-2 w-48 flex-shrink-0">
              <div className="flex-1 h-5 bg-slate-100 rounded overflow-hidden relative">
                <div
                  className="absolute top-0 h-full rounded transition-all duration-500"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: barColor,
                    left: isPos ? 0 : "auto",
                    right: isPos ? "auto" : 0,
                    opacity: 0.85,
                  }}
                />
              </div>
              <span
                className="text-xs font-semibold w-10 text-right tabular-nums"
                style={{ color: barColor }}
              >
                {impactLabel}
              </span>
            </div>
          </div>
        );
      })}

      <div className="border-t border-slate-200" />

      {/* Final probability */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-700">
          {variant === "retain" ? "Prob. de Churn" : "Prob. de Conversão"}
        </span>
        <span
          className="text-xl font-bold tabular-nums"
          style={{ color: variant === "retain" ? "#ef4444" : "#10B981" }}
        >
          {(finalProbability * 100).toFixed(0)}%
        </span>
      </div>
    </div>
  );
}
