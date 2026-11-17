/* oxlint-disable react/set-state-in-effect -- dialog opening intentionally resets its draft */
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Equal, SlidersHorizontal, User } from "lucide-react";
import type { Trip, TripExpense } from "@/api/trips/types";
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
import { Textarea } from "@/components/ui/textarea";
import { categoryTile, useCategories } from "@/features/categories/hooks";
import { useMoney } from "@/hooks/use-money";
import { errorMessage, notifySuccess } from "@/lib/forms";
import { localDateISO } from "@/lib/format";
import { useAddTripExpense, useUpdateTripExpense } from "./hooks";
import { fromPaise, toPaise } from "./trip-maths";

type SplitMode = "equal" | "custom" | "personal";
type Errors = Partial<
  Record<"amount" | "description" | "category" | "shares", string>
>;

const amountText = (value: string) => String(Number(value));
const TRAVEL_NAMES = ["travel", "trip", "transport"];

export function ExpenseDialog({
  trip,
  expense,
  open,
  onOpenChange,
}: {
  trip: Trip;
  /** When set, the dialog edits this expense instead of adding one. */
  expense?: TripExpense | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const money = useMoney();
  const categories = useCategories(open);
  const add = useAddTripExpense();
  const update = useUpdateTripExpense();
  const saving = add.isPending || update.isPending;
  const owner = trip.participants.find((item) => item.is_user)!;
  const group = trip.participants.length > 1;
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [payer, setPayer] = useState(owner.id);
  const [occurredOn, setOccurredOn] = useState(localDateISO());
  const [splitMode, setSplitMode] = useState<SplitMode>("equal");
  const [shares, setShares] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState("");

  const expenseCategories = useMemo(
    () => categories.items.filter((item) => item.category_type === "expense"),
    [categories.items],
  );
  const defaultCategory = useMemo(() => {
    for (const name of TRAVEL_NAMES) {
      const match = expenseCategories.find(
        (item) => item.name.toLowerCase() === name,
      );
      if (match) return match.id;
    }
    return expenseCategories[0]?.id ?? "";
  }, [expenseCategories]);
  const peopleTiles = trip.participants.map((item) => ({
    value: item.id,
    label: item.is_user ? "You" : item.name,
    icon: User,
  }));
  const splitTiles = [
    { value: "equal", label: "Equally", icon: Equal },
    { value: "personal", label: "Just me", icon: User },
    { value: "custom", label: "Custom", icon: SlidersHorizontal },
  ];

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setFormError("");
    if (expense) {
      setDescription(expense.description);
      setAmount(amountText(expense.amount));
      setCategoryId(expense.category_id);
      setPayer(expense.payer_participant_id);
      setOccurredOn(expense.occurred_on);
      setSplitMode(group ? expense.split_mode : "personal");
      setShares(
        expense.split_mode === "custom"
          ? Object.fromEntries(
              expense.shares.map((s) => [
                s.participant_id,
                amountText(s.amount),
              ]),
            )
          : {},
      );
      setNotes(expense.notes ?? "");
      return;
    }
    setDescription("");
    setAmount("");
    setCategoryId("");
    setPayer(owner.id);
    setOccurredOn(localDateISO());
    setSplitMode(group ? "equal" : "personal");
    setShares({});
    setNotes("");
  }, [open, expense, owner.id, group]);

  // Pre-select the travel category once categories load, unless one was chosen.
  useEffect(() => {
    if (open && !categoryId && defaultCategory) setCategoryId(defaultCategory);
  }, [open, categoryId, defaultCategory]);

  const customTotal = trip.participants.reduce(
    (sum, p) => sum + toPaise(shares[p.id] || 0),
    0,
  );
  const customLeft = toPaise(amount || 0) - customTotal;

  async function submit(event: FormEvent) {
    event.preventDefault();
    const next: Errors = {};
    if (!(Number(amount) > 0)) next.amount = "Enter an amount";
    if (!description.trim()) next.description = "Enter what it was for";
    const category = expenseCategories.find((item) => item.id === categoryId);
    if (!category) next.category = "Choose a category";
    if (splitMode === "custom" && customLeft !== 0)
      next.shares =
        customLeft > 0
          ? `${money.format(fromPaise(customLeft))} left to assign`
          : `${money.format(fromPaise(-customLeft))} over the amount`;
    setErrors(next);
    if (Object.keys(next).length || !category) return;
    const body = {
      description: description.trim(),
      amount,
      category: category.name,
      category_id: category.id,
      occurred_on: occurredOn,
      payer_participant_id: payer,
      split_mode: splitMode,
      participant_ids: [],
      shares:
        splitMode === "custom"
          ? trip.participants
              .filter((p) => Number(shares[p.id]) > 0)
              .map((p) => ({ participant_id: p.id, amount: shares[p.id]! }))
          : [],
      notes: notes.trim() || null,
    };
    try {
      if (expense) {
        await update.mutateAsync({
          tripId: trip.id,
          expenseId: expense.id,
          body,
        });
        notifySuccess("Expense updated");
      } else {
        await add.mutateAsync({ tripId: trip.id, body });
        notifySuccess("Expense added");
      }
      onOpenChange(false);
    } catch (reason) {
      setFormError(errorMessage(reason, "Could not save this expense"));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="grid max-h-[calc(100dvh-1rem)] grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden p-0 sm:max-w-xl max-sm:top-0 max-sm:left-0 max-sm:h-dvh max-sm:max-h-dvh max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none">
        <DialogHeader className="px-4 pt-4 pb-2 sm:px-6">
          <DialogTitle>{expense ? "Edit expense" : "Add expense"}</DialogTitle>
          <DialogDescription className="sr-only">
            Amount, payer and split
          </DialogDescription>
        </DialogHeader>
        <form
          noValidate
          onSubmit={submit}
          className="grid min-h-0 grid-rows-[minmax(0,1fr)_auto]"
        >
          <div className="space-y-4 overflow-y-auto px-4 py-3 sm:px-6">
            <FormAlert>{formError}</FormAlert>
            <Field
              id="trip-expense-amount"
              label="Amount"
              error={errors.amount}
            >
              <MoneyInput
                id="trip-expense-amount"
                symbol={money.symbol}
                value={amount}
                autoFocus={!expense}
                aria-invalid={!!errors.amount}
                className="h-12 text-xl font-semibold"
                onChange={(e) => {
                  setAmount(e.target.value);
                  setErrors((x) => ({ ...x, amount: undefined }));
                }}
              />
            </Field>
            <Field
              id="trip-expense-description"
              label="For"
              error={errors.description}
            >
              <Input
                id="trip-expense-description"
                value={description}
                placeholder="Petrol"
                aria-invalid={!!errors.description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  setErrors((x) => ({ ...x, description: undefined }));
                }}
              />
            </Field>
            {group && (
              <Field id="trip-expense-payer" label="Paid by">
                <TilePicker
                  id="trip-expense-payer"
                  variant="chips"
                  tiles={peopleTiles}
                  value={payer}
                  onChange={setPayer}
                />
              </Field>
            )}
            {group && (
              <Field id="trip-expense-split" label="Split">
                <TilePicker
                  id="trip-expense-split"
                  variant="chips"
                  tiles={splitTiles}
                  value={splitMode}
                  onChange={(value) => {
                    setSplitMode(value as SplitMode);
                    setErrors((x) => ({ ...x, shares: undefined }));
                  }}
                />
              </Field>
            )}
            {splitMode === "custom" && (
              <Field
                id="trip-expense-shares"
                label="Shares"
                error={errors.shares}
              >
                <div className="grid gap-3 min-[420px]:grid-cols-2">
                  {trip.participants.map((item) => (
                    <Field
                      key={item.id}
                      id={`share-${item.id}`}
                      label={item.is_user ? "You" : item.name}
                    >
                      <MoneyInput
                        id={`share-${item.id}`}
                        symbol={money.symbol}
                        value={shares[item.id] ?? ""}
                        onChange={(e) => {
                          setShares((current) => ({
                            ...current,
                            [item.id]: e.target.value,
                          }));
                          setErrors((x) => ({ ...x, shares: undefined }));
                        }}
                      />
                    </Field>
                  ))}
                </div>
              </Field>
            )}
            <Field
              id="trip-expense-category"
              label="Category"
              error={errors.category}
            >
              {categories.loading ? (
                <div className="h-10 animate-pulse rounded-xl bg-muted" />
              ) : (
                <TilePicker
                  id="trip-expense-category"
                  variant="chips"
                  tiles={expenseCategories.map(categoryTile)}
                  value={categoryId}
                  invalid={!!errors.category}
                  onChange={(value) => {
                    setCategoryId(value);
                    setErrors((x) => ({ ...x, category: undefined }));
                  }}
                  onCreate={(name) => categories.quickCreate(name, "expense")}
                />
              )}
            </Field>
            <div className="grid gap-4 min-[420px]:grid-cols-2">
              <Field id="trip-expense-date" label="Date">
                <DatePicker
                  id="trip-expense-date"
                  value={occurredOn}
                  onChange={setOccurredOn}
                />
              </Field>
              <Field id="trip-expense-notes" label="Notes" optional>
                <Textarea
                  id="trip-expense-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={1}
                />
              </Field>
            </div>
          </div>
          <DialogFooter className="border-t bg-background p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              {expense ? "Save" : "Add expense"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
