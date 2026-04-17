import { RadialBarChart, RadialBar, ResponsiveContainer, PolarAngleAxis } from "recharts";

const getColor = (s: number) => s < 40 ? "#ef4444" : s < 60 ? "#f59e0b" : s < 80 ? "#64b783" : "#10B981";

interface Props {
  value: number;
}

export function HealthScoreGauge({ value }: Props) {
  const color = getColor(value);
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="bg-gradient-to-r from-[#293b83]/5 to-transparent border-b border-slate-100 px-5 py-4 flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-[#293b83]/10 flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 text-[#293b83]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Health Score Médio</h3>
          <p className="text-xs text-slate-500">Saúde média da base de clientes</p>
        </div>
      </div>
      <div className="p-5">
      <div className="relative flex justify-center">
        <ResponsiveContainer width="100%" height={200}>
          <RadialBarChart
            cx="50%"
            cy="65%"
            innerRadius="55%"
            outerRadius="80%"
            startAngle={180}
            endAngle={0}
            data={[{ value, fill: color }]}
          >
            <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
            <RadialBar dataKey="value" cornerRadius={6} background={{ fill: "#f1f5f9" }} />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="absolute bottom-8 inset-x-0 flex flex-col items-center">
          <span className="text-4xl font-bold tabular-nums" style={{ color }}>{value}</span>
          <span className="text-xs text-slate-500 mt-0.5">de 100</span>
        </div>
      </div>
      {/* Zones */}
      <div className="flex justify-between text-[10px] px-4 mt-1">
        {[{ c: "#ef4444", l: "Crítico" }, { c: "#f59e0b", l: "Atenção" }, { c: "#64b783", l: "Bom" }, { c: "#10B981", l: "Ótimo" }].map(z => (
          <div key={z.l} className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: z.c }} />
            <span className="text-slate-500">{z.l}</span>
          </div>
        ))}
      </div>
      <p className="text-xs text-slate-500 text-center mt-2">Saúde média da base de Empresas</p>
      </div>
    </div>
  );
}
