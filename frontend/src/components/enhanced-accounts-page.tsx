import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Archive,
  CreditCard,
  Landmark,
  Plus,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  archiveAccount,
  createAccountRecord,
  listAccounts,
  type AccountItem,
} from "@/lib/api";

type AccountType = "bank" | "credit" | "cash" | "investment" | "loan";
const icons = {
  bank: Landmark,
  credit: CreditCard,
  cash: WalletCards,
  investment: TrendingUp,
  loan: Landmark,
};
const money = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Math.abs(value));

export function EnhancedAccountsPage() {
  const [accounts, setAccounts] = useState<AccountItem[]>([]);
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<AccountType>("bank");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(
    () =>
      listAccounts()
        .then(setAccounts)
        .catch((reason) =>
          setError(
            reason instanceof Error
              ? reason.message
              : "Could not load accounts",
          ),
        ),
    [],
  );
  useEffect(() => {
    void load();
  }, [load]);
  const netWorth = useMemo(
    () =>
      accounts.reduce(
        (sum, account) => sum + Number(account.opening_balance),
        0,
      ),
    [accounts],
  );

  async function submit(data: FormData) {
    setSaving(true);
    setError("");
    try {
      const entered = Number(data.get("balance"));
      await createAccountRecord({
        name: String(data.get("name")).trim(),
        account_type: type,
        currency: "INR",
        opening_balance:
          type === "credit" || type === "loan" ? -entered : entered,
      });
      await load();
      setOpen(false);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Could not create account",
      );
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    await archiveAccount(id);
    await load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Accounts</h2>
          <p className="text-sm text-muted-foreground">
            Add the bank accounts, cards, loans, and investments you use.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button />}>
            <Plus />
            Add account
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add an account</DialogTitle>
              <DialogDescription>
                Your card number is never required. Use a recognisable nickname.
              </DialogDescription>
            </DialogHeader>
            <form action={submit} className="space-y-4">
              <div className="space-y-2">
                <Label>Account type</Label>
                <Select
                  value={type}
                  onValueChange={(value) =>
                    value && setType(value as AccountType)
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bank">Bank account</SelectItem>
                    <SelectItem value="credit">Credit card</SelectItem>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="investment">Investment</SelectItem>
                    <SelectItem value="loan">Loan</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  name="name"
                  required
                  placeholder={
                    type === "credit"
                      ? "e.g. SBI Cashback Card"
                      : "e.g. Salary account"
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>
                  {type === "credit" || type === "loan"
                    ? "Current outstanding"
                    : "Current balance"}
                </Label>
                <Input
                  name="balance"
                  required
                  min="0"
                  step="0.01"
                  type="number"
                  placeholder="0"
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
              <DialogFooter>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </Button>
                <Button disabled={saving} type="submit">
                  {saving ? "Adding…" : "Add account"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      {error && !open && (
        <p
          role="alert"
          className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive"
        >
          {error}
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {accounts.map((account) => {
          const accountType = (
            account.account_type in icons ? account.account_type : "bank"
          ) as AccountType;
          const Icon = icons[accountType];
          const balance = Number(account.opening_balance);
          return (
            <Card
              key={account.id}
              className="transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
            >
              <CardContent className="flex items-center gap-4 p-5">
                <div className="grid size-11 place-items-center rounded-2xl bg-secondary">
                  <Icon className="text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{account.name}</p>
                  <p className="text-xs capitalize text-muted-foreground">
                    {account.account_type}
                  </p>
                </div>
                <p
                  className={`money font-semibold ${balance < 0 ? "text-rose-600" : ""}`}
                >
                  {balance < 0 ? "−" : ""}
                  {money(balance)}
                </p>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Archive ${account.name}`}
                  onClick={() => void remove(account.id)}
                >
                  <Archive />
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
      {!accounts.length && !error && (
        <Card className="border-dashed">
          <CardContent className="flex min-h-52 flex-col items-center justify-center p-8 text-center">
            <WalletCards className="size-10 text-muted-foreground" />
            <h3 className="mt-3 font-semibold">No accounts yet</h3>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Add only the accounts and cards you actually use.
            </p>
            <Button className="mt-4" onClick={() => setOpen(true)}>
              <Plus />
              Add first account
            </Button>
          </CardContent>
        </Card>
      )}
      <div className="grid gap-5 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Net worth</CardTitle>
            <CardDescription>
              Based on recorded opening balances
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p
              className={`money text-3xl font-semibold ${netWorth < 0 ? "text-rose-600" : ""}`}
            >
              {netWorth < 0 ? "−" : ""}
              {money(netWorth)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Privacy</CardTitle>
            <CardDescription>
              Only account nicknames and balances are stored.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Badge variant="secondary">
              No card or bank credentials stored
            </Badge>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
