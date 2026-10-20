import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { purchaseGoal } from "@/lib/planning";
const money = (v: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(v);
export function PurchaseGoalCalculator() {
  const [price, setPrice] = useState(120000),
    [saved, setSaved] = useState(20000),
    [date, setDate] = useState("2026-12-31");
  const result = purchaseGoal({ targetPrice: price, saved, targetDate: date });
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>What are you planning?</CardTitle>
          <CardDescription>
            Choose the exact target date; Spendova calculates every saving pace.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Purchase</Label>
            <Input defaultValue="New iPhone" />
          </div>
          <div className="grid gap-3 min-[400px]:grid-cols-2">
            <Field label="Expected price" value={price} set={setPrice} />
            <Field label="Already saved" value={saved} set={setSaved} />
          </div>
          <div className="space-y-2">
            <Label>Buy on</Label>
            <Input
              type="date"
              min="2026-09-30"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <Button className="w-full">Save this goal</Button>
        </CardContent>
      </Card>
      <Card className="bg-gradient-to-br from-slate-900 to-teal-950 text-white">
        <CardHeader>
          <div className="flex justify-between gap-3">
            <div>
              <CardTitle className="text-white">Your saving route</CardTitle>
              <CardDescription className="text-slate-300">
                {result.days} days remaining · {money(result.remaining)} still
                needed
              </CardDescription>
            </div>
            <Badge
              className={
                result.pastDue
                  ? "bg-rose-400/20 text-rose-200"
                  : "bg-emerald-400/20 text-emerald-200"
              }
            >
              {result.pastDue ? "Date passed" : "On schedule"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-300">Save each month</p>
          <p className="money mt-1 text-4xl font-semibold">
            {money(result.monthly)}
          </p>
          <div className="mt-6 grid gap-3 min-[400px]:grid-cols-2">
            <Metric label="Per day" value={money(result.daily)} />
            <Metric label="Per week" value={money(result.weekly)} />
            <Metric label="Months" value={String(result.months)} />
            <Metric label="At purchase" value={money(price)} />
          </div>
          <p className="mt-5 text-xs text-slate-400">
            Savings are reserved for this goal and are not counted as ordinary
            spending. Buying is marked affordable only when the goal reaches
            100% without using your emergency reserve.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
function Field({
  label,
  value,
  set,
}: {
  label: string;
  value: number;
  set: (v: number) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input
        type="number"
        min="0"
        value={value}
        onChange={(e) => set(Number(e.target.value))}
      />
    </div>
  );
}
function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/10 p-3">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="money mt-1 font-semibold">{value}</p>
    </div>
  );
}
