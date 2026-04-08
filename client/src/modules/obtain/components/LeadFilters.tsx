import { Input } from "../../../shared/components/ui/input";
import { Select } from "../../../shared/components/ui/select";
import { Slider } from "../../../shared/components/ui/slider";
import { ScoreTier, LeadStatus } from "../../../data/types";

interface Filters {
  search: string;
  scoreTier: ScoreTier | "all";
  status: LeadStatus | "all";
  source: string;
  icpCluster: string;
  minScore: number;
}

interface Props {
  filters: Filters;
  onChange: (f: Filters) => void;
}

export function LeadFilters({ filters, onChange }: Props) {
  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => onChange({ ...filters, [k]: v });

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100 flex items-center gap-3 flex-wrap">
      <div className="relative flex-1 min-w-[200px]">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
        <Input value={filters.search} onChange={(e) => set("search", e.target.value)} placeholder="Buscar lead por nome ou empresa..." className="pl-9" />
      </div>
      <Select value={filters.scoreTier} onChange={(e) => set("scoreTier", e.target.value as Filters["scoreTier"])} className="w-40">
        <option value="all">Todos os tiers</option>
        <option value="hot">Hot</option>
        <option value="warm">Warm</option>
        <option value="cold">Cold</option>
        <option value="disqualified">Desqualificado</option>
      </Select>
      <Select value={filters.status} onChange={(e) => set("status", e.target.value as Filters["status"])} className="w-44">
        <option value="all">Todos os status</option>
        <option value="new">Novo</option>
        <option value="qualifying">Qualificando</option>
        <option value="contacted">Contactado</option>
        <option value="proposal">Proposta</option>
        <option value="won">Ganho</option>
        <option value="lost">Perdido</option>
      </Select>
      <Select value={filters.source} onChange={(e) => set("source", e.target.value)} className="w-44">
        <option value="all">Todas as origens</option>
        <option value="referral">Indicação</option>
        <option value="event">Feira/Evento</option>
        <option value="paid_social">LinkedIn Ads</option>
        <option value="paid_search">Google Ads</option>
        <option value="outbound">Outbound</option>
      </Select>
      <Select value={filters.icpCluster} onChange={(e) => set("icpCluster", e.target.value)} className="w-52">
        <option value="all">Todos os clusters ICP</option>
        <option value="icp1">Mineradoras Mid-Market</option>
        <option value="icp2">Construtoras Regionais</option>
        <option value="icp3">Anti-ICP</option>
      </Select>
      <div className="flex items-center gap-2 min-w-[160px]">
        <span className="text-xs text-slate-500 whitespace-nowrap">Score ≥ {filters.minScore}</span>
        <Slider
          value={filters.minScore}
          onChange={(v) => set("minScore", v)}
          min={0}
          max={100}
          step={5}
          className="w-24"
        />
      </div>
      <button className="flex items-center gap-2 h-9 px-4 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 whitespace-nowrap">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
        Exportar CSV
      </button>
    </div>
  );
}
