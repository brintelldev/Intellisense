// client/src/shared/components/chat/ToolCallChip.tsx
//
// Chip compacto que mostra uma tool call no chat.
// Estados: running (ícone de spinner), ok (check verde), error (x vermelho).

import { cn } from "../../lib/utils";
import type { ChatToolCall } from "../../hooks/useChatStream";

/** Labels amigáveis em pt-BR para cada tool conhecida. */
const TOOL_LABELS: Record<string, string> = {
  get_overview_metrics: "Visão geral da base",
  list_customers_at_risk: "Clientes em risco",
  get_customer_detail: "Detalhe do cliente",
  get_churn_root_causes: "Causas de churn",
  get_revenue_at_risk_breakdown: "Receita em risco",
  get_nps_breakdown: "NPS da base",
  list_leads_by_score: "Leads por score",
  get_lead_detail: "Detalhe do lead",
  get_icp_clusters: "Clusters ICP",
  compare_acquisition_channels: "Canais de aquisição",
  get_funnel_analysis: "Análise do funil",
  get_temporal_trend: "Tendência temporal",
};

function toolLabel(name: string): string {
  return TOOL_LABELS[name] ?? name;
}

interface ToolCallChipProps {
  toolCall: ChatToolCall;
  /** Se for a tool call ativa (ainda rodando). */
  running?: boolean;
}

export function ToolCallChip({ toolCall, running }: ToolCallChipProps) {
  const hasError = !!toolCall.error;
  const isDone = !running && !hasError && toolCall.durationMs != null;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 text-[11px] font-medium rounded-full px-2 py-0.5 border",
        running && "bg-sky-50 border-sky-200 text-sky-700",
        isDone && "bg-slate-50 border-slate-200 text-slate-600",
        hasError && "bg-red-50 border-red-200 text-red-700",
      )}
      title={hasError ? toolCall.error : undefined}
    >
      {running ? (
        <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
          <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
      ) : hasError ? (
        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none">
          <path d="M6 6L18 18M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      ) : (
        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none">
          <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
      <span>{running ? "Consultando: " : ""}{toolLabel(toolCall.name)}</span>
      {isDone && toolCall.durationMs != null && (
        <span className="text-slate-400">· {toolCall.durationMs}ms</span>
      )}
    </div>
  );
}
