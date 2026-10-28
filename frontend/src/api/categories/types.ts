export type CategoryType = "expense" | "income";

export type CategoryItem = {
  id: string;
  name: string;
  category_type: CategoryType;
  icon: string | null;
  color: string | null;
  monthly_budget: string | null;
  archived: boolean;
  is_default: boolean;
};

export type CategoryCreate = {
  name: string;
  category_type: CategoryType;
  icon?: string;
  color?: string;
  monthly_budget?: string | null;
};

export type CategoryUpdate = {
  name?: string;
  icon?: string;
  color?: string;
  monthly_budget?: string | null;
};
