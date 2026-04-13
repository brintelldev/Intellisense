import { useState, useEffect } from "react";
import { DetailDrawer } from "../../../shared/components/DetailDrawer";
import { ShapWaterfall } from "../../../shared/components/ShapWaterfall";
import { ScoreBadge } from "../../../shared/components/ScoreBadge";
import { Progress } from "../../../shared/components/ui/progress";
import { Lead } from "../../../data/types";
import { useObtainLead, useCreateLeadAction } from "../../../shared/hooks/useObtain";
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

        {/* ICP Match */}
        {score && (
          <div className="bg-slate-50 rounded-xl p-4">
            <h4 className="font-semibold text-slate-700 text-sm mb-3">Match de ICP</h4>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-800">{score.icpCluster}</p>
                <Progress value={score.icpMatch * 100} color="#10B981" className="mt-2" />
              </div>
              <span className="text-xl font-bold text-[#10B981]">{(score.icpMatch * 100).toFixed(0)}%</span>
            </div>
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
