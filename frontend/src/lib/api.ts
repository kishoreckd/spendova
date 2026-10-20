import { auth } from "@/lib/firebase";

const API_URL = (
  import.meta.env.VITE_API_URL ?? "http://localhost:8000/api/v1"
).replace(/\/$/, "");

export type SpendovaUser = {
  id: string;
  email: string;
  display_name: string | null;
  photo_url: string | null;
  base_currency: string;
  country_code: string | null;
  locale: string;
  time_zone: string;
  onboarding_completed: boolean;
  email_verified: boolean;
};

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

type ApiEnvelope<T> = {
  status: "success" | "error";
  message: string;
  data: T | null;
};

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const token = await auth.currentUser?.getIdToken();
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${API_URL}${path}`, { ...init, headers });
  const body =
    response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(
      body?.message ?? body?.detail ?? "The request could not be completed",
      response.status,
    );
  }
  if (response.status === 204) return undefined as T;
  if (body?.status === "success" && "data" in body) {
    return (body as ApiEnvelope<T>).data as T;
  }
  // Temporary compatibility for any endpoint not migrated to the envelope yet.
  return body as T;
}

export function syncGoogleUser(payload: {
  email: string | null;
  name: string | null;
  photo_url: string | null;
}) {
  return apiRequest<SpendovaUser>("/auth/google", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateCurrentUser(payload: Partial<SpendovaUser>) {
  return apiRequest<SpendovaUser>("/auth/me", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function sendVerificationCode() {
  return apiRequest<{
    sent: boolean;
    expires_in_seconds: number;
    development_code: string | null;
  }>("/auth/verification/send", { method: "POST" });
}

export function confirmVerificationCode(code: string) {
  return apiRequest<SpendovaUser>("/auth/verification/confirm", {
    method: "POST",
    body: JSON.stringify({ code }),
  });
}

export function createAccount(payload: {
  name: string;
  account_type: string;
  currency: string;
  opening_balance: number;
}) {
  return apiRequest("/accounts", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function createRecurringIncome(payload: {
  name: string;
  amount: number;
  currency: string;
  next_due_on: string;
  destination: string;
}) {
  return apiRequest("/recurring-rules", {
    method: "POST",
    body: JSON.stringify({
      ...payload,
      kind: "income",
      frequency: "monthly",
      interval: 1,
      source: "Employer",
      category_id: null,
    }),
  });
}

export type NewTransaction = {
  kind: "expense" | "income" | "transfer";
  amount: number;
  source: string;
  destination: string;
  merchant?: string;
  occurred_on: string;
  currency: string;
  category_id?: string;
};

export function createTransaction(payload: NewTransaction) {
  return apiRequest("/transactions", {
    method: "POST",
    headers: { "Idempotency-Key": crypto.randomUUID() },
    body: JSON.stringify(payload),
  });
}

export type DashboardSummary = {
  period: { year: number; month: number };
  income: string;
  spending: string;
  cash_flow: string;
  transaction_count: number;
  categories: Array<{
    id: string;
    name: string;
    color: string | null;
    amount: string;
  }>;
};

export type TransactionItem = NewTransaction & { id: string; status: string };

export function getDashboard() {
  return apiRequest<DashboardSummary>("/dashboard");
}

export function listTransactions(limit = 5) {
  return apiRequest<TransactionItem[]>(`/transactions?limit=${limit}`);
}

export type BudgetItem = {
  id: string;
  name: string;
  month: string;
  total_limit: string;
  lines: Array<{ category_id: string; amount_limit: string }>;
};
export type GoalItem = {
  id: string;
  name: string;
  target_amount: string;
  saved_amount: string;
  months: number;
  monthly_required: string;
};
export type RecurringItem = {
  id: string;
  name: string;
  kind: "expense" | "income" | "transfer";
  amount: string;
  currency: string;
  next_due_on: string;
};

export const listBudgets = () => apiRequest<BudgetItem[]>("/budgets");
export const listGoals = () => apiRequest<GoalItem[]>("/goals");
export const listRecurringRules = () =>
  apiRequest<RecurringItem[]>("/recurring-rules");

export type AccountItem = {
  id: string;
  name: string;
  account_type: string;
  currency: string;
  opening_balance: string;
};
export type CategoryItem = {
  id: string;
  name: string;
  category_type: "expense" | "income";
  icon: string | null;
  color: string | null;
  monthly_budget: string | null;
  archived: boolean;
  is_default: boolean;
};
export const listAccounts = () => apiRequest<AccountItem[]>("/accounts");
export const createAccountRecord = (payload: {
  name: string;
  account_type: string;
  currency: string;
  opening_balance: number;
}) =>
  apiRequest<AccountItem>("/accounts", {
    method: "POST",
    body: JSON.stringify(payload),
  });
export const archiveAccount = (id: string) =>
  apiRequest<void>(`/accounts/${id}`, { method: "DELETE" });
export const listCategories = () => apiRequest<CategoryItem[]>("/categories");
export const createCategory = (payload: {
  name: string;
  category_type: "expense" | "income";
  icon?: string;
  color?: string;
  monthly_budget?: number;
}) =>
  apiRequest<CategoryItem>("/categories", {
    method: "POST",
    body: JSON.stringify(payload),
  });
export const archiveCategory = (id: string) =>
  apiRequest<void>(`/categories/${id}`, { method: "DELETE" });
export type AssetItem = {
  id: string;
  name: string;
  asset_type: string;
  purchase_price: string;
  purchased_on: string;
  currency: string;
  notes: string | null;
  status: string;
  age_days: number;
  cost_per_day: string;
};
export const listAssets = () => apiRequest<AssetItem[]>("/assets");
export const createAsset = (payload: {
  name: string;
  asset_type: string;
  purchase_price: number;
  purchased_on: string;
  currency: string;
  notes?: string;
}) =>
  apiRequest<AssetItem>("/assets", {
    method: "POST",
    body: JSON.stringify(payload),
  });
export const archiveAsset = (id: string) =>
  apiRequest<void>(`/assets/${id}`, { method: "DELETE" });

export async function exportCurrentUserData(profile: SpendovaUser) {
  const [
    accounts,
    categories,
    transactions,
    budgets,
    goals,
    recurringRules,
    assets,
  ] = await Promise.all([
    listAccounts(),
    listCategories(),
    apiRequest<TransactionItem[]>("/transactions?limit=200"),
    listBudgets(),
    listGoals(),
    listRecurringRules(),
    listAssets(),
  ]);
  return {
    export_version: 1,
    exported_at: new Date().toISOString(),
    profile,
    accounts,
    categories,
    transactions,
    budgets,
    goals,
    recurring_rules: recurringRules,
    assets,
  };
}
