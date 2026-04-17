import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { ColumnMapper } from "../../../shared/components/ColumnMapper";
import { Progress } from "../../../shared/components/ui/progress";
import { ExecutiveInsightsStrip } from "../components/ExecutiveInsightsStrip";
import { SnapshotEvolution } from "../../../shared/components/SnapshotEvolution";
import { useObtainUploads, useObtainSnapshots, useUploadObtainCSV, useSuggestObtainMapping, useDeleteObtainUpload } from "../../../shared/hooks/useObtain";
import { LoadingState } from "../../../shared/components/LoadingState";
import { ConfirmDialog } from "../../../shared/components/ConfirmDialog";

const SYSTEM_FIELDS = [
  { key: "id",          label: "Identificador do lead", required: true,  tier: "required"  as const,
    hint: "Código único do lead. Se omitido, o e-mail é usado como chave de upsert para evitar duplicatas ao reimportar." },
  { key: "name",        label: "Nome do contato",       required: true,  tier: "required"  as const,
    hint: "Nome completo da pessoa de contato principal do lead." },
  { key: "company",     label: "Nome da empresa",       required: true,  tier: "required"  as const,
    hint: "Razão social ou nome fantasia da empresa prospectada. Usado no painel de leads e no ICP clustering." },
  { key: "industry",    label: "Setor / Indústria",     required: false, tier: "improves"  as const,
    hint: "Setor de atuação da empresa (ex: Mineração, Construção Civil, Agropecuária). Base para ICP clustering e cruzamento com clientes Retain." },
  { key: "companySize", label: "Porte da empresa",      required: false, tier: "improves"  as const,
    hint: "Tamanho da empresa. Valores aceitos: micro, small, medium, large, enterprise. Influencia o score de ICP e a segmentação." },
  { key: "email",       label: "E-mail",                required: false, tier: "improves"  as const,
    hint: "E-mail do contato. Chave de integração Obtain↔Retain — permite rastrear se o lead virou cliente saudável, em risco ou churnou." },
  { key: "source",      label: "Origem do lead",        required: false, tier: "improves"  as const,
    hint: "Canal de aquisição (outbound, event, referral, paid_search, paid_social, organic, email). Base do ranking CAC vs LTV por canal." },
  { key: "city",        label: "Cidade",                required: false, tier: "optional"  as const,
    hint: "Cidade da empresa. Usado em filtros geográficos e na análise de concentração regional de leads." },
  { key: "state",       label: "Estado",                required: false, tier: "optional"  as const,
    hint: "UF da empresa (sigla de 2 letras). Complementa os filtros geográficos." },
  { key: "phone",       label: "Telefone",              required: false, tier: "optional"  as const,
    hint: "Telefone do contato. Armazenado para consulta no painel de leads, não afeta scoring." },
  { key: "campaign",    label: "Campanha",              required: false, tier: "optional"  as const,
    hint: "Nome da campanha de origem. Deve corresponder a uma campanha já cadastrada para vincular o lead ao ROI da campanha." },
];

const TIER_INFO = {
  required: {
    icon: "✅",
    label: "Obrigatórias",
    description: "Importação básica do lead",
    color: "text-emerald-700",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
  },
  improves: {
    icon: "⚡",
    label: "Melhoram análise",
    description: "Score + ICP + análise de canal",
    color: "text-amber-700",
    bg: "bg-amber-50",
    border: "border-amber-200",
  },
  optional: {
    icon: "ℹ️",
    label: "Opcionais",
    description: "Enriquecimento de contato e geografia",
    color: "text-slate-500",
    bg: "bg-slate-50",
    border: "border-slate-200",
  },
};

async function readCsvHeaders(file: File): Promise<string[]> {
  const text = await file.slice(0, 4096).text();
  const firstLine = text.split(/\r?\n/)[0];
  const sep = firstLine.includes(";") ? ";" : ",";
  return firstLine.split(sep).map(h => h.replace(/^"|"$/g, "").trim()).filter(Boolean);
}

async function readCsvSampleRows(file: File): Promise<{ headers: string[]; sampleRows: Record<string, string>[] }> {
  const text = await file.slice(0, 8192).text();
  const lines = text.split(/\r?\n/).filter(Boolean);
  const sep = lines[0].includes(";") ? ";" : ",";
  const headers = lines[0].split(sep).map(h => h.replace(/^"|"$/g, "").trim());
  const sampleRows: Record<string, string>[] = [];
  for (let i = 1; i < Math.min(lines.length, 4); i++) {
    const vals = lines[i].split(sep).map(v => v.replace(/^"|"$/g, "").trim());
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h] = vals[idx] ?? ""; });
    sampleRows.push(row);
  }
  return { headers, sampleRows };
}

type Step = "upload" | "mapping" | "processing" | "done";

export default function ObtainUploadPage() {
  const [, navigate] = useLocation();
  const { data: apiUploads, isLoading: loadingUploads } = useObtainUploads();
  const { data: snapshots } = useObtainSnapshots();
  const uploadMutation = useUploadObtainCSV();
  const suggestMappingMutation = useSuggestObtainMapping();
  const deleteMutation = useDeleteObtainUpload();
  const [pendingDelete, setPendingDelete] = useState<{ id: string; filename: string } | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [step, setStep] = useState<Step>("upload");
  const [filename, setFilename] = useState("");
  const [csvColumns, setCsvColumns] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [uploadResult, setUploadResult] = useState<any>(null);
  const [serverSuggestions, setServerSuggestions] = useState<any[] | undefined>(undefined);
  const [coveragePct, setCoveragePct] = useState<number>(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const fileObjRef = useRef<File | null>(null);

  const handleFile = async (file: File) => {
    fileObjRef.current = file;
    setFilename(file.name);
    setMapping({});
    setError(null);
    setServerSuggestions(undefined);
    const headers = await readCsvHeaders(file);
    setCsvColumns(headers);
    setStep("mapping");
    readCsvSampleRows(file).then((parsed) => {
      suggestMappingMutation.mutate(parsed, {
        onSuccess: (data: any) => { setServerSuggestions(data); },
      });
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleProcess = () => {
    setError(null);
    const requiredFields = SYSTEM_FIELDS.filter(f => f.required);
    const missing = requiredFields.filter(f => !mapping[f.key]);
    if (missing.length > 0) {
      setError(`Mapeie os campos obrigatórios: ${missing.map(f => f.label).join(", ")}`);
      return;
    }
    if (!fileObjRef.current) return;

    setStep("processing");
    uploadMutation.mutate(
      { file: fileObjRef.current, mapping },
      {
        onSuccess: (data) => {
          setUploadResult(data);
          setStep("done");
        },
        onError: (err) => {
          setError(err.message);
          setStep("mapping");
        },
      }
    );
  };

  const reset = () => {
    setStep("upload");
    setFilename("");
    setCsvColumns([]);
    setMapping({});
    setError(null);
    setUploadResult(null);
    setServerSuggestions(undefined);
    fileObjRef.current = null;
  };

  const uploads = apiUploads ?? [];

  return (
    <div className="space-y-6 w-full">
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-bold text-slate-900">Importar Leads</h1>
        <span className="text-xs font-semibold bg-[#10B981]/10 text-[#10B981] px-2.5 py-1 rounded-full">Obtain Sense</span>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {(["upload", "mapping", "processing", "done"] as Step[]).map((s, i) => {
          const labels = ["Upload", "Mapeamento", "Processando", "Concluído"];
          const done = ["upload", "mapping", "processing", "done"].indexOf(step) > i;
          const active = step === s;
          return (
            <div key={s} className="flex items-center gap-2">
              {i > 0 && <div className="w-8 h-px bg-slate-200" />}
              <div className={`flex items-center gap-1.5 text-xs font-medium ${active ? "text-[#10B981]" : done ? "text-slate-500" : "text-slate-300"}`}>
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${active ? "bg-[#10B981] text-white" : done ? "bg-slate-400 text-white" : "bg-slate-200 text-slate-400"}`}>
                  {done ? "✓" : i + 1}
                </div>
                {labels[i]}
              </div>
            </div>
          );
        })}
      </div>

      {/* Upload step */}
      {step === "upload" && (
        <div className="space-y-4">
          {/* Field checklist — 3 tiers */}
          <div className="grid grid-cols-3 gap-3">
            {(["required", "improves", "optional"] as const).map(tier => {
              const info = TIER_INFO[tier];
              const fields = SYSTEM_FIELDS.filter(f => f.tier === tier);
              return (
                <div key={tier} className={`rounded-xl border p-4 ${info.bg} ${info.border}`}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-base">{info.icon}</span>
                    <span className={`text-sm font-semibold ${info.color}`}>{info.label}</span>
                  </div>
                  <p className="text-sm text-slate-500 mb-3">{info.description}</p>
                  <ul className="space-y-1">
                    {fields.map(f => (
                      <li key={f.key} className="text-sm text-slate-600 flex items-center gap-1.5">
                        <span className="w-1 h-1 rounded-full bg-slate-400 flex-shrink-0" />
                        {f.label}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>

          {/* Template download */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500">Não tem um CSV? Baixe um template:</span>
            {[
              { sector: "generico", label: "Genérico" },
              { sector: "construcao", label: "Construção" },
              { sector: "mineracao", label: "Mineração" },
            ].map(t => (
              <a
                key={t.sector}
                href={`/api/obtain/templates/${t.sector}`}
                download
                onClick={(e) => e.stopPropagation()}
                className="text-sm font-medium text-[#10B981] hover:text-[#059669] underline underline-offset-2"
              >
                {t.label}
              </a>
            ))}
          </div>

          {/* Drop zone */}
          <div
            className="border-2 border-dashed border-slate-200 rounded-xl p-10 text-center hover:border-[#10B981] hover:bg-[#10B981]/5 transition-colors cursor-pointer"
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => fileRef.current?.click()}
          >
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
            <svg className="w-10 h-10 text-slate-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
            <p className="text-slate-600 font-medium">Arraste seu arquivo CSV aqui</p>
            <p className="text-xs text-slate-400 mt-1">ou clique para selecionar — máx. 50MB</p>
            <p className="text-xs text-slate-400 mt-3">Formatos aceitos: .csv com separador vírgula ou ponto-e-vírgula</p>
          </div>
        </div>
      )}

      {/* Mapping step */}
      {step === "mapping" && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center gap-3">
            <svg className="w-5 h-5 text-blue-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
            <p className="text-sm text-blue-700">Arquivo <strong>{filename}</strong> — <strong>{csvColumns.length} colunas</strong> detectadas — mapeie para os campos do sistema</p>
          </div>
          <ColumnMapper
            csvColumns={csvColumns}
            systemFields={SYSTEM_FIELDS}
            onMappingChange={setMapping}
            serverSuggestions={serverSuggestions}
            onCoverageChange={setCoveragePct}
          />
          {/* Readiness banner */}
          {coveragePct > 0 && (
            <div className={`flex items-center gap-3 rounded-lg px-4 py-3 border text-sm ${
              coveragePct >= 80
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : coveragePct >= 50
                ? "bg-amber-50 border-amber-200 text-amber-800"
                : "bg-red-50 border-red-200 text-red-800"
            }`}>
              <span className="font-bold">{coveragePct}%</span>
              <span className="flex-1">
                {coveragePct >= 80
                  ? "Diagnóstico completo: score + ICP + LTV + cadência disponíveis"
                  : coveragePct >= 50
                  ? "Diagnóstico parcial: score + ICP disponíveis, LTV aproximado"
                  : "Diagnóstico básico: adicione Setor, Porte e Origem para análise completa"}
              </span>
            </div>
          )}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 flex items-center gap-2">
              <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
              {error}
            </div>
          )}
          <div className="flex gap-3">
            <button onClick={reset} className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">Cancelar</button>
            <button onClick={handleProcess} className="px-6 py-2 bg-[#10B981] text-white text-sm font-medium rounded-lg hover:bg-[#059669] transition-colors">
              Importar Leads
            </button>
          </div>
        </div>
      )}

      {/* Processing step */}
      {step === "processing" && (
        <div className="bg-white rounded-xl p-8 shadow-sm border border-slate-100 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-[#10B981]/10 flex items-center justify-center mx-auto">
            <svg className="w-8 h-8 text-[#10B981] animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
          </div>
          <p className="font-semibold text-slate-800">Processando e calculando scores...</p>
          <Progress value={undefined} color="#10B981" className="max-w-xs mx-auto" />
          <p className="text-sm text-slate-500">Aguarde enquanto processamos o arquivo...</p>
        </div>
      )}

      {/* Done step */}
      {step === "done" && (
        <div className="bg-white rounded-xl p-8 shadow-sm border border-slate-100 space-y-4">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 rounded-full bg-[#10B981]/10 flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-[#10B981]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <p className="font-semibold text-slate-800 text-lg">{"Importação concluída!"}</p>
          </div>
          {uploadResult && (
            <>
            {/* Intelligence Summary */}
            {uploadResult.intelligenceSummary && (
              <div className="space-y-3 mb-4">
                {/* Hero banner — counts */}
                <div className="bg-gradient-to-r from-[#10B981]/10 to-emerald-50 rounded-xl p-4 border border-[#10B981]/20">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 rounded-full bg-[#10B981] flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800 text-sm">Análise de Inteligência Concluída</p>
                      <p className="text-xs text-slate-500">Scores calculados e prioridades identificadas</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-white/70 rounded-lg p-2.5 text-center">
                      <p className="text-xl font-bold text-[#10B981]">{uploadResult.intelligenceSummary.hotLeadsCount}</p>
                      <p className="text-[10px] text-slate-500">Leads Hot 🔥</p>
                    </div>
                    <div className="bg-white/70 rounded-lg p-2.5 text-center">
                      <p className="text-xl font-bold text-amber-600">{uploadResult.intelligenceSummary.warmLeadsCount}</p>
                      <p className="text-[10px] text-slate-500">Leads Warm 🌡️</p>
                    </div>
                    <div className="bg-white/70 rounded-lg p-2.5 text-center">
                      <p className="text-sm font-bold text-slate-800">{uploadResult.intelligenceSummary.totalLtvPipeline >= 1000000 ? `R$${(uploadResult.intelligenceSummary.totalLtvPipeline/1000000).toFixed(1)}M` : `R$${Math.round(uploadResult.intelligenceSummary.totalLtvPipeline/1000)}K`}</p>
                      <p className="text-[10px] text-slate-500">LTV Total</p>
                    </div>
                  </div>
                </div>

                {/* Executive Insights Strip (full variant) */}
                <ExecutiveInsightsStrip
                  data={uploadResult.intelligenceSummary}
                  variant="full"
                />

                {/* Top hot leads */}
                {uploadResult.intelligenceSummary.topHotLeads?.length > 0 && (
                  <div className="bg-white border border-slate-100 rounded-xl p-4">
                    <p className="text-xs font-semibold text-slate-600 mb-2">🔥 Top Leads Hot</p>
                    {uploadResult.intelligenceSummary.topHotLeads.slice(0, 3).map((lead: any, i: number) => (
                      <div key={i} className="flex items-center justify-between py-1.5 border-b border-slate-50 last:border-0">
                        <div>
                          <p className="text-sm font-semibold text-slate-800">{lead.name}</p>
                          <p className="text-xs text-slate-500">{lead.company} · Score {lead.score}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-bold text-[#10B981]">
                            {lead.ltvPrediction >= 1000000 ? `R$${(lead.ltvPrediction/1000000).toFixed(1)}M` : `R$${Math.round(lead.ltvPrediction/1000)}K`} LTV
                          </p>
                          <p className="text-[10px] text-slate-500 line-clamp-1 max-w-[140px]">{lead.recommendedAction.split(".")[0]}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Best channel */}
                {uploadResult.intelligenceSummary.bestChannel && (
                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex items-center gap-3">
                    <span className="text-xl">🏆</span>
                    <div>
                      <p className="text-xs font-semibold text-slate-700">Melhor canal: {uploadResult.intelligenceSummary.bestChannel.name}</p>
                      <p className="text-xs text-slate-500">
                        {uploadResult.intelligenceSummary.bestChannel.count} leads hot · LTV médio {uploadResult.intelligenceSummary.bestChannel.avgLtv >= 1000 ? `R$${Math.round(uploadResult.intelligenceSummary.bestChannel.avgLtv/1000)}K` : `R$${uploadResult.intelligenceSummary.bestChannel.avgLtv}`}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="bg-slate-50 rounded-lg p-3 text-center border border-slate-100">
                <p className="text-2xl font-bold text-slate-800">{uploadResult.rowsCreated ?? 0}</p>
                <p className="text-xs text-slate-500">Registros criados</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-3 text-center border border-slate-100">
                <p className="text-2xl font-bold text-slate-800">{uploadResult.rowsUpdated ?? 0}</p>
                <p className="text-xs text-slate-500">Registros atualizados</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-3 text-center border border-slate-100">
                <p className="text-2xl font-bold text-slate-800">{uploadResult.rowsSkipped ?? 0}</p>
                <p className="text-xs text-slate-500">Registros ignorados</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-3 text-center border border-slate-100">
                <p className="text-2xl font-bold text-[#10B981]">{uploadResult.scoresGenerated ?? 0}</p>
                <p className="text-xs text-slate-500">Scores gerados</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-3 text-center border border-slate-100">
                <p className="text-2xl font-bold text-amber-600">{uploadResult.alertsGenerated ?? 0}</p>
                <p className="text-xs text-slate-500">Alertas gerados</p>
              </div>
            </div>
            </>
          )}
          <div className="flex gap-3 justify-center">
            <button onClick={reset} className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">{"Nova importação"}</button>
            <button onClick={() => navigate("/obtain")} className="px-6 py-2 border border-[#10B981] text-[#10B981] text-sm font-medium rounded-lg hover:bg-[#10B981]/5 transition-colors">
              Ver Alertas
            </button>
            <a href="/obtain/leads" className="px-6 py-2 bg-[#10B981] text-white text-sm font-medium rounded-lg hover:bg-[#059669] transition-colors">
              Ver Leads
            </a>
          </div>
        </div>
      )}

      {/* Evolution timeline (only shown when ≥2 uploads) */}
      <SnapshotEvolution mode="obtain" snapshots={snapshots ?? []} />

      {/* Upload history */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100">
          <h3 className="font-semibold text-slate-700 text-sm">Histórico de Importações</h3>
        </div>
        {deleteError && (
          <div className="mx-4 mt-3 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {deleteError}
          </div>
        )}
        {loadingUploads ? <div className="p-4"><LoadingState rows={3} /></div> : (
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50">
              <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3">Arquivo</th>
              <th className="text-right text-xs font-semibold text-slate-500 px-4 py-3">Data</th>
              <th className="text-right text-xs font-semibold text-slate-500 px-4 py-3">Leads</th>
              <th className="text-right text-xs font-semibold text-slate-500 px-4 py-3">Status</th>
              <th className="text-right text-xs font-semibold text-slate-500 px-4 py-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {uploads.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-sm text-slate-400">Nenhum upload ainda</td></tr>
            ) : uploads.map((u: any) => (
              <tr key={u.id} className="border-t border-slate-50">
                <td className="px-4 py-3 text-sm text-slate-700">{u.filename}</td>
                <td className="text-right px-4 py-3 text-sm text-slate-500">{new Date(u.uploadedAt).toLocaleDateString("pt-BR")}</td>
                <td className="text-right px-4 py-3 text-sm font-medium text-slate-700">{u.rowsCount ?? "—"}</td>
                <td className="text-right px-4 py-3">
                  {u.status === "completed" && <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">Concluído</span>}
                  {u.status === "processing" && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">Processando</span>}
                  {u.status === "failed" && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">Falhou</span>}
                  {u.status === "pending" && <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">Pendente</span>}
                </td>
                <td className="text-right px-4 py-3">
                  <button
                    type="button"
                    onClick={() => { setDeleteError(null); setPendingDelete({ id: u.id, filename: u.filename }); }}
                    disabled={u.status === "processing"}
                    className="text-xs font-medium text-red-600 hover:text-red-700 hover:underline disabled:opacity-40 disabled:no-underline disabled:cursor-not-allowed"
                  >
                    Remover
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        )}
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Remover este upload?"
        variant="danger"
        confirmLabel="Remover"
        isPending={deleteMutation.isPending}
        message={
          <>
            <p>
              Isso apagará o registro do upload <strong>{pendingDelete?.filename}</strong> e{" "}
              <strong>todos os leads e scores criados por ele</strong>.
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Leads apenas atualizados por este upload (não criados) permanecem. Esta ação não pode ser desfeita.
            </p>
          </>
        }
        onCancel={() => { if (!deleteMutation.isPending) setPendingDelete(null); }}
        onConfirm={() => {
          if (!pendingDelete) return;
          deleteMutation.mutate(pendingDelete.id, {
            onSuccess: () => setPendingDelete(null),
            onError: (err: any) => {
              setDeleteError(err?.message ?? "Falha ao remover upload");
              setPendingDelete(null);
            },
          });
        }}
      />
    </div>
  );
}
