import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Legend, Tooltip } from "recharts";

interface ClusterLike {
  id: string;
  name: string;
  avgLtv: number;
  avgConversionRate: number;
  churnRate: number;
  avgTenureDays: number;
  leadsInFunnel: number;
}

interface Props {
  clusters: ClusterLike[];
}

const COLORS = ["#10B981", "#293b83", "#ef4444", "#f59e0b", "#8b5cf6"];

// Normalize a list of raw values to 0–100. `invert` means lower raw = better score.
function normalize(values: number[], invert = false): number[] {
  const max = Math.max(...values, 0.0001);
  return values.map(v => {
    const pct = Math.round((v / max) * 100);
    return invert ? 100 - pct : pct;
  });
}

const AXES = [
  { key: "avgLtv",            label: "LTV",        invert: false },
  { key: "avgConversionRate", label: "Conversão",  invert: false },
  { key: "churnRate",         label: "Retenção",   invert: true  }, // lower churn = better retention score
  { key: "avgTenureDays",     label: "Tenure",     invert: false },
  { key: "leadsInFunnel",     label: "Volume",     invert: false },
] as const;

export function ClusterRadarChart({ clusters }: Props) {
  if (clusters.length === 0) return null;

  // Pre-compute normalized values per axis
  const normalized: Record<string, number[]> = {};
  for (const axis of AXES) {
    const rawValues = clusters.map(c => (c as any)[axis.key] ?? 0);
    normalized[axis.key] = normalize(rawValues, axis.invert);
  }

  // Build recharts data: one point per axis label
  const data = AXES.map((axis, axisIdx) => {
    const point: Record<string, string | number> = { subject: axis.label };
    clusters.forEach((c, clusterIdx) => {
      point[shortName(c.name)] = normalized[axis.key][clusterIdx];
    });
    return point;
  });

  return (
    <ResponsiveContainer width="100%" height={260}>
      <RadarChart data={data} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
        <PolarGrid stroke="#f1f5f9" />
        <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: "#64748b" }} />
        <Tooltip
          formatter={(value: number, name: string) => [`${value}/100`, name]}
          contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 11 }}
        />
        <Legend wrapperStyle={{ fontSize: 10, paddingTop: 4 }} />
        {clusters.map((c, i) => (
          <Radar
            key={c.id}
            name={shortName(c.name)}
            dataKey={shortName(c.name)}
            stroke={COLORS[i % COLORS.length]}
            fill={COLORS[i % COLORS.length]}
            fillOpacity={0.10}
            strokeWidth={1.5}
          />
        ))}
      </RadarChart>
    </ResponsiveContainer>
  );
}

/** Strip the "ICP Ideal — " / "ICP Bom — " / "Anti-ICP — " prefix for chart labels */
function shortName(name: string): string {
  return name.replace(/^(ICP Ideal — |ICP Bom — |Anti-ICP — )/, "");
}
