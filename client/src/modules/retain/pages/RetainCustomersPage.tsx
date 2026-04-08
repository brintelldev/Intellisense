import { useState, useMemo } from "react";
import { DataTable, ColumnDef } from "../../../shared/components/DataTable";
import { RiskBadge } from "../../../shared/components/RiskBadge";
import { Progress } from "../../../shared/components/ui/progress";
import { Input } from "../../../shared/components/ui/input";
import { Select } from "../../../shared/components/ui/select";
import { useRetainCustomers } from "../../../shared/hooks/useRetain";
import { customers as mockCustomers } from "../../../data/retain-customers";
import { Customer, RiskLevel, CustomerStatus } from "../../../data/types";

const SEGMENTS = ["Mineração", "Construção Civil", "Agropecuária", "Industrial"];

const healthColor = (s: number) => s < 40 ? "#ef4444" : s < 60 ? "#f59e0b" : "#64b783";
import { fmtBRL } from "../../../shared/lib/format";

const STATUS_LABELS: Record<CustomerStatus, { label: string; className: string }> = {
  active: { label: "Ativo", className: "bg-green-100 text-green-700" },
  at_risk: { label: "Em Risco", className: "bg-orange-100 text-orange-700" },
  churned: { label: "Churned", className: "bg-red-100 text-red-700" },
};

const columns: ColumnDef<Customer>[] = [
  {
    key: "name", header: "Empresa", sortable: true, width: "22%",
    render: (r) => (
      <div>
        <p className="font-semibold text-slate-800 text-sm">{r.name}</p>
        <p className="text-xs text-slate-400">{r.customerCode}</p>
      </div>
    ),
  },
  {
    key: "segment", header: "Segmento", sortable: true, width: "12%",
    render: (r) => <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{r.segment}</span>,
  },
  {
    key: "city", header: "Cidade/UF", sortable: true, width: "10%",
    render: (r) => <span className="text-xs text-slate-600">{r.city}/{r.state}</span>,
  },
  {
    key: "revenue", header: "Valor Contrato", sortable: true, width: "12%",
    render: (r) => <span className="text-sm font-medium tabular-nums text-slate-700">{fmtBRL(r.revenue)}</span>,
  },
  {
    key: "tenureDays", header: "Parceria", sortable: true, width: "8%",
    render: (r) => <span className="text-sm text-slate-600">{Math.round(r.tenureDays / 30)}m</span>,
  },
  {
    key: "healthScore", header: "Health Score", sortable: true, width: "14%",
    render: (r) => (
      <div className="flex items-center gap-2">
        <Progress value={r.healthScore} color={healthColor(r.healthScore)} className="w-14" />
        <span className="text-xs font-semibold" style={{ color: healthColor(r.healthScore) }}>{r.healthScore}</span>
      </div>
    ),
  },
  {
    key: "riskLevel", header: "Risco", sortable: true, width: "9%",
    render: (r) => <RiskBadge level={r.riskLevel} />,
  },
  {
    key: "status", header: "Status", sortable: true, width: "9%",
    render: (r) => {
      const cfg = STATUS_LABELS[r.status];
      return <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${cfg.className}`}>{cfg.label}</span>;
    },
  },
  {
    key: "lastContact", header: "Último Contato", width: "10%",
    render: (r) => <span className="text-xs text-slate-500">{r.lastContact}</span>,
  },
];

export default function RetainCustomersPage() {
  const [search, setSearch] = useState("");
  const [riskLevel, setRiskLevel] = useState<RiskLevel | "all">("all");
  const [segment, setSegment] = useState("all");
  const [status, setStatus] = useState<CustomerStatus | "all">("all");
  const [revenueMin, setRevenueMin] = useState("");
  const [revenueMax, setRevenueMax] = useState("");
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());

  const { data: apiData, isLoading } = useRetainCustomers({
    search: search || undefined,
    riskLevel: riskLevel !== "all" ? riskLevel : undefined,
    segment: segment !== "all" ? segment : undefined,
  });

  const customers = apiData?.data ?? mockCustomers;

  const filtered = useMemo(() => {
    const minRev = revenueMin ? Number(revenueMin.replace(/\D/g, "")) : null;
    const maxRev = revenueMax ? Number(revenueMax.replace(/\D/g, "")) : null;

    if (apiData?.data) return apiData.data.filter((c: any) => {
      if (status !== "all" && c.status !== status) return false;
      if (minRev && c.revenue < minRev) return false;
      if (maxRev && c.revenue > maxRev) return false;
      return true;
    });
    return customers.filter((c: any) => {
      if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (riskLevel !== "all" && c.riskLevel !== riskLevel) return false;
      if (segment !== "all" && c.segment !== segment) return false;
      if (status !== "all" && c.status !== status) return false;
      if (minRev && c.revenue < minRev) return false;
      if (maxRev && c.revenue > maxRev) return false;
      return true;
    });
  }, [search, riskLevel, segment, status, revenueMin, revenueMax, apiData, customers]);


  return (
    <div className="space-y-5 w-full">
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-bold text-slate-900">Empresas</h1>
        <span className="text-xs font-semibold bg-[#293b83]/10 text-[#293b83] px-2.5 py-1 rounded-full">Retain Sense</span>
        <span className="ml-auto text-sm text-slate-500">{filtered.length} empresas</span>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100 flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar empresa..." className="pl-9" />
        </div>
        <Select value={segment} onChange={(e) => setSegment(e.target.value)} className="w-44">
          <option value="all">Todos os segmentos</option>
          {SEGMENTS.map(s => <option key={s} value={s}>{s}</option>)}
        </Select>
        <Select value={riskLevel} onChange={(e) => setRiskLevel(e.target.value as RiskLevel | "all")} className="w-40">
          <option value="all">Todos os riscos</option>
          <option value="critical">Crítico</option>
          <option value="high">Alto</option>
          <option value="medium">Médio</option>
          <option value="low">Baixo</option>
        </Select>
        <Select value={status} onChange={(e) => setStatus(e.target.value as CustomerStatus | "all")} className="w-40">
          <option value="all">Todos os status</option>
          <option value="active">Ativo</option>
          <option value="at_risk">Em Risco</option>
          <option value="churned">Churned</option>
        </Select>
        <div className="flex items-center gap-1.5">
          <Input
            value={revenueMin}
            onChange={(e) => setRevenueMin(e.target.value)}
            placeholder="Receita mín."
            className="w-32 text-xs"
          />
          <span className="text-slate-400 text-sm">—</span>
          <Input
            value={revenueMax}
            onChange={(e) => setRevenueMax(e.target.value)}
            placeholder="Receita máx."
            className="w-32 text-xs"
          />
        </div>
        <button className="flex items-center gap-2 h-9 px-4 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 whitespace-nowrap">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
          Exportar CSV
        </button>
        <button className="flex items-center gap-2 h-9 px-4 bg-[#293b83] text-white rounded-lg text-sm font-medium hover:bg-[#1e2d6b] whitespace-nowrap">
          + Adicionar Empresa
        </button>
      </div>

      {/* Bulk action bar */}
      {selectedRows.size > 0 && (
        <div className="bg-[#293b83] text-white rounded-xl px-5 py-3 flex items-center justify-between shadow-md">
          <span className="text-sm font-medium">{selectedRows.size} empresa{selectedRows.size > 1 ? "s" : ""} selecionada{selectedRows.size > 1 ? "s" : ""}</span>
          <div className="flex items-center gap-3">
            <button className="text-sm bg-white/20 hover:bg-white/30 px-4 py-1.5 rounded-lg transition-colors font-medium">
              Criar ação de retenção para {selectedRows.size} selecionada{selectedRows.size > 1 ? "s" : ""}
            </button>
            <button
              onClick={() => setSelectedRows(new Set())}
              className="text-white/70 hover:text-white text-sm"
            >
              ✕ Limpar seleção
            </button>
          </div>
        </div>
      )}

      <DataTable
        columns={columns}
        data={filtered}
        rowKey={(r) => r.id}
        pageSize={20}
        selectable
        selectedRows={selectedRows}
        onSelectionChange={setSelectedRows}
      />
    </div>
  );
}
