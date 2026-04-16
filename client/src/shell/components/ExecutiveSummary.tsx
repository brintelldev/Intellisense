import { useExecutiveSummary } from "../../shared/hooks/useLifecycle";
import { fmtBRLShort as fmtBRL } from "../../shared/lib/format";

const ACTION_ICONS: Record<string, string> = {
  retain: "🛡️",
  obtain: "🎯",
  renewal: "📋",
};

export function ExecutiveSummary() {
  const { data, isLoading } = useExecutiveSummary();

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 animate-pulse">
        <div className="h-4 bg-slate-100 rounded w-48 mb-3" />
        <div className="h-16 bg-slate-100 rounded mb-3" />
        <div className="h-8 bg-slate-100 rounded" />
      </div>
    );
  }

  if (!data || !data.narrative) return null;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#293b83]/8 to-[#10B981]/5 border-b border-slate-100 px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#293b83]/10 flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-[#293b83]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <span className="text-xs font-semibold text-[#293b83] uppercase tracking-wide">Briefing Semanal</span>
          <span className="text-xs text-slate-400">— Gerado em {data.generatedAt}</span>
        </div>
        <div className="flex gap-3">
          {data.stats?.mrr > 0 && (
            <div className="text-right">
              <p className="text-[10px] text-slate-400">MRR</p>
              <p className="text-xs font-bold text-slate-700">{fmtBRL(data.stats.mrr)}</p>
            </div>
          )}
          {data.stats?.nrr != null && (
            <div className="text-right">
              <p className="text-[10px] text-slate-400">NRR</p>
              <p className={`text-xs font-bold ${data.stats.nrr >= 100 ? "text-green-600" : "text-amber-600"}`}>{data.stats.nrr}%</p>
            </div>
          )}
        </div>
      </div>

      <div className="px-5 py-4 space-y-4">
        {/* Narrative */}
        <p className="text-sm text-slate-700 leading-relaxed italic">{`"${data.narrative}"`}</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Top 3 actions */}
          {data.actions?.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">⚡ {data.actions.length} Ações Prioritárias</h4>
              <div className="space-y-2">
                {data.actions.map((action: any, i: number) => (
                  <div key={i} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${action.urgency === "critical" ? "bg-red-50 border border-red-100" : "bg-slate-50 border border-slate-100"}`}>
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#293b83] text-white text-[10px] font-bold flex items-center justify-center">{i + 1}</span>
                    <span className="text-slate-700 text-xs">{ACTION_ICONS[action.type] ?? "•"} {action.description}</span>
                    {action.urgency === "critical" && (
                      <span className="ml-auto text-[10px] font-bold text-red-600 bg-red-100 px-1.5 py-0.5 rounded-full flex-shrink-0">URGENTE</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Week comparison */}
          {data.weekComparison && (
            <div>
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">📊 Semana vs Anterior</h4>
              <div className="space-y-2">
                {data.weekComparison.revenueAtRisk && (
                  <div className="flex items-center justify-between rounded-lg bg-slate-50 border border-slate-100 px-3 py-2">
                    <span className="text-xs text-slate-600">Receita em risco</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-slate-800">{fmtBRL(data.weekComparison.revenueAtRisk.current)}</span>
                      {data.weekComparison.revenueAtRisk.delta !== 0 && (
                        <span className={`text-[10px] font-medium ${data.weekComparison.revenueAtRisk.delta > 0 ? "text-red-500" : "text-green-500"}`}>
                          {data.weekComparison.revenueAtRisk.delta > 0 ? "↑" : "↓"} {fmtBRL(Math.abs(data.weekComparison.revenueAtRisk.delta))}
                        </span>
                      )}
                    </div>
                  </div>
                )}
                {data.stats && (
                  <>
                    <div className="flex items-center justify-between rounded-lg bg-slate-50 border border-slate-100 px-3 py-2">
                      <span className="text-xs text-slate-600">Clientes críticos</span>
                      <span className="text-xs font-bold text-slate-800">{data.stats.criticalCount + data.stats.highCount}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg bg-slate-50 border border-slate-100 px-3 py-2">
                      <span className="text-xs text-slate-600">Leads hot</span>
                      <span className="text-xs font-bold text-[#10B981]">{data.stats.hotLeads}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
