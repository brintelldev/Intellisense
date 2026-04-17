import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

interface RiskDistribution {
  low: number;
  medium: number;
  high: number;
  critical: number;
}

interface Props {
  data: RiskDistribution;
}

export function RiskDistributionDonut({ data }: Props) {
  const RISK_DATA = [
    { name: "Baixo", value: data.low, color: "#64b783" },
    { name: "Médio", value: data.medium, color: "#f59e0b" },
    { name: "Alto", value: data.high, color: "#f97316" },
    { name: "Crítico", value: data.critical, color: "#ef4444" },
  ];

  const total = Object.values(data).reduce((a, b) => a + b, 0);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="bg-gradient-to-r from-[#293b83]/5 to-transparent border-b border-slate-100 px-5 py-4 flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-[#293b83]/10 flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 text-[#293b83]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
          </svg>
        </div>
        <div>
          <h3 className="font-semibold text-slate-800 text-sm">Distribuição de Risco</h3>
          <p className="text-xs text-slate-500">Clientes por nível de risco de churn</p>
        </div>
      </div>
      <div className="p-5">
      <div className="relative">
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={RISK_DATA}
              cx="50%"
              cy="50%"
              innerRadius={65}
              outerRadius={95}
              paddingAngle={2}
              dataKey="value"
            >
              {RISK_DATA.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip formatter={(v: number, name) => [v, name]} />
          </PieChart>
        </ResponsiveContainer>
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-3xl font-bold text-slate-900">{total}</span>
          <span className="text-xs text-slate-500">Total</span>
        </div>
      </div>
      {/* Legend */}
      <div className="grid grid-cols-2 gap-2 mt-2">
        {RISK_DATA.map(d => (
          <div key={d.name} className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
            <span className="text-xs text-slate-600">{d.name}: <strong>{d.value}</strong></span>
          </div>
        ))}
      </div>
      </div>
    </div>
  );
}
