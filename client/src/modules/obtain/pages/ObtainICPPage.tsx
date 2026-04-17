import { useState, Component, ReactNode } from "react";
import { useLocation } from "wouter";
import { ICPHeroCard } from "../components/ICPHeroCard";
import { ICPPriorityMatrix } from "../components/ICPPriorityMatrix";
import { ClusterRadarChart } from "../components/ClusterRadarChart";
import { EmptyState } from "../../../shared/components/EmptyState";
import { LoadingState } from "../../../shared/components/LoadingState";
import { useObtainICPClusters } from "../../../shared/hooks/useObtain";

const fmtBRL = (v: number) => v >= 1_000_000 ? `R$${(v / 1_000_000).toFixed(1)}M` : `R$${Math.round(v / 1_000)}K`;

const TYPE_CONFIG: Record<string, { label: string; dot: string; badge: string; rec: string }> = {
  ideal: { label: "ICP Ideal", dot: "bg-[#10B981]", badge: "bg-[#10B981]/10 text-[#10B981]", rec: "Escalar" },
  good:  { label: "ICP Bom",  dot: "bg-[#293b83]", badge: "bg-[#293b83]/10 text-[#293b83]", rec: "Manter"  },
  anti:  { label: "Anti-ICP", dot: "bg-red-400",   badge: "bg-red-100 text-red-600",         rec: "Reduzir" },
};

const REC_COLORS: Record<string, string> = {
  Escalar: "text-emerald-600 font-semibold",
  Manter:  "text-[#293b83] font-semibold",
  Reduzir: "text-red-600 font-semibold",
};

// Simple error boundary so a chart crash doesn't blank the whole page
class SafeBlock extends Component<{ children: ReactNode; label?: string }, { error: boolean }> {
  state = { error: false };
  static getDerivedStateFromError() { return { error: true }; }
  render() {
    if (this.state.error) {
      return (
        <div className="rounded-lg border border-slate-100 p-4 text-center text-xs text-slate-400">
          {this.props.label ?? "Componente"} não pôde ser renderizado
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Scenario Simulator ────────────────────────────────────────────────────────
// Uses ONLY real cluster data — projections are linear interpolations between
// actual ideal-cluster averages and the overall portfolio average.
function ScenarioSimulator({ clusters }: { clusters: any[] }) {
  const [concentration, setConcentration] = useState(50);

  const idealClusters = clusters.filter(c => c.type === "ideal");
  const antiClusters  = clusters.filter(c => c.type === "anti");

  if (idealClusters.length === 0) return null;

  const n = clusters.length || 1;
  const avgLtvAll   = clusters.reduce((s, c) => s + (c.avgLtv   ?? 0), 0) / n;
  const avgChurnAll = clusters.reduce((s, c) => s + (c.churnRate ?? 0), 0) / n;

  const idealAvgLtv   = idealClusters.reduce((s, c) => s + (c.avgLtv   ?? 0), 0) / idealClusters.length;
  const idealAvgChurn = idealClusters.reduce((s, c) => s + (c.churnRate ?? 0), 0) / idealClusters.length;
  const antiAvgLtv    = antiClusters.length > 0
    ? antiClusters.reduce((s, c) => s + (c.avgLtv ?? 0), 0) / antiClusters.length
    : avgLtvAll;

  const t = concentration / 100;

  // Both projections are pure linear interpolations of real cluster values
  const projLtv   = avgLtvAll   + (idealAvgLtv   - avgLtvAll)   * t;
  const projChurn = avgChurnAll + (idealAvgChurn - avgChurnAll) * t;

  const ltvGain    = projLtv - avgLtvAll;
  const churnDrop  = avgChurnAll - projChurn;

  // Only show when there is a meaningful variation (>= 5% difference between best and worst)
  const ltvRange = Math.abs(idealAvgLtv - antiAvgLtv);
  const hasLtvDiff   = avgLtvAll > 0 && ltvRange / avgLtvAll >= 0.05;
  const hasChurnDiff = avgChurnAll > 0.001 && Math.abs(idealAvgChurn - avgChurnAll) / avgChurnAll >= 0.05;

  if (!hasLtvDiff && !hasChurnDiff) return null;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="bg-gradient-to-r from-[#10B981]/5 to-transparent border-b border-slate-100 px-5 py-4 flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-[#10B981]/10 flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 text-[#10B981]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Simulador de Cenário</h3>
          <p className="text-xs text-slate-500">
            Projeção baseada nos valores reais dos clusters — interpolação entre média atual e perfis ideais
          </p>
        </div>
      </div>

      <div className="p-5 grid grid-cols-2 gap-6 items-center">
        {/* Left: slider + reference values */}
        <div className="space-y-4">
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm text-slate-600 font-medium">
                % do budget nos perfis ICP Ideal
              </label>
              <span className="text-xl font-extrabold text-[#10B981]">{concentration}%</span>
            </div>
            <input
              type="range" min={0} max={100} step={5} value={concentration}
              onChange={e => setConcentration(Number(e.target.value))}
              className="w-full h-2 rounded-full appearance-none cursor-pointer"
              style={{ accentColor: "#10B981" }}
            />
            <div className="flex justify-between text-[10px] text-slate-400 mt-1">
              <span>Distribuído</span><span>100% nos ideais</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-[11px]">
            <div className="bg-slate-50 rounded-lg p-2 text-center border border-slate-100">
              <p className="text-slate-400 mb-0.5">Pior perfil</p>
              <p className="font-semibold text-slate-700">{fmtBRL(antiAvgLtv)}</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-2 text-center border border-slate-100">
              <p className="text-slate-400 mb-0.5">Média atual</p>
              <p className="font-semibold text-slate-700">{fmtBRL(avgLtvAll)}</p>
            </div>
            <div className="bg-[#10B981]/5 rounded-lg p-2 text-center border border-[#10B981]/20">
              <p className="text-slate-400 mb-0.5">Melhor perfil</p>
              <p className="font-semibold text-[#10B981]">{fmtBRL(idealAvgLtv)}</p>
            </div>
          </div>
        </div>

        {/* Right: projected outcomes — only show metrics we have real data for */}
        <div className="grid grid-cols-2 gap-3">
          {hasLtvDiff && (
            <div className="bg-emerald-50 rounded-xl p-3 text-center border border-emerald-100">
              <p className="text-xs text-slate-500 mb-1">LTV Projetado</p>
              <p className="text-lg font-extrabold text-emerald-600">{fmtBRL(projLtv)}</p>
              {ltvGain > 1 && avgLtvAll > 0 && (
                <p className="text-[10px] text-emerald-500 mt-0.5">
                  +{Math.round((ltvGain / avgLtvAll) * 100)}% vs média atual
                </p>
              )}
            </div>
          )}
          {hasChurnDiff && (
            <div className="bg-blue-50 rounded-xl p-3 text-center border border-blue-100">
              <p className="text-xs text-slate-500 mb-1">Churn Projetado</p>
              <p className="text-lg font-extrabold text-blue-600">{(projChurn * 100).toFixed(1)}%</p>
              {churnDrop > 0.001 && avgChurnAll > 0 && (
                <p className="text-[10px] text-blue-500 mt-0.5">
                  -{Math.round((churnDrop / avgChurnAll) * 100)}% vs média atual
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function ObtainICPPage() {
  const { data: apiClusters, isLoading } = useObtainICPClusters();
  const [, navigate] = useLocation();

  if (isLoading) return <LoadingState rows={6} />;

  const icpClusters = (apiClusters ?? []) as any[];

  if (icpClusters.length === 0) {
    return (
      <EmptyState
        title="Nenhum perfil de ICP encontrado"
        description="Importe dados de leads para gerar os perfis de cliente ideal."
        action={{ label: "Importar dados", onClick: () => navigate("/obtain/upload") }}
      />
    );
  }

  // Champion = rank 1
  const champion = [...icpClusters].sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99))[0];

  // Baseline: weighted average by lead count
  const totalLeadsForBaseline = icpClusters.reduce((s, c) => s + (c.leadsInFunnel ?? 0), 0);
  const w = (c: any) => totalLeadsForBaseline > 0 ? (c.leadsInFunnel ?? 0) / totalLeadsForBaseline : 1 / icpClusters.length;
  const baseline = {
    avgLtv:            icpClusters.reduce((s, c) => s + (c.avgLtv   ?? 0) * w(c), 0),
    churnRate:         icpClusters.reduce((s, c) => s + (c.churnRate ?? 0) * w(c), 0),
    avgConversionRate: icpClusters.reduce((s, c) => s + (c.avgConversionRate ?? 0) * w(c), 0),
  };

  const idealIcp = icpClusters.find(c => c.type === "ideal");
  const antiIcp  = icpClusters.find(c => c.type === "anti");
  const ltvMultiple = antiIcp && idealIcp && antiIcp.avgLtv > 0
    ? Math.round((idealIcp.avgLtv / antiIcp.avgLtv) * 10) / 10
    : null;

  return (
    <div className="space-y-5 w-full">
      {/* Header */}
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-bold text-slate-900">Perfis de ICP</h1>
        <span className="text-xs font-semibold bg-[#10B981]/10 text-[#10B981] px-2.5 py-1 rounded-full">
          Obtain Sense
        </span>
      </div>

      {/* Row 1 — Hero "Seu Perfil Campeão" */}
      {champion && (
        <SafeBlock label="Hero do perfil campeão">
          <ICPHeroCard cluster={champion} baseline={baseline} />
        </SafeBlock>
      )}

      {/* Row 2 — Priority Matrix + Radar (equal height) */}
      <div className="grid grid-cols-2 gap-5 items-stretch">
        {/* Bubble chart */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden flex flex-col">
          <div className="bg-gradient-to-r from-[#10B981]/5 to-transparent border-b border-slate-100 px-5 py-3 flex items-center gap-2 flex-shrink-0">
            <div className="w-7 h-7 rounded-lg bg-[#10B981]/10 flex items-center justify-center flex-shrink-0">
              <svg className="w-3.5 h-3.5 text-[#10B981]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-slate-800">Mapa Estratégico</h3>
              <p className="text-xs text-slate-500 truncate">LTV médio × volume de leads por cluster</p>
            </div>
          </div>
          <div className="px-3 pt-2 pb-1 flex-shrink-0">
            <div className="flex items-center gap-4 px-1">
              {Object.entries(TYPE_CONFIG).map(([type, cfg]) => (
                <div key={type} className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                  <span className="text-[10px] text-slate-500">{cfg.label}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex-1 min-h-0">
            <SafeBlock label="Mapa estratégico">
              <ICPPriorityMatrix clusters={icpClusters} />
            </SafeBlock>
          </div>
        </div>

        {/* Radar chart */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden flex flex-col">
          <div className="bg-gradient-to-r from-[#10B981]/5 to-transparent border-b border-slate-100 px-5 py-3 flex items-center gap-2 flex-shrink-0">
            <div className="w-7 h-7 rounded-lg bg-[#10B981]/10 flex items-center justify-center flex-shrink-0">
              <svg className="w-3.5 h-3.5 text-[#10B981]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-slate-800">Radar Comparativo</h3>
              <p className="text-xs text-slate-500 truncate">Score relativo 0–100 por dimensão de qualidade</p>
            </div>
          </div>
          <div className="flex-1 p-4">
            <SafeBlock label="Radar comparativo">
              {/* Limit to top 4 clusters so the chart stays readable */}
              <ClusterRadarChart
                clusters={[...icpClusters]
                  .sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99))
                  .slice(0, 4)}
              />
            </SafeBlock>
          </div>
        </div>
      </div>

      {/* Row 3 — Ranking table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="bg-gradient-to-r from-[#10B981]/5 to-transparent border-b border-slate-100 px-5 py-3 flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#10B981]/10 flex items-center justify-center flex-shrink-0">
            <svg className="w-3.5 h-3.5 text-[#10B981]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Ranking de Perfis</h3>
            <p className="text-xs text-slate-500">Ordenado por score composto — prioridade de investimento</p>
          </div>
        </div>

        {/* Table */}
        <div>
          <div className="grid grid-cols-7 gap-2 px-5 py-2 bg-slate-50/70 border-b border-slate-100 text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
            <span>#</span>
            <span className="col-span-2">Perfil</span>
            <span className="text-right">LTV</span>
            <span className="text-right">Leads</span>
            <span className="text-right">Churn</span>
            <span className="text-right">Ação</span>
          </div>

          {[...icpClusters].sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99)).map((cluster) => {
            const cfg = TYPE_CONFIG[cluster.type] ?? TYPE_CONFIG.anti;
            const industry = cluster.characteristics?.industry as string | undefined;
            return (
              <div
                key={cluster.id}
                className="grid grid-cols-7 gap-2 px-5 py-2.5 items-center border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors"
              >
                <span className="text-sm font-bold text-slate-400">#{cluster.rank ?? "?"}</span>
                <div className="col-span-2 flex items-center gap-2 min-w-0">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">
                      {industry ?? cluster.name}
                    </p>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${cfg.badge}`}>
                      {cfg.label}
                    </span>
                  </div>
                </div>
                <span className="text-sm font-semibold text-slate-700 text-right tabular-nums">{fmtBRL(cluster.avgLtv)}</span>
                <span className="text-sm text-slate-500 text-right tabular-nums">{cluster.leadsInFunnel}</span>
                <span className={`text-sm text-right tabular-nums ${cluster.type === "anti" ? "text-red-600 font-medium" : "text-slate-500"}`}>
                  {cluster.churnRate < 0.0001 ? "—" : `${(cluster.churnRate * 100).toFixed(1)}%`}
                </span>
                <div className="flex items-center justify-end gap-1.5">
                  <span className={`text-xs ${REC_COLORS[cfg.rec] ?? "text-slate-600"}`}>{cfg.rec}</span>
                  <button
                    onClick={() => navigate(industry ? `/obtain/leads?industry=${encodeURIComponent(industry)}` : "/obtain/leads")}
                    className="text-[10px] text-[#10B981] hover:underline ml-1"
                  >
                    →
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Row 4 — Scenario Simulator */}
      <SafeBlock label="Simulador">
        <ScenarioSimulator clusters={icpClusters} />
      </SafeBlock>

      {/* Row 5 — Recommendation card */}
      <div className="bg-gradient-to-r from-[#10B981]/10 to-[#293b83]/5 rounded-xl p-4 border border-[#10B981]/20">
        <div className="flex items-center gap-2 mb-2">
          <svg className="w-4 h-4 text-[#10B981] flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <h4 className="font-semibold text-slate-800 text-sm">Recomendação de Alocação de Budget</h4>
          <span className="ml-auto text-[10px] bg-[#293b83] text-white px-2 py-0.5 rounded-full">Dados do Retain</span>
        </div>
        {idealIcp && antiIcp ? (
          <p className="text-sm text-slate-600">
            {ltvMultiple && ltvMultiple > 1 && (
              <>O ICP Ideal <strong>({idealIcp.name})</strong> tem <strong>{ltvMultiple}× mais LTV</strong> que o Anti-ICP ({fmtBRL(idealIcp.avgLtv)} vs {fmtBRL(antiIcp.avgLtv)}). </>
            )}
            Leads do cluster ideal têm churn de <strong>{idealIcp.churnRate < 0.0001 ? "< 0.1%" : `${(idealIcp.churnRate * 100).toFixed(1)}%`}</strong> vs <strong>{antiIcp.churnRate < 0.0001 ? "< 0.1%" : `${(antiIcp.churnRate * 100).toFixed(1)}%`}</strong> do Anti-ICP.
            {" "}Priorize a prospecção em <strong>{idealIcp.name}</strong> para maximizar retorno.
          </p>
        ) : (
          <p className="text-sm text-slate-600">
            Faça upload de dados de clientes e leads para ver a análise comparativa de ICP vs Anti-ICP.
          </p>
        )}
      </div>
    </div>
  );
}
