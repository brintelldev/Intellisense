import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { monthlyAnalytics } from "../../../data/retain-analytics";

export function ChurnTrendChart() {
  const data = monthlyAnalytics.map(m => ({ month: m.month, churn: m.churnRate }));

  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
      <h3 className="font-semibold text-slate-800 mb-4">Tendência de Churn — Últimos 12 Meses</h3>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={data} margin={{ top: 5, right: 10, bottom: 0, left: -10 }}>
          <defs>
            <linearGradient id="churnGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#293b83" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#293b83" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="month" tick={{ fontSize: 11 }} interval={1} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} domain={[2, 6]} />
          <Tooltip formatter={(v: number) => [`${v.toFixed(1)}%`, "Churn Rate"]} />
          <Area
            type="monotone"
            dataKey="churn"
            stroke="#293b83"
            strokeWidth={2.5}
            fill="url(#churnGrad)"
            dot={{ fill: "#293b83", r: 3 }}
            activeDot={{ r: 5 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
