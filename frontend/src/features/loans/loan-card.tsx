import { cn } from "cn";
import type { LoanItem } from "@/api/loans/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useMoney } from "@/hooks/use-money";
import { loanTypeTile } from "./loan-types";
import { PayEmiButton } from "./pay-emi-button";

export function LoanCard({
  loan,
  onOpen,
}: {
  loan: LoanItem;
  onOpen: () => void;
}) {
  const currency = useMoney();
  const { summary } = loan;
  const type = loanTypeTile(loan.loan_type);
  const dueNow = summary.overdue || summary.due_this_month;
  const status =
    loan.status === "closed"
      ? "Closed"
      : !summary.next_due_on
        ? "Fully repaid"
        : summary.overdue
          ? `Overdue since ${currency.date(summary.next_due_on)}`
          : `Next ${currency.date(summary.next_due_on)}`;

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        // Ignore keys from the Pay button inside the card.
        if (event.target !== event.currentTarget) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
      className="cursor-pointer py-0 outline-none transition hover:border-primary/40 hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <CardContent className="space-y-4 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span
            className="grid size-11 shrink-0 place-items-center rounded-2xl"
            style={{
              color: type.color,
              backgroundColor: `color-mix(in oklch, ${type.color} 14%, transparent)`,
            }}
          >
            <type.icon />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{loan.name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {[type.label, loan.lender].filter(Boolean).join(" · ")}
            </p>
          </div>
          <div className="text-right">
            <p className="money font-semibold">
              {currency.format(summary.emi, 0)}
            </p>
            <p className="text-[11px] text-muted-foreground">/ month</p>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between gap-2 text-xs">
            <span className="text-muted-foreground">
              {summary.installments_paid}/{summary.tenure_months} paid
            </span>
            <span className="money text-muted-foreground">
              {currency.format(summary.outstanding_principal, 0)} left
            </span>
          </div>
          <Progress
            value={summary.progress_percent}
            aria-label={`${summary.progress_percent}% repaid`}
          />
        </div>

        <div className="flex items-center justify-between gap-3">
          <p
            className={cn(
              "text-xs",
              summary.overdue
                ? "font-medium text-rose-600"
                : "text-muted-foreground",
            )}
          >
            {status}
            {summary.ends_this_month && loan.status === "active" && (
              <Badge variant="secondary" className="ml-2">
                Last EMI
              </Badge>
            )}
          </p>
          {dueNow && <PayEmiButton loan={loan} size="sm" />}
        </div>
      </CardContent>
    </Card>
  );
}
