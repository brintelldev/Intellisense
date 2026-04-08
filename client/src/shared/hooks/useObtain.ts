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
export function useObtainFunnel() {
  return useQuery({
    queryKey: ["obtain", "funnel"],
    queryFn: () => api.get<any[]>("/obtain/funnel"),
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
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["obtain", "uploads"] }); },
  });
}
