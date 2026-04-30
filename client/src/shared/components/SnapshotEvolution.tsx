import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";
import { fmtBRLShort, toNumber } from "../lib/format";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface RetainSnapshotPoint {
  uploadId: string;
  uploadedAt: string;
  filename: string;
  customerCount: number;
  avgHealthScore: number;
  churnRate: number;
  atRiskPct: number;
  totalRevenue: number;
}

export interface ObtainSnapshotPoint {
  uploadId: string;
  uploadedAt: string;
  filename: string;
  leadCount: number;
  wonCount: number;
  conversionRate: number;
  hotPct: number;
  avgLtvPrediction: number;
  avgScore: number;
}

interface Props {
  mode: "retain" | "obtain";
  snapshots: RetainSnapshotPoint[] | ObtainSnapshotPoint[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function shortLabel(filename: string, uploadedAt: string): string {
  // Try to infer month from filename first (e.g. fevereiro26, marco26, abril26)
  const months: Record<string, string> = {
    jan: "Jan", fev: "Fev", mar: "Mar", abr: "Abr", mai: "Mai", jun: "Jun",
    jul: "Jul", ago: "Ago", set: "Set", out: "Out", nov: "Nov", dez: "Dez",
    january: "Jan", february: "Fev", march: "Mar", april: "Abr",
    may: "Mai", june: "Jun", july: "Jul", august: "Ago",
    september: "Set", october: "Out", november: "Nov", december: "Dez",
    // Portuguese full names
    fevereiro: "Fev", marco: "Mar", abril: "Abr", maio: "Mai", junho: "Jun",
    julho: "Jul", agosto: "Ago", setembro: "Set", outubro: "Out",
    novembro: "Nov", dezembro: "Dez", janeiro: "Jan",
  };
  const base = filename.replace(/\.[^.]+$/, "").toLowerCase();
  for (const [key, label] of Object.entries(months)) {
    if (base.includes(key)) {
      const yearMatch = base.match(/(\d{2,4})/);
      const year = yearMatch ? yearMatch[1].slice(-2) : "";
      return `${label}${year ? "/" + year : ""}`;
    }
  }
  // Fallback: use upload date
  return new Date(uploadedAt).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
}

const numberOrZero = (value: unknown) => toNumber(value as number | string | null | undefined) ?? 0;
const fixed = (value: unknown, decimals = 1) => numberOrZero(value).toFixed(decimals);

function Trend({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const delta = values[values.length - 1] - values[0];
  if (Math.abs(delta) < 0.01) return <span className="text-xs text-slate-400">—</span>;
  const up = delta > 0;
  return (
    <span className={`text-xs font-medium flex items-center gap-0.5 ${up ? "text-emerald-600" : "text-red-500"}`}>
      {up ? "▲" : "▼"} {Math.abs(delta).toFixed(1)}
    </span>
  );
}

// ─── Tooltip personalizado ────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg px-3 py-2 text-xs">
      <p className="font-semibold text-slate-700 mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color }} className="flex justify-between gap-4">
          <span>{p.name}</span>
          <span className="font-medium tabular-nums">{p.value}</span>
        </p>
      ))}
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export function SnapshotEvolution({ mode, snapshots }: Props) {
  if (!snapshots || snapshots.length < 2) return null;

  // Build chart data
  const chartData = snapshots.map((s) => ({
    label: shortLabel(s.filename, s.uploadedAt),
    ...(mode === "retain"
      ? {
          "Score de Saúde": (s as RetainSnapshotPoint).avgHealthScore,
          "Churn (%)": numberOrZero((s as RetainSnapshotPoint).churnRate),
          "Em Risco (%)": numberOrZero((s as RetainSnapshotPoint).atRiskPct),
        }
      : {
          "Score Médio": (s as ObtainSnapshotPoint).avgScore,
          "Conversão (%)": (s as ObtainSnapshotPoint).conversionRate,
          "Hot Leads (%)": (s as ObtainSnapshotPoint).hotPct,
        }),
  }));

  // KPI summary cards
  const retainSnaps = snapshots as RetainSnapshotPoint[];
  const obtainSnaps = snapshots as ObtainSnapshotPoint[];

  const kpis = mode === "retain"
    ? [
        {
          label: "Score de Saúde",
          values: retainSnaps.map(s => numberOrZero(s.avgHealthScore)),
          fmt: (v: number) => fixed(v),
          color: "#293b83",
          goodUp: true,
        },
        {
          label: "Taxa de Churn",
          values: retainSnaps.map(s => numberOrZero(s.churnRate)),
          fmt: (v: number) => `${fixed(v)}%`,
          color: "#ef4444",
          goodUp: false,
        },
        {
          label: "Clientes em Risco",
          values: retainSnaps.map(s => numberOrZero(s.atRiskPct)),
          fmt: (v: number) => `${fixed(v)}%`,
          color: "#f59e0b",
          goodUp: false,
        },
        {
          label: "Receita Total",
          values: retainSnaps.map(s => numberOrZero(s.totalRevenue)),
          fmt: (v: number) => fmtBRLShort(v),
          color: "#10b981",
          goodUp: true,
        },
      ]
    : [
        {
          label: "Score Médio",
          values: obtainSnaps.map(s => numberOrZero(s.avgScore)),
          fmt: (v: number) => fixed(v),
          color: "#293b83",
          goodUp: true,
        },
        {
          label: "Taxa de Conversão",
          values: obtainSnaps.map(s => numberOrZero(s.conversionRate)),
          fmt: (v: number) => `${fixed(v)}%`,
          color: "#10b981",
          goodUp: true,
        },
        {
          label: "Hot Leads",
          values: obtainSnaps.map(s => numberOrZero(s.hotPct)),
          fmt: (v: number) => `${fixed(v)}%`,
          color: "#f59e0b",
          goodUp: true,
        },
        {
          label: "LTV Médio Previsto",
          values: obtainSnaps.map(s => numberOrZero(s.avgLtvPrediction)),
          fmt: (v: number) => fmtBRLShort(v),
          color: "#67b4b0",
          goodUp: true,
        },
      ];

  const lines = mode === "retain"
    ? [
        { key: "Score de Saúde", color: "#293b83" },
        { key: "Churn (%)", color: "#ef4444" },
        { key: "Em Risco (%)", color: "#f59e0b" },
      ]
    : [
        { key: "Score Médio", color: "#293b83" },
        { key: "Conversão (%)", color: "#10b981" },
        { key: "Hot Leads (%)", color: "#f59e0b" },
      ];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden mb-5">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-[#293b83]/10 flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 text-[#293b83]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
          </svg>
        </div>
        <div>
          <h3 className="font-semibold text-slate-800 text-sm">Evolução entre Uploads</h3>
          <p className="text-xs text-slate-500">
            Comparação de KPIs entre os {snapshots.length} uploads carregados
          </p>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-slate-100 border-b border-slate-100">
        {kpis.map((k) => {
          const first = k.values[0];
          const last = k.values[k.values.length - 1];
          const delta = last - first;
          const isGood = k.goodUp ? delta >= 0 : delta <= 0;
          const neutral = Math.abs(delta) < 0.01;
          return (
            <div key={k.label} className="bg-white px-4 py-3">
              <p className="text-xs text-slate-500 mb-0.5">{k.label}</p>
              <p className="font-semibold text-slate-800 text-base tabular-nums">{k.fmt(last)}</p>
              <div className="flex items-center gap-1 mt-0.5">
                {neutral ? (
                  <span className="text-xs text-slate-400">sem alteração</span>
                ) : (
                  <>
                    <span className={`text-xs font-medium ${isGood ? "text-emerald-600" : "text-red-500"}`}>
                      {delta > 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(1)}
                    </span>
                    <span className="text-xs text-slate-400">vs. primeiro</span>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Line chart */}
      <div className="px-4 pt-4 pb-3">
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={chartData} margin={{ top: 4, right: 16, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
              iconType="circle"
              iconSize={8}
            />
            {lines.map((l) => (
              <Line
                key={l.key}
                type="monotone"
                dataKey={l.key}
                stroke={l.color}
                strokeWidth={2}
                dot={{ r: 4, fill: l.color, strokeWidth: 0 }}
                activeDot={{ r: 5 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Period labels */}
      <div className="px-5 pb-3 flex flex-wrap gap-2">
        {snapshots.map((s, i) => (
          <span key={s.uploadId} className="text-xs bg-slate-100 text-slate-500 px-2.5 py-0.5 rounded-full">
            {i + 1}. {shortLabel(s.filename, s.uploadedAt)} — {s.filename}
          </span>
        ))}
      </div>
    </div>
  );
}
