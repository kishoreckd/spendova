import { apiFetch, newIdempotencyKey } from "../client";
import type {
  Installment,
  LoanCreate,
  LoanItem,
  LoanPayment,
  LoanPreview,
  LoansOverview,
  LoanTerms,
} from "./types";

export const loansApi = {
  list: (includeClosed = false) =>
    apiFetch<LoanItem[]>(
      `/loans${includeClosed ? "?include_closed=true" : ""}`,
    ),
  overview: () => apiFetch<LoansOverview>("/loans/overview"),
  /** Totals and schedule for unsaved terms (live form preview). */
  preview: (body: LoanTerms) =>
    apiFetch<LoanPreview>("/loans/preview", { method: "POST", body }),
  create: (body: LoanCreate) =>
    apiFetch<LoanItem>("/loans", { method: "POST", body }),
  schedule: (id: string) => apiFetch<Installment[]>(`/loans/${id}/schedule`),
  /** Posts the next EMI as a transaction from the loan's paying account. */
  pay: (id: string, paidOn: string, idempotencyKey = newIdempotencyKey()) =>
    apiFetch<LoanPayment>(`/loans/${id}/payments`, {
      method: "POST",
      body: { paid_on: paidOn },
      idempotencyKey,
    }),
  close: (id: string) =>
    apiFetch<LoanItem>(`/loans/${id}/close`, { method: "POST" }),
};
