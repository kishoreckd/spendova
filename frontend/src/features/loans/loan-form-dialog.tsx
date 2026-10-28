import { useEffect, useMemo, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { LoanTerms } from "@/api/loans/types";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useAccounts } from "@/features/accounts/hooks";
import { useAssets } from "@/features/assets/hooks";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useMoney } from "@/hooks/use-money";
import { localDateISO } from "@/lib/format";
import { applyServerErrors, controlProps, notifySuccess } from "@/lib/forms";
import { useCreateLoan, useLoanPreview } from "./hooks";
import {
  emptyLoan,
  loanPayload,
  loanSchema,
  loanServerFields,
  termsFrom,
  type LoanValues,
} from "./loan-form";
import { LoanPreviewPanel } from "./loan-preview-panel";
import { loanTypes, namePlaceholder } from "./loan-types";

export function LoanFormDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const currency = useMoney();
  const accounts = useAccounts(open).data;
  const assets = useAssets(open).data ?? [];
  const createLoan = useCreateLoan();
  const [formError, setFormError] = useState("");
  const [today] = useState(() => localDateISO());
  const form = useForm<LoanValues>({
    resolver: zodResolver(loanSchema),
    mode: "onTouched",
    defaultValues: emptyLoan(),
  });
  const { errors, isSubmitting } = form.formState;
  const values = useWatch({ control: form.control });
  const loanType = values.loanType ?? "product_emi";
  const startedInPast = !!values.firstDue && values.firstDue < today;

  // Debounce a string so typing in unrelated fields doesn't restart the timer.
  const termsKey = JSON.stringify(open ? termsFrom(values) : null);
  const debouncedKey = useDebouncedValue(termsKey);
  const terms = useMemo(
    () => JSON.parse(debouncedKey) as LoanTerms | null,
    [debouncedKey],
  );
  const preview = useLoanPreview(terms);
  const termsComplete = termsKey !== "null";

  useEffect(() => {
    if (open) form.reset(emptyLoan());
  }, [open, form]);

  function changeOpen(next: boolean) {
    if (!next) setFormError("");
    onOpenChange(next);
  }

  async function save(input: LoanValues) {
    setFormError("");
    try {
      const loan = await createLoan.mutateAsync(
        loanPayload(loanSchema.parse(input)),
      );
      notifySuccess(
        `${loan.name} added`,
        `${currency.format(loan.summary.emi)} a month until ${currency.date(loan.summary.last_due_on, { month: "short", year: "numeric" })}`,
      );
      changeOpen(false);
    } catch (reason) {
      setFormError(
        applyServerErrors(
          reason,
          form.setError,
          loanServerFields,
          "Could not save this loan.",
        ),
      );
    }
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent className="gap-0 overflow-y-auto overscroll-contain p-0 sm:max-w-2xl max-sm:top-0 max-sm:left-0 max-sm:h-dvh max-sm:max-h-dvh max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none">
        <DialogHeader className="px-4 pt-4 pb-2 sm:px-6">
          <DialogTitle className="text-lg">Add loan or EMI</DialogTitle>
          <DialogDescription className="sr-only">
            Amount, interest or EMI, tenure, and first due date
          </DialogDescription>
        </DialogHeader>
        <form
          noValidate
          className="flex flex-1 flex-col"
          onSubmit={form.handleSubmit(save)}
        >
          <div className="space-y-5 px-4 pb-5 sm:px-6">
            <Field id="loan-type" label="Type" error={errors.loanType?.message}>
              <Controller
                control={form.control}
                name="loanType"
                render={({ field }) => (
                  <TilePicker
                    id="loan-type"
                    variant="chips"
                    tiles={loanTypes}
                    value={field.value}
                    onChange={field.onChange}
                    focusRef={field.ref}
                    invalid={!!errors.loanType}
                  />
                )}
              />
            </Field>

            <div className="grid gap-4 min-[480px]:grid-cols-2">
              <Field
                id="loan-name"
                label={
                  loanType === "product_emi" || loanType === "credit_card_emi"
                    ? "Product"
                    : "Name"
                }
                error={errors.name?.message}
              >
                <Input
                  {...controlProps("loan-name", errors.name?.message)}
                  {...form.register("name")}
                  autoComplete="off"
                  placeholder={namePlaceholder[loanType]}
                />
              </Field>
              <Field
                id="loan-lender"
                label="Lender or store"
                optional
                error={errors.lender?.message}
              >
                <Input
                  {...controlProps("loan-lender", errors.lender?.message)}
                  {...form.register("lender")}
                  autoComplete="off"
                  placeholder="e.g. Bajaj Finserv"
                />
              </Field>
            </div>

            <div className="grid gap-4 min-[480px]:grid-cols-2">
              <Field
                id="loan-principal"
                label="Amount"
                error={errors.principal?.message}
              >
                <MoneyInput
                  id="loan-principal"
                  symbol={currency.symbol}
                  error={errors.principal?.message}
                  placeholder="e.g. 50000"
                  {...form.register("principal")}
                />
              </Field>
              <Field
                id="loan-tenure"
                label="Tenure (months)"
                error={errors.tenure?.message}
              >
                <Input
                  {...controlProps("loan-tenure", errors.tenure?.message)}
                  {...form.register("tenure")}
                  inputMode="numeric"
                  placeholder="e.g. 12"
                />
              </Field>
            </div>

            <div className="grid gap-4 min-[480px]:grid-cols-2">
              <Field
                id="loan-emi"
                label="Monthly EMI"
                optional
                error={errors.emi?.message}
              >
                <MoneyInput
                  id="loan-emi"
                  symbol={currency.symbol}
                  error={errors.emi?.message}
                  placeholder="e.g. 4600"
                  {...form.register("emi")}
                />
              </Field>
              <Field
                id="loan-rate"
                label="Interest rate (% p.a.)"
                optional
                error={errors.rate?.message}
              >
                <div className="relative">
                  <Input
                    {...controlProps("loan-rate", errors.rate?.message)}
                    {...form.register("rate")}
                    inputMode="decimal"
                    placeholder="e.g. 12"
                    className="pr-9"
                  />
                  <span className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground">
                    %
                  </span>
                </div>
              </Field>
            </div>

            <div className="grid gap-4 min-[480px]:grid-cols-2">
              <Field
                id="loan-first-due"
                label="First EMI date"
                error={errors.firstDue?.message}
              >
                <Controller
                  control={form.control}
                  name="firstDue"
                  render={({ field }) => (
                    <DatePicker
                      id="loan-first-due"
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      triggerRef={field.ref}
                      invalid={!!errors.firstDue}
                      describedBy={
                        errors.firstDue ? "loan-first-due-error" : undefined
                      }
                    />
                  )}
                />
              </Field>
              <Field
                id="loan-fee"
                label="Processing fee"
                optional
                error={errors.fee?.message}
              >
                <MoneyInput
                  id="loan-fee"
                  symbol={currency.symbol}
                  error={errors.fee?.message}
                  {...form.register("fee")}
                />
              </Field>
            </div>

            {startedInPast && (
              <Field
                id="loan-paid-before"
                label="EMIs already paid"
                optional
                error={errors.paidBefore?.message}
              >
                <Input
                  {...controlProps(
                    "loan-paid-before",
                    errors.paidBefore?.message,
                  )}
                  {...form.register("paidBefore")}
                  inputMode="numeric"
                  placeholder="All due so far"
                />
              </Field>
            )}

            <LoanPreviewPanel
              summary={termsComplete ? preview.data?.summary : undefined}
              loading={preview.isFetching || termsKey !== debouncedKey}
              error={termsComplete && terms ? preview.error : null}
            />

            <div className="grid gap-4 min-[480px]:grid-cols-2">
              <AccountSelect
                id="loan-account"
                label="Paid from"
                name="account"
                accounts={accounts}
                control={form.control}
                optional
                noneLabel="Not linked"
                error={errors.account?.message}
              />
              {assets.length > 0 && (
                <Field
                  id="loan-asset"
                  label="Linked asset"
                  optional
                  error={errors.asset?.message}
                >
                  <Controller
                    control={form.control}
                    name="asset"
                    render={({ field }) => (
                      <Select
                        value={field.value || "none"}
                        onValueChange={(value) =>
                          field.onChange(
                            !value || value === "none" ? "" : value,
                          )
                        }
                      >
                        <SelectTrigger
                          ref={field.ref}
                          id="loan-asset"
                          className="w-full"
                        >
                          <SelectValue>
                            {assets.find((item) => item.id === field.value)
                              ?.name ?? "None"}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {assets.map((item) => (
                            <SelectItem key={item.id} value={item.id}>
                              {item.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </Field>
              )}
            </div>

            <Controller
              control={form.control}
              name="trackPayments"
              render={({ field }) => (
                <label className="flex min-h-11 cursor-pointer items-center justify-between gap-4 rounded-xl border px-4 py-3 text-sm font-medium">
                  <span>Remind me every month</span>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </label>
              )}
            />

            <FormAlert>{formError}</FormAlert>
          </div>

          <DialogFooter className="sticky bottom-0 mt-auto gap-2 border-t bg-popover/95 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur sm:px-6">
            <Button
              type="button"
              variant="ghost"
              disabled={isSubmitting}
              onClick={() => changeOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting}>
              {isSubmitting ? "Saving…" : "Save loan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
