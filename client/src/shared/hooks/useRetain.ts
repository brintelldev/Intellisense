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
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["retain", "uploads"] }); },
  });
}
