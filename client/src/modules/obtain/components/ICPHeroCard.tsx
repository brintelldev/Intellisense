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
  topLeads?: TopLead[];
  topCustomers?: TopCustomer[];
  insight?: string;
  characteristics: any;
}

interface Props {
  cluster: IcpCluster;
  baseline: { avgLtv: number; churnRate: number; avgConversionRate: number };
}

const fmtBRL = (v: number) =>
  v >= 1_000_000 ? `R$${(v / 1_000_000).toFixed(1)}M` : `R$${Math.round(v / 1_000)}K`;

function downloadLeadsCSV(cluster: IcpCluster) {
  const topLeads = cluster.topLeads ?? [];
  const rows = [
    ["Nome", "Empresa", "Score", "LTV Previsto"],
    ...topLeads.map(l => [l.name, l.company ?? "", String(l.score), fmtBRL(l.ltvPrediction)]),
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
  const safeTopLeads: TopLead[]    = cluster.topLeads    ?? [];
  const safeTopCustomers: TopCustomer[] = cluster.topCustomers ?? [];

  // Contrast vs baseline — only show when the difference is both meaningful AND bounded.
  // Avoid showing "-100%" when champion has 0% churn (looks like a bug).
  const ltvMultiple = (baseline.avgLtv > 0 && cluster.avgLtv > baseline.avgLtv)
    ? Math.round((cluster.avgLtv / baseline.avgLtv) * 10) / 10 : null;

  const rawChurnRed = (baseline.churnRate > 0.005 && cluster.churnRate < baseline.churnRate)
    ? Math.round((1 - cluster.churnRate / baseline.churnRate) * 100) : null;
  // Cap between 5% and 89% so we never show -100% or trivial values
  const churnReduction = rawChurnRed !== null && rawChurnRed >= 5 && rawChurnRed <= 89
    ? rawChurnRed : null;

  const rawConv = (baseline.avgConversionRate > 0.005 && cluster.avgConversionRate > baseline.avgConversionRate)
    ? Math.round((cluster.avgConversionRate / baseline.avgConversionRate - 1) * 100) : null;
  const convBoost = rawConv !== null && rawConv >= 5 ? rawConv : null;

  const contrastItems = [
    ltvMultiple !== null && ltvMultiple > 1.05 && { value: `${ltvMultiple}×`, label: "LTV vs média",  color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-100" },
    churnReduction !== null                     && { value: `-${churnReduction}%`, label: "Menos churn", color: "text-blue-600",   bg: "bg-blue-50 border-blue-100"      },
    convBoost !== null                          && { value: `+${convBoost}%`,  label: "Conversão",   color: "text-violet-600",  bg: "bg-violet-50 border-violet-100"  },
  ].filter(Boolean) as { value: string; label: string; color: string; bg: string }[];

  // Show "—" instead of 0% for metrics that are likely absent rather than genuinely zero
  const fmtRate = (v: number, decimals = 0) =>
    v < 0.0001 ? "—" : `${(v * 100).toFixed(decimals)}%`;

  const kpis = [
    { label: "LTV Médio",   value: fmtBRL(cluster.avgLtv)                         },
    { label: "Conversão",   value: fmtRate(cluster.avgConversionRate)              },
    { label: "Churn/mês",   value: fmtRate(cluster.churnRate, 1)                  },
    { label: "Leads funil", value: String(cluster.leadsInFunnel)                  },
    { label: "Ticket",      value: cluster.avgTicket > 0 ? fmtBRL(cluster.avgTicket) : "—" },
    { label: "Canal",       value: cluster.dominantSource ?? "—"                  },
  ];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-[#10B981]/25 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#10B981]/8 to-transparent border-b border-[#10B981]/15 px-5 py-3.5 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-[#10B981]/12 flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 text-[#10B981]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold bg-[#10B981] text-white px-2 py-0.5 rounded-full uppercase tracking-wide">
              🏆 Perfil Campeão
            </span>
          </div>
          <h2 className="text-base font-bold text-slate-900 truncate">{cluster.name}</h2>
        </div>
      </div>

      <div className="p-5 grid grid-cols-3 gap-5">
        {/* Left column: description + KPIs + chips */}
        <div className="col-span-2 space-y-3.5">
          <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">{cluster.description}</p>

          {/* KPIs: 3+3 grid */}
          <div className="grid grid-cols-3 gap-2">
            {kpis.map(kpi => (
              <div key={kpi.label} className="bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">
                <p className="text-[10px] text-slate-400">{kpi.label}</p>
                <p className="text-sm font-bold text-slate-800 truncate">{kpi.value}</p>
              </div>
            ))}
          </div>

          {/* Lead + customer chips */}
          <div className="space-y-2">
            {safeTopLeads.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide whitespace-nowrap">Leads:</span>
                {safeTopLeads.map(lead => (
                  <button
                    key={lead.id}
                    onClick={() => navigate(industry ? `/obtain/leads?industry=${encodeURIComponent(industry)}` : "/obtain/leads")}
                    className="text-xs bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/20 px-2 py-0.5 rounded-full font-medium hover:bg-[#10B981]/20 transition-colors"
                    title={`Score: ${lead.score} · LTV: ${fmtBRL(lead.ltvPrediction)}`}
                  >
                    {lead.name}
                  </button>
                ))}
              </div>
            )}
            {safeTopCustomers.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide whitespace-nowrap">Clientes:</span>
                {safeTopCustomers.map(cust => (
                  <button
                    key={cust.id}
                    onClick={() => navigate("/retain/customers")}
                    className="text-xs bg-[#293b83]/10 text-[#293b83] border border-[#293b83]/20 px-2 py-0.5 rounded-full font-medium hover:bg-[#293b83]/20 transition-colors"
                    title={`Health: ${cust.healthScore}/100 · MRR: ${fmtBRL(cust.mrr)}`}
                  >
                    {cust.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right column: contrast stats + insight + CTAs */}
        <div className="flex flex-col gap-3">
          {/* Contrast badges */}
          {contrastItems.length > 0 && (
            <div className="space-y-2">
              {contrastItems.map(item => (
                <div key={item.label} className={`rounded-lg p-2.5 border ${item.bg} text-center`}>
                  <p className={`text-xl font-extrabold ${item.color}`}>{item.value}</p>
                  <p className="text-[10px] text-slate-500">{item.label}</p>
                </div>
              ))}
            </div>
          )}

          {/* Insight */}
          {cluster.insight && (
            <div className="flex-1 flex items-start gap-1.5 p-2.5 bg-[#10B981]/5 rounded-lg border border-[#10B981]/15 text-xs text-slate-600 leading-relaxed">
              <svg className="w-3.5 h-3.5 text-[#10B981] mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              {cluster.insight}
            </div>
          )}

          {/* CTAs */}
          <div className="flex flex-col gap-1.5 mt-auto">
            <button
              onClick={() => navigate(industry ? `/obtain/leads?industry=${encodeURIComponent(industry)}` : "/obtain/leads")}
              className="w-full flex items-center justify-center gap-1.5 h-8 bg-[#10B981] text-white text-xs font-semibold rounded-lg hover:bg-[#0ea572] transition-colors"
            >
              Ver leads ({cluster.leadsInFunnel}) →
            </button>
            <button
              onClick={() => navigate("/retain/customers")}
              className="w-full flex items-center justify-center gap-1.5 h-8 bg-[#293b83] text-white text-xs font-semibold rounded-lg hover:bg-[#1e2d6a] transition-colors"
            >
              Ver clientes ({cluster.characteristics?.customerCount ?? "—"}) →
            </button>
            {safeTopLeads.length > 0 && (
              <button
                onClick={() => downloadLeadsCSV(cluster)}
                className="w-full flex items-center justify-center gap-1.5 h-8 border border-slate-200 text-slate-600 text-xs font-medium rounded-lg hover:bg-slate-50 transition-colors"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Baixar CSV
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
