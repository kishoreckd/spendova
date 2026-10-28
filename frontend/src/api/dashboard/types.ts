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

export type DashboardQuery = {
  year?: number;
  month?: number;
  accountId?: string;
};
