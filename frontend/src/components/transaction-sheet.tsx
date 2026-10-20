import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  createTransaction,
  listAccounts,
  listCategories,
  type AccountItem,
  type CategoryItem,
} from "@/lib/api";

type Kind = "expense" | "income" | "transfer";
type Props = {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  onSaved?: () => void;
};

export function TransactionSheet({ open, onOpenChange, onSaved }: Props) {
  const navigate = useNavigate();
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [kind, setKind] = useState<Kind>("expense");
  const [category, setCategory] = useState("");
  const [account, setAccount] = useState("");
  const [accounts, setAccounts] = useState<AccountItem[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [today] = useState(() => new Date().toISOString().slice(0, 10));

  useEffect(() => {
    if (!open) return;
    Promise.all([listAccounts(), listCategories()])
      .then(([nextAccounts, nextCategories]) => {
        setAccounts(nextAccounts);
        setCategories(nextCategories);
        setAccount((current) => current || nextAccounts[0]?.name || "");
        const matching = nextCategories.filter(
          (item) =>
            item.category_type === (kind === "income" ? "income" : "expense"),
        );
        setCategory(matching[0]?.id || "");
      })
      .catch(() => undefined);
  }, [open, kind]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const data = new FormData(event.currentTarget);
    const selectedCategory = categories.find((item) => item.id === category);
    try {
      await createTransaction({
        kind,
        amount: Number(data.get("amount")),
        source:
          kind === "income" ? (selectedCategory?.name ?? "Income") : account,
        destination:
          kind === "income" ? account : (selectedCategory?.name ?? "Expense"),
        merchant: String(data.get("merchant") || ""),
        occurred_on: String(data.get("date")),
        currency: "INR",
        category_id: category || undefined,
      });
      setSaved(true);
      window.dispatchEvent(new CustomEvent("spendova:transactions"));
      onSaved?.();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Could not save transaction. Is the API running?",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(value) => {
        onOpenChange(value);
        if (!value) {
          setSaved(false);
          setError("");
        }
      }}
    >
      <SheetContent
        side="bottom"
        className="mx-auto max-h-[calc(100dvh-env(safe-area-inset-top)-0.5rem)] max-w-2xl overflow-y-auto overscroll-contain rounded-t-3xl px-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-5"
      >
        <SheetHeader>
          <SheetTitle>Add transaction</SheetTitle>
          <SheetDescription>
            Record money in, money out, or a transfer.
          </SheetDescription>
        </SheetHeader>
        {saved ? (
          <div className="my-10 text-center">
            <div className="mx-auto mb-4 grid size-14 place-items-center rounded-full bg-emerald-100 text-2xl text-emerald-700">
              ✓
            </div>
            <h3 className="text-lg font-semibold">Transaction saved</h3>
            <p className="text-sm text-muted-foreground">
              Balances and reports are updated.
            </p>
            <Button className="mt-5" onClick={() => onOpenChange(false)}>
              Done
            </Button>
          </div>
        ) : (
          <form className="space-y-5 py-5" onSubmit={submit}>
            <Tabs
              value={kind}
              onValueChange={(value) => setKind(value as Kind)}
            >
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="expense">Expense</TabsTrigger>
                <TabsTrigger value="income">Income</TabsTrigger>
                <TabsTrigger value="transfer">Transfer</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="space-y-2">
              <Label htmlFor="amount">Amount</Label>
              <div className="flex h-10 overflow-hidden rounded-lg border border-input bg-transparent focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
                <span className="grid w-11 shrink-0 place-items-center border-r bg-muted/50 text-muted-foreground">
                  ₹
                </span>
                <Input
                  name="amount"
                  id="amount"
                  required
                  min="0.01"
                  step="0.01"
                  type="number"
                  placeholder="0.00"
                  className="h-full rounded-none border-0 text-lg font-semibold shadow-none focus-visible:ring-0"
                />
              </div>
            </div>
            <div className="grid gap-4 min-[400px]:grid-cols-2">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Category</Label>
                  <button
                    type="button"
                    className="text-xs font-medium text-primary hover:underline"
                    onClick={() => {
                      onOpenChange(false);
                      navigate("/categories");
                    }}
                  >
                    Add category
                  </button>
                </div>
                <Select
                  value={category}
                  onValueChange={(value) => value && setCategory(value)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select category">
                      {categories.find((item) => item.id === category)?.name}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {categories
                      .filter(
                        (item) =>
                          item.category_type ===
                          (kind === "income" ? "income" : "expense"),
                      )
                      .map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Account</Label>
                <Select
                  value={account}
                  onValueChange={(value) => value && setAccount(value)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select account" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((item) => (
                      <SelectItem key={item.id} value={item.name}>
                        {item.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="merchant">Merchant or payee</Label>
              <Input
                name="merchant"
                id="merchant"
                placeholder="Where did you spend?"
              />
            </div>
            <div className="space-y-2">
              <div className="space-y-2">
                <Label htmlFor="date">Date</Label>
                <Input name="date" id="date" type="date" defaultValue={today} />
              </div>
            </div>
            {error && (
              <p
                role="alert"
                className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive"
              >
                {error}
              </p>
            )}
            <SheetFooter>
              <Button
                disabled={saving || !account || !category}
                className="w-full"
              >
                {saving ? "Saving…" : "Save transaction"}
              </Button>
            </SheetFooter>
          </form>
        )}
      </SheetContent>
    </Sheet>
  );
}
