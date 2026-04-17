import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface SegmentData {
  segment: string;
  revenue?: number;
  totalRevenue?: number;
}

interface Props {
  data: SegmentData[];
}

export function RevenueBySegmentBar({ data: rawData }: Props) {
  // Normalize: support both 'revenue' and 'totalRevenue' field names from the API
  const data = rawData
    .map(d => ({ ...d, revenue: d.revenue ?? d.totalRevenue ?? 0 }))
    .filter(d => d.revenue > 0);
  const header = (
    <div className="bg-gradient-to-r from-[#293b83]/5 to-transparent border-b border-slate-100 px-5 py-4 flex items-center gap-2">
      <div className="w-8 h-8 rounded-lg bg-[#293b83]/10 flex items-center justify-center flex-shrink-0">
        <svg className="w-4 h-4 text-[#293b83]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      </div>
      <div>
        <h3 className="font-semibold text-slate-800 text-sm">Receita por Segmento</h3>
        <p className="text-xs text-slate-500">MRR distribuído por segmento de cliente</p>
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
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 20, bottom: 0, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${(v/1000000).toFixed(1)}M`} />
          <YAxis dataKey="segment" type="category" tick={{ fontSize: 11 }} width={110} />
          <Tooltip formatter={(v: number) => [`R$ ${(v/1000000).toFixed(1)}M`, "Receita"]} />
          <Bar dataKey="revenue" radius={[0, 6, 6, 0]}>
            {data.map((_, i) => (
              <Cell key={i} fill={i === 0 ? "#293b83" : i === 1 ? "#3d52b0" : i === 2 ? "#67b4b0" : "#94a3b8"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      </div>
    </div>
  );
}
