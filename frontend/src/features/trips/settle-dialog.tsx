/* oxlint-disable react/set-state-in-effect -- dialog opening intentionally resets its draft */
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { User } from "lucide-react";
import type { Trip } from "@/api/trips/types";
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
import { useMoney } from "@/hooks/use-money";
import { errorMessage, notifySuccess } from "@/lib/forms";
import { localDateISO } from "@/lib/format";
import { useAddSettlement } from "./hooks";
import { fromPaise, type Payment } from "./trip-maths";

type Errors = Partial<Record<"from" | "to" | "amount", string>>;

export function SettleDialog({
  trip,
  preset,
  open,
  onOpenChange,
}: {
  trip: Trip;
  preset: Payment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const money = useMoney();
  const add = useAddSettlement();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [occurredOn, setOccurredOn] = useState(localDateISO());
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState("");
  const tiles = trip.participants.map((item) => ({
    value: item.id,
    label: item.is_user ? "You" : item.name,
    icon: User,
  }));

  useEffect(() => {
    if (!open) return;
    setFrom(preset?.from ?? "");
    setTo(preset?.to ?? "");
    setAmount(preset ? String(Number(fromPaise(preset.paise))) : "");
    setOccurredOn(localDateISO());
    setErrors({});
    setFormError("");
  }, [open, preset]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const next: Errors = {};
    if (!from) next.from = "Choose who paid";
    if (!to) next.to = "Choose who received";
    else if (to === from) next.to = "Choose someone else";
    if (!(Number(amount) > 0)) next.amount = "Enter an amount";
    setErrors(next);
    if (Object.keys(next).length) return;
    try {
      await add.mutateAsync({
        tripId: trip.id,
        body: {
          from_participant_id: from,
          to_participant_id: to,
          amount,
          occurred_on: occurredOn,
        },
      });
      notifySuccess("Payment recorded");
      onOpenChange(false);
    } catch (reason) {
      setFormError(errorMessage(reason, "Could not record this payment"));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="grid max-h-[calc(100dvh-1rem)] grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden p-0 sm:max-w-md max-sm:top-0 max-sm:left-0 max-sm:h-dvh max-sm:max-h-dvh max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none">
        <DialogHeader className="px-4 pt-4 pb-2 sm:px-6">
          <DialogTitle>Settle up</DialogTitle>
          <DialogDescription className="sr-only">
            Record a payment between travellers
          </DialogDescription>
        </DialogHeader>
        <form
          noValidate
          onSubmit={submit}
          className="grid min-h-0 grid-rows-[minmax(0,1fr)_auto]"
        >
          <div className="space-y-4 overflow-y-auto px-4 py-3 sm:px-6">
            <FormAlert>{formError}</FormAlert>
            <Field id="settle-from" label="Paid by" error={errors.from}>
              <TilePicker
                id="settle-from"
                variant="chips"
                tiles={tiles}
                value={from}
                invalid={!!errors.from}
                onChange={(value) => {
                  setFrom(value);
                  setErrors((e) => ({ ...e, from: undefined }));
                }}
              />
            </Field>
            <Field id="settle-to" label="Paid to" error={errors.to}>
              <TilePicker
                id="settle-to"
                variant="chips"
                tiles={tiles}
                value={to}
                invalid={!!errors.to}
                onChange={(value) => {
                  setTo(value);
                  setErrors((e) => ({ ...e, to: undefined }));
                }}
              />
            </Field>
            <div className="grid gap-4 min-[420px]:grid-cols-2">
              <Field id="settle-amount" label="Amount" error={errors.amount}>
                <MoneyInput
                  id="settle-amount"
                  symbol={money.symbol}
                  value={amount}
                  aria-invalid={!!errors.amount}
                  onChange={(e) => {
                    setAmount(e.target.value);
                    setErrors((x) => ({ ...x, amount: undefined }));
                  }}
                />
              </Field>
              <Field id="settle-date" label="Date">
                <DatePicker
                  id="settle-date"
                  value={occurredOn}
                  onChange={setOccurredOn}
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
            <Button type="submit" loading={add.isPending}>
              Record payment
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
