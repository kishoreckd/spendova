import { useCallback } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Tags } from "lucide-react";
import { categoriesApi } from "@/api/categories/api";
import type {
  CategoryCreate,
  CategoryItem,
  CategoryType,
  CategoryUpdate,
} from "@/api/categories/types";
import type { Tile } from "@/components/common/tile-picker";
import { errorMessage, notifySuccess } from "@/lib/forms";
import { queryClient, queryKeys } from "@/lib/query-client";
import {
  categoryIconMap,
  nextCategoryColor,
  suggestCategoryIcon,
} from "./category-icons";

export function categoryTile(item: CategoryItem): Tile {
  return {
    value: item.id,
    label: item.name,
    icon: categoryIconMap.get(item.icon ?? "") ?? Tags,
    color: item.color ?? undefined,
  };
}

const invalidate = () =>
  queryClient.invalidateQueries({ queryKey: queryKeys.categories });

/** The user's active categories, shared by every open screen through the query cache. */
export function useCategories(enabled = true) {
  const query = useQuery({
    queryKey: queryKeys.categories,
    queryFn: categoriesApi.list,
    enabled,
  });
  const items = query.data ?? [];
  const count = items.length;

  /** Creates a category from just a name, choosing an icon and colour. */
  const quickCreate = useCallback(
    async (name: string, type: CategoryType) => {
      const created = await categoriesApi.create({
        name,
        category_type: type,
        icon: suggestCategoryIcon(name, type),
        color: nextCategoryColor(count),
      });
      queryClient.setQueryData<CategoryItem[]>(
        queryKeys.categories,
        (current = []) => [...current, created],
      );
      void invalidate();
      notifySuccess(`${created.name} added`);
      return created.id;
    },
    [count],
  );

  return {
    items,
    loading: query.isPending && enabled,
    error: query.error
      ? errorMessage(query.error, "Could not load categories")
      : "",
    reload: query.refetch,
    quickCreate,
  };
}

export function useSaveCategory() {
  return useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string | null;
      body: CategoryCreate | CategoryUpdate;
    }) =>
      id
        ? categoriesApi.update(id, body)
        : categoriesApi.create(body as CategoryCreate),
    onSuccess: invalidate,
  });
}

export function useArchiveCategory() {
  return useMutation({
    mutationFn: categoriesApi.archive,
    onSuccess: invalidate,
  });
}
