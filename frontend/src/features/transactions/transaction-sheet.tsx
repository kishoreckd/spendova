import { useEffect, useMemo, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, WalletCards } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "cn";
import { AccountSelect } from "@/components/common/account-select";
import { DatePicker } from "@/components/common/date-picker";
import { Field, FormAlert } from "@/components/common/form-field";
import { TilePicker } from "@/components/common/tile-picker";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAccounts } from "@/features/accounts/hooks";
import { categoryTile, useCategories } from "@/features/categories/hooks";
import { useRecurring } from "@/features/planning/hooks";
import { useMoney } from "@/hooks/use-money";
import { currencySymbol, formatMoney } from "@/lib/format";
import {
  applyServerErrors,
  controlProps,
  errorMessage,
  notifySuccess,
} from "@/lib/forms";
import { useCreateTransaction } from "./hooks";
import {
  blankTransaction,
  kindCopy,
  serverFields,
  transactionSchema,
  valuesFromCommitment,
  type Kind,
  type TransactionValues,
} from "./transaction-form";

type Props = {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  onSaved?: () => void;
};

export function TransactionSheet({ open, onOpenChange, onSaved }: Props) {
  const navigate = useNavigate();
  const currency = useMoney();
  const categories = useCategories(open);
  const accountsQuery = useAccounts(open);
  const commitmentsQuery = useRecurring(open);
  const createTransaction = useCreateTransaction();
  const accounts = accountsQuery.data;
  const commitments = useMemo(
    () => commitmentsQuery.data ?? [],
    [commitmentsQuery.data],
  );
  const [formError, setFormError] = useState("");
  const form = useForm<TransactionValues>({
    resolver: zodResolver(transactionSchema),
    defaultValues: blankTransaction("expense"),
    mode: "onTouched",
  });
  const { errors, isSubmitting } = form.formState;
  const kind = useWatch({ control: form.control, name: "kind" });
  const accountId = useWatch({ control: form.control, name: "account" });
  const toAccountId = useWatch({ control: form.control, name: "toAccount" });
  const categoryType = kind === "income" ? "income" : "expense";
  const selectedAccount = accounts?.find((item) => item.id === accountId);
  const selectedDestination = accounts?.find((item) => item.id === toAccountId);
  const transactionCurrency = selectedAccount?.currency ?? currency.currency;
  const amountSymbol = currencySymbol(transactionCurrency, currency.locale);
  const loadError = accountsQuery.error
    ? errorMessage(accountsQuery.error, "Could not load accounts")
    : "";

  // Default to the first account once accounts arrive.
  useEffect(() => {
    if (open && accounts?.[0] && !form.getValues("account"))
      form.setValue("account", accounts[0].id);
  }, [open, accounts, form]);

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
    form.reset(blankTransaction("expense", form.getValues("account")));
  }

  function changeKind(next: Kind) {
    form.reset(
      {
        ...form.getValues(),
        kind: next,
        categoryId: "",
        toAccount: "",
        commitmentId: "",
      },
      { keepDirty: true },
    );
    setFormError("");
  }

  async function save(values: TransactionValues, addAnother: boolean) {
    setFormError("");
    const parsed = transactionSchema.parse(values);
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
      await createTransaction.mutateAsync({
        body: {
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
          category_id:
            parsed.kind === "transfer" ? undefined : parsed.categoryId,
          notes: parsed.notes || undefined,
          recurring_rule_id: parsed.commitmentId || undefined,
        },
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
      kindCopy[parsed.kind].saved,
      `${formatMoney(parsed.amount, transactionCurrency, currency.locale)} · ${parsed.merchant || counterparty}`,
    );
    onSaved?.();
    if (addAnother) {
      form.reset(blankTransaction(parsed.kind, parsed.account, parsed.date));
      form.setFocus("amount");
    } else {
      close();
    }
  }

  const noAccounts = accounts !== undefined && accounts.length === 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => (value ? onOpenChange(true) : close())}
    >
      <DialogContent className="gap-0 overflow-y-auto overscroll-contain p-0 sm:max-w-2xl max-sm:top-0 max-sm:left-0 max-sm:h-dvh max-sm:max-h-dvh max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none">
        <DialogHeader className="px-4 pt-4 pb-2 sm:px-6">
          <DialogTitle className="text-lg">Add transaction</DialogTitle>
          <DialogDescription className="sr-only">
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
                label="Linked bill or plan"
                optional
              >
                <Controller
                  control={form.control}
                  name="commitmentId"
                  render={({ field }) => (
                    <Select
                      value={field.value || "none"}
                      onValueChange={(value) => {
                        const rule = commitments.find(
                          (item) => item.id === value,
                        );
                        if (!rule) {
                          field.onChange("");
                          return;
                        }
                        form.reset(
                          valuesFromCommitment(
                            form.getValues(),
                            rule,
                            accounts,
                          ),
                        );
                        setFormError("");
                      }}
                    >
                      <SelectTrigger
                        ref={field.ref}
                        id="linked-commitment"
                        className="w-full"
                      >
                        <SelectValue>
                          {commitments.find((item) => item.id === field.value)
                            ?.name ?? "Not linked"}
                        </SelectValue>
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
                  label={kindCopy[kind].account}
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

            <FormAlert>{formError || loadError}</FormAlert>
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
