import { apiFetch } from "../client";
import type { AccountCreate, AccountItem } from "./types";

export const accountsApi = {
  list: (signal?: AbortSignal) =>
    apiFetch<AccountItem[]>("/accounts", { signal }),
  create: (body: AccountCreate) =>
    apiFetch<AccountItem>("/accounts", { method: "POST", body }),
  archive: (id: string) =>
    apiFetch<void>(`/accounts/${id}`, { method: "DELETE" }),
};
