import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface ChurnTrendDataPoint {
  month: string;
  churn?: number;
  churnRate?: number;
}

interface Props {
  data: ChurnTrendDataPoint[];
}

export function ChurnTrendChart({ data: rawData }: Props) {
  // Normalize: support both 'churn' and 'churnRate' field names from the API
  const data = rawData.map(d => ({ ...d, churn: d.churn ?? d.churnRate ?? 0 }));
  const header = (
    <div className="bg-gradient-to-r from-[#293b83]/5 to-transparent border-b border-slate-100 px-5 py-4 flex items-center gap-2">
      <div className="w-8 h-8 rounded-lg bg-[#293b83]/10 flex items-center justify-center flex-shrink-0">
        <svg className="w-4 h-4 text-[#293b83]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
        </svg>
      </div>
      <div>
        <h3 className="font-semibold text-slate-800 text-sm">Tendência de Churn</h3>
        <p className="text-xs text-slate-500">Evolução da taxa de churn nos últimos 12 meses</p>
      </div>
    </div>
  );

  if (data.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        {header}
        <div className="p-5"><p className="text-sm text-slate-500">Sem dados</p></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
      {header}
      <div className="p-5">
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
          <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} domain={["auto", "auto"]} />
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
    </div>
  );
}
