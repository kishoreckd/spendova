import { apiFetch } from "../client";
import type { AccountCreate, AccountItem } from "./types";

export const accountsApi = {
  list: () => apiFetch<AccountItem[]>("/accounts"),
  create: (body: AccountCreate) =>
    apiFetch<AccountItem>("/accounts", { method: "POST", body }),
  archive: (id: string) =>
    apiFetch<void>(`/accounts/${id}`, { method: "DELETE" }),
};
