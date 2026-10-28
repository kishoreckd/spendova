import { apiFetch } from "../client";
import type {
  GoalContribution,
  GoalContributionCreate,
  GoalCreate,
  GoalItem,
} from "./types";

export const goalsApi = {
  list: () => apiFetch<GoalItem[]>("/goals"),
  create: (body: GoalCreate) =>
    apiFetch<GoalItem>("/goals", { method: "POST", body }),
  remove: (id: string) => apiFetch<void>(`/goals/${id}`, { method: "DELETE" }),
  contribute: (goalId: string, body: GoalContributionCreate) =>
    apiFetch<GoalContribution>(`/goals/${goalId}/contributions`, {
      method: "POST",
      body,
    }),
};
