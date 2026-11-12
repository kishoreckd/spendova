import { apiFetch } from "../client";
export interface Preferences {
  daily_token_limit: number;
  max_daily_tokens: number;
  bills: boolean;
  deposits: boolean;
  budgets: boolean;
  weekly: boolean;
  tokens_used: number;
  tokens_remaining: number;
  resets_at: string;
  reset_timezone: string;
  ai_available: boolean;
}
export type PreferencesUpdate = Pick<
  Preferences,
  "daily_token_limit" | "bills" | "deposits" | "budgets" | "weekly"
>;
export const preferencesApi = {
  get: (signal?: AbortSignal) =>
    apiFetch<Preferences>("/preferences", { signal }),
  save: (body: PreferencesUpdate) =>
    apiFetch<Preferences>("/preferences", { method: "PUT", body }),
};
