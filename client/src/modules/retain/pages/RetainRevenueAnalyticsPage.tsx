import { useLocation } from "wouter";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList,
} from "recharts";
import { MetricCard } from "../../../shared/components/MetricCard";
import { EmptyState } from "../../../shared/components/EmptyState";
import { LoadingState } from "../../../shared/components/LoadingState";
import { useRetainRevenueAnalytics } from "../../../shared/hooks/useRetain";
import { fmtBRLShort, fmtBRL } from "../../../shared/lib/format";

const RISK_COLORS: Record<string, string> = {
  low: "#22c55e",
  medium: "#f59e0b",
  high: "#f97316",
  critical: "#ef4444",
};

const RISK_LABELS: Record<string, string> = {
  low: "Baixo",
  medium: "Médio",
  high: "Alto",
  critical: "Crítico",
};

function waterfallColor(category: string) {
  if (category === "Novos" || category === "Expansão") return "#22c55e";
  if (category === "Contração" || category === "Churn") return "#ef4444";
  return "#293b83";
}

export default function RetainRevenueAnalyticsPage() {
  const { data, isLoading } = useRetainRevenueAnalytics();
  const [, navigate] = useLocation();

  if (isLoading) return <LoadingState rows={8} />;

  if (!data) {
    return (
      <EmptyState
        title="Nenhum dado de receita disponível"
        description="Importe seus dados para visualizar a análise de receita."
        action={{ label: "Importar dados", onClick: () => navigate("/retain/upload") }}
      />
    );
  }

  const waterfallData = (data.waterfall ?? []).map((item: any) => ({
    ...item,
    displayValue: Math.abs(item.value),
  }));

  const revenueByRisk = (data.revenueByRisk ?? []).map((item: any) => ({
    ...item,
    label: RISK_LABELS[item.riskLevel] ?? item.riskLevel,
  }));

  return (
    <div className="space-y-6 w-full">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-slate-900">Revenue Analytics</h1>
          <span className="text-xs font-semibold bg-[#293b83]/10 text-[#293b83] px-2.5 py-1 rounded-full">Retain Sense</span>
        </div>
        <p className="text-sm text-slate-500 mt-0.5">Análise detalhada de receita, retenção e movimentações</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <MetricCard
          variant="retain"
          icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
          label="MRR"
          value={fmtBRL(data.mrr)}
          change={data.mrrGrowth}
          changeIsGood={true}
        />
        <MetricCard
          variant="retain"
          icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>}
          label="NRR (Net Revenue Retention)"
          value={`${data.nrr}%`}
        />
        <MetricCard
          variant="retain"
          icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" /></svg>}
          label="GRR (Gross Revenue Retention)"
          value={`${data.grr}%`}
        />
        <MetricCard
          variant="retain"
          icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>}
          label="Crescimento MRR"
          value={`${data.mrrGrowth > 0 ? "+" : ""}${data.mrrGrowth}%`}
          change={data.mrrGrowth}
          changeIsGood={true}
        />
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="bg-gradient-to-r from-[#293b83]/5 to-transparent border-b border-slate-100 px-5 py-4 flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#293b83]/10 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-[#293b83]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-800">Waterfall de Receita</h2>
              <p className="text-xs text-slate-500">Variação de MRR por categoria</p>
            </div>
          </div>
          <div className="p-5">
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={waterfallData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="category" tick={{ fontSize: 11, fill: "#64748b" }} />
              <YAxis tick={{ fontSize: 11, fill: "#64748b" }} tickFormatter={(v) => fmtBRLShort(Math.abs(v))} />
              <Tooltip
                formatter={(val: number, _name: string, props: any) => {
                  const original = props.payload.value;
                  return [fmtBRL(original), "Valor"];
                }}
                contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }}
              />
              <Bar dataKey="displayValue" radius={[4, 4, 0, 0]}>
                {waterfallData.map((entry: any, index: number) => (
                  <Cell key={index} fill={waterfallColor(entry.category)} />
                ))}
                <LabelList dataKey="value" position="top" fontSize={10} fill="#64748b" formatter={(v: number) => fmtBRLShort(v)} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="bg-gradient-to-r from-[#293b83]/5 to-transparent border-b border-slate-100 px-5 py-4 flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#293b83]/10 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-[#293b83]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-800">Receita por Nível de Risco</h2>
              <p className="text-xs text-slate-500">MRR segmentado por risco de churn</p>
            </div>
          </div>
          <div className="p-5">
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={revenueByRisk} layout="vertical" margin={{ top: 10, right: 30, bottom: 10, left: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis type="number" tick={{ fontSize: 11, fill: "#64748b" }} tickFormatter={(v) => fmtBRLShort(v)} />
              <YAxis type="category" dataKey="label" tick={{ fontSize: 12, fill: "#475569" }} width={60} />
              <Tooltip
                formatter={(val: number) => [fmtBRL(val), "Receita"]}
                contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }}
              />
              <Bar dataKey="revenue" radius={[0, 4, 4, 0]}>
                {revenueByRisk.map((entry: any, index: number) => (
                  <Cell key={index} fill={RISK_COLORS[entry.riskLevel] ?? "#94a3b8"} />
                ))}
                <LabelList dataKey="count" position="right" fontSize={11} fill="#64748b" formatter={(v: number) => `${v} clientes`} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
