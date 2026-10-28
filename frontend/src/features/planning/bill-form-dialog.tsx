import { useEffect, useMemo, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AccountSelect } from "@/components/common/account-select";
import { DatePicker } from "@/components/common/date-picker";
import { Field, FormAlert } from "@/components/common/form-field";
import { MoneyInput } from "@/components/common/money-input";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAccounts } from "@/features/accounts/hooks";
import { categoryTile, useCategories } from "@/features/categories/hooks";
import { useMoney } from "@/hooks/use-money";
import { currencySymbol, localDateISO } from "@/lib/format";
import { applyServerErrors, controlProps, notifySuccess } from "@/lib/forms";
import {
  billPayload,
  billSchema,
  billServerFields,
  emptyBill,
  frequencyUnit,
  type BillValues,
} from "./bill-form";
import { useCreateRecurring } from "./hooks";

export function BillFormDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const currency = useMoney();
  const categories = useCategories(open);
  const accountsQuery = useAccounts(open);
  const createRecurring = useCreateRecurring();
  const accounts = accountsQuery.data;
  const [formError, setFormError] = useState("");
  const [today] = useState(() => localDateISO());
  const form = useForm<BillValues>({
    resolver: zodResolver(billSchema),
    mode: "onTouched",
    defaultValues: emptyBill,
  });
  const { errors, isSubmitting } = form.formState;
  const values = useWatch({ control: form.control });
  const investment = values.planType === "investment";
  const income = values.planType === "income";
  const tiles = useMemo(
    () =>
      categories.items
        .filter(
          (item) => item.category_type === (income ? "income" : "expense"),
        )
        .map(categoryTile),
    [categories.items, income],
  );
  const investmentAccounts = accounts?.filter(
    (item) => item.account_type === "investment",
  );

  useEffect(() => {
    if (open) form.reset(emptyBill);
  }, [open, form]);

  useEffect(() => {
    if (open && accounts?.[0] && !form.getValues("account"))
      form.setValue("account", accounts[0].id);
  }, [open, accounts, form]);

  function changeOpen(next: boolean) {
    if (!next) setFormError("");
    onOpenChange(next);
  }

  async function save(input: BillValues) {
    setFormError("");
    const parsed = billSchema.parse(input);
    const source = accounts?.find((item) => item.id === parsed.account);
    const destination = accounts?.find((item) => item.id === parsed.toAccount);
    if (
      investment &&
      source &&
      destination &&
      source.currency !== destination.currency
    ) {
      form.setError("toAccount", {
        message: "Investment transfers must use the same currency",
      });
      return;
    }
    try {
      const bill = await createRecurring.mutateAsync(
        billPayload(parsed, {
          source,
          destination,
          category: categories.items.find(
            (item) => item.id === parsed.categoryId,
          ),
          fallbackCurrency: currency.currency,
        }),
      );
      notifySuccess(
        `${bill.name} added`,
        `Next due ${currency.date(bill.next_due_on)}`,
      );
      changeOpen(false);
    } catch (reason) {
      setFormError(
        applyServerErrors(
          reason,
          form.setError,
          billServerFields,
          "Could not add this bill.",
        ),
      );
    }
  }

  const frequency = values.frequency ?? "monthly";
  const every = Number(values.interval || 1);
  const sourceAccount = accounts?.find((item) => item.id === values.account);
  const amountSymbol = currencySymbol(
    sourceAccount?.currency ?? currency.currency,
    currency.locale,
  );

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent className="gap-5 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-lg">Add commitment</DialogTitle>
          <DialogDescription className="sr-only">
            Recurring bill, income, or investment details
          </DialogDescription>
        </DialogHeader>
        {accounts !== undefined && accounts.length === 0 ? (
          <FormAlert>Add an account first.</FormAlert>
        ) : (
          <form
            noValidate
            className="space-y-5"
            onSubmit={form.handleSubmit(save)}
          >
            <Controller
              control={form.control}
              name="planType"
              render={({ field }) => (
                <Tabs value={field.value} onValueChange={field.onChange}>
                  <TabsList className="grid h-auto w-full grid-cols-3">
                    <TabsTrigger value="bill">Bill or premium</TabsTrigger>
                    <TabsTrigger value="income">Income</TabsTrigger>
                    <TabsTrigger value="investment">Investment</TabsTrigger>
                  </TabsList>
                </Tabs>
              )}
            />
            <div className="grid gap-4 min-[420px]:grid-cols-2">
              <Field id="bill-name" label="Name" error={errors.name?.message}>
                <Input
                  {...controlProps("bill-name", errors.name?.message)}
                  {...form.register("name")}
                  autoComplete="off"
                  placeholder={
                    investment
                      ? "e.g. LIC plan, Mutual fund SIP"
                      : income
                        ? "e.g. Consulting, Shop income"
                        : "e.g. Rent, Insurance premium"
                  }
                />
              </Field>
              <Field
                id="bill-amount"
                label={
                  income
                    ? "Expected income"
                    : investment
                      ? "Contribution"
                      : "Amount"
                }
                error={errors.amount?.message}
              >
                <MoneyInput
                  id="bill-amount"
                  symbol={amountSymbol}
                  error={errors.amount?.message}
                  {...form.register("amount")}
                />
              </Field>
            </div>

            <Field
              id="bill-interval"
              label="Repeats"
              error={errors.interval?.message}
            >
              <Controller
                control={form.control}
                name="frequency"
                render={({ field }) => (
                  <Tabs value={field.value} onValueChange={field.onChange}>
                    <TabsList
                      aria-label="Repeat frequency"
                      className="grid w-full grid-cols-4"
                    >
                      <TabsTrigger value="monthly" className="px-1">
                        Monthly
                      </TabsTrigger>
                      <TabsTrigger value="weekly" className="px-1">
                        Weekly
                      </TabsTrigger>
                      <TabsTrigger value="yearly" className="px-1">
                        Yearly
                      </TabsTrigger>
                      <TabsTrigger value="daily" className="px-1">
                        Daily
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                )}
              />
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Every</span>
                <Input
                  {...controlProps("bill-interval", errors.interval?.message)}
                  {...form.register("interval")}
                  inputMode="numeric"
                  aria-label="Repeat interval"
                  className="w-16 text-center sm:w-16"
                />
                <span>{frequencyUnit[frequency][every === 1 ? 0 : 1]}</span>
              </div>
            </Field>

            <div className="grid gap-4 min-[420px]:grid-cols-2">
              <Field
                id="bill-due"
                label="Next due"
                error={errors.nextDue?.message}
              >
                <Controller
                  control={form.control}
                  name="nextDue"
                  render={({ field }) => (
                    <DatePicker
                      id="bill-due"
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      triggerRef={field.ref}
                      min={today}
                      invalid={!!errors.nextDue}
                      describedBy={
                        errors.nextDue ? "bill-due-error" : undefined
                      }
                    />
                  )}
                />
              </Field>
              <AccountSelect
                id="bill-account"
                label={income ? "Deposited to" : "Paid from"}
                name="account"
                accounts={accounts}
                control={form.control}
                error={errors.account?.message}
              />
            </div>

            {investment && (
              <div className="space-y-4">
                <AccountSelect
                  id="investment-account"
                  label="Invest into"
                  name="toAccount"
                  accounts={investmentAccounts}
                  control={form.control}
                  error={
                    errors.toAccount?.message ??
                    (investmentAccounts?.length === 0
                      ? "Add an investment account first"
                      : undefined)
                  }
                />
                <div className="grid gap-4 min-[420px]:grid-cols-2">
                  <Field
                    id="investment-tenure"
                    label="Tenure (months)"
                    error={errors.tenureMonths?.message}
                  >
                    <Input
                      {...controlProps(
                        "investment-tenure",
                        errors.tenureMonths?.message,
                      )}
                      {...form.register("tenureMonths")}
                      inputMode="numeric"
                      placeholder="e.g. 120"
                    />
                  </Field>
                  <Field
                    id="investment-return"
                    label="Expected annual return"
                    optional
                    error={errors.annualReturnRate?.message}
                  >
                    <div className="relative">
                      <Input
                        {...controlProps(
                          "investment-return",
                          errors.annualReturnRate?.message,
                        )}
                        {...form.register("annualReturnRate")}
                        inputMode="decimal"
                        placeholder="e.g. 7.5"
                        className="pr-9"
                      />
                      <span className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground">
                        %
                      </span>
                    </div>
                  </Field>
                </div>
              </div>
            )}

            {income && (
              <Field
                id="income-cost"
                label="Business cost per cycle"
                optional
                error={errors.costAmount?.message}
              >
                <MoneyInput
                  id="income-cost"
                  symbol={amountSymbol}
                  error={errors.costAmount?.message}
                  {...form.register("costAmount")}
                />
              </Field>
            )}

            {!investment && (
              <Field
                id="bill-category"
                label={income ? "Income source" : "Category"}
                optional
              >
                <Controller
                  control={form.control}
                  name="categoryId"
                  render={({ field }) => (
                    <TilePicker
                      id="bill-category"
                      variant="chips"
                      tiles={tiles}
                      value={field.value}
                      onChange={(value) =>
                        field.onChange(field.value === value ? "" : value)
                      }
                      focusRef={field.ref}
                      onCreate={(name) =>
                        categories.quickCreate(
                          name,
                          income ? "income" : "expense",
                        )
                      }
                      createLabel="New"
                      createPlaceholder={
                        income ? "New income category" : "New expense category"
                      }
                    />
                  )}
                />
              </Field>
            )}

            {Number(values.amount) > 0 && values.nextDue && (
              <p className="rounded-xl bg-primary/[0.08] p-3 text-sm">
                <strong className="money">
                  {currency.format(values.amount ?? 0)}
                </strong>{" "}
                every{" "}
                {every === 1
                  ? frequencyUnit[frequency][0]
                  : `${every} ${frequencyUnit[frequency][1]}`}
                , next <strong>{currency.date(values.nextDue)}</strong>
              </p>
            )}

            <FormAlert>{formError}</FormAlert>
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                disabled={isSubmitting}
                onClick={() => changeOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" loading={isSubmitting}>
                {isSubmitting
                  ? "Adding…"
                  : investment
                    ? "Add investment"
                    : income
                      ? "Add income"
                      : "Add bill"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
