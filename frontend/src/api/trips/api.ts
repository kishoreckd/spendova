import { apiFetch, newIdempotencyKey } from "../client";
import type { Trip, TripCreate, TripExpenseCreate } from "./types";

export const tripsApi = {
  list: (signal?: AbortSignal) => apiFetch<Trip[]>("/trips", { signal }),
  create: (body: TripCreate) =>
    apiFetch<Trip>("/trips", { method: "POST", body }),
  addParticipant: (tripId: string, name: string) =>
    apiFetch<Trip>(`/trips/${tripId}/participants`, {
      method: "POST",
      body: { name },
    }),
  addExpense: (tripId: string, body: TripExpenseCreate) =>
    apiFetch<Trip>(`/trips/${tripId}/expenses`, { method: "POST", body }),
  deleteExpense: (tripId: string, expenseId: string) =>
    apiFetch<Trip>(`/trips/${tripId}/expenses/${expenseId}`, {
      method: "DELETE",
    }),
  close: (tripId: string) =>
    apiFetch<Trip>(`/trips/${tripId}/close`, {
      method: "POST",
      body: { confirm: true },
      idempotencyKey: newIdempotencyKey(),
    }),
};
