import { QuadrantMatrix } from "../../../shared/components/QuadrantMatrix";

interface IcpCluster {
  id: string;
  name: string;
  type: string;
  avgLtv: number;
  leadsInFunnel: number;
  characteristics: any;
}

interface Props {
  clusters: IcpCluster[];
}

const TYPE_COLORS: Record<string, string> = {
  ideal: "#10B981",
  good:  "#293b83",
  anti:  "#ef4444",
};

const fmtBRL = (v: number) => v >= 1_000_000 ? `R$${(v / 1_000_000).toFixed(1)}M` : `R$${Math.round(v / 1_000)}K`;

export function ICPPriorityMatrix({ clusters }: Props) {
  if (clusters.length === 0) return null;

  const points = clusters.map(c => ({
    x: c.leadsInFunnel,
    y: c.avgLtv,
    label: (c.characteristics?.industry as string | undefined) ?? c.name.replace(/^(ICP Ideal — |ICP Bom — |Anti-ICP — )/, ""),
    color: TYPE_COLORS[c.type] ?? "#94a3b8",
    // Scale bubble size by composite score (8–18px radius)
    size: Math.round(8 + ((c.characteristics?.composite ?? 0.5) * 10)),
  }));

  // Midpoints: median LTV and median leads count
  const sortedLtv = [...points].sort((a, b) => a.y - b.y);
  const sortedLeads = [...points].sort((a, b) => a.x - b.x);
  const midIdx = Math.floor(points.length / 2);
  const yMid = sortedLtv[midIdx]?.y ?? points.reduce((s, p) => s + p.y, 0) / points.length;
  const xMid = sortedLeads[midIdx]?.x ?? points.reduce((s, p) => s + p.x, 0) / points.length;

  return (
    <QuadrantMatrix
      points={points}
      xLabel="Leads no funil"
      yLabel="LTV Médio"
      xMid={xMid}
      yMid={yMid}
      quadrantLabels={[
        "Oportunidade — buscar mais",
        "Escalar agressivamente",
        "Evitar / reduzir",
        "Cuidado — volume alto, retorno baixo",
      ]}
      formatX={(v) => String(Math.round(v))}
      formatY={(v) => fmtBRL(v)}
    />
  );
}
