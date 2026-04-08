import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { ColumnMapper } from "../../../shared/components/ColumnMapper";
import { Progress } from "../../../shared/components/ui/progress";
import { LoadingState } from "../../../shared/components/LoadingState";
import { useRetainUploads, useUploadRetainCSV } from "../../../shared/hooks/useRetain";

const SYSTEM_FIELDS = [
  { key: "id", label: "Identificador do cliente", required: true },
  { key: "name", label: "Nome", required: true },
  { key: "revenue", label: "Receita / Valor do Contrato", required: true },
  { key: "paymentRegularity", label: "Regularidade de pagamento" },
  { key: "tenureDays", label: "Tempo de relacionamento" },
  { key: "interactionFrequency", label: "Frequência de interação" },
  { key: "supportVolume", label: "Volume de suporte" },
  { key: "satisfaction", label: "Satisfação" },
  { key: "contractRemainingDays", label: "Vínculo contratual" },
  { key: "usageIntensity", label: "Intensidade de uso" },
  { key: "recencyDays", label: "Recência" },
];

async function readCsvHeaders(file: File): Promise<string[]> {
  const text = await file.slice(0, 4096).text();
  const firstLine = text.split(/\r?\n/)[0];
  const sep = firstLine.includes(";") ? ";" : ",";
  return firstLine.split(sep).map(h => h.replace(/^"|"$/g, "").trim()).filter(Boolean);
}

type Step = "upload" | "mapping" | "processing" | "done";

export default function RetainUploadPage() {
  const [, navigate] = useLocation();
  const { data: apiUploads, isLoading: uploadsLoading } = useRetainUploads();
  const uploadMutation = useUploadRetainCSV();

  const [step, setStep] = useState<Step>("upload");
  const [filename, setFilename] = useState("");
  const [csvColumns, setCsvColumns] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [rowsCount, setRowsCount] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const fileObjRef = useRef<File | null>(null);

  const handleFile = async (file: File) => {
    fileObjRef.current = file;
    setFilename(file.name);
    setMapping({});
    setError(null);
    const headers = await readCsvHeaders(file);
    setCsvColumns(headers);
    setStep("mapping");
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
          setRowsCount(data.rowsCount ?? null);
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
    setRowsCount(null);
    fileObjRef.current = null;
  };

  const uploads = apiUploads ?? [];

  const PROCESSING_MESSAGES = [
    "Enviando arquivo...",
    "Processando registros...",
    "Calculando health scores...",
    "Gerando predições...",
  ];

  return (
    <div className="space-y-6 w-full">
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-bold text-slate-900">Upload de Dados</h1>
        <span className="text-xs font-semibold bg-[#293b83]/10 text-[#293b83] px-2.5 py-1 rounded-full">Retain Sense</span>
      </div>

      {step === "upload" && (
        <div
          className="bg-white rounded-xl border-2 border-dashed border-slate-300 hover:border-[#293b83] transition-colors cursor-pointer p-12 text-center"
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
        >
          <input ref={fileRef} type="file" accept=".csv,.xlsx" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
          <svg className="w-16 h-16 text-slate-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <p className="text-slate-700 font-medium text-lg">Arraste seu arquivo CSV ou clique para selecionar</p>
          <p className="text-sm text-slate-400 mt-1">Formatos aceitos: .csv, .xlsx — Máximo 50MB</p>
        </div>
      )}

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
          <ColumnMapper csvColumns={csvColumns} systemFields={SYSTEM_FIELDS} onMappingChange={setMapping} />
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
            <button onClick={handleProcess} className="h-10 px-6 bg-[#293b83] text-white rounded-lg text-sm font-semibold hover:bg-[#1e2d6b]">
              Confirmar e processar
            </button>
          </div>
        </div>
      )}

      {step === "processing" && (
        <div className="bg-white rounded-xl p-8 shadow-sm border border-slate-100 text-center space-y-4">
          <div className="w-12 h-12 border-4 border-[#293b83] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="font-semibold text-slate-800">{PROCESSING_MESSAGES[1]}</p>
          <div className="max-w-xs mx-auto">
            <Progress value={undefined} color="#293b83" />
          </div>
          <p className="text-xs text-slate-500">Aguarde enquanto processamos o arquivo...</p>
        </div>
      )}

      {step === "done" && (
        <div className="bg-green-50 rounded-xl p-6 border border-green-200 text-center space-y-3">
          <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center mx-auto">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
          </div>
          <p className="text-xl font-bold text-green-800">Processamento completo!</p>
          <p className="text-green-700">
            {rowsCount != null ? `${rowsCount} empresa${rowsCount !== 1 ? "s" : ""} importada${rowsCount !== 1 ? "s" : ""} com sucesso.` : "Arquivo processado com sucesso."}
          </p>
          <div className="flex gap-3 justify-center">
            <button onClick={reset} className="h-10 px-5 border border-green-300 text-green-700 rounded-lg text-sm hover:bg-green-100">
              Novo upload
            </button>
            <button onClick={() => navigate("/retain/predictions")} className="h-10 px-6 bg-[#293b83] text-white rounded-lg text-sm font-semibold hover:bg-[#1e2d6b]">
              Ver predições →
            </button>
          </div>
        </div>
      )}

      {/* Previous uploads */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-800">Uploads Anteriores</h3>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              {["Arquivo", "Data", "Registros", "Status"].map(h => (
                <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {uploadsLoading ? (
              <tr><td colSpan={4} className="p-4"><LoadingState rows={3} /></td></tr>
            ) : uploads.length === 0 ? (
              <tr><td colSpan={4} className="p-4 text-center text-sm text-slate-400">Nenhum upload ainda</td></tr>
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
