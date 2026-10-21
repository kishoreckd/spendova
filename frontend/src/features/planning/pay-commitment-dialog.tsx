import { useState } from "react";
import { MoneyInput } from "@/components/money-input";
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
import { useMoney } from "@/hooks/use-money";
import { payRecurringRule, type RecurringItem } from "@/lib/api";
import { currencySymbol, localDateISO } from "@/lib/format";
import { errorMessage, notifySuccess } from "@/lib/forms";

export function PayCommitmentDialog({
  commitment,
  onOpenChange,
  onPaid,
}: {
  commitment: RecurringItem | null;
  onOpenChange: (open: boolean) => void;
  onPaid: (updated: RecurringItem) => void;
}) {
  const currency = useMoney();
  const [amount, setAmount] = useState(() => String(commitment?.amount ?? ""));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function confirm() {
    if (!commitment) return;
    if (!/^\d{1,15}(\.\d{1,2})?$/.test(amount) || Number(amount) <= 0) {
      setError("Enter a valid amount greater than zero.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const result = await payRecurringRule(commitment.id, {
        amount,
        paid_on: localDateISO(),
      });
      notifySuccess(
        commitment.kind === "income"
          ? "Income received"
          : commitment.kind === "transfer"
            ? "Contribution recorded"
            : "Payment recorded",
        `Next due ${currency.date(result.commitment.next_due_on)}`,
      );
      window.dispatchEvent(new CustomEvent("spendova:transactions"));
      onPaid(result.commitment);
      onOpenChange(false);
    } catch (reason) {
      setError(errorMessage(reason, "Could not record this payment."));
    } finally {
      setSaving(false);
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
          <DialogDescription>
            Confirm the amount. This creates the transaction and schedules the
            next date.
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
          <Button loading={saving} onClick={() => void confirm()}>
            Confirm payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
