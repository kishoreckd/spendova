import { useNavigate } from "react-router-dom";
import {
  ChevronRight,
  ReceiptText,
  ShieldCheck,
  Smartphone,
  WalletCards,
} from "lucide-react";
const items = [
  {
    to: "/accounts",
    label: "Accounts & cards",
    desc: "Banks, credit, loans, investments",
    icon: WalletCards,
  },
  {
    to: "/categories",
    label: "Categories",
    desc: "Organisation and budgets",
    icon: ReceiptText,
  },
  {
    to: "/assets",
    label: "Assets",
    desc: "Products you own",
    icon: Smartphone,
  },
  {
    to: "/settings",
    label: "Settings",
    desc: "Profile, security, and data",
    icon: ShieldCheck,
  },
];
export default function MorePage() {
  const navigate = useNavigate();
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {items.map(({ to, label, desc, icon: Icon }) => (
        <button
          key={to}
          onClick={() => navigate(to)}
          className="flex items-center gap-4 rounded-2xl border bg-card p-4 text-left transition hover:border-primary/50 hover:shadow-sm"
        >
          <div className="grid size-11 place-items-center rounded-xl bg-secondary">
            <Icon />
          </div>
          <div className="flex-1">
            <p className="font-medium">{label}</p>
            <p className="text-xs text-muted-foreground">{desc}</p>
          </div>
          <ChevronRight className="size-4 text-muted-foreground" />
        </button>
      ))}
    </div>
  );
}
