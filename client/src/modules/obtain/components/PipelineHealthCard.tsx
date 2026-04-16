import { fmtBRLShort as fmtBRL } from "../../../shared/lib/format";

interface Component {
  name: string;
  score: number;
  max: number;
}

interface PipelineHealth {
  score: number;
  label: string;
  components: Component[];
  narrative: string;
  weakestComponent: string;
}

interface Props {
  health: PipelineHealth;
}

export function PipelineHealthCard({ health }: Props) {
  const { score, label, components, narrative } = health;

  const scoreColor = score >= 75 ? "#10B981" : score >= 50 ? "#f59e0b" : "#ef4444";
  const labelBg = score >= 75 ? "bg-emerald-100 text-emerald-700" : score >= 50 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700";

  // SVG gauge (semi-circle)
  const radius = 40;
  const circumference = Math.PI * radius;
  const offset = circumference * (1 - score / 100);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="bg-gradient-to-r from-[#10B981]/5 to-transparent border-b border-slate-100 px-5 py-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#10B981]/10 flex items-center justify-center">
            <svg className="w-4 h-4 text-[#10B981]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div>
            <h2 className="font-bold text-slate-900 text-sm">Saúde do Pipeline</h2>
            <p className="text-xs text-slate-500">Score composto de qualidade, conversão, velocidade e diversificação</p>
          </div>
        </div>
      </div>

      <div className="px-5 py-4">
        <div className="flex items-center gap-6">
          {/* Gauge */}
          <div className="flex flex-col items-center flex-shrink-0">
            <svg width="100" height="60" viewBox="0 0 100 60">
              {/* Background arc */}
              <path
                d={`M 10 50 A 40 40 0 0 1 90 50`}
                fill="none"
                stroke="#e2e8f0"
                strokeWidth="10"
                strokeLinecap="round"
              />
              {/* Score arc */}
              <path
                d={`M 10 50 A 40 40 0 0 1 90 50`}
                fill="none"
                stroke={scoreColor}
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={`${circumference * (score / 100)} ${circumference}`}
              />
              <text x="50" y="48" textAnchor="middle" fontSize="18" fontWeight="bold" fill={scoreColor}>{score}</text>
              <text x="50" y="58" textAnchor="middle" fontSize="8" fill="#94a3b8">/100</text>
            </svg>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full mt-1 ${labelBg}`}>{label}</span>
          </div>

          {/* Components breakdown */}
          <div className="flex-1 space-y-2">
            {components.map((c) => (
              <div key={c.name}>
                <div className="flex justify-between text-[10px] text-slate-500 mb-0.5">
                  <span className={c.name === health.weakestComponent ? "text-orange-600 font-medium" : ""}>{c.name}</span>
                  <span className="font-medium">{c.score}/{c.max}pts</span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${(c.score / c.max) * 100}%`,
                      backgroundColor: c.score / c.max >= 0.75 ? "#10B981" : c.score / c.max >= 0.5 ? "#f59e0b" : "#ef4444",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Narrative */}
        <div className="mt-3 bg-amber-50 rounded-lg px-3 py-2 border border-amber-100">
          <p className="text-xs text-amber-700">💡 {narrative}</p>
        </div>
      </div>
    </div>
  );
}
