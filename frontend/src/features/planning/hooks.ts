import { useMutation, useQueries, useQuery } from "@tanstack/react-query";
import { budgetsApi } from "@/api/budgets/api";
import { goalsApi } from "@/api/goals/api";
import type { GoalContributionCreate } from "@/api/goals/types";
import { recurringApi } from "@/api/recurring/api";
import { invalidateLedger, queryClient, queryKeys } from "@/lib/query-client";

/* Recurring bills, income and investments */

export function useRecurring(enabled = true) {
  return useQuery({
    queryKey: queryKeys.recurring,
    queryFn: recurringApi.list,
    enabled,
  });
}

export function useCreateRecurring() {
  return useMutation({
    mutationFn: recurringApi.create,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.recurring }),
  });
}

export function useStopRecurring() {
  return useMutation({
    mutationFn: recurringApi.stop,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.recurring }),
  });
}

export function usePayRecurring() {
  return useMutation({
    mutationFn: ({
      id,
      amount,
      paidOn,
    }: {
      id: string;
      amount: string;
      paidOn: string;
    }) => recurringApi.pay(id, { amount, paid_on: paidOn }),
    onSuccess: invalidateLedger,
  });
}

/* Budgets */

export function useBudgets() {
  return useQuery({ queryKey: queryKeys.budgets, queryFn: budgetsApi.list });
}

/** Spend against each budget, fetched in parallel and cached per budget. */
export function useBudgetStatuses(ids: string[]) {
  return useQueries({
    queries: ids.map((id) => ({
      queryKey: queryKeys.budgetStatus(id),
      queryFn: () => budgetsApi.status(id),
    })),
    combine: (results) =>
      Object.fromEntries(
        results.flatMap((result) =>
          result.data ? [[result.data.budget_id, result.data]] : [],
        ),
      ),
  });
}

export function useCreateBudget() {
  return useMutation({
    mutationFn: budgetsApi.create,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.budgets }),
  });
}

export function useDeleteBudget() {
  return useMutation({
    mutationFn: budgetsApi.remove,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.budgets }),
  });
}

/* Goals */

export function useGoals() {
  return useQuery({ queryKey: queryKeys.goals, queryFn: goalsApi.list });
}

export function useCreateGoal() {
  return useMutation({
    mutationFn: goalsApi.create,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.goals }),
  });
}

export function useDeleteGoal() {
  return useMutation({
    mutationFn: goalsApi.remove,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.goals }),
  });
}

export function useContributeToGoal() {
  return useMutation({
    mutationFn: ({
      goalId,
      body,
    }: {
      goalId: string;
      body: GoalContributionCreate;
    }) => goalsApi.contribute(goalId, body),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.goals }),
  });
}
