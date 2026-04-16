import { useObtainWinPatterns } from "../../../shared/hooks/useObtain";

export function WinPatternsCard() {
  const { data, isLoading } = useObtainWinPatterns();

  if (isLoading || !data || data.wonCount === 0) return null;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="bg-gradient-to-r from-[#10B981]/5 to-transparent border-b border-slate-100 px-5 py-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#10B981]/10 flex items-center justify-center">
            <svg className="w-4 h-4 text-[#10B981]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h2 className="font-bold text-slate-900 text-sm">Padrões de Sucesso</h2>
            <p className="text-xs text-slate-500">Análise de {data.wonCount} leads convertidos</p>
          </div>
        </div>
      </div>

      <div className="px-5 py-4 space-y-3">
        {/* Patterns */}
        <div className="space-y-2">
          {(data.patterns ?? []).map((p: any, i: number) => (
            <div key={i} className="flex items-center gap-2 py-1.5">
              <span className="text-base flex-shrink-0">{p.icon}</span>
              <span className="text-sm text-slate-700">{p.label}</span>
            </div>
          ))}
        </div>

        {/* Insight */}
        {data.insight && (
          <div className="bg-[#10B981]/5 rounded-lg px-3 py-2.5 border border-[#10B981]/15">
            <p className="text-xs text-slate-700 leading-relaxed">
              💡 {data.insight}
              {data.comboMultiple && data.comboMultiple > 1.2 && (
                <span className="ml-1 font-semibold text-[#10B981]">{data.comboMultiple}× mais chance de converter.</span>
              )}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
