import { useState } from "react";
import { Plus, Target } from "lucide-react";
import { cn } from "cn";
import type { GoalItem } from "@/api/goals/types";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useMoney } from "@/hooks/use-money";
import { notifySuccess } from "@/lib/forms";
import { GoalContributionDialog } from "./goal-contribution-dialog";
import { useDeleteGoal, useGoals } from "./hooks";
import { EmptyState, ItemMenu, LoadError, Skeletons } from "./planning-ui";

export function GoalsTab({ onCreate }: { onCreate: () => void }) {
  const currency = useMoney();
  const goalsQuery = useGoals();
  const deleteGoal = useDeleteGoal();
  const [contributing, setContributing] = useState<GoalItem | null>(null);
  const [deleting, setDeleting] = useState<GoalItem | null>(null);
  const goals = goalsQuery.data ?? [];

  if (goalsQuery.error)
    return (
      <LoadError
        error={goalsQuery.error}
        fallback="Could not load goals"
        onRetry={() => void goalsQuery.refetch()}
      />
    );
  if (goalsQuery.isPending) return <Skeletons />;
  if (!goals.length)
    return (
      <EmptyState
        icon={Target}
        title="No savings goals yet"
        action={
          <Button onClick={onCreate}>
            <Plus /> Plan a purchase
          </Button>
        }
      />
    );

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2">
        {goals.map((goal) => {
          const target = Number(goal.target_amount);
          const saved = Number(goal.saved_amount);
          const percent = target
            ? Math.min(100, Math.round((saved / target) * 100))
            : 0;
          const complete = saved >= target;
          return (
            <Card key={goal.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="min-w-0 truncate">
                    {goal.name}
                  </CardTitle>
                  <div className="flex items-center gap-1">
                    <span
                      className={cn(
                        "money text-sm font-semibold",
                        complete ? "text-emerald-600" : "text-primary",
                      )}
                    >
                      {percent}%
                    </span>
                    <ItemMenu
                      label={goal.name}
                      onDelete={() => setDeleting(goal)}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="money text-2xl font-semibold">
                  {currency.format(saved, 0)}{" "}
                  <span className="text-sm font-normal text-muted-foreground">
                    of {currency.format(target, 0)}
                  </span>
                </p>
                <Progress
                  value={percent}
                  aria-label={`${percent}% saved`}
                  className={cn(
                    complete &&
                      "[&_[data-slot=progress-indicator]]:bg-emerald-500",
                  )}
                />
                <div className="flex items-center justify-between gap-3">
                  <p className="money text-sm">
                    {complete ? (
                      <span className="font-medium text-emerald-600">
                        Goal reached
                      </span>
                    ) : (
                      <>
                        {currency.format(goal.monthly_required, 0)}
                        <span className="text-muted-foreground"> / month</span>
                      </>
                    )}
                  </p>
                  {!complete && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setContributing(goal)}
                    >
                      <Plus />
                      Add money
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      <GoalContributionDialog
        goal={contributing}
        onOpenChange={(open) => !open && setContributing(null)}
      />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete ${deleting?.name ?? ""}?`}
        description="Its saved progress and contributions will be removed."
        confirmLabel="Delete"
        onConfirm={async () => {
          if (!deleting) return;
          await deleteGoal.mutateAsync(deleting.id);
          notifySuccess(`${deleting.name} deleted`);
        }}
      />
    </>
  );
}
