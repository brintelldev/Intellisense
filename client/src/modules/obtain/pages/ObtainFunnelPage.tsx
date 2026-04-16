import { useLocation } from "wouter";
import { FunnelChart } from "../../../shared/components/FunnelChart";
import { FunnelAlertCards } from "../components/FunnelAlertCards";
import { EmptyState } from "../../../shared/components/EmptyState";
import { LoadingState } from "../../../shared/components/LoadingState";
import { useObtainFunnel, useObtainAlerts } from "../../../shared/hooks/useObtain";

import { fmtBRLShort as fmtBRL } from "../../../shared/lib/format";

export default function ObtainFunnelPage() {
  const { data: apiFunnel, isLoading } = useObtainFunnel();
  const { data: apiFunnelAlerts } = useObtainAlerts();
  const [, navigate] = useLocation();

  if (isLoading) return <LoadingState rows={6} />;

  const funnelStages = apiFunnel ?? [];

  if (funnelStages.length === 0) {
    return (
      <EmptyState
        title="Nenhum dado de funil encontrado"
        description="Importe dados de leads para visualizar o funil de vendas."
        action={{ label: "Importar dados", onClick: () => navigate("/obtain/upload") }}
      />
    );
  }

  const totalRevenue = funnelStages.reduce((a: number, s: any) => a + s.revenueAtRisk, 0);
  const totalHotStuck = funnelStages.reduce((a: number, s: any) => a + (s.hotLeadsStuck ?? 0), 0);
  const conversionRate = funnelStages.length > 0
    ? ((funnelStages[funnelStages.length - 1].leadsCount / funnelStages[0].leadsCount) * 100).toFixed(1)
    : "0";

  return (
    <div className="space-y-6 w-full">
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-bold text-slate-900">Funil de Vendas</h1>
        <span className="text-xs font-semibold bg-[#10B981]/10 text-[#10B981] px-2.5 py-1 rounded-full">Obtain Sense</span>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
          <p className="text-xs text-slate-500">Receita Total no Funil</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{fmtBRL(totalRevenue)}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
          <p className="text-xs text-slate-500">Leads Hot Travados</p>
          <p className="text-2xl font-bold text-red-500 mt-1">{totalHotStuck}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
          <p className="text-xs text-slate-500">Taxa de Conversão Geral</p>
          <p className="text-2xl font-bold text-[#10B981] mt-1">{conversionRate}%</p>
        </div>
      </div>

      {/* Funnel chart */}
      <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
        <h3 className="font-semibold text-slate-800 mb-4">Visão do Funil Completo</h3>
        <FunnelChart stages={funnelStages} />
      </div>

      {/* Stage metrics table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-800">Métricas por Etapa</h3>
        </div>
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50">
              <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3">Etapa</th>
              <th className="text-right text-xs font-semibold text-slate-500 px-4 py-3">Leads</th>
              <th className="text-right text-xs font-semibold text-slate-500 px-4 py-3">Hot Travados</th>
              <th className="text-right text-xs font-semibold text-slate-500 px-4 py-3">Tempo Médio</th>
              <th className="text-right text-xs font-semibold text-slate-500 px-4 py-3">Drop-off</th>
              <th className="text-right text-xs font-semibold text-slate-500 px-4 py-3">LTV em Risco</th>
            </tr>
          </thead>
          <tbody>
            {funnelStages.map((stage) => (
              <tr key={stage.id} className={`border-t border-slate-50 ${stage.isBottleneck ? "bg-red-50/50" : ""}`}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-800">{stage.name}</span>
                    {stage.isBottleneck && (
                      <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">Gargalo</span>
                    )}
                  </div>
                </td>
                <td className="text-right px-4 py-3 text-sm font-medium text-slate-800">{stage.leadsCount}</td>
                <td className="text-right px-4 py-3">
                  <span className={`text-sm font-medium ${stage.hotLeadsStuck > 0 ? "text-red-600" : "text-slate-400"}`}>
                    {stage.hotLeadsStuck > 0 ? stage.hotLeadsStuck : "—"}
                  </span>
                </td>
                <td className="text-right px-4 py-3 text-sm text-slate-600">
                  {stage.avgTimeDays > 0 ? `${stage.avgTimeDays}d` : "—"}
                </td>
                <td className="text-right px-4 py-3">
                  <span className={`text-sm ${stage.dropOffRate > 0.5 ? "text-red-600 font-semibold" : "text-slate-600"}`}>
                    {stage.dropOffRate > 0 ? `${(stage.dropOffRate * 100).toFixed(0)}%` : "—"}
                  </span>
                </td>
                <td className="text-right px-4 py-3 text-sm font-medium text-slate-800">
                  {stage.revenueAtRisk > 0 ? fmtBRL(stage.revenueAtRisk) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Alert cards */}
      <FunnelAlertCards alerts={apiFunnelAlerts ?? []} />
    </div>
  );
}
