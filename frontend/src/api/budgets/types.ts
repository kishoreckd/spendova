export type BudgetItem = {
  id: string;
  name: string;
  month: string;
  total_limit: string;
  lines: Array<{ id: string; category_id: string; amount_limit: string }>;
};

export type BudgetCreate = {
  name: string;
  month: string;
  total_limit: string;
  lines: Array<{ category_id: string; amount_limit: string }>;
};

export type BudgetStatus = {
  budget_id: string;
  limit: string;
  spent: string;
  remaining: string;
  lines: Array<{
    category_id: string;
    limit: string;
    spent: string;
    remaining: string;
  }>;
};
