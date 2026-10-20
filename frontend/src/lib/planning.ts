const DAY_MS = 86_400_000;
export type OwnershipInput = {
  purchasePrice: number;
  purchasedOn: string;
  monthlyServices: number;
  annualInsurance: number;
  repairs: number;
  resaleValue: number;
  expectedLifeYears: number;
  condition: "good" | "fair" | "poor";
  supported: boolean;
  asOf?: string;
};
export function ownershipAnalysis(input: OwnershipInput) {
  const start = new Date(`${input.purchasedOn}T00:00:00`);
  const end = input.asOf ? new Date(`${input.asOf}T00:00:00`) : new Date();
  const days = Math.max(
    1,
    Math.floor((end.getTime() - start.getTime()) / DAY_MS) + 1,
  );
  const years = days / 365.2425;
  const services = input.monthlyServices * (days / 30.4375);
  const insurance = input.annualInsurance * years;
  const grossCost = input.purchasePrice + services + insurance + input.repairs;
  const consumedCost = Math.max(0, grossCost - input.resaleValue);
  const agePressure = Math.min(
    45,
    (years / Math.max(1, input.expectedLifeYears)) * 45,
  );
  const conditionPressure = { good: 0, fair: 15, poor: 30 }[input.condition];
  const supportPressure = input.supported ? 0 : 25;
  const replacementScore = Math.min(
    100,
    Math.round(agePressure + conditionPressure + supportPressure),
  );
  const recommendation =
    replacementScore >= 70
      ? "Plan replacement now"
      : replacementScore >= 45
        ? "Review within 12 months"
        : "Keep using it";
  return {
    days,
    years,
    services,
    insurance,
    grossCost,
    consumedCost,
    costPerDay: consumedCost / days,
    replacementScore,
    recommendation,
  };
}

export type PurchaseGoalInput = {
  targetPrice: number;
  saved: number;
  targetDate: string;
  monthlyReturnPercent?: number;
  asOf?: string;
};
export function purchaseGoal(input: PurchaseGoalInput) {
  const today = input.asOf ? new Date(`${input.asOf}T00:00:00`) : new Date();
  const target = new Date(`${input.targetDate}T00:00:00`);
  const days = Math.max(
    0,
    Math.ceil((target.getTime() - today.getTime()) / DAY_MS),
  );
  const months = Math.max(1, days / 30.4375);
  const remaining = Math.max(0, input.targetPrice - input.saved);
  const monthlyRate = Math.max(0, input.monthlyReturnPercent ?? 0) / 100;
  const monthly =
    remaining === 0
      ? 0
      : monthlyRate > 0
        ? (remaining * monthlyRate) / (Math.pow(1 + monthlyRate, months) - 1)
        : remaining / months;
  return {
    days,
    months: Math.ceil(months),
    remaining,
    daily: days ? remaining / days : remaining,
    weekly: days ? remaining / (days / 7) : remaining,
    monthly,
    ready: remaining === 0,
    pastDue: target <= today && remaining > 0,
  };
}
