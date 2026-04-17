import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { ICPCluster } from "../../../shared/types";

interface Props {
  clusters: ICPCluster[];
}

const COLORS = ["#10B981", "#293b83", "#ef4444"];

export function ICPDistributionDonut({ clusters }: Props) {
  if (clusters.length === 0) return null;

  const data = clusters.map(c => ({ name: c.name, value: c.leadsInFunnel }));
  const totalLeads = clusters.reduce((a, c) => a + c.leadsInFunnel, 0);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="bg-gradient-to-r from-[#10B981]/5 to-transparent border-b border-slate-100 px-5 py-4 flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-[#10B981]/10 flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 text-[#10B981]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
          </svg>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Leads por Cluster de ICP</h3>
          <p className="text-xs text-slate-500">Distribuição por perfil de cliente ideal</p>
        </div>
      </div>
      <div className="p-5">
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
        {clusters.map((c, i) => (
          <div key={c.id} className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i] }} />
            <span className="text-xs text-slate-600 truncate">{c.name}</span>
            <span className="text-xs font-semibold text-slate-800 ml-auto">{c.leadsInFunnel}</span>
          </div>
        ))}
      </div>
      </div>
    </div>
  );
}
