import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
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

export type DashboardCategory = { name: string; amount: number };
export type DashboardTransaction = {
  id: string;
  merchant: string;
  detail: string;
  amount: number;
};
export type DashboardTrend = {
  month: string;
  income: number;
  spending: number;
};
export type DashboardBudget = { name: string; spent: number; limit: number };
export type DashboardAccount = { name: string; type: string; balance: number };
export type DashboardGoal = {
  name: string;
  saved: number;
  target: number;
  monthlyRequired: number;
};
type Props = {
  income: number;
  spending: number;
  cashFlow: number;
  transactionCount: number;
  categories: DashboardCategory[];
  transactions: DashboardTransaction[];
  currency: string;
  periodLabel?: string;
  trend?: DashboardTrend[];
  budgets?: DashboardBudget[];
  accounts?: DashboardAccount[];
  goals?: DashboardGoal[];
  sample?: boolean;
  onPrimaryAction?: () => void;
};

export function DashboardContent(props: Props) {
  const money = (value: number) =>
    new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: props.currency,
      maximumFractionDigits: 0,
    }).format(value);
  const empty = props.transactionCount === 0;
  return (
    <div className="space-y-6">
      {props.sample && (
        <div className="flex flex-col gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold">Sample dashboard</p>
            <p className="text-sm text-muted-foreground">
              Preview data only—not connected to your account.
            </p>
          </div>
          <Button onClick={props.onPrimaryAction}>Create your account</Button>
        </div>
      )}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Income this month", money(props.income)],
          ["Spent this month", money(props.spending)],
          ["Cash flow", money(props.cashFlow)],
          ["Transactions", String(props.transactionCount)],
        ].map(([label, value]) => (
          <Card key={label}>
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">{label}</p>
              <p className="money mt-2 text-2xl font-semibold">{value}</p>
            </CardContent>
          </Card>
        ))}
      </section>
      {!!props.trend?.length && (
        <Card>
          <CardHeader>
            <CardTitle>Income and spending trend</CardTitle>
            <CardDescription>Your six-month cash-flow pattern</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={props.trend} margin={{ left: 4, right: 16 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} />
                  <YAxis
                    tickFormatter={(value) =>
                      `${Math.round(Number(value) / 1000)}k`
                    }
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    formatter={(value, name) => [
                      money(Number(value)),
                      name === "income" ? "Income" : "Spending",
                    ]}
                  />
                  <Area
                    type="monotone"
                    dataKey="income"
                    stroke="var(--primary)"
                    fill="var(--primary)"
                    fillOpacity={0.16}
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="spending"
                    stroke="#f59e0b"
                    fill="transparent"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
      {empty ? (
        <Card>
          <CardContent className="flex min-h-72 flex-col items-center justify-center p-8 text-center">
            <h2 className="text-xl font-semibold">Your dashboard is ready</h2>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              Add your first transaction to build spending insights and charts.
              Sample information is never mixed with your personal data.
            </p>
            <Button className="mt-5" onClick={props.onPrimaryAction}>
              Add first transaction
            </Button>
          </CardContent>
        </Card>
      ) : (
        <section className="grid gap-6 xl:grid-cols-[1.25fr_.75fr]">
          <Card>
            <CardHeader>
              <CardTitle>Spending by category</CardTitle>
              <CardDescription>
                Actual expenses for the current month
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[280px] w-full sm:h-[340px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={props.categories}
                    layout="vertical"
                    margin={{ left: 8, right: 24 }}
                  >
                    <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                    <XAxis
                      type="number"
                      tickFormatter={(value) => money(Number(value))}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={92}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      formatter={(value) => [money(Number(value)), "Spent"]}
                    />
                    <Bar
                      dataKey="amount"
                      fill="var(--primary)"
                      radius={[0, 6, 6, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Recent transactions</CardTitle>
              <CardDescription>Latest cleared activity</CardDescription>
            </CardHeader>
            <CardContent>
              {props.transactions.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 border-b py-3 last:border-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {item.merchant}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {item.detail}
                    </p>
                  </div>
                  <p
                    className={`money text-sm ${item.amount > 0 ? "text-emerald-600" : ""}`}
                  >
                    {item.amount > 0 ? "+" : "−"}
                    {money(Math.abs(item.amount))}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>
      )}
      {(props.budgets?.length ||
        props.accounts?.length ||
        props.goals?.length) && (
        <section className="grid gap-6 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Budget health</CardTitle>
              <CardDescription>Monthly category limits</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {props.budgets?.map((item) => {
                const percentage = Math.min(
                  100,
                  Math.round((item.spent / item.limit) * 100),
                );
                return (
                  <div key={item.name} className="space-y-2">
                    <div className="flex justify-between gap-3 text-sm">
                      <span>{item.name}</span>
                      <span className="money text-muted-foreground">
                        {money(item.spent)} / {money(item.limit)}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Accounts</CardTitle>
              <CardDescription>Balances across your money</CardDescription>
            </CardHeader>
            <CardContent className="divide-y">
              {props.accounts?.map((item) => (
                <div
                  key={item.name}
                  className="flex items-center justify-between gap-3 py-3 first:pt-0"
                >
                  <div>
                    <p className="text-sm font-medium">{item.name}</p>
                    <p className="text-xs text-muted-foreground">{item.type}</p>
                  </div>
                  <p
                    className={`money text-sm font-medium ${item.balance < 0 ? "text-rose-600" : ""}`}
                  >
                    {money(item.balance)}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Savings goals</CardTitle>
              <CardDescription>
                Progress toward planned purchases
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {props.goals?.map((item) => {
                const percentage = Math.min(
                  100,
                  Math.round((item.saved / item.target) * 100),
                );
                return (
                  <div key={item.name} className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">{item.name}</span>
                      <span>{percentage}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {money(item.saved)} saved · {money(item.monthlyRequired)}
                      /month needed
                    </p>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </section>
      )}
    </div>
  );
}
