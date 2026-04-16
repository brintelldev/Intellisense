import { useState } from "react";
import { useLocation } from "wouter";
import { MetricCard } from "../../../shared/components/MetricCard";
import { FunnelChart } from "../../../shared/components/FunnelChart";
import { QuadrantMatrix } from "../../../shared/components/QuadrantMatrix";
import { LeadQualityAreaChart } from "../components/LeadQualityAreaChart";
import { ICPDistributionDonut } from "../components/ICPDistributionDonut";
import { LeadPrioritiesCard } from "../components/LeadPrioritiesCard";
import { LeadDetailDrawer } from "../components/LeadDetailDrawer";
import { EmptyState } from "../../../shared/components/EmptyState";
import { DataFreshnessIndicator } from "../../../shared/components/DataFreshnessIndicator";
import { LoadingState } from "../../../shared/components/LoadingState";
import { useObtainDashboard, useObtainCampaigns, useObtainFunnel, useObtainICPClusters, useLeadQualityTrend, useObtainDataFreshness, useObtainLeadPriorities } from "../../../shared/hooks/useObtain";
import { fmtBRLShort as fmtBRL } from "../../../shared/lib/format";

export default function ObtainDashboardPage() {
  const { data: dashData, isLoading: loadingDash } = useObtainDashboard();
  const { data: apiCampaigns, isLoading: loadingCampaigns } = useObtainCampaigns();
  const { data: apiFunnel, isLoading: loadingFunnel } = useObtainFunnel();
  const { data: apiClusters } = useObtainICPClusters();
  const { data: apiLeadQuality } = useLeadQualityTrend();
  const { data: freshness } = useObtainDataFreshness();
  const { data: leadPriorities } = useObtainLeadPriorities();
  const [, navigate] = useLocation();
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);

  if (loadingDash || loadingCampaigns || loadingFunnel) return <LoadingState rows={8} />;

  const kpis = dashData?.kpis;
  const campaigns = apiCampaigns ?? [];
  const funnelStages = apiFunnel ?? [];

  if (!kpis) {
    return (
      <EmptyState
        title="Nenhum dado disponível"
        description="Importe seus dados para visualizar o dashboard de aquisição."
        action={{ label: "Importar dados", onClick: () => navigate("/obtain/upload") }}
      />
    );
  }

  const CAMPAIGN_POINTS = campaigns.map((c: any) => ({
    x: c.cac / 1000,
    y: c.avgLtv / 1000,
    label: c.name.split(" ")[0],
    color: c.roiStatus === "excellent" ? "#10B981" : c.roiStatus === "good" ? "#293b83" : c.roiStatus === "neutral" ? "#f59e0b" : "#ef4444",
    size: 12 + Math.sqrt(c.totalLeads),
  }));

  return (
    <div className="space-y-6 w-full">
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-bold text-slate-900">Dashboard Executivo</h1>
        <span className="text-xs font-semibold bg-[#10B981]/10 text-[#10B981] px-2.5 py-1 rounded-full">Obtain Sense</span>
        <div className="ml-auto">
          <DataFreshnessIndicator lastUploadAt={freshness?.lastUploadAt ?? null} totalRecords={freshness?.totalRecords} />
        </div>
      </div>

      {/* Lead Priorities */}
      {leadPriorities?.priorities?.length > 0 && (
        <LeadPrioritiesCard
          data={leadPriorities}
          onSelectLead={(id) => setSelectedLeadId(id)}
        />
      )}

      {/* KPIs */}
      <div className="grid grid-cols-5 gap-4">
        <MetricCard variant="obtain"
          icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8V7m0 9v1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
          label="CAC Atual"
          value={fmtBRL(kpis.cac)}
          change={kpis.cacChange}
          changeIsGood={false}
        />
        <MetricCard variant="obtain"
          icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>}
          label="LTV Médio Previsto"
          value={fmtBRL(kpis.avgLtv)}
          change={kpis.avgLtvChange}
          changeIsGood={true}
        />
        <MetricCard variant="obtain"
          icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" strokeWidth={1.5} /><circle cx="12" cy="12" r="6" strokeWidth={1.5} /><circle cx="12" cy="12" r="2" strokeWidth={1.5} /></svg>}
          label="Taxa Conversão Funil"
          value={`${(kpis.conversionRate * 100).toFixed(0)}%`}
          change={kpis.conversionRateChange}
          changeIsGood={true}
        />
        <MetricCard variant="obtain"
          icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
          label="Tempo Médio Aquisição"
          value={kpis.avgAcquisitionDays != null ? `${kpis.avgAcquisitionDays} dias` : "—"}
          change={kpis.avgAcquisitionDaysChange}
          changeIsGood={false}
        />
        <MetricCard variant="obtain"
          icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>}
          label="Receita no Funil"
          value={fmtBRL(kpis.revenueInFunnel)}
          change={kpis.revenueInFunnelChange}
          changeIsGood={true}
        />
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
          <h3 className="font-semibold text-slate-800 mb-4">Eficiência de Canais: CAC × LTV</h3>
          <QuadrantMatrix
            points={CAMPAIGN_POINTS}
            xLabel="CAC (R$ mil)"
            yLabel="LTV (R$ mil)"
            xMid={6}
            yMid={450}
            quadrantLabels={["Atenção", "Avaliar", "Escalar", "Interromper"]}
            formatX={(v) => `R$${parseFloat(v.toFixed(1))}K`}
            formatY={(v) => `R$${parseFloat(v.toFixed(0))}K`}
          />
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
          <h3 className="font-semibold text-slate-800 mb-4">Funil de Vendas</h3>
          <div className="mt-4">
            <FunnelChart stages={funnelStages} compact />
          </div>
        </div>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-2 gap-6">
        <LeadQualityAreaChart data={apiLeadQuality ?? []} />
        <ICPDistributionDonut clusters={apiClusters ?? []} />
      </div>

      {selectedLeadId && (
        <LeadDetailDrawer
          lead={{ id: selectedLeadId } as any}
          onClose={() => setSelectedLeadId(null)}
        />
      )}
    </div>
  );
}
