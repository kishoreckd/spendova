import { apiFetch, newIdempotencyKey } from "../client";
import type {
  Trip,
  TripCreate,
  TripExpenseCreate,
  TripSettlementCreate,
} from "./types";

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
  updateExpense: (tripId: string, expenseId: string, body: TripExpenseCreate) =>
    apiFetch<Trip>(`/trips/${tripId}/expenses/${expenseId}`, {
      method: "PUT",
      body,
    }),
  addSettlement: (tripId: string, body: TripSettlementCreate) =>
    apiFetch<Trip>(`/trips/${tripId}/settlements`, { method: "POST", body }),
  deleteSettlement: (tripId: string, settlementId: string) =>
    apiFetch<Trip>(`/trips/${tripId}/settlements/${settlementId}`, {
      method: "DELETE",
    }),
  reopen: (tripId: string) =>
    apiFetch<Trip>(`/trips/${tripId}/reopen`, { method: "POST" }),
  remove: (tripId: string) =>
    apiFetch<void>(`/trips/${tripId}`, { method: "DELETE" }),
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
