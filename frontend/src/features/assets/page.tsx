import { useCallback, useEffect, useMemo, useState } from "react";
import { intervalToDuration } from "date-fns";
import {
  Car,
  CircleDollarSign,
  Clock3,
  Laptop,
  MoreHorizontal,
  Package,
  Plus,
  Smartphone,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  archiveAsset,
  createAsset,
  listAssets,
  type AssetItem,
} from "@/lib/api";

type AssetType = "phone" | "computer" | "vehicle" | "appliance" | "other";
const iconMap = {
  phone: Smartphone,
  computer: Laptop,
  vehicle: Car,
  appliance: Package,
  other: Package,
};
const money = (value: number, digits = 0) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);

export default function AssetInventoryPage() {
  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<AssetType>("phone");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [today] = useState(() => new Date().toISOString().slice(0, 10));
  const load = useCallback(
    () =>
      listAssets()
        .then((records) => {
          setAssets(records);
          setError("");
        })
        .catch((reason) =>
          setError(
            reason instanceof Error ? reason.message : "Could not load assets",
          ),
        )
        .finally(() => setLoading(false)),
    [],
  );
  useEffect(() => {
    void load();
  }, [load]);

  const total = useMemo(
    () => assets.reduce((sum, item) => sum + Number(item.purchase_price), 0),
    [assets],
  );
  const combinedDailyCost = useMemo(
    () => assets.reduce((sum, item) => sum + Number(item.cost_per_day), 0),
    [assets],
  );

  async function submit(data: FormData) {
    setSaving(true);
    setError("");
    try {
      await createAsset({
        name: String(data.get("name")).trim(),
        asset_type: type,
        purchase_price: Number(data.get("price")),
        purchased_on: String(data.get("purchasedOn")),
        currency: "INR",
        notes: String(data.get("notes") || ""),
      });
      await load();
      setOpen(false);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Could not save asset",
      );
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    try {
      await archiveAsset(id);
      await load();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Could not remove asset",
      );
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">My assets</h2>
          <p className="text-sm text-muted-foreground">
            See how your purchase cost reduces across every day of use.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button />}>
            <Plus />
            Add asset
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add an asset</DialogTitle>
              <DialogDescription>
                Record the product and original price. Subscriptions, insurance,
                and repairs remain expenses.
              </DialogDescription>
            </DialogHeader>
            <form action={submit} className="space-y-4">
              <div className="space-y-2">
                <Label>Asset name</Label>
                <Input name="name" required placeholder="e.g. iPhone 16" />
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select
                  value={type}
                  onValueChange={(value) =>
                    value && setType(value as AssetType)
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="phone">Phone</SelectItem>
                    <SelectItem value="computer">Computer</SelectItem>
                    <SelectItem value="vehicle">Vehicle</SelectItem>
                    <SelectItem value="appliance">Home appliance</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-3 min-[400px]:grid-cols-2">
                <div className="space-y-2">
                  <Label>Purchase price</Label>
                  <Input
                    name="price"
                    required
                    min="0.01"
                    step="0.01"
                    type="number"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Purchase date</Label>
                  <Input name="purchasedOn" required type="date" max={today} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  name="notes"
                  placeholder="Warranty, model, or condition"
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
                  {saving ? "Adding…" : "Add asset"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="overflow-hidden border-primary/15 bg-gradient-to-br from-primary/[0.07] via-card to-card">
        <CardContent className="grid p-0 sm:grid-cols-3">
          <Summary
            icon={Package}
            label="Assets owned"
            value={String(assets.length)}
          />
          <Summary
            icon={CircleDollarSign}
            label="Original amount spent"
            value={money(total)}
          />
          <Summary
            icon={Clock3}
            label="Combined cost per day"
            value={money(combinedDailyCost, 2)}
          />
        </CardContent>
      </Card>

      {error && !open && (
        <p
          role="alert"
          className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive"
        >
          {error}
        </p>
      )}
      {loading ? (
        <div className="grid gap-5 lg:grid-cols-2">
          {[0, 1].map((item) => (
            <div
              key={item}
              className="h-72 animate-pulse rounded-2xl border bg-muted/40"
            />
          ))}
        </div>
      ) : assets.length ? (
        <section className="space-y-3">
          <div>
            <h3 className="font-semibold">Your products</h3>
            <p className="text-sm text-muted-foreground">
              The daily figure becomes smaller the longer you continue using
              each product.
            </p>
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            {assets.map((asset) => {
              const assetType = (
                asset.asset_type in iconMap ? asset.asset_type : "other"
              ) as AssetType;
              const Icon = iconMap[assetType];
              return (
                <Card
                  key={asset.id}
                  className="transition hover:border-primary/40 hover:shadow-md"
                >
                  <CardContent className="p-5 sm:p-6">
                    <div className="flex items-start justify-between">
                      <div className="grid size-12 place-items-center rounded-2xl bg-secondary">
                        <Icon className="text-primary" />
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={<Button size="icon" variant="ghost" />}
                        >
                          <MoreHorizontal />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => void remove(asset.id)}
                          >
                            <Trash2 />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <h3 className="mt-4 text-xl font-semibold">{asset.name}</h3>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <Badge variant="secondary" className="capitalize">
                        {asset.asset_type}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {formatAge(asset.purchased_on)}
                      </span>
                    </div>
                    <div className="mt-5 rounded-2xl bg-primary/[0.08] p-4">
                      <div className="flex items-center gap-2 text-sm font-medium text-primary">
                        <Sparkles className="size-4" />
                        Your cost per day
                      </div>
                      <p className="money mt-1 text-3xl font-semibold">
                        {money(Number(asset.cost_per_day), 2)}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {money(Number(asset.purchase_price))} spread across{" "}
                        {asset.age_days.toLocaleString()} days of use
                      </p>
                    </div>
                    <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                      <Detail
                        label="Purchased"
                        value={new Date(
                          `${asset.purchased_on}T00:00:00`,
                        ).toLocaleDateString("en-IN", { dateStyle: "medium" })}
                      />
                      <Detail
                        label="Days owned"
                        value={asset.age_days.toLocaleString()}
                      />
                    </dl>
                    {asset.notes && (
                      <p className="mt-4 rounded-xl bg-muted p-3 text-sm text-muted-foreground">
                        {asset.notes}
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      ) : (
        !error && (
          <Card className="border-dashed">
            <CardContent className="grid min-h-56 place-items-center p-8 text-center">
              <div>
                <Package className="mx-auto size-10 text-muted-foreground" />
                <h3 className="mt-3 font-semibold">No assets yet</h3>
                <p className="text-sm text-muted-foreground">
                  Add a product to see its cost per day.
                </p>
                <Button className="mt-4" onClick={() => setOpen(true)}>
                  <Plus />
                  Add first asset
                </Button>
              </div>
            </CardContent>
          </Card>
        )
      )}
    </div>
  );
}

function formatAge(purchasedOn: string) {
  const duration = intervalToDuration({
    start: new Date(`${purchasedOn}T00:00:00`),
    end: new Date(),
  });
  const parts = [
    [duration.years, "year"],
    [duration.months, "month"],
    [duration.days, "day"],
  ] as const;
  const text = parts
    .filter(([value]) => value)
    .map(([value, unit]) => `${value} ${unit}${value === 1 ? "" : "s"}`)
    .join(" ");
  return text ? `${text} old` : "Bought today";
}

function Summary({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Package;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-4 border-b p-5 last:border-b-0 sm:border-r sm:border-b-0 sm:last:border-r-0">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-background text-primary shadow-sm">
        <Icon className="size-5" />
      </span>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="money truncate text-xl font-semibold">{value}</p>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-muted/20 p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="money mt-1 font-medium">{value}</dd>
    </div>
  );
}
