import { useState } from "react";
import { Check } from "lucide-react";
import type { LoanItem } from "@/api/loans/types";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { FormAlert } from "@/components/common/form-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMoney } from "@/hooks/use-money";
import { errorMessage, notifySuccess } from "@/lib/forms";
import { useCloseLoan, useLoanSchedule } from "./hooks";
import { totalOutlay } from "./loan-health";
import { LoanScheduleCharts } from "./loan-schedule-charts";
import { loanTypeTile } from "./loan-types";
import { PayEmiButton } from "./pay-emi-button";

export function LoanDetailDialog({
  loan,
  onOpenChange,
}: {
  /** The loan shown; the dialog is open while this is set. */
  loan: LoanItem | null;
  onOpenChange: (open: boolean) => void;
}) {
  const currency = useMoney();
  const scheduleQuery = useLoanSchedule(loan?.id ?? null);
  const closeLoan = useCloseLoan();
  const [closing, setClosing] = useState(false);
  const summary = loan?.summary;
  const type = loanTypeTile(loan?.loan_type ?? "other");
  const monthYear = (value: string) =>
    currency.date(value, { month: "short", year: "numeric" });

  return (
    <>
      <Dialog open={!!loan} onOpenChange={onOpenChange}>
        <DialogContent className="gap-0 overflow-y-auto overscroll-contain p-0 sm:max-w-3xl max-sm:top-0 max-sm:left-0 max-sm:h-dvh max-sm:max-h-dvh max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none">
          {loan && summary && (
            <>
              <DialogHeader className="px-4 pt-4 pb-3 sm:px-6">
                <div className="flex items-center gap-3 pr-8">
                  <span
                    className="grid size-11 shrink-0 place-items-center rounded-2xl"
                    style={{
                      color: type.color,
                      backgroundColor: `color-mix(in oklch, ${type.color} 14%, transparent)`,
                    }}
                  >
                    <type.icon />
                  </span>
                  <div className="min-w-0 text-left">
                    <DialogTitle className="truncate text-lg">
                      {loan.name}
                    </DialogTitle>
                    <DialogDescription className="truncate">
                      {[type.label, loan.lender].filter(Boolean).join(" · ")}
                    </DialogDescription>
                  </div>
                  {loan.status === "closed" && (
                    <Badge variant="secondary" className="ml-auto">
                      Closed
                    </Badge>
                  )}
                </div>
              </DialogHeader>

              <div className="space-y-5 px-4 pb-5 sm:px-6">
                <div>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="font-medium">
                      {summary.installments_paid} of {summary.tenure_months}{" "}
                      EMIs paid
                    </span>
                    <span className="money text-muted-foreground">
                      {summary.progress_percent}%
                    </span>
                  </div>
                  <Progress
                    value={summary.progress_percent}
                    aria-label={`${summary.progress_percent}% repaid`}
                    className="mt-2"
                  />
                </div>

                <dl className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                  <Stat
                    label="Borrowed"
                    value={currency.format(loan.principal, 0)}
                  />
                  <Stat label="EMI" value={currency.format(summary.emi)} />
                  <Stat
                    label={
                      summary.rate_is_estimated
                        ? "Effective rate"
                        : "Interest rate"
                    }
                    value={`${Number(summary.annual_rate).toFixed(2)}%`}
                  />
                  <Stat label="Ends" value={monthYear(summary.last_due_on)} />
                  <Stat
                    label="Total you pay"
                    value={currency.format(totalOutlay(summary), 0)}
                  />
                  <Stat
                    label="Interest + fees"
                    value={currency.format(summary.total_cost, 0)}
                  />
                  <Stat
                    label="Still owed"
                    value={currency.format(summary.outstanding_principal, 0)}
                  />
                  <Stat
                    label="Interest left"
                    value={currency.format(summary.remaining_interest, 0)}
                  />
                </dl>

                {scheduleQuery.error ? (
                  <FormAlert>
                    {errorMessage(
                      scheduleQuery.error,
                      "Could not load the schedule",
                    )}
                  </FormAlert>
                ) : !scheduleQuery.data ? (
                  <div className="h-56 animate-pulse rounded-2xl bg-muted" />
                ) : (
                  <Tabs defaultValue="graph" className="space-y-4">
                    <TabsList className="grid w-full grid-cols-2 sm:max-w-xs">
                      <TabsTrigger value="graph">Graph</TabsTrigger>
                      <TabsTrigger value="schedule">Schedule</TabsTrigger>
                    </TabsList>
                    <TabsContent value="graph">
                      <LoanScheduleCharts schedule={scheduleQuery.data} />
                    </TabsContent>
                    <TabsContent value="schedule">
                      <div className="max-h-80 overflow-auto rounded-xl border">
                        <Table>
                          <TableHeader className="sticky top-0 bg-card">
                            <TableRow>
                              <TableHead>#</TableHead>
                              <TableHead>Due</TableHead>
                              <TableHead className="text-right">EMI</TableHead>
                              <TableHead className="text-right">
                                Interest
                              </TableHead>
                              <TableHead className="text-right">
                                Principal
                              </TableHead>
                              <TableHead className="text-right">
                                Balance
                              </TableHead>
                              <TableHead className="w-8">
                                <span className="sr-only">Paid</span>
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody className="tabular-nums">
                            {scheduleQuery.data.map((row) => (
                              <TableRow
                                key={row.number}
                                className={
                                  row.paid ? "text-muted-foreground" : ""
                                }
                              >
                                <TableCell>{row.number}</TableCell>
                                <TableCell className="whitespace-nowrap">
                                  {monthYear(row.due_on)}
                                </TableCell>
                                <TableCell className="text-right">
                                  {currency.format(row.payment, 0)}
                                </TableCell>
                                <TableCell className="text-right">
                                  {currency.format(row.interest, 0)}
                                </TableCell>
                                <TableCell className="text-right">
                                  {currency.format(row.principal, 0)}
                                </TableCell>
                                <TableCell className="text-right">
                                  {currency.format(row.balance, 0)}
                                </TableCell>
                                <TableCell>
                                  {row.paid && (
                                    <Check
                                      aria-label="Paid"
                                      className="size-4 text-emerald-600"
                                    />
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </TabsContent>
                  </Tabs>
                )}
              </div>

              {loan.status === "active" && (
                <DialogFooter className="sticky bottom-0 gap-2 border-t bg-popover/95 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur sm:px-6">
                  <Button
                    variant="ghost"
                    className="sm:mr-auto"
                    onClick={() => setClosing(true)}
                  >
                    Close loan
                  </Button>
                  <PayEmiButton loan={loan} />
                </DialogFooter>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={closing}
        onOpenChange={setClosing}
        title={`Close ${loan?.name ?? "this loan"}?`}
        description="Monthly reminders stop. Payments already recorded stay in your history."
        confirmLabel="Close loan"
        onConfirm={async () => {
          if (!loan) return;
          await closeLoan.mutateAsync(loan.id);
          notifySuccess(`${loan.name} closed`);
          onOpenChange(false);
        }}
      />
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted/50 p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="money mt-0.5 truncate font-semibold">{value}</dd>
    </div>
  );
}
