import { ChevronRight, Landmark } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useMoney } from "@/hooks/use-money";
import { useLoansOverview } from "./hooks";

/** Dashboard summary: EMIs due this month, overdue ones, and loans finishing now. */
export function LoansDueCard() {
  const navigate = useNavigate();
  const currency = useMoney();
  const overview = useLoansOverview().data;
  if (!overview?.active_loans) return null;

  return (
    <Card>
      <CardContent className="p-0">
        <button
          type="button"
          onClick={() => navigate("/loans")}
          className="flex w-full items-center gap-4 rounded-xl p-4 text-left transition hover:bg-muted/50"
        >
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
            <Landmark className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-muted-foreground">EMIs due this month</p>
            <p className="money text-xl font-semibold">
              {currency.format(overview.due_this_month_total, 0)}
              <span className="ml-1.5 text-sm font-normal text-muted-foreground">
                of {currency.format(overview.monthly_emi_total, 0)}
              </span>
            </p>
            {(overview.overdue_count > 0 ||
              overview.ending_this_month.length > 0) && (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {overview.overdue_count > 0 && (
                  <Badge variant="destructive">
                    {overview.overdue_count} overdue
                  </Badge>
                )}
                {overview.ending_this_month.map((item) => (
                  <Badge key={item.id} variant="secondary">
                    {item.name} ends
                  </Badge>
                ))}
              </div>
            )}
          </div>
          <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
        </button>
      </CardContent>
    </Card>
  );
}
