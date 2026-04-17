import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, qs } from "../lib/api";

// ─── Dashboard ───────────────────────────────────────────────────────────────
export function useObtainDashboard() {
  return useQuery({
    queryKey: ["obtain", "dashboard"],
    queryFn: () => api.get<any>("/obtain/dashboard"),
    staleTime: 60_000,
  });
}

// ─── Leads (list) ────────────────────────────────────────────────────────────
export function useObtainLeads(params: {
  page?: number; pageSize?: number; scoreTier?: string;
  status?: string; source?: string; search?: string;
  sortBy?: string; sortDir?: string;
} = {}) {
  return useQuery({
    queryKey: ["obtain", "leads", params],
    queryFn: () => api.get<any>(`/obtain/leads${qs(params)}`),
    staleTime: 30_000,
  });
}

// ─── Lead (single) ──────────────────────────────────────────────────────────
export function useObtainLead(id: string | null) {
  return useQuery({
    queryKey: ["obtain", "leads", id],
    queryFn: () => api.get<any>(`/obtain/leads/${id}`),
    enabled: !!id,
  });
}

// ─── ICP Clusters ────────────────────────────────────────────────────────────
export function useObtainICPClusters() {
  return useQuery({
    queryKey: ["obtain", "icp-clusters"],
    queryFn: () => api.get<any[]>("/obtain/icp-clusters"),
    staleTime: 60_000,
  });
}

// ─── Funnel ──────────────────────────────────────────────────────────────────
import type { FunnelResponse } from "../types";

export function useObtainFunnel() {
  return useQuery({
    queryKey: ["obtain", "funnel"],
    queryFn: () => api.get<FunnelResponse>("/obtain/funnel"),
    staleTime: 60_000,
  });
}

// ─── Campaigns ───────────────────────────────────────────────────────────────
export function useObtainCampaigns() {
  return useQuery({
    queryKey: ["obtain", "campaigns"],
    queryFn: () => api.get<any[]>("/obtain/campaigns"),
    staleTime: 60_000,
  });
}

// ─── Uploads ─────────────────────────────────────────────────────────────────
export function useObtainUploads() {
  return useQuery({
    queryKey: ["obtain", "uploads"],
    queryFn: () => api.get<any[]>("/obtain/uploads"),
    staleTime: 30_000,
  });
}

// ─── Snapshots (per-upload KPIs for evolution timeline) ──────────────────────
export interface ObtainSnapshot {
  uploadId: string;
  uploadedAt: string;
  filename: string;
  leadCount: number;
  wonCount: number;
  conversionRate: number;    // percentage 0–100
  hotPct: number;            // percentage 0–100
  avgLtvPrediction: number;
  avgScore: number;
  avgConversionProb: number;
}
export function useObtainSnapshots() {
  return useQuery({
    queryKey: ["obtain", "snapshots"],
    queryFn: () => api.get<ObtainSnapshot[]>("/obtain/snapshots"),
    staleTime: 60_000,
  });
}

// ─── Delete Obtain Upload ────────────────────────────────────────────────────
export interface ObtainUploadDeleteResult {
  deleted: { leads: number; scores: number; upload: boolean };
}
export function useDeleteObtainUpload() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (uploadId: string) =>
      api.delete<ObtainUploadDeleteResult>(`/obtain/uploads/${uploadId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["obtain"] });
      qc.invalidateQueries({ queryKey: ["data-freshness"] });
    },
  });
}

// ─── Create Lead Action ──────────────────────────────────────────────────────
export function useCreateLeadAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { leadId: string; actionType: string; notes?: string; outcome?: string }) =>
      api.post("/obtain/lead-actions", data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["obtain"] }); },
  });
}

// ─── Upload CSV ──────────────────────────────────────────────────────────────
export function useUploadObtainCSV() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ file, mapping }: { file: File; mapping: Record<string, string> }) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("mapping", JSON.stringify(mapping));
      const res = await fetch("/api/obtain/uploads", {
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
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["obtain"] }); },
  });
}

// ─── Alerts ─────────────────────────────────────────────────────────────────
export function useObtainAlerts(params: { severity?: string; isRead?: string } = {}) {
  return useQuery({
    queryKey: ["obtain", "alerts", params],
    queryFn: () => api.get<any[]>(`/obtain/alerts${qs(params)}`),
    staleTime: 30_000,
  });
}

export function useMarkObtainAlertRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.patch(`/obtain/alerts/${id}/read`, {}),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["obtain", "alerts"] }); },
  });
}

// ─── Data Freshness ─────────────────────────────────────────────────────────
export function useObtainDataFreshness() {
  return useQuery({
    queryKey: ["obtain", "data-freshness"],
    queryFn: () => api.get<{ lastUploadAt: string | null; lastUploadFilename: string | null; totalRecords: number }>("/obtain/data-freshness"),
    staleTime: 60_000,
  });
}

// ─── Lead Score History ─────────────────────────────────────────────────────
export function useLeadScoreHistory(leadId: string | null) {
  return useQuery({
    queryKey: ["obtain", "score-history", leadId],
    queryFn: () => api.get<any[]>(`/obtain/leads/${leadId}/score-history`),
    enabled: !!leadId,
  });
}

// ─── Lead Quality Trend ─────────────────────────────────────────────────────
export function useLeadQualityTrend() {
  return useQuery({
    queryKey: ["obtain", "lead-quality-trend"],
    queryFn: () => api.get<any[]>("/obtain/lead-quality-trend"),
    staleTime: 60_000,
  });
}

// ─── Source LTV (for LifecyclePage chart) ───────────────────────────────────
export function useLifecycleSourceLtv() {
  return useQuery({
    queryKey: ["obtain", "source-ltv"],
    queryFn: () => api.get<{ source: string; ltv: number; leadCount: number }[]>("/obtain/source-ltv"),
    staleTime: 120_000,
  });
}

// ─── Lead Priorities ─────────────────────────────────────────────────────────
export function useObtainLeadPriorities() {
  return useQuery({
    queryKey: ["obtain", "lead-priorities"],
    queryFn: () => api.get<any>("/obtain/lead-priorities"),
    staleTime: 30_000,
  });
}

// ─── Suggest Mapping ────────────────────────────────────────────────────────
export function useSuggestObtainMapping() {
  return useMutation({
    mutationFn: (data: { headers: string[]; sampleRows: Record<string, string>[] }) =>
      api.post<any[]>("/obtain/upload/suggest-mapping", data),
  });
}

// ─── Win Patterns ────────────────────────────────────────────────────────────
export function useObtainWinPatterns() {
  return useQuery({
    queryKey: ["obtain", "win-patterns"],
    queryFn: () => api.get<any>("/obtain/win-patterns"),
    staleTime: 120_000,
  });
}

// ─── Channel Churn Comparison ────────────────────────────────────────────────
export function useChannelChurnComparison() {
  return useQuery({
    queryKey: ["obtain", "channel-churn-comparison"],
    queryFn: () => api.get<any>("/obtain/channel-churn-comparison"),
    staleTime: 120_000,
  });
}
