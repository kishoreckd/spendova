import { describe, expect, it } from "vitest";
import type { Trip, TripExpense } from "@/api/trips/types";
import {
  expenseEffect,
  headline,
  suggestedPayments,
} from "@/features/trips/trip-maths";

const people = [
  { id: "me", name: "Kishore", is_user: true },
  { id: "vijay", name: "vijay", is_user: false },
  { id: "asha", name: "Asha", is_user: false },
];

function trip(balances: Record<string, string>, extra: Partial<Trip> = {}) {
  const mine = Number(balances.me ?? 0);
  return {
    participants: people,
    balances: people.map((p) => ({
      participant_id: p.id,
      name: p.name,
      paid: "0",
      share: "0",
      balance: balances[p.id] ?? "0",
    })),
    others_owe_user: String(Math.max(0, mine)),
    user_owes_others: String(Math.max(0, -mine)),
    expenses: [],
    settlements: [],
    ...extra,
  } as unknown as Trip;
}

const expense = (payer: string, shares: Record<string, string>) =>
  ({
    amount: "100.00",
    payer_participant_id: payer,
    shares: Object.entries(shares).map(([participant_id, amount]) => ({
      participant_id,
      amount,
    })),
  }) as unknown as TripExpense;

describe("trip maths", () => {
  it("describes each expense from the signed-in traveller's side", () => {
    const t = trip({});
    expect(expenseEffect(t, expense("me", { me: "50", vijay: "50" }))).toEqual({
      kind: "lent",
      paise: 5000,
    });
    expect(
      expenseEffect(t, expense("vijay", { me: "50", vijay: "50" })),
    ).toEqual({
      kind: "borrowed",
      paise: 5000,
    });
    expect(expenseEffect(t, expense("me", { me: "100" })).kind).toBe("own");
    expect(expenseEffect(t, expense("vijay", { vijay: "100" })).kind).toBe(
      "none",
    );
  });

  it("settles everyone with the fewest payments and keeps every paisa", () => {
    const t = trip({ me: "100.01", vijay: "-66.67", asha: "-33.34" });
    const payments = suggestedPayments(t);
    expect(payments).toEqual([
      { from: "vijay", to: "me", paise: 6667 },
      { from: "asha", to: "me", paise: 3334 },
    ]);
  });

  it("leads with one clear answer", () => {
    expect(headline(trip({ me: "50", vijay: "-50" }))).toEqual({
      kind: "owed",
      paise: 5000,
      with: "vijay",
    });
    expect(headline(trip({ me: "-20", asha: "20" }))).toEqual({
      kind: "owe",
      paise: 2000,
      with: "Asha",
    });
    expect(headline(trip({ me: "80", vijay: "-40", asha: "-40" }))).toEqual({
      kind: "owed",
      paise: 8000,
      with: null,
    });
    expect(headline(trip({}))).toEqual({ kind: "settled" });
  });
});
