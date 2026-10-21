import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import type { ShellContext } from "@/app/app-shell";
import { LoadingScreen } from "@/components/loading-screen";
import { TRANSACTIONS_CHANGED } from "@/components/transaction-sheet";
import { FormAlert } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDate, localDateISO } from "@/lib/format";
import { errorMessage } from "@/lib/forms";
import {
  DashboardContent,
  type DashboardTransaction,
} from "@/features/dashboard/dashboard-content";
import { useAuth } from "@/features/auth/auth-context";
import {
  getDashboard,
  listAccounts,
  listTransactions,
  type AccountItem,
  type DashboardSummary,
} from "@/lib/api";

export default function DashboardPage() {
  const { openTransaction } = useOutletContext<ShellContext>();
  const { profile } = useAuth();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [transactions, setTransactions] = useState<DashboardTransaction[]>([]);
  const [accounts, setAccounts] = useState<AccountItem[]>([]);
  const [month, setMonth] = useState(() => localDateISO().slice(0, 7));
  const [account, setAccount] = useState("all");
  const [error, setError] = useState("");
  const period = useMemo(() => {
    const [year, monthNumber] = month.split("-").map(Number);
    const lastDay = new Date(year, monthNumber, 0).getDate();
    return {
      year,
      month: monthNumber,
      from: `${month}-01`,
      to: `${month}-${String(lastDay).padStart(2, "0")}`,
    };
  }, [month]);

  useEffect(() => {
    listAccounts()
      .then(setAccounts)
      .catch(() => setAccounts([]));
  }, []);

  useEffect(() => {
    let active = true;
    const load = () =>
      Promise.all([
        getDashboard(
          period.year,
          period.month,
          account === "all" ? undefined : account,
        ),
        listTransactions(5, {
          from: period.from,
          to: period.to,
          accountId: account === "all" ? undefined : account,
        }),
      ])
        .then(([nextSummary, recent]) => {
          if (!active) return;
          setSummary(nextSummary);
          setError("");
          setTransactions(
            recent.map((item) => ({
              id: item.id,
              merchant:
                item.merchant ||
                (item.kind === "income" ? item.source : item.destination),
              detail: formatDate(
                item.occurred_on,
                profile?.locale || undefined,
                {
                  day: "numeric",
                  month: "short",
                },
              ),
              amount:
                item.kind === "expense"
                  ? -Number(item.amount)
                  : Number(item.amount),
              transfer: item.kind === "transfer",
            })),
          );
        })
        .catch(
          (reason) =>
            active &&
            setError(errorMessage(reason, "Could not load your overview")),
        );
    void load();
    window.addEventListener(TRANSACTIONS_CHANGED, load);
    return () => {
      active = false;
      window.removeEventListener(TRANSACTIONS_CHANGED, load);
    };
  }, [profile?.locale, period, account]);

  if (error) return <FormAlert>{error}</FormAlert>;
  if (!summary) return <LoadingScreen />;
  const selectedAccount = accounts.find((item) => item.id === account);
  const displayCurrency =
    selectedAccount?.currency ?? profile?.base_currency ?? "INR";
  const periodLabel = new Intl.DateTimeFormat(profile?.locale || undefined, {
    month: "long",
    year: "numeric",
  }).format(new Date(period.year, period.month - 1, 1));
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 rounded-xl border bg-card p-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold">Monthly overview</p>
          <p className="text-xs text-muted-foreground">
            Income, spending, and activity for the selected month.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-xs font-medium text-muted-foreground">
            Month
            <Input
              type="month"
              value={month}
              max={localDateISO().slice(0, 7)}
              onChange={(event) =>
                event.target.value && setMonth(event.target.value)
              }
              className="min-w-44 text-foreground"
            />
          </label>
          <label className="space-y-1 text-xs font-medium text-muted-foreground">
            Account
            <Select
              value={account}
              onValueChange={(value) => value && setAccount(value)}
            >
              <SelectTrigger className="min-w-52 text-foreground">
                <SelectValue>
                  {selectedAccount
                    ? `${selectedAccount.name} · ${selectedAccount.currency}`
                    : "All accounts"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All accounts</SelectItem>
                {accounts.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name} · {item.currency}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
        </div>
      </div>
      <DashboardContent
        income={Number(summary.income)}
        spending={Number(summary.spending)}
        cashFlow={Number(summary.cash_flow)}
        transactionCount={summary.transaction_count}
        categories={summary.categories.map((item) => ({
          name: item.name,
          amount: Number(item.amount),
          color: item.color,
        }))}
        transactions={transactions}
        currency={displayCurrency}
        periodLabel={periodLabel}
        onPrimaryAction={openTransaction}
      />
    </div>
  );
}
