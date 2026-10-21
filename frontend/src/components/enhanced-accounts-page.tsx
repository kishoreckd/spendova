import { useCallback, useEffect, useMemo, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Archive,
  CreditCard,
  CalendarClock,
  Landmark,
  PiggyBank,
  Plus,
  TrendingUp,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import { z } from "zod";
import { PageActions } from "@/app/page-actions";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { MoneyInput } from "@/components/money-input";
import { TilePicker, type Tile } from "@/components/tile-picker";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { useMoney } from "@/hooks/use-money";
import {
  archiveAccount,
  createAccountRecord,
  listAccounts,
  type AccountItem,
} from "@/lib/api";
import {
  applyServerErrors,
  controlProps,
  errorMessage,
  notifySuccess,
  optionalMoney,
  requiredText,
} from "@/lib/forms";

const accountTypes: Array<Tile & { icon: LucideIcon }> = [
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
const typeByValue = new Map(accountTypes.map((item) => [item.value, item]));
const owesMoney = (type?: string) => type === "credit" || type === "loan";

const schema = z
  .object({
    type: z.string().min(1, "Choose an account type"),
    name: requiredText("Give the account a nickname", 80),
    balance: optionalMoney({ allowZero: true }),
    institution: z.string().trim().max(100, "Keep this under 100 characters"),
    principal: optionalMoney(),
    interestRate: z.string().trim(),
    tenureMonths: z.string().trim(),
    installment: optionalMoney(),
  })
  .superRefine((value, context) => {
    const issue = (path: string, message: string) =>
      context.addIssue({ code: "custom", path: [path], message });
    if (value.type === "fixed_deposit" && !value.principal)
      issue("principal", "Enter the fixed deposit amount");
    if (value.type === "recurring_deposit" && !value.installment)
      issue("installment", "Enter the recurring installment");
    if (
      ["fixed_deposit", "recurring_deposit"].includes(value.type) &&
      (!/^\d{1,4}$/.test(value.tenureMonths) ||
        Number(value.tenureMonths) < 1 ||
        Number(value.tenureMonths) > 1200)
    )
      issue("tenureMonths", "Use 1 to 1200 months");
    if (
      value.interestRate &&
      (!/^\d{1,3}(\.\d{1,2})?$/.test(value.interestRate) ||
        Number(value.interestRate) > 100)
    )
      issue("interestRate", "Use a rate from 0 to 100");
  });
type Values = z.input<typeof schema>;

export function EnhancedAccountsPage() {
  const currency = useMoney();
  const [accounts, setAccounts] = useState<AccountItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [open, setOpen] = useState(false);
  const [archiving, setArchiving] = useState<AccountItem | null>(null);

  const load = useCallback(
    () =>
      listAccounts()
        .then((items) => {
          setAccounts(items);
          setLoadError("");
        })
        .catch((reason) =>
          setLoadError(errorMessage(reason, "Could not load accounts")),
        )
        .finally(() => setLoading(false)),
    [],
  );
  useEffect(() => {
    void load();
  }, [load]);

  const netWorth = useMemo(
    () =>
      accounts.reduce(
        (sum, account) =>
          sum + Number(account.current_balance ?? account.opening_balance ?? 0),
        0,
      ),
    [accounts],
  );

  return (
    <div className="space-y-6">
      <PageActions>
        <Button aria-label="Add account" onClick={() => setOpen(true)}>
          <Plus />
          <span className="hidden sm:inline">Add account</span>
        </Button>
      </PageActions>

      {!!accounts.length && (
        <Card className="border-primary/15 bg-gradient-to-br from-primary/[0.07] via-card to-card">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Net worth</p>
            <p
              className={`money mt-1 text-3xl font-semibold ${netWorth < 0 ? "text-rose-600" : ""}`}
            >
              {currency.format(netWorth)}
            </p>
          </CardContent>
        </Card>
      )}

      {loadError && (
        <div className="space-y-3">
          <FormAlert>{loadError}</FormAlert>
          <Button variant="outline" onClick={() => void load()}>
            Try again
          </Button>
        </div>
      )}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[0, 1].map((item) => (
            <div
              key={item}
              className="h-20 animate-pulse rounded-2xl bg-muted"
            />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {accounts.map((account) => {
            const type =
              typeByValue.get(account.account_type) ?? accountTypes[0];
            const Icon = type.icon;
            const balance = Number(
              account.current_balance ?? account.opening_balance ?? 0,
            );
            const projection = projectedDepositValue(account);
            return (
              <Card
                key={account.id}
                className="transition hover:border-primary/40 hover:shadow-md"
              >
                <CardContent className="flex items-center gap-4 p-5">
                  <span
                    className="grid size-11 shrink-0 place-items-center rounded-2xl"
                    style={{
                      color: type.color,
                      backgroundColor: `color-mix(in oklch, ${type.color} 14%, transparent)`,
                    }}
                  >
                    <Icon />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{account.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {type.label}
                    </p>
                    {account.institution && (
                      <p className="truncate text-xs text-muted-foreground">
                        {account.institution}
                      </p>
                    )}
                    {account.tenure_months && (
                      <p className="text-xs text-muted-foreground">
                        {account.tenure_months} months
                        {account.annual_interest_rate
                          ? ` · ${Number(account.annual_interest_rate)}% p.a.`
                          : ""}
                      </p>
                    )}
                    {projection !== null && (
                      <p className="mt-1 text-xs font-medium text-primary">
                        Est. maturity {currency.format(projection)}
                      </p>
                    )}
                  </div>
                  <p
                    className={`money font-semibold ${balance < 0 ? "text-rose-600" : ""}`}
                  >
                    {currency.format(balance)}
                    <span className="mt-0.5 block text-right text-[10px] font-normal text-muted-foreground">
                      {owesMoney(account.account_type)
                        ? "Outstanding"
                        : "Current balance"}
                    </span>
                  </p>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Archive ${account.name}`}
                    onClick={() => setArchiving(account)}
                  >
                    <Archive />
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {!loading && !accounts.length && !loadError && (
        <Card className="border-dashed">
          <CardContent className="flex min-h-52 flex-col items-center justify-center p-8 text-center">
            <WalletCards className="size-10 text-muted-foreground" />
            <h3 className="mt-3 font-semibold">No accounts yet</h3>
            <Button className="mt-4" onClick={() => setOpen(true)}>
              <Plus />
              Add first account
            </Button>
          </CardContent>
        </Card>
      )}

      <AccountFormDialog
        open={open}
        onOpenChange={setOpen}
        onCreated={(account) => setAccounts((current) => [...current, account])}
      />
      <ConfirmDialog
        open={!!archiving}
        onOpenChange={(next) => !next && setArchiving(null)}
        title={`Archive ${archiving?.name ?? "this account"}?`}
        description="It will be hidden from account pickers. Transactions already recorded against it stay in your history."
        confirmLabel="Archive account"
        onConfirm={async () => {
          if (!archiving) return;
          await archiveAccount(archiving.id);
          setAccounts((current) =>
            current.filter((item) => item.id !== archiving.id),
          );
          notifySuccess(`${archiving.name} archived`);
        }}
      />
    </div>
  );
}

function projectedDepositValue(account: AccountItem) {
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

function AccountFormDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (account: AccountItem) => void;
}) {
  const currency = useMoney();
  const [formError, setFormError] = useState("");
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: {
      type: "bank",
      name: "",
      balance: "",
      institution: "",
      principal: "",
      interestRate: "",
      tenureMonths: "",
      installment: "",
    },
  });
  const { errors, isSubmitting } = form.formState;
  const type = useWatch({ control: form.control, name: "type" });

  useEffect(() => {
    if (open)
      form.reset({
        type: "bank",
        name: "",
        balance: "",
        institution: "",
        principal: "",
        interestRate: "",
        tenureMonths: "",
        installment: "",
      });
  }, [open, form]);

  function changeOpen(next: boolean) {
    if (!next) setFormError("");
    onOpenChange(next);
  }

  async function save(values: Values) {
    setFormError("");
    const parsed = schema.parse(values);
    const entered = parsed.balance || "0";
    try {
      const created = await createAccountRecord({
        name: parsed.name,
        account_type: parsed.type,
        currency: currency.currency,
        opening_balance:
          owesMoney(parsed.type) && Number(entered) > 0
            ? `-${entered}`
            : entered,
        institution: parsed.institution || null,
        principal_amount: parsed.principal || null,
        annual_interest_rate: parsed.interestRate || null,
        tenure_months: parsed.tenureMonths ? Number(parsed.tenureMonths) : null,
        installment_amount: parsed.installment || null,
      });
      notifySuccess(`${created.name} added`);
      onCreated(created);
      onOpenChange(false);
    } catch (reason) {
      setFormError(
        applyServerErrors(
          reason,
          form.setError,
          { name: "name", account_type: "type", opening_balance: "balance" },
          "Could not add this account.",
        ),
      );
    }
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent className="gap-5 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg">Add an account</DialogTitle>
          <DialogDescription className="sr-only">
            Account type, nickname, and balance
          </DialogDescription>
        </DialogHeader>
        <form
          noValidate
          className="space-y-5"
          onSubmit={form.handleSubmit(save)}
        >
          <Field
            id="account-type"
            label="Account type"
            error={errors.type?.message}
          >
            <Controller
              control={form.control}
              name="type"
              render={({ field }) => (
                <TilePicker
                  id="account-type"
                  variant="chips"
                  tiles={accountTypes}
                  value={field.value}
                  onChange={field.onChange}
                  focusRef={field.ref}
                  invalid={!!errors.type}
                />
              )}
            />
          </Field>
          <Field
            id="account-name"
            label="Nickname"
            error={errors.name?.message}
          >
            <Input
              {...controlProps("account-name", errors.name?.message)}
              {...form.register("name")}
              autoComplete="off"
              placeholder={
                type === "credit"
                  ? "e.g. SBI Cashback Card"
                  : "e.g. Salary account"
              }
            />
          </Field>
          <Field
            id="account-balance"
            label={owesMoney(type) ? "Amount you owe today" : "Current balance"}
            optional
            error={errors.balance?.message}
          >
            <MoneyInput
              id="account-balance"
              symbol={currency.symbol}
              error={errors.balance?.message}
              {...form.register("balance")}
            />
          </Field>
          {(type === "loan" ||
            type === "fixed_deposit" ||
            type === "recurring_deposit") && (
            <div className="space-y-4 rounded-xl border bg-muted/20 p-4">
              <Field
                id="account-institution"
                label={type === "loan" ? "Lender" : "Bank or institution"}
                optional
                error={errors.institution?.message}
              >
                <Input
                  {...controlProps(
                    "account-institution",
                    errors.institution?.message,
                  )}
                  {...form.register("institution")}
                  placeholder={type === "loan" ? "e.g. HDFC Bank" : "e.g. SBI"}
                />
              </Field>
              <div className="grid gap-4 min-[420px]:grid-cols-2">
                {type !== "recurring_deposit" && (
                  <Field
                    id="account-principal"
                    label={
                      type === "loan"
                        ? "Original borrowed amount"
                        : "Deposit amount"
                    }
                    error={errors.principal?.message}
                  >
                    <MoneyInput
                      id="account-principal"
                      symbol={currency.symbol}
                      error={errors.principal?.message}
                      {...form.register("principal")}
                    />
                  </Field>
                )}
                {type === "recurring_deposit" && (
                  <Field
                    id="account-installment"
                    label="Monthly installment"
                    error={errors.installment?.message}
                  >
                    <MoneyInput
                      id="account-installment"
                      symbol={currency.symbol}
                      error={errors.installment?.message}
                      {...form.register("installment")}
                    />
                  </Field>
                )}
                <Field
                  id="account-rate"
                  label="Interest rate (% p.a.)"
                  optional
                  error={errors.interestRate?.message}
                >
                  <Input
                    {...controlProps(
                      "account-rate",
                      errors.interestRate?.message,
                    )}
                    {...form.register("interestRate")}
                    inputMode="decimal"
                    placeholder="e.g. 7.25"
                  />
                </Field>
              </div>
              <Field
                id="account-tenure"
                label="Tenure (months)"
                optional={type === "loan"}
                error={errors.tenureMonths?.message}
              >
                <Input
                  {...controlProps(
                    "account-tenure",
                    errors.tenureMonths?.message,
                  )}
                  {...form.register("tenureMonths")}
                  inputMode="numeric"
                  placeholder="e.g. 60"
                />
              </Field>
              <p className="text-xs text-muted-foreground">
                {type === "loan"
                  ? "Record repayments as transfers from your bank account to this loan."
                  : "Returns shown from this rate are estimates until the institution credits the interest."}
              </p>
            </div>
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
              {isSubmitting ? "Adding…" : "Add account"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
