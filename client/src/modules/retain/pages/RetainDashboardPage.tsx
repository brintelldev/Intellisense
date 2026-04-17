import { useLocation } from "wouter";
import { MetricCard } from "../../../shared/components/MetricCard";
import { ChurnTrendChart } from "../components/ChurnTrendChart";
import { RiskDistributionDonut } from "../components/RiskDistributionDonut";
import { RevenueBySegmentBar } from "../components/RevenueBySegmentBar";
import { AlertsList } from "../components/AlertsList";
import { ActionPrioritiesCard } from "../components/ActionPrioritiesCard";
import { RevenueProjectionCard } from "../components/RevenueProjectionCard";
import { EmptyState } from "../../../shared/components/EmptyState";
import { DataFreshnessIndicator } from "../../../shared/components/DataFreshnessIndicator";
import { LoadingState } from "../../../shared/components/LoadingState";
import {
  useRetainDashboard,
  useRetainDataFreshness,
  useRetainAlerts,
  useRetainRevenueBySegment,
  useRetainAnalyticsTrend,
  useRetainRenewals,
  useRetainActionPriorities,
} from "../../../shared/hooks/useRetain";
import { fmtBRLShort as fmtBRL } from "../../../shared/lib/format";

const healthColor = (s: number) =>
  s < 40 ? "#ef4444" : s < 60 ? "#f59e0b" : s < 80 ? "#64b783" : "#10B981";

export default function RetainDashboardPage() {
  const { data: apiData, isLoading } = useRetainDashboard();
  const { data: freshness } = useRetainDataFreshness();
  const { data: alertsData } = useRetainAlerts();
  const { data: revenueBySegment } = useRetainRevenueBySegment();
  const { data: analyticsTrend } = useRetainAnalyticsTrend();
  const { data: renewalsData } = useRetainRenewals();
  const { data: actionPriorities } = useRetainActionPriorities();
  const [, navigate] = useLocation();

  if (isLoading) return <LoadingState rows={8} />;

  const kpis = apiData?.kpis;

  if (!kpis) {
    return (
      <EmptyState
        title="Nenhum dado disponível"
        description="Importe seus dados para visualizar o dashboard de retenção."
        action={{ label: "Importar dados", onClick: () => navigate("/retain/upload") }}
      />
    );
  }

  const hs = kpis.avgHealthScore ?? 0;

  return (
    <div className="space-y-6 w-full">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900">Dashboard Executivo</h1>
            <span className="text-xs font-semibold bg-[#293b83]/10 text-[#293b83] px-2.5 py-1 rounded-full">
              Retain Sense
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-0.5">Visão geral de retenção e risco da base de clientes</p>
        </div>
        <div className="ml-auto">
          <DataFreshnessIndicator
            lastUploadAt={freshness?.lastUploadAt ?? null}
            totalRecords={freshness?.totalRecords}
          />
        </div>
      </div>

      {/* ── KPIs ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-5 gap-4">
        <MetricCard
          variant="retain"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          }
          label="Empresas Ativas"
          value={String(kpis.totalCustomers)}
          change={kpis.totalCustomersChange}
          changeIsGood={true}
        />
        <MetricCard
          variant="retain"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
          label="MRR"
          value={fmtBRL(kpis.mrr)}
          change={kpis.mrrChange}
          changeIsGood={true}
        />
        <MetricCard
          variant="retain"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
            </svg>
          }
          label="Taxa de Churn"
          value={`${kpis.churnRate}%`}
          change={kpis.churnRateChange}
          changeIsGood={false}
        />
        <MetricCard
          variant="retain"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          }
          label="Receita em Risco"
          value={fmtBRL(kpis.revenueAtRisk)}
          change={kpis.revenueAtRiskChange}
          changeIsGood={false}
        />
        {/* Health Score — replaces standalone gauge chart */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100 flex flex-col justify-between">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
            <span className="text-xs font-medium text-slate-500">Health Score Médio</span>
          </div>
          <div className="flex items-end gap-2">
            <span className="text-3xl font-bold tabular-nums" style={{ color: healthColor(hs) }}>{hs}</span>
            <span className="text-sm text-slate-400 mb-0.5">/ 100</span>
          </div>
          <div className="mt-2 h-1.5 rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${hs}%`, backgroundColor: healthColor(hs) }} />
          </div>
        </div>
      </div>

      {/* ── Prioridades de ação + Alertas recentes ────────────────────────── */}
      <div className="grid grid-cols-2 gap-6 items-stretch">
        <div className="flex flex-col">
          {actionPriorities?.priorities?.length > 0 && (
            <ActionPrioritiesCard
              data={actionPriorities}
              onSelectCustomer={() => navigate("/retain/predictions")}
            />
          )}
        </div>
        <AlertsList alerts={alertsData ?? []} />
      </div>

      {/* ── Projeção de receita + Receita por segmento ─────────────────────── */}
      {(!!apiData?.revenueProjection || (revenueBySegment ?? []).length > 0) && (
        <div className="grid grid-cols-2 gap-6">
          {apiData?.revenueProjection && (
            <RevenueProjectionCard projection={apiData.revenueProjection} />
          )}
          <RevenueBySegmentBar data={revenueBySegment ?? []} />
        </div>
      )}

      {/* ── Tendência | Distribuição de risco | Renovações próximas ─────── */}
      <div className="grid grid-cols-3 gap-6">
        <ChurnTrendChart data={analyticsTrend ?? []} />
        <RiskDistributionDonut
          data={kpis.riskDistribution ?? { low: 0, medium: 0, high: 0, critical: 0 }}
        />
        {(renewalsData ?? []).length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="bg-gradient-to-r from-[#293b83]/5 to-transparent border-b border-slate-100 px-5 py-4 flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[#293b83]/10 flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-[#293b83]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="flex-1">
                <h2 className="text-sm font-semibold text-slate-800">Renovações Próximas</h2>
                <p className="text-xs text-slate-500">Contratos que vencem nos próximos 90 dias</p>
              </div>
              {(renewalsData ?? []).length > 5 && (
                <button
                  onClick={() => navigate("/retain/customers")}
                  className="text-xs font-medium text-[#293b83] hover:underline"
                >
                  Ver todos
                </button>
              )}
            </div>
            <div className="p-5 space-y-1.5">
              {(renewalsData ?? []).slice(0, 5).map((r: any) => {
                const urgencyColor =
                  r.contractRemainingDays < 30
                    ? "text-red-600 bg-red-50 border-red-100"
                    : r.contractRemainingDays < 60
                    ? "text-orange-600 bg-orange-50 border-orange-100"
                    : "text-amber-600 bg-amber-50 border-amber-100";
                const riskColors: Record<string, string> = {
                  low: "bg-green-100 text-green-700",
                  medium: "bg-amber-100 text-amber-700",
                  high: "bg-orange-100 text-orange-700",
                  critical: "bg-red-100 text-red-700",
                };
                return (
                  <div
                    key={r.id}
                    className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{r.name}</p>
                      <p className="text-xs text-slate-400">{r.segment ?? "Sem segmento"}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${urgencyColor}`}>
                        {r.contractRemainingDays}d
                      </span>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${riskColors[r.riskLevel] ?? "bg-slate-100 text-slate-500"}`}
                      >
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
    </div>
  );
}
