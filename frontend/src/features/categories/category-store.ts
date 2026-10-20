export type Category = {
  id: string;
  name: string;
  budget: number;
  spent: number;
  color: string;
  icon: string;
  archived: boolean;
};

// Sample categories belong exclusively to /demo. Authenticated workspaces must
// start from database-backed user data, not prototype records in localStorage.
export const defaultCategories: Category[] = [];
const key = "spendova-categories";

export function loadCategories(): Category[] {
  try {
    const stored = JSON.parse(localStorage.getItem(key) || "null") as
      Category[] | null;
    const prototypeIds = new Set([
      "housing",
      "groceries",
      "transport",
      "entertainment",
      "utilities",
      "health",
    ]);
    if (stored?.length && stored.every((item) => prototypeIds.has(item.id))) {
      localStorage.removeItem(key);
      return [];
    }
    return stored || defaultCategories;
  } catch {
    return defaultCategories;
  }
}

export function saveCategories(items: Category[]) {
  localStorage.setItem(key, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent("spendova:categories"));
}
