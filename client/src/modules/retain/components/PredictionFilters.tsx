import { Input } from "../../../shared/components/ui/input";
import { Select } from "../../../shared/components/ui/select";
import { RiskLevel } from "../../../data/types";

type CustomerStatus = "active" | "at_risk" | "churned" | "all";

interface Filters {
  search: string;
  riskLevel: RiskLevel | "all";
  segment: string;
  status: CustomerStatus;
}

interface Props {
  filters: Filters;
  onChange: (f: Filters) => void;
  segments: string[];
}

export function PredictionFilters({ filters, onChange, segments }: Props) {
  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => onChange({ ...filters, [k]: v });

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100 flex items-center gap-3 flex-wrap">
      <div className="relative flex-1 min-w-[200px]">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <Input
          value={filters.search}
          onChange={(e) => set("search", e.target.value)}
          placeholder="Buscar por nome ou código..."
          className="pl-9"
        />
      </div>
      <Select
        value={filters.riskLevel}
        onChange={(e) => set("riskLevel", e.target.value as Filters["riskLevel"])}
        className="w-44"
      >
        <option value="all">Todos os riscos</option>
        <option value="critical">Crítico</option>
        <option value="high">Alto</option>
        <option value="medium">Médio</option>
        <option value="low">Baixo</option>
      </Select>
      <Select
        value={filters.segment}
        onChange={(e) => set("segment", e.target.value)}
        className="w-52"
      >
        <option value="all">Todos os segmentos</option>
        {segments.map(s => <option key={s} value={s}>{s}</option>)}
      </Select>
      <Select
        value={filters.status}
        onChange={(e) => set("status", e.target.value as CustomerStatus)}
        className="w-40"
      >
        <option value="all">Todos os status</option>
        <option value="active">Ativo</option>
        <option value="at_risk">Em Risco</option>
        <option value="churned">Churned</option>
      </Select>
      <button className="flex items-center gap-2 h-9 px-4 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors whitespace-nowrap">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        Exportar CSV
      </button>
    </div>
  );
}
