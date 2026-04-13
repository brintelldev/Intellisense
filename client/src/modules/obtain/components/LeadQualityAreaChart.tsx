import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface LeadQualityPoint {
  month: string;
  hot: number;
  warm: number;
  cold: number;
}

interface Props {
  data: LeadQualityPoint[];
}

export function LeadQualityAreaChart({ data }: Props) {
  if (data.length === 0) return null;

  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
      <h3 className="font-semibold text-slate-800 mb-4">Qualidade dos Leads por Mês</h3>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="hotGrad2" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="warmGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="month" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Area type="monotone" dataKey="hot" name="Hot" stroke="#10B981" fill="url(#hotGrad2)" strokeWidth={2} />
          <Area type="monotone" dataKey="warm" name="Warm" stroke="#f59e0b" fill="url(#warmGrad)" strokeWidth={2} />
          <Area type="monotone" dataKey="cold" name="Cold" stroke="#94a3b8" fill="none" strokeWidth={1.5} strokeDasharray="4 4" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
