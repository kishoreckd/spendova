import { useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { manageNav } from "@/app/navigation";

export default function MorePage() {
  const navigate = useNavigate();
  return (
    <div className="divide-y overflow-hidden rounded-2xl border bg-card md:grid md:grid-cols-2 md:gap-3 md:divide-y-0 md:border-0 md:bg-transparent">
      {manageNav.map(({ to, label, icon: Icon }) => (
        <button
          key={to}
          onClick={() => navigate(to)}
          className="flex min-h-14 w-full items-center gap-4 px-4 py-3 text-left transition hover:bg-muted/50 md:rounded-2xl md:border md:bg-card"
        >
          <span className="grid size-10 place-items-center rounded-xl bg-secondary text-primary">
            <Icon className="size-5" />
          </span>
          <span className="flex-1 font-medium">{label}</span>
          <ChevronRight className="size-4 text-muted-foreground" />
        </button>
      ))}
    </div>
  );
}
