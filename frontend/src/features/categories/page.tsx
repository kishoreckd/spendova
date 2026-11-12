import { useMemo, useState } from "react";
import { Plus, Tags } from "lucide-react";
import { CategoryFormDialog } from "./category-form-dialog";
import { PageActions } from "@/components/layout/page-actions";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/common/form-field";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMoney } from "@/hooks/use-money";
import type { CategoryItem, CategoryType } from "@/api/categories/types";
import { notifySuccess } from "@/lib/forms";
import { categoryColors, categoryIconMap } from "./category-icons";
import { useArchiveCategory, useCategories } from "./hooks";

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
