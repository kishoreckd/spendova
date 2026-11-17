import type { Trip, TripExpense } from "@/api/trips/types";

/** Whole paise, so display maths never drifts. Server values stay decimal strings. */
export const toPaise = (value: string | number) =>
  Math.round(Number(value) * 100);
export const fromPaise = (paise: number) => (paise / 100).toFixed(2);

export function ownerOf(trip: Trip) {
  return trip.participants.find((item) => item.is_user)!;
}

export function nameOf(trip: Trip, participantId: string) {
  const person = trip.participants.find((item) => item.id === participantId);
  return person?.is_user ? "You" : (person?.name ?? "Someone");
}

export type ExpenseEffect =
  | { kind: "lent" | "borrowed"; paise: number }
  | { kind: "own" | "none"; paise: 0 };

/** What one expense means for the signed-in traveller. */
export function expenseEffect(trip: Trip, expense: TripExpense): ExpenseEffect {
  const me = ownerOf(trip).id;
  const mine = toPaise(
    expense.shares.find((share) => share.participant_id === me)?.amount ?? 0,
  );
  if (expense.payer_participant_id === me) {
    const lent = toPaise(expense.amount) - mine;
    return lent > 0 ? { kind: "lent", paise: lent } : { kind: "own", paise: 0 };
  }
  return mine > 0
    ? { kind: "borrowed", paise: mine }
    : { kind: "none", paise: 0 };
}

export type Payment = { from: string; to: string; paise: number };

/** Fewest payments that settle everyone (largest debtor pays largest creditor first). */
export function suggestedPayments(trip: Trip): Payment[] {
  const debtors = trip.balances
    .map((b) => ({ id: b.participant_id, paise: -toPaise(b.balance) }))
    .filter((b) => b.paise > 0)
    .sort((a, b) => b.paise - a.paise);
  const creditors = trip.balances
    .map((b) => ({ id: b.participant_id, paise: toPaise(b.balance) }))
    .filter((b) => b.paise > 0)
    .sort((a, b) => b.paise - a.paise);
  const payments: Payment[] = [];
  let d = 0;
  let c = 0;
  while (d < debtors.length && c < creditors.length) {
    const amount = Math.min(debtors[d]!.paise, creditors[c]!.paise);
    payments.push({
      from: debtors[d]!.id,
      to: creditors[c]!.id,
      paise: amount,
    });
    debtors[d]!.paise -= amount;
    creditors[c]!.paise -= amount;
    if (!debtors[d]!.paise) d += 1;
    if (!creditors[c]!.paise) c += 1;
  }
  return payments;
}

export type Headline =
  | { kind: "settled" }
  | { kind: "owed" | "owe"; paise: number; with: string | null };

/** The one answer the trip screen leads with. */
export function headline(trip: Trip): Headline {
  const me = ownerOf(trip).id;
  const mine = suggestedPayments(trip).filter(
    (p) => p.from === me || p.to === me,
  );
  const owed = toPaise(trip.others_owe_user);
  const owe = toPaise(trip.user_owes_others);
  if (!owed && !owe) return { kind: "settled" };
  const single = mine.length === 1 ? mine[0]! : null;
  const other = single ? (single.from === me ? single.to : single.from) : null;
  return owed
    ? {
        kind: "owed",
        paise: owed,
        with: other ? nameOf(trip, other) : null,
      }
    : { kind: "owe", paise: owe, with: other ? nameOf(trip, other) : null };
}
