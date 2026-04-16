import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { fmtBRLShort as fmtBRL } from "../../../shared/lib/format";

interface Projection {
  days: number;
  value: number;
  description: string;
}

interface PipelineProjection {
  totalPipeline: number;
  projections: Projection[];
  topFocusAction: string;
}

interface Props {
  projection: PipelineProjection;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3 text-xs">
      <p className="font-semibold text-slate-700 mb-1">{label} dias</p>
      <p className="text-[#10B981] font-bold">{fmtBRL(payload[0].value)}</p>
      {payload[0].payload.description && (
        <p className="text-slate-500 mt-1">{payload[0].payload.description}</p>
      )}
    </div>
  );
};

export function PipelineProjectionCard({ projection }: Props) {
  const { totalPipeline, projections, topFocusAction } = projection;

  const chartData = projections.map(p => ({
    label: `${p.days}d`,
    value: p.value,
    description: p.description,
    fill: p.days === 30 ? "#10B981" : p.days === 60 ? "#34d399" : "#6ee7b7",
  }));

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="bg-gradient-to-r from-[#10B981]/5 to-transparent border-b border-slate-100 px-5 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#10B981]/10 flex items-center justify-center">
              <svg className="w-4 h-4 text-[#10B981]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <div>
              <h2 className="font-bold text-slate-900 text-sm">Projeção de Aquisição — 90 dias</h2>
              <p className="text-xs text-slate-500">Fechamentos esperados por janela de tempo</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-slate-400">Pipeline Total</p>
            <p className="text-sm font-bold text-[#10B981]">{fmtBRL(totalPipeline)}</p>
          </div>
        </div>
      </div>

      <div className="px-5 pt-4">
        <ResponsiveContainer width="100%" height={140}>
          <BarChart data={chartData} margin={{ top: 5, right: 10, bottom: 0, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => v >= 1000000 ? `${(v/1000000).toFixed(1)}M` : `${Math.round(v/1000)}K`} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="value" radius={[6, 6, 0, 0]} fill="#10B981">
              {chartData.map((entry, index) => (
                <rect key={index} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Value breakdown */}
      <div className="px-5 py-3 grid grid-cols-3 gap-2">
        {projections.map((p) => (
          <div key={p.days} className="bg-slate-50 rounded-lg p-2.5 text-center border border-slate-100">
            <p className="text-[10px] text-slate-400 mb-0.5">{p.days} dias</p>
            <p className="text-sm font-bold text-[#10B981]">{fmtBRL(p.value)}</p>
            <p className="text-[9px] text-slate-400 mt-0.5 truncate">{p.description}</p>
          </div>
        ))}
      </div>

      {topFocusAction && (
        <div className="px-5 pb-4">
          <div className="bg-[#10B981]/5 rounded-lg px-3 py-2 border border-[#10B981]/20">
            <p className="text-xs text-[#10B981]">💡 {topFocusAction}</p>
          </div>
        </div>
      )}
    </div>
  );
}
