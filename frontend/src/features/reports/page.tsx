import { useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormAlert } from "@/components/common/form-field";
import { useMoney } from "@/hooks/use-money";
import { useDashboard } from "@/features/dashboard/hooks";
import { useAllTransactions } from "@/features/transactions/hooks";
import { errorMessage } from "@/lib/forms";
import { buildAnalysis, compactNumber } from "./report-analysis";

const chartColors = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

export default function ReportsPage() {
  const currency = useMoney();
  const [range, setRange] = useState<3 | 6 | 12>(6);
  const [today] = useState(() => new Date());
  const money = (value: number) => currency.format(value, 0);
  const summaryQuery = useDashboard(today.getFullYear(), today.getMonth() + 1);
  const transactionsQuery = useAllTransactions();
  const summary = summaryQuery.data;
  const transactions = useMemo(
    () => transactionsQuery.data ?? [],
    [transactionsQuery.data],
  );
  const loading = summaryQuery.isPending || transactionsQuery.isPending;
  const failure = summaryQuery.error ?? transactionsQuery.error;
  const error = failure ? errorMessage(failure, "Could not load reports") : "";
  const load = () =>
    Promise.all([summaryQuery.refetch(), transactionsQuery.refetch()]);

  const analysis = useMemo(
    () => buildAnalysis(transactions, today, range),
    [transactions, today, range],
  );
  if (loading)
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {[0, 1, 2, 3].map((item) => (
            <div
              key={item}
              className="h-24 animate-pulse rounded-2xl bg-muted"
            />
          ))}
        </div>
        <div className="h-80 animate-pulse rounded-2xl bg-muted" />
      </div>
    );
  if (error)
    return (
      <div className="space-y-3">
        <FormAlert>{error}</FormAlert>
        <Button variant="outline" onClick={() => void load()}>
          Try again
        </Button>
      </div>
    );
  if (!summary || !transactions.length) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex min-h-64 flex-col items-center justify-center gap-4 p-8 text-center">
          <span className="rounded-2xl bg-primary/10 p-4 text-primary">
            <BarChart3 className="size-8" />
          </span>
          <h2 className="font-semibold">No report data yet</h2>
        </CardContent>
      </Card>
    );
  }

  const income = Number(summary.income);
  const spending = Number(summary.spending);
  const savingsRate = income > 0 ? ((income - spending) / income) * 100 : 0;
  const spendChange = analysis.previousSpend
    ? ((spending - analysis.previousSpend) / analysis.previousSpend) * 100
    : null;
  const tooltipMoney = (value: unknown) => money(Number(value));

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <div
          className="flex rounded-xl bg-muted p-1"
          role="group"
          aria-label="Chart range"
        >
          {([3, 6, 12] as const).map((months) => (
            <Button
              key={months}
              size="sm"
              variant={range === months ? "secondary" : "ghost"}
              onClick={() => setRange(months)}
            >
              {months}M
            </Button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Metric
          icon={TrendingUp}
          label="Income"
          value={money(income)}
          tone="positive"
        />
        <Metric
          icon={TrendingDown}
          label="Spent"
          value={money(spending)}
          detail={
            spendChange === null
              ? undefined
              : `${spendChange <= 0 ? "↓" : "↑"} ${Math.abs(spendChange).toFixed(0)}% vs last month`
          }
          tone={
            spendChange !== null && spendChange > 0 ? "negative" : undefined
          }
        />
        <Metric
          icon={Wallet}
          label="Net"
          value={money(income - spending)}
          tone={income >= spending ? "positive" : "negative"}
        />
        <Metric
          icon={BarChart3}
          label="Saved"
          value={`${savingsRate.toFixed(0)}%`}
          tone={savingsRate >= 0 ? "positive" : "negative"}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_.65fr]">
        <Card>
          <CardHeader>
            <CardTitle>Cash-flow trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4 flex gap-5 text-xs text-muted-foreground">
              <Legend color="var(--chart-2)" label="Income" />
              <Legend color="var(--chart-3)" label="Expenses" />
            </div>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analysis.monthly}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} />
                  <YAxis
                    tickFormatter={compactNumber}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip formatter={tooltipMoney} />
                  <Bar
                    dataKey="income"
                    name="Income"
                    fill="var(--chart-2)"
                    radius={[6, 6, 0, 0]}
                  />
                  <Bar
                    dataKey="spending"
                    name="Expenses"
                    fill="var(--chart-3)"
                    radius={[6, 6, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Where money went</CardTitle>
          </CardHeader>
          <CardContent>
            {analysis.categories.length ? (
              <>
                <div className="relative h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={analysis.categories}
                        dataKey="amount"
                        nameKey="name"
                        innerRadius={58}
                        outerRadius={88}
                        paddingAngle={3}
                      >
                        {analysis.categories.map((item, index) => (
                          <Cell
                            key={item.name}
                            fill={chartColors[index % chartColors.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip formatter={tooltipMoney} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 grid place-content-center text-center">
                    <span className="text-xs text-muted-foreground">Total</span>
                    <strong className="money text-lg">
                      {money(analysis.currentSpend)}
                    </strong>
                  </div>
                </div>
                <div className="space-y-2">
                  {analysis.categories.slice(0, 5).map((item, index) => (
                    <div
                      key={item.name}
                      className="flex items-center justify-between gap-3 text-sm"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <i
                          className="size-2.5 shrink-0 rounded-full"
                          style={{
                            background: chartColors[index % chartColors.length],
                          }}
                        />
                        <span className="truncate">{item.name}</span>
                      </span>
                      <span className="money whitespace-nowrap font-medium">
                        {money(item.amount)} ·{" "}
                        {((item.amount / analysis.currentSpend) * 100).toFixed(
                          0,
                        )}
                        %
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="py-20 text-center text-sm text-muted-foreground">
                No categorized expenses this month.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_.65fr]">
        <Card>
          <CardHeader>
            <CardTitle>Daily spending rhythm</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={analysis.daily}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="day" axisLine={false} tickLine={false} />
                  <YAxis
                    tickFormatter={compactNumber}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    formatter={tooltipMoney}
                    labelFormatter={(day) => `Day ${day}`}
                  />
                  <ReferenceLine
                    y={analysis.averageDaily}
                    stroke="var(--muted-foreground)"
                    strokeDasharray="5 5"
                  />
                  <Area
                    type="monotone"
                    dataKey="amount"
                    name="Spent"
                    stroke="var(--chart-1)"
                    fill="var(--chart-1)"
                    fillOpacity={0.18}
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Useful signals</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Signal
              icon={CalendarDays}
              label="Highest-spend day"
              value={
                analysis.peakDay && analysis.peakDay.amount > 0
                  ? `Day ${analysis.peakDay.day} · ${money(analysis.peakDay.amount)}`
                  : "No expenses"
              }
            />
            <Signal
              icon={ArrowDownRight}
              label="Average per day"
              value={money(analysis.averageDaily)}
            />
            <Signal
              icon={ArrowUpRight}
              label="Largest category"
              value={analysis.categories[0]?.name ?? "No expenses"}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Metric({
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
function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-2">
      <i className="size-2.5 rounded-sm" style={{ background: color }} />
      {label}
    </span>
  );
}
function Signal({
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
