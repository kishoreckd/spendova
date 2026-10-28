import { addMonths } from "date-fns";
import { z } from "zod";
import type { LoanCreate, LoanTerms, LoanType } from "@/api/loans/types";
import { localDateISO } from "@/lib/format";
import { money, optionalMoney, requiredText } from "@/lib/forms";
import { loanTypes } from "./loan-types";

const RATE = /^\d{1,3}(\.\d{1,2})?$/;
const WHOLE = /^\d{1,3}$/;

export const loanSchema = z
  .object({
    loanType: z.enum(
      loanTypes.map((item) => item.value) as [LoanType, ...LoanType[]],
    ),
    name: requiredText("Name the product or loan", 120),
    lender: z.string().trim().max(100, "Keep this under 100 characters"),
    principal: money("the amount"),
    rate: z.string().trim(),
    emi: optionalMoney(),
    tenure: z.string().trim(),
    firstDue: z.string().min(1, "Choose the first EMI date"),
    fee: optionalMoney({ allowZero: true }),
    paidBefore: z.string().trim(),
    account: z.string(),
    asset: z.string(),
    trackPayments: z.boolean(),
  })
  .superRefine((value, context) => {
    const issue = (path: string, message: string) =>
      context.addIssue({ code: "custom", path: [path], message });
    if (value.rate && (!RATE.test(value.rate) || Number(value.rate) > 100))
      issue("rate", "Use a rate from 0 to 100");
    if (!value.rate && !value.emi)
      issue("emi", "Enter the EMI or the interest rate");
    if (
      !WHOLE.test(value.tenure) ||
      Number(value.tenure) < 1 ||
      Number(value.tenure) > 480
    )
      issue("tenure", "Use 1 to 480 months");
    if (value.paidBefore && value.firstDue < localDateISO()) {
      if (!WHOLE.test(value.paidBefore))
        issue("paidBefore", "Use a whole number");
      else if (
        WHOLE.test(value.tenure) &&
        Number(value.paidBefore) > Number(value.tenure)
      )
        issue("paidBefore", "Can't be more than the tenure");
    }
  });
export type LoanValues = z.input<typeof loanSchema>;

export function emptyLoan(): LoanValues {
  return {
    loanType: "product_emi",
    name: "",
    lender: "",
    principal: "",
    rate: "",
    emi: "",
    tenure: "",
    // A new purchase usually has its first EMI next month.
    firstDue: localDateISO(addMonths(new Date(), 1)),
    fee: "",
    paidBefore: "",
    account: "",
    asset: "",
    trackPayments: true,
  };
}

export const loanServerFields = {
  name: "name",
  loan_type: "loanType",
  lender: "lender",
  principal: "principal",
  annual_interest_rate: "rate",
  emi_amount: "emi",
  tenure_months: "tenure",
  first_due_on: "firstDue",
  processing_fee: "fee",
  installments_paid_before: "paidBefore",
  account_id: "account",
  asset_id: "asset",
} as const;

const clean = (value?: string) => (value ?? "").replace(/,/g, "").trim();

/** The calculation inputs, or null while they are incomplete or invalid. */
export function termsFrom(values: Partial<LoanValues>): LoanTerms | null {
  const principal = clean(values.principal);
  const rate = clean(values.rate);
  const emi = clean(values.emi);
  const tenure = clean(values.tenure);
  const fee = clean(values.fee);
  if (!/^\d{1,15}(\.\d{1,2})?$/.test(principal) || Number(principal) <= 0)
    return null;
  if (rate && (!RATE.test(rate) || Number(rate) > 100)) return null;
  if (emi && (!/^\d{1,15}(\.\d{1,2})?$/.test(emi) || Number(emi) <= 0))
    return null;
  if (!rate && !emi) return null;
  if (!WHOLE.test(tenure) || Number(tenure) < 1 || Number(tenure) > 480)
    return null;
  if (!values.firstDue) return null;
  // "EMIs already paid" only applies (and is only shown) when the loan started earlier.
  const paidBefore = clean(values.paidBefore);
  const usePaidBefore =
    values.firstDue < localDateISO() &&
    WHOLE.test(paidBefore) &&
    Number(paidBefore) <= Number(tenure);
  return {
    principal,
    annual_interest_rate: rate || null,
    emi_amount: emi || null,
    tenure_months: Number(tenure),
    first_due_on: values.firstDue,
    processing_fee: /^\d{1,15}(\.\d{1,2})?$/.test(fee) ? fee : "0",
    installments_paid_before: usePaidBefore ? Number(paidBefore) : null,
  };
}

export function loanPayload(parsed: z.output<typeof loanSchema>): LoanCreate {
  const terms = termsFrom(parsed);
  if (!terms) throw new Error("Loan terms are incomplete");
  return {
    ...terms,
    name: parsed.name,
    loan_type: parsed.loanType,
    lender: parsed.lender || null,
    installments_paid_before: terms.installments_paid_before ?? null,
    account_id: parsed.account || null,
    asset_id: parsed.asset || null,
    notes: null,
    track_payments: parsed.trackPayments,
  };
}
