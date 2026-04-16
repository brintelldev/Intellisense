import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";
import { fmtBRL } from "../../../shared/lib/format";

interface RevenueProjection {
  current: number;
  months: Array<{
    month: number;
    pessimistic: number;
    withRetention: number;
    optimistic: number;
  }>;
}

interface Props {
  projection: RevenueProjection;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3 text-xs">
      <p className="font-semibold text-slate-700 mb-2">{label}</p>
      {payload.map((entry: any) => (
        <div key={entry.name} className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-slate-600">{entry.name}:</span>
          <span className="font-semibold text-slate-800">{fmtBRL(entry.value)}</span>
        </div>
      ))}
    </div>
  );
};

export function RevenueProjectionCard({ projection }: Props) {
  const { current, months } = projection;

  const chartData = [
    { label: "Hoje", pessimistic: current, withRetention: current, optimistic: current },
    ...months.map(m => ({
      label: `${m.month}d`,
      pessimistic: m.pessimistic,
      withRetention: m.withRetention,
      optimistic: m.optimistic,
    })),
  ];

  const last = months[months.length - 1];
  const pessimisticPct = current > 0 ? Math.round(((last.pessimistic - current) / current) * 100) : 0;
  const withRetentionPct = current > 0 ? Math.round(((last.withRetention - current) / current) * 100) : 0;
  const optimisticPct = current > 0 ? Math.round(((last.optimistic - current) / current) * 100) : 0;

  const savedRevenue = last.withRetention - last.pessimistic;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-50 to-transparent border-b border-slate-100 px-5 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
              <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
              </svg>
            </div>
            <div>
              <h2 className="font-bold text-slate-900 text-sm">Projeção de Receita — 90 dias</h2>
              <p className="text-xs text-slate-500">3 cenários baseados na base atual</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-400">MRR Atual</p>
            <p className="text-sm font-bold text-slate-900">{fmtBRL(current)}</p>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="px-5 pt-4">
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={chartData} margin={{ top: 5, right: 10, bottom: 0, left: 10 }}>
            <defs>
              <linearGradient id="pesGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="retGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="optGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#293b83" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#293b83" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} />
            <YAxis
              tick={{ fontSize: 10 }}
              tickFormatter={(v: number) =>
                v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : `${Math.round(v / 1000)}K`
              }
            />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="pessimistic" name="Sem ação" stroke="#ef4444" fill="url(#pesGrad)" strokeWidth={1.5} strokeDasharray="4 4" />
            <Area type="monotone" dataKey="withRetention" name="Com retenção" stroke="#10b981" fill="url(#retGrad)" strokeWidth={2} />
            <Area type="monotone" dataKey="optimistic" name="Com expansão" stroke="#293b83" fill="url(#optGrad)" strokeWidth={1.5} strokeDasharray="2 2" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Scenario summary */}
      <div className="px-5 py-4 grid grid-cols-3 gap-3">
        <div className="bg-red-50 rounded-lg p-3 text-center border border-red-100">
          <p className="text-[10px] text-slate-500 mb-1">Sem ação (90d)</p>
          <p className="text-sm font-bold text-red-600">{fmtBRL(last.pessimistic)}</p>
          <p className="text-[10px] text-red-500 font-medium">{pessimisticPct}%</p>
        </div>
        <div className="bg-green-50 rounded-lg p-3 text-center border border-green-100">
          <p className="text-[10px] text-slate-500 mb-1">Com retenção (90d)</p>
          <p className="text-sm font-bold text-green-600">{fmtBRL(last.withRetention)}</p>
          <p className="text-[10px] text-green-500 font-medium">{withRetentionPct > 0 ? "+" : ""}{withRetentionPct}%</p>
        </div>
        <div className="bg-blue-50 rounded-lg p-3 text-center border border-blue-100">
          <p className="text-[10px] text-slate-500 mb-1">Com expansão (90d)</p>
          <p className="text-sm font-bold text-[#293b83]">{fmtBRL(last.optimistic)}</p>
          <p className="text-[10px] text-[#293b83] font-medium">{optimisticPct > 0 ? "+" : ""}{optimisticPct}%</p>
        </div>
      </div>

      {savedRevenue > 0 && (
        <div className="px-5 pb-4">
          <div className="bg-amber-50 rounded-lg p-3 border border-amber-100">
            <p className="text-xs text-amber-700">
              💡 Agir nos clientes prioritários pode preservar <strong>{fmtBRL(savedRevenue)}/mês</strong> nos próximos 90 dias vs. cenário sem ação.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
