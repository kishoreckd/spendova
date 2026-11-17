import { useMemo, useState } from "react";
import {
  ArrowLeft,
  CalendarRange,
  Check,
  HandCoins,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Tags,
  Trash2,
  UserPlus,
} from "lucide-react";
import type { Trip, TripExpense } from "@/api/trips/types";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Field, FormAlert } from "@/components/common/form-field";
import { PageActions } from "@/components/layout/page-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { categoryTile, useCategories } from "@/features/categories/hooks";
import { useIsDesktop } from "@/hooks/use-media-query";
import { useMoney } from "@/hooks/use-money";
import { errorMessage, notifySuccess } from "@/lib/forms";
import { CreateTripDialog } from "./create-trip-dialog";
import { ExpenseDialog } from "./expense-dialog";
import {
  useAddTripParticipant,
  useCloseTrip,
  useDeleteSettlement,
  useDeleteTrip,
  useDeleteTripExpense,
  useReopenTrip,
  useTrips,
} from "./hooks";
import { SettleDialog } from "./settle-dialog";
import {
  expenseEffect,
  fromPaise,
  headline,
  nameOf,
  suggestedPayments,
  toPaise,
  type Payment,
} from "./trip-maths";

type Money = ReturnType<typeof useMoney>;
type Pending =
  | { kind: "expense"; id: string; label: string }
  | { kind: "payment"; id: string; label: string };

export default function TripsPage() {
  const money = useMoney();
  const desktop = useIsDesktop();
  const query = useTrips();
  const close = useCloseTrip();
  const reopen = useReopenTrip();
  const removeTrip = useDeleteTrip();
  const removeExpense = useDeleteTripExpense();
  const removePayment = useDeleteSettlement();
  const [createOpen, setCreateOpen] = useState(false);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [editing, setEditing] = useState<TripExpense | null>(null);
  const [settleOpen, setSettleOpen] = useState(false);
  const [settlePreset, setSettlePreset] = useState<Payment | null>(null);
  const [finishOpen, setFinishOpen] = useState(false);
  const [reopenOpen, setReopenOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const [view, setView] = useState<"active" | "finished">("active");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const trips = useMemo(() => query.data ?? [], [query.data]);
  const visible = trips.filter((trip) =>
    view === "finished" ? trip.status === "closed" : trip.status !== "closed",
  );
  const selected =
    trips.find((trip) => trip.id === selectedId) ??
    (desktop ? (visible[0] ?? null) : null);

  function openSettle(preset: Payment | null) {
    setSettlePreset(preset);
    setSettleOpen(true);
  }

  const list = (
    <div className="min-w-0 space-y-3">
      <Tabs value={view} onValueChange={(v) => setView(v as typeof view)}>
        <TabsList>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="finished">Finished</TabsTrigger>
        </TabsList>
      </Tabs>
      {!visible.length ? (
        <Card className="border-dashed">
          <CardContent className="flex min-h-32 items-center justify-center text-sm text-muted-foreground">
            {view === "finished" ? "No finished trips" : "No active trips"}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-2">
          {visible.map((trip) => (
            <TripCard
              key={trip.id}
              trip={trip}
              money={money}
              active={desktop && selected?.id === trip.id}
              onSelect={() => setSelectedId(trip.id)}
            />
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-5">
      <PageActions>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus />
          <span className="hidden sm:inline">New trip</span>
        </Button>
      </PageActions>
      {query.error && (
        <FormAlert>
          {errorMessage(query.error, "Could not load trips")}{" "}
          <Button variant="link" onClick={() => void query.refetch()}>
            Try again
          </Button>
        </FormAlert>
      )}
      {query.isPending ? (
        <div className="grid gap-3 lg:grid-cols-[300px_minmax(0,1fr)]">
          <div className="h-28 animate-pulse rounded-2xl bg-muted" />
          <div className="h-72 animate-pulse rounded-2xl bg-muted" />
        </div>
      ) : !trips.length ? (
        <Card className="border-dashed">
          <CardContent className="flex min-h-64 flex-col items-center justify-center gap-4 p-8">
            <CalendarRange className="size-9 text-primary" />
            <h2 className="font-semibold">No trips yet</h2>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus /> Plan a trip
            </Button>
          </CardContent>
        </Card>
      ) : desktop ? (
        <div className="grid min-w-0 gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
          {list}
          {selected ? (
            <TripDetail
              trip={selected}
              money={money}
              onAddExpense={() => {
                setEditing(null);
                setExpenseOpen(true);
              }}
              onEditExpense={(expense) => {
                setEditing(expense);
                setExpenseOpen(true);
              }}
              onSettle={openSettle}
              onFinish={() => setFinishOpen(true)}
              onReopen={() => setReopenOpen(true)}
              onDelete={() => setDeleteOpen(true)}
              onRemove={setPending}
            />
          ) : (
            <div />
          )}
        </div>
      ) : selected ? (
        <TripDetail
          trip={selected}
          money={money}
          onBack={() => setSelectedId(null)}
          onAddExpense={() => {
            setEditing(null);
            setExpenseOpen(true);
          }}
          onEditExpense={(expense) => {
            setEditing(expense);
            setExpenseOpen(true);
          }}
          onSettle={openSettle}
          onFinish={() => setFinishOpen(true)}
          onReopen={() => setReopenOpen(true)}
          onDelete={() => setDeleteOpen(true)}
          onRemove={setPending}
        />
      ) : (
        list
      )}

      <CreateTripDialog open={createOpen} onOpenChange={setCreateOpen} />
      {selected && (
        <>
          <ExpenseDialog
            trip={selected}
            expense={editing}
            open={expenseOpen}
            onOpenChange={setExpenseOpen}
          />
          <SettleDialog
            trip={selected}
            preset={settlePreset}
            open={settleOpen}
            onOpenChange={setSettleOpen}
          />
          <ConfirmDialog
            open={finishOpen}
            onOpenChange={setFinishOpen}
            title={`Finish ${selected.name}?`}
            description={`${money.format(selected.user_share)} is added to your spending.`}
            confirmLabel="Finish trip"
            onConfirm={async () => {
              await close.mutateAsync(selected.id);
              notifySuccess("Trip finished");
            }}
          />
          <ConfirmDialog
            open={reopenOpen}
            onOpenChange={setReopenOpen}
            title={`Reopen ${selected.name}?`}
            description={`${money.format(selected.user_share)} is removed from your spending until you finish again.`}
            confirmLabel="Reopen trip"
            onConfirm={async () => {
              await reopen.mutateAsync(selected.id);
              setView("active");
              setSelectedId(selected.id);
              notifySuccess("Trip reopened");
            }}
          />
          <ConfirmDialog
            open={deleteOpen}
            onOpenChange={setDeleteOpen}
            title={`Delete ${selected.name}?`}
            description={
              selected.status === "closed"
                ? "Your share stays in transactions."
                : "Travellers, expenses and payments are deleted."
            }
            confirmLabel="Delete trip"
            onConfirm={async () => {
              await removeTrip.mutateAsync(selected.id);
              setSelectedId(null);
              notifySuccess("Trip deleted");
            }}
          />
          <ConfirmDialog
            open={!!pending}
            onOpenChange={(next) => !next && setPending(null)}
            title={`Remove ${pending?.label ?? ""}?`}
            description={
              pending?.kind === "payment"
                ? "Balances go back to before this payment."
                : "Balances are recalculated."
            }
            confirmLabel="Remove"
            onConfirm={async () => {
              if (!pending) return;
              if (pending.kind === "expense")
                await removeExpense.mutateAsync({
                  tripId: selected.id,
                  expenseId: pending.id,
                });
              else
                await removePayment.mutateAsync({
                  tripId: selected.id,
                  settlementId: pending.id,
                });
              setPending(null);
            }}
          />
        </>
      )}
    </div>
  );
}

function balanceLine(trip: Trip, money: Money) {
  const h = headline(trip);
  if (trip.participants.length < 2)
    return { text: `${money.format(trip.user_share)} spent`, tone: "" };
  if (h.kind === "settled") return { text: "All settled", tone: "" };
  const amount = money.format(fromPaise(h.paise));
  if (h.kind === "owed")
    return {
      text: h.with ? `${h.with} owes you ${amount}` : `You're owed ${amount}`,
      tone: "text-emerald-600 dark:text-emerald-400",
    };
  return {
    text: h.with ? `You owe ${h.with} ${amount}` : `You owe ${amount}`,
    tone: "text-rose-600 dark:text-rose-400",
  };
}

function dateRange(trip: Trip, money: Money) {
  if (!trip.start_on) return null;
  return trip.end_on && trip.end_on !== trip.start_on
    ? `${money.date(trip.start_on)} – ${money.date(trip.end_on)}`
    : money.date(trip.start_on);
}

function TripCard({
  trip,
  money,
  active,
  onSelect,
}: {
  trip: Trip;
  money: Money;
  active: boolean;
  onSelect: () => void;
}) {
  const line = balanceLine(trip, money);
  const dates = dateRange(trip, money);
  return (
    <button
      onClick={onSelect}
      className={`w-full rounded-2xl border p-4 text-left transition ${active ? "border-primary bg-primary/5" : "bg-card hover:bg-muted/50"}`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="truncate font-medium">{trip.name}</span>
        <span className="shrink-0 text-sm font-medium tabular-nums">
          {money.format(trip.total_spent)}
        </span>
      </div>
      <p className="mt-1 truncate text-xs text-muted-foreground">
        {[trip.destination, dates, `${trip.participants.length} people`]
          .filter(Boolean)
          .join(" · ")}
      </p>
      <p className={`mt-2 text-sm font-medium ${line.tone}`}>{line.text}</p>
    </button>
  );
}

function TripDetail({
  trip,
  money,
  onBack,
  onAddExpense,
  onEditExpense,
  onSettle,
  onFinish,
  onReopen,
  onDelete,
  onRemove,
}: {
  trip: Trip;
  money: Money;
  onBack?: () => void;
  onAddExpense: () => void;
  onEditExpense: (expense: TripExpense) => void;
  onSettle: (preset: Payment | null) => void;
  onFinish: () => void;
  onReopen: () => void;
  onDelete: () => void;
  onRemove: (item: Pending) => void;
}) {
  const open = trip.status !== "closed";
  const group = trip.participants.length > 1;
  const h = headline(trip);
  const payments = suggestedPayments(trip);
  const dates = dateRange(trip, money);
  const people = trip.participants
    .map((p) => (p.is_user ? "You" : p.name))
    .join(", ");
  const myPayment =
    payments.find(
      (p) =>
        trip.participants.find((x) => x.is_user)?.id === p.from ||
        trip.participants.find((x) => x.is_user)?.id === p.to,
    ) ??
    payments[0] ??
    null;
  const budgetLeft = trip.budget
    ? toPaise(trip.budget) - toPaise(trip.total_spent)
    : null;

  return (
    <div className="min-w-0 space-y-4">
      <div className="flex items-start gap-2">
        {onBack && (
          <Button
            size="icon"
            variant="ghost"
            aria-label="All trips"
            onClick={onBack}
          >
            <ArrowLeft />
          </Button>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-xl font-semibold">{trip.name}</h2>
            {!open && <Badge variant="secondary">Finished</Badge>}
          </div>
          <p className="truncate text-sm text-muted-foreground">
            {[trip.destination, dates, people].filter(Boolean).join(" · ")}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                size="icon"
                variant="ghost"
                aria-label={`Actions for ${trip.name}`}
              />
            }
          >
            <MoreHorizontal />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {open ? (
              <DropdownMenuItem
                onClick={onFinish}
                disabled={!trip.expenses.length}
              >
                <Check /> Finish trip
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={onReopen}>
                <RotateCcw /> Reopen
              </DropdownMenuItem>
            )}
            <DropdownMenuItem variant="destructive" onClick={onDelete}>
              <Trash2 /> Delete trip
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Card>
        <CardContent className="space-y-4 p-5">
          {group ? (
            h.kind === "settled" ? (
              <p className="text-2xl font-semibold">All settled</p>
            ) : (
              <div>
                <p className="text-sm text-muted-foreground">
                  {h.kind === "owed"
                    ? h.with
                      ? `${h.with} owes you`
                      : "You're owed"
                    : h.with
                      ? `You owe ${h.with}`
                      : "You owe"}
                </p>
                <p
                  className={`text-3xl font-semibold tabular-nums ${h.kind === "owed" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}
                >
                  {money.format(fromPaise(h.paise))}
                </p>
              </div>
            )
          ) : (
            <div>
              <p className="text-sm text-muted-foreground">You spent</p>
              <p className="text-3xl font-semibold tabular-nums">
                {money.format(trip.user_share)}
              </p>
            </div>
          )}
          <p className="text-sm text-muted-foreground">
            Trip total {money.format(trip.total_spent)}
            {group && ` · Your share ${money.format(trip.user_share)}`}
            {budgetLeft !== null &&
              (budgetLeft >= 0
                ? ` · ${money.format(fromPaise(budgetLeft))} left`
                : ` · ${money.format(fromPaise(-budgetLeft))} over budget`)}
          </p>
          <div className="grid gap-2 min-[420px]:flex">
            {open && (
              <Button onClick={onAddExpense}>
                <Plus /> Add expense
              </Button>
            )}
            {group && h.kind !== "settled" && (
              <Button variant="outline" onClick={() => onSettle(myPayment)}>
                <HandCoins /> Settle up
              </Button>
            )}
            {open && trip.expenses.length > 0 && (
              <Button variant="ghost" onClick={onFinish}>
                <Check /> Finish trip
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="expenses">
        <TabsList>
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
          <TabsTrigger value="balances">Balances</TabsTrigger>
        </TabsList>
        <TabsContent value="expenses">
          <ActivityList
            trip={trip}
            money={money}
            onEditExpense={onEditExpense}
            onRemove={onRemove}
          />
        </TabsContent>
        <TabsContent value="balances">
          <Balances
            trip={trip}
            money={money}
            payments={payments}
            onSettle={onSettle}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ActivityList({
  trip,
  money,
  onEditExpense,
  onRemove,
}: {
  trip: Trip;
  money: Money;
  onEditExpense: (expense: TripExpense) => void;
  onRemove: (item: Pending) => void;
}) {
  const categories = useCategories();
  const tiles = new Map(
    categories.items.map((item) => [item.id, categoryTile(item)]),
  );
  const open = trip.status !== "closed";
  type Row =
    | { kind: "expense"; date: string; expense: TripExpense }
    | {
        kind: "payment";
        date: string;
        payment: Trip["settlements"][number];
      };
  const rows: Row[] = [
    ...trip.expenses.map((expense) => ({
      kind: "expense" as const,
      date: expense.occurred_on,
      expense,
    })),
    ...trip.settlements.map((payment) => ({
      kind: "payment" as const,
      date: payment.occurred_on,
      payment,
    })),
  ].sort((a, b) => b.date.localeCompare(a.date));
  const days = [...new Set(rows.map((row) => row.date))];

  if (!rows.length)
    return (
      <Card className="border-dashed">
        <CardContent className="flex min-h-32 items-center justify-center text-sm text-muted-foreground">
          No expenses yet
        </CardContent>
      </Card>
    );

  return (
    <Card>
      <CardContent className="p-0">
        {days.map((day) => (
          <div key={day}>
            <p className="bg-muted/40 px-4 py-1.5 text-xs font-medium text-muted-foreground">
              {money.date(day)}
            </p>
            <div className="divide-y">
              {rows
                .filter((row) => row.date === day)
                .map((row) => {
                  if (row.kind === "payment") {
                    const p = row.payment;
                    const label = `${nameOf(trip, p.from_participant_id)} paid ${nameOf(trip, p.to_participant_id)}`;
                    return (
                      <div
                        key={p.id}
                        className="flex items-center gap-3 px-4 py-3"
                      >
                        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-emerald-500/10 text-emerald-600">
                          <HandCoins className="size-4" />
                        </span>
                        <p className="min-w-0 flex-1 truncate text-sm font-medium">
                          {label}
                        </p>
                        <span className="text-sm font-medium tabular-nums">
                          {money.format(p.amount)}
                        </span>
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={`Remove ${label}`}
                          onClick={() =>
                            onRemove({ kind: "payment", id: p.id, label })
                          }
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    );
                  }
                  const expense = row.expense;
                  const tile = tiles.get(expense.category_id);
                  const Icon = tile?.icon ?? Tags;
                  const effect = expenseEffect(trip, expense);
                  const payer = nameOf(trip, expense.payer_participant_id);
                  const effectText =
                    effect.kind === "lent"
                      ? `you lent ${money.format(fromPaise(effect.paise))}`
                      : effect.kind === "borrowed"
                        ? `you borrowed ${money.format(fromPaise(effect.paise))}`
                        : effect.kind === "own"
                          ? "just you"
                          : "not involved";
                  const tone =
                    effect.kind === "lent"
                      ? "text-emerald-600 dark:text-emerald-400"
                      : effect.kind === "borrowed"
                        ? "text-rose-600 dark:text-rose-400"
                        : "text-muted-foreground";
                  const body = (
                    <>
                      <span
                        className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"
                        style={
                          tile?.color
                            ? {
                                color: tile.color,
                                backgroundColor: `color-mix(in oklch, ${tile.color} 15%, transparent)`,
                              }
                            : undefined
                        }
                      >
                        <Icon className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {expense.description}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {payer} paid
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block text-sm font-medium tabular-nums">
                          {money.format(expense.amount)}
                        </span>
                        {trip.participants.length > 1 && (
                          <span className={`block text-xs ${tone}`}>
                            {effectText}
                          </span>
                        )}
                      </span>
                    </>
                  );
                  return (
                    <div key={expense.id} className="flex items-center">
                      {open ? (
                        <button
                          className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left hover:bg-muted/40"
                          aria-label={`Edit ${expense.description}`}
                          onClick={() => onEditExpense(expense)}
                        >
                          {body}
                        </button>
                      ) : (
                        <div className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3">
                          {body}
                        </div>
                      )}
                      {open && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="mr-2"
                          aria-label={`Remove ${expense.description}`}
                          onClick={() =>
                            onRemove({
                              kind: "expense",
                              id: expense.id,
                              label: expense.description,
                            })
                          }
                        >
                          <Trash2 />
                        </Button>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function Balances({
  trip,
  money,
  payments,
  onSettle,
}: {
  trip: Trip;
  money: Money;
  payments: Payment[];
  onSettle: (preset: Payment | null) => void;
}) {
  const addParticipant = useAddTripParticipant();
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const open = trip.status !== "closed";

  async function addPerson() {
    if (!name.trim()) {
      setError("Enter a name");
      return;
    }
    try {
      await addParticipant.mutateAsync({ tripId: trip.id, name: name.trim() });
      setName("");
      setError("");
      notifySuccess("Traveller added");
    } catch (reason) {
      setError(errorMessage(reason, "Could not add traveller"));
    }
  }

  return (
    <div className="space-y-4">
      {payments.length > 0 && (
        <Card>
          <CardContent className="divide-y p-0">
            {payments.map((payment) => (
              <div
                key={`${payment.from}-${payment.to}`}
                className="flex items-center gap-3 px-4 py-3"
              >
                <p className="min-w-0 flex-1 text-sm">
                  <span className="font-medium">
                    {nameOf(trip, payment.from)}
                  </span>{" "}
                  {nameOf(trip, payment.from) === "You" ? "pay" : "pays"}{" "}
                  <span className="font-medium">
                    {nameOf(trip, payment.to)}
                  </span>
                </p>
                <span className="text-sm font-semibold tabular-nums">
                  {money.format(fromPaise(payment.paise))}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onSettle(payment)}
                >
                  Record
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
      <Card>
        <CardContent className="divide-y p-0">
          {trip.balances.map((balance) => {
            const paise = toPaise(balance.balance);
            const you = nameOf(trip, balance.participant_id) === "You";
            return (
              <div
                key={balance.participant_id}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {you ? `${balance.name} (you)` : balance.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Paid {money.format(balance.paid)} · Share{" "}
                    {money.format(balance.share)}
                  </p>
                </div>
                <span
                  className={`shrink-0 text-sm font-medium ${paise > 0 ? "text-emerald-600 dark:text-emerald-400" : paise < 0 ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground"}`}
                >
                  {paise > 0
                    ? `Gets back ${money.format(fromPaise(paise))}`
                    : paise < 0
                      ? `Owes ${money.format(fromPaise(-paise))}`
                      : "Settled"}
                </span>
              </div>
            );
          })}
          {open && (
            <div className="flex items-start gap-2 p-4">
              <Field
                id="trip-new-person"
                label={<span className="sr-only">Traveller name</span>}
                error={error}
                className="min-w-0 flex-1"
              >
                <Input
                  id="trip-new-person"
                  value={name}
                  placeholder="Add traveller"
                  aria-invalid={!!error}
                  onChange={(e) => {
                    setName(e.target.value);
                    setError("");
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void addPerson();
                  }}
                />
              </Field>
              <Button
                variant="outline"
                loading={addParticipant.isPending}
                onClick={() => void addPerson()}
              >
                <UserPlus /> Add
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
