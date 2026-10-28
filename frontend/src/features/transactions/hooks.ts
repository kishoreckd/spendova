import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import { transactionsApi } from "@/api/transactions/api";
import type {
  TransactionCreate,
  TransactionFilters,
} from "@/api/transactions/types";
import { invalidateLedger, queryKeys } from "@/lib/query-client";

export function useTransactions(
  filters: TransactionFilters = {},
  enabled = true,
) {
  return useQuery({
    queryKey: queryKeys.transactions(filters),
    queryFn: () => transactionsApi.list(filters),
    enabled,
    placeholderData: keepPreviousData,
  });
}

/** Every transaction (paged under the hood); used by reports. */
export function useAllTransactions() {
  return useQuery({
    queryKey: queryKeys.allTransactions,
    queryFn: () => transactionsApi.listAll(),
  });
}

export function useCreateTransaction() {
  return useMutation({
    mutationFn: ({
      body,
      idempotencyKey,
    }: {
      body: TransactionCreate;
      idempotencyKey?: string;
    }) => transactionsApi.create(body, idempotencyKey),
    onSuccess: invalidateLedger,
  });
}
