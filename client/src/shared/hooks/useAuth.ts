import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";

export interface SectorConfig {
  customerLabel: string;
  customersLabel: string;
  revenueLabel: string;
  engagementLabel: string;
  ticketLabel: string;
  tenureLabel: string;
  segments: string[];
  currency: string;
}

export interface Tenant {
  id: string;
  companyName: string;
  sector: string;
  sectorConfig: SectorConfig;
  plan: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  tenantId: string;
  tenant: Tenant;
}

type AuthResponse = { user: Omit<User, "tenant">; tenant: Tenant };

function unwrap(res: AuthResponse): User {
  return { ...res.user, tenant: res.tenant };
}

export function useAuth() {
  return useQuery<User>({
    queryKey: ["auth", "me"],
    queryFn: async () => unwrap(await api.get<AuthResponse>("/auth/me")),
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { email: string; password: string; rememberMe?: boolean }) =>
      unwrap(await api.post<AuthResponse>("/auth/login", data)),
    onSuccess: (user) => {
      queryClient.setQueryData(["auth", "me"], user);
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post("/auth/logout"),
    onSuccess: () => {
      queryClient.clear();
    },
  });
}

export function useRegister() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      name: string;
      email: string;
      password: string;
      companyName: string;
      sector: string;
    }) => unwrap(await api.post<AuthResponse>("/auth/register", data)),
    onSuccess: (user) => {
      queryClient.setQueryData(["auth", "me"], user);
    },
  });
}
