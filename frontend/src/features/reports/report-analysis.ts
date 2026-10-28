import type { TransactionItem } from "@/api/transactions/types";

export function compactNumber(value: number) {
  return new Intl.NumberFormat(undefined, {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(Number(value));
}

/** Month buckets, this month's categories and daily spend from cleared transactions. */
export function buildAnalysis(
  transactions: TransactionItem[],
  today: Date,
  monthCount: number,
) {
  const months = Array.from({ length: monthCount }, (_, index) => {
    const date = new Date(
      today.getFullYear(),
      today.getMonth() - (monthCount - 1 - index),
      1,
    );
    return {
      key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
      label: date.toLocaleDateString(undefined, {
        month: "short",
        ...(monthCount === 12 ? { year: "2-digit" } : {}),
      }),
      income: 0,
      spending: 0,
    };
  });
  const monthMap = new Map(months.map((item) => [item.key, item]));
  const categories = new Map<string, number>();
  const daily = new Map<number, number>();
  const currentKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const previous = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const previousKey = `${previous.getFullYear()}-${String(previous.getMonth() + 1).padStart(2, "0")}`;

  transactions
    .filter((item) => item.status === "cleared")
    .forEach((item) => {
      const month = item.occurred_on.slice(0, 7);
      const amount = Number(item.amount);
      const bucket = monthMap.get(month);
      if (bucket && item.kind === "income") bucket.income += amount;
      if (bucket && item.kind === "expense") bucket.spending += amount;
      if (month === currentKey && item.kind === "expense") {
        const category = item.destination || "Uncategorized";
        categories.set(category, (categories.get(category) ?? 0) + amount);
        const day = Number(item.occurred_on.slice(8, 10));
        daily.set(day, (daily.get(day) ?? 0) + amount);
      }
    });
  const categoryList = [...categories]
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount);
  const dailyList = Array.from({ length: today.getDate() }, (_, index) => ({
    day: index + 1,
    amount: daily.get(index + 1) ?? 0,
  }));
  const currentSpend = categoryList.reduce((sum, item) => sum + item.amount, 0);
  return {
    monthly: months,
    categories: categoryList,
    daily: dailyList,
    currentSpend,
    previousSpend: monthMap.get(previousKey)?.spending ?? 0,
    averageDaily: currentSpend / Math.max(1, today.getDate()),
    peakDay: dailyList.reduce<(typeof dailyList)[number] | null>(
      (peak, item) => (!peak || item.amount > peak.amount ? item : peak),
      null,
    ),
  };
}
