import { useLocation } from "wouter";

interface TopLead {
  id: string;
  name: string;
  company: string | null;
  score: number;
  ltvPrediction: number;
}

interface TopCustomer {
  id: string;
  name: string;
  mrr: number;
  healthScore: number;
}

interface IcpCluster {
  id: string;
  name: string;
  description: string;
  type: string;
  rank: number;
  avgLtv: number;
  avgCac: number;
  avgConversionRate: number;
  churnRate: number;
  leadsInFunnel: number;
  avgTicket: number;
  dominantSource: string | null;
  topLeads: TopLead[];
  topCustomers: TopCustomer[];
  insight: string;
  characteristics: any;
}

interface Props {
  cluster: IcpCluster;
  /** Baseline averages across all clusters for contrast comparison */
  baseline: { avgLtv: number; churnRate: number; avgConversionRate: number };
}

const fmtBRL = (v: number) => v >= 1_000_000 ? `R$${(v / 1_000_000).toFixed(1)}M` : `R$${Math.round(v / 1_000)}K`;
const fmtPct = (v: number) => `${(v * 100).toFixed(1)}%`;

function downloadLeadsCSV(cluster: IcpCluster) {
  const rows = [
    ["Nome", "Empresa", "Score", "LTV Previsto"],
    ...cluster.topLeads.map(l => [l.name, l.company ?? "", String(l.score), fmtBRL(l.ltvPrediction)]),
  ];
  const csv = rows.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `icp_${cluster.characteristics?.industry ?? "cluster"}_leads.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function ICPHeroCard({ cluster, baseline }: Props) {
  const [, navigate] = useLocation();
  const industry = cluster.characteristics?.industry as string | undefined;

  // Contrast multipliers vs baseline
  const ltvMultiple = baseline.avgLtv > 0 ? Math.round((cluster.avgLtv / baseline.avgLtv) * 10) / 10 : null;
  const churnReduction = baseline.churnRate > 0 ? Math.round((1 - cluster.churnRate / baseline.churnRate) * 100) : null;
  const convBoost = baseline.avgConversionRate > 0
    ? Math.round((cluster.avgConversionRate / baseline.avgConversionRate - 1) * 100)
    : null;

  const kpis = [
    { label: "LTV Médio", value: fmtBRL(cluster.avgLtv), color: "#10B981" },
    { label: "CAC", value: cluster.avgCac ? fmtBRL(cluster.avgCac) : "—", color: "#64748b" },
    { label: "Conversão", value: fmtPct(cluster.avgConversionRate), color: "#10B981" },
    { label: "Churn Mensal", value: fmtPct(cluster.churnRate), color: cluster.churnRate < 0.05 ? "#10B981" : "#f59e0b" },
    { label: "Leads no funil", value: String(cluster.leadsInFunnel), color: "#293b83" },
    { label: "Ticket Médio", value: cluster.avgTicket ? fmtBRL(cluster.avgTicket) : "—", color: "#64748b" },
  ];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-[#10B981]/30 overflow-hidden">
      {/* Header bar */}
      <div className="bg-gradient-to-r from-[#10B981]/10 via-[#10B981]/5 to-transparent border-b border-[#10B981]/20 px-6 py-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#10B981]/15 flex items-center justify-center flex-shrink-0">
          <svg className="w-5 h-5 text-[#10B981]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-bold bg-[#10B981] text-white px-2.5 py-0.5 rounded-full uppercase tracking-wide">
              🏆 Seu Perfil Campeão
            </span>
            {cluster.dominantSource && (
              <span className="text-[10px] font-medium bg-[#293b83]/10 text-[#293b83] px-2 py-0.5 rounded-full">
                Canal: {cluster.dominantSource}
              </span>
            )}
          </div>
          <h2 className="text-lg font-bold text-slate-900 mt-0.5 truncate">{cluster.name}</h2>
        </div>
      </div>

      <div className="p-6 space-y-5">
        {/* Description */}
        <p className="text-sm text-slate-500 leading-relaxed">{cluster.description}</p>

        {/* Contrast KPIs strip */}
        {(ltvMultiple !== null || churnReduction !== null) && (
          <div className="grid grid-cols-3 gap-3">
            {ltvMultiple !== null && ltvMultiple > 1 && (
              <div className="text-center p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                <p className="text-2xl font-extrabold text-emerald-600">{ltvMultiple}×</p>
                <p className="text-[10px] text-slate-500 mt-0.5">LTV vs média</p>
              </div>
            )}
            {churnReduction !== null && churnReduction > 0 && (
              <div className="text-center p-3 bg-blue-50 rounded-xl border border-blue-100">
                <p className="text-2xl font-extrabold text-blue-600">{churnReduction}%</p>
                <p className="text-[10px] text-slate-500 mt-0.5">Menos churn</p>
              </div>
            )}
            {convBoost !== null && convBoost > 0 && (
              <div className="text-center p-3 bg-violet-50 rounded-xl border border-violet-100">
                <p className="text-2xl font-extrabold text-violet-600">+{convBoost}%</p>
                <p className="text-[10px] text-slate-500 mt-0.5">Conversão</p>
              </div>
            )}
          </div>
        )}

        {/* 6 KPIs grid */}
        <div className="grid grid-cols-6 gap-2">
          {kpis.map(kpi => (
            <div key={kpi.label} className="bg-slate-50 rounded-lg p-2.5 text-center border border-slate-100">
              <p className="text-[10px] text-slate-400 mb-0.5 leading-tight">{kpi.label}</p>
              <p className="text-sm font-bold" style={{ color: kpi.color }}>{kpi.value}</p>
            </div>
          ))}
        </div>

        {/* Top leads + top customers */}
        <div className="grid grid-cols-2 gap-4">
          {/* Top leads */}
          {cluster.topLeads.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">Principais leads</p>
              <div className="flex flex-wrap gap-1.5">
                {cluster.topLeads.map(lead => (
                  <span
                    key={lead.id}
                    className="text-xs bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/20 px-2.5 py-1 rounded-full font-medium cursor-pointer hover:bg-[#10B981]/20 transition-colors"
                    onClick={() => navigate(`/obtain/leads`)}
                    title={`Score: ${lead.score} · LTV: ${fmtBRL(lead.ltvPrediction)}`}
                  >
                    {lead.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Top customers */}
          {cluster.topCustomers.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">Clientes ativos</p>
              <div className="flex flex-wrap gap-1.5">
                {cluster.topCustomers.map(cust => (
                  <span
                    key={cust.id}
                    className="text-xs bg-[#293b83]/10 text-[#293b83] border border-[#293b83]/20 px-2.5 py-1 rounded-full font-medium cursor-pointer hover:bg-[#293b83]/20 transition-colors"
                    onClick={() => navigate(`/retain/customers`)}
                    title={`Health: ${cust.healthScore}/100 · MRR: ${fmtBRL(cust.mrr)}`}
                  >
                    {cust.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Insight */}
        {cluster.insight && (
          <div className="flex items-start gap-2.5 p-3 bg-[#10B981]/5 rounded-lg border border-[#10B981]/15">
            <svg className="w-4 h-4 text-[#10B981] mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <p className="text-xs text-slate-700 leading-relaxed">{cluster.insight}</p>
          </div>
        )}

        {/* CTAs */}
        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={() => navigate(industry ? `/obtain/leads?industry=${encodeURIComponent(industry)}` : "/obtain/leads")}
            className="flex-1 flex items-center justify-center gap-1.5 h-9 bg-[#10B981] text-white text-xs font-semibold rounded-lg hover:bg-[#0ea572] transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Ver leads ({cluster.leadsInFunnel})
          </button>
          <button
            onClick={() => navigate(industry ? `/retain/customers?segment=${encodeURIComponent(industry)}` : "/retain/customers")}
            className="flex-1 flex items-center justify-center gap-1.5 h-9 bg-[#293b83] text-white text-xs font-semibold rounded-lg hover:bg-[#1e2d6a] transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            Ver clientes ({cluster.topCustomers.length > 0 ? cluster.characteristics?.customerCount ?? "—" : "—"})
          </button>
          {cluster.topLeads.length > 0 && (
            <button
              onClick={() => downloadLeadsCSV(cluster)}
              className="flex items-center justify-center gap-1.5 h-9 px-3 border border-slate-200 text-slate-600 text-xs font-medium rounded-lg hover:bg-slate-50 transition-colors"
              title="Baixar CSV com leads deste perfil"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              CSV
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
