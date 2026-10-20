import { useCallback, useEffect, useMemo, useState } from "react";
import { intervalToDuration } from "date-fns";
import {
  Car,
  Laptop,
  MoreHorizontal,
  Package,
  Plus,
  Smartphone,
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
  const [today] = useState(() => new Date().toISOString().slice(0, 10));
  const load = useCallback(
    () =>
      listAssets()
        .then(setAssets)
        .catch((reason) =>
          setError(
            reason instanceof Error ? reason.message : "Could not load assets",
          ),
        ),
    [],
  );
  useEffect(() => {
    void load();
  }, [load]);
  const total = useMemo(
    () => assets.reduce((sum, item) => sum + Number(item.purchase_price), 0),
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
    await archiveAsset(id);
    await load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">My assets</h2>
          <p className="text-sm text-muted-foreground">
            Keep a simple record of products you own. Related costs stay in
            Expenses.
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
                Record the product and its original price. Subscriptions and
                repairs remain expenses.
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
      <div className="grid gap-4 sm:grid-cols-3">
        <Summary label="Assets recorded" value={String(assets.length)} />
        <Summary label="Original purchase value" value={money(total)} />
        <Summary
          label="Oldest asset"
          value={
            assets.length
              ? [...assets].sort((a, b) =>
                  a.purchased_on.localeCompare(b.purchased_on),
                )[0].name
              : "—"
          }
        />
      </div>
      {error && !open && (
        <p
          role="alert"
          className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive"
        >
          {error}
        </p>
      )}
      {assets.length ? (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
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
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="grid size-11 place-items-center rounded-2xl bg-secondary">
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
                  <h3 className="mt-4 text-lg font-semibold">{asset.name}</h3>
                  <div className="mt-1 flex items-center gap-2">
                    <Badge variant="secondary" className="capitalize">
                      {asset.asset_type}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {formatAge(asset.purchased_on)}
                    </span>
                  </div>
                  <dl className="mt-5 space-y-2 text-sm">
                    <Row
                      label="Purchase price"
                      value={money(Number(asset.purchase_price))}
                    />
                    <Row
                      label="Purchased"
                      value={new Date(
                        `${asset.purchased_on}T00:00:00`,
                      ).toLocaleDateString("en-IN", { dateStyle: "medium" })}
                    />
                    <Row label="Days used" value={`${asset.age_days} days`} />
                    <Row
                      label="Cost per day"
                      value={money(Number(asset.cost_per_day), 2)}
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
      ) : (
        !error && (
          <Card className="border-dashed">
            <CardContent className="grid min-h-56 place-items-center p-8 text-center">
              <div>
                <Package className="mx-auto size-10 text-muted-foreground" />
                <h3 className="mt-3 font-semibold">No assets yet</h3>
                <p className="text-sm text-muted-foreground">
                  Add a product you own.
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
function Summary({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="money mt-2 text-2xl font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="money text-right font-medium">{value}</dd>
    </div>
  );
}
