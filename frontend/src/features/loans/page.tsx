import { useMemo, useState } from "react";
import { Landmark, Plus } from "lucide-react";
import { FormAlert } from "@/components/common/form-field";
import { PageActions } from "@/components/layout/page-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { errorMessage } from "@/lib/forms";
import { useLoans, useLoansOverview } from "./hooks";
import { LoanCard } from "./loan-card";
import { LoanDetailDialog } from "./loan-detail-dialog";
import { LoanFormDialog } from "./loan-form-dialog";
import { LoansOverview } from "./loans-overview";

export default function LoansPage() {
  const [view, setView] = useState<"active" | "closed">("active");
  const loansQuery = useLoans(true);
  const overviewQuery = useLoansOverview();
  const [formOpen, setFormOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const loans = useMemo(() => loansQuery.data ?? [], [loansQuery.data]);
  const visible = loans.filter((item) => item.status === view);
  const closedCount =
    loans.length - loans.filter((item) => item.status === "active").length;
  // Look the open loan up from the cache so it refreshes after a payment.
  const openLoan = loans.find((item) => item.id === openId) ?? null;

  return (
    <div className="space-y-6">
      <PageActions>
        <Button aria-label="Add loan or EMI" onClick={() => setFormOpen(true)}>
          <Plus />
          <span className="hidden sm:inline">Add loan or EMI</span>
        </Button>
      </PageActions>

      {loansQuery.error && (
        <div className="space-y-3">
          <FormAlert>
            {errorMessage(loansQuery.error, "Could not load your loans")}
          </FormAlert>
          <Button variant="outline" onClick={() => void loansQuery.refetch()}>
            Try again
          </Button>
        </div>
      )}

      {loansQuery.isPending ? (
        <div className="space-y-3">
          <div className="h-36 animate-pulse rounded-2xl bg-muted" />
          <div className="grid gap-4 md:grid-cols-2">
            {[0, 1].map((item) => (
              <div
                key={item}
                className="h-44 animate-pulse rounded-2xl bg-muted"
              />
            ))}
          </div>
        </div>
      ) : !loans.length && !loansQuery.error ? (
        <Card className="border-dashed">
          <CardContent className="flex min-h-64 flex-col items-center justify-center gap-4 p-8 text-center">
            <span className="rounded-2xl bg-primary/10 p-4 text-primary">
              <Landmark className="size-8" />
            </span>
            <h2 className="font-semibold">No loans or EMIs yet</h2>
            <Button onClick={() => setFormOpen(true)}>
              <Plus /> Add loan or EMI
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {overviewQuery.data && overviewQuery.data.active_loans > 0 && (
            <LoansOverview overview={overviewQuery.data} />
          )}
          {closedCount > 0 && (
            <Tabs
              value={view}
              onValueChange={(value) => setView(value as "active" | "closed")}
            >
              <TabsList className="grid w-full max-w-xs grid-cols-2">
                <TabsTrigger value="active">Active</TabsTrigger>
                <TabsTrigger value="closed">Closed · {closedCount}</TabsTrigger>
              </TabsList>
            </Tabs>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            {visible.map((loan) => (
              <LoanCard
                key={loan.id}
                loan={loan}
                onOpen={() => setOpenId(loan.id)}
              />
            ))}
          </div>
        </>
      )}

      <LoanFormDialog open={formOpen} onOpenChange={setFormOpen} />
      <LoanDetailDialog
        loan={openLoan}
        onOpenChange={(open) => !open && setOpenId(null)}
      />
    </div>
  );
}
