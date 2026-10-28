import { useMutation, useQuery } from "@tanstack/react-query";
import { accountsApi } from "@/api/accounts/api";
import { queryClient, queryKeys } from "@/lib/query-client";

export function useAccounts(enabled = true) {
  return useQuery({
    queryKey: queryKeys.accounts,
    queryFn: accountsApi.list,
    enabled,
  });
}

const invalidate = () =>
  queryClient.invalidateQueries({ queryKey: queryKeys.accounts });

export function useCreateAccount() {
  return useMutation({ mutationFn: accountsApi.create, onSuccess: invalidate });
}

export function useArchiveAccount() {
  return useMutation({
    mutationFn: accountsApi.archive,
    onSuccess: invalidate,
  });
}
