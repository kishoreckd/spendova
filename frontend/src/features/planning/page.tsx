import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BriefcaseBusiness,
  CalendarClock,
  MoreHorizontal,
  Plus,
  Target,
  TrendingUp,
  Trash2,
  WalletCards,
} from "lucide-react";
import { cn } from "cn";
import { PageActions } from "@/app/page-actions";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { PurchaseGoalCalculator } from "@/components/purchase-goal-calculator";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FormAlert } from "@/components/ui/field";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCategories } from "@/features/categories/use-categories";
import { useMoney } from "@/hooks/use-money";
import {
  deleteBudget,
  deleteGoal,
  getBudgetStatus,
  listBudgets,
  listGoals,
  listRecurringRules,
  stopRecurringRule,
  type BudgetItem,
  type BudgetStatus,
  type GoalItem,
  type RecurringItem,
} from "@/lib/api";
import { localDateISO, parseISODate } from "@/lib/format";
import { errorMessage, notifySuccess } from "@/lib/forms";
import { BillFormDialog } from "./bill-form-dialog";
import { BudgetFormDialog } from "./budget-form-dialog";
import { GoalContributionDialog } from "./goal-contribution-dialog";
import { PayCommitmentDialog } from "./pay-commitment-dialog";

type Tab = "budgets" | "goals" | "purchase" | "commitments";
type Pending =
  | { kind: "budget"; item: BudgetItem }
  | { kind: "goal"; item: GoalItem }
  | { kind: "bill"; item: RecurringItem };

export default function PlanningPage() {
  const currency = useMoney();
  const categories = useCategories();
  const [tab, setTab] = useState<Tab>("budgets");
  const [budgets, setBudgets] = useState<BudgetItem[]>([]);
  const [statuses, setStatuses] = useState<Record<string, BudgetStatus>>({});
  const [goals, setGoals] = useState<GoalItem[]>([]);
  const [bills, setBills] = useState<RecurringItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [billOpen, setBillOpen] = useState(false);
  const [contributing, setContributing] = useState<GoalItem | null>(null);
  const [paying, setPaying] = useState<RecurringItem | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [today] = useState(() => localDateISO());

  const loadStatuses = useCallback(async (items: BudgetItem[]) => {
    const results = await Promise.all(
      items.map((item) => getBudgetStatus(item.id)),
    );
    setStatuses(
      Object.fromEntries(results.map((item) => [item.budget_id, item])),
    );
  }, []);

  const load = useCallback(
    () =>
      Promise.all([listBudgets(), listGoals(), listRecurringRules()])
        .then(async ([nextBudgets, nextGoals, nextRules]) => {
          setBudgets(nextBudgets);
          setGoals(nextGoals);
          setBills(nextRules);
          setError("");
          await loadStatuses(nextBudgets);
        })
        .catch((reason) =>
          setError(errorMessage(reason, "Could not load your plans")),
        )
        .finally(() => setLoading(false)),
    [loadStatuses],
  );
  useEffect(() => {
    void load();
  }, [load]);

  const categoryName = useMemo(
    () => new Map(categories.items.map((item) => [item.id, item.name])),
    [categories.items],
  );
  const monthlyCommitments = useMemo(() => {
    const monthly = (items: RecurringItem[]) =>
      items.reduce((sum, bill) => {
        const perMonth =
          { daily: 30.4375, weekly: 4.348, monthly: 1, yearly: 1 / 12 }[
            bill.frequency as "daily" | "weekly" | "monthly" | "yearly"
          ] ?? 1;
        return (
          sum + (Number(bill.amount) * perMonth) / Math.max(1, bill.interval)
        );
      }, 0);
    return {
      bills: monthly(bills.filter((item) => item.kind === "expense")),
      income: monthly(bills.filter((item) => item.kind === "income")),
      investments: monthly(bills.filter((item) => item.kind === "transfer")),
    };
  }, [bills]);

  async function refreshGoal() {
    setGoals(await listGoals());
  }

  return (
    <Tabs
      value={tab}
      onValueChange={(value) => setTab(value as Tab)}
      className="space-y-5"
    >
      <PageActions>
        {tab === "budgets" && (
          <Button aria-label="New budget" onClick={() => setBudgetOpen(true)}>
            <Plus />
            <span className="hidden sm:inline">New budget</span>
          </Button>
        )}
        {tab === "goals" && (
          <Button
            aria-label="Plan a purchase"
            onClick={() => setTab("purchase")}
          >
            <Plus />
            <span className="hidden sm:inline">New goal</span>
          </Button>
        )}
        {tab === "commitments" && (
          <Button aria-label="Add commitment" onClick={() => setBillOpen(true)}>
            <Plus />
            <span className="hidden sm:inline">Add commitment</span>
          </Button>
        )}
      </PageActions>

      <TabsList className="grid h-auto w-full grid-cols-4 sm:max-w-xl">
        <TabsTrigger value="budgets" className="px-1">
          Budgets
        </TabsTrigger>
        <TabsTrigger value="goals" className="px-1">
          Goals
        </TabsTrigger>
        <TabsTrigger value="purchase" className="px-1">
          Planner
        </TabsTrigger>
        <TabsTrigger value="commitments" className="px-1">
          Commitments
        </TabsTrigger>
      </TabsList>

      {error && (
        <div className="space-y-3">
          <FormAlert>{error}</FormAlert>
          <Button variant="outline" onClick={() => void load()}>
            Try again
          </Button>
        </div>
      )}

      <TabsContent value="budgets">
        {loading ? (
          <Skeletons />
        ) : budgets.length ? (
          <div className="grid gap-4 md:grid-cols-2">
            {budgets.map((budget) => {
              const status = statuses[budget.id];
              const limit = Number(budget.total_limit);
              const spent = Number(status?.spent ?? 0);
              const percent = limit ? Math.round((spent / limit) * 100) : 0;
              const over = spent > limit;
              return (
                <Card key={budget.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <CardTitle className="truncate">
                          {budget.name}
                        </CardTitle>
                        <CardDescription>
                          {currency.date(budget.month, {
                            month: "long",
                            year: "numeric",
                          })}
                        </CardDescription>
                      </div>
                      <ItemMenu
                        label={budget.name}
                        onDelete={() =>
                          setPending({ kind: "budget", item: budget })
                        }
                      />
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
                          over &&
                            "[&_[data-slot=progress-indicator]]:bg-rose-500",
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
                          return (
                            <div key={line.category_id} className="space-y-1">
                              <div className="flex justify-between gap-2 text-sm">
                                <span className="truncate">
                                  {categoryName.get(line.category_id) ??
                                    "Category"}
                                </span>
                                <span
                                  className={cn(
                                    "money shrink-0",
                                    lineSpent > lineLimit && "text-rose-600",
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
                                    lineSpent > lineLimit
                                      ? "bg-rose-500"
                                      : "bg-primary",
                                  )}
                                  style={{
                                    width: `${Math.min(100, linePercent)}%`,
                                  }}
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
            })}
          </div>
        ) : (
          <EmptyState
            icon={WalletCards}
            title="No budgets yet"
            action={
              <Button onClick={() => setBudgetOpen(true)}>
                <Plus /> New budget
              </Button>
            }
          />
        )}
      </TabsContent>

      <TabsContent value="goals">
        {loading ? (
          <Skeletons />
        ) : goals.length ? (
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
                          onDelete={() =>
                            setPending({ kind: "goal", item: goal })
                          }
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
                            <span className="text-muted-foreground">
                              {" "}
                              / month
                            </span>
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
        ) : (
          <EmptyState
            icon={Target}
            title="No savings goals yet"
            action={
              <Button onClick={() => setTab("purchase")}>
                <Plus /> Plan a purchase
              </Button>
            }
          />
        )}
      </TabsContent>

      <TabsContent value="purchase">
        <PurchaseGoalCalculator
          onSaved={(goal) => {
            setGoals((current) => [...current, goal]);
            setTab("goals");
          }}
        />
      </TabsContent>

      <TabsContent value="commitments" className="space-y-4">
        {loading ? (
          <Skeletons />
        ) : bills.length ? (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <Card className="border-primary/15 bg-gradient-to-br from-primary/[0.07] via-card to-card">
                <CardContent className="p-5">
                  <p className="text-sm text-muted-foreground">
                    Bills and premiums / month
                  </p>
                  <p className="money mt-1 text-3xl font-semibold">
                    {currency.format(monthlyCommitments.bills, 0)}
                  </p>
                </CardContent>
              </Card>
              <Card className="border-sky-500/15 bg-gradient-to-br from-sky-500/[0.07] via-card to-card">
                <CardContent className="p-5">
                  <p className="text-sm text-muted-foreground">
                    Expected income / month
                  </p>
                  <p className="money mt-1 text-3xl font-semibold">
                    {currency.format(monthlyCommitments.income, 0)}
                  </p>
                </CardContent>
              </Card>
              <Card className="border-emerald-500/15 bg-gradient-to-br from-emerald-500/[0.07] via-card to-card">
                <CardContent className="p-5">
                  <p className="text-sm text-muted-foreground">
                    Planned investing / month
                  </p>
                  <p className="money mt-1 text-3xl font-semibold">
                    {currency.format(monthlyCommitments.investments, 0)}
                  </p>
                </CardContent>
              </Card>
            </div>
            <Card>
              <CardContent className="divide-y p-0">
                {bills.map((bill) => {
                  const days = Math.round(
                    (parseISODate(bill.next_due_on).getTime() -
                      parseISODate(today).getTime()) /
                      86_400_000,
                  );
                  const due =
                    days < 0
                      ? "Overdue"
                      : days === 0
                        ? "Due today"
                        : days === 1
                          ? "Due tomorrow"
                          : days <= 7
                            ? `Due in ${days} days`
                            : `Due ${currency.date(bill.next_due_on)}`;
                  return (
                    <div
                      key={bill.id}
                      className="flex flex-wrap items-center gap-3 px-4 py-3.5 sm:flex-nowrap"
                    >
                      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                        {bill.kind === "transfer" ? (
                          <TrendingUp className="size-[18px]" />
                        ) : bill.kind === "income" ? (
                          <BriefcaseBusiness className="size-[18px]" />
                        ) : (
                          <CalendarClock className="size-[18px]" />
                        )}
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
                          {bill.kind === "transfer"
                            ? "Investment"
                            : bill.kind === "income"
                              ? "Income"
                              : "Bill / premium"}{" "}
                          · {due} · {repeatLabel(bill.frequency, bill.interval)}
                        </p>
                        {bill.kind === "income" &&
                          bill.cost_amount &&
                          Number(bill.cost_amount) > 0 && (
                            <p className="mt-1 text-xs text-muted-foreground">
                              Expected net{" "}
                              {currency.format(
                                Math.max(
                                  0,
                                  Number(bill.amount) -
                                    Number(bill.cost_amount),
                                ),
                              )}
                              /cycle
                            </p>
                          )}
                        {bill.kind === "transfer" && bill.tenure_months && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {investmentProjectionLabel(bill, currency.format)}
                          </p>
                        )}
                      </div>
                      <strong className="money shrink-0">
                        {currency.format(bill.amount)}
                      </strong>
                      {days <= 0 && (
                        <Button size="sm" onClick={() => setPaying(bill)}>
                          {bill.kind === "income"
                            ? "Mark received"
                            : bill.kind === "transfer"
                              ? "Record contribution"
                              : "Mark as paid"}
                        </Button>
                      )}
                      <ItemMenu
                        label={bill.name}
                        deleteLabel="Stop"
                        onDelete={() =>
                          setPending({ kind: "bill", item: bill })
                        }
                      />
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </>
        ) : (
          <EmptyState
            icon={CalendarClock}
            title="No bills, premiums, or investments yet"
            action={
              <Button onClick={() => setBillOpen(true)}>
                <Plus /> Add commitment
              </Button>
            }
          />
        )}
      </TabsContent>

      <BudgetFormDialog
        open={budgetOpen}
        onOpenChange={setBudgetOpen}
        onCreated={(budget) => {
          const next = [budget, ...budgets].sort((a, b) =>
            b.month.localeCompare(a.month),
          );
          setBudgets(next);
          void loadStatuses(next);
        }}
      />
      <BillFormDialog
        open={billOpen}
        onOpenChange={setBillOpen}
        onCreated={(bill) =>
          setBills((current) =>
            [...current, bill].sort((a, b) =>
              a.next_due_on.localeCompare(b.next_due_on),
            ),
          )
        }
      />
      <GoalContributionDialog
        goal={contributing}
        onOpenChange={(open) => !open && setContributing(null)}
        onSaved={() => void refreshGoal()}
      />
      <PayCommitmentDialog
        key={paying?.id ?? "closed"}
        commitment={paying}
        onOpenChange={(open) => !open && setPaying(null)}
        onPaid={(updated) =>
          setBills((current) =>
            current
              .map((item) => (item.id === updated.id ? updated : item))
              .sort((a, b) => a.next_due_on.localeCompare(b.next_due_on)),
          )
        }
      />
      <ConfirmDialog
        open={!!pending}
        onOpenChange={(open) => !open && setPending(null)}
        title={
          pending?.kind === "bill"
            ? `Stop ${pending.item.name}?`
            : `Delete ${pending?.item.name ?? ""}?`
        }
        description={
          pending?.kind === "goal"
            ? "Its saved progress and contributions will be removed."
            : pending?.kind === "bill"
              ? "It will no longer appear in your bills."
              : "Your transactions are not affected."
        }
        confirmLabel={pending?.kind === "bill" ? "Stop bill" : "Delete"}
        onConfirm={async () => {
          if (!pending) return;
          if (pending.kind === "budget") {
            await deleteBudget(pending.item.id);
            setBudgets((current) =>
              current.filter((item) => item.id !== pending.item.id),
            );
          } else if (pending.kind === "goal") {
            await deleteGoal(pending.item.id);
            setGoals((current) =>
              current.filter((item) => item.id !== pending.item.id),
            );
          } else {
            await stopRecurringRule(pending.item.id);
            setBills((current) =>
              current.filter((item) => item.id !== pending.item.id),
            );
          }
          notifySuccess(
            pending.kind === "bill"
              ? `${pending.item.name} stopped`
              : `${pending.item.name} deleted`,
          );
        }}
      />
    </Tabs>
  );
}

const repeatUnits: Record<string, [string, string]> = {
  daily: ["Daily", "days"],
  weekly: ["Weekly", "weeks"],
  monthly: ["Monthly", "months"],
  yearly: ["Yearly", "years"],
};

function investmentProjectionLabel(
  item: RecurringItem,
  format: (value: number | string, maximumFractionDigits?: number) => string,
) {
  const tenure = item.tenure_months ?? 0;
  const occurrencesPerMonth =
    ({ daily: 30.4375, weekly: 4.348, monthly: 1, yearly: 1 / 12 }[
      item.frequency
    ] ?? 1) / Math.max(1, item.interval);
  const monthlyContribution = Number(item.amount) * occurrencesPerMonth;
  const contributed = monthlyContribution * tenure;
  const annualRate = Number(item.annual_return_rate ?? 0) / 100;
  const monthlyRate = annualRate / 12;
  const projected =
    monthlyRate > 0
      ? monthlyContribution *
        ((Math.pow(1 + monthlyRate, tenure) - 1) / monthlyRate)
      : contributed;
  return `${tenure} months · ${format(contributed, 0)} planned${annualRate > 0 ? ` · ${format(projected, 0)} projected` : ""}`;
}

function repeatLabel(frequency: string, interval: number) {
  const [single, plural] = repeatUnits[frequency] ?? [frequency, frequency];
  return interval > 1 ? `Every ${interval} ${plural}` : single;
}

function ItemMenu({
  label,
  deleteLabel = "Delete",
  onDelete,
}: {
  label: string;
  deleteLabel?: string;
  onDelete: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={`Actions for ${label}`}
          />
        }
      >
        <MoreHorizontal />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem variant="destructive" onClick={onDelete}>
          <Trash2 />
          {deleteLabel}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Skeletons() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {[0, 1].map((item) => (
        <div key={item} className="h-40 animate-pulse rounded-2xl bg-muted" />
      ))}
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  action,
}: {
  icon: typeof Target;
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex min-h-52 flex-col items-center justify-center gap-4 p-8 text-center">
        <span className="rounded-2xl bg-primary/10 p-4 text-primary">
          <Icon className="size-7" />
        </span>
        <h2 className="font-semibold">{title}</h2>
        {action}
      </CardContent>
    </Card>
  );
}
