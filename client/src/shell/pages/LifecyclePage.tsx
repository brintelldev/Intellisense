import { useLocation } from "wouter";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  BarChart, Bar, ResponsiveContainer,
} from "recharts";

import { useRetainDashboard, useRetainExpansionOpportunities, useRetainAnalyticsHistory } from "../../shared/hooks/useRetain";
import { useObtainDashboard, useLifecycleSourceLtv } from "../../shared/hooks/useObtain";
import { ExecutiveSummary } from "../components/ExecutiveSummary";
import { LoadingState } from "../../shared/components/LoadingState";
import { EmptyState } from "../../shared/components/EmptyState";
import { fmtBRLShort as fmtBRL } from "../../shared/lib/format";

export default function LifecyclePage() {
  const [, navigate] = useLocation();

  const { data: retainDashData, isLoading: loadingRetain } = useRetainDashboard();
  const { data: obtainDashData, isLoading: loadingObtain } = useObtainDashboard();
  const { data: sourceLtv } = useLifecycleSourceLtv();
  const { data: expansionData } = useRetainExpansionOpportunities();
  const { data: analyticsHistory } = useRetainAnalyticsHistory();

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
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Ciclo de Vida do Cliente</h1>
        <p className="text-sm text-slate-500 mt-1">Visão integrada de aquisição e retenção</p>
      </div>

      {/* ── KPI blocks: Aquisição + Retenção ─────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Obtain block */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
            <span className="text-xs font-semibold bg-[#10B981]/10 text-[#10B981] px-2.5 py-1 rounded-full">Obtain Sense</span>
            <span className="text-sm font-semibold text-slate-700">Aquisição</span>
          </div>
          <div className="grid grid-cols-4 divide-x divide-slate-100">
            <div className="p-4">
              <p className="text-xs text-slate-500 mb-1">Leads no Funil</p>
              <p className="text-2xl font-bold text-slate-900">{obtainDashboardKPIs?.totalLeads ?? 0}</p>
            </div>
            <div className="p-4">
              <p className="text-xs text-slate-500 mb-1">Leads Hot</p>
              <p className="text-2xl font-bold text-[#10B981]">{obtainDashboardKPIs?.hotLeads ?? 0}</p>
            </div>
            <div className="p-4">
              <p className="text-xs text-slate-500 mb-1">CAC Médio</p>
              <p className="text-2xl font-bold text-slate-900">{fmtBRL(obtainDashboardKPIs?.cac ?? 0)}</p>
            </div>
            <div className="p-4">
              <p className="text-xs text-slate-500 mb-1">Tx. Conversão</p>
              <p className="text-2xl font-bold text-slate-900">{((obtainDashboardKPIs?.conversionRate ?? 0) * 100).toFixed(0)}%</p>
            </div>
          </div>
          <div className="px-5 py-3 border-t border-slate-50">
            <button
              onClick={() => navigate("/obtain")}
              className="text-sm text-[#10B981] hover:text-[#059669] font-medium"
            >
              Ver dashboard completo →
            </button>
          </div>
        </div>

        {/* Retain block */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
            <span className="text-xs font-semibold bg-[#293b83]/10 text-[#293b83] px-2.5 py-1 rounded-full">Retain Sense</span>
            <span className="text-sm font-semibold text-slate-700">Retenção</span>
          </div>
          <div className="grid grid-cols-4 divide-x divide-slate-100">
            <div className="p-4">
              <p className="text-xs text-slate-500 mb-1">Clientes Ativos</p>
              <p className="text-2xl font-bold text-slate-900">{dashboardKPIs?.totalCustomers ?? 0}</p>
            </div>
            <div className="p-4">
              <p className="text-xs text-slate-500 mb-1">Em Risco</p>
              <p className="text-2xl font-bold text-red-500">{(dashboardKPIs?.riskDistribution?.high ?? 0) + (dashboardKPIs?.riskDistribution?.critical ?? 0)}</p>
            </div>
            <div className="p-4">
              <p className="text-xs text-slate-500 mb-1">Churn Rate</p>
              <p className="text-2xl font-bold text-slate-900">{dashboardKPIs?.churnRate ?? 0}%</p>
            </div>
            <div className="p-4">
              <p className="text-xs text-slate-500 mb-1">Receita em Risco</p>
              <p className="text-2xl font-bold text-orange-500">{fmtBRL(dashboardKPIs?.revenueAtRisk ?? 0)}</p>
            </div>
          </div>
          <div className="px-5 py-3 border-t border-slate-50">
            <button
              onClick={() => navigate("/retain")}
              className="text-sm text-[#293b83] hover:text-[#1e2d6b] font-medium"
            >
              Ver dashboard completo →
            </button>
          </div>
        </div>
      </div>

      {/* ── Insight cards + Source LTV chart ─────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* Card: Expansion Opportunities */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
            <div className="w-7 h-7 bg-[#293b83]/10 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-3.5 h-3.5 text-[#293b83]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <span className="text-sm font-semibold text-slate-800">Oportunidades de Expansão</span>
          </div>
          <div className="p-5">
            {totalPotential > 0 ? (
              <>
                <p className="text-xs text-slate-500 mb-1">{expansionData?.totalCount ?? 0} clientes saudáveis abaixo da mediana do segmento</p>
                <p className="text-2xl font-bold text-[#293b83]">
                  {fmtBRL(totalPotential)}
                  <span className="text-xs font-normal text-slate-400 ml-1">/ano potencial</span>
                </p>
                <div className="mt-3 space-y-2">
                  {topOpps.map(o => (
                    <div key={o.id} className="flex justify-between items-center text-xs">
                      <span className="text-slate-600 truncate max-w-[150px]">{o.name}</span>
                      <span className="text-[#293b83] font-semibold flex-shrink-0 ml-2">+{fmtBRL(o.gap)}/mês</span>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => navigate("/retain/customers")}
                  className="mt-4 text-xs text-[#293b83] font-medium hover:underline"
                >
                  Ver todos →
                </button>
              </>
            ) : (
              <p className="text-sm text-slate-400">Nenhuma oportunidade identificada ainda.</p>
            )}
          </div>
        </div>

        {/* Card: NRR Trend */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
            <div className="w-7 h-7 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-3.5 h-3.5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <span className="text-sm font-semibold text-slate-800">Tendência de NRR</span>
          </div>
          <div className="p-5">
            {latestNrr !== null ? (
              <>
                <div className="flex items-baseline gap-2">
                  <span className={`text-3xl font-bold ${latestNrr >= 100 ? "text-purple-600" : "text-slate-800"}`}>{latestNrr}%</span>
                  {nrrDelta !== null && nrrImproved && (
                    <span className="text-xs font-medium text-green-600">+{nrrDelta}pp vs. mín.</span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {latestNrr >= 100
                    ? "Expansão líquida — cada real em CS rende mais do que entra."
                    : "Oportunidade: foco em expansão e redução de churn."}
                </p>
                {nrrPoints.length >= 3 && (
                  <div className="mt-3 h-12">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={nrrPoints} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
                        <defs>
                          <linearGradient id="nrrGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.25}/>
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
                  className="mt-3 text-xs text-purple-600 font-medium hover:underline"
                >
                  Ver Revenue Analytics →
                </button>
              </>
            ) : (
              <p className="text-sm text-slate-400">Aguardando dados históricos para calcular NRR.</p>
            )}
          </div>
        </div>

        {/* Source LTV chart */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-[#10B981]/5 to-transparent border-b border-slate-100 px-5 py-4 flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#10B981]/10 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-[#10B981]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">Origem dos Melhores Clientes</p>
              <p className="text-xs text-slate-500">LTV médio previsto por canal de aquisição</p>
            </div>
          </div>
          <div className="p-5">
            {sourceLtv && sourceLtv.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={sourceLtv} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v: number) => v >= 1_000_000 ? `R$${(v/1_000_000).toFixed(1)}M` : `R$${Math.round(v/1000)}K`} />
                  <YAxis dataKey="source" type="category" tick={{ fontSize: 10 }} width={80} />
                  <Tooltip formatter={(v: number) => [v >= 1_000_000 ? `R$ ${(v/1_000_000).toFixed(2)}M` : `R$ ${Math.round(v/1000)}K`, "LTV Médio"]} />
                  <Bar dataKey="ltv" fill="#10B981" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[180px] flex items-center justify-center">
                <p className="text-sm text-slate-400 text-center">Faça upload de leads para ver o LTV por canal.</p>
              </div>
            )}
          </div>
        </div>

      </div>

      <ExecutiveSummary />
    </div>
  );
}
