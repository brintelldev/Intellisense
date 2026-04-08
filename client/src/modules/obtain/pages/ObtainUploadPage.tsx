import { useState, useRef } from "react";
import { ColumnMapper } from "../../../shared/components/ColumnMapper";
import { Progress } from "../../../shared/components/ui/progress";
import { useObtainUploads, useUploadObtainCSV } from "../../../shared/hooks/useObtain";
import { LoadingState } from "../../../shared/components/LoadingState";

const SYSTEM_FIELDS = [
  { key: "id", label: "Identificador do lead", required: true },
  { key: "name", label: "Nome do contato", required: true },
  { key: "company", label: "Nome da empresa", required: true },
  { key: "industry", label: "Setor / Indústria" },
  { key: "companySize", label: "Porte da empresa" },
  { key: "city", label: "Cidade" },
  { key: "state", label: "Estado" },
  { key: "email", label: "E-mail" },
  { key: "phone", label: "Telefone" },
  { key: "source", label: "Origem do lead" },
  { key: "campaign", label: "Campanha" },
];

async function readCsvHeaders(file: File): Promise<string[]> {
  const text = await file.slice(0, 4096).text();
  const firstLine = text.split(/\r?\n/)[0];
  const sep = firstLine.includes(";") ? ";" : ",";
  return firstLine.split(sep).map(h => h.replace(/^"|"$/g, "").trim()).filter(Boolean);
}

type Step = "upload" | "mapping" | "processing" | "done";

export default function ObtainUploadPage() {
  const { data: apiUploads, isLoading: loadingUploads } = useObtainUploads();
  const uploadMutation = useUploadObtainCSV();

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
        <div
          className="border-2 border-dashed border-slate-200 rounded-xl p-12 text-center hover:border-[#10B981] hover:bg-[#10B981]/5 transition-colors cursor-pointer"
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => fileRef.current?.click()}
        >
          <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
          <svg className="w-12 h-12 text-slate-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
          <p className="text-slate-600 font-medium">Arraste seu arquivo CSV aqui</p>
          <p className="text-xs text-slate-400 mt-1">ou clique para selecionar — máx. 50MB</p>
          <p className="text-xs text-slate-400 mt-3">Formatos aceitos: .csv com separador vírgula ou ponto-e-vírgula</p>
        </div>
      )}

      {/* Mapping step */}
      {step === "mapping" && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center gap-3">
            <svg className="w-5 h-5 text-blue-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
            <p className="text-sm text-blue-700">Arquivo <strong>{filename}</strong> — <strong>{csvColumns.length} colunas</strong> detectadas — mapeie para os campos do sistema</p>
          </div>
          <ColumnMapper csvColumns={csvColumns} systemFields={SYSTEM_FIELDS} onMappingChange={setMapping} />
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
        <div className="bg-white rounded-xl p-8 shadow-sm border border-slate-100 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-[#10B981]/10 flex items-center justify-center mx-auto">
            <svg className="w-8 h-8 text-[#10B981]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <div>
            <p className="font-semibold text-slate-800 text-lg">Importação concluída!</p>
            <p className="text-sm text-slate-500 mt-1">
              {rowsCount != null ? `${rowsCount} lead${rowsCount !== 1 ? "s" : ""} importado${rowsCount !== 1 ? "s" : ""}` : "Arquivo processado"} · Pronto para análise
            </p>
          </div>
          <div className="flex gap-3 justify-center">
            <button onClick={reset} className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">Nova importação</button>
            <a href="/obtain/leads" className="px-6 py-2 bg-[#10B981] text-white text-sm font-medium rounded-lg hover:bg-[#059669] transition-colors">
              Ver Leads
            </a>
          </div>
        </div>
      )}

      {/* Upload history */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100">
          <h3 className="font-semibold text-slate-700 text-sm">Histórico de Importações</h3>
        </div>
        {loadingUploads ? <div className="p-4"><LoadingState rows={3} /></div> : (
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50">
              <th className="text-left text-xs font-semibold text-slate-500 px-4 py-3">Arquivo</th>
              <th className="text-right text-xs font-semibold text-slate-500 px-4 py-3">Data</th>
              <th className="text-right text-xs font-semibold text-slate-500 px-4 py-3">Leads</th>
              <th className="text-right text-xs font-semibold text-slate-500 px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {uploads.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-sm text-slate-400">Nenhum upload ainda</td></tr>
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
              </tr>
            ))}
          </tbody>
        </table>
        )}
      </div>
    </div>
  );
}
