import { useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { FormAlert } from "@/components/common/form-field";
import { LoadingScreen } from "@/components/common/loading-screen";
import type { ShellContext } from "@/components/layout/app-shell";
import { CurrencyPicker } from "@/components/common/currency-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAccounts } from "@/features/accounts/hooks";
import { useAuth } from "@/features/auth/auth-context";
import { DashboardContent } from "@/features/dashboard/dashboard-content";
import { LoansDueCard } from "@/features/loans/loans-due-card";
import { useTransactions } from "@/features/transactions/hooks";
import { formatDate, localDateISO } from "@/lib/format";
import { errorMessage } from "@/lib/forms";
import { useDashboard } from "./hooks";

export default function DashboardPage() {
  const { openTransaction } = useOutletContext<ShellContext>();
  const { profile } = useAuth();
  const [currency, setCurrency] = useState(profile?.base_currency ?? "INR");
  const [month, setMonth] = useState(() => localDateISO().slice(0, 7));
  const [account, setAccount] = useState("all");
  const accountId = account === "all" ? undefined : account;
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

  const accounts = useAccounts().data ?? [];
  const selectedAccount = accounts.find((item) => item.id === account);
  const displayCurrency = selectedAccount?.currency ?? currency;
  const summaryQuery = useDashboard(
    period.year,
    period.month,
    accountId,
    displayCurrency,
  );
  const recentQuery = useTransactions({
    limit: 5,
    status: "cleared",
    currency: displayCurrency,
    from: period.from,
    to: period.to,
    accountId,
  });
  const transactions = useMemo(
    () =>
      (recentQuery.data ?? []).map((item) => ({
        id: item.id,
        merchant:
          item.merchant ||
          (item.kind === "income" ? item.source : item.destination),
        detail: formatDate(item.occurred_on, profile?.locale || undefined, {
          day: "numeric",
          month: "short",
        }),
        amount:
          item.kind === "expense" ? -Number(item.amount) : Number(item.amount),
        transfer: item.kind === "transfer",
      })),
    [recentQuery.data, profile?.locale],
  );

  const error = summaryQuery.error ?? recentQuery.error;
  if (error)
    return (
      <div className="space-y-3">
        <FormAlert>
          {errorMessage(error, "Could not load your overview")}
        </FormAlert>
        <Button
          variant="outline"
          onClick={() =>
            void Promise.all([summaryQuery.refetch(), recentQuery.refetch()])
          }
        >
          Try again
        </Button>
      </div>
    );
  const summary = summaryQuery.data;
  if (!summary) return <LoadingScreen />;

  const isCurrentMonth = month === localDateISO().slice(0, 7);
  const periodLabel = new Intl.DateTimeFormat(profile?.locale || undefined, {
    month: "long",
    year: "numeric",
  }).format(new Date(period.year, period.month - 1, 1));

  return (
    <div className="space-y-5">
      <div className="grid gap-3 rounded-xl border bg-card p-3 min-[480px]:grid-cols-2 sm:flex sm:justify-end">
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
            <SelectTrigger className="w-full min-w-52 text-foreground">
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
      {!accountId && (
        <CurrencyPicker
          value={currency}
          currencies={accounts.map((item) => item.currency)}
          onChange={setCurrency}
        />
      )}
      {isCurrentMonth && !accountId && <LoansDueCard />}
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
