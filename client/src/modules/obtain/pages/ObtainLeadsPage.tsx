import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { DataTable, ColumnDef } from "../../../shared/components/DataTable";
import { ScoreBadge } from "../../../shared/components/ScoreBadge";
import { Progress } from "../../../shared/components/ui/progress";
import { LeadFilters } from "../components/LeadFilters";
import { LeadDetailDrawer } from "../components/LeadDetailDrawer";
import { EmptyState } from "../../../shared/components/EmptyState";
import { LoadingState } from "../../../shared/components/LoadingState";
import { Lead, ScoreTier, LeadStatus } from "../../../shared/types";
import { useObtainLeads } from "../../../shared/hooks/useObtain";

interface Filters {
  search: string;
  scoreTier: ScoreTier | "all";
  status: LeadStatus | "all";
  source: string;
  icpCluster: string;
  minScore: number;
}

const SOURCE_LABELS: Record<string, string> = {
  referral: "Indicação", event: "Feira/Evento", paid_social: "LinkedIn Ads",
  paid_search: "Google Ads", outbound: "Outbound",
};

const STATUS_LABELS: Record<string, string> = {
  new: "Novo", qualifying: "Qualificando", contacted: "Contactado",
  proposal: "Proposta", won: "Ganho", lost: "Perdido",
};

import { fmtBRLShort as fmtBRL } from "../../../shared/lib/format";

const COLUMNS: ColumnDef<Lead>[] = [
  {
    key: "name", header: "Lead / Empresa", sortable: true, width: "w-52",
    render: (row) => (
      <div>
        <p className="font-semibold text-slate-800 text-sm">{row.name}</p>
        <p className="text-xs text-slate-500 truncate">{row.company}</p>
      </div>
    ),
  },
  {
    key: "score", header: "Score", sortable: true, width: "w-32",
    render: (row) => {
      const color = row.score >= 80 ? "#10B981" : row.score >= 50 ? "#f59e0b" : row.score >= 30 ? "#94a3b8" : "#ef4444";
      return (
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold" style={{ color }}>{row.score}</span>
          <Progress value={row.score} color={color} className="w-16" />
        </div>
      );
    },
  },
  {
    key: "scoreTier", header: "Tier", sortable: true, width: "w-28",
    render: (row) => <ScoreBadge tier={row.scoreTier} />,
  },
  {
    key: "ltvPrediction", header: "LTV Previsto", sortable: true, width: "w-32",
    render: (row) => <span className="text-sm font-semibold text-slate-800">{fmtBRL(row.ltvPrediction)}</span>,
  },
  {
    key: "icpCluster", header: "Cluster ICP", sortable: false, width: "w-52",
    render: (row) => <span className="text-xs text-slate-600 truncate">{row.icpCluster}</span>,
  },
  {
    key: "source", header: "Origem", sortable: true, width: "w-32",
    render: (row) => <span className="text-xs text-slate-600">{SOURCE_LABELS[row.source] ?? row.source}</span>,
  },
  {
    key: "status", header: "Status", sortable: true, width: "w-32",
    render: (row) => {
      const colors: Record<string, string> = {
        new: "bg-slate-100 text-slate-600",
        qualifying: "bg-blue-100 text-blue-700",
        contacted: "bg-yellow-100 text-yellow-700",
        proposal: "bg-purple-100 text-purple-700",
        won: "bg-emerald-100 text-emerald-700",
        lost: "bg-red-100 text-red-700",
      };
      return (
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colors[row.status] ?? "bg-slate-100 text-slate-600"}`}>
          {STATUS_LABELS[row.status] ?? row.status}
        </span>
      );
    },
  },
  {
    key: "assignedTo", header: "Responsável", sortable: true, width: "w-32",
    render: (row) => <span className="text-xs text-slate-600">{row.assignedTo}</span>,
  },
];

export default function ObtainLeadsPage() {
  const [filters, setFilters] = useState<Filters>({ search: "", scoreTier: "all", status: "all", source: "all", icpCluster: "all", minScore: 0 });
  const [selected, setSelected] = useState<Lead | null>(null);
  const [, navigate] = useLocation();

  const { data: apiLeadsData, isLoading } = useObtainLeads({
    scoreTier: filters.scoreTier !== "all" ? filters.scoreTier : undefined,
    status: filters.status !== "all" ? filters.status : undefined,
    source: filters.source !== "all" ? filters.source : undefined,
    search: filters.search || undefined,
  });

  if (isLoading) return <LoadingState rows={8} />;

  const leads = apiLeadsData?.data ?? [];

  const filtered = useMemo(() => {
    return leads.filter((l: Lead) => {
      if (filters.scoreTier !== "all" && l.scoreTier !== filters.scoreTier) return false;
      if (filters.status !== "all" && l.status !== filters.status) return false;
      if (filters.source !== "all" && l.source !== filters.source) return false;
      if (filters.icpCluster !== "all" && (l as any).icpClusterId !== filters.icpCluster) return false;
      if (filters.minScore > 0 && (l as any).score < filters.minScore) return false;
      if (filters.search) {
        const q = filters.search.toLowerCase();
        if (!l.name.toLowerCase().includes(q) && !l.company.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [filters, leads]);

  if (filtered.length === 0 && !filters.search && filters.scoreTier === "all" && filters.status === "all" && filters.source === "all") {
    return (
      <EmptyState
        title="Nenhum lead encontrado"
        description="Importe dados de leads para começar a qualificar oportunidades."
        action={{ label: "Importar dados", onClick: () => navigate("/obtain/upload") }}
      />
    );
  }

  return (
    <div className="space-y-4 w-full">
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-bold text-slate-900">Leads & Scoring</h1>
        <span className="text-xs font-semibold bg-[#10B981]/10 text-[#10B981] px-2.5 py-1 rounded-full">Obtain Sense</span>
        <span className="ml-auto text-sm text-slate-500">{filtered.length} leads encontrados</span>
      </div>

      <LeadFilters filters={filters} onChange={setFilters} />

      <DataTable
        columns={COLUMNS}
        data={filtered}
        rowKey={(row) => row.id}
        onRowClick={setSelected}
        highlightFn={(row) => row.scoreTier === "hot" ? "bg-emerald-50" : undefined}
        pageSize={10}
      />

      <LeadDetailDrawer lead={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
