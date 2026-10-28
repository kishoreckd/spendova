import {
  CalendarClock,
  CreditCard,
  Landmark,
  PiggyBank,
  TrendingUp,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import type { AccountItem } from "@/api/accounts/types";
import type { Tile } from "@/components/common/tile-picker";

export const accountTypes: Array<Tile & { icon: LucideIcon }> = [
  { value: "bank", label: "Bank account", icon: Landmark, color: "#0891b2" },
  { value: "credit", label: "Credit card", icon: CreditCard, color: "#7c3aed" },
  { value: "cash", label: "Cash", icon: WalletCards, color: "#059669" },
  {
    value: "investment",
    label: "Investment",
    icon: TrendingUp,
    color: "#d97706",
  },
  { value: "loan", label: "Loan", icon: Landmark, color: "#e11d48" },
  {
    value: "fixed_deposit",
    label: "Fixed deposit",
    icon: PiggyBank,
    color: "#ca8a04",
  },
  {
    value: "recurring_deposit",
    label: "Recurring deposit",
    icon: CalendarClock,
    color: "#0d9488",
  },
];

export const accountTypeByValue = new Map(
  accountTypes.map((item) => [item.value, item]),
);

export const owesMoney = (type?: string) =>
  type === "credit" || type === "loan";

export function accountBalance(account: AccountItem) {
  return Number(account.current_balance ?? account.opening_balance ?? 0);
}

/** Estimated value at maturity for fixed and recurring deposits (monthly compounding). */
export function projectedDepositValue(account: AccountItem) {
  const months = account.tenure_months ?? 0;
  const monthlyRate = Number(account.annual_interest_rate ?? 0) / 1200;
  if (!months) return null;
  if (account.account_type === "fixed_deposit" && account.principal_amount) {
    const principal = Number(account.principal_amount);
    return monthlyRate > 0
      ? principal * Math.pow(1 + monthlyRate, months)
      : principal;
  }
  if (
    account.account_type === "recurring_deposit" &&
    account.installment_amount
  ) {
    const installment = Number(account.installment_amount);
    return monthlyRate > 0
      ? installment *
          (((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate) *
            (1 + monthlyRate))
      : installment * months;
  }
  return null;
}
