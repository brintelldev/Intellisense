import { useLocation } from "wouter";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LineChart, Line, Legend, LabelList } from "recharts";
import { MetricCard } from "../../../shared/components/MetricCard";
import { EmptyState } from "../../../shared/components/EmptyState";
import { LoadingState } from "../../../shared/components/LoadingState";
import { useRetainChurnCauses, useRetainAnalyticsTrend } from "../../../shared/hooks/useRetain";

const CATEGORY_COLORS: Record<string, string> = {
  "Financeiro": "#ef4444",
  "Contratual": "#f97316",
  "Engajamento": "#f59e0b",
  "Suporte": "#3b82f6",
  "Satisfação": "#8b5cf6",
  "Uso": "#6b7280",
};

import { fmtBRLShort as fmtBRL } from "../../../shared/lib/format";

export default function RetainRootCausesPage() {
  const { data: apiCauses, isLoading } = useRetainChurnCauses();
  const { data: trendData } = useRetainAnalyticsTrend();
  const [, navigate] = useLocation();

  if (isLoading) return <LoadingState rows={6} />;

  // API returns either a plain array (legacy) or { causes, summary } (new shape)
  const isNewShape = apiCauses && !Array.isArray(apiCauses) && "causes" in (apiCauses as any);
  const churnCauses: any[] = isNewShape ? (apiCauses as any).causes : (apiCauses ?? []);
  const summary = isNewShape ? (apiCauses as any).summary : null;

  if (churnCauses.length === 0) {
    return (
      <EmptyState
        title="Nenhuma causa raiz identificada"
        description="Importe dados de clientes para que o modelo identifique as causas de churn."
        action={{ label: "Importar dados", onClick: () => navigate("/retain/upload") }}
      />
    );
  }

  const totalRevAtRisk = churnCauses.reduce((a: number, c: any) => a + c.revenueAtRisk, 0);
  const totalAffected = churnCauses.reduce((a: number, c: any) => a + c.affectedCustomers, 0);
  const topCause = churnCauses[0];
  const totalAtRisk: number = summary?.totalAtRisk ?? 0;
  const revenueAtRiskChange: number = summary?.revenueAtRiskChange ?? 0;

  return (
    <div className="space-y-6 w-full">
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-bold text-slate-900">Análise de Causas Raiz</h1>
        <span className="text-xs font-semibold bg-[#293b83]/10 text-[#293b83] px-2.5 py-1 rounded-full">Retain Sense</span>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <MetricCard
          variant="retain"
          icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
          label="Clientes em Alto Risco"
          value={String(totalAtRisk)}
        />
        <MetricCard
          variant="retain"
          icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0V9m0-2l-8 8-4-4-6 6" /></svg>}
          label="Principal Causa"
          value={topCause.cause}
        />
        <MetricCard
          variant="retain"
          icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8V7m0 9v1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
          label="Receita Total Perdida"
          value={fmtBRL(totalRevAtRisk)}
          change={revenueAtRiskChange}
          changeIsGood={false}
        />
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Causes table */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="bg-gradient-to-r from-[#293b83]/5 to-transparent border-b border-slate-100 px-5 py-4 flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#293b83]/10 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-[#293b83]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-800">Causas de Churn</h3>
              <p className="text-xs text-slate-500">Ordenadas por impacto no churn</p>
            </div>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                {["Causa", "Categoria", "Impacto", "Afetados", "Receita em Risco", "Tend."].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {churnCauses.map(cause => (
                <tr key={cause.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-800 text-xs">{cause.cause}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[cause.category] + "20", color: CATEGORY_COLORS[cause.category] }}>
                      {cause.category}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${cause.impactPct}%`, backgroundColor: CATEGORY_COLORS[cause.category] ?? "#293b83" }}
                        />
                      </div>
                      <span className="font-bold text-slate-800 tabular-nums text-xs">{cause.impactPct}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600 tabular-nums">{cause.affectedCustomers}</td>
                  <td className="px-4 py-3 font-medium text-slate-700 tabular-nums">{fmtBRL(cause.revenueAtRisk)}</td>
                  <td className="px-4 py-3">
                    {cause.trend === "up" && (
                      <span className="text-red-500 font-bold text-sm" title="Aumentando">↑</span>
                    )}
                    {cause.trend === "down" && (
                      <span className="text-green-600 font-bold text-sm" title="Diminuindo">↓</span>
                    )}
                    {(cause.trend === "stable" || !cause.trend) && (
                      <span className="text-slate-400 font-bold text-sm" title="Estável">→</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-50 border-t-2 border-slate-200">
              <tr>
                <td className="px-4 py-2.5 text-xs font-semibold text-slate-600" colSpan={3}>Total</td>
                <td className="px-4 py-2.5 text-xs font-bold text-slate-800 tabular-nums">{totalAffected}</td>
                <td className="px-4 py-2.5 text-xs font-bold text-slate-800 tabular-nums">{fmtBRL(totalRevAtRisk)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Impact bar chart */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="bg-gradient-to-r from-[#293b83]/5 to-transparent border-b border-slate-100 px-5 py-4 flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#293b83]/10 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-[#293b83]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-800">Impacto por Causa</h3>
              <p className="text-xs text-slate-500">Percentual de churn atribuído a cada causa</p>
            </div>
          </div>
          <div className="p-5">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={churnCauses} layout="vertical" margin={{ top: 0, right: 40, bottom: 0, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
                <YAxis dataKey="cause" type="category" tick={{ fontSize: 11 }} width={130} />
                <Tooltip formatter={(v: number) => [`${v}%`, "Impacto"]} />
                <Bar dataKey="impactPct" radius={[0, 6, 6, 0]} maxBarSize={24}>
                  {churnCauses.map((c) => (
                    <Cell key={c.id} fill={CATEGORY_COLORS[c.category] ?? "#293b83"} />
                  ))}
                  <LabelList dataKey="impactPct" position="right" fontSize={11} fill="#64748b" formatter={(v: number) => `${v}%`} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Revenue at Risk Trend - full width */}
      {(trendData as any[] | undefined ?? []).length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="bg-gradient-to-r from-[#293b83]/5 to-transparent border-b border-slate-100 px-5 py-4 flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#293b83]/10 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-[#293b83]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0V9m0-2l-8 8-4-4-6 6" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-800">Evolução da Receita em Risco</h3>
              <p className="text-xs text-slate-500">Receita exposta a risco alto/crítico ao longo do tempo</p>
            </div>
          </div>
          <div className="p-5">
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={trendData as any[]} margin={{ top: 5, right: 20, bottom: 0, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => fmtBRL(v)} width={80} />
                <Tooltip
                  formatter={(v: number) => [fmtBRL(v), "Receita em Risco"]}
                  contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }}
                />
                <Line
                  type="monotone"
                  dataKey="revenueAtRisk"
                  stroke="#293b83"
                  strokeWidth={2.5}
                  dot={{ fill: "#293b83", r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
