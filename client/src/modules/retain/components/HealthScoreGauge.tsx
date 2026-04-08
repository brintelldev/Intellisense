import { RadialBarChart, RadialBar, ResponsiveContainer, PolarAngleAxis } from "recharts";
import { dashboardKPIs } from "../../../data/retain-analytics";

const score = dashboardKPIs.avgHealthScore;
const getColor = (s: number) => s < 40 ? "#ef4444" : s < 60 ? "#f59e0b" : s < 80 ? "#64b783" : "#10B981";

export function HealthScoreGauge() {
  const color = getColor(score);
  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
      <h3 className="font-semibold text-slate-800 mb-4">Health Score Médio</h3>
      <div className="relative flex justify-center">
        <ResponsiveContainer width="100%" height={200}>
          <RadialBarChart
            cx="50%"
            cy="65%"
            innerRadius="55%"
            outerRadius="80%"
            startAngle={180}
            endAngle={0}
            data={[{ value: score, fill: color }]}
          >
            <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
            <RadialBar dataKey="value" cornerRadius={6} background={{ fill: "#f1f5f9" }} />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="absolute bottom-8 inset-x-0 flex flex-col items-center">
          <span className="text-4xl font-bold tabular-nums" style={{ color }}>{score}</span>
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
  );
}
