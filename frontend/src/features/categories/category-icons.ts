import {
  Baby,
  Banknote,
  BriefcaseBusiness,
  Car,
  CircleDollarSign,
  Clapperboard,
  Coffee,
  Dumbbell,
  Gift,
  GraduationCap,
  HeartPulse,
  House,
  PawPrint,
  Plane,
  Plug,
  ShieldCheck,
  Shirt,
  ShoppingBag,
  ShoppingBasket,
  Smartphone,
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
  { value: "briefcase-business", label: "Business", icon: BriefcaseBusiness },
  { value: "wallet-cards", label: "Salary", icon: WalletCards },
  { value: "banknote", label: "Money", icon: Banknote },
  { value: "circle-dollar-sign", label: "Income", icon: CircleDollarSign },
];

export const categoryIconMap = new Map(
  categoryIcons.map((item) => [item.value, item.icon]),
);
