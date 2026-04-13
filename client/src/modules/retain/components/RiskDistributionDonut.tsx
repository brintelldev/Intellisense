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
    <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
      <h3 className="font-semibold text-slate-800 mb-4">Distribuição de Risco</h3>
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
  );
}
