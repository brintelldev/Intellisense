import { useState } from "react";
import { useLocation } from "wouter";
import { ICPHeroCard } from "../components/ICPHeroCard";
import { ICPPriorityMatrix } from "../components/ICPPriorityMatrix";
import { ClusterRadarChart } from "../components/ClusterRadarChart";
import { EmptyState } from "../../../shared/components/EmptyState";
import { LoadingState } from "../../../shared/components/LoadingState";
import { useObtainICPClusters } from "../../../shared/hooks/useObtain";

const fmtBRL = (v: number) => v >= 1_000_000 ? `R$${(v / 1_000_000).toFixed(1)}M` : `R$${Math.round(v / 1_000)}K`;

const TYPE_CONFIG: Record<string, { label: string; dot: string; badge: string; rec: string }> = {
  ideal: { label: "ICP Ideal",  dot: "bg-[#10B981]", badge: "bg-[#10B981]/10 text-[#10B981]",  rec: "Escalar" },
  good:  { label: "ICP Bom",   dot: "bg-[#293b83]", badge: "bg-[#293b83]/10 text-[#293b83]",  rec: "Manter" },
  anti:  { label: "Anti-ICP",  dot: "bg-red-400",   badge: "bg-red-100 text-red-600",          rec: "Reduzir" },
};

const REC_COLORS: Record<string, string> = {
  Escalar: "text-emerald-600 font-semibold",
  Manter:  "text-[#293b83] font-semibold",
  Reduzir: "text-red-600 font-semibold",
};

// ── Scenario Simulator ───────────────────────────────────────────────────────
function ScenarioSimulator({ clusters }: { clusters: any[] }) {
  const [concentration, setConcentration] = useState(50);

  const idealClusters = clusters.filter(c => c.type === "ideal");
  const antiClusters = clusters.filter(c => c.type === "anti");

  const totalLeads = clusters.reduce((s, c) => s + c.leadsInFunnel, 0);
  const avgLtvAll = totalLeads > 0
    ? clusters.reduce((s, c) => s + c.avgLtv * c.leadsInFunnel, 0) / totalLeads
    : 0;
  const avgChurnAll = clusters.length > 0
    ? clusters.reduce((s, c) => s + c.churnRate, 0) / clusters.length
    : 0;
  const avgCacAll = clusters.reduce((s, c) => s + c.avgCac, 0) / Math.max(clusters.length, 1);

  const idealAvgLtv = idealClusters.length > 0
    ? idealClusters.reduce((s, c) => s + c.avgLtv, 0) / idealClusters.length
    : avgLtvAll;
  const idealAvgChurn = idealClusters.length > 0
    ? idealClusters.reduce((s, c) => s + c.churnRate, 0) / idealClusters.length
    : avgChurnAll;

  const antiAvgLtv = antiClusters.length > 0
    ? antiClusters.reduce((s, c) => s + c.avgLtv, 0) / antiClusters.length
    : avgLtvAll;

  const t = concentration / 100;

  // With concentration t, LTV shifts from all-avg toward ideal-avg
  const projLtv = avgLtvAll + (idealAvgLtv - avgLtvAll) * t;
  // Churn shifts toward ideal-avg churn
  const projChurn = avgChurnAll + (idealAvgChurn - avgChurnAll) * t;
  // Leads stay similar but more of them are higher quality (+10% at full concentration)
  const projLeads = Math.round(totalLeads * (1 + t * 0.15));
  // CAC reduces as we stop spending on anti-ICP (up to 25% reduction)
  const projCac = avgCacAll * (1 - t * 0.25);
  // Annual revenue estimate
  const projAnnual = projLeads * projLtv;

  const ltvGain = projLtv - avgLtvAll;
  const churnDrop = avgChurnAll - projChurn;

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
          <p className="text-xs text-slate-500">Ajuste a concentração de budget nos perfis ideais e veja o impacto projetado</p>
        </div>
      </div>

      <div className="p-5 grid grid-cols-2 gap-6">
        {/* Left: slider */}
        <div className="space-y-5">
          <div>
            <div className="flex justify-between items-center mb-3">
              <label className="text-sm text-slate-600 font-medium">% do budget nos perfis ICP Ideal</label>
              <span className="text-2xl font-extrabold text-[#10B981]">{concentration}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={concentration}
              onChange={e => setConcentration(Number(e.target.value))}
              className="w-full h-2 rounded-full appearance-none cursor-pointer bg-slate-100"
              style={{ accentColor: "#10B981" }}
            />
            <div className="flex justify-between text-[10px] text-slate-400 mt-1">
              <span>Distribuído</span>
              <span>100% nos ideais</span>
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg space-y-1.5 text-xs text-slate-500">
            <p>Baseline atual: <strong className="text-slate-700">{totalLeads} leads · LTV médio {fmtBRL(avgLtvAll)}</strong></p>
            <p>Melhor perfil: <strong className="text-slate-700">LTV {fmtBRL(idealAvgLtv)} · Churn {(idealAvgChurn * 100).toFixed(1)}%/mês</strong></p>
            <p>Pior perfil: <strong className="text-slate-700">LTV {fmtBRL(antiAvgLtv)}</strong></p>
          </div>
        </div>

        {/* Right: projected metrics */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-emerald-50 rounded-xl p-3 text-center border border-emerald-100">
            <p className="text-xs text-slate-500 mb-1">LTV Projetado</p>
            <p className="text-xl font-extrabold text-emerald-600">{fmtBRL(projLtv)}</p>
            {ltvGain > 0 && (
              <p className="text-[10px] text-emerald-500 mt-0.5">+{fmtBRL(ltvGain)} vs baseline</p>
            )}
          </div>
          <div className="bg-blue-50 rounded-xl p-3 text-center border border-blue-100">
            <p className="text-xs text-slate-500 mb-1">Leads Esperados</p>
            <p className="text-xl font-extrabold text-blue-600">{projLeads}</p>
            {projLeads > totalLeads && (
              <p className="text-[10px] text-blue-500 mt-0.5">+{projLeads - totalLeads} qualificados</p>
            )}
          </div>
          <div className="bg-violet-50 rounded-xl p-3 text-center border border-violet-100">
            <p className="text-xs text-slate-500 mb-1">Churn Projetado</p>
            <p className="text-xl font-extrabold text-violet-600">{(projChurn * 100).toFixed(1)}%</p>
            {churnDrop > 0 && (
              <p className="text-[10px] text-violet-500 mt-0.5">-{(churnDrop * 100).toFixed(1)}% vs baseline</p>
            )}
          </div>
          <div className="bg-amber-50 rounded-xl p-3 text-center border border-amber-100">
            <p className="text-xs text-slate-500 mb-1">CAC Estimado</p>
            <p className="text-xl font-extrabold text-amber-600">{projCac > 0 ? fmtBRL(projCac) : "—"}</p>
            {projCac > 0 && avgCacAll > 0 && (
              <p className="text-[10px] text-amber-500 mt-0.5">
                {Math.round((1 - projCac / avgCacAll) * 100)}% menos
              </p>
            )}
          </div>
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

  // Champion cluster: rank 1
  const champion = [...icpClusters].sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99))[0];

  // Baseline averages for contrast
  const totalLeadsForBaseline = icpClusters.reduce((s, c) => s + (c.leadsInFunnel ?? 0), 0);
  const baseline = {
    avgLtv: totalLeadsForBaseline > 0
      ? icpClusters.reduce((s, c) => s + (c.avgLtv ?? 0) * (c.leadsInFunnel ?? 0), 0) / totalLeadsForBaseline
      : icpClusters.reduce((s, c) => s + (c.avgLtv ?? 0), 0) / Math.max(icpClusters.length, 1),
    churnRate: icpClusters.reduce((s, c) => s + (c.churnRate ?? 0), 0) / Math.max(icpClusters.length, 1),
    avgConversionRate: icpClusters.reduce((s, c) => s + (c.avgConversionRate ?? 0), 0) / Math.max(icpClusters.length, 1),
  };

  const idealIcp = icpClusters.find(c => c.type === "ideal");
  const antiIcp = icpClusters.find(c => c.type === "anti");
  const ltvMultiple = antiIcp && idealIcp && antiIcp.avgLtv > 0
    ? Math.round((idealIcp.avgLtv / antiIcp.avgLtv) * 10) / 10
    : null;

  return (
    <div className="space-y-6 w-full">
      {/* Header */}
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-bold text-slate-900">Perfis de ICP</h1>
        <span className="text-xs font-semibold bg-[#10B981]/10 text-[#10B981] px-2.5 py-1 rounded-full">Obtain Sense</span>
      </div>

      {/* Row 1 — Hero "Seu Perfil Campeão" */}
      {champion && (
        <ICPHeroCard
          cluster={champion}
          baseline={baseline}
        />
      )}

      {/* Row 2 — Priority Matrix + Radar */}
      <div className="grid grid-cols-2 gap-6">
        {/* Bubble chart */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="bg-gradient-to-r from-[#10B981]/5 to-transparent border-b border-slate-100 px-5 py-4 flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#10B981]/10 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-[#10B981]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-800">Mapa Estratégico</h3>
              <p className="text-xs text-slate-500">LTV médio × volume de leads — posicione seu foco de aquisição</p>
            </div>
          </div>
          <div className="px-3 py-2">
            {/* Legend */}
            <div className="flex items-center gap-4 px-2 py-2">
              {Object.entries(TYPE_CONFIG).map(([type, cfg]) => (
                <div key={type} className="flex items-center gap-1.5">
                  <span className={`w-2.5 h-2.5 rounded-full ${cfg.dot}`} />
                  <span className="text-[10px] text-slate-500">{cfg.label}</span>
                </div>
              ))}
            </div>
            <ICPPriorityMatrix clusters={icpClusters} />
          </div>
        </div>

        {/* Radar chart */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="bg-gradient-to-r from-[#10B981]/5 to-transparent border-b border-slate-100 px-5 py-4 flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#10B981]/10 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-[#10B981]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-800">Radar Comparativo</h3>
              <p className="text-xs text-slate-500">Pontuação relativa em cada dimensão de qualidade</p>
            </div>
          </div>
          <div className="p-5">
            <ClusterRadarChart clusters={icpClusters} />
          </div>
        </div>
      </div>

      {/* Row 3 — Ranking table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="bg-gradient-to-r from-[#10B981]/5 to-transparent border-b border-slate-100 px-5 py-4 flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#10B981]/10 flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-[#10B981]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Ranking Completo de Perfis</h3>
            <p className="text-xs text-slate-500">Todos os clusters rankeados por composite score — da maior para menor prioridade</p>
          </div>
        </div>

        <div className="divide-y divide-slate-50">
          {/* Table header */}
          <div className="grid grid-cols-8 gap-2 px-5 py-2 bg-slate-50 text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
            <span>#</span>
            <span className="col-span-2">Perfil</span>
            <span className="text-right">LTV Médio</span>
            <span className="text-right">Leads</span>
            <span className="text-right">Conversão</span>
            <span className="text-right">Churn</span>
            <span className="text-right">Ação</span>
          </div>

          {[...icpClusters].sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99)).map((cluster) => {
            const cfg = TYPE_CONFIG[cluster.type] ?? TYPE_CONFIG.anti;
            const industry = cluster.characteristics?.industry as string | undefined;
            return (
              <div
                key={cluster.id}
                className="grid grid-cols-8 gap-2 px-5 py-3 items-center hover:bg-slate-50/70 transition-colors"
              >
                <span className="text-sm font-bold text-slate-400">#{cluster.rank ?? "?"}</span>
                <div className="col-span-2 flex items-center gap-2 min-w-0">
                  <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">
                      {(cluster.characteristics?.industry as string | undefined) ?? cluster.name}
                    </p>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${cfg.badge}`}>
                      {cfg.label}
                    </span>
                  </div>
                </div>
                <span className="text-sm font-semibold text-slate-700 text-right">{fmtBRL(cluster.avgLtv)}</span>
                <span className="text-sm text-slate-600 text-right">{cluster.leadsInFunnel}</span>
                <span className="text-sm text-slate-600 text-right">{(cluster.avgConversionRate * 100).toFixed(0)}%</span>
                <span className={`text-sm text-right ${cluster.type === "anti" ? "text-red-600 font-medium" : "text-slate-600"}`}>
                  {(cluster.churnRate * 100).toFixed(1)}%
                </span>
                <div className="flex items-center justify-end gap-1.5">
                  <span className={`text-xs ${REC_COLORS[cfg.rec] ?? "text-slate-600"}`}>{cfg.rec}</span>
                  <button
                    onClick={() => navigate(industry ? `/obtain/leads?industry=${encodeURIComponent(industry)}` : "/obtain/leads")}
                    className="text-[10px] text-[#10B981] hover:underline whitespace-nowrap"
                  >
                    Ver →
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Row 4 — Scenario Simulator */}
      {icpClusters.length >= 2 && (
        <ScenarioSimulator clusters={icpClusters} />
      )}

      {/* Row 5 — Recommendation card */}
      <div className="bg-gradient-to-r from-[#10B981]/10 to-[#293b83]/5 rounded-xl p-5 border border-[#10B981]/20">
        <div className="flex items-center gap-2 mb-2">
          <svg className="w-5 h-5 text-[#10B981]" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <h4 className="font-semibold text-slate-800">Recomendação de Alocação de Budget</h4>
          <span className="ml-auto text-xs bg-[#293b83] text-white px-2 py-0.5 rounded-full">Dados do Retain Sense</span>
        </div>
        {idealIcp && antiIcp ? (
          <p className="text-sm text-slate-600">
            {ltvMultiple && ltvMultiple > 1 && (
              <>O ICP Ideal <strong>({idealIcp.name})</strong> tem <strong>{ltvMultiple}× mais LTV</strong> que o Anti-ICP ({fmtBRL(idealIcp.avgLtv)} vs {fmtBRL(antiIcp.avgLtv)}). </>
            )}
            Leads do cluster ideal têm churn de apenas <strong>{(idealIcp.churnRate * 100).toFixed(0)}%</strong> vs <strong>{(antiIcp.churnRate * 100).toFixed(0)}%</strong> do Anti-ICP.
            {" "}Priorize a prospecção no perfil <strong>{idealIcp.name}</strong> para maximizar retorno.
          </p>
        ) : (
          <p className="text-sm text-slate-600">
            Faça upload de dados de clientes e leads para ver análise comparativa de ICP vs Anti-ICP.
          </p>
        )}
      </div>
    </div>
  );
}
