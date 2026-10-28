export type TransactionKind = "expense" | "income" | "transfer";

/** Money travels as a decimal string so no binary rounding is introduced. */
export type TransactionCreate = {
  kind: TransactionKind;
  amount: string;
  source: string;
  destination: string;
  source_account_id?: string | null;
  destination_account_id?: string | null;
  merchant?: string;
  occurred_on: string;
  currency: string;
  category_id?: string;
  recurring_rule_id?: string;
  notes?: string;
};

export type TransactionItem = {
  id: string;
  kind: TransactionKind;
  amount: string;
  currency: string;
  source: string;
  destination: string;
  source_account_id: string | null;
  destination_account_id: string | null;
  merchant: string | null;
  occurred_on: string;
  category_id: string | null;
  recurring_rule_id: string | null;
  notes: string | null;
  status: string;
};

export type TransactionFilters = {
  limit?: number;
  offset?: number;
  from?: string;
  to?: string;
  accountId?: string;
  categoryId?: string;
};
