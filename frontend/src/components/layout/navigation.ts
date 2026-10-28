import {
  BarChart3,
  CreditCard,
  Home,
  Landmark,
  MoreHorizontal,
  Settings,
  Smartphone,
  Tags,
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
  { to: "/loans", label: "Loans & EMIs", icon: Landmark },
  { to: "/categories", label: "Categories", icon: Tags },
  { to: "/assets", label: "Assets", icon: Smartphone },
  { to: "/settings", label: "Settings", icon: Settings },
];
export function greeting(name?: string | null, now = new Date()) {
  const hour = now.getHours();
  const part = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
  const firstName = name?.trim().split(/\s+/)[0];
  return firstName ? `Good ${part}, ${firstName}` : `Good ${part}`;
}
export const pageTitles: Record<string, string> = {
  "/": "Overview",
  "/transactions": "Transactions",
  "/plan": "Plan",
  "/reports": "Reports",
  "/more": "More",
  "/accounts": "Accounts",
  "/loans": "Loans & EMIs",
  "/categories": "Categories",
  "/assets": "Assets",
  "/settings": "Settings",
  "/profile": "My profile",
};
