import {
  Baby,
  Banknote,
  BriefcaseBusiness,
  CalendarClock,
  Car,
  CircleDollarSign,
  Clapperboard,
  Coffee,
  Dumbbell,
  Gift,
  GraduationCap,
  HeartPulse,
  House,
  Landmark,
  PawPrint,
  Plane,
  Plug,
  ShieldCheck,
  Shirt,
  ShoppingBag,
  ShoppingBasket,
  Smartphone,
  TrendingUp,
  Utensils,
  WalletCards,
  type LucideIcon,
} from "lucide-react";

export const categoryIcons: Array<{
  value: string;
  label: string;
  icon: LucideIcon;
}> = [
  { value: "house", label: "Housing", icon: House },
  { value: "shopping-basket", label: "Groceries", icon: ShoppingBasket },
  { value: "utensils", label: "Food", icon: Utensils },
  { value: "car", label: "Transport", icon: Car },
  { value: "plug", label: "Utilities", icon: Plug },
  { value: "heart-pulse", label: "Healthcare", icon: HeartPulse },
  { value: "clapperboard", label: "Entertainment", icon: Clapperboard },
  { value: "graduation-cap", label: "Education", icon: GraduationCap },
  { value: "shopping-bag", label: "Shopping", icon: ShoppingBag },
  { value: "plane", label: "Travel", icon: Plane },
  { value: "gift", label: "Gifts", icon: Gift },
  { value: "shirt", label: "Clothing", icon: Shirt },
  { value: "baby", label: "Children", icon: Baby },
  { value: "paw-print", label: "Pets", icon: PawPrint },
  { value: "dumbbell", label: "Fitness", icon: Dumbbell },
  { value: "coffee", label: "Coffee", icon: Coffee },
  { value: "smartphone", label: "Phone", icon: Smartphone },
  { value: "shield-check", label: "Insurance", icon: ShieldCheck },
  { value: "calendar-clock", label: "Subscriptions", icon: CalendarClock },
  { value: "landmark", label: "Taxes and pension", icon: Landmark },
  { value: "trending-up", label: "Investing income", icon: TrendingUp },
  { value: "briefcase-business", label: "Business", icon: BriefcaseBusiness },
  { value: "wallet-cards", label: "Salary", icon: WalletCards },
  { value: "banknote", label: "Money", icon: Banknote },
  { value: "circle-dollar-sign", label: "Income", icon: CircleDollarSign },
];

export const categoryIconMap = new Map(
  categoryIcons.map((item) => [item.value, item.icon]),
);

export const categoryColors = [
  "#059669",
  "#0284c7",
  "#7c3aed",
  "#d97706",
  "#e11d48",
  "#db2777",
  "#475569",
  "#0891b2",
  "#65a30d",
  "#ea580c",
];

const keywordIcons: Array<[RegExp, string]> = [
  [/rent|home|house|maintenance/, "house"],
  [/grocer|supermarket|vegetable/, "shopping-basket"],
  [/food|dining|restaurant|lunch|dinner|snack|swiggy|zomato/, "utensils"],
  [
    /fuel|petrol|diesel|uber|ola|taxi|cab|bus|metro|train|transport|parking/,
    "car",
  ],
  [/electric|water|gas|internet|wifi|broadband|utility|bill/, "plug"],
  [/doctor|medic|pharma|hospital|health|dental/, "heart-pulse"],
  [
    /movie|netflix|prime|spotify|ott|game|entertain|subscription/,
    "clapperboard",
  ],
  [/school|tuition|course|book|education|college/, "graduation-cap"],
  [/shop|amazon|flipkart|mall/, "shopping-bag"],
  [/travel|flight|hotel|trip|holiday|vacation/, "plane"],
  [/gift|donat|charity/, "gift"],
  [/cloth|apparel|fashion|shoe/, "shirt"],
  [/kid|child|baby|daycare/, "baby"],
  [/pet|dog|cat|vet/, "paw-print"],
  [/gym|fitness|sport|yoga/, "dumbbell"],
  [/coffee|tea|cafe/, "coffee"],
  [/phone|mobile|recharge/, "smartphone"],
  [/insur/, "shield-check"],
  [/business|freelanc|client|consult/, "briefcase-business"],
  [/salary|payroll|wage/, "wallet-cards"],
];

/** Picks a fitting icon for a newly typed category name. */
export function suggestCategoryIcon(name: string, type: "expense" | "income") {
  const lower = name.toLowerCase();
  return (
    keywordIcons.find(([pattern]) => pattern.test(lower))?.[1] ??
    (type === "income" ? "circle-dollar-sign" : "banknote")
  );
}

/** Rotates through the palette so neighbouring categories stay distinct. */
export function nextCategoryColor(existingCount: number) {
  return categoryColors[existingCount % categoryColors.length];
}
