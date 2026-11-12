import { useState } from "react";
import type { TransactionItem } from "@/api/transactions/types";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useMoney } from "@/hooks/use-money";
import { formatMoney } from "@/lib/format";
import { notifySuccess } from "@/lib/forms";
import { useVoidTransaction } from "./hooks";

export function TransactionDetailDialog({
  transaction,
  onClose,
}: {
  transaction: TransactionItem | null;
  onClose: () => void;
}) {
  const money = useMoney();
  const [confirm, setConfirm] = useState(false);
  const voidTransaction = useVoidTransaction();
  return (
    <>
      <Dialog
        open={!!transaction}
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
      >
        <DialogContent className="flex h-dvh max-w-none flex-col rounded-none sm:h-auto sm:max-w-lg sm:rounded-xl">
          <DialogHeader>
            <DialogTitle>Transaction details</DialogTitle>
            <DialogDescription className="sr-only">
              Transaction record and actions
            </DialogDescription>
          </DialogHeader>
          {transaction && (
            <dl className="flex-1 space-y-4 overflow-auto py-4">
              {[
                [
                  "Amount",
                  formatMoney(
                    transaction.amount,
                    transaction.currency,
                    money.locale,
                  ),
                ],
                ["Type", transaction.kind],
                ["Status", transaction.status],
                ["Date", money.date(transaction.occurred_on)],
                ["Source", transaction.source],
                ["Destination", transaction.destination],
                ["Merchant", transaction.merchant || "—"],
                ["Note", transaction.notes || "—"],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="grid grid-cols-[6rem_1fr] gap-4 text-sm"
                >
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="break-words font-medium">{value}</dd>
                </div>
              ))}
            </dl>
          )}
          <DialogFooter className="sticky bottom-0 bg-popover pb-[env(safe-area-inset-bottom)]">
            {transaction?.status !== "voided" && (
              <Button variant="destructive" onClick={() => setConfirm(true)}>
                Void transaction
              </Button>
            )}
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Void this transaction?"
        description="Balances and reports will be recalculated. The original record remains in history."
        confirmLabel="Void transaction"
        onConfirm={async () => {
          if (!transaction) return;
          await voidTransaction.mutateAsync(transaction.id);
          notifySuccess("Transaction voided");
          onClose();
        }}
      />
    </>
  );
}
