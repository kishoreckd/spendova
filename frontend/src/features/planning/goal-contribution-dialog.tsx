import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { DatePicker } from "@/components/common/date-picker";
import { MoneyInput } from "@/components/common/money-input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  pastOrToday,
} from "@/lib/forms";
import { useContributeToGoal } from "./hooks";

const schema = z.object({
  amount: money(),
  date: pastOrToday("Choose a date"),
  note: z.string().trim().max(250, "Keep notes under 250 characters"),
});
type Values = z.input<typeof schema>;

export function GoalContributionDialog({
  goal,
  onOpenChange,
}: {
  /** The goal receiving money; the dialog is open while this is set. */
  goal: GoalItem | null;
  onOpenChange: (open: boolean) => void;
}) {
  const currency = useMoney();
  const contribute = useContributeToGoal();
  const [formError, setFormError] = useState("");
  const [today] = useState(() => localDateISO());
  const remaining = goal
    ? Number(goal.target_amount) - Number(goal.saved_amount)
    : 0;
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: { amount: "", date: today, note: "" },
  });
  const { errors, isSubmitting } = form.formState;

  useEffect(() => {
    if (goal) form.reset({ amount: "", date: today, note: "" });
  }, [goal, today, form]);

  function changeOpen(next: boolean) {
    if (!next) setFormError("");
    onOpenChange(next);
  }

  async function save(input: Values) {
    if (!goal) return;
    setFormError("");
    const parsed = schema.parse(input);
    if (Number(parsed.amount) > remaining) {
      form.setError(
        "amount",
        { message: `Only ${currency.format(remaining)} is left to save` },
        { shouldFocus: true },
      );
      return;
    }
    try {
      await contribute.mutateAsync({
        goalId: goal.id,
        body: {
          amount: parsed.amount,
          contributed_on: parsed.date,
          note: parsed.note || undefined,
        },
      });
      notifySuccess(`${currency.format(parsed.amount)} added`, goal.name);
      changeOpen(false);
    } catch (reason) {
      setFormError(
        applyServerErrors(
          reason,
          form.setError,
          { amount: "amount", contributed_on: "date", note: "note" },
          "Could not add this money.",
        ),
      );
    }
  }

  return (
    <Dialog open={!!goal} onOpenChange={changeOpen}>
      <DialogContent className="gap-5 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg">
            Add money · {goal?.name}
          </DialogTitle>
          <DialogDescription>
            <span className="money">{currency.format(remaining)}</span> left to
            save
          </DialogDescription>
        </DialogHeader>
        <form
          noValidate
          className="space-y-5"
          onSubmit={form.handleSubmit(save)}
        >
          <div className="grid gap-4 min-[420px]:grid-cols-2">
            <Field
              id="contribution-amount"
              label="Amount"
              error={errors.amount?.message}
            >
              <MoneyInput
                id="contribution-amount"
                symbol={currency.symbol}
                error={errors.amount?.message}
                {...form.register("amount")}
              />
            </Field>
            <Field
              id="contribution-date"
              label="Date"
              error={errors.date?.message}
            >
              <Controller
                control={form.control}
                name="date"
                render={({ field }) => (
                  <DatePicker
                    id="contribution-date"
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    triggerRef={field.ref}
                    max={today}
                    quickPicks
                    invalid={!!errors.date}
                  />
                )}
              />
            </Field>
          </div>
          <Field
            id="contribution-note"
            label="Note"
            optional
            error={errors.note?.message}
          >
            <Input
              {...controlProps("contribution-note", errors.note?.message)}
              {...form.register("note")}
              autoComplete="off"
            />
          </Field>
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
              {isSubmitting ? "Adding…" : "Add money"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
