import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { icpClusters } from "../../../data/obtain-icp-clusters";

const COLORS = ["#10B981", "#293b83", "#ef4444"];
const totalLeads = icpClusters.reduce((a, c) => a + c.leadsInFunnel, 0);

export function ICPDistributionDonut() {
  const data = icpClusters.map(c => ({ name: c.name, value: c.leadsInFunnel }));

  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
      <h3 className="font-semibold text-slate-800 mb-4">Leads por Cluster de ICP</h3>
      <div className="relative">
        <ResponsiveContainer width="100%" height={180}>
          <PieChart>
            <Pie data={data} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={2} dataKey="value">
              {data.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-2xl font-bold text-slate-900">{totalLeads}</span>
          <span className="text-xs text-slate-500">leads</span>
        </div>
      </div>
      <div className="space-y-1.5 mt-2">
        {icpClusters.map((c, i) => (
          <div key={c.id} className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i] }} />
            <span className="text-xs text-slate-600 truncate">{c.name}</span>
            <span className="text-xs font-semibold text-slate-800 ml-auto">{c.leadsInFunnel}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
