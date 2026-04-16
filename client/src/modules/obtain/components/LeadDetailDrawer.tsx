import { useState, useEffect } from "react";
import { DetailDrawer } from "../../../shared/components/DetailDrawer";
import { ShapWaterfall } from "../../../shared/components/ShapWaterfall";
import { ScoreTimelineChart } from "../../../shared/components/ScoreTimelineChart";
import { ScoreBadge } from "../../../shared/components/ScoreBadge";
import { Progress } from "../../../shared/components/ui/progress";
import { Lead } from "../../../shared/types";
import { useObtainLead, useCreateLeadAction, useLeadScoreHistory } from "../../../shared/hooks/useObtain";
import { LoadingState } from "../../../shared/components/LoadingState";
import { fmtBRLShort as fmtBRL } from "../../../shared/lib/format";

interface Props {
  lead: Lead | null;
  onClose: () => void;
}

const SOURCE_LABELS: Record<string, string> = {
  referral: "Indicação", event: "Feira/Evento", paid_social: "LinkedIn Ads",
  paid_search: "Google Ads", outbound: "Outbound", email: "E-mail",
};

export function LeadDetailDrawer({ lead, onClose }: Props) {
  const [actionOpen, setActionOpen] = useState(false);
  const [actionNote, setActionNote] = useState("");
  const [actionDone, setActionDone] = useState(false);

  const { data: apiLeadData, isLoading } = useObtainLead(lead?.id ?? null);
  const { data: scoreHistory } = useLeadScoreHistory(lead?.id ?? null);
  const createLeadAction = useCreateLeadAction();

  useEffect(() => {
    setActionOpen(false);
    setActionNote("");
    setActionDone(false);
  }, [lead?.id]);

  if (!lead) return null;
  const score = apiLeadData;

  const scoreColor = lead.score >= 80 ? "#10B981" : lead.score >= 50 ? "#f59e0b" : lead.score >= 30 ? "#94a3b8" : "#ef4444";

  return (
    <DetailDrawer open={!!lead} onClose={onClose}>
      {isLoading ? <div className="p-6"><LoadingState rows={6} /></div> : (
      <div className="p-6 space-y-5">
        {/* Header */}
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl font-bold text-slate-900">{lead.name}</h2>
            <ScoreBadge tier={lead.scoreTier} />
          </div>
          <p className="text-sm text-slate-500">{lead.company} · {lead.industry} · {lead.city}/{lead.state}</p>
        </div>

        {/* Intelligence Brief */}
        {score?.narrative && (
          <div className="bg-[#10B981]/5 border border-[#10B981]/20 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-4 h-4 text-[#10B981]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="text-xs font-semibold text-[#10B981] uppercase tracking-wide">Briefing do Lead</span>
            </div>
            <p className="text-sm text-slate-700 leading-relaxed">{score.narrative}</p>
          </div>
        )}

        {/* Score cards */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-emerald-50 rounded-xl p-3 text-center border border-emerald-100">
            <p className="text-xs text-slate-500 mb-1">Score</p>
            <p className="text-3xl font-bold" style={{ color: scoreColor }}>{lead.score}</p>
            <Progress value={lead.score} color={scoreColor} className="mt-2" />
          </div>
          <div className="bg-slate-50 rounded-xl p-3 text-center">
            <p className="text-xs text-slate-500 mb-1">LTV Previsto</p>
            <p className="text-lg font-bold text-slate-900">{fmtBRL(lead.ltvPrediction)}</p>
          </div>
          <div className="bg-slate-50 rounded-xl p-3 text-center">
            <p className="text-xs text-slate-500 mb-1">Prob. Conversão</p>
            <p className="text-xl font-bold text-[#10B981]">{(lead.conversionProbability * 100).toFixed(0)}%</p>
          </div>
        </div>

        {/* Score Timeline */}
        {scoreHistory && scoreHistory.length > 0 && (
          <div className="bg-slate-50 rounded-xl p-4">
            <ScoreTimelineChart data={scoreHistory} variant="obtain" />
          </div>
        )}

        {/* SHAP Waterfall */}
        {score && (
          <div className="bg-slate-50 rounded-xl p-4">
            <h4 className="font-semibold text-slate-700 mb-4 text-sm">Fatores que influenciam a predição</h4>
            <ShapWaterfall
              factors={score.shapValues}
              baseProbability={score.baseProbability}
              finalProbability={lead.conversionProbability}
              variant="obtain"
            />
          </div>
        )}

        {/* Recommended offer */}
        {score && (
          <div className="border-l-4 border-[#10B981] bg-[#10B981]/5 rounded-r-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <h4 className="font-semibold text-[#10B981] text-sm">Oferta Recomendada</h4>
              <span className="text-xs bg-[#10B981] text-white px-2 py-0.5 rounded-full">72% de conversão neste perfil</span>
            </div>
            <p className="text-sm font-semibold text-slate-800">{score.recommendedOffer}</p>
            <p className="text-xs text-slate-600 mt-1">{score.recommendedAction}</p>
            {!actionDone && !actionOpen && (
              <button
                onClick={() => setActionOpen(true)}
                className="mt-3 h-9 px-4 bg-[#10B981] text-white text-sm font-medium rounded-lg hover:bg-[#059669] transition-colors"
              >
                Registrar ação
              </button>
            )}
            {actionOpen && !actionDone && (
              <div className="mt-3 space-y-2">
                <textarea
                  value={actionNote}
                  onChange={(e) => setActionNote(e.target.value)}
                  placeholder="Descreva a ação realizada com este lead..."
                  className="w-full text-sm border border-slate-200 rounded-lg p-3 resize-none focus:outline-none focus:ring-2 focus:ring-[#10B981]/30 focus:border-[#10B981]"
                  rows={3}
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => setActionOpen(false)}
                    className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => {
                      createLeadAction.mutate({
                        leadId: lead.id,
                        actionType: "call",
                        notes: actionNote,
                      });
                      setActionDone(true);
                      setActionOpen(false);
                    }}
                    disabled={createLeadAction.isPending}
                    className="px-4 py-1.5 text-xs bg-[#10B981] text-white rounded-lg font-medium hover:bg-[#059669] disabled:opacity-50"
                  >
                    {createLeadAction.isPending ? "Salvando..." : "Confirmar"}
                  </button>
                </div>
              </div>
            )}
            {actionDone && (
              <div className="mt-3 flex items-center gap-2">
                <button disabled className="h-9 px-4 bg-[#10B981]/30 text-[#10B981] text-sm font-medium rounded-lg cursor-not-allowed">
                  Ação registrada ✓
                </button>
                <p className="text-sm text-emerald-600">Ação gravada com sucesso no CRM</p>
              </div>
            )}
          </div>
        )}

        {/* ICP + Similar Customers */}
        {score && (score.icpCluster || score.similarCustomers) && (
          <div className="bg-slate-50 rounded-xl p-4 space-y-3">
            {score.icpCluster && (
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[#10B981]/10 flex items-center justify-center flex-shrink-0">
                  <svg className="w-3.5 h-3.5 text-[#10B981]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Cluster ICP</p>
                  <p className="text-sm font-semibold text-slate-800">{score.icpCluster}</p>
                </div>
              </div>
            )}
            {score.similarCustomers && score.similarCustomers.count > 0 && (
              <div className="border-t border-slate-200 pt-3">
                <p className="text-xs font-semibold text-slate-600 mb-2">Clientes Similares Ativos</p>
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-center">
                    <p className="text-xl font-bold text-slate-900">{score.similarCustomers.count}</p>
                    <p className="text-[10px] text-slate-500">Clientes</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xl font-bold text-slate-900">{score.similarCustomers.avgHealthScore}</p>
                    <p className="text-[10px] text-slate-500">Health Médio</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-bold text-slate-900">
                      {score.similarCustomers.avgRevenue >= 1000
                        ? `R$${(score.similarCustomers.avgRevenue / 1000).toFixed(0)}K`
                        : `R$${score.similarCustomers.avgRevenue}`}
                    </p>
                    <p className="text-[10px] text-slate-500">Receita Média</p>
                  </div>
                </div>
              </div>
            )}
            {score.channelPerformance && (
              <div className="border-t border-slate-200 pt-3 flex items-center justify-between">
                <p className="text-xs text-slate-500">Performance do Canal ({SOURCE_LABELS[lead.source ?? ""] ?? lead.source})</p>
                <div className="flex gap-3">
                  <span className="text-xs font-semibold text-slate-700">{score.channelPerformance.conversionRate}% conversão</span>
                  <span className="text-xs text-slate-500">·</span>
                  <span className="text-xs font-semibold text-slate-700">
                    {score.channelPerformance.avgLtv >= 1000000
                      ? `R$${(score.channelPerformance.avgLtv / 1000000).toFixed(1)}M LTV médio`
                      : score.channelPerformance.avgLtv >= 1000
                      ? `R$${(score.channelPerformance.avgLtv / 1000).toFixed(0)}K LTV médio`
                      : `R$${score.channelPerformance.avgLtv} LTV médio`
                    }
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Lead info */}
        <div>
          <h4 className="font-semibold text-slate-700 text-sm mb-3">Informações do Lead</h4>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Empresa", value: lead.company },
              { label: "Setor", value: lead.industry },
              { label: "Porte", value: lead.companySize },
              { label: "Cidade/UF", value: `${lead.city}/${lead.state}` },
              { label: "Telefone", value: lead.phone ?? "—" },
              { label: "E-mail", value: lead.email ?? "—" },
              { label: "Origem", value: SOURCE_LABELS[lead.source] ?? lead.source },
              { label: "Entrada", value: lead.enteredAt ?? "—" },
              { label: "Responsável", value: (lead as any).assignedTo ?? "—" },
              { label: "Última ação", value: (lead as any).lastAction ? `${(lead as any).lastAction} (${(lead as any).lastActionType ?? ""})` : "—" },
            ].map(({ label, value }) => (
              <div key={label} className="bg-slate-50 rounded-lg p-3">
                <p className="text-xs text-slate-400">{label}</p>
                <p className="text-xs font-semibold text-slate-800 mt-0.5 truncate">{value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
      )}
    </DetailDrawer>
  );
}
