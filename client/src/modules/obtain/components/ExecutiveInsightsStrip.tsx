/**
 * ExecutiveInsightsStrip — reutilizável em:
 *  1. Tela de conclusão de upload (step "done")
 *  2. Topo do ObtainDashboardPage
 *
 * Fonte de dados: intelligenceSummary.executiveInsights (upload)
 *              ou dashData.executiveInsights (dashboard)
 */

interface PriorityConcentration {
  topN: number;
  topLeadsPct: number;
  ltvPct: number;
  totalLeads: number;
  totalLtv: number;
}

interface BestProfile {
  industry: string | null;
  companySize: string | null;
  matchedCluster: string | null;
  adherencePct: number;
  leadCount: number;
}

interface DataReadinessSummary {
  coveragePct: number;
  readyFor: string[];
  missing: string[];
}

export interface ExecutiveInsightsData {
  executiveInsights?: string[];
  priorityConcentration?: PriorityConcentration | null;
  bestProfile?: BestProfile | null;
  dataReadinessSummary?: DataReadinessSummary | null;
}

interface Props {
  data: ExecutiveInsightsData;
  /** Show full layout (upload done page) or compact strip (dashboard) */
  variant?: "full" | "compact";
}

const INSIGHT_ICONS = ["📊", "💰", "🏆", "🎯", "⚠️"];

const SIZE_LABELS: Record<string, string> = {
  micro: "micro", small: "pequeno porte", medium: "médio porte",
  large: "grande porte", enterprise: "enterprise",
};

function fmtMoney(v: number) {
  if (v >= 1_000_000_000) return `R$${(v / 1_000_000_000).toFixed(1)}B`;
  if (v >= 1_000_000) return `R$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `R$${Math.round(v / 1_000)}K`;
  return `R$${v}`;
}

export function ExecutiveInsightsStrip({ data, variant = "compact" }: Props) {
  const { executiveInsights, priorityConcentration, bestProfile, dataReadinessSummary } = data;

  const hasInsights = executiveInsights && executiveInsights.length > 0;
  const hasPareto = priorityConcentration && priorityConcentration.ltvPct > 0;
  const hasProfile = bestProfile && bestProfile.adherencePct > 0;
  const hasReadiness = dataReadinessSummary;

  if (!hasInsights && !hasPareto && !hasProfile) return null;

  if (variant === "compact") {
    return (
      <div className="bg-gradient-to-r from-[#10B981]/5 via-transparent to-transparent rounded-xl border border-[#10B981]/20 px-5 py-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-6 h-6 rounded-md bg-[#10B981]/10 flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-[#10B981]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <span className="text-xs font-semibold text-slate-700">Leitura executiva do pipeline</span>
        </div>
        <ul className="space-y-1.5">
          {(executiveInsights ?? []).slice(0, 5).map((insight, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-slate-600">
              <span className="flex-shrink-0 mt-0.5">{INSIGHT_ICONS[i % INSIGHT_ICONS.length]}</span>
              <span>{insight}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  // Full variant — used on upload "done" step
  return (
    <div className="space-y-3">
      {/* Executive Insights bullets */}
      {hasInsights && (
        <div className="bg-gradient-to-r from-[#10B981]/8 to-emerald-50/60 rounded-xl border border-[#10B981]/15 px-5 py-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg bg-[#10B981] flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-slate-800 text-sm">Leitura executiva do pipeline</p>
              <p className="text-xs text-slate-500">Análise automática com base nos dados importados</p>
            </div>
          </div>
          <ul className="space-y-2">
            {executiveInsights!.map((insight, i) => (
              <li key={i} className="flex items-start gap-2.5 bg-white/60 rounded-lg px-3 py-2.5">
                <span className="text-base flex-shrink-0">{INSIGHT_ICONS[i % INSIGHT_ICONS.length]}</span>
                <span className="text-sm text-slate-700">{insight}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Pareto concentration bar */}
      {hasPareto && (
        <div className="bg-white border border-slate-100 rounded-xl px-5 py-4">
          <p className="text-xs font-semibold text-slate-600 mb-3">Concentração de potencial (Lei de Pareto)</p>
          <div className="space-y-2">
            {/* Universe bar */}
            <div>
              <div className="flex justify-between text-xs text-slate-500 mb-1">
                <span>Pipeline total ({priorityConcentration!.totalLeads} leads)</span>
                <span>{fmtMoney(priorityConcentration!.totalLtv)}</span>
              </div>
              <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-slate-300 rounded-full w-full" />
              </div>
            </div>
            {/* Priority subset bar */}
            <div>
              <div className="flex justify-between text-xs font-medium mb-1">
                <span className="text-[#10B981]">
                  Top {priorityConcentration!.topN} prioritários ({priorityConcentration!.topLeadsPct}% dos leads)
                </span>
                <span className="text-[#10B981]">{priorityConcentration!.ltvPct}% do potencial</span>
              </div>
              <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#10B981] rounded-full transition-all"
                  style={{ width: `${priorityConcentration!.ltvPct}%` }}
                />
              </div>
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-2 italic">
            Concentre o esforço nos {priorityConcentration!.topN} leads prioritários para maximizar o retorno.
          </p>
        </div>
      )}

      {/* Best profile */}
      {hasProfile && (
        <div className="flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3.5">
          <span className="text-xl flex-shrink-0">🎯</span>
          <div>
            <p className="text-xs font-semibold text-slate-700">
              Perfil ICP predominante:{" "}
              {bestProfile!.industry ?? "indefinido"}
              {bestProfile!.companySize ? ` · ${SIZE_LABELS[bestProfile!.companySize] ?? bestProfile!.companySize}` : ""}
            </p>
            {bestProfile!.matchedCluster && (
              <p className="text-xs text-slate-500">
                Cluster: <strong className="text-[#293b83]">{bestProfile!.matchedCluster}</strong>
              </p>
            )}
            <p className="text-xs text-slate-500">
              {bestProfile!.leadCount} leads qualificados ({bestProfile!.adherencePct}% do pipeline prioritário)
            </p>
          </div>
        </div>
      )}

      {/* Data readiness — only on upload done */}
      {hasReadiness && dataReadinessSummary!.readyFor.length > 0 && (
        <div className={`flex items-start gap-3 rounded-xl px-4 py-3.5 border ${
          dataReadinessSummary!.coveragePct >= 60
            ? "bg-emerald-50 border-emerald-100"
            : "bg-amber-50 border-amber-100"
        }`}>
          <span className="text-xl flex-shrink-0">{dataReadinessSummary!.coveragePct >= 60 ? "✅" : "⚠️"}</span>
          <div>
            <p className="text-xs font-semibold text-slate-700">
              Cobertura de diagnóstico: {dataReadinessSummary!.coveragePct}%
            </p>
            <p className="text-xs text-slate-600 mt-0.5">
              Disponível: {dataReadinessSummary!.readyFor.join(" · ")}
              {dataReadinessSummary!.missing.length > 0 && (
                <span className="text-amber-600"> · Parcial: {dataReadinessSummary!.missing.join(", ")}</span>
              )}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
