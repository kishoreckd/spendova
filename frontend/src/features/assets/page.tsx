import { useMemo, useState } from "react";
import {
  BadgeCheck,
  CircleDollarSign,
  Clock3,
  Flag,
  MoreHorizontal,
  Package,
  Pencil,
  Plus,
  Target,
  Trash2,
  TrendingDown,
} from "lucide-react";
import { cn } from "cn";
import { PageActions } from "@/components/layout/page-actions";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FormAlert } from "@/components/common/form-field";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { useMoney } from "@/hooks/use-money";
import type { AssetItem } from "@/api/assets/types";
import { errorMessage, notifySuccess } from "@/lib/forms";
import { AssetFormDialog } from "./asset-form-dialog";
import { describeAge, describeLife } from "./asset-goal";
import { assetTypeTile } from "./asset-types";
import { useArchiveAsset, useAssets } from "./hooks";

export default function AssetInventoryPage() {
  const currency = useMoney();
  const assetsQuery = useAssets();
  const archiveAsset = useArchiveAsset();
  const [editing, setEditing] = useState<AssetItem | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [removing, setRemoving] = useState<AssetItem | null>(null);
  const assets = useMemo(() => assetsQuery.data ?? [], [assetsQuery.data]);
  const loading = assetsQuery.isPending;
  const loadError = assetsQuery.error
    ? errorMessage(assetsQuery.error, "Could not load your assets")
    : "";
  const load = assetsQuery.refetch;

  const totals = useMemo(
    () => ({
      paid: assets.reduce((sum, item) => sum + Number(item.purchase_price), 0),
      daily: assets.reduce((sum, item) => sum + Number(item.cost_per_day), 0),
      withGoal: assets.filter((item) => item.replacement_goal).length,
      reached: assets.filter((item) => item.replacement_goal?.reached).length,
    }),
    [assets],
  );
  const usedTypes = useMemo(
    () => assets.map((item) => item.asset_type),
    [assets],
  );

  function openForm(asset: AssetItem | null) {
    setEditing(asset);
    setFormOpen(true);
  }

  function onSaved(saved: AssetItem, created: boolean) {
    notifySuccess(
      created ? `${saved.name} added` : `${saved.name} updated`,
      `Costs you ${currency.format(saved.cost_per_day)} per day so far.`,
    );
  }

  return (
    <div className="space-y-6">
      <PageActions>
        <Button aria-label="Add asset" onClick={() => openForm(null)}>
          <Plus />
          <span className="hidden sm:inline">Add asset</span>
        </Button>
      </PageActions>

      <Card className="overflow-hidden border-primary/15 bg-gradient-to-br from-primary/[0.07] via-card to-card">
        <CardContent className="grid grid-cols-2 p-0 lg:grid-cols-4">
          <Summary
            icon={Package}
            label="Assets owned"
            value={String(assets.length)}
          />
          <Summary
            icon={CircleDollarSign}
            label="Total paid"
            value={currency.format(totals.paid, 0)}
          />
          <Summary
            icon={Clock3}
            label="Combined cost per day"
            value={currency.format(totals.daily)}
          />
          <Summary
            icon={BadgeCheck}
            label="Paid for themselves"
            value={
              totals.withGoal
                ? `${totals.reached} of ${totals.withGoal}`
                : "No goals yet"
            }
          />
        </CardContent>
      </Card>

      {loadError && (
        <div className="space-y-3">
          <FormAlert>{loadError}</FormAlert>
          <Button variant="outline" onClick={() => void load()}>
            Try again
          </Button>
        </div>
      )}

      {loading ? (
        <div className="grid gap-5 lg:grid-cols-2">
          {[0, 1].map((item) => (
            <div
              key={item}
              className="h-80 animate-pulse rounded-2xl border bg-muted/40"
            />
          ))}
        </div>
      ) : assets.length ? (
        <div className="grid gap-5 lg:grid-cols-2">
          {assets.map((asset) => (
            <AssetCard
              key={asset.id}
              asset={asset}
              onEdit={() => openForm(asset)}
              onRemove={() => setRemoving(asset)}
            />
          ))}
        </div>
      ) : (
        !loadError && (
          <Card className="border-dashed">
            <CardContent className="grid min-h-64 place-items-center p-8 text-center">
              <div className="max-w-sm">
                <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary">
                  <Package className="size-7" />
                </span>
                <h3 className="mt-4 font-semibold">No assets yet</h3>
                <Button className="mt-5" onClick={() => openForm(null)}>
                  <Plus />
                  Add first asset
                </Button>
              </div>
            </CardContent>
          </Card>
        )
      )}

      <AssetFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        asset={editing}
        usedTypes={usedTypes}
        onSaved={onSaved}
      />
      <ConfirmDialog
        open={!!removing}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={`Remove ${removing?.name ?? "this asset"}?`}
        description="It will no longer appear in your assets or daily cost totals. Expenses you recorded for it are kept."
        confirmLabel="Remove asset"
        onConfirm={async () => {
          if (!removing) return;
          await archiveAsset.mutateAsync(removing.id);
          notifySuccess(`${removing.name} removed`);
        }}
      />
    </div>
  );
}

function AssetCard({
  asset,
  onEdit,
  onRemove,
}: {
  asset: AssetItem;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const currency = useMoney();
  const type = assetTypeTile(asset.asset_type);
  const Icon = type.icon;
  const goal = asset.replacement_goal;
  return (
    <Card className="transition hover:border-primary/40 hover:shadow-md">
      <CardContent className="space-y-5 p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span
            className="grid size-12 shrink-0 place-items-center rounded-2xl"
            style={{
              color: type.color,
              backgroundColor: `color-mix(in oklch, ${type.color} 14%, transparent)`,
            }}
          >
            <Icon />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-lg font-semibold">{asset.name}</h3>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <Badge variant="secondary">{type.label}</Badge>
              <span>
                {describeAge(asset.age_days)} ·{" "}
                {asset.age_days.toLocaleString()} days
              </span>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Actions for ${asset.name}`}
                />
              }
            >
              <MoreHorizontal />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}>
                <Pencil />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onClick={onRemove}>
                <Trash2 />
                Remove
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="rounded-2xl bg-primary/[0.08] p-4">
          <p className="flex items-center gap-1.5 text-sm font-medium text-primary">
            <TrendingDown className="size-4" />
            Cost per day so far
          </p>
          <p className="money mt-1 text-3xl font-semibold">
            {currency.format(asset.cost_per_day)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {currency.format(asset.purchase_price, 0)} · bought{" "}
            {currency.date(asset.purchased_on)}
          </p>
        </div>

        {goal ? (
          <div
            className={cn(
              "space-y-3 rounded-2xl border p-4",
              goal.reached && "border-emerald-500/30 bg-emerald-500/[0.06]",
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs text-muted-foreground">
                  {asset.expected_life_months
                    ? `Goal · ${describeLife(asset.expected_life_months)} of use`
                    : "Goal · your daily cost target"}
                </p>
                <p className="money font-semibold">
                  {currency.format(goal.target_cost_per_day)} per day
                </p>
              </div>
              <span
                className={cn(
                  "money text-sm font-semibold",
                  goal.reached ? "text-emerald-600" : "text-primary",
                )}
              >
                {goal.progress_percent}%
              </span>
            </div>
            <Progress
              value={goal.progress_percent}
              aria-label={`${goal.progress_percent}% of the way to your goal`}
              className={cn(
                goal.reached &&
                  "[&_[data-slot=progress-indicator]]:bg-emerald-500",
              )}
            />
            {goal.reached ? (
              <p className="flex items-start gap-2 text-sm">
                <BadgeCheck className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                <span>
                  Goal reached on{" "}
                  <strong>{currency.date(goal.reached_on)}</strong>
                </span>
              </p>
            ) : (
              <p className="flex items-start gap-2 text-sm text-muted-foreground">
                <Flag className="mt-0.5 size-4 shrink-0 text-primary" />
                <span>
                  <strong className="text-foreground">
                    {goal.days_remaining.toLocaleString()} days to go
                  </strong>{" "}
                  · reached on {currency.date(goal.reached_on)}
                </span>
              </p>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={onEdit}
            className="flex w-full items-center gap-3 rounded-2xl border border-dashed p-4 text-left transition hover:border-primary/50 hover:bg-primary/[0.03]"
          >
            <Target className="size-5 shrink-0 text-primary" />
            <span className="flex-1 text-sm font-medium">
              Set a replacement goal
            </span>
          </button>
        )}

        {asset.notes && (
          <p className="rounded-xl bg-muted p-3 text-sm text-muted-foreground">
            {asset.notes}
          </p>
        )}
      </CardContent>
    </Card>
  );
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
    <div className="flex items-center gap-3 border-b border-r p-4 even:border-r-0 sm:p-5 lg:border-b-0 lg:even:border-r lg:last:border-r-0 [&:nth-last-child(-n+2)]:border-b-0">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-background text-primary shadow-sm">
        <Icon className="size-5" />
      </span>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="money truncate text-lg font-semibold sm:text-xl">
          {value}
        </p>
      </div>
    </div>
  );
}
