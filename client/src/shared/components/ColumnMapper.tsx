import { useState, useMemo, useEffect } from "react";
import { Progress } from "./ui/progress";

interface SystemField {
  key: string;
  label: string;
  required?: boolean;
}

interface ServerSuggestion {
  csvColumn: string;
  suggestedDimension: string | null;
  confidence: "high" | "medium" | "low";
  confidenceScore: number;
  reason: string;
}

interface ColumnMapperProps {
  csvColumns: string[];
  systemFields: SystemField[];
  onMappingChange?: (mapping: Record<string, string>) => void;
  serverSuggestions?: ServerSuggestion[];
  /** Called whenever the coverage % changes; useful for parent to show a readiness banner */
  onCoverageChange?: (pct: number) => void;
}

// Simple fuzzy match: returns true if col is a good match for label
function fuzzyMatch(col: string, label: string): boolean {
  const c = col.toLowerCase().replace(/[_\-\s]/g, "");
  const l = label.toLowerCase().replace(/[_\-\s]/g, "");
  // Direct contains
  if (c.includes(l) || l.includes(c)) return true;
  // Common abbreviation pairs
  const aliases: Record<string, string[]> = {
    receita: ["revenue", "mrr", "arr", "faturamento"],
    cliente: ["customer", "client", "empresa", "company"],
    nome: ["name", "razaosocial"],
    email: ["mail"],
    telefone: ["phone", "tel", "fone"],
    segmento: ["segment", "setor", "sector"],
    churn: ["cancelamento", "cancellation"],
    saude: ["health", "score", "nps"],
    engajamento: ["engagement", "uso", "usage"],
    tickets: ["ticket", "suporte", "support", "chamados"],
    parceria: ["tenure", "tempo", "contrato"],
    cnpj: ["doc", "document", "cpf"],
  };
  for (const [key, vals] of Object.entries(aliases)) {
    if ((c.includes(key) || vals.some(v => c.includes(v))) &&
        (l.includes(key) || vals.some(v => l.includes(v)))) {
      return true;
    }
  }
  return false;
}

function buildSuggestions(csvColumns: string[], systemFields: SystemField[]): Record<string, string> {
  const used = new Set<string>();
  const result: Record<string, string> = {};
  for (const field of systemFields) {
    for (const col of csvColumns) {
      if (!used.has(col) && fuzzyMatch(col, field.label)) {
        result[field.key] = col;
        used.add(col);
        break;
      }
    }
  }
  return result;
}

function buildServerSuggestions(
  suggestions: ServerSuggestion[],
  systemFields: SystemField[],
): Record<string, string> {
  const result: Record<string, string> = {};
  const fieldKeys = new Set(systemFields.map(f => f.key));
  for (const s of suggestions) {
    if (s.suggestedDimension && fieldKeys.has(s.suggestedDimension) && s.confidenceScore > 0.3) {
      result[s.suggestedDimension] = s.csvColumn;
    }
  }
  return result;
}

export function ColumnMapper({ csvColumns, systemFields, onMappingChange, serverSuggestions, onCoverageChange }: ColumnMapperProps) {
  const localSuggestions = useMemo(() => buildSuggestions(csvColumns, systemFields), [csvColumns, systemFields]);
  const initialMapping = useMemo(() => {
    if (serverSuggestions && serverSuggestions.length > 0) {
      return buildServerSuggestions(serverSuggestions, systemFields);
    }
    return localSuggestions;
  }, [serverSuggestions, systemFields, localSuggestions]);

  const [mapping, setMapping] = useState<Record<string, string>>(() => initialMapping);
  const [suggested, setSuggested] = useState<Record<string, string>>(initialMapping);

  useEffect(() => {
    if (serverSuggestions && serverSuggestions.length > 0) {
      const built = buildServerSuggestions(serverSuggestions, systemFields);
      setMapping(built);
      setSuggested(built);
      onMappingChange?.(built);
    }
  }, [serverSuggestions]);

  const serverConfidenceMap = useMemo(() => {
    if (!serverSuggestions) return new Map<string, ServerSuggestion>();
    const map = new Map<string, ServerSuggestion>();
    for (const s of serverSuggestions) {
      if (s.suggestedDimension) {
        map.set(s.suggestedDimension, s);
      }
    }
    return map;
  }, [serverSuggestions]);

  const updateMapping = (fieldKey: string, csvColumn: string) => {
    const newMapping = { ...mapping, [fieldKey]: csvColumn };
    if (!csvColumn) delete newMapping[fieldKey];
    setMapping(newMapping);
    onMappingChange?.(newMapping);
    const newMappedCount = Object.values(newMapping).filter(Boolean).length;
    const newPct = Math.round((newMappedCount / systemFields.length) * 100);
    onCoverageChange?.(newPct);
  };

  const mappedColumns = new Set(Object.values(mapping).filter(Boolean));
  const extraColumns = csvColumns.filter(col => !mappedColumns.has(col));

  const mappedCount = Object.values(mapping).filter(Boolean).length;
  const pct = Math.round((mappedCount / systemFields.length) * 100);

  // Business-oriented precision labels (per PLAN_codex item 5.4)
  const precision = pct >= 80
    ? "Diagnóstico completo: score + ICP + LTV + cadência"
    : pct >= 50
    ? "Diagnóstico parcial: score + ICP, LTV aproximado"
    : "Diagnóstico básico: contagem + alertas, score aproximado";
  const precisionColor = pct >= 80 ? "#10B981" : pct >= 50 ? "#f59e0b" : "#ef4444";

  return (
    <div className="space-y-4">
      {/* Progress */}
      <div className="flex items-center justify-between text-sm mb-1">
        <span className="text-slate-600">{mappedCount} de {systemFields.length} dimensões mapeadas</span>
        <span className="font-medium" style={{ color: precisionColor }}>Precisão estimada: {precision}</span>
      </div>
      <Progress value={pct} color={precisionColor} />

      {/* Mapping rows */}
      <div className="border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase">Dimensão do Sistema</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase">Sua Coluna (CSV)</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {systemFields.map((field) => {
              const mapped = mapping[field.key];
              const isSuggested = mapped && suggested[field.key] === mapped;
              return (
                <tr key={field.key} className={mapped ? "bg-green-50/50" : ""}>
                  <td className="px-4 py-2.5">
                    <span className="font-medium text-slate-700">{field.label}</span>
                    {field.required && <span className="ml-1 text-red-400">*</span>}
                  </td>
                  <td className="px-4 py-2.5">
                    <select
                      value={mapping[field.key] ?? ""}
                      onChange={(e) => updateMapping(field.key, e.target.value)}
                      className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#67b4b0] bg-white"
                    >
                      <option value="">— Selecionar</option>
                      {csvColumns.map(col => (
                        <option key={col} value={col}>{col}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-2.5">
                    {(() => {
                      const serverSugg = serverConfidenceMap.get(field.key);
                      if (mapped && isSuggested && serverSugg) {
                        const conf = serverSugg.confidence;
                        if (conf === "high") return <span className="text-xs font-medium bg-green-100 text-green-700 px-2 py-0.5 rounded-full">{"Alta confian\u00e7a"}</span>;
                        if (conf === "medium") return <span className="text-xs font-medium bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">{"M\u00e9dia confian\u00e7a"}</span>;
                        return <span className="text-xs font-medium bg-red-100 text-red-700 px-2 py-0.5 rounded-full">{"Baixa confian\u00e7a"}</span>;
                      }
                      if (mapped && isSuggested) return <span className="text-amber-600 text-xs font-medium">{"\uD83D\uDCA1 Sugerido"}</span>;
                      if (mapped) return <span className="text-green-600 text-xs font-medium">{"\u2713 Mapeado"}</span>;
                      return <span className="text-slate-400 text-xs">{"\u2014 N\u00e3o mapeado"}</span>;
                    })()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Extra columns */}
      {extraColumns.length > 0 && (
        <div className="pt-1">
          <p className="text-xs text-slate-500 mb-2">Colunas extras serão usadas como features adicionais</p>
          <div className="flex flex-wrap gap-1.5">
            {extraColumns.map(col => (
              <span key={col} className="text-xs bg-slate-100 text-slate-500 px-2.5 py-1 rounded-full">{col}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
