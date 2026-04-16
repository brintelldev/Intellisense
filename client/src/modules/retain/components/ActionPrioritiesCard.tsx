import { useLocation } from "wouter";
import { fmtBRL } from "../../../shared/lib/format";

interface Priority {
  customerId: string;
  name: string;
  segment: string | null;
  revenue: number;
  healthScore: number;
  churnProbability: number;
  riskLevel: string;
  contractRemainingDays: number | null;
  topFactor: { label: string; impact: number } | null;
  recommendedAction: string;
  scoreTrend: { direction: "declining" | "stable" | "improving"; delta: number };
}

interface ActionPrioritiesData {
  priorities: Priority[];
  totalRevenueAtStake: number;
  contractsExpiring30d: number;
  criticalCount: number;
  highCount: number;
}

interface Props {
  data: ActionPrioritiesData;
  onSelectCustomer?: (customerId: string) => void;
}

const RISK_COLORS: Record<string, string> = {
  critical: "bg-red-100 text-red-700 border border-red-200",
  high: "bg-orange-100 text-orange-700 border border-orange-200",
  medium: "bg-amber-100 text-amber-700 border border-amber-200",
  low: "bg-green-100 text-green-700 border border-green-200",
};

const RISK_LABELS: Record<string, string> = {
  critical: "Crítico",
  high: "Alto",
  medium: "Médio",
  low: "Baixo",
};

const TREND_ICON = (direction: "declining" | "stable" | "improving", delta: number) => {
  if (direction === "declining") return <span className="text-red-500 text-xs font-medium">↓ {Math.abs(delta)} pts</span>;
  if (direction === "improving") return <span className="text-green-500 text-xs font-medium">↑ {Math.abs(delta)} pts</span>;
  return <span className="text-slate-400 text-xs">→ estável</span>;
};

export function ActionPrioritiesCard({ data, onSelectCustomer }: Props) {
  const [, navigate] = useLocation();
  const { priorities, totalRevenueAtStake, contractsExpiring30d, criticalCount, highCount } = data;

  if (priorities.length === 0) return null;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#293b83]/5 to-transparent border-b border-slate-100 px-5 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#293b83]/10 flex items-center justify-center">
              <svg className="w-4 h-4 text-[#293b83]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <h2 className="font-bold text-slate-900 text-sm">Suas Prioridades Esta Semana</h2>
              <p className="text-xs text-slate-500">Clientes que requerem ação imediata</p>
            </div>
          </div>
          <button
            onClick={() => navigate("/retain/predictions")}
            className="text-xs font-medium text-[#293b83] hover:underline"
          >
            Ver todos →
          </button>
        </div>

        {/* Banner stats */}
        <div className="flex gap-4 mt-3">
          {totalRevenueAtStake > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span className="text-xs text-slate-600 font-medium">
                {fmtBRL(totalRevenueAtStake)} em receita protegível
              </span>
            </div>
          )}
          {contractsExpiring30d > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              <span className="text-xs text-slate-600 font-medium">
                {contractsExpiring30d} contrato{contractsExpiring30d > 1 ? "s" : ""} vencem em 30d
              </span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
            <span className="text-xs text-slate-600 font-medium">{criticalCount} crítico{criticalCount !== 1 ? "s" : ""} · {highCount} alto risco</span>
          </div>
        </div>
      </div>

      {/* Priority cards */}
      <div className="divide-y divide-slate-50">
        {priorities.map((p) => (
          <div
            key={p.customerId}
            className="px-5 py-4 hover:bg-slate-50/50 transition-colors cursor-pointer"
            onClick={() => onSelectCustomer?.(p.customerId)}
          >
            <div className="flex items-start gap-4">
              {/* Left: name + badges */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-slate-900 text-sm">{p.name}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${RISK_COLORS[p.riskLevel] ?? "bg-slate-100 text-slate-500"}`}>
                    {RISK_LABELS[p.riskLevel] ?? p.riskLevel}
                  </span>
                  {TREND_ICON(p.scoreTrend.direction, p.scoreTrend.delta)}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {p.segment && `${p.segment} · `}
                  {fmtBRL(p.revenue)}/mês · Score {p.healthScore} · Churn {Math.round(p.churnProbability * 100)}%
                  {p.contractRemainingDays != null && p.contractRemainingDays > 0 && p.contractRemainingDays < 60 && (
                    <span className="text-red-600 font-medium"> · Contrato vence em {p.contractRemainingDays}d</span>
                  )}
                </p>
                {p.topFactor && (
                  <p className="text-xs text-slate-500 mt-1">
                    <span className="font-medium text-slate-700">📉 {p.topFactor.label}</span>
                  </p>
                )}
                <p className="text-xs text-[#293b83] font-medium mt-1 line-clamp-1">
                  → {p.recommendedAction.split(".")[0]}.
                </p>
              </div>
              {/* Right: arrow */}
              <svg className="w-4 h-4 text-slate-300 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
