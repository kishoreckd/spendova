import { useState } from "react";
import type { RecurringItem } from "@/api/recurring/types";
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
import { useMoney } from "@/hooks/use-money";
import { currencySymbol, localDateISO } from "@/lib/format";
import { errorMessage, notifySuccess } from "@/lib/forms";
import { usePayRecurring } from "./hooks";

export function PayCommitmentDialog({
  commitment,
  onOpenChange,
}: {
  commitment: RecurringItem | null;
  onOpenChange: (open: boolean) => void;
}) {
  const currency = useMoney();
  const pay = usePayRecurring();
  const [amount, setAmount] = useState(() => String(commitment?.amount ?? ""));
  const [error, setError] = useState("");

  async function confirm() {
    if (!commitment) return;
    if (!/^\d{1,15}(\.\d{1,2})?$/.test(amount) || Number(amount) <= 0) {
      setError("Enter a valid amount greater than zero.");
      return;
    }
    setError("");
    try {
      const result = await pay.mutateAsync({
        id: commitment.id,
        amount,
        paidOn: localDateISO(),
      });
      notifySuccess(
        commitment.kind === "income"
          ? "Income received"
          : commitment.kind === "transfer"
            ? "Contribution recorded"
            : "Payment recorded",
        `Next due ${currency.date(result.commitment.next_due_on)}`,
      );
      onOpenChange(false);
    } catch (reason) {
      setError(errorMessage(reason, "Could not record this payment."));
    }
  }

  return (
    <Dialog open={!!commitment} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {commitment?.kind === "income"
              ? "Mark as received"
              : commitment?.kind === "transfer"
                ? "Record contribution"
                : "Mark as paid"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Confirm the amount to record it and schedule the next date.
          </DialogDescription>
        </DialogHeader>
        <Field id="paid-amount" label="Amount paid">
          <MoneyInput
            id="paid-amount"
            symbol={currencySymbol(
              commitment?.currency ?? currency.currency,
              currency.locale,
            )}
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </Field>
        <FormAlert>{error}</FormAlert>
        <DialogFooter showCloseButton>
          <Button loading={pay.isPending} onClick={() => void confirm()}>
            Confirm payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
