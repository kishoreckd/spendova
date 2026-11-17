import { useMemo, useState } from "react";
import {
  CalendarRange,
  Check,
  MapPin,
  Plus,
  ReceiptText,
  Trash2,
  Users,
} from "lucide-react";
import type { Trip } from "@/api/trips/types";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Field, FormAlert } from "@/components/common/form-field";
import { PageActions } from "@/components/layout/page-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMoney } from "@/hooks/use-money";
import { errorMessage, notifySuccess } from "@/lib/forms";
import { CreateTripDialog } from "./create-trip-dialog";
import { ExpenseDialog } from "./expense-dialog";
import {
  useAddTripParticipant,
  useCloseTrip,
  useDeleteTripExpense,
  useTrips,
} from "./hooks";

export default function TripsPage() {
  const money = useMoney();
  const query = useTrips();
  const close = useCloseTrip();
  const removeExpense = useDeleteTripExpense();
  const addParticipant = useAddTripParticipant();
  const [createOpen, setCreateOpen] = useState(false);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState<string | null>(null);
  const [view, setView] = useState<"open" | "closed">("open");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [participant, setParticipant] = useState("");
  const [participantError, setParticipantError] = useState("");
  const trips = useMemo(() => query.data ?? [], [query.data]);
  const visible = trips.filter((trip) =>
    view === "closed" ? trip.status === "closed" : trip.status !== "closed",
  );
  const selected =
    trips.find((trip) => trip.id === selectedId) ?? visible[0] ?? null;
  async function addPerson() {
    if (!selected || !participant.trim()) return;
    try {
      await addParticipant.mutateAsync({
        tripId: selected.id,
        name: participant.trim(),
      });
      setParticipant("");
      setParticipantError("");
    } catch (reason) {
      setParticipantError(errorMessage(reason, "Could not add traveller"));
    }
  }
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
          {errorMessage(query.error, "Could not load trips")}
        </FormAlert>
      )}
      {query.isPending ? (
        <div className="h-48 animate-pulse rounded-2xl bg-muted" />
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
      ) : (
        <>
          <Tabs
            value={view}
            onValueChange={(value) => setView(value as typeof view)}
          >
            <TabsList>
              <TabsTrigger value="open">Open</TabsTrigger>
              <TabsTrigger value="closed">Closed</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
            <div className="space-y-2">
              {visible.map((trip) => (
                <button
                  key={trip.id}
                  onClick={() => setSelectedId(trip.id)}
                  className={`w-full rounded-xl border p-4 text-left transition ${selected?.id === trip.id ? "border-primary bg-primary/5" : "bg-card hover:bg-muted/50"}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium">{trip.name}</span>
                    <Badge variant="outline">
                      {trip.mode === "split"
                        ? `${trip.participants.length} people`
                        : "Personal"}
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {trip.destination || "No destination"}
                  </p>
                  <p className="mt-2 font-semibold tabular-nums">
                    {money.format(trip.user_share)}
                  </p>
                </button>
              ))}
            </div>
            {selected && (
              <TripDetail
                trip={selected}
                money={money}
                participant={participant}
                setParticipant={setParticipant}
                participantError={participantError}
                addPerson={addPerson}
                addingPerson={addParticipant.isPending}
                onExpense={() => setExpenseOpen(true)}
                onClose={() => setCloseOpen(true)}
                onDeleteExpense={setExpenseToDelete}
              />
            )}
          </div>
        </>
      )}
      <CreateTripDialog open={createOpen} onOpenChange={setCreateOpen} />
      {selected && (
        <>
          <ExpenseDialog
            trip={selected}
            open={expenseOpen}
            onOpenChange={setExpenseOpen}
          />
          <ConfirmDialog
            open={closeOpen}
            onOpenChange={setCloseOpen}
            title={`Close ${selected.name}?`}
            description="Your share of each expense will be added to monthly and yearly spending using its original date. Settlements are not income or another expense."
            confirmLabel="Close and post my share"
            onConfirm={async () => {
              await close.mutateAsync(selected.id);
              notifySuccess(
                "Trip closed",
                "Your allocated expenses are now in reports",
              );
            }}
          />
          <ConfirmDialog
            open={!!expenseToDelete}
            onOpenChange={(next) => !next && setExpenseToDelete(null)}
            title="Remove this trip expense?"
            description="Trip totals and participant balances will be recalculated."
            confirmLabel="Remove expense"
            onConfirm={async () => {
              if (!expenseToDelete) return;
              await removeExpense.mutateAsync({
                tripId: selected.id,
                expenseId: expenseToDelete,
              });
              setExpenseToDelete(null);
            }}
          />
        </>
      )}
    </div>
  );
}

function TripDetail({
  trip,
  money,
  participant,
  setParticipant,
  participantError,
  addPerson,
  addingPerson,
  onExpense,
  onClose,
  onDeleteExpense,
}: {
  trip: Trip;
  money: ReturnType<typeof useMoney>;
  participant: string;
  setParticipant: (value: string) => void;
  participantError: string;
  addPerson: () => Promise<void>;
  addingPerson: boolean;
  onExpense: () => void;
  onClose: () => void;
  onDeleteExpense: (expenseId: string) => void;
}) {
  const over = trip.budget
    ? Number(trip.total_spent) - Number(trip.budget)
    : null;
  return (
    <div className="min-w-0 space-y-4">
      <Card>
        <CardHeader className="flex-row items-start justify-between gap-3">
          <div>
            <CardTitle>{trip.name}</CardTitle>
            <div className="mt-2 flex flex-wrap gap-3 text-sm text-muted-foreground">
              {trip.destination && (
                <span className="flex items-center gap-1">
                  <MapPin className="size-4" />
                  {trip.destination}
                </span>
              )}
              {trip.start_on && (
                <span>
                  {money.date(trip.start_on)}
                  {trip.end_on ? ` – ${money.date(trip.end_on)}` : ""}
                </span>
              )}
            </div>
          </div>
          {trip.status !== "closed" && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={onExpense}>
                <Plus /> Expense
              </Button>
              <Button onClick={onClose} disabled={!trip.expenses.length}>
                <Check /> Close
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Trip total", trip.total_spent],
            ["Your share", trip.user_share],
            ["You paid", trip.user_paid],
            [
              Number(trip.others_owe_user) > 0 ? "Owed to you" : "You owe",
              Number(trip.others_owe_user) > 0
                ? trip.others_owe_user
                : trip.user_owes_others,
            ],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl bg-muted/50 p-3">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="mt-1 font-semibold tabular-nums">
                {money.format(value)}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
      {trip.budget && (
        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <span className="text-sm text-muted-foreground">
              Budget {money.format(trip.budget)}
            </span>
            <span
              className={
                over! > 0
                  ? "font-medium text-rose-600"
                  : "font-medium text-emerald-600"
              }
            >
              {over! > 0
                ? `${money.format(over!)} over`
                : `${money.format(Math.abs(over!))} left`}
            </span>
          </CardContent>
        </Card>
      )}
      {trip.mode === "split" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="size-4" /> Travellers
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {trip.status !== "closed" && (
              <div className="flex gap-2">
                <Field
                  id="trip-new-person"
                  label="Add traveller"
                  error={participantError}
                  className="flex-1"
                >
                  <Input
                    id="trip-new-person"
                    value={participant}
                    onChange={(e) => setParticipant(e.target.value)}
                  />
                </Field>
                <Button
                  className="mt-7"
                  variant="outline"
                  loading={addingPerson}
                  onClick={() => void addPerson()}
                >
                  Add
                </Button>
              </div>
            )}
            <div className="divide-y">
              {trip.balances.map((balance) => (
                <div
                  key={balance.participant_id}
                  className="flex items-center justify-between py-3 text-sm"
                >
                  <div>
                    <p className="font-medium">
                      {balance.name}
                      {trip.participants.find(
                        (p) => p.id === balance.participant_id,
                      )?.is_user
                        ? " (you)"
                        : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Paid {money.format(balance.paid)} · Share{" "}
                      {money.format(balance.share)}
                    </p>
                  </div>
                  <span
                    className={
                      Number(balance.balance) >= 0
                        ? "text-emerald-600"
                        : "text-rose-600"
                    }
                  >
                    {Number(balance.balance) >= 0
                      ? `Gets ${money.format(balance.balance)}`
                      : `Owes ${money.format(Math.abs(Number(balance.balance)))}`}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ReceiptText className="size-4" /> Expenses
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!trip.expenses.length ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No expenses yet
            </p>
          ) : (
            <div className="divide-y">
              {trip.expenses.map((expense) => {
                const payer = trip.participants.find(
                  (p) => p.id === expense.payer_participant_id,
                );
                const mine = expense.shares.find(
                  (s) =>
                    trip.participants.find((p) => p.id === s.participant_id)
                      ?.is_user,
                );
                return (
                  <div
                    key={expense.id}
                    className="flex items-start justify-between gap-3 py-3"
                  >
                    <div>
                      <p className="font-medium">{expense.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {expense.category} · {money.date(expense.occurred_on)} ·
                        Paid by {payer?.name}
                      </p>
                    </div>
                    <div className="flex items-start gap-2 text-right">
                      <div>
                        <p className="font-medium tabular-nums">
                          {money.format(expense.amount)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Your share {money.format(mine?.amount ?? "0")}
                        </p>
                      </div>
                      {trip.status !== "closed" && (
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={`Remove ${expense.description}`}
                          onClick={() => onDeleteExpense(expense.id)}
                        >
                          <Trash2 />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
