import { MetricCard } from "../../../shared/components/MetricCard";
import { FunnelChart } from "../../../shared/components/FunnelChart";
import { QuadrantMatrix } from "../../../shared/components/QuadrantMatrix";
import { LeadQualityAreaChart } from "../components/LeadQualityAreaChart";
import { ICPDistributionDonut } from "../components/ICPDistributionDonut";
import { obtainDashboardKPIs, campaigns as mockCampaigns } from "../../../data/obtain-campaigns";
import { funnelStages as mockFunnelStages } from "../../../data/obtain-funnel";
import { useObtainDashboard, useObtainCampaigns, useObtainFunnel } from "../../../shared/hooks/useObtain";
import { LoadingState } from "../../../shared/components/LoadingState";
import { fmtBRLShort as fmtBRL, fmtBRLShort } from "../../../shared/lib/format";

export default function ObtainDashboardPage() {
  const { data: dashData, isLoading: loadingDash } = useObtainDashboard();
  const { data: apiCampaigns, isLoading: loadingCampaigns } = useObtainCampaigns();
  const { data: apiFunnel, isLoading: loadingFunnel } = useObtainFunnel();

  const kpis = dashData?.kpis ?? obtainDashboardKPIs;
  const campaigns = apiCampaigns ?? mockCampaigns;
  const funnelStages = apiFunnel ?? mockFunnelStages;

  const CAMPAIGN_POINTS = campaigns.map((c: any) => ({
    x: c.cac / 1000,
    y: c.avgLtv / 1000,
    label: c.name.split(" ")[0],
    color: c.roiStatus === "excellent" ? "#10B981" : c.roiStatus === "good" ? "#293b83" : c.roiStatus === "neutral" ? "#f59e0b" : "#ef4444",
    size: 12 + Math.sqrt(c.totalLeads),
  }));

  if (loadingDash || loadingCampaigns || loadingFunnel) return <LoadingState rows={8} />;

  return (
    <div className="space-y-6 w-full">
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-bold text-slate-900">Dashboard Executivo</h1>
        <span className="text-xs font-semibold bg-[#10B981]/10 text-[#10B981] px-2.5 py-1 rounded-full">Obtain Sense</span>
      </div>

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
          value={`${kpis.avgAcquisitionDays} dias`}
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
            formatX={(v) => `R$${v}K`}
            formatY={(v) => `R$${v}K`}
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
        <LeadQualityAreaChart />
        <ICPDistributionDonut />
      </div>
    </div>
  );
}
