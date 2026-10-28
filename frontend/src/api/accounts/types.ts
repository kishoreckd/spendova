export type AccountType =
  | "bank"
  | "credit"
  | "cash"
  | "investment"
  | "loan"
  | "fixed_deposit"
  | "recurring_deposit";

export type AccountItem = {
  id: string;
  name: string;
  account_type: string;
  currency: string;
  opening_balance: string;
  current_balance: string;
  institution: string | null;
  principal_amount: string | null;
  annual_interest_rate: string | null;
  started_on: string | null;
  maturity_on: string | null;
  tenure_months: number | null;
  installment_amount: string | null;
  archived: boolean;
};

export type AccountCreate = {
  name: string;
  account_type: string;
  currency: string;
  opening_balance: string;
  institution?: string | null;
  principal_amount?: string | null;
  annual_interest_rate?: string | null;
  started_on?: string | null;
  maturity_on?: string | null;
  tenure_months?: number | null;
  installment_amount?: string | null;
};
