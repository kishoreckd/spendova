import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import { loansApi } from "@/api/loans/api";
import type { LoanTerms } from "@/api/loans/types";
import { invalidateLedger, queryClient, queryKeys } from "@/lib/query-client";

export function useLoans(includeClosed = false) {
  return useQuery({
    queryKey: [...queryKeys.loans, { includeClosed }],
    queryFn: () => loansApi.list(includeClosed),
  });
}

export function useLoansOverview() {
  return useQuery({
    queryKey: queryKeys.loansOverview,
    queryFn: loansApi.overview,
  });
}

export function useLoanSchedule(id: string | null) {
  return useQuery({
    queryKey: queryKeys.loanSchedule(id ?? ""),
    queryFn: () => loansApi.schedule(id ?? ""),
    enabled: !!id,
  });
}

/** Totals and schedule for terms still being typed; `terms` is null until they are complete. */
export function useLoanPreview(terms: LoanTerms | null) {
  return useQuery({
    queryKey: ["loans", "preview", terms],
    queryFn: () => loansApi.preview(terms as LoanTerms),
    enabled: terms !== null,
    placeholderData: keepPreviousData,
    retry: false,
    staleTime: Infinity,
  });
}

export function useCreateLoan() {
  return useMutation({
    mutationFn: loansApi.create,
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.loans }),
        queryClient.invalidateQueries({ queryKey: queryKeys.recurring }),
      ]),
  });
}

export function usePayLoan() {
  return useMutation({
    mutationFn: ({ id, paidOn }: { id: string; paidOn: string }) =>
      loansApi.pay(id, paidOn),
    onSuccess: invalidateLedger,
  });
}

export function useCloseLoan() {
  return useMutation({
    mutationFn: loansApi.close,
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.loans }),
        queryClient.invalidateQueries({ queryKey: queryKeys.recurring }),
      ]),
  });
}
