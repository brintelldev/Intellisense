import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { DataTable, ColumnDef } from "../../../shared/components/DataTable";
import { RiskBadge } from "../../../shared/components/RiskBadge";
import { Progress } from "../../../shared/components/ui/progress";
import { PredictionDetailDrawer } from "../components/PredictionDetailDrawer";
import { PredictionFilters } from "../components/PredictionFilters";
import { EmptyState } from "../../../shared/components/EmptyState";
import { LoadingState } from "../../../shared/components/LoadingState";
import { useRetainPredictions } from "../../../shared/hooks/useRetain";
import { Customer, RiskLevel } from "../../../data/types";

const SEGMENTS = ["Mineração", "Construção Civil", "Agropecuária", "Industrial"];

const HIGHLIGHT_MAP: Record<RiskLevel, string> = {
  critical: "bg-red-50",
  high: "bg-orange-50",
  medium: "",
  low: "",
};

const healthColor = (s: number) => s < 40 ? "#ef4444" : s < 60 ? "#f59e0b" : "#64b783";
const churnColor = (p: number) => p >= 0.75 ? "#ef4444" : p >= 0.5 ? "#f97316" : p >= 0.25 ? "#f59e0b" : "#64b783";

const columns: ColumnDef<Customer>[] = [
  {
    key: "name",
    header: "Empresa",
    sortable: true,
    width: "25%",
    render: (row) => (
      <div>
        <p className="font-semibold text-slate-800 text-sm">{row.name}</p>
        <p className="text-xs text-slate-400">{row.customerCode}</p>
      </div>
    ),
  },
  {
    key: "segment",
    header: "Segmento",
    sortable: true,
    width: "14%",
    render: (row) => (
      <span className="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full font-medium">{row.segment}</span>
    ),
  },
  {
    key: "revenue",
    header: "Valor Contrato",
    sortable: true,
    width: "13%",
    render: (row) => (
      <span className="font-medium text-slate-700 tabular-nums text-sm">
        R$ {row.revenue.toLocaleString("pt-BR")}
      </span>
    ),
  },
  {
    key: "healthScore",
    header: "Health Score",
    sortable: true,
    width: "16%",
    render: (row) => (
      <div className="flex items-center gap-2">
        <Progress value={row.healthScore} color={healthColor(row.healthScore)} className="w-16" />
        <span className="text-xs font-semibold tabular-nums" style={{ color: healthColor(row.healthScore) }}>
          {row.healthScore}
        </span>
      </div>
    ),
  },
  {
    key: "churnProbability",
    header: "Prob. Churn",
    sortable: true,
    width: "11%",
    render: (row) => (
      <span className="text-sm font-bold tabular-nums" style={{ color: churnColor(row.churnProbability) }}>
        {(row.churnProbability * 100).toFixed(0)}%
      </span>
    ),
  },
  {
    key: "riskLevel",
    header: "Risco",
    sortable: true,
    width: "10%",
    render: (row) => <RiskBadge level={row.riskLevel} />,
  },
  {
    key: "trend",
    header: "Tendência",
    width: "8%",
    render: (row) => (
      <span className={row.trend === "up" ? "text-red-500" : "text-green-500"}>
        {row.trend === "up" ? "↑" : "↓"}
      </span>
    ),
  },
  {
    key: "actions",
    header: "",
    width: "10%",
    render: () => (
      <button className="text-xs border border-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-50 text-slate-600 transition-colors whitespace-nowrap">
        Ver detalhes
      </button>
    ),
  },
];

export default function RetainPredictionsPage() {
  const [selected, setSelected] = useState<Customer | null>(null);
  const [filters, setFilters] = useState({ search: "", riskLevel: "all" as RiskLevel | "all", segment: "all", status: "all" as "active" | "at_risk" | "churned" | "all" });
  const [, navigate] = useLocation();

  const { data: apiData, isLoading } = useRetainPredictions({
    search: filters.search || undefined,
    riskLevel: filters.riskLevel !== "all" ? filters.riskLevel : undefined,
    segment: filters.segment !== "all" ? filters.segment : undefined,
  });

  if (isLoading) return <LoadingState rows={8} />;

  const customers = apiData?.data ?? [];

  const filtered = useMemo(() => {
    if (apiData?.data) return apiData.data;
    return customers;
  }, [apiData, customers]);

  if (filtered.length === 0) {
    return (
      <EmptyState
        title="Nenhuma predição encontrada"
        description="Importe dados de clientes para gerar predições de churn."
        action={{ label: "Importar dados", onClick: () => navigate("/retain/upload") }}
      />
    );
  }

  return (
    <div className="space-y-5 w-full">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900">Predições de Churn</h1>
            <span className="text-xs font-semibold bg-[#293b83]/10 text-[#293b83] px-2.5 py-1 rounded-full">Retain Sense</span>
          </div>
          <p className="text-sm text-slate-500 mt-0.5">Empresas ordenadas por probabilidade de cancelamento</p>
        </div>
      </div>

      <PredictionFilters
        filters={filters}
        onChange={setFilters}
        segments={SEGMENTS}
      />

      <DataTable
        columns={columns}
        data={filtered}
        rowKey={(r) => r.id}
        onRowClick={setSelected}
        highlightFn={(r) => HIGHLIGHT_MAP[r.riskLevel]}
        pageSize={20}
      />

      <PredictionDetailDrawer
        customer={selected}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}
