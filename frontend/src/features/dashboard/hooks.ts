import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { dashboardApi } from "@/api/dashboard/api";
import { queryKeys } from "@/lib/query-client";

export function useDashboard(year: number, month: number, accountId?: string) {
  return useQuery({
    queryKey: queryKeys.dashboard(year, month, accountId),
    queryFn: () => dashboardApi.summary({ year, month, accountId }),
    // Keep the previous month on screen while the next one loads.
    placeholderData: keepPreviousData,
  });
}
