import type { TransactionItem } from "@/api/transactions/types";
import type { CategoryItem } from "@/api/categories/types";
import { ArrowLeftRight, Tags } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { categoryTile } from "@/features/categories/hooks";
import { formatDate, formatMoney } from "@/lib/format";

export function TransactionList({
  items,
  categories,
  locale,
  onSelect,
}: {
  items: TransactionItem[];
  categories: CategoryItem[];
  locale?: string;
  onSelect: (item: TransactionItem) => void;
}) {
  const categoryById = new Map(
    categories.map((item) => [item.id, categoryTile(item)]),
  );
  const groups = new Map<string, TransactionItem[]>();
  for (const item of items)
    groups.set(item.occurred_on, [
      ...(groups.get(item.occurred_on) ?? []),
      item,
    ]);
  return [...groups].map(([date, rows]) => {
    const totals = new Map<string, number>();
    for (const item of rows) {
      if (item.status !== "cleared" || item.kind === "transfer") continue;
      totals.set(
        item.currency,
        (totals.get(item.currency) ?? 0) +
          Number(item.amount) * (item.kind === "income" ? 1 : -1),
      );
    }
    return (
      <section key={date} className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-muted-foreground">
          <h2>
            {formatDate(date, locale, {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </h2>
          <span className="money flex flex-wrap gap-3">
            {[...totals].map(([code, total]) => (
              <span key={code}>{formatMoney(total, code, locale)}</span>
            ))}
          </span>
        </div>
        <Card>
          <CardContent className="divide-y p-0">
            {rows.map((item) => {
              const tile = item.category_id
                ? categoryById.get(item.category_id)
                : undefined;
              const Icon =
                item.kind === "transfer"
                  ? ArrowLeftRight
                  : (tile?.icon ?? Tags);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelect(item)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-primary"
                >
                  <span
                    className="grid size-10 shrink-0 place-items-center rounded-full bg-muted"
                    style={{ color: tile?.color }}
                  >
                    <Icon className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {item.merchant ||
                        tile?.label ||
                        (item.kind === "income"
                          ? item.source
                          : item.destination)}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {item.kind === "transfer"
                        ? `${item.source} → ${item.destination}`
                        : `${tile?.label ?? "Uncategorized"} · ${item.kind === "income" ? item.destination : item.source}`}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    {item.status !== "cleared" && (
                      <Badge variant="outline" className="mb-1 capitalize">
                        {item.status}
                      </Badge>
                    )}
                    <span
                      className={`money block text-sm font-semibold ${item.kind === "income" ? "text-emerald-600" : ""} ${item.status === "voided" ? "line-through opacity-60" : ""}`}
                    >
                      {item.kind === "income"
                        ? "+"
                        : item.kind === "expense"
                          ? "−"
                          : ""}
                      {formatMoney(item.amount, item.currency, locale)}
                    </span>
                  </span>
                </button>
              );
            })}
          </CardContent>
        </Card>
      </section>
    );
  });
}
