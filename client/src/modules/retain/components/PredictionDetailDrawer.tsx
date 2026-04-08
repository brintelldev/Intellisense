import { useState, useEffect } from "react";
import { DetailDrawer } from "../../../shared/components/DetailDrawer";
import { ShapWaterfall } from "../../../shared/components/ShapWaterfall";
import { RiskBadge } from "../../../shared/components/RiskBadge";
import { Progress } from "../../../shared/components/ui/progress";
import { LoadingState } from "../../../shared/components/LoadingState";
import { useRetainPrediction, useCreateRetainAction } from "../../../shared/hooks/useRetain";
import { fmtBRL } from "../../../shared/lib/format";
import { Customer } from "../../../data/types";
import { predictions as mockPredictions } from "../../../data/retain-predictions";

interface Props {
  customer: Customer | null;
  onClose: () => void;
}

export function PredictionDetailDrawer({ customer, onClose }: Props) {
  const [retentionActionDone, setRetentionActionDone] = useState(false);
  const { data: apiPrediction, isLoading } = useRetainPrediction(customer?.id ?? null);
  const createAction = useCreateRetainAction();

  useEffect(() => {
    setRetentionActionDone(false);
  }, [customer?.id]);

  if (!customer) return null;
  const prediction = apiPrediction ?? mockPredictions.find(p => p.customerId === customer.id);

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
            {customer.customerCode} · {customer.segment} · {customer.city}/{customer.state}
          </p>
        </div>

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

        {/* SHAP Waterfall */}
        {prediction && (
          <div className="bg-slate-50 rounded-xl p-4">
            <h4 className="font-semibold text-slate-700 mb-4 text-sm">Fatores que influenciam a predição</h4>
            <ShapWaterfall
              factors={prediction.shapValues}
              baseProbability={prediction.baseProbability}
              finalProbability={prediction.churnProbability}
              variant="retain"
            />
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

        {/* Customer info grid */}
        <div>
          <h4 className="font-semibold text-slate-700 text-sm mb-3">Informações do Cliente</h4>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Cidade/UF", value: `${customer.city}/${customer.state}` },
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
