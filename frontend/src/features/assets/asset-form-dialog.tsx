import { useEffect, useMemo, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarCheck2 } from "lucide-react";
import { z } from "zod";
import { DatePicker } from "@/components/common/date-picker";
import { MoneyInput } from "@/components/common/money-input";
import { TilePicker } from "@/components/common/tile-picker";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FormAlert } from "@/components/common/form-field";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useMoney } from "@/hooks/use-money";
import type { AssetInput, AssetItem } from "@/api/assets/types";
import { localDateISO } from "@/lib/format";
import {
  applyServerErrors,
  controlProps,
  money,
  optionalMoney,
  pastOrToday,
  requiredText,
} from "@/lib/forms";
import { describeLife, previewGoal, type GoalMode } from "./asset-goal";
import { assetTypeTiles } from "./asset-types";
import { useSaveAsset } from "./hooks";

const WHOLE_NUMBER = /^\d*$/;

const schema = z
  .object({
    name: requiredText("Enter what you bought", 120),
    assetType: z.string().min(1, "Choose a type"),
    price: money("the purchase price"),
    purchasedOn: pastOrToday("Choose the purchase date"),
    goalMode: z.enum(["none", "life", "daily"]),
    lifeYears: z.string().trim(),
    lifeMonths: z.string().trim(),
    dailyTarget: optionalMoney(),
    notes: z.string().trim().max(500, "Keep notes under 500 characters"),
  })
  .superRefine((value, context) => {
    const issue = (path: string, message: string) =>
      context.addIssue({ code: "custom", path: [path], message });
    if (value.goalMode === "life") {
      const years = Number(value.lifeYears || 0);
      const months = Number(value.lifeMonths || 0);
      if (!WHOLE_NUMBER.test(value.lifeYears) || years > 50)
        issue("lifeYears", "Use 0 to 50 years");
      else if (!WHOLE_NUMBER.test(value.lifeMonths) || months > 11)
        issue("lifeMonths", "Use 0 to 11 months");
      else if (years * 12 + months < 1)
        issue("lifeYears", "Enter how long you expect to use it");
    }
    if (value.goalMode === "daily") {
      if (!value.dailyTarget)
        issue("dailyTarget", "Enter the daily cost you'd be happy with");
      else if (Number(value.dailyTarget) >= Number(value.price))
        issue("dailyTarget", "Choose an amount below the purchase price");
    }
  });
type Values = z.input<typeof schema>;

const serverFields = {
  name: "name",
  asset_type: "assetType",
  purchase_price: "price",
  purchased_on: "purchasedOn",
  expected_life_months: "lifeYears",
  target_cost_per_day: "dailyTarget",
  notes: "notes",
} as const;

function initialValues(asset?: AssetItem | null): Values {
  const months = asset?.expected_life_months ?? 0;
  return {
    name: asset?.name ?? "",
    assetType: asset?.asset_type ?? "phone",
    price: asset ? String(Number(asset.purchase_price)) : "",
    purchasedOn: asset?.purchased_on ?? "",
    goalMode: asset?.expected_life_months
      ? "life"
      : asset?.target_cost_per_day
        ? "daily"
        : "none",
    lifeYears: months ? String(Math.floor(months / 12)) : "",
    lifeMonths: months % 12 ? String(months % 12) : "",
    dailyTarget: asset?.target_cost_per_day
      ? String(Number(asset.target_cost_per_day))
      : "",
    notes: asset?.notes ?? "",
  };
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The asset to edit; omit to add a new one. */
  asset?: AssetItem | null;
  usedTypes: string[];
  onSaved: (asset: AssetItem, created: boolean) => void;
};

export function AssetFormDialog({
  open,
  onOpenChange,
  asset,
  usedTypes,
  onSaved,
}: Props) {
  const currency = useMoney();
  const saveAsset = useSaveAsset();
  const [formError, setFormError] = useState("");
  const [extraTypes, setExtraTypes] = useState<string[]>([]);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: initialValues(asset),
    mode: "onTouched",
  });
  const { errors, isSubmitting } = form.formState;
  const watched = useWatch({ control: form.control });

  useEffect(() => {
    if (open) form.reset(initialValues(asset));
  }, [open, asset, form]);

  function changeOpen(next: boolean) {
    if (!next) setFormError("");
    onOpenChange(next);
  }

  const tiles = useMemo(
    () => assetTypeTiles([...usedTypes, ...extraTypes]),
    [usedTypes, extraTypes],
  );

  const lifeMonths =
    Number(watched.lifeYears || 0) * 12 + Number(watched.lifeMonths || 0);
  const preview = previewGoal({
    price: Number(watched.price?.replace(/,/g, "")),
    purchasedOn: watched.purchasedOn ?? "",
    mode: (watched.goalMode ?? "none") as GoalMode,
    lifeMonths,
    dailyTarget: Number(watched.dailyTarget?.replace(/,/g, "")),
  });

  async function save(values: Values) {
    setFormError("");
    const parsed = schema.parse(values);
    const months =
      Number(parsed.lifeYears || 0) * 12 + Number(parsed.lifeMonths || 0);
    const payload: AssetInput = {
      name: parsed.name,
      asset_type: parsed.assetType,
      purchase_price: parsed.price,
      purchased_on: parsed.purchasedOn,
      currency: asset?.currency ?? currency.currency,
      notes: parsed.notes || null,
      expected_life_months: parsed.goalMode === "life" ? months : null,
      target_cost_per_day:
        parsed.goalMode === "daily" ? parsed.dailyTarget : null,
    };
    try {
      const saved = await saveAsset.mutateAsync({
        id: asset?.id ?? null,
        body: payload,
      });
      onSaved(saved, !asset);
      onOpenChange(false);
    } catch (reason) {
      setFormError(
        applyServerErrors(
          reason,
          form.setError,
          serverFields,
          "Could not save this asset.",
        ),
      );
    }
  }

  const goalMode = watched.goalMode ?? "none";

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent className="gap-5 sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-lg">
            {asset ? `Edit ${asset.name}` : "Add an asset"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Asset details and replacement goal
          </DialogDescription>
        </DialogHeader>
        <form
          noValidate
          className="space-y-5"
          onSubmit={form.handleSubmit(save)}
        >
          <Field
            id="asset-name"
            label="What did you buy?"
            error={errors.name?.message}
          >
            <Input
              {...controlProps("asset-name", errors.name?.message)}
              {...form.register("name")}
              autoComplete="off"
              placeholder="e.g. iPhone 15 Pro"
            />
          </Field>

          <Field id="asset-type" label="Type" error={errors.assetType?.message}>
            <Controller
              control={form.control}
              name="assetType"
              render={({ field }) => (
                <TilePicker
                  id="asset-type"
                  tiles={tiles}
                  value={field.value}
                  onChange={field.onChange}
                  focusRef={field.ref}
                  invalid={!!errors.assetType}
                  describedBy={
                    errors.assetType ? "asset-type-error" : undefined
                  }
                  onCreate={async (name) => {
                    setExtraTypes((current) => [...current, name]);
                    return name;
                  }}
                  variant="chips"
                  createLabel="New type"
                  createPlaceholder="e.g. Gaming console"
                  maxNameLength={50}
                />
              )}
            />
          </Field>

          <div className="grid gap-4 min-[420px]:grid-cols-2">
            <Field
              id="asset-price"
              label="Purchase price"
              error={errors.price?.message}
            >
              <MoneyInput
                id="asset-price"
                symbol={currency.symbol}
                error={errors.price?.message}
                {...form.register("price")}
              />
            </Field>
            <Field
              id="asset-date"
              label="Purchase date"
              error={errors.purchasedOn?.message}
            >
              <Controller
                control={form.control}
                name="purchasedOn"
                render={({ field }) => (
                  <DatePicker
                    id="asset-date"
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    triggerRef={field.ref}
                    max={localDateISO()}
                    invalid={!!errors.purchasedOn}
                    describedBy={
                      errors.purchasedOn ? "asset-date-error" : undefined
                    }
                  />
                )}
              />
            </Field>
          </div>

          <section className="space-y-4 rounded-2xl border bg-muted/30 p-4">
            <h3 className="font-medium">
              Replacement goal{" "}
              <span className="font-normal text-muted-foreground">
                (optional)
              </span>
            </h3>
            <Controller
              control={form.control}
              name="goalMode"
              render={({ field }) => (
                <Tabs
                  value={field.value}
                  onValueChange={(value) => {
                    field.onChange(value);
                    form.clearErrors([
                      "lifeYears",
                      "lifeMonths",
                      "dailyTarget",
                    ]);
                  }}
                >
                  <TabsList className="grid h-auto w-full grid-cols-3">
                    <TabsTrigger value="none">No goal</TabsTrigger>
                    <TabsTrigger value="life">Expected life</TabsTrigger>
                    <TabsTrigger value="daily">Daily cost</TabsTrigger>
                  </TabsList>
                </Tabs>
              )}
            />
            {goalMode === "life" && (
              <div className="grid grid-cols-2 gap-3">
                <Field
                  id="life-years"
                  label="Years"
                  error={errors.lifeYears?.message}
                >
                  <Input
                    {...controlProps("life-years", errors.lifeYears?.message)}
                    {...form.register("lifeYears")}
                    inputMode="numeric"
                    placeholder="3"
                  />
                </Field>
                <Field
                  id="life-months"
                  label="Months"
                  optional
                  error={errors.lifeMonths?.message}
                >
                  <Input
                    {...controlProps("life-months", errors.lifeMonths?.message)}
                    {...form.register("lifeMonths")}
                    inputMode="numeric"
                    placeholder="0"
                  />
                </Field>
              </div>
            )}
            {goalMode === "daily" && (
              <Field
                id="daily-target"
                label="Target cost per day"
                error={errors.dailyTarget?.message}
              >
                <MoneyInput
                  id="daily-target"
                  symbol={currency.symbol}
                  error={errors.dailyTarget?.message}
                  placeholder="e.g. 50"
                  {...form.register("dailyTarget")}
                />
              </Field>
            )}
            {preview && (
              <p className="flex items-start gap-2 rounded-xl bg-primary/[0.08] p-3 text-sm animate-in fade-in duration-150">
                <CalendarCheck2 className="mt-0.5 size-4 shrink-0 text-primary" />
                <span>
                  {goalMode === "life" &&
                    `${describeLife(lifeMonths)} of use is `}
                  <strong className="money">
                    {currency.format(preview.dailyCost)}/day
                  </strong>
                  . You'll reach it on{" "}
                  <strong>
                    {preview.reachedOn.toLocaleDateString(currency.locale, {
                      dateStyle: "medium",
                    })}
                  </strong>{" "}
                  ({preview.days.toLocaleString()} days).
                </span>
              </p>
            )}
          </section>

          <Field
            id="asset-notes"
            label="Notes"
            optional
            error={errors.notes?.message}
          >
            <Textarea
              {...controlProps("asset-notes", errors.notes?.message)}
              {...form.register("notes")}
              rows={2}
              placeholder="Warranty, model, or condition"
            />
          </Field>

          <FormAlert>{formError}</FormAlert>

          <DialogFooter className="-mx-4 -mb-4 sm:-mx-4">
            <Button
              type="button"
              variant="ghost"
              disabled={isSubmitting}
              onClick={() => changeOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting}>
              {isSubmitting ? "Saving…" : asset ? "Save changes" : "Add asset"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
