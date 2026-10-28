import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { addDays } from "date-fns";
import { z } from "zod";
import { DatePicker } from "@/components/common/date-picker";
import { MoneyInput } from "@/components/common/money-input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FormAlert } from "@/components/common/form-field";
import { Input } from "@/components/ui/input";
import { useMoney } from "@/hooks/use-money";
import type { GoalItem } from "@/api/goals/types";
import { localDateISO } from "@/lib/format";
import {
  applyServerErrors,
  controlProps,
  money,
  notifySuccess,
  optionalMoney,
  requiredText,
} from "@/lib/forms";
import { purchaseGoal } from "@/lib/planning";
import { useCreateGoal } from "./hooks";

const schema = z
  .object({
    name: requiredText("Name what you're saving for", 100),
    price: money("the expected price"),
    saved: optionalMoney({ allowZero: true }),
    date: z
      .string()
      .min(1, "Choose when you want to buy it")
      .refine((value) => value > localDateISO(), "Choose a date after today"),
  })
  .superRefine((value, context) => {
    if (value.saved && Number(value.saved) > Number(value.price))
      context.addIssue({
        code: "custom",
        path: ["saved"],
        message: "Can't be more than the expected price",
      });
  });
type Values = z.input<typeof schema>;

export function PurchaseGoalCalculator({
  onSaved,
}: {
  onSaved?: (goal: GoalItem) => void;
}) {
  const currency = useMoney();
  const createGoal = useCreateGoal();
  const [formError, setFormError] = useState("");
  const [tomorrow] = useState(() => localDateISO(addDays(new Date(), 1)));
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: { name: "", price: "", saved: "", date: "" },
  });
  const { errors, isSubmitting } = form.formState;
  const values = useWatch({ control: form.control });
  const price = Number(values.price?.replace(/,/g, ""));
  const saved = Number(values.saved?.replace(/,/g, "") || 0);
  const result =
    price > 0 && values.date && values.date > localDateISO()
      ? purchaseGoal({ targetPrice: price, saved, targetDate: values.date })
      : null;
  const show = (value: number) => (result ? currency.format(value, 0) : "—");

  async function save(input: Values) {
    setFormError("");
    const parsed = schema.parse(input);
    const plan = purchaseGoal({
      targetPrice: Number(parsed.price),
      saved: Number(parsed.saved || 0),
      targetDate: parsed.date,
    });
    try {
      const goal = await createGoal.mutateAsync({
        name: parsed.name,
        target_amount: parsed.price,
        saved_amount: parsed.saved || "0",
        months: plan.months,
      });
      notifySuccess(
        `${goal.name} goal saved`,
        `Save ${currency.format(goal.monthly_required, 0)} a month.`,
      );
      form.reset();
      onSaved?.(goal);
    } catch (reason) {
      setFormError(
        applyServerErrors(
          reason,
          form.setError,
          { name: "name", target_amount: "price", saved_amount: "saved" },
          "Could not save this goal.",
        ),
      );
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2 lg:gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Plan a purchase</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            noValidate
            className="space-y-4"
            onSubmit={form.handleSubmit(save)}
          >
            <Field id="goal-name" label="What" error={errors.name?.message}>
              <Input
                {...controlProps("goal-name", errors.name?.message)}
                {...form.register("name")}
                autoComplete="off"
                placeholder="e.g. iPhone 17"
              />
            </Field>
            <div className="grid gap-4 min-[400px]:grid-cols-2">
              <Field
                id="goal-price"
                label="Expected price"
                error={errors.price?.message}
              >
                <MoneyInput
                  id="goal-price"
                  symbol={currency.symbol}
                  error={errors.price?.message}
                  {...form.register("price")}
                />
              </Field>
              <Field
                id="goal-saved"
                label="Already saved"
                optional
                error={errors.saved?.message}
              >
                <MoneyInput
                  id="goal-saved"
                  symbol={currency.symbol}
                  error={errors.saved?.message}
                  {...form.register("saved")}
                />
              </Field>
            </div>
            <Field id="goal-date" label="Buy by" error={errors.date?.message}>
              <Controller
                control={form.control}
                name="date"
                render={({ field }) => (
                  <DatePicker
                    id="goal-date"
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    triggerRef={field.ref}
                    min={tomorrow}
                    invalid={!!errors.date}
                    describedBy={errors.date ? "goal-date-error" : undefined}
                  />
                )}
              />
            </Field>
            <FormAlert>{formError}</FormAlert>
            <Button type="submit" className="w-full" loading={isSubmitting}>
              {isSubmitting ? "Saving…" : "Save goal"}
            </Button>
          </form>
        </CardContent>
      </Card>
      <Card className="bg-gradient-to-br from-slate-900 to-teal-950 text-white">
        <CardContent className="space-y-5 p-5 sm:p-6">
          <div>
            <p className="text-sm text-slate-300">Save each month</p>
            <p className="money mt-1 text-4xl font-semibold">
              {show(result?.monthly ?? 0)}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Metric label="Per day" value={show(result?.daily ?? 0)} />
            <Metric label="Per week" value={show(result?.weekly ?? 0)} />
            <Metric label="Still needed" value={show(result?.remaining ?? 0)} />
            <Metric
              label="Days left"
              value={result ? result.days.toLocaleString() : "—"}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/10 p-3">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="money mt-1 truncate font-semibold">{value}</p>
    </div>
  );
}
