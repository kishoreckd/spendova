import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import type { ShellContext } from "@/app/app-shell";
import { LoadingScreen } from "@/components/loading-screen";
import {
  DashboardContent,
  type DashboardTransaction,
} from "@/features/dashboard/dashboard-content";
import { useAuth } from "@/features/auth/auth-context";
import {
  getDashboard,
  listTransactions,
  type DashboardSummary,
} from "@/lib/api";

export default function DashboardPage() {
  const { openTransaction } = useOutletContext<ShellContext>();
  const { profile } = useAuth();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [transactions, setTransactions] = useState<DashboardTransaction[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([getDashboard(), listTransactions(5)])
      .then(([nextSummary, recent]) => {
        if (!active) return;
        setSummary(nextSummary);
        setTransactions(
          recent.map((item) => ({
            id: item.id,
            merchant: item.merchant || item.destination,
            detail: `${item.kind} · ${item.occurred_on}`,
            amount:
              item.kind === "income"
                ? Number(item.amount)
                : -Number(item.amount),
          })),
        );
      })
      .catch(
        (reason) =>
          active &&
          setError(
            reason instanceof Error
              ? reason.message
              : "Could not load dashboard",
          ),
      );
    return () => {
      active = false;
    };
  }, []);

  if (error)
    return (
      <div
        role="alert"
        className="rounded-xl bg-destructive/10 p-4 text-sm text-destructive"
      >
        {error}
      </div>
    );
  if (!summary) return <LoadingScreen />;
  return (
    <DashboardContent
      income={Number(summary.income)}
      spending={Number(summary.spending)}
      cashFlow={Number(summary.cash_flow)}
      transactionCount={summary.transaction_count}
      categories={summary.categories.map((item) => ({
        name: item.name,
        amount: Number(item.amount),
      }))}
      transactions={transactions}
      currency={profile?.base_currency ?? "INR"}
      onPrimaryAction={openTransaction}
    />
  );
}
