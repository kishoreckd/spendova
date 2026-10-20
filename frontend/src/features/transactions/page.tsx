import { useCallback, useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Plus, ReceiptText, Search, Upload } from "lucide-react";
import type { ShellContext } from "@/app/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/features/auth/auth-context";
import { listTransactions, type TransactionItem } from "@/lib/api";

export default function TransactionsPage() {
  const { openTransaction } = useOutletContext<ShellContext>();
  const { profile } = useAuth();
  const [query, setQuery] = useState("");
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [error, setError] = useState("");
  const currency = profile?.base_currency ?? "INR";
  const money = (value: number) =>
    new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(Math.abs(value));
  const load = useCallback(
    () =>
      listTransactions(200)
        .then(setTransactions)
        .catch((reason) =>
          setError(
            reason instanceof Error
              ? reason.message
              : "Could not load transactions",
          ),
        ),
    [],
  );

  useEffect(() => {
    void load();
    window.addEventListener("spendova:transactions", load);
    return () => window.removeEventListener("spendova:transactions", load);
  }, [load]);

  const rows = transactions.filter((item) =>
    `${item.merchant ?? ""} ${item.destination} ${item.source} ${item.kind}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>All transactions</CardTitle>
          <CardDescription>
            Search and inspect your recorded money movements.
          </CardDescription>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled
            title="CSV import is not enabled yet"
          >
            <Upload />
            <span className="hidden sm:inline">Import</span>
          </Button>
          <Button onClick={openTransaction}>
            <Plus />
            <span className="hidden sm:inline">Add</span>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="relative mb-4">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="pl-10 sm:pl-10"
            placeholder="Search merchant, account, or type"
          />
        </div>
        {error && (
          <p
            role="alert"
            className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive"
          >
            {error}
          </p>
        )}
        {!error && !rows.length ? (
          <div className="flex min-h-64 flex-col items-center justify-center text-center">
            <ReceiptText className="size-10 text-muted-foreground" />
            <h3 className="mt-4 font-semibold">
              {transactions.length
                ? "No matching transactions"
                : "No transactions yet"}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {transactions.length
                ? "Try another search."
                : "Add your first income or expense to get started."}
            </p>
            {!transactions.length && (
              <Button className="mt-4" onClick={openTransaction}>
                <Plus />
                Add transaction
              </Button>
            )}
          </div>
        ) : (
          rows.map((item) => {
            const amount =
              item.kind === "income"
                ? Number(item.amount)
                : -Number(item.amount);
            return (
              <div
                key={item.id}
                className="flex items-center gap-3 border-b py-3 last:border-0"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {item.merchant || item.destination}
                  </p>
                  <p className="truncate text-xs capitalize text-muted-foreground">
                    {item.kind} · {item.source} ·{" "}
                    {new Date(item.occurred_on).toLocaleDateString()}
                  </p>
                </div>
                <Badge variant="outline" className="capitalize">
                  {item.status}
                </Badge>
                <p
                  className={`money text-sm font-semibold ${amount > 0 ? "text-emerald-600" : ""}`}
                >
                  {amount > 0 ? "+" : "−"}
                  {money(amount)}
                </p>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
