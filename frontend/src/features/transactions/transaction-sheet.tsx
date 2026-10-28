import { useEffect, useMemo, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, WalletCards } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { cn } from "cn";
import { DatePicker } from "@/components/date-picker";
import { TilePicker } from "@/components/tile-picker";
import { Button } from "@/components/ui/button";
import { Field, FormAlert } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  categoryTile,
  useCategories,
} from "@/features/categories/use-categories";
import { useMoney } from "@/hooks/use-money";
import {
  createTransaction,
  listAccounts,
  listRecurringRules,
  type AccountItem,
  type RecurringItem,
} from "@/lib/api";
import { currencySymbol, formatMoney, localDateISO } from "@/lib/format";
import {
  applyServerErrors,
  controlProps,
  money,
  notifySuccess,
} from "@/lib/forms";

export const TRANSACTIONS_CHANGED = "spendova:transactions";

const kinds = ["expense", "income", "transfer"] as const;
type Kind = (typeof kinds)[number];

const schema = z
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
type Values = z.input<typeof schema>;

const serverFields = {
  amount: "amount",
  category_id: "categoryId",
  merchant: "merchant",
  occurred_on: "date",
  notes: "notes",
} as const;

const copy: Record<Kind, { account: string; saved: string }> = {
  expense: { account: "Paid from", saved: "Expense saved" },
  income: { account: "Deposited to", saved: "Income saved" },
  transfer: { account: "From account", saved: "Transfer saved" },
};

function blank(kind: Kind, account = "", date = localDateISO()): Values {
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

type Props = {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  onSaved?: () => void;
};

export function TransactionSheet({ open, onOpenChange, onSaved }: Props) {
  const navigate = useNavigate();
  const currency = useMoney();
  const categories = useCategories(open);
  const [accounts, setAccounts] = useState<AccountItem[] | null>(null);
  const [commitments, setCommitments] = useState<RecurringItem[]>([]);
  const [formError, setFormError] = useState("");
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: blank("expense"),
    mode: "onTouched",
  });
  const { errors, isSubmitting } = form.formState;
  const kind = useWatch({ control: form.control, name: "kind" });
  const accountName = useWatch({ control: form.control, name: "account" });
  const toAccountName = useWatch({ control: form.control, name: "toAccount" });
  const categoryType = kind === "income" ? "income" : "expense";
  const selectedAccount = accounts?.find((item) => item.id === accountName);
  const selectedDestination = accounts?.find(
    (item) => item.id === toAccountName,
  );
  const transactionCurrency = selectedAccount?.currency ?? currency.currency;
  const amountSymbol = currencySymbol(transactionCurrency, currency.locale);

  useEffect(() => {
    if (!open) return;
    Promise.all([listAccounts(), listRecurringRules()])
      .then(([items, rules]) => {
        setAccounts(items);
        setCommitments(rules);
        if (!form.getValues("account") && items[0])
          form.setValue("account", items[0].id);
      })
      .catch((reason) => {
        setAccounts([]);
        setFormError(
          reason instanceof Error ? reason.message : "Could not load accounts",
        );
      });
  }, [open, form]);

  const tiles = useMemo(
    () =>
      categories.items
        .filter((item) => item.category_type === categoryType)
        .map(categoryTile),
    [categories.items, categoryType],
  );

  function close() {
    onOpenChange(false);
    setFormError("");
    form.reset(blank("expense", form.getValues("account")));
  }

  function changeKind(next: Kind) {
    const values = form.getValues();
    form.reset(
      {
        ...values,
        kind: next,
        categoryId: "",
        toAccount: "",
        commitmentId: "",
      },
      { keepDirty: true },
    );
    setFormError("");
  }

  async function save(values: Values, addAnother: boolean) {
    setFormError("");
    const parsed = schema.parse(values);
    const category = categories.items.find(
      (item) => item.id === parsed.categoryId,
    );
    const linkedCommitment = commitments.find(
      (item) => item.id === parsed.commitmentId,
    );
    const counterparty =
      parsed.kind === "transfer"
        ? (selectedDestination?.name ?? "")
        : (category?.name ?? "");
    if (
      parsed.kind === "transfer" &&
      selectedAccount &&
      selectedDestination &&
      selectedAccount.currency !== selectedDestination.currency
    ) {
      form.setError("toAccount", {
        type: "validate",
        message:
          "Cross-currency transfers need an exchange rate and are not supported yet",
      });
      return;
    }
    try {
      await createTransaction({
        kind: parsed.kind,
        amount: parsed.amount,
        source:
          linkedCommitment?.source ??
          (parsed.kind === "income"
            ? counterparty
            : (selectedAccount?.name ?? "")),
        destination:
          linkedCommitment?.destination ??
          (parsed.kind === "income"
            ? (selectedAccount?.name ?? "")
            : counterparty),
        source_account_id:
          parsed.kind === "income" ? undefined : selectedAccount?.id,
        destination_account_id:
          parsed.kind === "income"
            ? selectedAccount?.id
            : parsed.kind === "transfer"
              ? selectedDestination?.id
              : undefined,
        merchant: parsed.merchant || undefined,
        occurred_on: parsed.date,
        currency: transactionCurrency,
        category_id: parsed.kind === "transfer" ? undefined : parsed.categoryId,
        notes: parsed.notes || undefined,
        recurring_rule_id: parsed.commitmentId || undefined,
      });
    } catch (reason) {
      setFormError(
        applyServerErrors(
          reason,
          form.setError,
          serverFields,
          "Could not save this transaction.",
        ),
      );
      return;
    }
    notifySuccess(
      copy[parsed.kind].saved,
      `${formatMoney(parsed.amount, transactionCurrency, currency.locale)} · ${parsed.merchant || counterparty}`,
    );
    window.dispatchEvent(new CustomEvent(TRANSACTIONS_CHANGED));
    onSaved?.();
    if (addAnother) {
      form.reset(blank(parsed.kind, parsed.account, parsed.date));
      form.setFocus("amount");
    } else {
      close();
    }
  }

  const noAccounts = accounts !== null && accounts.length === 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => (value ? onOpenChange(true) : close())}
    >
      <DialogContent className="gap-0 overflow-y-auto overscroll-contain p-0 sm:max-w-2xl max-sm:top-0 max-sm:left-0 max-sm:h-dvh max-sm:max-h-dvh max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none">
        <DialogHeader className="px-4 pt-4 pb-2 sm:px-6">
          <DialogTitle className="text-lg">Add transaction</DialogTitle>
          <DialogDescription>
            Record an expense, income, or transfer.
          </DialogDescription>
        </DialogHeader>
        <form
          noValidate
          className="flex flex-1 flex-col"
          onSubmit={form.handleSubmit((values) => save(values, false))}
        >
          <div className="space-y-5 px-4 pb-5 sm:px-6">
            <Tabs
              value={kind}
              onValueChange={(value) => changeKind(value as Kind)}
            >
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="expense">Expense</TabsTrigger>
                <TabsTrigger value="income">Income</TabsTrigger>
                <TabsTrigger value="transfer">Transfer</TabsTrigger>
              </TabsList>
            </Tabs>

            {commitments.length > 0 && (
              <Field
                id="linked-commitment"
                label="Linked commitment"
                optional
                hint="Select a bill, premium, LIC plan, investment, or expected income. Saving will advance its next due date."
              >
                <Controller
                  control={form.control}
                  name="commitmentId"
                  render={({ field }) => (
                    <Select
                      value={field.value || "none"}
                      onValueChange={(value) => {
                        if (!value || value === "none") {
                          field.onChange("");
                          return;
                        }
                        const rule = commitments.find(
                          (item) => item.id === value,
                        );
                        if (!rule) return;
                        form.reset({
                          ...form.getValues(),
                          kind: rule.kind,
                          amount: rule.amount,
                          categoryId: rule.category_id ?? "",
                          account:
                            rule.kind === "income"
                              ? (rule.destination_account_id ??
                                accounts?.find(
                                  (item) => item.name === rule.destination,
                                )?.id ??
                                "")
                              : (rule.source_account_id ??
                                accounts?.find(
                                  (item) => item.name === rule.source,
                                )?.id ??
                                ""),
                          toAccount:
                            rule.kind === "transfer"
                              ? (rule.destination_account_id ??
                                accounts?.find(
                                  (item) => item.name === rule.destination,
                                )?.id ??
                                "")
                              : "",
                          merchant: rule.name,
                          commitmentId: rule.id,
                        });
                        setFormError("");
                      }}
                    >
                      <SelectTrigger
                        ref={field.ref}
                        id="linked-commitment"
                        className="w-full"
                      >
                        <SelectValue placeholder="Not linked" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Not linked</SelectItem>
                        {commitments.map((item) => (
                          <SelectItem key={item.id} value={item.id}>
                            {item.name} · {currency.date(item.next_due_on)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
            )}

            <Field id="amount" label="Amount" error={errors.amount?.message}>
              <div
                className={cn(
                  "flex h-14 overflow-hidden rounded-xl border border-input bg-transparent transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50",
                  errors.amount &&
                    "border-destructive ring-3 ring-destructive/20 focus-within:border-destructive",
                )}
              >
                <span className="grid min-w-12 shrink-0 place-items-center border-r bg-muted/50 px-3 text-lg text-muted-foreground">
                  <span>{amountSymbol}</span>
                  <span className="text-[10px] font-medium">
                    {transactionCurrency}
                  </span>
                </span>
                <Input
                  {...controlProps("amount", errors.amount?.message)}
                  {...form.register("amount")}
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="0.00"
                  className="h-full rounded-none border-0 text-2xl font-semibold shadow-none focus-visible:ring-0 sm:h-full aria-invalid:ring-0"
                />
              </div>
            </Field>

            {kind !== "transfer" && (
              <Field
                id="category"
                label="Category"
                error={errors.categoryId?.message ?? categories.error}
              >
                {categories.loading ? (
                  <div className="grid grid-cols-4 gap-2 min-[480px]:grid-cols-5">
                    {Array.from({ length: 8 }, (_, index) => (
                      <div
                        key={index}
                        className="h-[4.75rem] animate-pulse rounded-xl bg-muted"
                      />
                    ))}
                  </div>
                ) : (
                  <Controller
                    control={form.control}
                    name="categoryId"
                    render={({ field }) => (
                      <TilePicker
                        id="category"
                        tiles={tiles}
                        value={field.value}
                        onChange={(value) => {
                          field.onChange(value);
                          field.onBlur();
                        }}
                        focusRef={field.ref}
                        invalid={!!errors.categoryId}
                        describedBy={
                          errors.categoryId ? "category-error" : undefined
                        }
                        onCreate={(name) =>
                          categories.quickCreate(name, categoryType)
                        }
                        createLabel="New"
                        createPlaceholder={`New ${categoryType} category`}
                      />
                    )}
                  />
                )}
              </Field>
            )}

            {noAccounts ? (
              <div className="flex flex-col gap-3 rounded-xl border border-dashed p-4 sm:flex-row sm:items-center">
                <WalletCards className="size-6 shrink-0 text-primary" />
                <p className="flex-1 text-sm font-medium">
                  Add an account first
                </p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    close();
                    navigate("/accounts");
                  }}
                >
                  Add account
                </Button>
              </div>
            ) : (
              <div
                className={cn(
                  "grid gap-4",
                  kind === "transfer" &&
                    "min-[480px]:grid-cols-[1fr_auto_1fr] min-[480px]:items-start",
                )}
              >
                <AccountSelect
                  id="account"
                  label={copy[kind].account}
                  name="account"
                  accounts={accounts}
                  control={form.control}
                  error={errors.account?.message}
                />
                {kind === "transfer" && (
                  <>
                    <ArrowRight
                      aria-hidden
                      className="mx-auto hidden size-4 text-muted-foreground min-[480px]:mt-10 min-[480px]:block"
                    />
                    <AccountSelect
                      id="to-account"
                      label="To account"
                      name="toAccount"
                      accounts={accounts}
                      control={form.control}
                      error={errors.toAccount?.message}
                    />
                  </>
                )}
              </div>
            )}

            <div className="grid gap-4 min-[480px]:grid-cols-2">
              <Field
                id="merchant"
                label={kind === "income" ? "Payer" : "Merchant or payee"}
                optional
                error={errors.merchant?.message}
              >
                <Input
                  {...controlProps("merchant", errors.merchant?.message)}
                  {...form.register("merchant")}
                  autoComplete="off"
                  placeholder={
                    kind === "income" ? "e.g. Employer" : "e.g. Big Bazaar"
                  }
                />
              </Field>
              <Field id="date" label="Date" error={errors.date?.message}>
                <Controller
                  control={form.control}
                  name="date"
                  render={({ field }) => (
                    <DatePicker
                      id="date"
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      triggerRef={field.ref}
                      quickPicks
                      invalid={!!errors.date}
                      describedBy={errors.date ? "date-error" : undefined}
                    />
                  )}
                />
              </Field>
            </div>

            <Field
              id="notes"
              label="Note"
              optional
              error={errors.notes?.message}
            >
              <Textarea
                {...controlProps("notes", errors.notes?.message)}
                {...form.register("notes")}
                rows={2}
                placeholder="Anything you want to remember"
              />
            </Field>

            <FormAlert>{formError}</FormAlert>
          </div>

          <DialogFooter className="sticky bottom-0 mt-auto flex-col-reverse gap-2 border-t bg-popover/95 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur sm:flex-row sm:px-6">
            <Button
              type="button"
              variant="outline"
              className="sm:flex-1"
              disabled={isSubmitting || noAccounts}
              onClick={form.handleSubmit((values) => save(values, true))}
            >
              Save &amp; add another
            </Button>
            <Button
              type="submit"
              className="sm:flex-1"
              loading={isSubmitting}
              disabled={noAccounts}
            >
              {isSubmitting ? "Saving…" : "Save transaction"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AccountSelect({
  id,
  label,
  name,
  accounts,
  control,
  error,
}: {
  id: string;
  label: string;
  name: "account" | "toAccount";
  accounts: AccountItem[] | null;
  control: ReturnType<typeof useForm<Values>>["control"];
  error?: string;
}) {
  return (
    <Field id={id} label={label} error={error}>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <Select
            value={field.value || null}
            onValueChange={(value) => {
              field.onChange(value ?? "");
              field.onBlur();
            }}
            disabled={accounts === null}
          >
            <SelectTrigger
              ref={field.ref}
              {...controlProps(id, error)}
              className="w-full"
            >
              <SelectValue
                placeholder={accounts === null ? "Loading…" : "Choose account"}
              />
            </SelectTrigger>
            <SelectContent>
              {accounts?.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.name} · {item.currency}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
    </Field>
  );
}
