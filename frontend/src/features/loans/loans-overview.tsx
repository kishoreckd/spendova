import {
  CalendarCheck2,
  CalendarClock,
  HandCoins,
  PiggyBank,
} from "lucide-react";
import type { LoansOverview as Overview } from "@/api/loans/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useMoney } from "@/hooks/use-money";
import { debtLoad } from "./loan-health";

export function LoansOverview({ overview }: { overview: Overview }) {
  const currency = useMoney();
  const ratio =
    overview.emi_to_income_percent === null
      ? null
      : Number(overview.emi_to_income_percent);
  const load = ratio === null ? null : debtLoad(ratio);

  return (
    <div className="space-y-3">
      <Card className="border-primary/15 bg-gradient-to-br from-primary/[0.07] via-card to-card">
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">EMIs every month</p>
            <p className="money mt-1 text-4xl font-semibold">
              {currency.format(overview.monthly_emi_total, 0)}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {overview.active_loans} active{" "}
              {overview.active_loans === 1 ? "loan" : "loans"}
              {overview.overdue_count > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {overview.overdue_count} overdue
                </Badge>
              )}
            </p>
          </div>
          {load && ratio !== null && (
            <div className="rounded-xl border bg-card p-3 sm:min-w-48">
              <p className="text-xs text-muted-foreground">Share of income</p>
              <p className="money mt-0.5 text-xl font-semibold">
                {ratio.toFixed(0)}%
              </p>
              <p
                className={`mt-0.5 flex items-center gap-1 text-xs font-medium ${load.className}`}
              >
                <load.icon className="size-3.5" />
                {load.label}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile
          icon={HandCoins}
          label="Still owed"
          value={currency.format(overview.outstanding_principal_total, 0)}
        />
        <Tile
          icon={PiggyBank}
          label="Interest still to pay"
          value={currency.format(overview.remaining_interest_total, 0)}
        />
        <Tile
          icon={CalendarClock}
          label="Due this month"
          value={currency.format(overview.due_this_month_total, 0)}
        />
        <Tile
          icon={CalendarCheck2}
          label="Debt-free by"
          value={
            overview.debt_free_on
              ? currency.date(overview.debt_free_on, {
                  month: "short",
                  year: "numeric",
                })
              : "—"
          }
        />
      </div>

      {overview.ending_this_month.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.06] p-3 text-sm">
          <CalendarCheck2 className="size-4 text-emerald-600" />
          <span className="font-medium">Last EMI this month:</span>
          {overview.ending_this_month.map((item) => (
            <Badge key={item.id} variant="secondary">
              {item.name}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

function Tile({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof HandCoins;
  label: string;
  value: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground sm:text-sm">{label}</p>
          <Icon className="size-4 shrink-0 text-muted-foreground" />
        </div>
        <p className="money mt-1.5 truncate text-lg font-semibold sm:text-xl">
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
