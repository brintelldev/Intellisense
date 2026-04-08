import { useState, useMemo } from "react";
import { Progress } from "./ui/progress";

interface SystemField {
  key: string;
  label: string;
  required?: boolean;
}

interface ColumnMapperProps {
  csvColumns: string[];
  systemFields: SystemField[];
  onMappingChange?: (mapping: Record<string, string>) => void;
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

export function ColumnMapper({ csvColumns, systemFields, onMappingChange }: ColumnMapperProps) {
  const suggestions = useMemo(() => buildSuggestions(csvColumns, systemFields), [csvColumns, systemFields]);

  const [mapping, setMapping] = useState<Record<string, string>>(() => suggestions);
  const [suggested] = useState<Record<string, string>>(suggestions);

  const updateMapping = (fieldKey: string, csvColumn: string) => {
    const newMapping = { ...mapping, [fieldKey]: csvColumn };
    if (!csvColumn) delete newMapping[fieldKey];
    setMapping(newMapping);
    onMappingChange?.(newMapping);
  };

  const mappedColumns = new Set(Object.values(mapping).filter(Boolean));
  const extraColumns = csvColumns.filter(col => !mappedColumns.has(col));

  const mappedCount = Object.values(mapping).filter(Boolean).length;
  const pct = Math.round((mappedCount / systemFields.length) * 100);
  const precision = pct >= 80 ? "Alta" : pct >= 50 ? "Média" : "Baixa";
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
                    {mapped && isSuggested
                      ? <span className="text-amber-600 text-xs font-medium">💡 Sugerido</span>
                      : mapped
                      ? <span className="text-green-600 text-xs font-medium">✓ Mapeado</span>
                      : <span className="text-slate-400 text-xs">— Não mapeado</span>
                    }
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
