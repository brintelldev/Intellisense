import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { DataTable, ColumnDef } from "../../../shared/components/DataTable";
import { RiskBadge } from "../../../shared/components/RiskBadge";
import { Progress } from "../../../shared/components/ui/progress";
import { Input } from "../../../shared/components/ui/input";
import { Select } from "../../../shared/components/ui/select";
import { EmptyState } from "../../../shared/components/EmptyState";
import { LoadingState } from "../../../shared/components/LoadingState";
import { useRetainCustomers, useCreateRetainAction } from "../../../shared/hooks/useRetain";
import { Customer, RiskLevel, CustomerStatus } from "../../../shared/types";

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
    render: (r) => <span className="text-sm text-slate-600">{r.tenureDays != null ? `${Math.round(r.tenureDays / 30)}m` : "—"}</span>,
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
  const [showActionModal, setShowActionModal] = useState(false);
  const [actionType, setActionType] = useState("call");
  const [actionPriority, setActionPriority] = useState("medium");
  const [actionDescription, setActionDescription] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [createDone, setCreateDone] = useState(false);
  const createAction = useCreateRetainAction();
  const [, navigate] = useLocation();

  async function handleBulkCreate() {
    setIsCreating(true);
    try {
      await Promise.all(
        Array.from(selectedRows).map((id) =>
          createAction.mutateAsync({
            customerId: id,
            type: actionType,
            priority: actionPriority,
            description: actionDescription || undefined,
          })
        )
      );
      setCreateDone(true);
      setTimeout(() => {
        setShowActionModal(false);
        setSelectedRows(new Set());
        setCreateDone(false);
        setActionType("call");
        setActionPriority("medium");
        setActionDescription("");
      }, 1200);
    } finally {
      setIsCreating(false);
    }
  }

  const { data: apiData, isLoading } = useRetainCustomers({
    search: search || undefined,
    riskLevel: riskLevel !== "all" ? riskLevel : undefined,
    segment: segment !== "all" ? segment : undefined,
  });

  const customers = apiData?.data ?? [];

  const filtered = useMemo(() => {
    const minRev = revenueMin ? Number(revenueMin.replace(/\D/g, "")) : null;
    const maxRev = revenueMax ? Number(revenueMax.replace(/\D/g, "")) : null;

    return customers.filter((c: any) => {
      if (status !== "all" && c.status !== status) return false;
      if (minRev && c.revenue < minRev) return false;
      if (maxRev && c.revenue > maxRev) return false;
      return true;
    });
  }, [status, revenueMin, revenueMax, customers]);

  if (isLoading) return <LoadingState rows={8} />;

  if (filtered.length === 0 && !search && riskLevel === "all" && segment === "all" && status === "all") {
    return (
      <EmptyState
        title="Nenhuma empresa encontrada"
        description="Importe dados de clientes para começar a monitorar a base."
        action={{ label: "Importar dados", onClick: () => navigate("/retain/upload") }}
      />
    );
  }

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
            <button
              onClick={() => setShowActionModal(true)}
              className="text-sm bg-white/20 hover:bg-white/30 px-4 py-1.5 rounded-lg transition-colors font-medium"
            >
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

      {/* Bulk action modal */}
      {showActionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !isCreating && setShowActionModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-[#293b83]/5 to-transparent border-b border-slate-100 px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-800">Criar ação de retenção</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Para {selectedRows.size} empresa{selectedRows.size > 1 ? "s" : ""} selecionada{selectedRows.size > 1 ? "s" : ""}
                </p>
              </div>
              <button
                onClick={() => !isCreating && setShowActionModal(false)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Tipo de ação</label>
                <select
                  value={actionType}
                  onChange={(e) => setActionType(e.target.value)}
                  className="w-full h-9 px-3 text-sm border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#293b83]/30"
                >
                  <option value="call">📞 Ligação</option>
                  <option value="email">✉️ E-mail</option>
                  <option value="whatsapp">💬 WhatsApp</option>
                  <option value="demo">🖥️ Demo</option>
                  <option value="proposal">📄 Proposta</option>
                  <option value="follow_up">🔄 Follow-up</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Prioridade</label>
                <select
                  value={actionPriority}
                  onChange={(e) => setActionPriority(e.target.value)}
                  className="w-full h-9 px-3 text-sm border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#293b83]/30"
                >
                  <option value="high">🔴 Alta</option>
                  <option value="medium">🟡 Média</option>
                  <option value="low">🟢 Baixa</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Descrição <span className="font-normal text-slate-400">(opcional)</span></label>
                <textarea
                  value={actionDescription}
                  onChange={(e) => setActionDescription(e.target.value)}
                  placeholder="Descreva o objetivo desta ação..."
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-700 resize-none focus:outline-none focus:ring-2 focus:ring-[#293b83]/30 placeholder:text-slate-400"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-3">
              {createDone ? (
                <span className="text-sm font-medium text-green-600 flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                  Ações criadas com sucesso!
                </span>
              ) : (
                <>
                  <button
                    onClick={() => setShowActionModal(false)}
                    disabled={isCreating}
                    className="h-9 px-4 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleBulkCreate}
                    disabled={isCreating}
                    className="h-9 px-5 text-sm font-medium bg-[#293b83] text-white rounded-lg hover:bg-[#1e2d6b] disabled:opacity-60 flex items-center gap-2"
                  >
                    {isCreating ? (
                      <>
                        <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" /></svg>
                        Criando...
                      </>
                    ) : (
                      `Criar para ${selectedRows.size} empresa${selectedRows.size > 1 ? "s" : ""}`
                    )}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
