import { useQuery } from "@tanstack/react-query";
import { dashboardApi } from "@/api/dashboard/api";
import { queryKeys } from "@/lib/query-client";

export function useDashboard(
  year: number,
  month: number,
  accountId?: string,
  currency?: string,
) {
  return useQuery({
    queryKey: queryKeys.dashboard(year, month, accountId, currency),
    queryFn: ({ signal }) =>
      dashboardApi.summary({ year, month, accountId, currency }, signal),
  });
}
