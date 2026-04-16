import { useState, useEffect } from "react";
import { DetailDrawer } from "../../../shared/components/DetailDrawer";
import { ShapWaterfall } from "../../../shared/components/ShapWaterfall";
import { ScoreTimelineChart } from "../../../shared/components/ScoreTimelineChart";
import { RiskBadge } from "../../../shared/components/RiskBadge";
import { Progress } from "../../../shared/components/ui/progress";
import { LoadingState } from "../../../shared/components/LoadingState";
import {
  useRetainPrediction, useCreateRetainAction,
  useCustomerScoreHistory, useCustomerNotes, useAddCustomerNote,
  useMarkCustomerChurned,
} from "../../../shared/hooks/useRetain";
import { fmtBRL } from "../../../shared/lib/format";
import { Customer } from "../../../shared/types";

interface Props {
  customer: Customer | null;
  onClose: () => void;
}

const NOTE_TYPE_ICONS: Record<string, string> = {
  note: "📝", call: "📞", email: "📧", meeting: "🤝", action: "⚡",
};
const NOTE_TYPES = [
  { value: "note", label: "Nota" },
  { value: "call", label: "Ligação" },
  { value: "email", label: "Email" },
  { value: "meeting", label: "Reunião" },
  { value: "action", label: "Ação" },
];

export function PredictionDetailDrawer({ customer, onClose }: Props) {
  const [retentionActionDone, setRetentionActionDone] = useState(false);
  const [noteType, setNoteType] = useState("note");
  const [noteContent, setNoteContent] = useState("");
  const [shapOpen, setShapOpen] = useState(false);
  const { data: apiPrediction, isLoading } = useRetainPrediction(customer?.id ?? null);
  const { data: scoreHistory } = useCustomerScoreHistory(customer?.id ?? null);
  const { data: notes } = useCustomerNotes(customer?.id ?? null);
  const addNote = useAddCustomerNote();
  const createAction = useCreateRetainAction();
  const markChurned = useMarkCustomerChurned();

  useEffect(() => {
    setRetentionActionDone(false);
    setNoteContent("");
    setShapOpen(false);
  }, [customer?.id]);

  if (!customer) return null;
  const prediction = apiPrediction;

  const healthColor = customer.healthScore < 40 ? "#ef4444" : customer.healthScore < 60 ? "#f59e0b" : "#64b783";

  return (
    <DetailDrawer open={!!customer} onClose={onClose}>
      {isLoading ? <div className="p-6"><LoadingState rows={3} /></div> : null}
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl font-bold text-slate-900">{customer.name}</h2>
            <RiskBadge level={customer.riskLevel} />
          </div>
          <p className="text-sm text-slate-500">
            {customer.customerCode} · {customer.segment}{customer.city || customer.state ? ` · ${[customer.city, customer.state].filter(Boolean).join("/")}` : ""}
          </p>
        </div>

        {/* Intelligence Brief */}
        {prediction?.narrative && (
          <div className="bg-[#293b83]/5 border border-[#293b83]/15 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-4 h-4 text-[#293b83]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="text-xs font-semibold text-[#293b83] uppercase tracking-wide">Briefing de Inteligência</span>
            </div>
            <p className="text-sm text-slate-700 leading-relaxed">{prediction.narrative}</p>
          </div>
        )}

        {/* Segment Benchmark */}
        {prediction?.segmentBenchmark && (
          <div className="bg-slate-50 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-slate-700 text-sm">Benchmark do Segmento</h4>
              {prediction.peerRiskCount > 0 && (
                <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                  +{prediction.peerRiskCount} outros em risco neste segmento
                </span>
              )}
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                <span>Este cliente: <strong className="text-slate-700">{prediction.segmentBenchmark.customerHealth}</strong></span>
                <span>Média do segmento: <strong className="text-slate-700">{prediction.segmentBenchmark.segmentAvgHealth}</strong></span>
              </div>
              {/* Two bars */}
              <div className="space-y-1.5">
                <div>
                  <div className="flex justify-between text-[10px] text-slate-400 mb-0.5">
                    <span>{prediction.segmentBenchmark.segmentName}</span>
                    <span>{prediction.segmentBenchmark.segmentAvgHealth}/100</span>
                  </div>
                  <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div className="h-full bg-slate-400 rounded-full" style={{ width: `${prediction.segmentBenchmark.segmentAvgHealth}%` }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-[10px] text-slate-400 mb-0.5">
                    <span>{customer.name.split(" ")[0]}</span>
                    <span>{prediction.segmentBenchmark.customerHealth}/100</span>
                  </div>
                  <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${prediction.segmentBenchmark.percentDiff < -10 ? "bg-red-500" : prediction.segmentBenchmark.percentDiff < 0 ? "bg-amber-500" : "bg-emerald-500"}`}
                      style={{ width: `${prediction.segmentBenchmark.customerHealth}%` }}
                    />
                  </div>
                </div>
              </div>
              <p className={`text-xs font-medium ${prediction.segmentBenchmark.percentDiff < 0 ? "text-red-600" : "text-green-600"}`}>
                {prediction.segmentBenchmark.percentDiff < 0 ? `${Math.abs(prediction.segmentBenchmark.percentDiff)}% abaixo da média do segmento` : `${prediction.segmentBenchmark.percentDiff}% acima da média do segmento`}
              </p>
            </div>
          </div>
        )}

        {/* Score cards */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-red-50 rounded-xl p-3 text-center border border-red-100">
            <p className="text-xs text-slate-500 mb-1">Health Score</p>
            <p className="text-2xl font-bold" style={{ color: healthColor }}>{customer.healthScore}</p>
            <Progress value={customer.healthScore} color={healthColor} className="mt-2" />
          </div>
          <div className="bg-red-50 rounded-xl p-3 text-center border border-red-100">
            <p className="text-xs text-slate-500 mb-1">Prob. Churn</p>
            <p className="text-2xl font-bold text-red-600">{(customer.churnProbability * 100).toFixed(0)}%</p>
          </div>
          <div className="bg-slate-50 rounded-xl p-3 text-center">
            <p className="text-xs text-slate-500 mb-1">Valor do Contrato</p>
            <p className="text-sm font-bold text-slate-900">{fmtBRL(customer.revenue)}/mês</p>
          </div>
        </div>

        {/* SHAP Waterfall - collapsible */}
        {prediction && (
          <div className="bg-slate-50 rounded-xl overflow-hidden">
            <button
              onClick={() => setShapOpen(!shapOpen)}
              className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <span>Análise SHAP Detalhada</span>
              <svg className={`w-4 h-4 text-slate-400 transition-transform ${shapOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {shapOpen && (
              <div className="px-4 pb-4">
                <ShapWaterfall
                  factors={prediction.shapValues}
                  baseProbability={prediction.baseProbability}
                  finalProbability={prediction.churnProbability}
                  variant="retain"
                />
              </div>
            )}
          </div>
        )}

        {/* Recommended action */}
        {prediction && (
          <div className="border-l-4 border-[#293b83] bg-[#293b83]/5 rounded-r-xl p-4">
            <h4 className="font-semibold text-[#293b83] text-sm mb-2">Ação Recomendada</h4>
            <p className="text-sm text-slate-700">{prediction.recommendedAction}</p>
            <button
              onClick={() => {
                createAction.mutate({
                  customerId: customer.id,
                  type: "call",
                  description: prediction?.recommendedAction,
                  priority: "high",
                });
                setRetentionActionDone(true);
              }}
              disabled={retentionActionDone || createAction.isPending}
              className="mt-3 h-9 px-4 bg-[#293b83] text-white text-sm font-medium rounded-lg hover:bg-[#1e2d6b] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {retentionActionDone ? "Ação registrada ✓" : createAction.isPending ? "Registrando..." : "Criar ação de retenção"}
            </button>
            {retentionActionDone && (
              <p className="text-sm text-[#293b83] mt-2 font-medium">✓ Ação de Retenção Registrada: Contrato revisado</p>
            )}
          </div>
        )}

        {/* Churn action — feedback loop trigger */}
        {customer.status !== "churned" && (
          <div className="border border-red-200 rounded-xl p-4 bg-red-50/40">
            <h4 className="font-semibold text-red-700 text-sm mb-2">Confirmar Churn</h4>
            <p className="text-xs text-slate-600 mb-3">
              Marcar este cliente como churned atualiza automaticamente os clusters ICP do Obtain Sense.
            </p>
            <button
              onClick={() => { markChurned.mutate(customer.id); onClose(); }}
              disabled={markChurned.isPending}
              className="h-9 px-4 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              {markChurned.isPending ? "Processando..." : "Marcar como Churned → Recalcular ICP"}
            </button>
          </div>
        )}

        {/* Score Timeline */}
        {scoreHistory && scoreHistory.length > 0 && (
          <div className="bg-slate-50 rounded-xl p-4">
            <ScoreTimelineChart data={scoreHistory} variant="retain" />
          </div>
        )}

        {/* Customer Notes / Timeline */}
        <div>
          <h4 className="font-semibold text-slate-700 text-sm mb-3">Timeline de Interações</h4>
          <div className="flex gap-2 mb-3">
            <select
              value={noteType}
              onChange={(e) => setNoteType(e.target.value)}
              className="text-sm border border-slate-200 rounded-lg px-2 py-1.5 bg-white"
            >
              {NOTE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <input
              type="text"
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              placeholder="Adicionar nota..."
              className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-1.5"
              onKeyDown={(e) => {
                if (e.key === "Enter" && noteContent.trim() && customer) {
                  addNote.mutate({ customerId: customer.id, type: noteType, content: noteContent.trim() });
                  setNoteContent("");
                }
              }}
            />
            <button
              onClick={() => {
                if (noteContent.trim() && customer) {
                  addNote.mutate({ customerId: customer.id, type: noteType, content: noteContent.trim() });
                  setNoteContent("");
                }
              }}
              disabled={!noteContent.trim() || addNote.isPending}
              className="px-3 py-1.5 bg-[#293b83] text-white text-sm rounded-lg hover:bg-[#1e2d6b] disabled:opacity-50"
            >
              {addNote.isPending ? "..." : "+"}
            </button>
          </div>
          {notes && notes.length > 0 ? (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {notes.map((note: any) => (
                <div key={note.id} className="flex items-start gap-2 text-sm bg-slate-50 rounded-lg p-2.5">
                  <span className="text-base">{NOTE_TYPE_ICONS[note.type] ?? "📝"}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-700">{note.content}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {new Date(note.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400">Nenhuma interação registrada</p>
          )}
        </div>

        {/* Customer info grid */}
        <div>
          <h4 className="font-semibold text-slate-700 text-sm mb-3">Informações do Cliente</h4>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Cidade/UF", value: customer.city && customer.state ? `${customer.city}/${customer.state}` : customer.city || customer.state || "—" },
              { label: "Tempo de Parceria", value: `${Math.round((customer.tenureDays ?? 0) / 30)} meses` },
              { label: "Utilização de Equipamentos", value: `${customer.usageIntensity ?? "—"}%` },
              { label: "NPS", value: (customer as any).nps != null ? String((customer as any).nps) : "—" },
              { label: "Chamados Técnicos", value: `${customer.supportVolume ?? "—"} abertos` },
              { label: "Serviços contratados", value: String(customer.servicesCount ?? "—") },
              { label: "Último contato", value: (customer as any).lastContact ?? "—" },
              { label: "Tipo de contrato", value: customer.contractType ?? "—" },
            ].map(({ label, value }) => (
              <div key={label} className="bg-slate-50 rounded-lg p-3">
                <p className="text-xs text-slate-400">{label}</p>
                <p className="text-sm font-semibold text-slate-800 mt-0.5">{value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DetailDrawer>
  );
}
