import { ReactNode } from "react";
import { cn } from "../lib/utils";

interface MetricCardProps {
  icon: ReactNode;
  label: string;
  value: string;
  change?: number;
  changeIsGood?: boolean;
  variant?: "retain" | "obtain" | "neutral";
  className?: string;
}

export function MetricCard({ icon, label, value, change, changeIsGood = true, variant = "neutral", className }: MetricCardProps) {
  const accentColor = variant === "retain" ? "#293b83" : variant === "obtain" ? "#10B981" : "#67b4b0";
  const isPositive = change !== undefined && change >= 0;
  const isGoodChange = changeIsGood ? isPositive : !isPositive;

  return (
    <div className={cn("bg-white rounded-xl p-5 shadow-sm border border-slate-100", className)}>
      <div className="flex items-start justify-between">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: `${accentColor}15` }}
        >
          <span style={{ color: accentColor }}>{icon}</span>
        </div>
        {change !== undefined && (
          <div className={cn("flex items-center gap-1 text-xs font-medium", isGoodChange ? "text-green-600" : "text-red-500")}>
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {isPositive
                ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
                : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
              }
            </svg>
            {Math.abs(change).toFixed(1)}%
          </div>
        )}
      </div>
      <div className="mt-3">
        <p className="text-xs text-slate-500 font-medium">{label}</p>
        <p className="text-2xl font-bold text-slate-900 mt-0.5 tabular-nums">{value}</p>
      </div>
    </div>
  );
}
