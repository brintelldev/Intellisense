import { useLocation } from "wouter";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  BarChart, Bar, ResponsiveContainer,
} from "recharts";
import { useRetainDashboard, useRetainExpansionOpportunities, useRetainAnalyticsHistory } from "../../shared/hooks/useRetain";
import { useObtainDashboard, useLeadQualityTrend, useLifecycleSourceLtv, useChannelChurnComparison } from "../../shared/hooks/useObtain";
import { ExecutiveSummary } from "../components/ExecutiveSummary";
import { LoadingState } from "../../shared/components/LoadingState";
import { EmptyState } from "../../shared/components/EmptyState";
import { fmtBRLShort as fmtBRL } from "../../shared/lib/format";

export default function LifecyclePage() {
  const [, navigate] = useLocation();

  const { data: retainDashData, isLoading: loadingRetain } = useRetainDashboard();
  const { data: obtainDashData, isLoading: loadingObtain } = useObtainDashboard();
  const { data: qualityTrend } = useLeadQualityTrend();
  const { data: sourceLtv } = useLifecycleSourceLtv();
  const { data: expansionData } = useRetainExpansionOpportunities();
  const { data: analyticsHistory } = useRetainAnalyticsHistory();
  const { data: channelChurn } = useChannelChurnComparison();

  const dashboardKPIs = retainDashData?.kpis;
  const obtainDashboardKPIs = obtainDashData?.kpis;

  if (loadingRetain || loadingObtain) return <LoadingState rows={8} />;

  if (!dashboardKPIs && !obtainDashboardKPIs) {
    return (
      <div className="space-y-6 w-full">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Ciclo de Vida do Cliente</h1>
          <p className="text-sm text-slate-500 mt-1">Visão integrada de aquisição e retenção</p>
        </div>
        <EmptyState
          title="Sem dados ainda"
          description="Faça o primeiro upload de clientes (Retain) ou leads (Obtain) para ver o ciclo de vida integrado."
        />
      </div>
    );
  }

  // ── NRR trend computation from analytics history ──────────────────────────
  const nrrPoints = (analyticsHistory ?? []).filter(p => p.nrr !== null);
  const latestNrr = nrrPoints[nrrPoints.length - 1]?.nrr ?? null;
  // Compare against the minimum NRR (the "trough") to show recovery story
  const minNrr = nrrPoints.length > 0 ? Math.min(...nrrPoints.map(p => p.nrr!)) : null;
  const troughPoint = nrrPoints.find(p => p.nrr === minNrr);
  const nrrImproved = latestNrr !== null && minNrr !== null && latestNrr > minNrr;
  const nrrDelta = latestNrr !== null && minNrr !== null
    ? Math.round((latestNrr - minNrr) * 10) / 10
    : null;

  // ── Expansion summary ─────────────────────────────────────────────────────
  const totalPotential = expansionData?.totalAnnualPotential ?? 0;
  const topOpps = expansionData?.opportunities?.slice(0, 3) ?? [];

  return (
    <div className="space-y-6 w-full">
      <ExecutiveSummary />

      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Ciclo de Vida do Cliente</h1>
        <p className="text-sm text-slate-500 mt-1">Visão integrada de aquisição e retenção</p>
      </div>

      {/* 3 KPI blocks */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Obtain block */}
        <div className="bg-white rounded-xl p-5 shadow-sm border-t-4 border-[#10B981]">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs font-semibold bg-[#10B981]/10 text-[#10B981] px-2.5 py-1 rounded-full">Obtain Sense</span>
            <span className="text-sm font-semibold text-slate-700">Aquisição</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-xs text-slate-500">Leads no Funil</p>
              <p className="text-xl font-bold text-slate-900">{obtainDashboardKPIs?.totalLeads ?? 0}</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-xs text-slate-500">Leads Hot</p>
              <p className="text-xl font-bold text-[#10B981]">{obtainDashboardKPIs?.hotLeads ?? 0}</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-xs text-slate-500">CAC Médio</p>
              <p className="text-xl font-bold text-slate-900">{fmtBRL(obtainDashboardKPIs?.cac ?? 0)}</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-xs text-slate-500">Tx. Conversão</p>
              <p className="text-xl font-bold text-slate-900">{((obtainDashboardKPIs?.conversionRate ?? 0) * 100).toFixed(0)}%</p>
            </div>
          </div>
          <button
            onClick={() => navigate("/obtain")}
            className="mt-4 w-full text-sm text-[#10B981] hover:text-[#059669] font-medium flex items-center justify-center gap-1"
          >
            Ver dashboard completo →
          </button>
        </div>

        {/* Transition block */}
        <div className="bg-gradient-to-br from-[#293b83] to-[#67b4b0] rounded-xl p-6 py-8 text-white flex flex-col items-center justify-center text-center min-h-[200px]">
          <div className="text-4xl md:text-5xl font-bold tabular-nums">{obtainDashboardKPIs?.totalLeads ?? 0}</div>
          <p className="text-sm mt-2 text-white/90">leads no funil de aquisição</p>
          <div className="flex items-center gap-2 mt-4">
            <span className="text-xs bg-white/20 px-2 py-1 rounded">LTV médio previsto</span>
          </div>
          <div className="text-lg font-semibold mt-1">{fmtBRL(obtainDashboardKPIs?.avgLtv ?? 0)}</div>
          <div className="flex items-center gap-2 mt-4 text-white/80">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
            <span className="text-xs">Obtain → Retain</span>
          </div>
        </div>

        {/* Retain block */}
        <div className="bg-white rounded-xl p-5 shadow-sm border-t-4 border-[#293b83]">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs font-semibold bg-[#293b83]/10 text-[#293b83] px-2.5 py-1 rounded-full">Retain Sense</span>
            <span className="text-sm font-semibold text-slate-700">Retenção</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-xs text-slate-500">Clientes Ativos</p>
              <p className="text-xl font-bold text-slate-900">{dashboardKPIs?.totalCustomers ?? 0}</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-xs text-slate-500">Em Risco</p>
              <p className="text-xl font-bold text-red-500">{(dashboardKPIs?.riskDistribution?.high ?? 0) + (dashboardKPIs?.riskDistribution?.critical ?? 0)}</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-xs text-slate-500">Churn Rate</p>
              <p className="text-xl font-bold text-slate-900">{dashboardKPIs?.churnRate ?? 0}%</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-xs text-slate-500">Receita em Risco</p>
              <p className="text-xl font-bold text-orange-500">{fmtBRL(dashboardKPIs?.revenueAtRisk ?? 0)}</p>
            </div>
          </div>
          <button
            onClick={() => navigate("/retain")}
            className="mt-4 w-full text-sm text-[#293b83] hover:text-[#1e2d6b] font-medium flex items-center justify-center gap-1"
          >
            Ver dashboard completo →
          </button>
        </div>
      </div>

      {/* 3-card insight stack */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* Card 1: Feedback Loop (green) */}
        <div className="bg-[#f0fdf4] rounded-xl p-5 border-l-4 border-[#10B981]">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 bg-[#10B981]/15 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-3.5 h-3.5 text-[#10B981]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
            <span className="text-xs font-semibold text-[#10B981]">Retroalimentação Retain → Obtain</span>
          </div>
          {channelChurn?.insight ? (
            <p className="text-sm text-slate-700">{channelChurn.insight}</p>
          ) : (
            <p className="text-sm text-slate-700">
              Adquira dados de leads e clientes para ver a comparação de churn por canal.
            </p>
          )}
          {channelChurn?.bestSource && (
            <p className="text-xs text-slate-500 mt-2">
              Recomendação: priorize o canal <strong>{channelChurn.bestSource.sourceLabel}</strong> para menor churn.
            </p>
          )}
        </div>

        {/* Card 2: Expansion Opportunities (blue) */}
        <div className="bg-blue-50 rounded-xl p-5 border-l-4 border-[#293b83]">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 bg-[#293b83]/10 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-3.5 h-3.5 text-[#293b83]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <span className="text-xs font-semibold text-[#293b83]">Oportunidades de Expansão</span>
          </div>
          {totalPotential > 0 ? (
            <>
              <p className="text-sm text-slate-700">
                <strong className="text-[#293b83]">{expansionData?.totalCount ?? 0} clientes saudáveis</strong> abaixo da mediana do segmento.
              </p>
              <p className="text-lg font-bold text-[#293b83] mt-1">{fmtBRL(totalPotential)}<span className="text-xs font-normal text-slate-500">/ano potencial</span></p>
              <div className="mt-2 space-y-1">
                {topOpps.map(o => (
                  <div key={o.id} className="flex justify-between text-xs text-slate-600">
                    <span className="truncate max-w-[140px]">{o.name}</span>
                    <span className="text-[#293b83] font-medium">+{fmtBRL(o.gap)}/mês</span>
                  </div>
                ))}
              </div>
              <button
                onClick={() => navigate("/retain/customers")}
                className="mt-3 text-xs text-[#293b83] font-medium hover:underline"
              >
                Ver todos →
              </button>
            </>
          ) : (
            <p className="text-sm text-slate-500">Nenhuma oportunidade identificada. Faça upload de clientes primeiro.</p>
          )}
        </div>

        {/* Card 3: NRR Trend (purple) */}
        <div className="bg-purple-50 rounded-xl p-5 border-l-4 border-purple-500">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-3.5 h-3.5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <span className="text-xs font-semibold text-purple-700">Tendência de NRR</span>
          </div>
          {latestNrr !== null ? (
            <>
              <div className="flex items-baseline gap-2 mt-1">
                <span className={`text-2xl font-bold ${latestNrr >= 100 ? "text-purple-700" : "text-slate-700"}`}>{latestNrr}%</span>
                {nrrDelta !== null && nrrImproved && (
                  <span className="text-xs font-medium text-green-600">
                    +{nrrDelta}pp vs. mínimo ({minNrr}% em {troughPoint?.month})
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {latestNrr !== null && latestNrr >= 100
                  ? "Expansão líquida: cada real investido em CS rende mais do que entra."
                  : "Oportunidade: foco em expansão e redução de churn."}
              </p>
              {/* Mini sparkline of NRR points */}
              {nrrPoints.length >= 3 && (
                <div className="mt-2 h-10">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={nrrPoints} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
                      <defs>
                        <linearGradient id="nrrGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#7c3aed" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <Area type="monotone" dataKey="nrr" stroke="#7c3aed" fill="url(#nrrGrad)" strokeWidth={1.5} dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
              <button
                onClick={() => navigate("/retain/revenue")}
                className="mt-2 text-xs text-purple-700 font-medium hover:underline"
              >
                Ver Revenue Analytics →
              </button>
            </>
          ) : (
            <p className="text-sm text-slate-500">Aguardando dados históricos para calcular NRR.</p>
          )}
        </div>

      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Quality trend chart */}
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
          <h3 className="font-semibold text-slate-800 mb-1">Qualidade da Aquisição ao Longo do Tempo</h3>
          <p className="text-xs text-slate-400 mb-4">Distribuição de leads por tier de score (mensal)</p>
          {qualityTrend && qualityTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={qualityTrend}>
                <defs>
                  <linearGradient id="hotGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Area type="monotone" dataKey="hot" name="Hot" stroke="#10B981" fill="url(#hotGrad)" strokeWidth={2} />
                <Area type="monotone" dataKey="warm" name="Warm" stroke="#f59e0b" fill="none" strokeWidth={2} strokeDasharray="4 4" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center">
              <p className="text-sm text-slate-400">Faça upload de leads (Obtain Sense) para ver o histórico de qualidade.</p>
            </div>
          )}
        </div>

        {/* Source LTV chart */}
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
          <h3 className="font-semibold text-slate-800 mb-1">Origem dos Melhores Clientes (LTV Médio)</h3>
          <p className="text-xs text-slate-400 mb-4">Canais de aquisição ordenados por LTV médio previsto</p>
          {sourceLtv && sourceLtv.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={sourceLtv} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v: number) => v >= 1_000_000 ? `R$${(v/1_000_000).toFixed(1)}M` : `R$${Math.round(v/1000)}K`} />
                <YAxis dataKey="source" type="category" tick={{ fontSize: 10 }} width={80} />
                <Tooltip formatter={(v: number) => [v >= 1_000_000 ? `R$ ${(v/1_000_000).toFixed(2)}M` : `R$ ${Math.round(v/1000)}K`, "LTV Médio"]} />
                <Bar dataKey="ltv" fill="#293b83" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center">
              <p className="text-sm text-slate-400">Faça upload de leads (Obtain Sense) para ver o LTV por canal.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
