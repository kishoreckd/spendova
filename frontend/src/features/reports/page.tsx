import { useEffect, useMemo, useState } from "react";
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuth } from "@/features/auth/auth-context";
import {
  getDashboard,
  listTransactions,
  type DashboardSummary,
  type TransactionItem,
} from "@/lib/api";

const chartColors = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

export default function ReportsPage() {
  const { profile } = useAuth();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [range, setRange] = useState<3 | 6 | 12>(6);
  const [error, setError] = useState("");
  const [today] = useState(() => new Date());
  const currency = profile?.base_currency ?? "INR";
  const money = (value: number) =>
    new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(value);

  useEffect(() => {
    Promise.all([getDashboard(), listTransactions(200)])
      .then(([nextSummary, nextTransactions]) => {
        setSummary(nextSummary);
        setTransactions(nextTransactions);
      })
      .catch((reason) =>
        setError(
          reason instanceof Error ? reason.message : "Could not load reports",
        ),
      );
  }, []);

  const analysis = useMemo(
    () => buildAnalysis(transactions, today, range),
    [transactions, today, range],
  );
  if (error)
    return (
      <p
        role="alert"
        className="rounded-xl bg-destructive/10 p-4 text-sm text-destructive"
      >
        {error}
      </p>
    );
  if (!summary || !transactions.length) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex min-h-80 flex-col items-center justify-center p-8 text-center">
          <span className="rounded-2xl bg-primary/10 p-4 text-primary">
            <BarChart3 className="size-8" />
          </span>
          <h2 className="mt-5 text-xl font-semibold">No report data yet</h2>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            Add a cleared income or expense to start building your analytics.
          </p>
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
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Your financial picture</h2>
          <p className="text-sm text-muted-foreground">
            Real cleared transactions, with transfers excluded from spending.
          </p>
        </div>
        <div className="flex rounded-xl bg-muted p-1" aria-label="Chart range">
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

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          icon={TrendingUp}
          label="Income this month"
          value={money(income)}
          detail="Cleared income"
          tone="positive"
        />
        <Metric
          icon={TrendingDown}
          label="Spent this month"
          value={money(spending)}
          detail={
            spendChange === null
              ? "No previous-month comparison"
              : `${Math.abs(spendChange).toFixed(1)}% ${spendChange <= 0 ? "less" : "more"} than last month`
          }
          tone={
            spendChange !== null && spendChange > 0 ? "negative" : undefined
          }
        />
        <Metric
          icon={Wallet}
          label="Net cash flow"
          value={money(income - spending)}
          detail={
            income >= spending
              ? "You kept more than you spent"
              : "Spending exceeded income"
          }
          tone={income >= spending ? "positive" : "negative"}
        />
        <Metric
          icon={BarChart3}
          label="Savings rate"
          value={`${savingsRate.toFixed(1)}%`}
          detail="Income left after expenses"
          tone={savingsRate >= 0 ? "positive" : "negative"}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_.65fr]">
        <Card>
          <CardHeader>
            <CardTitle>Cash-flow trend</CardTitle>
            <CardDescription>
              Compare income and expenses across the last {range} months.
            </CardDescription>
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
            <CardDescription>
              Expense share by category this month.
            </CardDescription>
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
            <CardDescription>
              The dotted line is your average spending per calendar day.
            </CardDescription>
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
            <CardDescription>
              What deserves attention this month.
            </CardDescription>
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
  detail: string;
  tone?: "positive" | "negative";
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{label}</p>
          <span className="rounded-xl bg-muted p-2">
            <Icon className="size-4" />
          </span>
        </div>
        <p
          className={`money mt-3 text-2xl font-semibold ${tone === "positive" ? "text-emerald-600" : tone === "negative" ? "text-rose-600" : ""}`}
        >
          {value}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
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
function compactNumber(value: number) {
  return new Intl.NumberFormat(undefined, {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(Number(value));
}

function buildAnalysis(
  transactions: TransactionItem[],
  today: Date,
  monthCount: number,
) {
  const months = Array.from({ length: monthCount }, (_, index) => {
    const date = new Date(
      today.getFullYear(),
      today.getMonth() - (monthCount - 1 - index),
      1,
    );
    return {
      key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
      label: date.toLocaleDateString(undefined, {
        month: "short",
        ...(monthCount === 12 ? { year: "2-digit" } : {}),
      }),
      income: 0,
      spending: 0,
    };
  });
  const monthMap = new Map(months.map((item) => [item.key, item]));
  const categories = new Map<string, number>();
  const daily = new Map<number, number>();
  const currentKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const previous = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const previousKey = `${previous.getFullYear()}-${String(previous.getMonth() + 1).padStart(2, "0")}`;

  transactions
    .filter((item) => item.status === "cleared")
    .forEach((item) => {
      const month = item.occurred_on.slice(0, 7);
      const amount = Number(item.amount);
      const bucket = monthMap.get(month);
      if (bucket && item.kind === "income") bucket.income += amount;
      if (bucket && item.kind === "expense") bucket.spending += amount;
      if (month === currentKey && item.kind === "expense") {
        const category = item.destination || "Uncategorized";
        categories.set(category, (categories.get(category) ?? 0) + amount);
        const day = Number(item.occurred_on.slice(8, 10));
        daily.set(day, (daily.get(day) ?? 0) + amount);
      }
    });
  const categoryList = [...categories]
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount);
  const dailyList = Array.from({ length: today.getDate() }, (_, index) => ({
    day: index + 1,
    amount: daily.get(index + 1) ?? 0,
  }));
  const currentSpend = categoryList.reduce((sum, item) => sum + item.amount, 0);
  return {
    monthly: months,
    categories: categoryList,
    daily: dailyList,
    currentSpend,
    previousSpend: monthMap.get(previousKey)?.spending ?? 0,
    averageDaily: currentSpend / Math.max(1, today.getDate()),
    peakDay: dailyList.reduce<(typeof dailyList)[number] | null>(
      (peak, item) => (!peak || item.amount > peak.amount ? item : peak),
      null,
    ),
  };
}
