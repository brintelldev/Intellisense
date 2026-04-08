import { useLocation } from "wouter";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar, ResponsiveContainer } from "recharts";
import { dashboardKPIs as mockRetainKPIs } from "../../data/retain-analytics";
import { obtainDashboardKPIs as mockObtainKPIs, leadQualityTrend } from "../../data/obtain-campaigns";
import { useRetainDashboard } from "../../shared/hooks/useRetain";
import { useObtainDashboard } from "../../shared/hooks/useObtain";
import { LoadingState } from "../../shared/components/LoadingState";
import { fmtBRLShort as fmtBRL } from "../../shared/lib/format";

const sourcePerformance = [
  { source: "Indicação", ltv: 890 },
  { source: "Feira", ltv: 720 },
  { source: "LinkedIn", ltv: 540 },
  { source: "Google Ads", ltv: 180 },
  { source: "Outbound", ltv: 150 },
];

export default function LifecyclePage() {
  const [, navigate] = useLocation();

  const { data: retainDashData, isLoading: loadingRetain } = useRetainDashboard();
  const { data: obtainDashData, isLoading: loadingObtain } = useObtainDashboard();

  const dashboardKPIs = retainDashData?.kpis ?? mockRetainKPIs;
  const obtainDashboardKPIs = obtainDashData?.kpis ?? mockObtainKPIs;

  if (loadingRetain || loadingObtain) return <LoadingState rows={8} />;

  return (
    <div className="space-y-6 w-full">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Ciclo de Vida do Cliente</h1>
        <p className="text-sm text-slate-500 mt-1">Visão integrada de aquisição e retenção</p>
      </div>

      {/* 3 blocks */}
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
              <p className="text-xl font-bold text-slate-900">{obtainDashboardKPIs.totalLeads}</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-xs text-slate-500">Leads Hot</p>
              <p className="text-xl font-bold text-[#10B981]">{obtainDashboardKPIs.hotLeads}</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-xs text-slate-500">CAC Médio</p>
              <p className="text-xl font-bold text-slate-900">{fmtBRL(obtainDashboardKPIs.cac)}</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-xs text-slate-500">Tx. Conversão</p>
              <p className="text-xl font-bold text-slate-900">{(obtainDashboardKPIs.conversionRate * 100).toFixed(0)}%</p>
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
          <div className="text-4xl md:text-5xl font-bold tabular-nums">12</div>
          <p className="text-sm mt-2 text-white/90">novos clientes convertidos este mês</p>
          <div className="flex items-center gap-2 mt-4">
            <span className="text-xs bg-white/20 px-2 py-1 rounded">LTV médio previsto</span>
          </div>
          <div className="text-lg font-semibold mt-1">R$ 540K</div>
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
              <p className="text-xl font-bold text-slate-900">{dashboardKPIs.totalCustomers}</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-xs text-slate-500">Em Risco</p>
              <p className="text-xl font-bold text-red-500">{dashboardKPIs.riskDistribution.high + dashboardKPIs.riskDistribution.critical}</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-xs text-slate-500">Churn Rate</p>
              <p className="text-xl font-bold text-slate-900">{dashboardKPIs.churnRate}%</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-xs text-slate-500">Receita em Risco</p>
              <p className="text-xl font-bold text-orange-500">{fmtBRL(dashboardKPIs.revenueAtRisk)}</p>
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

      {/* Ecosystem insight */}
      <div className="bg-[#f0fdf4] rounded-xl p-5 shadow-sm border-l-4 border-[#10B981]">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 bg-[#293b83]/10 rounded-lg flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-[#293b83]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h3 className="font-semibold text-slate-800">Insight do Ecossistema</h3>
              <span className="text-xs bg-gradient-to-r from-[#293b83] to-[#10B981] text-white px-2 py-0.5 rounded-full">Retroalimentação Retain → Obtain</span>
            </div>
            <p className="text-sm text-slate-600">
              Clientes adquiridos por <strong>Indicação</strong> (Obtain) têm churn <strong>62% menor</strong> que a média (Retain).
              Recomendação: aumentar investimento neste canal em 30%.
            </p>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Line chart */}
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
          <h3 className="font-semibold text-slate-800 mb-4">Qualidade da Aquisição ao Longo do Tempo</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={leadQualityTrend}>
              <defs>
                <linearGradient id="hotGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Area type="monotone" dataKey="hot" name="Hot" stroke="#10B981" fill="url(#hotGrad)" strokeWidth={2} />
              <Area type="monotone" dataKey="warm" name="Warm" stroke="#f59e0b" fill="none" strokeWidth={2} strokeDasharray="4 4" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Bar chart */}
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
          <h3 className="font-semibold text-slate-800 mb-4">Origem dos Melhores Clientes (LTV Médio)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={sourcePerformance} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${v}K`} />
              <YAxis dataKey="source" type="category" tick={{ fontSize: 10 }} width={72} />
              <Tooltip formatter={(v: number) => [`R$ ${v}K`, "LTV Médio"]} />
              <Bar dataKey="ltv" fill="#293b83" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
