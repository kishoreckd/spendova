export type ReplacementGoal = {
  target_cost_per_day: string;
  days_needed: number;
  reached_on: string;
  days_remaining: number;
  progress_percent: number;
  reached: boolean;
};

export type AssetItem = {
  id: string;
  name: string;
  asset_type: string;
  purchase_price: string;
  purchased_on: string;
  currency: string;
  notes: string | null;
  status: string;
  age_days: number;
  cost_per_day: string;
  expected_life_months: number | null;
  target_cost_per_day: string | null;
  replacement_goal: ReplacementGoal | null;
};

export type AssetInput = {
  name: string;
  asset_type: string;
  purchase_price: string;
  purchased_on: string;
  currency: string;
  notes: string | null;
  expected_life_months: number | null;
  target_cost_per_day: string | null;
};
