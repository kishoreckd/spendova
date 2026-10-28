import type { TransactionItem } from "../transactions/types";

export type LoanType =
  | "personal"
  | "home"
  | "vehicle"
  | "education"
  | "gold"
  | "business"
  | "product_emi"
  | "credit_card_emi"
  | "other";

/** Enough to calculate a schedule. Give the interest rate, the EMI, or both. */
export type LoanTerms = {
  principal: string;
  annual_interest_rate: string | null;
  emi_amount: string | null;
  tenure_months: number;
  first_due_on: string;
  processing_fee: string;
  /** Omit to assume every EMI due before today was paid. */
  installments_paid_before?: number | null;
};

export type LoanCreate = LoanTerms & {
  name: string;
  loan_type: LoanType;
  lender: string | null;
  installments_paid_before: number | null;
  account_id: string | null;
  asset_id: string | null;
  notes: string | null;
  track_payments: boolean;
};

export type LoanSummary = {
  emi: string;
  annual_rate: string;
  rate_is_estimated: boolean;
  tenure_months: number;
  total_payable: string;
  total_interest: string;
  processing_fee: string;
  total_cost: string;
  first_due_on: string;
  last_due_on: string;
  installments_paid: number;
  installments_left: number;
  principal_paid: string;
  interest_paid: string;
  outstanding_principal: string;
  remaining_payable: string;
  remaining_interest: string;
  next_due_on: string | null;
  next_payment: string | null;
  overdue: boolean;
  due_this_month: boolean;
  ends_this_month: boolean;
  progress_percent: number;
};

export type Installment = {
  number: number;
  due_on: string;
  payment: string;
  interest: string;
  principal: string;
  balance: string;
  paid: boolean;
};

export type LoanPreview = {
  summary: LoanSummary;
  schedule: Installment[];
};

export type LoanItem = {
  id: string;
  name: string;
  loan_type: LoanType;
  lender: string | null;
  currency: string;
  principal: string;
  annual_interest_rate: string | null;
  emi_amount: string;
  tenure_months: number;
  first_due_on: string;
  processing_fee: string;
  installments_paid_before: number;
  account_id: string | null;
  asset_id: string | null;
  recurring_rule_id: string | null;
  status: "active" | "closed";
  notes: string | null;
  summary: LoanSummary;
};

export type LoansOverview = {
  active_loans: number;
  monthly_emi_total: string;
  outstanding_principal_total: string;
  remaining_payable_total: string;
  remaining_interest_total: string;
  due_this_month_total: string;
  overdue_count: number;
  ending_this_month: Array<{ id: string; name: string; last_due_on: string }>;
  debt_free_on: string | null;
  average_monthly_income: string | null;
  emi_to_income_percent: string | null;
};

export type LoanPayment = {
  loan: LoanItem;
  transaction: TransactionItem;
};
