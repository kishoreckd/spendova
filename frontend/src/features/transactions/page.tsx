import { useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { subDays } from "date-fns";
import { ArrowLeftRight, Plus, ReceiptText, Search, Tags } from "lucide-react";
import type { TransactionItem } from "@/api/transactions/types";
import { FormAlert } from "@/components/common/form-field";
import type { ShellContext } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { categoryTile, useCategories } from "@/features/categories/hooks";
import { useMoney } from "@/hooks/use-money";
import { localDateISO } from "@/lib/format";
import { errorMessage } from "@/lib/forms";
import { useTransactions } from "./hooks";

const RECENT = { limit: 200 };

export default function TransactionsPage() {
  const { openTransaction } = useOutletContext<ShellContext>();
  const currency = useMoney();
  const categories = useCategories();
  const [query, setQuery] = useState("");
  const transactionsQuery = useTransactions(RECENT);
  const transactions = useMemo(
    () => transactionsQuery.data ?? [],
    [transactionsQuery.data],
  );
  const loading = transactionsQuery.isPending;
  const error = transactionsQuery.error
    ? errorMessage(transactionsQuery.error, "Could not load transactions")
    : "";
  const load = transactionsQuery.refetch;

  const categoryById = useMemo(
    () =>
      new Map(categories.items.map((item) => [item.id, categoryTile(item)])),
    [categories.items],
  );

  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const rows = transactions.filter((item) =>
      `${item.merchant ?? ""} ${item.destination} ${item.source} ${item.notes ?? ""}`
        .toLowerCase()
        .includes(needle),
    );
    const byDate = new Map<string, TransactionItem[]>();
    for (const item of rows)
      byDate.set(item.occurred_on, [
        ...(byDate.get(item.occurred_on) ?? []),
        item,
      ]);
    return [...byDate.entries()];
  }, [transactions, query]);

  const [{ today, yesterday }] = useState(() => {
    const now = new Date();
    return {
      today: localDateISO(now),
      yesterday: localDateISO(subDays(now, 1)),
    };
  });
  const dayLabel = (date: string) =>
    date === today
      ? "Today"
      : date === yesterday
        ? "Yesterday"
        : currency.date(date, {
            weekday: "short",
            day: "numeric",
            month: "short",
            year: "numeric",
          });

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="pl-10 sm:pl-10"
          placeholder="Search"
          aria-label="Search transactions"
        />
      </div>

      {error && (
        <div className="space-y-3">
          <FormAlert>{error}</FormAlert>
          <Button variant="outline" onClick={() => void load()}>
            Try again
          </Button>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }, (_, index) => (
            <div
              key={index}
              className="h-16 animate-pulse rounded-2xl bg-muted"
            />
          ))}
        </div>
      ) : !groups.length && !error ? (
        <Card className="border-dashed">
          <CardContent className="flex min-h-64 flex-col items-center justify-center gap-4 text-center">
            <ReceiptText className="size-10 text-muted-foreground" />
            <h3 className="font-semibold">
              {transactions.length ? "No matches" : "No transactions yet"}
            </h3>
            {!transactions.length && (
              <Button onClick={openTransaction}>
                <Plus />
                Add transaction
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        groups.map(([date, items]) => {
          const net = items.reduce(
            (sum, item) =>
              sum +
              (item.kind === "income" ? 1 : item.kind === "expense" ? -1 : 0) *
                Number(item.amount),
            0,
          );
          return (
            <section key={date} className="space-y-1.5">
              <div className="flex items-center justify-between px-1 text-xs font-medium text-muted-foreground">
                <span>{dayLabel(date)}</span>
                <span className="money">{net ? currency.format(net) : ""}</span>
              </div>
              <Card>
                <CardContent className="divide-y p-0">
                  {items.map((item) => {
                    const tile = item.category_id
                      ? categoryById.get(item.category_id)
                      : undefined;
                    const Icon =
                      item.kind === "transfer"
                        ? ArrowLeftRight
                        : (tile?.icon ?? Tags);
                    const color = tile?.color ?? "var(--muted-foreground)";
                    const counterparty =
                      item.kind === "income" ? item.source : item.destination;
                    const account =
                      item.kind === "income" ? item.destination : item.source;
                    const title = item.merchant || tile?.label || counterparty;
                    const subtitle =
                      item.kind === "transfer"
                        ? `${item.source} → ${item.destination}`
                        : `${tile?.label ?? counterparty} · ${account}`;
                    return (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 px-4 py-3"
                      >
                        <span
                          className="grid size-10 shrink-0 place-items-center rounded-full"
                          style={{
                            color,
                            backgroundColor: `color-mix(in oklch, ${color} 14%, transparent)`,
                          }}
                        >
                          <Icon className="size-[18px]" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {title}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {subtitle}
                          </p>
                        </div>
                        {item.status !== "cleared" && (
                          <Badge variant="outline" className="capitalize">
                            {item.status}
                          </Badge>
                        )}
                        <p
                          className={`money shrink-0 text-sm font-semibold ${item.kind === "income" ? "text-emerald-600" : ""} ${item.status === "voided" ? "line-through opacity-60" : ""}`}
                        >
                          {item.kind === "income"
                            ? "+"
                            : item.kind === "expense"
                              ? "−"
                              : ""}
                          {currency.format(item.amount)}
                        </p>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </section>
          );
        })
      )}
    </div>
  );
}
