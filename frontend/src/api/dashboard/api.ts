import { apiFetch } from "../client";
import type { DashboardQuery, DashboardSummary } from "./types";

export const dashboardApi = {
  summary: (
    { year, month, accountId, currency }: DashboardQuery = {},
    signal?: AbortSignal,
  ) => {
    const params = new URLSearchParams();
    if (year) params.set("year", String(year));
    if (month) params.set("month", String(month));
    if (accountId) params.set("account_id", accountId);
    if (currency) params.set("currency", currency);
    return apiFetch<DashboardSummary>(
      `/dashboard${params.size ? `?${params}` : ""}`,
      { signal },
    );
  },
};
