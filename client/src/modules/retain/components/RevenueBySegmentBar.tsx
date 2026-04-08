import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { revenueBySegment } from "../../../data/retain-analytics";

export function RevenueBySegmentBar() {
  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
      <h3 className="font-semibold text-slate-800 mb-4">Receita por Segmento</h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={revenueBySegment} layout="vertical" margin={{ top: 0, right: 20, bottom: 0, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `R$${(v/1000000).toFixed(1)}M`} />
          <YAxis dataKey="segment" type="category" tick={{ fontSize: 11 }} width={110} />
          <Tooltip formatter={(v: number) => [`R$ ${(v/1000000).toFixed(1)}M`, "Receita"]} />
          <Bar dataKey="revenue" radius={[0, 6, 6, 0]}>
            {revenueBySegment.map((_, i) => (
              <Cell key={i} fill={i === 0 ? "#293b83" : i === 1 ? "#3d52b0" : i === 2 ? "#67b4b0" : "#94a3b8"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
