import type { RecurringItem } from "@/api/recurring/types";

const OCCURRENCES_PER_MONTH: Record<string, number> = {
  daily: 30.4375,
  weekly: 4.348,
  monthly: 1,
  yearly: 1 / 12,
};

/** Average amount per month for a rule that repeats every `interval` periods. */
export function monthlyAmount(
  item: Pick<RecurringItem, "amount" | "frequency" | "interval">,
) {
  return (
    (Number(item.amount) * (OCCURRENCES_PER_MONTH[item.frequency] ?? 1)) /
    Math.max(1, item.interval)
  );
}

export function monthlyTotals(items: RecurringItem[]) {
  const sum = (kind: RecurringItem["kind"]) =>
    items
      .filter((item) => item.kind === kind)
      .reduce((total, item) => total + monthlyAmount(item), 0);
  return {
    bills: sum("expense"),
    income: sum("income"),
    investments: sum("transfer"),
  };
}

/** Contributions over the tenure and, when a return rate is set, the projected value. */
export function investmentProjection(item: RecurringItem) {
  const tenure = item.tenure_months ?? 0;
  const monthly = monthlyAmount(item);
  const contributed = monthly * tenure;
  const monthlyRate = Number(item.annual_return_rate ?? 0) / 1200;
  const projected =
    monthlyRate > 0
      ? monthly * ((Math.pow(1 + monthlyRate, tenure) - 1) / monthlyRate)
      : null;
  return { tenure, contributed, projected };
}

const repeatUnits: Record<string, [string, string]> = {
  daily: ["Daily", "days"],
  weekly: ["Weekly", "weeks"],
  monthly: ["Monthly", "months"],
  yearly: ["Yearly", "years"],
};

export function repeatLabel(frequency: string, interval: number) {
  const [single, plural] = repeatUnits[frequency] ?? [frequency, frequency];
  return interval > 1 ? `Every ${interval} ${plural}` : single;
}

export function dueLabel(days: number, formattedDate: string) {
  if (days < 0) return "Overdue";
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  if (days <= 7) return `Due in ${days} days`;
  return `Due ${formattedDate}`;
}
