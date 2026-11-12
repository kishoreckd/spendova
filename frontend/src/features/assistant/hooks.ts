import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { insightsApi } from "@/api/insights/api";
import { queryKeys } from "@/lib/query-client";
export function useFinanceSnapshot() {
  return useQuery({
    queryKey: queryKeys.insights,
    queryFn: ({ signal }) => insightsApi.snapshot(signal),
  });
}
export function useFinanceAssistant() {
  const cache = useQueryClient();
  return useMutation({
    mutationFn: insightsApi.chat,
    retry: false,
    onSettled: () =>
      cache.invalidateQueries({ queryKey: queryKeys.preferences }),
  });
}
