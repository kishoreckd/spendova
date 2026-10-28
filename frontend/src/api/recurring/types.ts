import type { TransactionItem, TransactionKind } from "../transactions/types";

export type Frequency = "daily" | "weekly" | "monthly" | "yearly";
export type PlanType = "bill" | "income" | "investment";

export type RecurringItem = {
  id: string;
  name: string;
  kind: TransactionKind;
  amount: string;
  currency: string;
  frequency: Frequency;
  interval: number;
  next_due_on: string;
  source: string;
  destination: string;
  source_account_id: string | null;
  destination_account_id: string | null;
  category_id: string | null;
  plan_type: PlanType;
  cost_amount: string | null;
  annual_return_rate: string | null;
  tenure_months: number | null;
  active: boolean;
};

export type RecurringCreate = {
  kind: TransactionKind;
  name: string;
  amount: string;
  currency: string;
  frequency: Frequency;
  interval: number;
  next_due_on: string;
  source: string;
  destination: string;
  source_account_id?: string | null;
  destination_account_id?: string | null;
  category_id: string | null;
  plan_type?: PlanType;
  cost_amount?: string | null;
  annual_return_rate?: string | null;
  tenure_months?: number | null;
};

export type RecurringPayment = {
  commitment: RecurringItem;
  transaction: TransactionItem;
};
