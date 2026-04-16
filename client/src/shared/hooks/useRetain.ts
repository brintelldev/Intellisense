import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, qs } from "../lib/api";

// ─── Dashboard ───────────────────────────────────────────────────────────────
export function useRetainDashboard() {
  return useQuery({
    queryKey: ["retain", "dashboard"],
    queryFn: () => api.get<any>("/retain/dashboard"),
    staleTime: 60_000,
  });
}

// ─── Predictions (list) ──────────────────────────────────────────────────────
export function useRetainPredictions(params: {
  page?: number; pageSize?: number; riskLevel?: string;
  segment?: string; search?: string; sortBy?: string; sortDir?: string;
} = {}) {
  return useQuery({
    queryKey: ["retain", "predictions", params],
    queryFn: () => api.get<any>(`/retain/predictions${qs(params)}`),
    staleTime: 30_000,
  });
}

// ─── Prediction (single) ────────────────────────────────────────────────────
export function useRetainPrediction(customerId: string | null) {
  return useQuery({
    queryKey: ["retain", "predictions", customerId],
    queryFn: () => api.get<any>(`/retain/predictions/${customerId}`),
    enabled: !!customerId,
  });
}

// ─── Customers (list) ────────────────────────────────────────────────────────
export function useRetainCustomers(params: {
  page?: number; pageSize?: number; riskLevel?: string;
  segment?: string; search?: string; sortBy?: string; sortDir?: string;
} = {}) {
  return useQuery({
    queryKey: ["retain", "customers", params],
    queryFn: () => api.get<any>(`/retain/customers${qs(params)}`),
    staleTime: 30_000,
  });
}

// ─── Churn Causes ────────────────────────────────────────────────────────────
export function useRetainChurnCauses() {
  return useQuery({
    queryKey: ["retain", "churn-causes"],
    queryFn: () => api.get<any[]>("/retain/churn-causes"),
    staleTime: 60_000,
  });
}

// ─── Analytics Trend ─────────────────────────────────────────────────────────
export function useRetainAnalyticsTrend() {
  return useQuery({
    queryKey: ["retain", "analytics-trend"],
    queryFn: () => api.get<any[]>("/retain/analytics/trend"),
    staleTime: 60_000,
  });
}

// ─── Uploads ─────────────────────────────────────────────────────────────────
export function useRetainUploads() {
  return useQuery({
    queryKey: ["retain", "uploads"],
    queryFn: () => api.get<any[]>("/retain/uploads"),
    staleTime: 30_000,
  });
}

// ─── Create Retain Action ────────────────────────────────────────────────────
export function useCreateRetainAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { customerId: string; type: string; description?: string; priority?: string }) =>
      api.post("/retain/actions", data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["retain"] }); },
  });
}

// ─── Upload CSV ──────────────────────────────────────────────────────────────
export function useUploadRetainCSV() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ file, mapping }: { file: File; mapping: Record<string, string> }) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("mapping", JSON.stringify(mapping));
      const res = await fetch("/api/retain/uploads", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Erro ao fazer upload" }));
        throw new Error(err.error ?? "Erro ao fazer upload");
      }
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["retain"] }); },
  });
}

// ─── Alerts ─────────────────────────────────────────────────────────────────
export function useRetainAlerts(params: { severity?: string; isRead?: string } = {}) {
  return useQuery({
    queryKey: ["retain", "alerts", params],
    queryFn: () => api.get<any[]>(`/retain/alerts${qs(params)}`),
    staleTime: 30_000,
  });
}

export function useMarkRetainAlertRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.patch(`/retain/alerts/${id}/read`, {}),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["retain", "alerts"] }); },
  });
}

// ─── Data Freshness ─────────────────────────────────────────────────────────
export function useRetainDataFreshness() {
  return useQuery({
    queryKey: ["retain", "data-freshness"],
    queryFn: () => api.get<{ lastUploadAt: string | null; lastUploadFilename: string | null; totalRecords: number }>("/retain/data-freshness"),
    staleTime: 60_000,
  });
}

// ─── Revenue by Segment ─────────────────────────────────────────────────────
export function useRetainRevenueBySegment() {
  return useQuery({
    queryKey: ["retain", "revenue-by-segment"],
    queryFn: () => api.get<any[]>("/retain/revenue-by-segment"),
    staleTime: 60_000,
  });
}

// ─── Customer Score History ─────────────────────────────────────────────────
export function useCustomerScoreHistory(customerId: string | null) {
  return useQuery({
    queryKey: ["retain", "score-history", customerId],
    queryFn: () => api.get<any[]>(`/retain/customers/${customerId}/score-history`),
    enabled: !!customerId,
  });
}

// ─── Customer Notes ─────────────────────────────────────────────────────────
export function useCustomerNotes(customerId: string | null) {
  return useQuery({
    queryKey: ["retain", "notes", customerId],
    queryFn: () => api.get<any[]>(`/retain/customers/${customerId}/notes`),
    enabled: !!customerId,
  });
}

export function useAddCustomerNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ customerId, type, content }: { customerId: string; type: string; content: string }) =>
      api.post(`/retain/customers/${customerId}/notes`, { type, content }),
    onSuccess: (_, vars) => { qc.invalidateQueries({ queryKey: ["retain", "notes", vars.customerId] }); },
  });
}

// ─── Mark Customer as Churned ───────────────────────────────────────────────
export function useMarkCustomerChurned() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (customerId: string) => api.post(`/retain/customers/${customerId}/churn`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["retain"] });
      qc.invalidateQueries({ queryKey: ["obtain"] }); // feedback loop: ICP recalculates
    },
  });
}

// ─── Revenue Analytics ─────────────────────────────────────────────────────
export function useRetainRevenueAnalytics() {
  return useQuery({
    queryKey: ["retain", "revenue-analytics"],
    queryFn: () => api.get<any>("/retain/revenue-analytics"),
    staleTime: 60_000,
  });
}

// ─── Action Priorities ──────────────────────────────────────────────────────
export function useRetainActionPriorities() {
  return useQuery({
    queryKey: ["retain", "action-priorities"],
    queryFn: () => api.get<any>("/retain/action-priorities"),
    staleTime: 30_000,
  });
}

// ─── Renewals ──────────────────────────────────────────────────────────────
export function useRetainRenewals() {
  return useQuery({
    queryKey: ["retain", "renewals"],
    queryFn: () => api.get<any[]>("/retain/renewals"),
    staleTime: 60_000,
  });
}

// ─── Suggest Mapping ────────────────────────────────────────────────────────
export function useSuggestRetainMapping() {
  return useMutation({
    mutationFn: (data: { headers: string[]; sampleRows: Record<string, string>[] }) =>
      api.post<any[]>("/retain/upload/suggest-mapping", data),
  });
}

export function usePreviewRetainUpload() {
  return useMutation({
    mutationFn: (data: { mapping: Record<string, string>; sampleRows: Record<string, string>[] }) =>
      api.post<{
        previewRows: any[];
        satisfactionScale: string;
        dateFormatDetected: boolean;
        mappedDimensions: number;
        totalDimensions: number;
        missingDimensions: string[];
      }>("/retain/upload/preview", data),
  });
}

export function useRetainVoc() {
  return useQuery({
    queryKey: ["retain", "voc"],
    queryFn: () => api.get<{
      nps: number | null;
      npsDistribution: {
        promoters: number; neutrals: number; detractors: number; total: number;
        promotersPct: number; neutralsPct: number; detractorsPct: number;
      };
      detractorsByRevenue: any[];
      totalDetractorRevenue: number;
      ticketThemes: Array<{ theme: string; count: number }>;
      verbatims: Array<{ name: string; text: string; satisfaction: number | null }>;
      detractorActions: any[];
    }>("/retain/voc"),
    staleTime: 60_000,
  });
}

// ─── Scoring Config ────────────────────────────────────────────────────────
export function useScoringConfig(module: string) {
  return useQuery({
    queryKey: ["scoring-config", module],
    queryFn: () => api.get<{ module: string; configType: string; weights: Record<string, number> }>(`/scoring-config?module=${module}`),
    staleTime: 60_000,
  });
}

export function useSaveScoringConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { module: string; configType: string; weights: Record<string, number> }) =>
      api.put<any>("/scoring-config", data),
    onSuccess: (_, vars) => { qc.invalidateQueries({ queryKey: ["scoring-config", vars.module] }); },
  });
}

export function useRecalculateRetain() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<{ message: string; predictionsGenerated: number; alertsGenerated: number }>("/retain/recalculate", {}),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["retain"] }); },
  });
}

export function useRecalculateObtain() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<{ message: string; scoresGenerated: number; alertsGenerated: number }>("/obtain/recalculate", {}),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["obtain"] }); },
  });
}

// ─── Expansion Opportunities ─────────────────────────────────────────────────
export function useRetainExpansionOpportunities() {
  return useQuery({
    queryKey: ["retain", "expansion-opportunities"],
    queryFn: () => api.get<{
      opportunities: Array<{ id: string; name: string; segment: string; healthScore: number; revenue: number; segmentMedian: number; gap: number; annualPotential: number; riskLevel: string }>;
      totalCount: number;
      totalAnnualPotential: number;
    }>("/retain/expansion-opportunities"),
    staleTime: 120_000,
  });
}

// ─── Analytics History (sparkline for LifecyclePage) ─────────────────────────
export function useRetainAnalyticsHistory() {
  return useQuery({
    queryKey: ["retain", "analytics-history"],
    queryFn: () => api.get<Array<{ month: string; mrr: number; churnRate: number; avgHealthScore: number; revenueAtRisk: number; nrr: number | null }>>("/retain/analytics-history"),
    staleTime: 120_000,
  });
}
