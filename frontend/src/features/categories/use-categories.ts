import { useCallback, useEffect, useState } from "react";
import { Tags } from "lucide-react";
import type { Tile } from "@/components/tile-picker";
import { createCategory, listCategories, type CategoryItem } from "@/lib/api";
import { errorMessage, notifySuccess } from "@/lib/forms";
import {
  categoryIconMap,
  nextCategoryColor,
  suggestCategoryIcon,
} from "./category-icons";

export const CATEGORIES_CHANGED = "spendova:categories";

export function categoryTile(item: CategoryItem): Tile {
  return {
    value: item.id,
    label: item.name,
    icon: categoryIconMap.get(item.icon ?? "") ?? Tags,
    color: item.color ?? undefined,
  };
}

/** The user's active categories, kept in sync across open screens. */
export function useCategories(enabled = true) {
  const [items, setItems] = useState<CategoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const reload = useCallback(
    () =>
      listCategories()
        .then((next) => {
          setItems(next);
          setError("");
        })
        .catch((reason) =>
          setError(errorMessage(reason, "Could not load categories")),
        )
        .finally(() => setLoading(false)),
    [],
  );

  useEffect(() => {
    if (!enabled) return;
    void reload();
    const onChange = () => void reload();
    window.addEventListener(CATEGORIES_CHANGED, onChange);
    return () => window.removeEventListener(CATEGORIES_CHANGED, onChange);
  }, [enabled, reload]);

  /** Creates a category from just a name, choosing an icon and colour. */
  const quickCreate = useCallback(
    async (name: string, type: "expense" | "income") => {
      const created = await createCategory({
        name,
        category_type: type,
        icon: suggestCategoryIcon(name, type),
        color: nextCategoryColor(items.length),
      });
      setItems((current) => [...current, created]);
      window.dispatchEvent(new CustomEvent(CATEGORIES_CHANGED));
      notifySuccess(`${created.name} added`);
      return created.id;
    },
    [items.length],
  );

  return { items, loading, error, reload, quickCreate };
}
