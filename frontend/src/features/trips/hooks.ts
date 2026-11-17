import { useMutation, useQuery } from "@tanstack/react-query";
import { tripsApi } from "@/api/trips/api";
import type {
  TripCreate,
  TripExpenseCreate,
  TripSettlementCreate,
} from "@/api/trips/types";
import { invalidateLedger, queryClient, queryKeys } from "@/lib/query-client";

const refresh = () =>
  queryClient.invalidateQueries({ queryKey: queryKeys.trips });
export function useTrips() {
  return useQuery({
    queryKey: queryKeys.trips,
    queryFn: ({ signal }) => tripsApi.list(signal),
  });
}
export function useCreateTrip() {
  return useMutation({
    mutationFn: (body: TripCreate) => tripsApi.create(body),
    onSuccess: refresh,
  });
}
export function useAddTripParticipant() {
  return useMutation({
    mutationFn: ({ tripId, name }: { tripId: string; name: string }) =>
      tripsApi.addParticipant(tripId, name),
    onSuccess: refresh,
  });
}
export function useAddTripExpense() {
  return useMutation({
    mutationFn: ({
      tripId,
      body,
    }: {
      tripId: string;
      body: TripExpenseCreate;
    }) => tripsApi.addExpense(tripId, body),
    onSuccess: refresh,
  });
}
export function useDeleteTripExpense() {
  return useMutation({
    mutationFn: ({
      tripId,
      expenseId,
    }: {
      tripId: string;
      expenseId: string;
    }) => tripsApi.deleteExpense(tripId, expenseId),
    onSuccess: refresh,
  });
}
export function useUpdateTripExpense() {
  return useMutation({
    mutationFn: ({
      tripId,
      expenseId,
      body,
    }: {
      tripId: string;
      expenseId: string;
      body: TripExpenseCreate;
    }) => tripsApi.updateExpense(tripId, expenseId, body),
    onSuccess: refresh,
  });
}
export function useAddSettlement() {
  return useMutation({
    mutationFn: ({
      tripId,
      body,
    }: {
      tripId: string;
      body: TripSettlementCreate;
    }) => tripsApi.addSettlement(tripId, body),
    onSuccess: refresh,
  });
}
export function useDeleteSettlement() {
  return useMutation({
    mutationFn: ({
      tripId,
      settlementId,
    }: {
      tripId: string;
      settlementId: string;
    }) => tripsApi.deleteSettlement(tripId, settlementId),
    onSuccess: refresh,
  });
}
export function useReopenTrip() {
  return useMutation({
    mutationFn: tripsApi.reopen,
    onSuccess: () => Promise.all([refresh(), invalidateLedger()]),
  });
}
export function useDeleteTrip() {
  return useMutation({
    mutationFn: tripsApi.remove,
    onSuccess: refresh,
  });
}
export function useCloseTrip() {
  return useMutation({
    mutationFn: tripsApi.close,
    onSuccess: () => Promise.all([refresh(), invalidateLedger()]),
  });
}
