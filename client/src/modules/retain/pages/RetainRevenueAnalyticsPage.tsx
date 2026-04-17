import { useLocation } from "wouter";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList,
  AreaChart, Area,
} from "recharts";
import { MetricCard } from "../../../shared/components/MetricCard";
import { EmptyState } from "../../../shared/components/EmptyState";
import { LoadingState } from "../../../shared/components/LoadingState";
import { useRetainRevenueAnalytics, useRetainAnalyticsTrend } from "../../../shared/hooks/useRetain";
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
  const { data: trendData } = useRetainAnalyticsTrend();
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

  // Derive movement cards from waterfall (indices 1-4: Novos, Expansão, Contração, Churn)
  const movements = [
    { label: "Novos Clientes", value: waterfallData[1]?.value ?? 0, icon: "👥" },
    { label: "Expansão", value: waterfallData[2]?.value ?? 0, icon: "📈" },
    { label: "Contração", value: waterfallData[3]?.value ?? 0, icon: "📉" },
    { label: "Churn Revenue", value: waterfallData[4]?.value ?? 0, icon: "⚠️" },
  ];

  const trend = (trendData as any[] | undefined) ?? [];

  return (
    <div className="space-y-6 w-full">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-slate-900">Revenue Analytics</h1>
          <span className="text-xs font-semibold bg-[#293b83]/10 text-[#293b83] px-2.5 py-1 rounded-full">Retain Sense</span>
        </div>
        <p className="text-sm text-slate-500 mt-0.5">Análise detalhada de receita, retenção e movimentações</p>
      </div>

      {/* Primary KPIs */}
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
          change={data.nrr - 100}
          changeIsGood={true}
        />
        <MetricCard
          variant="retain"
          icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" /></svg>}
          label="GRR (Gross Revenue Retention)"
          value={`${data.grr}%`}
          change={data.grr - 100}
          changeIsGood={true}
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

      {/* Movement cards */}
      <div className="grid grid-cols-4 gap-4">
        {movements.map((m) => {
          const isPositive = m.value >= 0;
          const color = isPositive ? "#22c55e" : "#ef4444";
          const bgColor = isPositive ? "#f0fdf4" : "#fef2f2";
          const textColor = isPositive ? "text-green-600" : "text-red-500";
          return (
            <div key={m.label} className="bg-white rounded-xl px-5 py-4 shadow-sm border border-slate-100">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-slate-500">{m.label}</p>
                <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ backgroundColor: bgColor }}>
                  <svg className="w-3.5 h-3.5" fill="none" stroke={color} viewBox="0 0 24 24">
                    {isPositive
                      ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                      : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    }
                  </svg>
                </div>
              </div>
              <p className={`text-xl font-bold tabular-nums ${textColor}`}>
                {isPositive && m.value > 0 ? "+" : ""}{fmtBRLShort(m.value)}
              </p>
              <div className="mt-2 h-1.5 rounded-full" style={{ backgroundColor: bgColor }}>
                <div className="h-full rounded-full" style={{ width: "100%", backgroundColor: color, opacity: 0.4 }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts row */}
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
            <ResponsiveContainer width="100%" height={280}>
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
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={revenueByRisk} layout="vertical" margin={{ top: 10, right: 90, bottom: 10, left: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis type="number" tick={{ fontSize: 11, fill: "#64748b" }} tickFormatter={(v) => fmtBRLShort(v)} />
                <YAxis type="category" dataKey="label" tick={{ fontSize: 12, fill: "#475569" }} width={60} />
                <Tooltip
                  formatter={(val: number) => [fmtBRL(val), "Receita"]}
                  contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }}
                />
                <Bar dataKey="revenue" radius={[0, 4, 4, 0]} maxBarSize={36}>
                  {revenueByRisk.map((entry: any, index: number) => (
                    <Cell key={index} fill={RISK_COLORS[entry.riskLevel] ?? "#94a3b8"} />
                  ))}
                  <LabelList dataKey="count" position="right" fontSize={11} fill="#64748b" formatter={(v: number) => `${v} cliente${v !== 1 ? "s" : ""}`} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* MRR Trend - full width */}
      {trend.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="bg-gradient-to-r from-[#293b83]/5 to-transparent border-b border-slate-100 px-5 py-4 flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#293b83]/10 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-[#293b83]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-800">Evolução do MRR</h2>
              <p className="text-xs text-slate-500">Receita recorrente mensal ao longo do tempo</p>
            </div>
          </div>
          <div className="p-5">
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={trend} margin={{ top: 5, right: 20, bottom: 0, left: 10 }}>
                <defs>
                  <linearGradient id="mrrGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#293b83" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#293b83" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#64748b" }} />
                <YAxis tick={{ fontSize: 11, fill: "#64748b" }} tickFormatter={(v) => fmtBRLShort(v)} width={80} />
                <Tooltip
                  formatter={(v: number) => [fmtBRL(v), "MRR"]}
                  contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }}
                />
                <Area
                  type="monotone"
                  dataKey="mrr"
                  stroke="#293b83"
                  strokeWidth={2.5}
                  fill="url(#mrrGrad)"
                  dot={{ fill: "#293b83", r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
