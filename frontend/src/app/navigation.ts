import {
  BarChart3,
  CreditCard,
  Home,
  MoreHorizontal,
  Settings,
  Target,
  WalletCards,
} from "lucide-react";
export const primaryNav = [
  { to: "/", label: "Overview", icon: Home },
  { to: "/transactions", label: "Transactions", icon: CreditCard },
  { to: "/plan", label: "Plan", icon: Target },
  { to: "/reports", label: "Reports", icon: BarChart3 },
  { to: "/more", label: "More", icon: MoreHorizontal },
];
export const manageNav = [
  { to: "/accounts", label: "Accounts", icon: WalletCards },
  { to: "/assets", label: "Assets", icon: Target },
  { to: "/settings", label: "Settings", icon: Settings },
];
export const pageTitles: Record<string, string> = {
  "/": "Good evening, Kishore",
  "/transactions": "Transactions",
  "/plan": "Plan",
  "/reports": "Reports & analytics",
  "/more": "More",
  "/accounts": "Accounts & cards",
  "/categories": "Categories",
  "/assets": "Assets & replacement",
  "/settings": "Settings",
  "/profile": "My profile",
};
