import {
  BriefcaseBusiness,
  Car,
  CreditCard,
  Gem,
  GraduationCap,
  House,
  Landmark,
  Smartphone,
  User,
  type LucideIcon,
} from "lucide-react";
import type { LoanType } from "@/api/loans/types";
import type { Tile } from "@/components/common/tile-picker";

export const loanTypes: Array<
  Tile & { value: LoanType; icon: LucideIcon; color: string }
> = [
  {
    value: "product_emi",
    label: "Product EMI",
    icon: Smartphone,
    color: "#0891b2",
  },
  { value: "personal", label: "Personal loan", icon: User, color: "#7c3aed" },
  { value: "vehicle", label: "Vehicle loan", icon: Car, color: "#2563eb" },
  { value: "home", label: "Home loan", icon: House, color: "#059669" },
  {
    value: "credit_card_emi",
    label: "Card EMI",
    icon: CreditCard,
    color: "#db2777",
  },
  {
    value: "education",
    label: "Education loan",
    icon: GraduationCap,
    color: "#d97706",
  },
  { value: "gold", label: "Gold loan", icon: Gem, color: "#ca8a04" },
  {
    value: "business",
    label: "Business loan",
    icon: BriefcaseBusiness,
    color: "#0d9488",
  },
  { value: "other", label: "Other", icon: Landmark, color: "#64748b" },
];

const byValue = new Map(loanTypes.map((item) => [item.value, item]));

export const loanTypeTile = (value: string) =>
  byValue.get(value as LoanType) ?? loanTypes[loanTypes.length - 1];

export const namePlaceholder: Record<LoanType, string> = {
  product_emi: "e.g. iPhone 17 Pro",
  personal: "e.g. Wedding loan",
  vehicle: "e.g. Creta car loan",
  home: "e.g. Flat in Whitefield",
  credit_card_emi: "e.g. Laptop on HDFC card",
  education: "e.g. MBA loan",
  gold: "e.g. Gold loan",
  business: "e.g. Shop expansion",
  other: "e.g. Family loan",
};
