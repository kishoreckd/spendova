import { apiFetch } from "../client";
import type { BudgetCreate, BudgetItem, BudgetStatus } from "./types";

export const budgetsApi = {
  list: () => apiFetch<BudgetItem[]>("/budgets"),
  status: (id: string) => apiFetch<BudgetStatus>(`/budgets/${id}/status`),
  create: (body: BudgetCreate) =>
    apiFetch<BudgetItem>("/budgets", { method: "POST", body }),
  remove: (id: string) =>
    apiFetch<void>(`/budgets/${id}`, { method: "DELETE" }),
};
