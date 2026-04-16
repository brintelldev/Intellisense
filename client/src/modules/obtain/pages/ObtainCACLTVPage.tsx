import { useLocation } from "wouter";
import { RefreshCcw } from "lucide-react";
import { QuadrantMatrix } from "../../../shared/components/QuadrantMatrix";
import { EmptyState } from "../../../shared/components/EmptyState";
import { LoadingState } from "../../../shared/components/LoadingState";
import { useObtainCampaigns } from "../../../shared/hooks/useObtain";

import { fmtBRLShort as fmtBRL } from "../../../shared/lib/format";

const ROI_CONFIG: Record<string, { badge: string; bg: string }> = {
  excellent: { badge: "bg-emerald-100 text-emerald-700", bg: "bg-emerald-50/50" },
  good: { badge: "bg-blue-100 text-blue-700", bg: "" },
  neutral: { badge: "bg-yellow-100 text-yellow-700", bg: "bg-yellow-50/30" },
  poor: { badge: "bg-red-100 text-red-700", bg: "bg-red-50/40" },
};

const ROI_LABELS: Record<string, string> = {
  excellent: "Excelente", good: "Bom", neutral: "Neutro", poor: "Ruim",
};

const CHANNEL_COLORS: Record<string, string> = {
  referral: "#10B981", event: "#293b83", paid_social: "#8b5cf6", paid_search: "#f59e0b", outbound: "#ef4444",
};

export default function ObtainCACLTVPage() {
  const { data: apiCampaigns, isLoading } = useObtainCampaigns();
  const [, navigate] = useLocation();

  if (isLoading) return <LoadingState rows={6} />;

  const campaigns = apiCampaigns ?? [];

  if (campaigns.length === 0) {
    return (
      <EmptyState
        title="Nenhuma campanha encontrada"
        description="Importe dados de campanhas para analisar a eficiência de canais."
        action={{ label: "Importar dados", onClick: () => navigate("/obtain/upload") }}
      />
    );
  }

  const POINTS = campaigns.map((c: any) => ({
    x: c.cac / 1000,
    y: c.avgLtv / 1000,
    label: c.name.split(" ")[0],
    color: CHANNEL_COLORS[c.channel] ?? "#64748b",
    size: 14 + Math.sqrt(c.totalLeads),
  }));

  return (
    <div className="space-y-6 w-full">
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-bold text-slate-900">Eficiência de Canais — CAC × LTV</h1>
        <span className="text-xs font-semibold bg-[#10B981]/10 text-[#10B981] px-2.5 py-1 rounded-full">Obtain Sense</span>
      </div>

      {/* Quadrant matrix */}
      <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
        <p className="text-xs text-slate-500 mb-4">Cada ponto representa uma campanha — tamanho proporcional ao volume de leads gerados</p>
        <QuadrantMatrix
          points={POINTS}
          xLabel="CAC (R$ mil)"
          yLabel="LTV Médio (R$ mil)"
          xMid={6}
          yMid={450}
          quadrantLabels={["Atenção", "Avaliar", "Escalar", "Interromper"]}
          formatX={(v) => `R$${parseFloat(v.toFixed(1))}K`}
          formatY={(v) => `R$${parseFloat(v.toFixed(0))}K`}
        />
      </div>

      {/* Campaigns table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-800">Detalhamento por Campanha</h3>
        </div>
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50">
              <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3">Campanha</th>
              <th className="text-right text-xs font-semibold text-slate-500 px-4 py-3">Leads</th>
              <th className="text-right text-xs font-semibold text-slate-500 px-4 py-3">CAC</th>
              <th className="text-right text-xs font-semibold text-slate-500 px-4 py-3">LTV Médio</th>
              <th className="text-right text-xs font-semibold text-slate-500 px-4 py-3">ROI Projetado</th>
              <th className="text-right text-xs font-semibold text-slate-500 px-4 py-3">Conversão</th>
              <th className="text-right text-xs font-semibold text-slate-500 px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map((c) => {
              const cfg = ROI_CONFIG[c.roiStatus];
              return (
                <tr key={c.id} className={`border-t border-slate-50 ${cfg.bg}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: CHANNEL_COLORS[c.channel] }} />
                      <span className="text-sm font-medium text-slate-800">{c.name}</span>
                    </div>
                  </td>
                  <td className="text-right px-4 py-3 text-sm text-slate-700">{c.totalLeads}</td>
                  <td className="text-right px-4 py-3 text-sm text-slate-700">{fmtBRL(c.cac)}</td>
                  <td className="text-right px-4 py-3 text-sm font-semibold text-slate-800">{fmtBRL(c.avgLtv)}</td>
                  <td className="text-right px-4 py-3 text-sm font-bold text-[#10B981]">{c.projectedRoi.toLocaleString("pt-BR")}%</td>
                  <td className="text-right px-4 py-3 text-sm text-slate-700">{c.conversionRate != null ? `${c.conversionRate}%` : "—"}</td>
                  <td className="text-right px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cfg.badge}`}>{ROI_LABELS[c.roiStatus]}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Retroalimentação Retain→Obtain insight */}
      {(() => {
        const best = campaigns.reduce((a: any, b: any) => (a.avgLtv > b.avgLtv ? a : b), campaigns[0]);
        const worst = campaigns.reduce((a: any, b: any) => (a.avgLtv < b.avgLtv ? a : b), campaigns[0]);
        if (!best || !worst || best.id === worst.id) return null;
        return (
          <div className="border-l-4 border-[#293b83] bg-[#293b83]/5 rounded-r-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <RefreshCcw className="w-5 h-5 text-[#293b83]" />
              <h4 className="font-semibold text-[#293b83] text-sm">Retroalimentação Retain → Obtain</h4>
              <span className="text-xs bg-[#293b83] text-white px-2 py-0.5 rounded-full">Dados do Retain Sense</span>
            </div>
            <p className="text-sm text-slate-700">
              O canal <strong>{worst.name}</strong> gera leads com LTV médio de <strong>{fmtBRL(worst.avgLtv)}</strong> — o mais baixo da base. O canal <strong>{best.name}</strong> tem LTV médio de <strong>{fmtBRL(best.avgLtv)}</strong>, {Math.round((best.avgLtv / worst.avgLtv - 1) * 100)}% maior.{" "}
              <strong>Sugestão: priorizar investimento em {best.name}</strong> para maximizar o retorno por lead adquirido.
            </p>
          </div>
        );
      })()}
    </div>
  );
}
