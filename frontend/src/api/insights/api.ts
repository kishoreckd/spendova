import { apiFetch } from "../client";
import type {
  AssistantReply,
  AssistantRequest,
  FinanceSnapshot,
} from "./types";
export const insightsApi = {
  snapshot: (signal?: AbortSignal) =>
    apiFetch<FinanceSnapshot>("/insights/snapshot", { signal }),
  chat: (body: AssistantRequest) =>
    apiFetch<AssistantReply>("/insights/chat", { method: "POST", body }),
};
