import { z } from "zod";
import type { AccountItem } from "@/api/accounts/types";
import type { CategoryItem } from "@/api/categories/types";
import type { RecurringCreate } from "@/api/recurring/types";
import { localDateISO } from "@/lib/format";
import { money, requiredText } from "@/lib/forms";

export const frequencies = ["monthly", "weekly", "yearly", "daily"] as const;
export const frequencyUnit: Record<
  (typeof frequencies)[number],
  [string, string]
> = {
  daily: ["day", "days"],
  weekly: ["week", "weeks"],
  monthly: ["month", "months"],
  yearly: ["year", "years"],
};

export const billSchema = z
  .object({
    planType: z.enum(["bill", "income", "investment"]),
    name: requiredText("Enter a plan name", 120),
    amount: money(),
    frequency: z.enum(frequencies),
    interval: z
      .string()
      .trim()
      .regex(/^\d{1,3}$/, "Use a whole number")
      .refine(
        (value) => Number(value) >= 1 && Number(value) <= 365,
        "Use 1 to 365",
      ),
    nextDue: z
      .string()
      .min(1, "Choose the next due date")
      .refine(
        (value) => value >= localDateISO(),
        "Choose today or a later date",
      ),
    account: z.string().min(1, "Choose the paying account"),
    toAccount: z.string(),
    categoryId: z.string(),
    costAmount: z.union([money(), z.literal("")]),
    annualReturnRate: z.union([
      z
        .string()
        .trim()
        .regex(/^\d{1,3}(\.\d{1,2})?$/, "Enter a valid percentage")
        .refine((value) => Number(value) <= 100, "Use 0 to 100"),
      z.literal(""),
    ]),
    tenureMonths: z.string(),
  })
  .superRefine((value, context) => {
    const issue = (path: string, message: string) =>
      context.addIssue({ code: "custom", path: [path], message });
    if (value.planType !== "investment") return;
    if (!value.toAccount) issue("toAccount", "Choose an investment account");
    else if (value.toAccount === value.account)
      issue("toAccount", "Choose a different account");
    if (
      !/^\d{1,4}$/.test(value.tenureMonths) ||
      Number(value.tenureMonths) < 1 ||
      Number(value.tenureMonths) > 1200
    )
      issue("tenureMonths", "Use 1 to 1200 months");
  });
export type BillValues = z.input<typeof billSchema>;
type ParsedBill = z.output<typeof billSchema>;

export const emptyBill: BillValues = {
  planType: "bill",
  name: "",
  amount: "",
  frequency: "monthly",
  interval: "1",
  nextDue: "",
  account: "",
  toAccount: "",
  categoryId: "",
  costAmount: "",
  annualReturnRate: "",
  tenureMonths: "",
};

export const billServerFields = {
  name: "name",
  amount: "amount",
  interval: "interval",
  next_due_on: "nextDue",
  source: "account",
  source_account_id: "account",
  destination_account_id: "toAccount",
  cost_amount: "costAmount",
  annual_return_rate: "annualReturnRate",
  tenure_months: "tenureMonths",
} as const;

/** Maps the form onto the recurring-rule contract for bills, income, and investments. */
export function billPayload(
  parsed: ParsedBill,
  {
    source,
    destination,
    category,
    fallbackCurrency,
  }: {
    source?: AccountItem;
    destination?: AccountItem;
    category?: CategoryItem;
    fallbackCurrency: string;
  },
): RecurringCreate {
  const { planType } = parsed;
  return {
    kind:
      planType === "investment"
        ? "transfer"
        : planType === "income"
          ? "income"
          : "expense",
    name: parsed.name,
    amount: parsed.amount,
    currency: source?.currency ?? fallbackCurrency,
    frequency: parsed.frequency,
    interval: Number(parsed.interval),
    next_due_on: parsed.nextDue,
    source:
      planType === "income"
        ? (category?.name ?? parsed.name)
        : (source?.name ?? ""),
    destination:
      planType === "investment"
        ? (destination?.name ?? "")
        : planType === "income"
          ? (source?.name ?? "")
          : (category?.name ?? parsed.name),
    source_account_id: planType === "income" ? null : source?.id,
    destination_account_id:
      planType === "income"
        ? source?.id
        : planType === "investment"
          ? destination?.id
          : null,
    category_id: planType === "investment" ? null : (category?.id ?? null),
    plan_type: planType,
    cost_amount:
      planType === "income" && parsed.costAmount ? parsed.costAmount : null,
    annual_return_rate:
      planType === "investment" && parsed.annualReturnRate
        ? parsed.annualReturnRate
        : null,
    tenure_months:
      planType === "investment" ? Number(parsed.tenureMonths) : null,
  };
}
