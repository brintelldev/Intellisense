import { useLocation } from "wouter";
import { MetricCard } from "../../../shared/components/MetricCard";
import { ChurnTrendChart } from "../components/ChurnTrendChart";
import { RiskDistributionDonut } from "../components/RiskDistributionDonut";
import { RevenueBySegmentBar } from "../components/RevenueBySegmentBar";
import { HealthScoreGauge } from "../components/HealthScoreGauge";
import { AlertsList } from "../components/AlertsList";
import { EmptyState } from "../../../shared/components/EmptyState";
import { DataFreshnessIndicator } from "../../../shared/components/DataFreshnessIndicator";
import { LoadingState } from "../../../shared/components/LoadingState";
import { useRetainDashboard, useRetainDataFreshness, useRetainAlerts, useRetainRevenueBySegment, useRetainAnalyticsTrend, useRetainRenewals } from "../../../shared/hooks/useRetain";
import { fmtBRLShort as fmtBRL } from "../../../shared/lib/format";

export default function RetainDashboardPage() {
  const { data: apiData, isLoading } = useRetainDashboard();
  const { data: freshness } = useRetainDataFreshness();
  const { data: alertsData } = useRetainAlerts();
  const { data: revenueBySegment } = useRetainRevenueBySegment();
  const { data: analyticsTrend } = useRetainAnalyticsTrend();
  const { data: renewalsData } = useRetainRenewals();
  const [, navigate] = useLocation();

  if (isLoading) return <LoadingState rows={8} />;

  const dashboardKPIs = apiData?.kpis;

  if (!dashboardKPIs) {
    return (
      <EmptyState
        title="Nenhum dado disponível"
        description="Importe seus dados para visualizar o dashboard de retenção."
        action={{ label: "Importar dados", onClick: () => navigate("/retain/upload") }}
      />
    );
  }

  return (
    <div className="space-y-6 w-full">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900">Dashboard Executivo</h1>
            <span className="text-xs font-semibold bg-[#293b83]/10 text-[#293b83] px-2.5 py-1 rounded-full">Retain Sense</span>
          </div>
          <p className="text-sm text-slate-500 mt-0.5">Visão geral de retenção e risco da base de clientes</p>
        </div>
        <div className="ml-auto">
          <DataFreshnessIndicator lastUploadAt={freshness?.lastUploadAt ?? null} totalRecords={freshness?.totalRecords} />
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4">
        <MetricCard
          variant="retain"
          icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
          label="Empresas Ativas"
          value={String(dashboardKPIs.totalCustomers)}
          change={dashboardKPIs.totalCustomersChange}
          changeIsGood={true}
        />
        <MetricCard
          variant="retain"
          icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" /></svg>}
          label="Taxa de Churn"
          value={`${dashboardKPIs.churnRate}%`}
          change={dashboardKPIs.churnRateChange}
          changeIsGood={false}
        />
        <MetricCard
          variant="retain"
          icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
          label="Valor do Contrato (MRR)"
          value={fmtBRL(dashboardKPIs.mrr)}
          change={dashboardKPIs.mrrChange}
          changeIsGood={true}
        />
        <MetricCard
          variant="retain"
          icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>}
          label="Receita em Risco"
          value={fmtBRL(dashboardKPIs.revenueAtRisk)}
          change={dashboardKPIs.revenueAtRiskChange}
          changeIsGood={false}
        />
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-2 gap-6">
        <ChurnTrendChart data={analyticsTrend ?? []} />
        <RiskDistributionDonut data={apiData?.riskDistribution ?? { low: 0, medium: 0, high: 0, critical: 0 }} />
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-2 gap-6">
        <RevenueBySegmentBar data={revenueBySegment ?? []} />
        <HealthScoreGauge value={dashboardKPIs.avgHealthScore ?? 0} />
      </div>

      {/* Alerts */}
      <AlertsList alerts={alertsData ?? []} />

      {/* Renovações Próximas */}
      {(renewalsData ?? []).length > 0 && (
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-700">Renovações Próximas</h2>
            {(renewalsData ?? []).length > 5 && (
              <button
                onClick={() => navigate("/retain/customers")}
                className="text-xs font-medium text-[#293b83] hover:underline"
              >
                Ver todos
              </button>
            )}
          </div>
          <div className="space-y-2">
            {(renewalsData ?? []).slice(0, 5).map((r: any) => {
              const urgencyColor = r.contractRemainingDays < 30 ? "text-red-600 bg-red-50" : r.contractRemainingDays < 60 ? "text-orange-600 bg-orange-50" : "text-amber-600 bg-amber-50";
              const riskColors: Record<string, string> = { low: "bg-green-100 text-green-700", medium: "bg-amber-100 text-amber-700", high: "bg-orange-100 text-orange-700", critical: "bg-red-100 text-red-700" };
              return (
                <div key={r.id} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{r.name}</p>
                      <p className="text-xs text-slate-400">{r.segment ?? "Sem segmento"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${urgencyColor}`}>
                      {r.contractRemainingDays}d
                    </span>
                    <span className="text-xs text-slate-500 tabular-nums w-8 text-center">{r.healthScore ?? "-"}</span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${riskColors[r.riskLevel] ?? "bg-slate-100 text-slate-500"}`}>
                      {r.riskLevel}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
