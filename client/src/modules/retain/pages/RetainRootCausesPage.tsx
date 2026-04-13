import { useLocation } from "wouter";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LineChart, Line, Legend } from "recharts";
import { MetricCard } from "../../../shared/components/MetricCard";
import { EmptyState } from "../../../shared/components/EmptyState";
import { LoadingState } from "../../../shared/components/LoadingState";
import { useRetainChurnCauses } from "../../../shared/hooks/useRetain";

const CATEGORY_COLORS: Record<string, string> = {
  "Financeiro": "#ef4444",
  "Contratual": "#f97316",
  "Engajamento": "#f59e0b",
  "Suporte": "#3b82f6",
  "Satisfação": "#8b5cf6",
  "Uso": "#6b7280",
};

const TREND_COLORS = ["#ef4444", "#f97316", "#f59e0b", "#3b82f6"];
const TREND_KEYS = ["Financeiro", "Contratual", "Engajamento", "Suporte"];

import { fmtBRLShort as fmtBRL } from "../../../shared/lib/format";

export default function RetainRootCausesPage() {
  const { data: apiCauses, isLoading } = useRetainChurnCauses();
  const [, navigate] = useLocation();

  if (isLoading) return <LoadingState rows={6} />;

  const churnCauses = apiCauses ?? [];

  if (churnCauses.length === 0) {
    return (
      <EmptyState
        title="Nenhuma causa raiz identificada"
        description="Importe dados de clientes para que o modelo identifique as causas de churn."
        action={{ label: "Importar dados", onClick: () => navigate("/retain/upload") }}
      />
    );
  }

  const totalRevAtRisk = churnCauses.reduce((a, c) => a + c.revenueAtRisk, 0);
  const topCause = churnCauses[0];

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
          label="Empresas Churned (12 meses)"
          value="47"
        />
        <MetricCard
          variant="retain"
          icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0V9m0-2l-8 8-4-4-6 6" /></svg>}
          label="Principal Causa"
          value={topCause.cause.slice(0, 25) + "…"}
        />
        <MetricCard
          variant="retain"
          icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8V7m0 9v1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
          label="Receita Total Perdida"
          value={fmtBRL(totalRevAtRisk)}
          change={8.2}
          changeIsGood={false}
        />
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Causes table */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h3 className="font-semibold text-slate-800">Causas de Churn</h3>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                {["Causa", "Categoria", "Impacto", "Afetados", "Receita em Risco"].map(h => (
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
                      <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Impact bar chart */}
        <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
          <h3 className="font-semibold text-slate-800 mb-4">Impacto por Causa</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={churnCauses} layout="vertical" margin={{ top: 0, right: 20, bottom: 0, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
              <YAxis dataKey="category" type="category" tick={{ fontSize: 11 }} width={90} />
              <Tooltip formatter={(v: number) => [`${v}%`, "Impacto"]} />
              <Bar dataKey="impactPct" radius={[0, 6, 6, 0]}>
                {churnCauses.map((c) => (
                  <Cell key={c.id} fill={CATEGORY_COLORS[c.category] ?? "#293b83"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
