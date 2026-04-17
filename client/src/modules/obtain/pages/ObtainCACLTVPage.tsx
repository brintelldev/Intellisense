import { useLocation } from "wouter";
import { QuadrantMatrix } from "../../../shared/components/QuadrantMatrix";
import { EmptyState } from "../../../shared/components/EmptyState";
import { LoadingState } from "../../../shared/components/LoadingState";
import { useObtainCampaigns } from "../../../shared/hooks/useObtain";
import { fmtBRLShort as fmtBRL } from "../../../shared/lib/format";
import type { Campaign } from "../../../shared/types";

const CHANNEL_COLORS: Record<string, string> = {
  referral: "#10B981",
  event: "#293b83",
  paid_social: "#8b5cf6",
  paid_search: "#f59e0b",
  outbound: "#ef4444",
  organic: "#06b6d4",
  email: "#64748b",
};

function dot(color: string) {
  return (
    <span
      className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
      style={{ backgroundColor: color }}
    />
  );
}

function fmtPct(v: number | null) {
  if (v == null) return "—";
  return `${v.toLocaleString("pt-BR")}%`;
}

// ── Hero "Canal Campeão" ──────────────────────────────────────────────────────
function ChannelHero({ campaign, onViewLeads, onViewCustomers }: {
  campaign: Campaign;
  onViewLeads: () => void;
  onViewCustomers: () => void;
}) {
  const color = CHANNEL_COLORS[campaign.channel] ?? "#64748b";
  const hasVerified = campaign.avgLtvVerified != null;

  return (
    <div className="bg-white rounded-xl shadow-sm border overflow-hidden h-full" style={{ borderColor: color + "40" }}>
      <div className="border-b px-4 py-2.5 flex items-center gap-2.5" style={{ borderColor: color + "20", background: `linear-gradient(to right, ${color}12, transparent)` }}>
        {dot(color)}
        <span className="text-[10px] font-bold text-white px-2 py-0.5 rounded-full uppercase tracking-wide" style={{ backgroundColor: color }}>
          Canal Campeão
        </span>
        <h2 className="text-sm font-bold text-slate-900 truncate">{campaign.name}</h2>
      </div>

      <div className="p-4 flex flex-col gap-3">
        {/* KPIs */}
        <div className="grid grid-cols-3 gap-1.5">
          <div className="bg-slate-50 rounded-md px-2.5 py-1.5 border border-slate-100">
            <p className="text-[9px] text-slate-400 uppercase tracking-wide">
              {hasVerified ? "LTV Verificado" : "LTV Previsto"}
            </p>
            <p className="text-sm font-bold text-slate-800">
              {fmtBRL(hasVerified ? campaign.avgLtvVerified : campaign.avgLtvPredicted)}
            </p>
            {hasVerified && (
              <p className="text-[9px] text-slate-400">
                prev: {fmtBRL(campaign.avgLtvPredicted)}
              </p>
            )}
          </div>
          <div className="bg-slate-50 rounded-md px-2.5 py-1.5 border border-slate-100">
            <p className="text-[9px] text-slate-400 uppercase tracking-wide">Conversão</p>
            <p className="text-sm font-bold text-slate-800">{campaign.conversionRate}%</p>
          </div>
          <div className="bg-slate-50 rounded-md px-2.5 py-1.5 border border-slate-100">
            <p className="text-[9px] text-slate-400 uppercase tracking-wide">Leads totais</p>
            <p className="text-sm font-bold text-slate-800">{campaign.totalLeads}</p>
          </div>
          {campaign.cac != null ? (
            <>
              <div className="bg-slate-50 rounded-md px-2.5 py-1.5 border border-slate-100">
                <p className="text-[9px] text-slate-400 uppercase tracking-wide">CAC Real</p>
                <p className="text-sm font-bold text-slate-800">{fmtBRL(campaign.cac)}</p>
              </div>
              <div className="bg-emerald-50 rounded-md px-2.5 py-1.5 border border-emerald-100">
                <p className="text-[9px] text-slate-400 uppercase tracking-wide">ROI</p>
                <p className="text-sm font-bold text-emerald-700">{fmtPct(campaign.projectedRoi)}</p>
              </div>
              <div className="bg-slate-50 rounded-md px-2.5 py-1.5 border border-slate-100">
                <p className="text-[9px] text-slate-400 uppercase tracking-wide">Payback</p>
                <p className="text-sm font-bold text-slate-800">{campaign.paybackDays ? `${campaign.paybackDays}d` : "—"}</p>
              </div>
            </>
          ) : (
            <div className="col-span-3 rounded-md px-2.5 py-1.5 bg-amber-50 border border-amber-100">
              <p className="text-[10px] text-amber-700">CAC sem dados de investimento — <button className="underline" onClick={() => {}}>importe budget</button></p>
            </div>
          )}
        </div>

        {/* Retain health badges */}
        {campaign.verifiedSampleSize > 0 && (
          <div className="flex gap-1.5">
            <span className="text-[10px] bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/20 px-2 py-0.5 rounded-full font-medium">
              ✓ {campaign.wonCustomersHealthy} saudáveis
            </span>
            {campaign.wonCustomersAtRisk > 0 && (
              <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-medium">
                ⚠ {campaign.wonCustomersAtRisk} em risco
              </span>
            )}
            {campaign.wonCustomersChurned > 0 && (
              <span className="text-[10px] bg-red-50 text-red-600 border border-red-200 px-2 py-0.5 rounded-full font-medium">
                ✗ {campaign.wonCustomersChurned} churn
              </span>
            )}
          </div>
        )}

        {/* CTAs */}
        <div className="flex gap-2 mt-auto pt-1">
          <button
            onClick={onViewLeads}
            className="flex-1 h-7 text-white text-xs font-semibold rounded-lg transition-colors"
            style={{ backgroundColor: color }}
          >
            Ver leads ({campaign.wonLeads}) →
          </button>
          {campaign.verifiedSampleSize > 0 && (
            <button
              onClick={onViewCustomers}
              className="flex-1 h-7 bg-[#293b83] text-white text-xs font-semibold rounded-lg hover:bg-[#1e2d6a] transition-colors"
            >
              Ver clientes ({campaign.verifiedSampleSize}) →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ObtainCACLTVPage() {
  const { data: apiCampaigns, isLoading } = useObtainCampaigns();
  const [, navigate] = useLocation();

  if (isLoading) return <LoadingState rows={6} />;

  const campaigns = (apiCampaigns ?? []) as Campaign[];

  if (campaigns.length === 0) {
    return (
      <EmptyState
        title="Nenhum dado de canal encontrado"
        description="Importe dados de leads para analisar a eficiência por canal de aquisição."
        action={{ label: "Importar dados", onClick: () => navigate("/obtain/upload") }}
      />
    );
  }

  // Champion: best by ltvChurnAdjusted → verified LTV → predicted LTV
  const champion = [...campaigns].sort((a, b) => {
    const aScore = a.ltvChurnAdjusted ?? a.avgLtvVerified ?? a.avgLtvPredicted;
    const bScore = b.ltvChurnAdjusted ?? b.avgLtvVerified ?? b.avgLtvPredicted;
    return bScore - aScore;
  })[0];

  // Quadrant data — use verified LTV when available
  const quadrantPoints = campaigns
    .filter(c => c.totalLeads > 0)
    .map(c => ({
      x: c.totalLeads,
      y: (c.avgLtvVerified ?? c.avgLtvPredicted) / 1000,
      label: c.name.split(" ")[0],
      color: CHANNEL_COLORS[c.channel] ?? "#64748b",
      size: 12 + Math.min(20, Math.sqrt(c.totalLeads) * 2),
      // Encode post-sale churn as opacity for color
    }));

  const xMid = Math.round(campaigns.reduce((s, c) => s + c.totalLeads, 0) / campaigns.length);
  const yMid = Math.round(campaigns.reduce((s, c) => s + (c.avgLtvVerified ?? c.avgLtvPredicted), 0) / campaigns.length) / 1000;

  // Retain bridge aggregate
  const totalMatchedCustomers = campaigns.reduce((s, c) => s + c.verifiedSampleSize, 0);
  const totalHealthy  = campaigns.reduce((s, c) => s + c.wonCustomersHealthy, 0);
  const totalAtRisk   = campaigns.reduce((s, c) => s + c.wonCustomersAtRisk, 0);
  const totalChurned  = campaigns.reduce((s, c) => s + c.wonCustomersChurned, 0);
  const bestPostSale  = [...campaigns].filter(c => c.verifiedSampleSize > 0)
    .sort((a, b) => (a.postSaleChurnRate ?? 1) - (b.postSaleChurnRate ?? 1))[0];

  const anyNoCac = campaigns.some(c => c.cac == null);

  return (
    <div className="space-y-5 w-full">
      {/* Header */}
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-bold text-slate-900">Eficiência de Canais — CAC × LTV</h1>
        <span className="text-xs font-semibold bg-[#10B981]/10 text-[#10B981] px-2.5 py-1 rounded-full">
          Obtain Sense
        </span>
      </div>

      {/* Row 1 — Hero + Quadrant */}
      <div className="grid grid-cols-[2fr_3fr] gap-5 items-stretch">
        {/* Hero */}
        <ChannelHero
          campaign={champion}
          onViewLeads={() => navigate(`/obtain/leads?source=${champion.channel}`)}
          onViewCustomers={() => navigate(`/retain/customers`)}
        />

        {/* Quadrant */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden flex flex-col">
          <div className="bg-gradient-to-r from-[#10B981]/5 to-transparent border-b border-slate-100 px-5 py-3 flex items-center gap-2 flex-shrink-0">
            <div className="w-7 h-7 rounded-lg bg-[#10B981]/10 flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-[#10B981]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-800">Qualidade × Volume</h3>
              <p className="text-xs text-slate-500">LTV médio por canal vs volume de leads</p>
            </div>
          </div>
          <div className="p-4 flex-1">
            <QuadrantMatrix
              points={quadrantPoints}
              xLabel="Volume de leads"
              yLabel="LTV médio (R$ mil)"
              xMid={xMid}
              yMid={yMid}
              quadrantLabels={["Poucos leads, LTV baixo", "Escalar agressivamente", "Muitos leads, LTV baixo", "Volume alto, LTV alto"]}
              formatX={(v) => `${v}`}
              formatY={(v) => `R$${v.toFixed(0)}K`}
            />
          </div>
        </div>
      </div>

      {/* Row 2 — Channel table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="bg-gradient-to-r from-[#10B981]/5 to-transparent border-b border-slate-100 px-5 py-3 flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#10B981]/10 flex items-center justify-center flex-shrink-0">
            <svg className="w-3.5 h-3.5 text-[#10B981]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Ranking por Canal</h3>
            <p className="text-xs text-slate-500">Ordenado por LTV ajustado por churn pós-venda</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50">
                <th className="text-left text-xs font-semibold text-slate-500 px-4 py-2.5">Canal</th>
                <th className="text-right text-xs font-semibold text-slate-500 px-4 py-2.5">Leads</th>
                <th className="text-right text-xs font-semibold text-slate-500 px-4 py-2.5">Conversão</th>
                <th className="text-right text-xs font-semibold text-slate-500 px-4 py-2.5">LTV Previsto</th>
                <th className="text-right text-xs font-semibold text-slate-500 px-4 py-2.5">LTV Verificado</th>
                <th className="text-right text-xs font-semibold text-slate-500 px-4 py-2.5">Churn pós-venda</th>
                <th className="text-right text-xs font-semibold text-slate-500 px-4 py-2.5">CAC</th>
                <th className="text-right text-xs font-semibold text-slate-500 px-4 py-2.5">ROI</th>
                <th className="text-right text-xs font-semibold text-slate-500 px-4 py-2.5">Ação</th>
              </tr>
            </thead>
            <tbody>
              {[...campaigns].sort((a, b) => {
                const aS = a.ltvChurnAdjusted ?? a.avgLtvVerified ?? a.avgLtvPredicted;
                const bS = b.ltvChurnAdjusted ?? b.avgLtvVerified ?? b.avgLtvPredicted;
                return bS - aS;
              }).map(c => {
                const color = CHANNEL_COLORS[c.channel] ?? "#64748b";
                const churnBadge = c.verifiedSampleSize >= 3
                  ? c.postSaleChurnRate > 0.3 ? "text-red-600 font-semibold"
                  : c.postSaleChurnRate > 0.15 ? "text-amber-600"
                  : "text-[#10B981]"
                  : "text-slate-400";
                return (
                  <tr key={c.id} className="border-t border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        {dot(color)}
                        <span className="text-sm font-medium text-slate-800">{c.name}</span>
                      </div>
                    </td>
                    <td className="text-right px-4 py-2.5 text-sm text-slate-700">{c.totalLeads}</td>
                    <td className="text-right px-4 py-2.5 text-sm text-slate-700">{c.conversionRate}%</td>
                    <td className="text-right px-4 py-2.5 text-sm text-slate-600">{fmtBRL(c.avgLtvPredicted)}</td>
                    <td className="text-right px-4 py-2.5 text-sm font-semibold text-slate-800">
                      {c.avgLtvVerified != null ? (
                        <span title={`${c.verifiedSampleSize} clientes reais correspondidos`}>
                          {fmtBRL(c.avgLtvVerified)}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs">
                          {c.verifiedSampleSize > 0 ? `${c.verifiedSampleSize} amostras` : "—"}
                        </span>
                      )}
                    </td>
                    <td className={`text-right px-4 py-2.5 text-sm ${churnBadge}`}>
                      {c.verifiedSampleSize >= 3
                        ? `${Math.round(c.postSaleChurnRate * 100)}%`
                        : "—"}
                    </td>
                    <td className="text-right px-4 py-2.5 text-sm text-slate-700">
                      {c.cac != null ? fmtBRL(c.cac) : (
                        <span className="text-slate-400 text-xs">sem budget</span>
                      )}
                    </td>
                    <td className="text-right px-4 py-2.5 text-sm font-bold text-[#10B981]">
                      {c.projectedRoi != null ? `${c.projectedRoi.toLocaleString("pt-BR")}%` : "—"}
                    </td>
                    <td className="text-right px-4 py-2.5">
                      <button
                        onClick={() => navigate(`/obtain/leads?source=${c.channel}`)}
                        className="text-xs text-[#10B981] hover:underline"
                      >
                        Ver →
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Row 3 — Retain bridge banner */}
      {totalMatchedCustomers > 0 && (
        <div className="bg-gradient-to-r from-[#293b83]/8 to-transparent rounded-xl px-5 py-3.5 border border-[#293b83]/20 flex items-center gap-3">
          <svg className="w-4 h-4 text-[#293b83] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <p className="text-sm text-slate-600 flex-1 leading-relaxed">
            De <strong>{totalMatchedCustomers}</strong> leads convertidos rastreáveis,{" "}
            <strong className="text-[#10B981]">{totalHealthy} clientes saudáveis</strong>,{" "}
            <strong className="text-amber-600">{totalAtRisk} em risco</strong>,{" "}
            <strong className="text-red-600">{totalChurned} churn</strong>.
            {bestPostSale && (
              <> Canal com maior sucesso pós-venda: <strong>{bestPostSale.name}</strong> ({Math.round((1 - bestPostSale.postSaleChurnRate) * 100)}% retenção).</>
            )}
          </p>
          <span className="text-[10px] bg-[#293b83] text-white px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0">Dados do Retain</span>
        </div>
      )}

      {/* Row 4 — Import budget CTA */}
      {anyNoCac && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 flex items-center gap-4">
          <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-800">CAC não disponível em {campaigns.filter(c => c.cac == null).length} canal(is)</p>
            <p className="text-xs text-amber-700 mt-0.5">Importe seus dados de investimento por campanha para calcular CAC e ROI reais.</p>
          </div>
          <button
            onClick={() => navigate("/obtain/upload")}
            className="flex-shrink-0 h-8 px-4 bg-amber-600 text-white text-xs font-semibold rounded-lg hover:bg-amber-700 transition-colors"
          >
            Importar investimento →
          </button>
        </div>
      )}
    </div>
  );
}
