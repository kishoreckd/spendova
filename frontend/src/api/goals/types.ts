export type GoalItem = {
  id: string;
  name: string;
  target_amount: string;
  saved_amount: string;
  months: number;
  monthly_required: string;
};

export type GoalCreate = {
  name: string;
  target_amount: string;
  saved_amount: string;
  months: number;
};

export type GoalContributionCreate = {
  amount: string;
  contributed_on: string;
  note?: string;
};

export type GoalContribution = {
  id: string;
  goal_id: string;
  amount: string;
  contributed_on: string;
  note: string | null;
};
