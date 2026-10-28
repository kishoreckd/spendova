import { useMemo } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Installment } from "@/api/loans/types";
import { useMoney } from "@/hooks/use-money";
import { parseISODate } from "@/lib/format";

const PRINCIPAL = "var(--chart-1)";
const INTEREST = "var(--chart-3)";

const compact = (value: number) =>
  new Intl.NumberFormat(undefined, {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);

/** Principal vs interest per month (short loans) or per year, plus the balance falling to zero. */
export function LoanScheduleCharts({ schedule }: { schedule: Installment[] }) {
  const currency = useMoney();
  const monthly = schedule.length <= 24;

  const split = useMemo(() => {
    const buckets = new Map<
      string,
      { label: string; principal: number; interest: number }
    >();
    for (const row of schedule) {
      const date = parseISODate(row.due_on);
      const key = monthly ? row.due_on.slice(0, 7) : String(date.getFullYear());
      const label = monthly
        ? date.toLocaleDateString(currency.locale, { month: "short" })
        : String(date.getFullYear());
      const bucket = buckets.get(key) ?? { label, principal: 0, interest: 0 };
      bucket.principal += Number(row.principal);
      bucket.interest += Number(row.interest);
      buckets.set(key, bucket);
    }
    return [...buckets.values()];
  }, [schedule, monthly, currency.locale]);

  const balance = useMemo(
    () =>
      schedule.map((row) => ({
        label: parseISODate(row.due_on).toLocaleDateString(currency.locale, {
          month: "short",
          year: "2-digit",
        }),
        balance: Number(row.balance),
        paid: row.paid,
      })),
    [schedule, currency.locale],
  );
  const lastPaid = [...balance].reverse().find((row) => row.paid)?.label;
  const money = (value: unknown) => currency.format(Number(value), 0);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <figure className="space-y-3">
        <figcaption className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-medium">
            {monthly ? "Each EMI" : "Each year"}: principal vs interest
          </span>
          <span className="flex gap-4 text-xs text-muted-foreground">
            <Key color={PRINCIPAL} label="Principal" />
            <Key color={INTEREST} label="Interest" />
          </span>
        </figcaption>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={split} margin={{ left: -8, right: 4, top: 4 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              />
              <YAxis
                tickFormatter={compact}
                axisLine={false}
                tickLine={false}
                width={44}
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              />
              <Tooltip
                formatter={money}
                cursor={{ fill: "var(--muted)", opacity: 0.5 }}
                contentStyle={{
                  borderRadius: 12,
                  borderColor: "var(--border)",
                  background: "var(--popover)",
                }}
              />
              <Bar
                dataKey="principal"
                name="Principal"
                stackId="emi"
                fill={PRINCIPAL}
                stroke="var(--card)"
                strokeWidth={2}
                maxBarSize={24}
              />
              <Bar
                dataKey="interest"
                name="Interest"
                stackId="emi"
                fill={INTEREST}
                stroke="var(--card)"
                strokeWidth={2}
                maxBarSize={24}
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </figure>

      <figure className="space-y-3">
        <figcaption className="text-sm font-medium">
          Amount still owed
        </figcaption>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={balance} margin={{ left: -8, right: 8, top: 4 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
                minTickGap={24}
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              />
              <YAxis
                tickFormatter={compact}
                axisLine={false}
                tickLine={false}
                width={44}
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              />
              <Tooltip
                formatter={(value) => [money(value), "Still owed"]}
                contentStyle={{
                  borderRadius: 12,
                  borderColor: "var(--border)",
                  background: "var(--popover)",
                }}
              />
              {lastPaid && (
                <ReferenceLine
                  x={lastPaid}
                  stroke="var(--muted-foreground)"
                  label={{
                    value: "Now",
                    position: "insideTopRight",
                    fontSize: 11,
                    fill: "var(--muted-foreground)",
                  }}
                />
              )}
              <Area
                type="monotone"
                dataKey="balance"
                stroke={PRINCIPAL}
                strokeWidth={2}
                fill={PRINCIPAL}
                fillOpacity={0.1}
                activeDot={{ r: 5, stroke: "var(--card)", strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </figure>
    </div>
  );
}

function Key({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <i className="size-2.5 rounded-sm" style={{ background: color }} />
      {label}
    </span>
  );
}
