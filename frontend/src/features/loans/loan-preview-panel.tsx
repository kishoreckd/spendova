import { Calculator } from "lucide-react";
import type { LoanSummary } from "@/api/loans/types";
import { Badge } from "@/components/ui/badge";
import { useMoney } from "@/hooks/use-money";
import { errorMessage } from "@/lib/forms";
import { totalOutlay } from "./loan-health";

/** Live EMI, interest and total cost for the terms being entered. */
export function LoanPreviewPanel({
  summary,
  loading,
  error,
}: {
  summary?: LoanSummary;
  loading: boolean;
  error: unknown;
}) {
  const currency = useMoney();
  if (error)
    return (
      <p
        role="status"
        className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive"
      >
        {errorMessage(error, "These terms don't add up")}
      </p>
    );
  if (!summary)
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-dashed p-4 text-muted-foreground">
        <Calculator className="size-5 shrink-0" />
        <span className="text-sm">Monthly EMI</span>
        <span className="money ml-auto font-semibold">
          {loading ? "…" : "—"}
        </span>
      </div>
    );

  return (
    <section
      aria-live="polite"
      aria-busy={loading}
      className="space-y-4 rounded-2xl bg-gradient-to-br from-slate-900 to-teal-950 p-4 text-white transition-opacity aria-busy:opacity-70 sm:p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-slate-300">Monthly EMI</p>
          <p className="money mt-0.5 text-3xl font-semibold">
            {currency.format(summary.emi)}
          </p>
        </div>
        <Badge variant="secondary" className="shrink-0 bg-white/15 text-white">
          {Number(summary.annual_rate).toFixed(2)}% p.a.
          {summary.rate_is_estimated && " · effective"}
        </Badge>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <Figure
          label="Total interest"
          value={currency.format(summary.total_interest, 0)}
        />
        <Figure
          label="Total you pay"
          value={currency.format(totalOutlay(summary), 0)}
        />
        <Figure
          label="Extra over the amount"
          value={currency.format(summary.total_cost, 0)}
        />
        <Figure
          label="Last EMI"
          value={currency.date(summary.last_due_on, {
            month: "short",
            year: "numeric",
          })}
        />
        {summary.installments_paid > 0 && (
          <>
            <Figure
              label="EMIs paid"
              value={`${summary.installments_paid} of ${summary.tenure_months}`}
            />
            <Figure
              label="Still owed"
              value={currency.format(summary.outstanding_principal, 0)}
            />
          </>
        )}
      </div>
    </section>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/10 p-3">
      <p className="text-xs text-slate-300">{label}</p>
      <p className="money mt-0.5 truncate font-semibold">{value}</p>
    </div>
  );
}
