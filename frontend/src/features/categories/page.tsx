import { useCallback, useEffect, useState } from "react";
import { Archive, Plus, Tags } from "lucide-react";
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
  archiveCategory,
  createCategory,
  listCategories,
  type CategoryItem,
} from "@/lib/api";
import { categoryIconMap, categoryIcons } from "./category-icons";

const colors = [
  "#059669",
  "#0284c7",
  "#7c3aed",
  "#d97706",
  "#e11d48",
  "#db2777",
  "#475569",
  "#0891b2",
];

export default function CategoriesPage() {
  const [items, setItems] = useState<CategoryItem[]>([]);
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"expense" | "income">("expense");
  const [color, setColor] = useState(colors[0]);
  const [icon, setIcon] = useState("shopping-basket");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const load = useCallback(
    () =>
      listCategories()
        .then(setItems)
        .catch((reason) =>
          setError(
            reason instanceof Error
              ? reason.message
              : "Could not load categories",
          ),
        ),
    [],
  );
  useEffect(() => {
    void load();
  }, [load]);

  async function submit(data: FormData) {
    setSaving(true);
    setError("");
    try {
      await createCategory({
        name: String(data.get("name")).trim(),
        category_type: type,
        icon,
        color,
        monthly_budget: Number(data.get("budget") || 0),
      });
      await load();
      window.dispatchEvent(new CustomEvent("spendova:categories"));
      setOpen(false);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Could not create category",
      );
    } finally {
      setSaving(false);
    }
  }

  async function archive(id: string) {
    await archiveCategory(id);
    await load();
    window.dispatchEvent(new CustomEvent("spendova:categories"));
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Categories</h2>
          <p className="text-sm text-muted-foreground">
            Create categories that appear in transactions, budgets, and reports.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button />}>
            <Plus />
            Add category
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add category</DialogTitle>
              <DialogDescription>
                Create an expense or income category for your workspace.
              </DialogDescription>
            </DialogHeader>
            <form action={submit} className="space-y-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input name="name" required placeholder="e.g. Education" />
              </div>
              <div className="space-y-2">
                <Label>Icon</Label>
                <div className="grid max-h-40 grid-cols-6 gap-2 overflow-y-auto rounded-xl border p-2 sm:grid-cols-8">
                  {categoryIcons.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.value}
                        type="button"
                        title={item.label}
                        aria-label={item.label}
                        aria-pressed={icon === item.value}
                        onClick={() => setIcon(item.value)}
                        className={`grid aspect-square place-items-center rounded-lg transition hover:bg-muted ${icon === item.value ? "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2" : "text-muted-foreground"}`}
                      >
                        <Icon className="size-5" />
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground">
                  Selected:{" "}
                  {categoryIcons.find((item) => item.value === icon)?.label}
                </p>
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select
                  value={type}
                  onValueChange={(value) =>
                    value && setType(value as "expense" | "income")
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="expense">Expense</SelectItem>
                    <SelectItem value="income">Income</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Monthly budget (optional)</Label>
                <Input name="budget" type="number" min="0" placeholder="0" />
              </div>
              <div className="space-y-2">
                <Label>Color</Label>
                <div className="flex flex-wrap gap-2">
                  {colors.map((value) => (
                    <button
                      key={value}
                      type="button"
                      aria-label={`Choose ${value}`}
                      onClick={() => setColor(value)}
                      className={`size-9 rounded-full ${color === value ? "ring-2 ring-ring ring-offset-2" : ""}`}
                      style={{ backgroundColor: value }}
                    />
                  ))}
                </div>
              </div>
              {error && (
                <p role="alert" className="text-sm text-destructive">
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
                  {saving ? "Adding…" : "Add category"}
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
      <div className="grid gap-4 md:grid-cols-2">
        {items.map((item) => {
          const Icon = categoryIconMap.get(item.icon ?? "") ?? Tags;
          return (
            <Card key={item.id}>
              <CardContent className="flex items-center gap-4 p-4">
                <div
                  className="grid size-11 place-items-center rounded-2xl text-white"
                  style={{ backgroundColor: item.color ?? colors[0] }}
                >
                  <Icon className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-medium">{item.name}</p>
                    {item.is_default && (
                      <Badge variant="secondary">Default</Badge>
                    )}
                  </div>
                  <p className="text-xs capitalize text-muted-foreground">
                    {item.category_type}
                    {item.monthly_budget && Number(item.monthly_budget) > 0
                      ? ` · Monthly budget ${Number(item.monthly_budget).toLocaleString()}`
                      : ""}
                  </p>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Archive ${item.name}`}
                  onClick={() => void archive(item.id)}
                >
                  <Archive />
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
      {!items.length && !error && (
        <Card className="border-dashed">
          <CardContent className="flex min-h-56 flex-col items-center justify-center text-center">
            <Tags className="size-9 text-muted-foreground" />
            <h3 className="mt-3 font-semibold">No categories yet</h3>
            <Button className="mt-4" onClick={() => setOpen(true)}>
              <Plus />
              Add first category
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
