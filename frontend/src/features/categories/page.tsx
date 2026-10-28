import { createElement, useEffect, useMemo, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Archive, Check, Plus, Tags } from "lucide-react";
import { z } from "zod";
import { cn } from "cn";
import { PageActions } from "@/components/layout/page-actions";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { MoneyInput } from "@/components/common/money-input";
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
import { useMoney } from "@/hooks/use-money";
import type { CategoryItem, CategoryType } from "@/api/categories/types";
import {
  applyServerErrors,
  controlProps,
  notifySuccess,
  optionalMoney,
  requiredText,
} from "@/lib/forms";
import {
  categoryColors,
  categoryIconMap,
  categoryIcons,
  nextCategoryColor,
  suggestCategoryIcon,
} from "./category-icons";
import { useArchiveCategory, useCategories, useSaveCategory } from "./hooks";

const schema = z.object({
  name: requiredText("Give the category a name", 80),
  type: z.enum(["expense", "income"]),
  icon: z.string().min(1, "Choose an icon"),
  color: z.string().min(1, "Choose a colour"),
  budget: optionalMoney(),
});
type Values = z.input<typeof schema>;

const serverFields = {
  name: "name",
  category_type: "type",
  icon: "icon",
  color: "color",
  monthly_budget: "budget",
} as const;

export default function CategoriesPage() {
  const currency = useMoney();
  const categories = useCategories();
  const archiveCategory = useArchiveCategory();
  const [tab, setTab] = useState<CategoryType>("expense");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CategoryItem | null>(null);
  const [archiving, setArchiving] = useState<CategoryItem | null>(null);

  function openForm(category: CategoryItem | null) {
    setEditing(category);
    setFormOpen(true);
  }
  const counts = useMemo(
    () => ({
      expense: categories.items.filter(
        (item) => item.category_type === "expense",
      ).length,
      income: categories.items.filter((item) => item.category_type === "income")
        .length,
    }),
    [categories.items],
  );
  const visible = categories.items.filter((item) => item.category_type === tab);

  return (
    <div className="space-y-6">
      <PageActions>
        <Button aria-label="New category" onClick={() => openForm(null)}>
          <Plus />
          <span className="hidden sm:inline">New category</span>
        </Button>
      </PageActions>

      <Tabs
        value={tab}
        onValueChange={(value) => setTab(value as CategoryType)}
      >
        <TabsList className="grid w-full max-w-sm grid-cols-2">
          <TabsTrigger value="expense">Expenses · {counts.expense}</TabsTrigger>
          <TabsTrigger value="income">Income · {counts.income}</TabsTrigger>
        </TabsList>
      </Tabs>

      {categories.error && (
        <div className="space-y-3">
          <FormAlert>{categories.error}</FormAlert>
          <Button variant="outline" onClick={() => void categories.reload()}>
            Try again
          </Button>
        </div>
      )}

      {categories.loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }, (_, index) => (
            <div
              key={index}
              className="h-32 animate-pulse rounded-2xl bg-muted"
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {visible.map((item) => {
            const Icon = categoryIconMap.get(item.icon ?? "") ?? Tags;
            const color = item.color ?? categoryColors[0];
            const budget = Number(item.monthly_budget ?? 0);
            return (
              <button
                key={item.id}
                type="button"
                aria-label={`Edit ${item.name}`}
                onClick={() => openForm(item)}
                className="flex min-h-32 flex-col gap-3 rounded-2xl border bg-card p-4 text-left outline-none transition active:scale-[.98] hover:border-primary/40 hover:shadow-sm focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <span
                  className="grid size-11 place-items-center rounded-full"
                  style={{
                    color,
                    backgroundColor: `color-mix(in oklch, ${color} 15%, transparent)`,
                  }}
                >
                  <Icon className="size-5" />
                </span>
                <div className="min-w-0">
                  <p className="truncate font-medium">{item.name}</p>
                  {budget > 0 && (
                    <p className="money mt-0.5 text-xs text-muted-foreground">
                      {currency.format(budget, 0)} / month
                    </p>
                  )}
                </div>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => openForm(null)}
            className="flex min-h-32 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed p-4 text-muted-foreground transition hover:border-primary/50 hover:text-primary"
          >
            <span className="grid size-11 place-items-center rounded-full bg-muted">
              <Plus className="size-5" />
            </span>
            <span className="text-sm font-medium">
              New {tab === "expense" ? "expense" : "income"} category
            </span>
          </button>
        </div>
      )}

      <CategoryFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        category={editing}
        defaultType={tab}
        existingCount={categories.items.length}
        onSaved={(saved) => setTab(saved.category_type)}
        onArchive={(category) => {
          setFormOpen(false);
          setArchiving(category);
        }}
      />
      <ConfirmDialog
        open={!!archiving}
        onOpenChange={(open) => !open && setArchiving(null)}
        title={`Archive ${archiving?.name ?? "this category"}?`}
        description="It disappears from pickers and new budgets. Past transactions keep their category in reports."
        confirmLabel="Archive category"
        onConfirm={async () => {
          if (!archiving) return;
          await archiveCategory.mutateAsync(archiving.id);
          notifySuccess(`${archiving.name} archived`);
        }}
      />
    </div>
  );
}

function CategoryFormDialog({
  open,
  onOpenChange,
  category,
  defaultType,
  existingCount,
  onSaved,
  onArchive,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The category to edit; null creates a new one. */
  category: CategoryItem | null;
  defaultType: CategoryType;
  existingCount: number;
  onSaved: (category: CategoryItem) => void;
  onArchive: (category: CategoryItem) => void;
}) {
  const currency = useMoney();
  const saveCategory = useSaveCategory();
  const [formError, setFormError] = useState("");
  const [iconChosen, setIconChosen] = useState(false);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: {
      name: "",
      type: defaultType,
      icon: "banknote",
      color: categoryColors[0],
      budget: "",
    },
  });
  const { errors, isSubmitting } = form.formState;
  const values = useWatch({ control: form.control });

  useEffect(() => {
    if (!open) return;
    form.reset(
      category
        ? {
            name: category.name,
            type: category.category_type,
            icon: category.icon ?? "banknote",
            color: category.color ?? categoryColors[0],
            budget: Number(category.monthly_budget ?? 0)
              ? String(Number(category.monthly_budget))
              : "",
          }
        : {
            name: "",
            type: defaultType,
            icon: defaultType === "income" ? "circle-dollar-sign" : "banknote",
            color: nextCategoryColor(existingCount),
            budget: "",
          },
    );
  }, [open, category, defaultType, existingCount, form]);

  function changeOpen(next: boolean) {
    if (!next) {
      setFormError("");
      setIconChosen(false);
    }
    onOpenChange(next);
  }

  // Until someone picks an icon, keep suggesting one from the name.
  useEffect(() => {
    if (iconChosen || category || !values.name) return;
    form.setValue(
      "icon",
      suggestCategoryIcon(values.name, values.type ?? "expense"),
    );
  }, [values.name, values.type, iconChosen, category, form]);

  async function save(input: Values) {
    setFormError("");
    const parsed = schema.parse(input);
    const details = {
      name: parsed.name,
      icon: parsed.icon,
      color: parsed.color,
      monthly_budget:
        parsed.type === "expense" && parsed.budget ? parsed.budget : null,
    };
    try {
      const saved = await saveCategory.mutateAsync(
        category
          ? { id: category.id, body: details }
          : { id: null, body: { ...details, category_type: parsed.type } },
      );
      notifySuccess(category ? `${saved.name} updated` : `${saved.name} added`);
      onSaved(saved);
      changeOpen(false);
    } catch (reason) {
      setFormError(
        applyServerErrors(
          reason,
          form.setError,
          serverFields,
          "Could not save this category.",
        ),
      );
    }
  }

  const previewIcon = categoryIconMap.get(values.icon ?? "") ?? Tags;
  const color = values.color ?? categoryColors[0];

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent className="gap-5 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-lg">
            {category ? "Edit category" : "New category"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Category name, type, icon, and colour
          </DialogDescription>
        </DialogHeader>
        <form
          noValidate
          className="space-y-5"
          onSubmit={form.handleSubmit(save)}
        >
          <div
            className="flex items-center gap-4 rounded-2xl border bg-muted/30 p-4"
            aria-hidden
          >
            <span
              className="grid size-14 shrink-0 place-items-center rounded-full transition-colors"
              style={{
                color,
                backgroundColor: `color-mix(in oklch, ${color} 16%, transparent)`,
              }}
            >
              {createElement(previewIcon, { className: "size-6" })}
            </span>
            <div className="min-w-0">
              <p className="truncate font-semibold">
                {values.name?.trim() || "Category name"}
              </p>
              <p className="text-xs capitalize text-muted-foreground">
                {values.type} category
              </p>
            </div>
          </div>

          <Field id="category-name" label="Name" error={errors.name?.message}>
            <Input
              {...controlProps("category-name", errors.name?.message)}
              {...form.register("name")}
              autoComplete="off"
              placeholder="e.g. Petrol, Netflix, Rent"
            />
          </Field>

          {!category && (
            <Field
              id="category-type"
              label="Used for"
              error={errors.type?.message}
            >
              <Controller
                control={form.control}
                name="type"
                render={({ field }) => (
                  <Tabs value={field.value} onValueChange={field.onChange}>
                    <TabsList
                      id="category-type"
                      className="grid w-full grid-cols-2"
                    >
                      <TabsTrigger value="expense">Money out</TabsTrigger>
                      <TabsTrigger value="income">Money in</TabsTrigger>
                    </TabsList>
                  </Tabs>
                )}
              />
            </Field>
          )}

          <Field id="category-icon" label="Icon" error={errors.icon?.message}>
            <Controller
              control={form.control}
              name="icon"
              render={({ field }) => (
                <div
                  id="category-icon"
                  role="group"
                  className="grid grid-cols-6 gap-2 sm:grid-cols-8"
                >
                  {categoryIcons.map((item) => {
                    const Icon = item.icon;
                    const selected = field.value === item.value;
                    return (
                      <button
                        key={item.value}
                        type="button"
                        title={item.label}
                        aria-label={item.label}
                        aria-pressed={selected}
                        onClick={() => {
                          field.onChange(item.value);
                          setIconChosen(true);
                        }}
                        className={cn(
                          "grid aspect-square place-items-center rounded-xl border outline-none transition hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50",
                          selected
                            ? "border-transparent text-white"
                            : "text-muted-foreground",
                        )}
                        style={
                          selected ? { backgroundColor: color } : undefined
                        }
                      >
                        <Icon className="size-5" />
                      </button>
                    );
                  })}
                </div>
              )}
            />
          </Field>

          <Field
            id="category-color"
            label="Colour"
            error={errors.color?.message}
          >
            <Controller
              control={form.control}
              name="color"
              render={({ field }) => (
                <div
                  id="category-color"
                  role="group"
                  className="flex flex-wrap gap-2.5"
                >
                  {categoryColors.map((value) => (
                    <button
                      key={value}
                      type="button"
                      aria-label={`Colour ${value}`}
                      aria-pressed={field.value === value}
                      onClick={() => field.onChange(value)}
                      className={cn(
                        "grid size-9 place-items-center rounded-full text-white outline-none transition focus-visible:ring-3 focus-visible:ring-ring/50",
                        field.value === value &&
                          "ring-2 ring-ring ring-offset-2 ring-offset-background",
                      )}
                      style={{ backgroundColor: value }}
                    >
                      {field.value === value && <Check className="size-4" />}
                    </button>
                  ))}
                </div>
              )}
            />
          </Field>

          {values.type === "expense" && (
            <Field
              id="category-budget"
              label="Monthly budget"
              optional
              error={errors.budget?.message}
            >
              <MoneyInput
                id="category-budget"
                symbol={currency.symbol}
                error={errors.budget?.message}
                placeholder="e.g. 5000"
                {...form.register("budget")}
              />
            </Field>
          )}

          <FormAlert>{formError}</FormAlert>

          <DialogFooter>
            {category && (
              <Button
                type="button"
                variant="destructive"
                className="sm:mr-auto"
                disabled={isSubmitting}
                onClick={() => onArchive(category)}
              >
                <Archive />
                Archive
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              disabled={isSubmitting}
              onClick={() => changeOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting}>
              {isSubmitting
                ? "Saving…"
                : category
                  ? "Save changes"
                  : "Add category"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
