import { useMemo, useState } from "react";
import { Plus, WalletCards } from "lucide-react";
import { cn } from "cn";
import type { BudgetItem, BudgetStatus } from "@/api/budgets/types";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useCategories } from "@/features/categories/hooks";
import { useMoney } from "@/hooks/use-money";
import { notifySuccess } from "@/lib/forms";
import { useBudgetStatuses, useBudgets, useDeleteBudget } from "./hooks";
import { EmptyState, ItemMenu, LoadError, Skeletons } from "./planning-ui";

export function BudgetsTab({ onCreate }: { onCreate: () => void }) {
  const budgetsQuery = useBudgets();
  const budgets = useMemo(() => budgetsQuery.data ?? [], [budgetsQuery.data]);
  const statuses = useBudgetStatuses(budgets.map((item) => item.id));
  const categories = useCategories();
  const deleteBudget = useDeleteBudget();
  const [deleting, setDeleting] = useState<BudgetItem | null>(null);
  const categoryName = useMemo(
    () => new Map(categories.items.map((item) => [item.id, item.name])),
    [categories.items],
  );

  if (budgetsQuery.error)
    return (
      <LoadError
        error={budgetsQuery.error}
        fallback="Could not load budgets"
        onRetry={() => void budgetsQuery.refetch()}
      />
    );
  if (budgetsQuery.isPending) return <Skeletons />;
  if (!budgets.length)
    return (
      <EmptyState
        icon={WalletCards}
        title="No budgets yet"
        action={
          <Button onClick={onCreate}>
            <Plus /> New budget
          </Button>
        }
      />
    );

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2">
        {budgets.map((budget) => (
          <BudgetCard
            key={budget.id}
            budget={budget}
            status={statuses[budget.id]}
            categoryName={categoryName}
            onDelete={() => setDeleting(budget)}
          />
        ))}
      </div>
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete ${deleting?.name ?? ""}?`}
        description="Your transactions are not affected."
        confirmLabel="Delete"
        onConfirm={async () => {
          if (!deleting) return;
          await deleteBudget.mutateAsync(deleting.id);
          notifySuccess(`${deleting.name} deleted`);
        }}
      />
    </>
  );
}

function BudgetCard({
  budget,
  status,
  categoryName,
  onDelete,
}: {
  budget: BudgetItem;
  status?: BudgetStatus;
  categoryName: Map<string, string>;
  onDelete: () => void;
}) {
  const currency = useMoney();
  const limit = Number(budget.total_limit);
  const spent = Number(status?.spent ?? 0);
  const percent = limit ? Math.round((spent / limit) * 100) : 0;
  const over = spent > limit;
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="truncate">{budget.name}</CardTitle>
            <CardDescription>
              {currency.date(budget.month, { month: "long", year: "numeric" })}
            </CardDescription>
          </div>
          <ItemMenu label={budget.name} onDelete={onDelete} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="flex items-baseline justify-between gap-2">
            <p className="money text-2xl font-semibold">
              {currency.format(spent, 0)}
              <span className="ml-1 text-sm font-normal text-muted-foreground">
                of {currency.format(limit, 0)}
              </span>
            </p>
            <span
              className={cn(
                "money text-sm font-semibold",
                over ? "text-rose-600" : "text-primary",
              )}
            >
              {percent}%
            </span>
          </div>
          <Progress
            value={Math.min(100, percent)}
            aria-label={`${percent}% of budget used`}
            className={cn(
              "mt-2",
              over && "[&_[data-slot=progress-indicator]]:bg-rose-500",
            )}
          />
          <p
            className={cn(
              "money mt-1.5 text-xs",
              over ? "text-rose-600" : "text-muted-foreground",
            )}
          >
            {over
              ? `${currency.format(spent - limit, 0)} over`
              : `${currency.format(limit - spent, 0)} left`}
          </p>
        </div>
        {!!status?.lines.length && (
          <div className="space-y-3 border-t pt-4">
            {status.lines.map((line) => {
              const lineLimit = Number(line.limit);
              const lineSpent = Number(line.spent);
              const linePercent = lineLimit
                ? Math.round((lineSpent / lineLimit) * 100)
                : 0;
              const lineOver = lineSpent > lineLimit;
              return (
                <div key={line.category_id} className="space-y-1">
                  <div className="flex justify-between gap-2 text-sm">
                    <span className="truncate">
                      {categoryName.get(line.category_id) ?? "Category"}
                    </span>
                    <span
                      className={cn(
                        "money shrink-0",
                        lineOver && "text-rose-600",
                      )}
                    >
                      {currency.format(lineSpent, 0)} /{" "}
                      {currency.format(lineLimit, 0)}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn(
                        "h-full rounded-full",
                        lineOver ? "bg-rose-500" : "bg-primary",
                      )}
                      style={{ width: `${Math.min(100, linePercent)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
