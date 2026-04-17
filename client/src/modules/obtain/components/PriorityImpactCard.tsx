/**
 * PriorityImpactCard — Item 3: Comparativo Antes/Depois da Priorização
 *
 * Shows the Pareto/ABC comparison: universe of all leads vs. priority subset,
 * so decision-makers can see the ROI of focusing on the top N leads.
 */

interface PrioritySubset {
  leads: number;
  totalLtv: number;
  ltvShare: number;
  avgConversionProb: number;
  thresholdScore: number | null;
}

interface Universe {
  leads: number;
  totalLtv: number;
  avgConversionProb: number;
}

interface PriorityImpactData {
  universe: Universe;
  priority: PrioritySubset;
  insight: string;
}

interface Props {
  data: PriorityImpactData;
}

function fmtMoney(v: number) {
  if (v >= 1_000_000_000) return `R$${(v / 1_000_000_000).toFixed(1)}B`;
  if (v >= 1_000_000) return `R$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `R$${Math.round(v / 1_000)}K`;
  return `R$${v}`;
}

export function PriorityImpactCard({ data }: Props) {
  const { universe, priority, insight } = data;

  const universeLeadPct = 100;
  const priorityLeadPct = universe.leads > 0
    ? Math.round((priority.leads / universe.leads) * 100)
    : 0;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-[#293b83]/5 to-transparent">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#293b83]/10 flex items-center justify-center">
            <svg className="w-4 h-4 text-[#293b83]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-sm">Impacto da Priorização</h3>
            <p className="text-xs text-slate-500">Foco no subset certo maximiza retorno</p>
          </div>
        </div>
      </div>

      <div className="px-5 py-4 space-y-4">
        {/* Comparison bars */}
        <div className="space-y-3">
          {/* Universe */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-xs text-slate-500 font-medium">
                Universo total ({universe.leads} leads)
              </span>
              <span className="text-xs text-slate-500">{fmtMoney(universe.totalLtv)}</span>
            </div>
            <div className="relative h-5 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-slate-300 rounded-full w-full" />
              <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-slate-600">
                100% do potencial
              </span>
            </div>
          </div>

          {/* Priority subset */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-xs font-semibold text-[#10B981]">
                Subset prioritário ({priority.leads} leads · {priorityLeadPct}%)
              </span>
              <span className="text-xs font-bold text-[#10B981]">{fmtMoney(priority.totalLtv)}</span>
            </div>
            <div className="relative h-5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#10B981] to-emerald-400 rounded-full transition-all duration-700"
                style={{ width: `${priority.ltvShare}%` }}
              />
              <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white mix-blend-overlay">
                {priority.ltvShare}% do potencial
              </span>
            </div>
          </div>
        </div>

        {/* Insight message */}
        <div className="bg-[#10B981]/5 border border-[#10B981]/15 rounded-lg px-3 py-2.5">
          <p className="text-xs text-slate-700 font-medium leading-relaxed">
            💡 {insight}
          </p>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center">
            <p className="text-lg font-bold text-[#10B981]">{priority.ltvShare}%</p>
            <p className="text-[10px] text-slate-500">do LTV no subset</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-slate-800">{priorityLeadPct}%</p>
            <p className="text-[10px] text-slate-500">dos leads</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-[#293b83]">
              {Math.round(priority.avgConversionProb * 100)}%
            </p>
            <p className="text-[10px] text-slate-500">conv. média</p>
          </div>
        </div>

        {priority.thresholdScore !== null && (
          <p className="text-[10px] text-slate-400 text-center">
            Score mínimo do subset: {priority.thresholdScore} pontos
          </p>
        )}
      </div>
    </div>
  );
}
