import { useEffect, useMemo, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { DatePicker } from "@/components/date-picker";
import { MoneyInput } from "@/components/money-input";
import { TilePicker } from "@/components/tile-picker";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FormAlert } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  categoryTile,
  useCategories,
} from "@/features/categories/use-categories";
import { useMoney } from "@/hooks/use-money";
import {
  createCommitment,
  listAccounts,
  type AccountItem,
  type RecurringItem,
} from "@/lib/api";
import { currencySymbol, localDateISO } from "@/lib/format";
import {
  applyServerErrors,
  controlProps,
  money,
  notifySuccess,
  requiredText,
} from "@/lib/forms";

const frequencies = ["monthly", "weekly", "yearly", "daily"] as const;
const unit: Record<(typeof frequencies)[number], [string, string]> = {
  daily: ["day", "days"],
  weekly: ["week", "weeks"],
  monthly: ["month", "months"],
  yearly: ["year", "years"],
};

const schema = z
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
    if (value.planType === "investment" && !value.toAccount)
      context.addIssue({
        code: "custom",
        path: ["toAccount"],
        message: "Choose an investment account",
      });
    if (value.planType === "investment" && value.toAccount === value.account)
      context.addIssue({
        code: "custom",
        path: ["toAccount"],
        message: "Choose a different account",
      });
    if (
      value.planType === "investment" &&
      (!/^\d{1,4}$/.test(value.tenureMonths) ||
        Number(value.tenureMonths) < 1 ||
        Number(value.tenureMonths) > 1200)
    )
      context.addIssue({
        code: "custom",
        path: ["tenureMonths"],
        message: "Use 1 to 1200 months",
      });
  });
type Values = z.input<typeof schema>;

export function BillFormDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (bill: RecurringItem) => void;
}) {
  const currency = useMoney();
  const categories = useCategories(open);
  const [accounts, setAccounts] = useState<AccountItem[] | null>(null);
  const [formError, setFormError] = useState("");
  const [today] = useState(() => localDateISO());
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: {
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
    },
  });
  const { errors, isSubmitting } = form.formState;
  const values = useWatch({ control: form.control });
  const tiles = useMemo(
    () =>
      categories.items
        .filter(
          (item) =>
            item.category_type ===
            (values.planType === "income" ? "income" : "expense"),
        )
        .map(categoryTile),
    [categories.items, values.planType],
  );

  useEffect(() => {
    if (!open) return;
    form.reset({
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
    });
    listAccounts()
      .then((items) => {
        setAccounts(items);
        if (items[0]) form.setValue("account", items[0].id);
      })
      .catch(() => setAccounts([]));
  }, [open, form]);

  function changeOpen(next: boolean) {
    if (!next) setFormError("");
    onOpenChange(next);
  }

  async function save(input: Values) {
    setFormError("");
    const parsed = schema.parse(input);
    const category = categories.items.find(
      (item) => item.id === parsed.categoryId,
    );
    const sourceAccount = accounts?.find((item) => item.id === parsed.account);
    const destinationAccount = accounts?.find(
      (item) => item.id === parsed.toAccount,
    );
    if (
      parsed.planType === "investment" &&
      sourceAccount &&
      destinationAccount &&
      sourceAccount.currency !== destinationAccount.currency
    ) {
      form.setError("toAccount", {
        message: "Investment transfers must use the same currency",
      });
      return;
    }
    try {
      const bill = await createCommitment({
        kind:
          parsed.planType === "investment"
            ? "transfer"
            : parsed.planType === "income"
              ? "income"
              : "expense",
        name: parsed.name,
        amount: parsed.amount,
        currency: sourceAccount?.currency ?? currency.currency,
        frequency: parsed.frequency,
        interval: Number(parsed.interval),
        next_due_on: parsed.nextDue,
        source:
          parsed.planType === "income"
            ? (category?.name ?? parsed.name)
            : (sourceAccount?.name ?? ""),
        destination:
          parsed.planType === "investment"
            ? (destinationAccount?.name ?? "")
            : parsed.planType === "income"
              ? (sourceAccount?.name ?? "")
              : (category?.name ?? parsed.name),
        source_account_id:
          parsed.planType === "income" ? null : sourceAccount?.id,
        destination_account_id:
          parsed.planType === "income"
            ? sourceAccount?.id
            : parsed.planType === "investment"
              ? destinationAccount?.id
              : null,
        category_id:
          parsed.planType === "investment" ? null : (category?.id ?? null),
        plan_type: parsed.planType,
        cost_amount:
          parsed.planType === "income" && parsed.costAmount
            ? parsed.costAmount
            : null,
        annual_return_rate:
          parsed.planType === "investment" && parsed.annualReturnRate
            ? parsed.annualReturnRate
            : null,
        tenure_months:
          parsed.planType === "investment" ? Number(parsed.tenureMonths) : null,
      });
      notifySuccess(
        `${bill.name} added`,
        `Next due ${currency.date(bill.next_due_on)}`,
      );
      onCreated(bill);
      changeOpen(false);
    } catch (reason) {
      setFormError(
        applyServerErrors(
          reason,
          form.setError,
          {
            name: "name",
            amount: "amount",
            interval: "interval",
            next_due_on: "nextDue",
            source: "account",
          },
          "Could not add this bill.",
        ),
      );
    }
  }

  const frequency = values.frequency ?? "monthly";
  const every = Number(values.interval || 1);
  const investment = values.planType === "investment";
  const income = values.planType === "income";
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
            Recurring bill or investment details
          </DialogDescription>
        </DialogHeader>
        {accounts !== null && accounts.length === 0 ? (
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
                        : "e.g. Rent, EMI, Insurance premium"
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
              <div className="flex items-center gap-2">
                <Controller
                  control={form.control}
                  name="frequency"
                  render={({ field }) => (
                    <Tabs
                      value={field.value}
                      onValueChange={field.onChange}
                      className="flex-1"
                    >
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
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Every</span>
                <Input
                  {...controlProps("bill-interval", errors.interval?.message)}
                  {...form.register("interval")}
                  inputMode="numeric"
                  aria-label="Repeat interval"
                  className="w-16 text-center sm:w-16"
                />
                <span>{unit[frequency][every === 1 ? 0 : 1]}</span>
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
              <Field
                id="bill-account"
                label={income ? "Deposited to" : "Paid from"}
                error={errors.account?.message}
              >
                <Controller
                  control={form.control}
                  name="account"
                  render={({ field }) => (
                    <Select
                      value={field.value || null}
                      disabled={accounts === null}
                      onValueChange={(value) => {
                        field.onChange(value ?? "");
                        field.onBlur();
                      }}
                    >
                      <SelectTrigger
                        ref={field.ref}
                        {...controlProps(
                          "bill-account",
                          errors.account?.message,
                        )}
                        className="w-full"
                      >
                        <SelectValue
                          placeholder={
                            accounts === null ? "Loading…" : "Choose account"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {accounts?.map((item) => (
                          <SelectItem key={item.id} value={item.id}>
                            {item.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
            </div>

            {investment && (
              <div className="space-y-4">
                <Field
                  id="investment-account"
                  label="Invest into"
                  error={errors.toAccount?.message}
                >
                  <Controller
                    control={form.control}
                    name="toAccount"
                    render={({ field }) => (
                      <Select
                        value={field.value || null}
                        onValueChange={(value) => field.onChange(value ?? "")}
                      >
                        <SelectTrigger
                          ref={field.ref}
                          {...controlProps(
                            "investment-account",
                            errors.toAccount?.message,
                          )}
                          className="w-full"
                        >
                          <SelectValue placeholder="Choose investment account" />
                        </SelectTrigger>
                        <SelectContent>
                          {accounts
                            ?.filter(
                              (item) => item.account_type === "investment",
                            )
                            .map((item) => (
                              <SelectItem key={item.id} value={item.id}>
                                {item.name} · {item.currency}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {!accounts?.some(
                    (item) => item.account_type === "investment",
                  ) && (
                    <p className="text-xs text-amber-600">
                      Add an Investment account before creating this plan.
                    </p>
                  )}
                </Field>
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
                    hint="Projection only; actual returns may differ."
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
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
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
                hint="Used to estimate net income; leave blank for salary or passive income."
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
                  ? unit[frequency][0]
                  : `${every} ${unit[frequency][1]}`}
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
