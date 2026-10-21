import { addDays, addMonths, differenceInCalendarDays } from "date-fns";
import { parseISODate } from "@/lib/format";

export type GoalMode = "none" | "life" | "daily";

/**
 * Preview of the server's replacement goal while the form is being edited.
 * The saved asset's `replacement_goal` from the API remains authoritative.
 */
export function previewGoal({
  price,
  purchasedOn,
  mode,
  lifeMonths,
  dailyTarget,
}: {
  price: number;
  purchasedOn: string;
  mode: GoalMode;
  lifeMonths: number;
  dailyTarget: number;
}) {
  if (!(price > 0) || !purchasedOn || mode === "none") return null;
  const start = parseISODate(purchasedOn);
  if (mode === "life") {
    if (!(lifeMonths >= 1)) return null;
    const reachedOn = addMonths(start, lifeMonths);
    const days = Math.max(1, differenceInCalendarDays(reachedOn, start));
    return { reachedOn, days, dailyCost: price / days };
  }
  if (!(dailyTarget > 0)) return null;
  const days = Math.max(1, Math.ceil(price / dailyTarget));
  return { reachedOn: addDays(start, days), days, dailyCost: dailyTarget };
}

export function describeLife(months: number) {
  const years = Math.floor(months / 12);
  const rest = months % 12;
  return [
    years && `${years} year${years === 1 ? "" : "s"}`,
    rest && `${rest} month${rest === 1 ? "" : "s"}`,
  ]
    .filter(Boolean)
    .join(" ");
}

/** "2 years 3 months" style age; days are shown separately in the UI. */
export function describeAge(days: number) {
  if (days < 31) return `${days} day${days === 1 ? "" : "s"}`;
  return describeLife(Math.floor(days / 30.4375)) || "Less than a month";
}
