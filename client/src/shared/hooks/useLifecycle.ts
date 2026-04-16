import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";

export function useExecutiveSummary() {
  return useQuery({
    queryKey: ["lifecycle", "executive-summary"],
    queryFn: () => api.get<any>("/lifecycle/executive-summary"),
    staleTime: 60_000,
  });
}
