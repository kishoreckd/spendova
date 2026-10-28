import { apiFetch, newIdempotencyKey } from "../client";
import type { RecurringCreate, RecurringItem, RecurringPayment } from "./types";

export const recurringApi = {
  list: () => apiFetch<RecurringItem[]>("/recurring-rules"),
  create: (body: RecurringCreate) =>
    apiFetch<RecurringItem>("/recurring-rules", { method: "POST", body }),
  /** Records the payment as a transaction and schedules the next due date. */
  pay: (
    id: string,
    body: { amount?: string; paid_on: string },
    idempotencyKey = newIdempotencyKey(),
  ) =>
    apiFetch<RecurringPayment>(`/recurring-rules/${id}/pay`, {
      method: "POST",
      body,
      idempotencyKey,
    }),
  stop: (id: string) =>
    apiFetch<void>(`/recurring-rules/${id}`, { method: "DELETE" }),
};
