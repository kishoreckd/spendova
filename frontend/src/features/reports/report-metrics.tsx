import { Wallet } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function Metric({
  icon: Icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: typeof Wallet;
  label: string;
  value: string;
  detail?: string;
  tone?: "positive" | "negative";
}) {
  return (
    <Card>
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">{label}</p>
          <span className="rounded-xl bg-muted p-1.5 sm:p-2">
            <Icon className="size-4" />
          </span>
        </div>
        <p
          className={`money mt-2 truncate text-xl font-semibold sm:mt-3 sm:text-2xl ${tone === "positive" ? "text-emerald-600" : tone === "negative" ? "text-rose-600" : ""}`}
        >
          {value}
        </p>
        {detail && (
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {detail}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
export function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-2">
      <i className="size-2.5 rounded-sm" style={{ background: color }} />
      {label}
    </span>
  );
}
export function Signal({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Wallet;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border p-3">
      <span className="rounded-lg bg-muted p-2">
        <Icon className="size-4" />
      </span>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="money font-medium">{value}</p>
      </div>
    </div>
  );
}
