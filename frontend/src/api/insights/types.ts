export interface FinanceSnapshot {
  as_of: string;
  currency: string;
  period_start: string;
  period_end: string;
  average_income: string;
  average_spending: string;
  monthly_emi: string;
  monthly_goal_saving: string;
  monthly_headroom: string;
  income_months: number;
  warnings: string[];
  ai_available: boolean;
}
export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}
export interface PurchaseScenario {
  price: string;
  down_payment: string;
  months: number;
  annual_rate: string;
}
export interface AssistantRequest {
  question: string;
  history: ChatTurn[];
  use_ai: boolean;
  scenario?: PurchaseScenario;
}
export interface AssistantReply {
  answer: string;
  mode: "local" | "ai";
  snapshot: FinanceSnapshot;
  calculation: Record<string, string | number | null> | null;
}
