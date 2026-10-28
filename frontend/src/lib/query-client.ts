import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "@/api/client";
import type { TransactionFilters } from "@/api/transactions/types";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      // Client errors (validation, not found, forbidden) will not change on retry.
      retry: (failures, error) =>
        !(
          error instanceof ApiError &&
          error.status >= 400 &&
          error.status < 500
        ) && failures < 2,
    },
  },
});

/** Every server-state key lives here so invalidation stays consistent across features. */
export const queryKeys = {
  accounts: ["accounts"] as const,
  categories: ["categories"] as const,
  transactions: (filters: TransactionFilters = {}) =>
    ["transactions", filters] as const,
  allTransactions: ["transactions", "all"] as const,
  recurring: ["recurring"] as const,
  budgets: ["budgets"] as const,
  budgetStatus: (id: string) => ["budgets", id, "status"] as const,
  goals: ["goals"] as const,
  assets: ["assets"] as const,
  dashboard: (year: number, month: number, accountId?: string) =>
    ["dashboard", year, month, accountId ?? "all"] as const,
  loans: ["loans"] as const,
  loansOverview: ["loans", "overview"] as const,
  loanSchedule: (id: string) => ["loans", id, "schedule"] as const,
};

/**
 * Anything that posts to the ledger changes balances, the dashboard, budget spend,
 * bill due dates and loan progress, so all of those are refetched together.
 */
export function invalidateLedger() {
  return Promise.all(
    [
      "transactions",
      "accounts",
      "dashboard",
      "budgets",
      "recurring",
      "loans",
      "goals",
    ].map((key) => queryClient.invalidateQueries({ queryKey: [key] })),
  );
}
