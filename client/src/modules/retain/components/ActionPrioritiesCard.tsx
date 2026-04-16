import { useState } from "react";
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
  scoreTrend: { direction: "declining" | "stable" | "improving"; delta: number; weeksAnalyzed?: number };
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
  critical: "Crítico", high: "Alto", medium: "Médio", low: "Baixo",
};

function TrendIcon({ direction, delta }: { direction: "declining" | "stable" | "improving"; delta: number }) {
  if (direction === "declining") return <span className="text-red-500 text-xs font-medium">↓{Math.abs(delta)}pts</span>;
  if (direction === "improving") return <span className="text-green-500 text-xs font-medium">↑{Math.abs(delta)}pts</span>;
  return <span className="text-slate-400 text-xs">→ estável</span>;
}

function CountdownBadge({ p }: { p: Priority }) {
  // Countdown from score trend
  if (p.scoreTrend.direction === "declining" && Math.abs(p.scoreTrend.delta) > 5 && p.healthScore > 0) {
    const weeksAnalyzed = p.scoreTrend.weeksAnalyzed ?? 4;
    const deltaPerWeek = Math.abs(p.scoreTrend.delta) / Math.max(weeksAnalyzed, 1);
    const daysUntilChurn = deltaPerWeek > 0
      ? Math.round(p.healthScore / (deltaPerWeek / 7))
      : null;
    if (daysUntilChurn && daysUntilChurn > 0 && daysUntilChurn < 90) {
      const colorClass = daysUntilChurn < 15 ? "bg-red-100 text-red-700" : daysUntilChurn < 30 ? "bg-orange-100 text-orange-700" : "bg-amber-100 text-amber-700";
      return (
        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${colorClass}`}>
          ⏱ ~{daysUntilChurn}d
        </span>
      );
    }
  }
  // Contract countdown
  if (p.contractRemainingDays != null && p.contractRemainingDays > 0 && p.contractRemainingDays < 60) {
    const colorClass = p.contractRemainingDays < 15 ? "bg-red-100 text-red-700" : p.contractRemainingDays < 30 ? "bg-orange-100 text-orange-700" : "bg-amber-100 text-amber-700";
    return (
      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${colorClass}`}>
        📋 {p.contractRemainingDays}d
      </span>
    );
  }
  return null;
}

export function ActionPrioritiesCard({ data, onSelectCustomer }: Props) {
  const [, navigate] = useLocation();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const { priorities, totalRevenueAtStake, contractsExpiring30d, criticalCount, highCount } = data;

  if (priorities.length === 0) return null;

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedPriorities = priorities.filter(p => selected.has(p.customerId));
  const protectedRevenue = selectedPriorities.reduce((sum, p) => sum + p.revenue, 0);
  const hasSelection = selected.size > 0;

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
              <p className="text-xs text-slate-500">Selecione clientes para ver impacto da ação</p>
            </div>
          </div>
          <button onClick={() => navigate("/retain/predictions")} className="text-xs font-medium text-[#293b83] hover:underline">
            Ver todos →
          </button>
        </div>

        {/* Impact simulator banner */}
        {hasSelection ? (
          <div className="mt-3 bg-[#293b83] text-white rounded-lg px-4 py-2.5 flex items-center justify-between">
            <div>
              <span className="text-xs text-white/80">Se atuar nos {selected.size} selecionados →</span>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-base">🛡️</span>
                <span className="font-bold text-sm">{fmtBRL(protectedRevenue)}/mês protegidos</span>
                <span className="text-xs text-white/70">({fmtBRL(protectedRevenue * 12)}/ano)</span>
              </div>
            </div>
            <button
              onClick={() => setSelected(new Set())}
              className="text-xs text-white/70 hover:text-white underline ml-3 flex-shrink-0"
            >
              Limpar
            </button>
          </div>
        ) : (
          <div className="flex gap-4 mt-3">
            {totalRevenueAtStake > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span className="text-xs text-slate-600 font-medium">{fmtBRL(totalRevenueAtStake)} em receita protegível</span>
              </div>
            )}
            {contractsExpiring30d > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                <span className="text-xs text-slate-600 font-medium">{contractsExpiring30d} contrato{contractsExpiring30d > 1 ? "s" : ""} vencem em 30d</span>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
              <span className="text-xs text-slate-600 font-medium">{criticalCount} crítico{criticalCount !== 1 ? "s" : ""} · {highCount} alto risco</span>
            </div>
          </div>
        )}
      </div>

      {/* Priority cards */}
      <div className="divide-y divide-slate-50">
        {priorities.map((p) => (
          <div
            key={p.customerId}
            className={`px-5 py-4 hover:bg-slate-50/50 transition-colors cursor-pointer ${selected.has(p.customerId) ? "bg-[#293b83]/[0.03]" : ""}`}
            onClick={() => onSelectCustomer?.(p.customerId)}
          >
            <div className="flex items-start gap-3">
              {/* Checkbox */}
              <div
                className="flex-shrink-0 mt-0.5"
                onClick={(e) => toggleSelect(p.customerId, e)}
              >
                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${selected.has(p.customerId) ? "bg-[#293b83] border-[#293b83]" : "border-slate-300 hover:border-[#293b83]"}`}>
                  {selected.has(p.customerId) && (
                    <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
              </div>

              {/* Left: name + badges */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-slate-900 text-sm">{p.name}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${RISK_COLORS[p.riskLevel] ?? "bg-slate-100 text-slate-500"}`}>
                    {RISK_LABELS[p.riskLevel] ?? p.riskLevel}
                  </span>
                  <TrendIcon direction={p.scoreTrend.direction} delta={p.scoreTrend.delta} />
                  <CountdownBadge p={p} />
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {p.segment && `${p.segment} · `}
                  {fmtBRL(p.revenue)}/mês · Score {p.healthScore} · Churn {Math.round(p.churnProbability * 100)}%
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

      {/* Footer action */}
      {hasSelection && (
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button
            onClick={() => {
              alert(`Plano de ação criado para ${selected.size} cliente${selected.size > 1 ? "s" : ""}!`);
              setSelected(new Set());
            }}
            className="text-sm font-medium bg-[#293b83] text-white px-4 py-2 rounded-lg hover:bg-[#1e2d6b] transition-colors"
          >
            Criar Plano de Ação para {selected.size} →
          </button>
        </div>
      )}
    </div>
  );
}
