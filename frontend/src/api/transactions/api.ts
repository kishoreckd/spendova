import { apiFetch, newIdempotencyKey } from "../client";
import type {
  TransactionCreate,
  TransactionFilters,
  TransactionItem,
} from "./types";

const PAGE_SIZE = 200;

function query(filters: TransactionFilters) {
  const params = new URLSearchParams({ limit: String(filters.limit ?? 100) });
  if (filters.offset) params.set("offset", String(filters.offset));
  if (filters.from) params.set("from_date", filters.from);
  if (filters.to) params.set("to_date", filters.to);
  if (filters.accountId) params.set("account_id", filters.accountId);
  if (filters.categoryId) params.set("category_id", filters.categoryId);
  for (const key of ["search", "kind", "status", "currency"] as const) {
    if (filters[key]) params.set(key, filters[key]);
  }
  return params.toString();
}

export const transactionsApi = {
  list: (filters: TransactionFilters = {}, signal?: AbortSignal) =>
    apiFetch<TransactionItem[]>(`/transactions?${query(filters)}`, { signal }),
  /** Every transaction, page by page; the API caps one page at 200. */
  listAll: async (
    filters: Omit<TransactionFilters, "limit" | "offset"> = {},
    signal?: AbortSignal,
  ) => {
    const all: TransactionItem[] = [];
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const page = await transactionsApi.list(
        {
          ...filters,
          limit: PAGE_SIZE,
          offset,
        },
        signal,
      );
      all.push(...page);
      if (page.length < PAGE_SIZE) return all;
    }
  },
  create: (body: TransactionCreate, idempotencyKey = newIdempotencyKey()) =>
    apiFetch<TransactionItem>("/transactions", {
      method: "POST",
      body,
      idempotencyKey,
    }),
  void: (id: string) =>
    apiFetch<void>(`/transactions/${id}`, { method: "DELETE" }),
};
