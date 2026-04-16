import { fmtBRLShort as fmtBRL } from "../../../shared/lib/format";

interface LeadPriority {
  leadId: string;
  name: string;
  company: string | null;
  industry: string | null;
  companySize: string | null;
  score: number;
  scoreTier: string;
  ltvPrediction: number;
  conversionProbability: number;
  topFactor: { label: string; impact: number } | null;
  recommendedAction: string;
  source: string | null;
  daysInFunnel: number;
}

interface LeadPrioritiesData {
  priorities: LeadPriority[];
  totalLtvAtStake: number;
  hotCount: number;
  warmCount: number;
  topSource: { name: string; leadCount: number } | null;
}

interface Props {
  data: LeadPrioritiesData;
  onSelectLead?: (leadId: string) => void;
}

const TIER_STYLES: Record<string, string> = {
  hot: "bg-red-100 text-red-700 border border-red-200",
  warm: "bg-orange-100 text-orange-700 border border-orange-200",
  cold: "bg-blue-100 text-blue-700 border border-blue-200",
  disqualified: "bg-slate-100 text-slate-500",
};

const TIER_LABELS: Record<string, string> = {
  hot: "🔥 Hot",
  warm: "🌡 Warm",
  cold: "❄ Cold",
  disqualified: "Desqualif.",
};

export function LeadPrioritiesCard({ data, onSelectLead }: Props) {
  const { priorities, totalLtvAtStake, hotCount, warmCount, topSource } = data;

  if (priorities.length === 0) return null;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#10B981]/5 to-transparent border-b border-slate-100 px-5 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#10B981]/10 flex items-center justify-center">
              <svg className="w-4 h-4 text-[#10B981]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <h2 className="font-bold text-slate-900 text-sm">Leads Prontos Para Agir</h2>
              <p className="text-xs text-slate-500">Maiores oportunidades de conversão agora</p>
            </div>
          </div>
        </div>

        {/* Banner stats */}
        <div className="flex flex-wrap gap-4 mt-3">
          {totalLtvAtStake > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#10B981]" />
              <span className="text-xs text-slate-600 font-medium">
                {totalLtvAtStake >= 1_000_000
                  ? `R$${(totalLtvAtStake / 1_000_000).toFixed(1)}M`
                  : `R$${(totalLtvAtStake / 1_000).toFixed(0)}K`
                } em LTV potencial
              </span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-xs text-slate-600 font-medium">{hotCount} hot · {warmCount} warm</span>
          </div>
          {topSource && (
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#293b83]" />
              <span className="text-xs text-slate-600 font-medium">Melhor canal: {topSource.name}</span>
            </div>
          )}
        </div>
      </div>

      {/* Lead cards */}
      <div className="divide-y divide-slate-50">
        {priorities.map((p) => (
          <div
            key={p.leadId}
            className="px-5 py-4 hover:bg-slate-50/50 transition-colors cursor-pointer"
            onClick={() => onSelectLead?.(p.leadId)}
          >
            <div className="flex items-start gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-slate-900 text-sm">{p.name}</span>
                  {p.company && <span className="text-xs text-slate-400">{p.company}</span>}
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${TIER_STYLES[p.scoreTier] ?? "bg-slate-100 text-slate-500"}`}>
                    {TIER_LABELS[p.scoreTier] ?? p.scoreTier}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  LTV: <strong className="text-slate-700">{fmtBRL(p.ltvPrediction)}</strong> · Conversão: <strong className="text-slate-700">{Math.round(p.conversionProbability * 100)}%</strong>
                  {p.industry && ` · ${p.industry}`}
                  {p.daysInFunnel > 0 && ` · ${p.daysInFunnel}d no funil`}
                </p>
                {p.topFactor && (
                  <p className="text-xs text-slate-500 mt-1">
                    <span className="font-medium text-slate-700">✅ {p.topFactor.label}</span>
                  </p>
                )}
                <p className="text-xs text-[#10B981] font-medium mt-1 line-clamp-1">
                  → {p.recommendedAction}
                </p>
              </div>
              <svg className="w-4 h-4 text-slate-300 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
