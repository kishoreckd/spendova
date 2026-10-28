import { useMemo, useState } from "react";
import { Archive, Plus, WalletCards } from "lucide-react";
import type { AccountItem } from "@/api/accounts/types";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { FormAlert } from "@/components/common/form-field";
import { PageActions } from "@/components/layout/page-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useMoney } from "@/hooks/use-money";
import { errorMessage, notifySuccess } from "@/lib/forms";
import { AccountFormDialog } from "./account-form-dialog";
import {
  accountBalance,
  accountTypeByValue,
  accountTypes,
  owesMoney,
  projectedDepositValue,
} from "./account-types";
import { useAccounts, useArchiveAccount } from "./hooks";

export default function AccountsPage() {
  const currency = useMoney();
  const accountsQuery = useAccounts();
  const archiveAccount = useArchiveAccount();
  const [open, setOpen] = useState(false);
  const [archiving, setArchiving] = useState<AccountItem | null>(null);
  const accounts = useMemo(
    () => accountsQuery.data ?? [],
    [accountsQuery.data],
  );
  const loading = accountsQuery.isPending;
  const loadError = accountsQuery.error
    ? errorMessage(accountsQuery.error, "Could not load accounts")
    : "";

  const netWorth = useMemo(
    () => accounts.reduce((sum, account) => sum + accountBalance(account), 0),
    [accounts],
  );

  return (
    <div className="space-y-6">
      <PageActions>
        <Button aria-label="Add account" onClick={() => setOpen(true)}>
          <Plus />
          <span className="hidden sm:inline">Add account</span>
        </Button>
      </PageActions>

      {!!accounts.length && (
        <Card className="border-primary/15 bg-gradient-to-br from-primary/[0.07] via-card to-card">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Net worth</p>
            <p
              className={`money mt-1 text-3xl font-semibold ${netWorth < 0 ? "text-rose-600" : ""}`}
            >
              {currency.format(netWorth)}
            </p>
          </CardContent>
        </Card>
      )}

      {loadError && (
        <div className="space-y-3">
          <FormAlert>{loadError}</FormAlert>
          <Button
            variant="outline"
            onClick={() => void accountsQuery.refetch()}
          >
            Try again
          </Button>
        </div>
      )}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[0, 1].map((item) => (
            <div
              key={item}
              className="h-20 animate-pulse rounded-2xl bg-muted"
            />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {accounts.map((account) => {
            const type =
              accountTypeByValue.get(account.account_type) ?? accountTypes[0];
            const Icon = type.icon;
            const balance = accountBalance(account);
            const projection = projectedDepositValue(account);
            return (
              <Card
                key={account.id}
                className="transition hover:border-primary/40 hover:shadow-md"
              >
                <CardContent className="flex items-center gap-4 p-5">
                  <span
                    className="grid size-11 shrink-0 place-items-center rounded-2xl"
                    style={{
                      color: type.color,
                      backgroundColor: `color-mix(in oklch, ${type.color} 14%, transparent)`,
                    }}
                  >
                    <Icon />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{account.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {type.label}
                    </p>
                    {account.institution && (
                      <p className="truncate text-xs text-muted-foreground">
                        {account.institution}
                      </p>
                    )}
                    {account.tenure_months && (
                      <p className="text-xs text-muted-foreground">
                        {account.tenure_months} months
                        {account.annual_interest_rate
                          ? ` · ${Number(account.annual_interest_rate)}% p.a.`
                          : ""}
                      </p>
                    )}
                    {projection !== null && (
                      <p className="mt-1 text-xs font-medium text-primary">
                        Est. maturity {currency.format(projection)}
                      </p>
                    )}
                  </div>
                  <p
                    className={`money font-semibold ${balance < 0 ? "text-rose-600" : ""}`}
                  >
                    {currency.format(balance)}
                    <span className="mt-0.5 block text-right text-[10px] font-normal text-muted-foreground">
                      {owesMoney(account.account_type)
                        ? "Outstanding"
                        : "Current balance"}
                    </span>
                  </p>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Archive ${account.name}`}
                    onClick={() => setArchiving(account)}
                  >
                    <Archive />
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {!loading && !accounts.length && !loadError && (
        <Card className="border-dashed">
          <CardContent className="flex min-h-52 flex-col items-center justify-center p-8 text-center">
            <WalletCards className="size-10 text-muted-foreground" />
            <h3 className="mt-3 font-semibold">No accounts yet</h3>
            <Button className="mt-4" onClick={() => setOpen(true)}>
              <Plus />
              Add first account
            </Button>
          </CardContent>
        </Card>
      )}

      <AccountFormDialog open={open} onOpenChange={setOpen} />
      <ConfirmDialog
        open={!!archiving}
        onOpenChange={(next) => !next && setArchiving(null)}
        title={`Archive ${archiving?.name ?? "this account"}?`}
        description="It will be hidden from account pickers. Transactions already recorded against it stay in your history."
        confirmLabel="Archive account"
        onConfirm={async () => {
          if (!archiving) return;
          await archiveAccount.mutateAsync(archiving.id);
          notifySuccess(`${archiving.name} archived`);
        }}
      />
    </div>
  );
}
