import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, CartesianGrid } from "recharts";

interface ScoreTimelinePoint {
  snapshotDate: string;
  healthScore?: number;
  churnProbability?: number;
  score?: number;
  scoreTier?: string;
  riskLevel?: string;
}

interface ScoreTimelineChartProps {
  data: ScoreTimelinePoint[];
  variant?: "retain" | "obtain";
  height?: number;
}

export function ScoreTimelineChart({ data, variant = "retain", height = 180 }: ScoreTimelineChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center text-sm text-slate-400" style={{ height }}>
        Sem histórico de score
      </div>
    );
  }

  const isRetain = variant === "retain";
  const valueKey = isRetain ? "healthScore" : "score";
  const label = isRetain ? "Health Score" : "Lead Score";
  const color = isRetain ? "#293b83" : "#10B981";

  const formatted = data.map((d) => ({
    ...d,
    date: new Date(d.snapshotDate).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }),
    value: (d as any)[valueKey] ?? 0,
  }));

  return (
    <div>
      <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">Evolução do Score</p>
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={formatted} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
          <defs>
            <linearGradient id={`scoreGrad-${variant}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.2} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#94a3b8" />
          <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} stroke="#94a3b8" />
          <Tooltip
            formatter={(value: number) => [`${value}`, label]}
            labelStyle={{ fontWeight: 600 }}
            contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }}
          />
          <ReferenceLine y={65} stroke="#10B981" strokeDasharray="4 4" strokeOpacity={0.5} />
          <ReferenceLine y={40} stroke="#f59e0b" strokeDasharray="4 4" strokeOpacity={0.5} />
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            fill={`url(#scoreGrad-${variant})`}
            dot={{ r: 3, fill: color }}
            activeDot={{ r: 5 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
