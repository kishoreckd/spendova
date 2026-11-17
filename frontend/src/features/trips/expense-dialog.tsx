/* oxlint-disable react/set-state-in-effect -- dialog opening intentionally resets its draft */
import { useEffect, useMemo, useState } from "react";
import type { Trip } from "@/api/trips/types";
import { DatePicker } from "@/components/common/date-picker";
import { Field, FormAlert } from "@/components/common/form-field";
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useCategories } from "@/features/categories/hooks";
import { useMoney } from "@/hooks/use-money";
import { errorMessage, notifySuccess } from "@/lib/forms";
import { localDateISO } from "@/lib/format";
import { useAddTripExpense } from "./hooks";

export function ExpenseDialog({
  trip,
  open,
  onOpenChange,
}: {
  trip: Trip;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const money = useMoney();
  const categories = useCategories(open);
  const add = useAddTripExpense();
  const owner = trip.participants.find((item) => item.is_user)!;
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [payer, setPayer] = useState(owner.id);
  const [occurredOn, setOccurredOn] = useState(localDateISO());
  const [splitMode, setSplitMode] = useState<"equal" | "custom" | "personal">(
    trip.mode === "personal" ? "personal" : "equal",
  );
  const [shares, setShares] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const expenseCategories = useMemo(
    () => categories.items.filter((item) => item.category_type === "expense"),
    [categories.items],
  );
  useEffect(() => {
    if (open) {
      setDescription("");
      setAmount("");
      setCategoryId("");
      setPayer(owner.id);
      setOccurredOn(localDateISO());
      setSplitMode(trip.mode === "personal" ? "personal" : "equal");
      setShares({});
      setNotes("");
      setError("");
    }
  }, [open, owner.id, trip.mode]);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const category = expenseCategories.find((item) => item.id === categoryId);
    if (!description.trim() || !amount || !category)
      return setError("Complete the description, amount and category");
    try {
      await add.mutateAsync({
        tripId: trip.id,
        body: {
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
                  .filter((p) => shares[p.id])
                  .map((p) => ({ participant_id: p.id, amount: shares[p.id]! }))
              : [],
          notes: notes.trim() || null,
        },
      });
      notifySuccess("Trip expense added");
      onOpenChange(false);
    } catch (reason) {
      setError(errorMessage(reason, "Could not add this expense"));
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="grid max-h-[calc(100dvh-1rem)] grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden p-0 sm:max-w-xl max-sm:top-0 max-sm:left-0 max-sm:h-dvh max-sm:max-h-dvh max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none">
        <DialogHeader className="px-4 pt-4 pb-2 sm:px-6">
          <DialogTitle>Add trip expense</DialogTitle>
          <DialogDescription className="sr-only">
            Payer and split allocation
          </DialogDescription>
        </DialogHeader>
        <form
          noValidate
          onSubmit={submit}
          className="grid min-h-0 grid-rows-[minmax(0,1fr)_auto]"
        >
          <div className="space-y-4 overflow-y-auto px-4 py-3 sm:px-6">
            <FormAlert>{error}</FormAlert>
            <div className="grid gap-4 min-[480px]:grid-cols-2">
              <Field id="trip-expense-description" label="Expense">
                <Input
                  id="trip-expense-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Petrol"
                />
              </Field>
              <Field id="trip-expense-amount" label="Amount">
                <MoneyInput
                  id="trip-expense-amount"
                  symbol={money.symbol}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </Field>
            </div>
            <div className="grid gap-4 min-[480px]:grid-cols-2">
              <Field id="trip-expense-category" label="Category">
                <Select
                  value={categoryId}
                  onValueChange={(v) => setCategoryId(v ?? "")}
                >
                  <SelectTrigger id="trip-expense-category" className="w-full">
                    <SelectValue>
                      {expenseCategories.find((x) => x.id === categoryId)
                        ?.name ?? "Choose category"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {expenseCategories.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field id="trip-expense-date" label="Date">
                <DatePicker
                  id="trip-expense-date"
                  value={occurredOn}
                  onChange={setOccurredOn}
                />
              </Field>
            </div>
            <div className="grid gap-4 min-[480px]:grid-cols-2">
              <Field id="trip-expense-payer" label="Paid by">
                <Select value={payer} onValueChange={(v) => v && setPayer(v)}>
                  <SelectTrigger id="trip-expense-payer" className="w-full">
                    <SelectValue>
                      {trip.participants.find((x) => x.id === payer)?.name}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {trip.participants.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              {trip.mode === "split" && (
                <Field id="trip-expense-split" label="Split">
                  <Select
                    value={splitMode}
                    onValueChange={(v) =>
                      v && setSplitMode(v as typeof splitMode)
                    }
                  >
                    <SelectTrigger id="trip-expense-split" className="w-full">
                      <SelectValue>
                        {splitMode === "equal"
                          ? "Equally"
                          : splitMode === "custom"
                            ? "Custom amounts"
                            : "Only mine"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="equal">Equally</SelectItem>
                      <SelectItem value="custom">Custom amounts</SelectItem>
                      <SelectItem value="personal">Only mine</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              )}
            </div>
            {splitMode === "custom" && (
              <div className="grid gap-3 min-[480px]:grid-cols-2">
                {trip.participants.map((item) => (
                  <Field
                    key={item.id}
                    id={`share-${item.id}`}
                    label={item.name}
                  >
                    <MoneyInput
                      id={`share-${item.id}`}
                      symbol={money.symbol}
                      value={shares[item.id] ?? ""}
                      onChange={(e) =>
                        setShares((current) => ({
                          ...current,
                          [item.id]: e.target.value,
                        }))
                      }
                    />
                  </Field>
                ))}
              </div>
            )}
            <Field id="trip-expense-notes" label="Notes" optional>
              <Textarea
                id="trip-expense-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            </Field>
          </div>
          <DialogFooter className="border-t bg-background p-4 sm:px-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" loading={add.isPending}>
              Add expense
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
