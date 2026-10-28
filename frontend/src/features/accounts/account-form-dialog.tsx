import { useEffect, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import { useMoney } from "@/hooks/use-money";
import {
  applyServerErrors,
  controlProps,
  notifySuccess,
  optionalMoney,
  requiredText,
} from "@/lib/forms";
import { accountTypes, owesMoney } from "./account-types";
import { useCreateAccount } from "./hooks";

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

const emptyValues: Values = {
  type: "bank",
  name: "",
  balance: "",
  institution: "",
  principal: "",
  interestRate: "",
  tenureMonths: "",
  installment: "",
};

const serverFields = {
  name: "name",
  account_type: "type",
  opening_balance: "balance",
  institution: "institution",
  principal_amount: "principal",
  annual_interest_rate: "interestRate",
  tenure_months: "tenureMonths",
  installment_amount: "installment",
} as const;

export function AccountFormDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const currency = useMoney();
  const createAccount = useCreateAccount();
  const [formError, setFormError] = useState("");
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: emptyValues,
  });
  const { errors, isSubmitting } = form.formState;
  const type = useWatch({ control: form.control, name: "type" });

  useEffect(() => {
    if (open) form.reset(emptyValues);
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
      const created = await createAccount.mutateAsync({
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
      onOpenChange(false);
    } catch (reason) {
      setFormError(
        applyServerErrors(
          reason,
          form.setError,
          serverFields,
          "Could not add this account.",
        ),
      );
    }
  }

  const hasTerms =
    type === "loan" || type === "fixed_deposit" || type === "recurring_deposit";

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
          {hasTerms && (
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
                {type === "recurring_deposit" ? (
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
                ) : (
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
