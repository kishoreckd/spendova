import { useEffect, useState } from "react";
import { CalendarClock, Plus, Target, WalletCards } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PurchaseGoalCalculator } from "@/components/purchase-goal-calculator";
import { useAuth } from "@/features/auth/auth-context";
import {
  listBudgets,
  listGoals,
  listRecurringRules,
  type BudgetItem,
  type GoalItem,
  type RecurringItem,
} from "@/lib/api";

export default function PlanningPage() {
  const { profile } = useAuth();
  const [budgets, setBudgets] = useState<BudgetItem[]>([]);
  const [goals, setGoals] = useState<GoalItem[]>([]);
  const [commitments, setCommitments] = useState<RecurringItem[]>([]);
  const [error, setError] = useState("");
  const currency = profile?.base_currency ?? "INR";
  const money = (value: number) =>
    new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(value);

  useEffect(() => {
    Promise.all([listBudgets(), listGoals(), listRecurringRules()])
      .then(([nextBudgets, nextGoals, nextCommitments]) => {
        setBudgets(nextBudgets);
        setGoals(nextGoals);
        setCommitments(
          nextCommitments.filter((item) => item.kind === "expense"),
        );
      })
      .catch((reason) =>
        setError(
          reason instanceof Error
            ? reason.message
            : "Could not load planning data",
        ),
      );
  }, []);

  return (
    <Tabs defaultValue="budgets" className="space-y-5">
      <TabsList className="w-full justify-start overflow-x-auto">
        <TabsTrigger value="budgets">Budgets</TabsTrigger>
        <TabsTrigger value="goals">Goals</TabsTrigger>
        <TabsTrigger value="purchase">Purchase planner</TabsTrigger>
        <TabsTrigger value="commitments">Commitments</TabsTrigger>
      </TabsList>
      {error && (
        <p
          role="alert"
          className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive"
        >
          {error}
        </p>
      )}
      <TabsContent value="budgets">
        {budgets.length ? (
          <div className="grid gap-5 md:grid-cols-2">
            {budgets.map((budget) => (
              <Card key={budget.id}>
                <CardHeader>
                  <CardTitle>{budget.name}</CardTitle>
                  <CardDescription>
                    {new Date(budget.month).toLocaleDateString(undefined, {
                      month: "long",
                      year: "numeric",
                    })}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="money text-2xl font-semibold">
                    {money(Number(budget.total_limit))}
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {budget.lines.length} category limits
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={WalletCards}
            title="No budgets yet"
            description="Create your first monthly budget when you are ready. Spendova will not add sample limits to your account."
            action="Create budget"
          />
        )}
      </TabsContent>
      <TabsContent value="goals">
        {goals.length ? (
          <div className="grid gap-5 md:grid-cols-2">
            {goals.map((goal) => {
              const target = Number(goal.target_amount);
              const saved = Number(goal.saved_amount);
              return (
                <Card key={goal.id}>
                  <CardHeader>
                    <CardTitle>{goal.name}</CardTitle>
                    <CardDescription>
                      {goal.months} months remaining
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="money text-2xl font-semibold">
                      {money(saved)}{" "}
                      <span className="text-sm text-muted-foreground">
                        of {money(target)}
                      </span>
                    </p>
                    <Progress
                      value={target ? (saved / target) * 100 : 0}
                      className="my-4"
                    />
                    <p className="text-sm text-muted-foreground">
                      Save {money(Number(goal.monthly_required))} per month
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <EmptyState
            icon={Target}
            title="No savings goals yet"
            description="Plan a car, emergency fund, trip, or any future purchase using your own target."
            action="Create goal"
          />
        )}
      </TabsContent>
      <TabsContent value="purchase">
        <PurchaseGoalCalculator />
      </TabsContent>
      <TabsContent value="commitments">
        {commitments.length ? (
          <Card>
            <CardHeader>
              <CardTitle>Monthly commitments</CardTitle>
              <CardDescription>
                Recurring expenses from your account.
              </CardDescription>
            </CardHeader>
            <CardContent className="divide-y">
              {commitments.map((item) => (
                <div key={item.id} className="flex justify-between gap-4 py-4">
                  <div>
                    <p className="font-medium">{item.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Next due {new Date(item.next_due_on).toLocaleDateString()}
                    </p>
                  </div>
                  <strong>{money(Number(item.amount))}</strong>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : (
          <EmptyState
            icon={CalendarClock}
            title="No commitments yet"
            description="Add rent, EMIs, subscriptions, or other recurring expenses to see them here."
            action="Add commitment"
          />
        )}
      </TabsContent>
    </Tabs>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: typeof Target;
  title: string;
  description: string;
  action: string;
}) {
  return (
    <Card>
      <CardContent className="flex min-h-72 flex-col items-center justify-center p-8 text-center">
        <span className="rounded-2xl bg-primary/10 p-4 text-primary">
          <Icon className="size-7" />
        </span>
        <h2 className="mt-5 text-xl font-semibold">{title}</h2>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          {description}
        </p>
        <Button
          className="mt-5"
          disabled
          title="Creation form is the next workflow"
        >
          <Plus />
          {action}
        </Button>
      </CardContent>
    </Card>
  );
}
