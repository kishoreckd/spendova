import { z } from "zod";
import type { AccountItem } from "@/api/accounts/types";
import type { RecurringItem } from "@/api/recurring/types";
import { localDateISO } from "@/lib/format";
import { money } from "@/lib/forms";

export const kinds = ["expense", "income", "transfer"] as const;
export type Kind = (typeof kinds)[number];

export const transactionSchema = z
  .object({
    kind: z.enum(kinds),
    amount: money(),
    categoryId: z.string(),
    account: z.string(),
    toAccount: z.string(),
    merchant: z.string().trim().max(160, "Keep this under 160 characters"),
    date: z.string().min(1, "Choose a date"),
    notes: z.string().trim().max(500, "Keep notes under 500 characters"),
    commitmentId: z.string(),
  })
  .superRefine((value, context) => {
    const issue = (path: string, message: string) =>
      context.addIssue({ code: "custom", path: [path], message });
    if (value.kind !== "transfer" && !value.categoryId)
      issue("categoryId", "Choose a category");
    if (!value.account)
      issue(
        "account",
        value.kind === "income"
          ? "Choose the account that received the money"
          : "Choose an account",
      );
    if (value.kind === "transfer") {
      if (!value.toAccount) issue("toAccount", "Choose where the money went");
      else if (value.toAccount === value.account)
        issue("toAccount", "Choose a different account");
    }
  });
export type TransactionValues = z.input<typeof transactionSchema>;

export const serverFields = {
  amount: "amount",
  category_id: "categoryId",
  merchant: "merchant",
  occurred_on: "date",
  notes: "notes",
  source_account_id: "account",
  destination_account_id: "toAccount",
} as const;

export const kindCopy: Record<Kind, { account: string; saved: string }> = {
  expense: { account: "Paid from", saved: "Expense saved" },
  income: { account: "Deposited to", saved: "Income saved" },
  transfer: { account: "From account", saved: "Transfer saved" },
};

export function blankTransaction(
  kind: Kind,
  account = "",
  date = localDateISO(),
): TransactionValues {
  return {
    kind,
    amount: "",
    categoryId: "",
    account,
    toAccount: "",
    merchant: "",
    date,
    notes: "",
    commitmentId: "",
  };
}

/** Form values pre-filled from a bill, premium, investment or expected income. */
export function valuesFromCommitment(
  current: TransactionValues,
  rule: RecurringItem,
  accounts: AccountItem[] | undefined,
): TransactionValues {
  const byName = (name: string) =>
    accounts?.find((item) => item.name === name)?.id ?? "";
  const destination = rule.destination_account_id ?? byName(rule.destination);
  const source = rule.source_account_id ?? byName(rule.source);
  return {
    ...current,
    kind: rule.kind,
    amount: rule.amount,
    categoryId: rule.category_id ?? "",
    account: rule.kind === "income" ? destination : source,
    toAccount: rule.kind === "transfer" ? destination : "",
    merchant: rule.name,
    commitmentId: rule.id,
  };
}
