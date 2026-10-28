import { useMemo, useState } from "react";
import {
  BriefcaseBusiness,
  CalendarClock,
  Plus,
  TrendingUp,
} from "lucide-react";
import { cn } from "cn";
import type { RecurringItem } from "@/api/recurring/types";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useMoney } from "@/hooks/use-money";
import { localDateISO, parseISODate } from "@/lib/format";
import { notifySuccess } from "@/lib/forms";
import {
  dueLabel,
  investmentProjection,
  monthlyTotals,
  repeatLabel,
} from "./commitment-math";
import { useRecurring, useStopRecurring } from "./hooks";
import { PayCommitmentDialog } from "./pay-commitment-dialog";
import { EmptyState, ItemMenu, LoadError, Skeletons } from "./planning-ui";

const KIND_LABEL: Record<RecurringItem["kind"], string> = {
  expense: "Bill / premium",
  income: "Income",
  transfer: "Investment",
};

const PAY_LABEL: Record<RecurringItem["kind"], string> = {
  expense: "Mark as paid",
  income: "Mark received",
  transfer: "Record contribution",
};

export function CommitmentsTab({ onCreate }: { onCreate: () => void }) {
  const currency = useMoney();
  const billsQuery = useRecurring();
  const stopRecurring = useStopRecurring();
  const [paying, setPaying] = useState<RecurringItem | null>(null);
  const [stopping, setStopping] = useState<RecurringItem | null>(null);
  const [today] = useState(() => parseISODate(localDateISO()).getTime());
  const bills = useMemo(
    () =>
      [...(billsQuery.data ?? [])].sort((a, b) =>
        a.next_due_on.localeCompare(b.next_due_on),
      ),
    [billsQuery.data],
  );
  const totals = useMemo(() => monthlyTotals(bills), [bills]);

  if (billsQuery.error)
    return (
      <LoadError
        error={billsQuery.error}
        fallback="Could not load commitments"
        onRetry={() => void billsQuery.refetch()}
      />
    );
  if (billsQuery.isPending) return <Skeletons />;
  if (!bills.length)
    return (
      <EmptyState
        icon={CalendarClock}
        title="No bills, premiums, or investments yet"
        action={
          <Button onClick={onCreate}>
            <Plus /> Add commitment
          </Button>
        }
      />
    );

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Total
          label="Bills and premiums / month"
          value={currency.format(totals.bills, 0)}
          tone="border-primary/15 from-primary/[0.07]"
        />
        <Total
          label="Expected income / month"
          value={currency.format(totals.income, 0)}
          tone="border-sky-500/15 from-sky-500/[0.07]"
        />
        <Total
          label="Planned investing / month"
          value={currency.format(totals.investments, 0)}
          tone="border-emerald-500/15 from-emerald-500/[0.07]"
        />
      </div>
      <Card>
        <CardContent className="divide-y p-0">
          {bills.map((bill) => {
            const days = Math.round(
              (parseISODate(bill.next_due_on).getTime() - today) / 86_400_000,
            );
            const projection =
              bill.kind === "transfer" && bill.tenure_months
                ? investmentProjection(bill)
                : null;
            const Icon =
              bill.kind === "transfer"
                ? TrendingUp
                : bill.kind === "income"
                  ? BriefcaseBusiness
                  : CalendarClock;
            return (
              <div
                key={bill.id}
                className="flex items-center gap-3 px-4 py-3.5"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                  <Icon className="size-[18px]" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{bill.name}</p>
                  <p
                    className={cn(
                      "text-xs",
                      days <= 1
                        ? "font-medium text-amber-600"
                        : "text-muted-foreground",
                    )}
                  >
                    {KIND_LABEL[bill.kind]} ·{" "}
                    {dueLabel(days, currency.date(bill.next_due_on))} ·{" "}
                    {repeatLabel(bill.frequency, bill.interval)}
                  </p>
                  {bill.kind === "income" &&
                    Number(bill.cost_amount ?? 0) > 0 && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Net{" "}
                        {currency.format(
                          Math.max(
                            0,
                            Number(bill.amount) - Number(bill.cost_amount),
                          ),
                        )}
                        /cycle
                      </p>
                    )}
                  {projection && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {projection.tenure} months ·{" "}
                      {currency.format(projection.contributed, 0)} planned
                      {projection.projected !== null &&
                        ` · ${currency.format(projection.projected, 0)} projected`}
                    </p>
                  )}
                </div>
                {/* Stacked on phones so the name keeps its width; side by side from sm up. */}
                <div className="flex shrink-0 flex-col items-end gap-2 sm:flex-row sm:items-center sm:gap-3">
                  <strong className="money">
                    {currency.format(bill.amount, 0)}
                  </strong>
                  {days <= 0 && (
                    <Button size="sm" onClick={() => setPaying(bill)}>
                      {PAY_LABEL[bill.kind]}
                    </Button>
                  )}
                </div>
                <ItemMenu
                  label={bill.name}
                  deleteLabel="Stop"
                  onDelete={() => setStopping(bill)}
                />
              </div>
            );
          })}
        </CardContent>
      </Card>

      <PayCommitmentDialog
        key={paying?.id ?? "closed"}
        commitment={paying}
        onOpenChange={(open) => !open && setPaying(null)}
      />
      <ConfirmDialog
        open={!!stopping}
        onOpenChange={(open) => !open && setStopping(null)}
        title={`Stop ${stopping?.name ?? ""}?`}
        description="It will no longer appear in your bills."
        confirmLabel="Stop bill"
        onConfirm={async () => {
          if (!stopping) return;
          await stopRecurring.mutateAsync(stopping.id);
          notifySuccess(`${stopping.name} stopped`);
        }}
      />
    </div>
  );
}

function Total({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <Card className={cn("bg-gradient-to-br via-card to-card", tone)}>
      <CardContent className="p-5">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="money mt-1 text-3xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}
