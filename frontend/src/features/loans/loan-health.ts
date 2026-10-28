import {
  CircleAlert,
  CircleCheck,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import type { LoanSummary } from "@/api/loans/types";

/** Everything that leaves your account over the loan: all EMIs plus the processing fee. */
export function totalOutlay(summary: LoanSummary) {
  return Number(summary.total_payable) + Number(summary.processing_fee);
}

export type DebtLoad = { label: string; icon: LucideIcon; className: string };

/**
 * Share of monthly income going to EMIs. Lenders in India typically cap total EMIs
 * at 40–50% of income; under 30% leaves room for saving.
 */
export function debtLoad(percent: number): DebtLoad {
  if (percent <= 30)
    return {
      label: "Comfortable",
      icon: CircleCheck,
      className: "text-emerald-600",
    };
  if (percent <= 40)
    return {
      label: "Stretched",
      icon: TriangleAlert,
      className: "text-amber-600",
    };
  return { label: "High", icon: CircleAlert, className: "text-rose-600" };
}
