import { apiFetch } from "../client";
import type { CategoryCreate, CategoryItem, CategoryUpdate } from "./types";

export const categoriesApi = {
  /** The first call seeds the default categories for a new user. */
  list: (signal?: AbortSignal, includeArchived = false) =>
    apiFetch<CategoryItem[]>(
      `/categories${includeArchived ? "?include_archived=true" : ""}`,
      { signal },
    ),
  create: (body: CategoryCreate) =>
    apiFetch<CategoryItem>("/categories", { method: "POST", body }),
  update: (id: string, body: CategoryUpdate) =>
    apiFetch<CategoryItem>(`/categories/${id}`, { method: "PATCH", body }),
  archive: (id: string) =>
    apiFetch<void>(`/categories/${id}`, { method: "DELETE" }),
};
