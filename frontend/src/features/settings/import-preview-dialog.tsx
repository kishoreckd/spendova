import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/common/form-field";
import { formatMoney } from "@/lib/format";
import { notifySuccess } from "@/lib/forms";
import type { ImportPreview } from "./transaction-import";

export function ImportPreviewDialog({
  preview,
  batchId,
  onClose,
}: {
  preview: ImportPreview;
  batchId: string;
  onClose: () => void;
}) {
  const [entries, setEntries] = useState(preview.entries);
  const [errors, setErrors] = useState(preview.rejected);
  const [processed, setProcessed] = useState(0);
  const [busy, setBusy] = useState(false);
  const [started, setStarted] = useState(false);
  async function run() {
    setBusy(true);
    setStarted(true);
    try {
      const { importPreparedTransactions } =
        await import("./transaction-import");
      const result = await importPreparedTransactions(entries, batchId);
      setProcessed((value) => value + result.imported);
      setEntries(result.remaining);
      setErrors(result.rejected);
      if (!result.remaining.length)
        notifySuccess(
          "Import complete",
          `${processed + result.imported} rows processed`,
        );
    } catch (reason) {
      setErrors([reason instanceof Error ? reason.message : "Import failed"]);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent
        className="flex h-dvh max-w-none flex-col rounded-none sm:h-auto sm:max-h-[85dvh] sm:max-w-2xl sm:rounded-xl"
        showCloseButton={!busy}
      >
        <DialogHeader>
          <DialogTitle>
            {started ? "Import progress" : "Review import"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Review transactions and import results
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 space-y-4 overflow-auto">
          <div className="flex flex-wrap gap-4 text-sm">
            <span>{entries.length} remaining</span>
            <span>{processed} processed</span>
            <span>{errors.length} errors</span>
          </div>
          {!!errors.length && (
            <FormAlert>
              <ul className="space-y-1">
                {errors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </FormAlert>
          )}
          <div className="divide-y">
            {entries.slice(0, 50).map((entry) => (
              <div
                key={entry.row}
                className="grid grid-cols-[1fr_auto] gap-2 py-3 text-sm"
              >
                <div className="min-w-0">
                  <p className="font-medium">
                    Row {entry.row} · {entry.payload.occurred_on}
                  </p>
                  <p className="truncate text-muted-foreground">
                    {entry.payload.source} → {entry.payload.destination}
                  </p>
                </div>
                <span className="money">
                  {formatMoney(entry.payload.amount, entry.payload.currency)}
                </span>
              </div>
            ))}
          </div>
          {entries.length > 50 && (
            <p className="text-sm text-muted-foreground">
              {entries.length - 50} more rows
            </p>
          )}
        </div>
        <DialogFooter className="sticky bottom-0 bg-popover pb-[env(safe-area-inset-bottom)]">
          <Button variant="outline" disabled={busy} onClick={onClose}>
            Close
          </Button>
          <Button
            loading={busy}
            disabled={
              !entries.length || (!started && !!preview.rejected.length)
            }
            onClick={() => void run()}
          >
            {started ? "Retry remaining rows" : "Import transactions"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
