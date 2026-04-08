import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, ReferenceArea } from "recharts";
import { cn } from "../lib/utils";

interface DataPoint {
  x: number;
  y: number;
  label: string;
  color?: string;
  size?: number;
}

interface QuadrantMatrixProps {
  points: DataPoint[];
  xLabel: string;
  yLabel: string;
  xMid?: number;
  yMid?: number;
  quadrantLabels?: [string, string, string, string]; // TL, TR, BL, BR
  formatX?: (v: number) => string;
  formatY?: (v: number) => string;
  className?: string;
}

// Quadrant background fill colors: TL, TR, BL, BR
const QUADRANT_FILLS = [
  "#fffbeb", // TL: Atenção — yellow
  "#eff6ff", // TR: Avaliar — blue
  "#f0fdf4", // BL: Escalar — green
  "#fef2f2", // BR: Interromper — red
];

export function QuadrantMatrix({
  points, xLabel, yLabel, xMid, yMid,
  quadrantLabels = ["Atenção", "Avaliar", "Escalar", "Interromper"],
  formatX = (v) => String(v),
  formatY = (v) => String(v),
  className,
}: QuadrantMatrixProps) {
  const xValues = points.map(p => p.x);
  const yValues = points.map(p => p.y);
  const xMidVal = xMid ?? (Math.min(...xValues) + Math.max(...xValues)) / 2;
  const yMidVal = yMid ?? (Math.min(...yValues) + Math.max(...yValues)) / 2;

  const xMin = Math.min(...xValues) * 0.5;
  const xMax = Math.max(...xValues) * 1.3;
  const yMin = 0;
  const yMax = Math.max(...yValues) * 1.2;

  const CustomDot = (props: any) => {
    const { cx, cy, payload } = props;
    const r = payload.size ?? 12;
    return (
      <g>
        <circle cx={cx} cy={cy} r={r} fill={payload.color ?? "#293b83"} fillOpacity={0.8} />
        <text x={cx} y={cy - r - 4} textAnchor="middle" fill="#374151" fontSize={11} fontWeight={500}>
          {payload.label}
        </text>
      </g>
    );
  };

  // Custom label for quadrant corners — rendered as CustomizedLabel on ReferenceArea
  const QuadrantLabel = ({ viewBox, label, align }: any) => {
    if (!viewBox) return null;
    const { x, y, width, height } = viewBox;
    const isLeft = align === "left";
    const isTop = align === "top";
    const tx = isLeft ? x + 8 : x + width - 8;
    const ty = isTop ? y + 16 : y + height - 8;
    return (
      <text
        x={tx}
        y={ty}
        textAnchor={isLeft ? "start" : "end"}
        fill="#94a3b8"
        fontSize={10}
        fontWeight={600}
      >
        {label}
      </text>
    );
  };

  return (
    <div className={cn("", className)}>
      <ResponsiveContainer width="100%" height={380}>
        <ScatterChart margin={{ top: 20, right: 20, bottom: 30, left: 20 }}>
          {/* Quadrant background fills */}
          <ReferenceArea x1={xMin} x2={xMidVal} y1={yMidVal} y2={yMax} fill={QUADRANT_FILLS[0]} fillOpacity={0.5}
            label={<QuadrantLabel label={quadrantLabels[0]} align="left" />} />
          <ReferenceArea x1={xMidVal} x2={xMax} y1={yMidVal} y2={yMax} fill={QUADRANT_FILLS[1]} fillOpacity={0.5}
            label={<QuadrantLabel label={quadrantLabels[1]} align="right" />} />
          <ReferenceArea x1={xMin} x2={xMidVal} y1={yMin} y2={yMidVal} fill={QUADRANT_FILLS[2]} fillOpacity={0.5}
            label={<QuadrantLabel label={quadrantLabels[2]} align="left" />} />
          <ReferenceArea x1={xMidVal} x2={xMax} y1={yMin} y2={yMidVal} fill={QUADRANT_FILLS[3]} fillOpacity={0.5}
            label={<QuadrantLabel label={quadrantLabels[3]} align="right" />} />

          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis
            dataKey="x"
            type="number"
            name={xLabel}
            domain={[xMin, xMax]}
            tickFormatter={formatX}
            label={{ value: xLabel, position: "insideBottom", offset: -10, style: { fontSize: 11, fill: "#94a3b8" } }}
          />
          <YAxis
            dataKey="y"
            type="number"
            name={yLabel}
            domain={[yMin, yMax]}
            tickFormatter={formatY}
            label={{ value: yLabel, angle: -90, position: "insideLeft", style: { fontSize: 11, fill: "#94a3b8" } }}
          />
          <Tooltip
            cursor={{ strokeDasharray: "3 3" }}
            content={({ payload }) => {
              if (!payload?.length) return null;
              const d = payload[0].payload;
              return (
                <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3 text-xs">
                  <p className="font-semibold text-slate-800">{d.label}</p>
                  <p className="text-slate-500">{xLabel}: {formatX(d.x)}</p>
                  <p className="text-slate-500">{yLabel}: {formatY(d.y)}</p>
                </div>
              );
            }}
          />
          <ReferenceLine x={xMidVal} stroke="#cbd5e1" strokeDasharray="4 4" />
          <ReferenceLine y={yMidVal} stroke="#cbd5e1" strokeDasharray="4 4" />
          <Scatter data={points} shape={<CustomDot />} />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
