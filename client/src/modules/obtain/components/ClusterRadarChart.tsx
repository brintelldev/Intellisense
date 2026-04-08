import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { ICPCluster } from "../../../data/types";

interface Props {
  clusters: ICPCluster[];
}

const COLORS = ["#10B981", "#293b83", "#ef4444"];

export function ClusterRadarChart({ clusters }: Props) {
  const axes = [
    { key: "ltv", label: "LTV" },
    { key: "cac", label: "Ticket Médio" },
    { key: "conversion", label: "Conversão" },
    { key: "tenure", label: "Retenção" },
    { key: "churn", label: "Volume de Leads" },
  ];

  const data = axes.map(({ key, label }) => {
    const point: Record<string, string | number> = { subject: label };
    clusters.forEach((c) => {
      point[c.name.split(":")[0].trim()] = c.characteristics[key as keyof typeof c.characteristics];
    });
    return point;
  });

  return (
    <ResponsiveContainer width="100%" height={280}>
      <RadarChart data={data}>
        <PolarGrid stroke="#f1f5f9" />
        <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: "#64748b" }} />
        <Tooltip />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {clusters.map((c, i) => (
          <Radar
            key={c.id}
            name={c.name.split(":")[0].trim()}
            dataKey={c.name.split(":")[0].trim()}
            stroke={COLORS[i]}
            fill={COLORS[i]}
            fillOpacity={0.12}
            strokeWidth={2}
          />
        ))}
      </RadarChart>
    </ResponsiveContainer>
  );
}
