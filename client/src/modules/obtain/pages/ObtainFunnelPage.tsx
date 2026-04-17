import { useLocation } from "wouter";
import { FunnelChart } from "../../../shared/components/FunnelChart";
import { EmptyState } from "../../../shared/components/EmptyState";
import { LoadingState } from "../../../shared/components/LoadingState";
import { useObtainFunnel } from "../../../shared/hooks/useObtain";
import { fmtBRLShort as fmtBRL } from "../../../shared/lib/format";

const SOURCE_LABELS: Record<string, string> = {
  referral: "Indicação",
  event: "Evento",
  paid_social: "LinkedIn Ads",
  paid_search: "Google Ads",
  outbound: "Outbound",
  organic: "Orgânico",
  email: "Email",
  csv: "CSV",
  manual: "Manual",
  other: "Outros",
};

// ── Heatmap source × stage ────────────────────────────────────────────────────
function SourceStageHeatmap({
  matrix,
}: {
  matrix: { rows: string[]; cols: string[]; cells: number[][] };
}) {
  if (matrix.rows.length === 0 || matrix.cols.length === 0) return null;

  const STAGE_LABELS: Record<string, string> = {
    new: "Prospecção", qualifying: "Qualific.", contacted: "Demo",
    proposal: "Proposta", won: "Fechado",
  };

  const maxVal = Math.max(...matrix.cells.flat(), 1);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr>
            <th className="text-left text-slate-400 font-medium py-1.5 pr-3 whitespace-nowrap">Canal</th>
            {matrix.cols.map(col => (
              <th key={col} className="text-center text-slate-400 font-medium py-1.5 px-2 whitespace-nowrap">
                {STAGE_LABELS[col] ?? col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.rows.map((src, ri) => (
            <tr key={src} className="border-t border-slate-50">
              <td className="text-slate-600 font-medium py-1.5 pr-3 whitespace-nowrap">
                {SOURCE_LABELS[src] ?? src}
              </td>
              {matrix.cells[ri].map((val, ci) => {
                const intensity = val / maxVal;
                const bg = val === 0
                  ? "bg-slate-50"
                  : intensity > 0.7 ? "bg-[#10B981]/30 text-emerald-800"
                  : intensity > 0.3 ? "bg-[#10B981]/15 text-emerald-700"
                  : "bg-[#10B981]/5 text-emerald-600";
                return (
                  <td key={ci} className={`text-center py-1.5 px-2 rounded font-semibold ${bg}`}>
                    {val > 0 ? val : "—"}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ObtainFunnelPage() {
  const { data: funnelData, isLoading } = useObtainFunnel();
  const [, navigate] = useLocation();

  if (isLoading) return <LoadingState rows={6} />;

  const stages = funnelData?.stages ?? [];

  if (stages.length === 0) {
    return (
      <EmptyState
        title="Nenhum dado de funil encontrado"
        description="Importe dados de leads para visualizar o funil de vendas."
        action={{ label: "Importar dados", onClick: () => navigate("/obtain/upload") }}
      />
    );
  }

  const bottleneck  = funnelData?.biggestBottleneck ?? null;
  const pareto      = funnelData?.paretoLeads;
  const feedback    = funnelData?.postWonRetainFeedback;
  const matrix      = funnelData?.sourceStageMatrix;

  const totalRevenue  = stages.reduce((a, s) => a + s.revenueAtRisk, 0);
  const totalHotStuck = stages.reduce((a, s) => a + (s.hotLeadsStuck ?? 0), 0);
  const convRate      = stages.length > 0 && stages[0].leadsCount > 0
    ? ((stages[stages.length - 1].leadsCount / stages[0].leadsCount) * 100).toFixed(1)
    : "0";

  return (
    <div className="space-y-5 w-full">
      {/* Header */}
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-bold text-slate-900">Funil & Gargalos</h1>
        <span className="text-xs font-semibold bg-[#10B981]/10 text-[#10B981] px-2.5 py-1 rounded-full">
          Obtain Sense
        </span>
      </div>

      {/* Row 1 — Hero "Maior Gargalo" */}
      {bottleneck && (
        <div className="bg-white rounded-xl shadow-sm border border-red-100 overflow-hidden">
          <div className="bg-gradient-to-r from-red-50 to-transparent border-b border-red-100 px-5 py-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <span className="text-[10px] font-bold bg-red-500 text-white px-2 py-0.5 rounded-full uppercase tracking-wide">
                Maior Gargalo
              </span>
              <h2 className="text-sm font-bold text-slate-900 mt-0.5">
                Estágio: <span className="text-red-600">{bottleneck.stageName}</span>
                {bottleneck.source && (
                  <> · Canal: <span className="text-red-600">{SOURCE_LABELS[bottleneck.source] ?? bottleneck.source}</span></>
                )}
              </h2>
            </div>
          </div>
          <div className="px-5 py-3 flex items-center justify-between gap-4">
            <p className="text-sm text-slate-600 leading-relaxed flex-1">{bottleneck.rationale}</p>
            <button
              onClick={() => {
                const params = new URLSearchParams({ status: bottleneck.stage });
                if (bottleneck.source) params.set("source", bottleneck.source);
                navigate(`/obtain/leads?${params}`);
              }}
              className="flex-shrink-0 h-8 px-4 bg-red-500 text-white text-xs font-semibold rounded-lg hover:bg-red-600 transition-colors"
            >
              Ver leads parados →
            </button>
          </div>
        </div>
      )}

      {/* KPI strip */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
          <p className="text-xs text-slate-500">Receita Total no Funil</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{fmtBRL(totalRevenue)}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
          <p className="text-xs text-slate-500">Leads Hot Travados</p>
          <p className={`text-2xl font-bold mt-1 ${totalHotStuck > 0 ? "text-red-500" : "text-slate-400"}`}>
            {totalHotStuck > 0 ? totalHotStuck : "—"}
          </p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
          <p className="text-xs text-slate-500">Taxa de Conversão Geral</p>
          <p className="text-2xl font-bold text-[#10B981] mt-1">{convRate}%</p>
        </div>
      </div>

      {/* Row 2 — Funnel + Heatmap */}
      <div className="grid grid-cols-2 gap-5 items-stretch">
        {/* Funnel visual */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden flex flex-col">
          <div className="bg-gradient-to-r from-[#10B981]/5 to-transparent border-b border-slate-100 px-5 py-3 flex items-center gap-2 flex-shrink-0">
            <div className="w-7 h-7 rounded-lg bg-[#10B981]/10 flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-[#10B981]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-800">Funil Completo</h3>
              <p className="text-xs text-slate-500">Hover nos estágios para ver P50/P75/P95</p>
            </div>
          </div>
          <div className="p-5 flex-1">
            <FunnelChart stages={stages} />
          </div>
        </div>

        {/* Source × stage heatmap */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden flex flex-col">
          <div className="bg-gradient-to-r from-[#10B981]/5 to-transparent border-b border-slate-100 px-5 py-3 flex items-center gap-2 flex-shrink-0">
            <div className="w-7 h-7 rounded-lg bg-[#10B981]/10 flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-[#10B981]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-800">Canal × Estágio</h3>
              <p className="text-xs text-slate-500">Distribuição de leads por canal em cada etapa</p>
            </div>
          </div>
          <div className="p-4 flex-1">
            {matrix && <SourceStageHeatmap matrix={matrix} />}
          </div>
        </div>
      </div>

      {/* Row 3 — Stage metrics table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="bg-gradient-to-r from-[#10B981]/5 to-transparent border-b border-slate-100 px-5 py-3 flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#10B981]/10 flex items-center justify-center flex-shrink-0">
            <svg className="w-3.5 h-3.5 text-[#10B981]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Métricas por Etapa</h3>
            <p className="text-xs text-slate-500">P50/P75 de tempo, drop-off e LTV em risco</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50">
                <th className="text-left text-xs font-semibold text-slate-500 px-4 py-2.5">Etapa</th>
                <th className="text-right text-xs font-semibold text-slate-500 px-4 py-2.5">Leads</th>
                <th className="text-right text-xs font-semibold text-slate-500 px-4 py-2.5">Hot Travados</th>
                <th className="text-right text-xs font-semibold text-slate-500 px-4 py-2.5">P50 / P75</th>
                <th className="text-right text-xs font-semibold text-slate-500 px-4 py-2.5">Drop-off</th>
                <th className="text-right text-xs font-semibold text-slate-500 px-4 py-2.5">LTV em Risco</th>
                <th className="text-right text-xs font-semibold text-slate-500 px-4 py-2.5">Ação</th>
              </tr>
            </thead>
            <tbody>
              {stages.map(stage => (
                <tr
                  key={stage.id}
                  className={`border-t border-slate-50 ${stage.isBottleneck ? "bg-red-50/60" : ""}`}
                >
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-800">{stage.name}</span>
                      {stage.isBottleneck && (
                        <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">Gargalo</span>
                      )}
                      {stage.isStuck && !stage.isBottleneck && (
                        <span className="text-xs bg-amber-100 text-amber-600 px-2 py-0.5 rounded-full font-medium">Lento</span>
                      )}
                    </div>
                  </td>
                  <td className="text-right px-4 py-2.5 text-sm font-medium text-slate-800">{stage.leadsCount}</td>
                  <td className="text-right px-4 py-2.5">
                    <span className={`text-sm font-medium ${(stage.hotLeadsStuck ?? 0) > 0 ? "text-red-600" : "text-slate-400"}`}>
                      {(stage.hotLeadsStuck ?? 0) > 0 ? stage.hotLeadsStuck : "—"}
                    </span>
                  </td>
                  <td className="text-right px-4 py-2.5 text-sm text-slate-600">
                    {stage.timeP50 ? (
                      <span title={`P95: ${stage.timeP95}d`}>
                        {stage.timeP50}d / {stage.timeP75}d
                      </span>
                    ) : stage.avgTimeDays > 0 ? `${stage.avgTimeDays}d` : "—"}
                  </td>
                  <td className="text-right px-4 py-2.5">
                    <span className={`text-sm ${stage.dropOffRate > 0.5 ? "text-red-600 font-semibold" : "text-slate-600"}`}>
                      {stage.dropOffRate > 0 ? `${(stage.dropOffRate * 100).toFixed(0)}%` : "—"}
                    </span>
                  </td>
                  <td className="text-right px-4 py-2.5 text-sm font-medium text-slate-800">
                    {stage.revenueAtRisk > 0 ? fmtBRL(stage.revenueAtRisk) : "—"}
                  </td>
                  <td className="text-right px-4 py-2.5">
                    <button
                      onClick={() => navigate(`/obtain/leads?status=${stage.id}`)}
                      className="text-xs text-[#10B981] hover:underline"
                    >
                      Ver →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Row 4 — Pareto de leads travados */}
      {pareto && pareto.top.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="bg-gradient-to-r from-amber-50 to-transparent border-b border-amber-100/50 px-5 py-3 flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
              <svg className="w-3.5 h-3.5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-slate-800">Prioridade Pareto — Leads com Maior LTV em Risco</h3>
              <p className="text-xs text-slate-500">
                Top {pareto.top.length} leads concentram a maior parte do LTV em risco
                {pareto.others.count > 0 && ` · +${pareto.others.count} outros (${fmtBRL(pareto.others.sumLtv)})`}
              </p>
            </div>
          </div>
          <div className="p-4 flex flex-wrap gap-2">
            {pareto.top.map(lead => (
              <button
                key={lead.id}
                onClick={() => navigate(`/obtain/leads`)}
                className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 hover:bg-amber-100 transition-colors"
                title={`LTV: ${fmtBRL(lead.ltvPrediction ?? 0)} · ${lead.daysInStage}d no estágio`}
              >
                <span className="text-xs font-semibold text-slate-800">{lead.name}</span>
                {lead.company && <span className="text-[10px] text-slate-500">{lead.company}</span>}
                <span className="text-[10px] font-bold text-amber-700">{fmtBRL(lead.ltvPrediction ?? 0)}</span>
                <span className="text-[9px] text-slate-400">{lead.daysInStage}d</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Row 5 — Bridge Retain "E depois do Won?" */}
      {feedback && feedback.wonLeadsMatched > 0 && (
        <div className="bg-gradient-to-r from-[#293b83]/8 to-transparent rounded-xl px-5 py-3.5 border border-[#293b83]/20 flex items-start gap-3">
          <svg className="w-4 h-4 text-[#293b83] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-semibold text-slate-800">E depois do Won?</span>
              <span className="text-[10px] bg-[#293b83] text-white px-2 py-0.5 rounded-full">Dados do Retain</span>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">
              Dos <strong>{feedback.wonLeadsMatched}</strong> leads convertidos rastreáveis,{" "}
              <strong className="text-[#10B981]">{feedback.becameHealthy} viraram clientes saudáveis</strong>,{" "}
              <strong className="text-amber-600">{feedback.becameAtRisk} estão em risco</strong>{" "}
              e{" "}
              <strong className="text-red-600">{feedback.churnedAfterWon} fizeram churn</strong>.
              {feedback.topChurningSegment && (
                <> Segmento com mais churn pós-venda: <strong>{feedback.topChurningSegment}</strong>. Revise a qualificação de leads deste perfil.</>
              )}
            </p>
          </div>
          {feedback.topChurningSegment && (
            <button
              onClick={() => navigate(`/retain/customers?segment=${encodeURIComponent(feedback.topChurningSegment!)}`)}
              className="flex-shrink-0 h-8 px-3 bg-[#293b83] text-white text-xs font-semibold rounded-lg hover:bg-[#1e2d6a] transition-colors"
            >
              Ver clientes →
            </button>
          )}
        </div>
      )}
    </div>
  );
}
