import type { LoanItem } from "@/api/loans/types";
import { Button } from "@/components/ui/button";
import { useMoney } from "@/hooks/use-money";
import { localDateISO } from "@/lib/format";
import { notifyError, notifySuccess } from "@/lib/forms";
import { usePayLoan } from "./hooks";

/** Records the next EMI as an expense; hidden when the loan isn't tracked or is fully paid. */
export function PayEmiButton({
  loan,
  size,
  className,
}: {
  loan: LoanItem;
  size?: "sm" | "default";
  className?: string;
}) {
  const currency = useMoney();
  const pay = usePayLoan();
  const { summary } = loan;
  if (
    !loan.recurring_rule_id ||
    loan.status !== "active" ||
    !summary.next_payment
  )
    return null;

  async function payNow() {
    try {
      const { loan: updated } = await pay.mutateAsync({
        id: loan.id,
        paidOn: localDateISO(),
      });
      notifySuccess(
        `EMI ${updated.summary.installments_paid} of ${updated.summary.tenure_months} paid`,
        updated.summary.next_due_on
          ? `Next ${currency.date(updated.summary.next_due_on)}`
          : `${updated.name} is fully repaid`,
      );
    } catch (reason) {
      notifyError(reason, "Could not record this EMI");
    }
  }

  return (
    <Button
      size={size}
      className={className}
      loading={pay.isPending}
      onClick={(event) => {
        event.stopPropagation();
        void payNow();
      }}
    >
      Pay {currency.format(summary.next_payment, 0)}
    </Button>
  );
}
