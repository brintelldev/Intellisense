import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { ColumnMapper } from "../../../shared/components/ColumnMapper";
import { Progress } from "../../../shared/components/ui/progress";
import { LoadingState } from "../../../shared/components/LoadingState";
import { ConfirmDialog } from "../../../shared/components/ConfirmDialog";
import { SnapshotEvolution } from "../../../shared/components/SnapshotEvolution";
import {
  useRetainUploads,
  useRetainSnapshots,
  useUploadRetainCSV,
  useSuggestRetainMapping,
  usePreviewRetainUpload,
  useDeleteRetainUpload,
} from "../../../shared/hooks/useRetain";

const SYSTEM_FIELDS = [
  { key: "id",                   label: "Identificador do cliente",   required: true,  tier: "required" as const,
    hint: "Código único do cliente — número de contrato, CNPJ ou código ERP. Usado para atualizar o registro sem duplicar ao reimportar." },
  { key: "name",                 label: "Nome",                        required: true,  tier: "required" as const,
    hint: "Razão social ou nome fantasia do cliente. Aparece em alertas, predições e no painel de empresas." },
  { key: "revenue",              label: "Receita / Valor do Contrato", required: true,  tier: "required" as const,
    hint: "MRR ou valor total do contrato em reais. Base do cálculo de receita em risco, ROI de retenção e ranking de prioridade." },
  { key: "satisfaction",         label: "Satisfação / NPS",            required: false, tier: "improves" as const,
    hint: "Nota de satisfação ou NPS. Escalas 0–10, 1–5 e 0–100 são detectadas automaticamente. Forte preditor de churn." },
  { key: "contractRemainingDays",label: "Vínculo contratual",          required: false, tier: "improves" as const,
    hint: "Dias restantes até o vencimento do contrato — ou data no formato DD/MM/AAAA. Ativa alertas de renovação antecipada." },
  { key: "usageIntensity",       label: "Intensidade de uso",          required: false, tier: "improves" as const,
    hint: "Percentual de uso do produto ou plataforma (0–100). Uso baixo é um dos principais preditores de cancelamento." },
  { key: "paymentRegularity",    label: "Regularidade de pagamento",   required: false, tier: "improves" as const,
    hint: "Percentual de pagamentos realizados no prazo (0–100). Inadimplência crescente eleva significativamente o risco de churn." },
  { key: "tenureDays",           label: "Tempo de relacionamento",     required: false, tier: "improves" as const,
    hint: "Dias desde o início do contrato ou primeira compra. Clientes com menos de 90 dias têm risco de churn estruturalmente maior." },
  { key: "interactionFrequency", label: "Frequência de interação",     required: false, tier: "optional" as const,
    hint: "Número de contatos registrados (reuniões, e-mails, ligações) por período. Baixa frequência indica risco de distanciamento." },
  { key: "supportVolume",        label: "Volume de suporte",           required: false, tier: "optional" as const,
    hint: "Número de chamados ou tickets abertos nos últimos 30 dias. Picos elevados indicam insatisfação ou problemas operacionais recorrentes." },
  { key: "recencyDays",          label: "Recência",                    required: false, tier: "optional" as const,
    hint: "Dias desde o último contato registrado. Quanto maior o valor, maior o risco de inatividade e distanciamento do cliente." },
];

const TIER_INFO = {
  required: {
    icon: "✅",
    label: "Obrigatórias",
    description: "Importação básica do cliente",
    color: "text-emerald-700",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
  },
  improves: {
    icon: "⚡",
    label: "Melhoram análise",
    description: "Score de saúde + predição de churn",
    color: "text-amber-700",
    bg: "bg-amber-50",
    border: "border-amber-200",
  },
  optional: {
    icon: "ℹ️",
    label: "Opcionais",
    description: "Análise comportamental avançada",
    color: "text-slate-500",
    bg: "bg-slate-50",
    border: "border-slate-200",
  },
};

const DIM_LABELS: Record<string, string> = {
  revenue: "Receita",
  paymentRegularity: "Pagamentos",
  tenureDays: "Tempo de cliente",
  interactionFrequency: "Interações",
  supportVolume: "Chamados",
  satisfaction: "NPS / Satisfação",
  contractRemainingDays: "Contrato",
  usageIntensity: "Uso",
  recencyDays: "Recência",
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
  for (let i = 1; i < Math.min(lines.length, 6); i++) {
    const vals = lines[i].split(sep).map(v => v.replace(/^"|"$/g, "").trim());
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h] = vals[idx] ?? ""; });
    sampleRows.push(row);
  }
  return { headers, sampleRows };
}

type Step = "upload" | "mapping" | "preview" | "processing" | "done";

const SCALE_LABELS: Record<string, string> = {
  "likert-5": "Escala Likert 1-5 (normalizado ×20)",
  "nps-10": "Escala NPS 0-10 (normalizado ×10)",
  "percent-100": "Escala percentual 0-100",
};

function ScaleChip({ scale }: { scale: string }) {
  const label = SCALE_LABELS[scale] ?? scale;
  return (
    <span className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-full font-medium">
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      NPS: {label}
    </span>
  );
}

export default function RetainUploadPage() {
  const [, navigate] = useLocation();
  const { data: apiUploads, isLoading: uploadsLoading } = useRetainUploads();
  const { data: snapshots } = useRetainSnapshots();
  const uploadMutation = useUploadRetainCSV();
  const suggestMappingMutation = useSuggestRetainMapping();
  const previewMutation = usePreviewRetainUpload();
  const deleteMutation = useDeleteRetainUpload();
  const [pendingDelete, setPendingDelete] = useState<{ id: string; filename: string } | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [step, setStep] = useState<Step>("upload");
  const [filename, setFilename] = useState("");
  const [csvColumns, setCsvColumns] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [sampleRowsCache, setSampleRowsCache] = useState<Record<string, string>[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [uploadResult, setUploadResult] = useState<any>(null);
  const [previewData, setPreviewData] = useState<any>(null);
  const [serverSuggestions, setServerSuggestions] = useState<any[] | undefined>(undefined);
  const fileRef = useRef<HTMLInputElement>(null);
  const fileObjRef = useRef<File | null>(null);

  const handleFile = async (file: File) => {
    fileObjRef.current = file;
    setFilename(file.name);
    setMapping({});
    setError(null);
    setServerSuggestions(undefined);
    setPreviewData(null);
    const headers = await readCsvHeaders(file);
    setCsvColumns(headers);
    setStep("mapping");
    readCsvSampleRows(file).then((parsed) => {
      setSampleRowsCache(parsed.sampleRows);
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

  const handleGoToPreview = () => {
    setError(null);
    const requiredFields = SYSTEM_FIELDS.filter(f => f.required);
    const missing = requiredFields.filter(f => !mapping[f.key]);
    if (missing.length > 0) {
      setError(`Mapeie os campos obrigatórios: ${missing.map(f => f.label).join(", ")}`);
      return;
    }
    previewMutation.mutate(
      { mapping, sampleRows: sampleRowsCache },
      {
        onSuccess: (data) => {
          setPreviewData(data);
          setStep("preview");
        },
        onError: () => {
          // If preview fails, go straight to commit
          handleProcess();
        },
      }
    );
  };

  const handleProcess = () => {
    setError(null);
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
    setPreviewData(null);
    setServerSuggestions(undefined);
    setSampleRowsCache([]);
    fileObjRef.current = null;
  };

  const uploads = apiUploads ?? [];

  return (
    <div className="space-y-6 w-full">
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-bold text-slate-900">Upload de Dados</h1>
        <span className="text-xs font-semibold bg-[#293b83]/10 text-[#293b83] px-2.5 py-1 rounded-full">Retain Sense</span>
      </div>

      {/* Step indicator */}
      {step !== "done" && (
        <div className="flex items-center gap-1 text-xs">
          {[
            { id: "upload", label: "Upload" },
            { id: "mapping", label: "Mapeamento" },
            { id: "preview", label: "Preview" },
            { id: "processing", label: "Processando" },
          ].map((s, i) => {
            const steps: Step[] = ["upload", "mapping", "preview", "processing"];
            const currentIdx = steps.indexOf(step as Step);
            const thisIdx = i;
            const active = thisIdx === currentIdx;
            const done = thisIdx < currentIdx;
            return (
              <div key={s.id} className="flex items-center gap-1">
                {i > 0 && <div className="w-6 h-px bg-slate-200 mx-1" />}
                <span className={`flex items-center gap-1.5 font-medium px-2 py-0.5 rounded-full transition-colors ${
                  active ? "bg-[#293b83]/10 text-[#293b83]" : done ? "text-green-600" : "text-slate-400"
                }`}>
                  {done
                    ? <span className="w-4 h-4 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-[10px] font-bold">✓</span>
                    : <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${active ? "bg-[#293b83] text-white" : "bg-slate-200 text-slate-500"}`}>{i + 1}</span>
                  }
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Step: upload ───────────────────────────────────────────────────── */}
      {step === "upload" && (
        <div className="space-y-4">
          {/* 3-tier checklist */}
          <div className="grid grid-cols-3 gap-4">
            {(["required", "improves", "optional"] as const).map((tier) => {
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

          {/* Template download links */}
          <p className="text-sm text-slate-500">
            Não tem um CSV?{" "}
            Baixe um template:{" "}
            {[
              { label: "Genérico", sector: "generico" },
              { label: "Mineração", sector: "mineracao" },
            ].map(({ label, sector }, i) => (
              <span key={sector}>
                {i > 0 && " "}
                <a
                  href={`/api/retain/templates/${sector}`}
                  download
                  className="text-sm text-[#293b83] font-medium hover:underline"
                >
                  {label}
                </a>
                {i < 1 && " "}
              </span>
            ))}
          </p>

          {/* Drop zone */}
          <div
            className="bg-white rounded-xl border-2 border-dashed border-slate-200 hover:border-[#293b83] transition-colors cursor-pointer p-10 text-center"
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
          >
            <input ref={fileRef} type="file" accept=".csv,.xlsx" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
            <svg className="w-10 h-10 text-slate-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="text-slate-700 font-medium">Arraste seu arquivo CSV aqui</p>
            <p className="text-sm text-slate-400 mt-1">ou clique para selecionar — máx. 50MB</p>
            <p className="text-xs text-slate-300 mt-1">Formatos aceitos: .csv com separador vírgula ou ponto-e-vírgula</p>
          </div>
        </div>
      )}

      {/* ── Step: mapping ─────────────────────────────────────────────────── */}
      {step === "mapping" && (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100 space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4" /></svg>
            </div>
            <div>
              <p className="font-semibold text-slate-800">{filename}</p>
              <p className="text-xs text-slate-500">{csvColumns.length} colunas detectadas</p>
            </div>
          </div>
          <h3 className="font-semibold text-slate-700">Mapeie suas colunas para as dimensões do Retain Sense</h3>
          <ColumnMapper csvColumns={csvColumns} systemFields={SYSTEM_FIELDS} onMappingChange={setMapping} serverSuggestions={serverSuggestions} />
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 flex items-center gap-2">
              <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
              {error}
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <button onClick={() => setStep("upload")} className="h-10 px-5 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">
              Voltar
            </button>
            <button
              onClick={handleGoToPreview}
              disabled={previewMutation.isPending}
              className="h-10 px-6 bg-[#293b83] text-white rounded-lg text-sm font-semibold hover:bg-[#1e2d6b] disabled:opacity-60 flex items-center gap-2"
            >
              {previewMutation.isPending && <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
              Ver preview interpretado →
            </button>
          </div>
        </div>
      )}

      {/* ── Step: preview ─────────────────────────────────────────────────── */}
      {step === "preview" && previewData && (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100 space-y-5">
          <div>
            <h3 className="font-semibold text-slate-800 text-lg">Preview interpretado</h3>
            <p className="text-sm text-slate-500 mt-1">Veja como o sistema interpretou seus dados antes de commitar. Verifique se os valores fazem sentido.</p>
          </div>

          {/* Detection chips */}
          <div className="flex flex-wrap gap-2">
            <ScaleChip scale={previewData.satisfactionScale} />
            {previewData.dateFormatDetected && (
              <span className="inline-flex items-center gap-1 text-xs bg-purple-50 text-purple-700 border border-purple-200 px-2.5 py-1 rounded-full font-medium">
                📅 Datas detectadas e convertidas em dias
              </span>
            )}
            <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium border ${
              previewData.mappedDimensions >= 7
                ? "bg-green-50 text-green-700 border-green-200"
                : previewData.mappedDimensions >= 5
                ? "bg-amber-50 text-amber-700 border-amber-200"
                : "bg-red-50 text-red-700 border-red-200"
            }`}>
              {previewData.mappedDimensions} de {previewData.totalDimensions} dimensões mapeadas
            </span>
            {previewData.missingDimensions.length > 0 && (
              <span className="inline-flex items-center gap-1 text-xs bg-slate-50 text-slate-500 border border-slate-200 px-2.5 py-1 rounded-full">
                Ausentes: {previewData.missingDimensions.map((d: string) => DIM_LABELS[d] ?? d).join(", ")}
              </span>
            )}
          </div>

          {/* Preview table */}
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase">Empresa</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase">Receita</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase">NPS</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase">Contrato</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase">Chamados</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {previewData.previewRows.map((row: any, i: number) => (
                  <tr key={i} className="hover:bg-slate-50/50">
                    <td className="px-3 py-2.5 font-medium text-slate-800 max-w-[180px] truncate">{row.name}</td>
                    <td className="px-3 py-2.5 text-slate-700 font-mono text-xs">{row.revenue ?? <span className="text-slate-300">—</span>}</td>
                    <td className="px-3 py-2.5">
                      {row.satisfaction ? (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          row.satisfaction.includes("promotor") ? "bg-green-100 text-green-700" :
                          row.satisfaction.includes("neutro") ? "bg-amber-100 text-amber-700" :
                          "bg-red-100 text-red-700"
                        }`}>
                          {row.satisfaction}
                        </span>
                      ) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-3 py-2.5 text-slate-600 text-xs">{row.contractRemainingDays ?? <span className="text-slate-300">—</span>}</td>
                    <td className="px-3 py-2.5 text-slate-600 tabular-nums">{row.supportVolume ?? <span className="text-slate-300">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={() => setStep("mapping")} className="h-10 px-5 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">
              ← Voltar e ajustar mapeamento
            </button>
            <button
              onClick={handleProcess}
              className="h-10 px-6 bg-[#293b83] text-white rounded-lg text-sm font-semibold hover:bg-[#1e2d6b]"
            >
              Confirmar e commitar →
            </button>
          </div>
        </div>
      )}

      {/* ── Step: processing ──────────────────────────────────────────────── */}
      {step === "processing" && (
        <div className="bg-white rounded-xl p-8 shadow-sm border border-slate-100 text-center space-y-4">
          <div className="w-12 h-12 border-4 border-[#293b83] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="font-semibold text-slate-800">Processando registros...</p>
          <div className="max-w-xs mx-auto">
            <Progress value={undefined} color="#293b83" />
          </div>
          <p className="text-xs text-slate-500">Calculando health scores, gerando predições e alertas...</p>
        </div>
      )}

      {/* ── Step: done ────────────────────────────────────────────────────── */}
      {step === "done" && (
        <div className="space-y-4">
          {/* Hero */}
          <div className="bg-gradient-to-br from-[#293b83] to-[#1e2d6b] rounded-xl p-8 text-white">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
              </div>
              <div>
                <p className="text-2xl font-bold">Inteligência gerada!</p>
                {uploadResult && (
                  <p className="text-white/80 text-sm mt-0.5">
                    {(uploadResult.rowsCreated ?? 0) + (uploadResult.rowsUpdated ?? 0)} clientes analisados
                    {uploadResult.alertsGenerated > 0 && ` · ${uploadResult.alertsGenerated} alertas acionáveis`}
                    {uploadResult.intelligenceSummary?.contractsExpiring30d > 0 && ` · ${uploadResult.intelligenceSummary.contractsExpiring30d} contratos vencendo`}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Intelligence Brief */}
          {uploadResult?.intelligenceSummary && (() => {
            const s = uploadResult.intelligenceSummary;
            const fmtBRL = (v: number) => v >= 1_000_000
              ? `R$${(v / 1_000_000).toFixed(1)}M`
              : v >= 1_000
              ? `R$${(v / 1_000).toFixed(0)}K`
              : `R$${v.toFixed(0)}`;
            return (
              <div className="space-y-3">
                {/* Risk + Revenue row */}
                <div className="grid grid-cols-2 gap-3">
                  {s.newCriticalCustomers?.length > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                        <span className="text-xs font-semibold text-red-700 uppercase tracking-wide">Em Zona Crítica</span>
                      </div>
                      <p className="text-2xl font-bold text-red-700">{s.newCriticalCustomers.length}</p>
                      <p className="text-xs text-slate-600 mt-1">
                        {s.newCriticalCustomers.slice(0, 2).map((c: any) => c.name).join(" · ")}
                        {s.newCriticalCustomers.length > 2 ? ` +${s.newCriticalCustomers.length - 2}` : ""}
                      </p>
                    </div>
                  )}
                  {s.totalRevenueAtRisk > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <svg className="w-3 h-3 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        <span className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Receita Sob Risco</span>
                      </div>
                      <p className="text-2xl font-bold text-amber-700">{fmtBRL(s.totalRevenueAtRisk)}</p>
                      {s.deltaRevenueAtRisk !== 0 && (
                        <p className={`text-xs mt-1 ${s.deltaRevenueAtRisk > 0 ? "text-red-600" : "text-green-600"}`}>
                          {s.deltaRevenueAtRisk > 0 ? "↑" : "↓"} {fmtBRL(Math.abs(s.deltaRevenueAtRisk))} vs. upload anterior
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Top Priority */}
                {s.topPriority && (
                  <div className="bg-[#293b83]/5 border border-[#293b83]/20 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <svg className="w-4 h-4 text-[#293b83]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                      <span className="text-xs font-semibold text-[#293b83] uppercase tracking-wide">Ação Prioritária</span>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-slate-900">{s.topPriority.name}</p>
                        <p className="text-xs text-slate-500">{s.topPriority.segment} · {fmtBRL(s.topPriority.revenue)}/mês · Churn {Math.round(s.topPriority.churnProbability * 100)}%</p>
                        {s.topPriority.topFactor && (
                          <p className="text-xs text-slate-600 mt-1">
                            <span className="font-medium">Fator crítico:</span> {s.topPriority.topFactor.label}
                          </p>
                        )}
                        {s.topPriority.recommendedAction && (
                          <p className="text-xs text-[#293b83] font-medium mt-1">{s.topPriority.recommendedAction.split(".")[0]}.</p>
                        )}
                      </div>
                      <span className={`flex-shrink-0 text-xs font-semibold px-2 py-1 rounded-full ${s.topPriority.riskLevel === "critical" ? "bg-red-100 text-red-700" : "bg-orange-100 text-orange-700"}`}>
                        {s.topPriority.riskLevel === "critical" ? "Crítico" : "Alto"}
                      </span>
                    </div>
                  </div>
                )}

                {/* Stats grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-white rounded-xl p-4 text-center border border-slate-100 shadow-sm">
                    <p className="text-3xl font-bold text-slate-900">{uploadResult.rowsCreated ?? 0}</p>
                    <p className="text-xs text-slate-500 mt-1">Novos</p>
                  </div>
                  <div className="bg-white rounded-xl p-4 text-center border border-slate-100 shadow-sm">
                    <p className="text-3xl font-bold text-slate-700">{uploadResult.rowsUpdated ?? 0}</p>
                    <p className="text-xs text-slate-500 mt-1">Atualizados</p>
                  </div>
                  <div className="bg-white rounded-xl p-4 text-center border border-slate-100 shadow-sm">
                    <p className="text-3xl font-bold text-amber-600">{uploadResult.alertsGenerated ?? 0}</p>
                    <p className="text-xs text-slate-500 mt-1">Alertas</p>
                  </div>
                  <div className="bg-white rounded-xl p-4 text-center border border-slate-100 shadow-sm">
                    <p className="text-3xl font-bold text-red-600">{s.contractsExpiring30d ?? 0}</p>
                    <p className="text-xs text-slate-500 mt-1">Contratos &lt;30d</p>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Detection info */}
          {uploadResult && (uploadResult.detectedEncoding || uploadResult.satisfactionScale) && (
            <div className="flex flex-wrap gap-2">
              {uploadResult.detectedEncoding && uploadResult.detectedEncoding !== "UTF-8" && (
                <span className="inline-flex items-center gap-1 text-xs bg-purple-50 text-purple-700 border border-purple-200 px-2.5 py-1 rounded-full font-medium">
                  Encoding detectado: {uploadResult.detectedEncoding}
                </span>
              )}
              {uploadResult.satisfactionScale && (
                <ScaleChip scale={uploadResult.satisfactionScale} />
              )}
              {uploadResult.detectedDelimiter === ";" && (
                <span className="text-xs bg-slate-50 text-slate-600 border border-slate-200 px-2.5 py-1 rounded-full">
                  Delimitador: ponto-e-vírgula (;)
                </span>
              )}
            </div>
          )}

          <div className="flex gap-3 justify-center flex-wrap">
            <button onClick={reset} className="h-10 px-5 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-50">
              Novo upload
            </button>
            <button onClick={() => navigate("/retain/predictions")} className="h-10 px-6 border border-[#293b83] text-[#293b83] rounded-lg text-sm font-semibold hover:bg-[#293b83]/5">
              Ver predições
            </button>
            <button onClick={() => navigate("/retain")} className="h-10 px-6 bg-[#293b83] text-white rounded-lg text-sm font-semibold hover:bg-[#1e2d6b]">
              Ver dashboard →
            </button>
          </div>
        </div>
      )}

      {/* Evolution timeline (only shown when ≥2 uploads) */}
      <SnapshotEvolution mode="retain" snapshots={snapshots ?? []} />

      {/* Previous uploads */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-800">Uploads Anteriores</h3>
        </div>
        {deleteError && (
          <div className="mx-5 mt-3 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {deleteError}
          </div>
        )}
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              {["Arquivo", "Data", "Registros", "Status", "Ações"].map(h => (
                <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {uploadsLoading ? (
              <tr><td colSpan={5} className="p-4"><LoadingState rows={3} /></td></tr>
            ) : uploads.length === 0 ? (
              <tr><td colSpan={5} className="p-4 text-center text-sm text-slate-400">Nenhum upload ainda</td></tr>
            ) : uploads.map((u: any) => (
              <tr key={u.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-800">{u.filename}</td>
                <td className="px-4 py-3 text-slate-500">{new Date(u.uploadedAt).toLocaleDateString("pt-BR")}</td>
                <td className="px-4 py-3 tabular-nums text-slate-600">{u.rowsCount ?? "—"}</td>
                <td className="px-4 py-3">
                  {u.status === "completed" && <span className="text-xs bg-green-100 text-green-700 px-2.5 py-0.5 rounded-full font-medium">✓ Concluído</span>}
                  {u.status === "processing" && <span className="text-xs bg-blue-100 text-blue-700 px-2.5 py-0.5 rounded-full font-medium">Processando</span>}
                  {u.status === "failed" && <span className="text-xs bg-red-100 text-red-700 px-2.5 py-0.5 rounded-full font-medium">Falhou</span>}
                  {u.status === "pending" && <span className="text-xs bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-full font-medium">Pendente</span>}
                </td>
                <td className="px-4 py-3">
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
              <strong>todos os clientes, previsões e alertas criados por ele</strong>.
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Clientes que foram apenas atualizados por este upload (não criados) permanecem. Esta ação não pode ser desfeita.
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
