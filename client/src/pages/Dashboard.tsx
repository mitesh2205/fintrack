import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  TrendingUp,
  TrendingDown,
  ArrowLeftRight,
  DollarSign,
  Upload,
  Users,
  CreditCard,
  AlertCircle,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  AreaChart,
  Area,
  LineChart,
  Line,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Transaction, Account } from "@shared/schema";

interface AnalyticsSummary {
  totalIncome: number;
  totalExpenses: number;
  netFlow: number;
  totalRefunds: number;
  totalPeerReimbursements: number;
  transferVolume: number;
  transactionCount: number;
  monthlyBreakdown: { month: string; income: number; expenses: number }[];
  categoryBreakdown: { category: string; amount: number }[];
}

interface TopMerchant {
  merchant: string;
  total: number;
  count: number;
  avgPerVisit: number;
  category: string;
  lastDate: string;
}

interface RecurringExpense {
  merchant: string;
  amount: number;
  frequency: string;
  count: number;
  avgDaysBetween: number;
  nextExpectedDate: string;
  category: string;
  lastChargedDate: string;
  daysSinceLastCharge: number;
  annualizedCost: number;
  amountIncreased: boolean;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(amount));
}

function formatYAxis(value: number): string {
  if (Math.abs(value) >= 1000) {
    return `$${(value / 1000).toFixed(1)}k`;
  }
  return `$${value}`;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// Categories excluded from anomaly detection (not real discretionary spending)
const ANOMALY_SKIP = new Set([
  "Transfer", "Payment", "Investment", "Income",
  "Loan Repayment", "Refund/Return", "Bank Fees", "Taxes",
]);

const CATEGORY_COLORS = [
  "#10B981", // emerald
  "#3B82F6", // blue
  "#F59E0B", // amber
  "#EF4444", // red
  "#8B5CF6", // violet
  "#EC4899", // pink
  "#06B6D4", // cyan
  "#84CC16", // lime
  "#F97316", // orange
  "#6366F1", // indigo
];

interface KPICardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  iconBg: string;
  valueColor?: string;
  subtitle?: string;
  loading?: boolean;
  gradient?: string;
  sparklineData?: { value: number }[];
  sparklineColor?: string;
}

function KPICard({
  title,
  value,
  icon,
  iconBg,
  valueColor,
  subtitle,
  loading,
  gradient,
  sparklineData,
  sparklineColor,
}: KPICardProps) {
  if (loading) {
    return (
      <Card className="shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-32" />
            </div>
            <Skeleton className="h-10 w-10 rounded-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card 
      className="admin-stat-card border-none hover:shadow-md transition-shadow bg-card shadow-sm"
      style={gradient ? { '--stat-gradient': gradient } as React.CSSProperties : undefined}
    >
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1 flex-1 min-w-0">
            <p className="text-sm font-medium text-muted-foreground truncate">
              {title}
            </p>
            <p
              className={`text-2xl font-bold font-mono tracking-tight ${valueColor || "text-foreground"}`}
            >
              {value}
            </p>
            {subtitle && (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            )}
          </div>
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-full flex-shrink-0 ml-3 ${iconBg}`}
          >
            {icon}
          </div>
        </div>
        {sparklineData && sparklineData.length > 0 && (
          <div className="h-10 w-full mt-4 opacity-50">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sparklineData}>
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={sparklineColor || "#10B981"}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={true}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
        <DollarSign className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
      </div>
      <h2 className="mb-2 text-2xl font-semibold text-foreground">
        Welcome to FinTrack
      </h2>
      <p className="mb-8 max-w-sm text-muted-foreground text-sm leading-relaxed">
        Import your bank or credit card statements to start tracking your
        spending, income, and financial trends.
      </p>
      <Link href="/upload">
        <Button
          size="lg"
          className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
          data-testid="empty-import-button"
        >
          <Upload className="h-4 w-4" />
          Import Statement
        </Button>
      </Link>
    </div>
  );
}

function CustomTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border border-border bg-card p-3 shadow-md text-sm">
        <p className="font-medium mb-2">{label}</p>
        {payload.map((entry: any) => (
          <p key={entry.dataKey} style={{ color: entry.color }}>
            {entry.name}:{" "}
            <span className="font-mono font-medium">
              {formatCurrency(entry.value)}
            </span>
          </p>
        ))}
      </div>
    );
  }
  return null;
}

function PieCustomTooltip({ active, payload }: any) {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border border-border bg-card p-3 shadow-md text-sm">
        <p className="font-medium">{payload[0].name}</p>
        <p className="font-mono text-muted-foreground">
          {formatCurrency(payload[0].value)}
        </p>
      </div>
    );
  }
  return null;
}

export default function Dashboard() {
  const { data: summary, isLoading: summaryLoading } = useQuery<AnalyticsSummary>({
    queryKey: ["/api/analytics/summary"],
  });

  const { data: transactions = [], isLoading: txLoading } = useQuery<Transaction[]>({
    queryKey: ["/api/transactions"],
  });

  const { data: accounts = [], isLoading: acctLoading } = useQuery<Account[]>({
    queryKey: ["/api/accounts"],
  });

  const { data: topMerchants = [], isLoading: merchantsLoading } = useQuery<TopMerchant[]>({
    queryKey: ["/api/analytics/merchants"],
  });

  const { data: recurringData, isLoading: recurringLoading } = useQuery<{ items: RecurringExpense[]; totalAnnualCost: number }>({
    queryKey: ["/api/analytics/recurring"],
  });
  const recurringExpenses = recurringData?.items ?? [];

  const { data: forecastData } = useQuery<{
    currentBalance: number;
    safeFloor: number;
    summary: { minBalance: number; dangerDays: number; firstDangerDate: string | null; liquidAccountCount: number };
    upcomingEvents: { date: string; label: string; amount: number }[];
  }>({
    queryKey: ["/api/analytics/cashflow", 30],
    queryFn: () => fetch("/api/analytics/cashflow?days=30").then((r) => r.json()),
  });

  const isLoading = summaryLoading || txLoading || acctLoading || merchantsLoading || recurringLoading;
  const hasData = transactions.length > 0;

  // Process category data for pie chart: group small categories into "Other"
  const processedCategories = useMemo(() => {
    if (!summary?.categoryBreakdown || summary.categoryBreakdown.length === 0) return [];
    
    // Sort descending by amount
    const sorted = [...summary.categoryBreakdown].sort((a, b) => b.amount - a.amount);
    
    // If 6 or fewer categories, just use them
    if (sorted.length <= 6) return sorted;
    
    // Otherwise take top 5 and group the rest
    const topCategories = sorted.slice(0, 5);
    const otherAmount = sorted.slice(5).reduce((sum, item) => sum + item.amount, 0);
    
    const existingOther = topCategories.find(c => c.category === 'Other');
    if (existingOther) {
      existingOther.amount += otherAmount;
    } else {
      topCategories.push({ category: 'Other', amount: otherAmount });
    }
    
    return topCategories.sort((a, b) => b.amount - a.amount);
  }, [summary?.categoryBreakdown]);

  // Spending anomaly detection — compare current month vs 6-month rolling average
  const { anomalies, historicalMonthCount } = useMemo(() => {
    if (transactions.length === 0) return { anomalies: [], historicalMonthCount: 0 };

    const expTxns = transactions.filter(
      (tx) => tx.amount < 0 && !ANOMALY_SKIP.has(tx.category)
    );

    const allMonths = Array.from(new Set(expTxns.map((tx) => tx.date.substring(0, 7)))).sort();
    if (allMonths.length < 2) return { anomalies: [], historicalMonthCount: 0 };

    const currentMonth = allMonths[allMonths.length - 1];
    // Up to 6 months of history before the current month
    const historicalMonths = allMonths.slice(Math.max(0, allMonths.length - 7), -1);
    if (historicalMonths.length === 0) return { anomalies: [], historicalMonthCount: 0 };

    // Per-category, per-month spend totals
    const catMonthMap: Record<string, Record<string, number>> = {};
    for (const tx of expTxns) {
      const month = tx.date.substring(0, 7);
      const cat = tx.category;
      if (!catMonthMap[cat]) catMonthMap[cat] = {};
      catMonthMap[cat][month] = (catMonthMap[cat][month] ?? 0) + Math.abs(tx.amount);
    }

    type Anomaly = {
      category: string;
      currentSpend: number;
      historicalAvg: number;
      ratio: number;
      direction: "up" | "down";
    };
    const results: Anomaly[] = [];

    for (const [category, monthMap] of Object.entries(catMonthMap)) {
      const currentSpend = monthMap[currentMonth] ?? 0;
      const historicalAmounts = historicalMonths.map((m) => monthMap[m] ?? 0);
      const historicalAvg =
        historicalAmounts.reduce((s, v) => s + v, 0) / historicalMonths.length;

      // Skip micro-categories to avoid noise
      if (historicalAvg < 20 && currentSpend < 20) continue;

      const ratio = historicalAvg > 0 ? currentSpend / historicalAvg : currentSpend > 0 ? 99 : 0;

      if (ratio >= 1.5 && currentSpend >= 30 && historicalAvg >= 20) {
        results.push({ category, currentSpend, historicalAvg, ratio, direction: "up" });
      } else if (ratio <= 0.5 && historicalAvg >= 50 && currentSpend > 0) {
        results.push({ category, currentSpend, historicalAvg, ratio, direction: "down" });
      }
    }

    return {
      anomalies: results
        .sort((a, b) => {
          // Spikes first (sorted by ratio desc), then drops (sorted by ratio asc)
          if (a.direction !== b.direction) return a.direction === "up" ? -1 : 1;
          return a.direction === "up" ? b.ratio - a.ratio : a.ratio - b.ratio;
        })
        .slice(0, 6),
      historicalMonthCount: historicalMonths.length,
    };
  }, [transactions]);

  if (!isLoading && !hasData) {
    return (
      <div className="p-6">
        <EmptyState />
      </div>
    );
  }

  const recentTransactions = [...transactions]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 8);

  const netCashFlow = summary?.netFlow ?? 0;
  const netIsPositive = netCashFlow >= 0;

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Page header */}
      <div className="hero-banner p-6 md:p-8 rounded-xl shadow-md text-white relative">
        <h1 className="text-2xl font-bold tracking-tight mb-1 relative z-10 drop-shadow-sm">
          Welcome back
        </h1>
        {!isLoading && (
          <p className="text-sm opacity-80 relative z-10 font-medium tracking-wide">
            {accounts.length} account{accounts.length !== 1 ? "s" : ""} ·{" "}
            {transactions.length} transaction{transactions.length !== 1 ? "s" : ""} tracked
          </p>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KPICard
          loading={isLoading}
          title="Total Income"
          value={formatCurrency(summary?.totalIncome ?? 0)}
          iconBg="bg-emerald-500/10"
          icon={<TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />}
          valueColor="text-emerald-700 dark:text-emerald-400"
          gradient="linear-gradient(135deg, #10B981, #34D399)"
          sparklineData={summary?.monthlyBreakdown.map(m => ({ value: m.income }))}
          sparklineColor="#10B981"
        />
        <KPICard
          loading={isLoading}
          title="Total Expenses"
          value={formatCurrency(summary?.totalExpenses ?? 0)}
          iconBg="bg-red-500/10"
          icon={<TrendingDown className="h-5 w-5 text-red-500" />}
          valueColor="text-red-600 dark:text-red-400"
          gradient="linear-gradient(135deg, #EF4444, #F87171)"
          sparklineData={summary?.monthlyBreakdown.map(m => ({ value: m.expenses }))}
          sparklineColor="#EF4444"
        />
        <KPICard
          loading={isLoading}
          title="Net Cash Flow"
          value={`${netIsPositive ? "+" : "-"}${formatCurrency(netCashFlow)}`}
          iconBg={netIsPositive ? "bg-emerald-500/10" : "bg-red-500/10"}
          icon={
            netIsPositive ? (
              <TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <TrendingDown className="h-5 w-5 text-red-500" />
            )
          }
          valueColor={
            netIsPositive
              ? "text-emerald-700 dark:text-emerald-400"
              : "text-red-600 dark:text-red-400"
          }
          gradient={netIsPositive ? "linear-gradient(135deg, #3B82F6, #60A5FA)" : "linear-gradient(135deg, #EF4444, #F87171)"}
          sparklineData={summary?.monthlyBreakdown.map(m => ({ value: m.income - m.expenses }))}
          sparklineColor={netIsPositive ? "#3B82F6" : "#EF4444"}
        />
        <KPICard
          loading={isLoading}
          title="Peer Reimbursements"
          value={`+${formatCurrency(summary?.totalPeerReimbursements ?? 0)}`}
          iconBg="bg-sky-500/10"
          icon={<Users className="h-5 w-5 text-sky-500" />}
          valueColor="text-sky-600 dark:text-sky-400"
          subtitle={`Refunds: +${formatCurrency(summary?.totalRefunds ?? 0)}`}
          gradient="linear-gradient(135deg, #0EA5E9, #38BDF8)"
        />
      </div>

      {/* Spending Signals — anomaly callouts vs 6-month average */}
      {!isLoading && anomalies.length > 0 && (
        <Card className="admin-card border-none shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-500 flex-shrink-0" />
              Spending Signals
              <span className="text-xs font-normal text-muted-foreground">
                — vs your {historicalMonthCount}-month average
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid gap-2 sm:grid-cols-2">
              {anomalies.map((a) => (
                <div
                  key={a.category}
                  className={`flex items-start gap-3 rounded-lg px-3 py-2.5 ${
                    a.direction === "up"
                      ? "bg-amber-500/10"
                      : "bg-emerald-500/10"
                  }`}
                >
                  <span className="text-base leading-tight mt-px flex-shrink-0">
                    {a.direction === "up" ? "🔺" : "📉"}
                  </span>
                  <p className="text-sm leading-snug">
                    <span className="font-semibold text-foreground">
                      {a.category}
                    </span>
                    {" — "}
                    {a.direction === "up" ? (
                      <>
                        <span className="font-medium text-amber-600 dark:text-amber-400">
                          {formatCurrency(a.currentSpend)}
                        </span>
                        {" this month · "}
                        <span className="font-semibold text-foreground">
                          {a.ratio.toFixed(1)}×
                        </span>
                        {" your avg "}
                        <span className="text-muted-foreground">
                          {formatCurrency(a.historicalAvg)}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="font-medium text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(a.currentSpend)}
                        </span>
                        {" this month vs avg "}
                        <span className="text-muted-foreground">
                          {formatCurrency(a.historicalAvg)}
                        </span>
                      </>
                    )}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 30-Day Cash Flow Snapshot */}
      {forecastData && forecastData.summary.liquidAccountCount > 0 && (
        <Card className="admin-card border-none shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                💰 30-Day Cash Flow Snapshot
              </CardTitle>
              <Link href="/forecast" className="text-sm text-emerald-600 dark:text-emerald-400 hover:underline font-medium">
                Full forecast →
              </Link>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex flex-wrap gap-6 items-center">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Current Balance</p>
                <p className="text-xl font-bold text-foreground mt-0.5">{formatCurrency(forecastData.currentBalance)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Lowest Projected</p>
                <p className={`text-xl font-bold mt-0.5 ${forecastData.summary.minBalance < forecastData.safeFloor ? "text-red-500" : "text-emerald-600 dark:text-emerald-400"}`}>
                  {formatCurrency(forecastData.summary.minBalance)}
                </p>
              </div>
              {forecastData.summary.dangerDays > 0 && (
                <div className="flex items-center gap-2 rounded-lg bg-red-500/10 px-3 py-2">
                  <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                  <p className="text-sm text-red-600 dark:text-red-400 font-medium">
                    {forecastData.summary.dangerDays} day{forecastData.summary.dangerDays !== 1 ? "s" : ""} below safe floor
                    {forecastData.summary.firstDangerDate && ` · starts ${forecastData.summary.firstDangerDate}`}
                  </p>
                </div>
              )}
              {forecastData.summary.dangerDays === 0 && (
                <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 px-3 py-2">
                  <TrendingUp className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                  <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">Balance stays above safe floor all month</p>
                </div>
              )}
              {forecastData.upcomingEvents.slice(0, 3).length > 0 && (
                <div className="ml-auto text-right hidden sm:block">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Next 7 days</p>
                  {forecastData.upcomingEvents.slice(0, 3).map((ev, i) => (
                    <p key={i} className={`text-xs font-mono ${ev.amount > 0 ? "text-emerald-500" : "text-rose-500"}`}>
                      {ev.amount > 0 ? "+" : ""}{formatCurrency(Math.abs(ev.amount))} {ev.label}
                    </p>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Middle Row: Area Chart + Savings Gauge + Categories */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Income vs Expenses Area Chart */}
        <Card className="lg:col-span-7 admin-card border-none shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">
              Income vs Expenses
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={256}>
                <AreaChart
                  data={summary?.monthlyBreakdown ?? []}
                  margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#EF4444" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={formatYAxis} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={52} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="income" name="Income" stroke="#10B981" strokeWidth={2} fillOpacity={1} fill="url(#colorIncome)" />
                  <Area type="monotone" dataKey="expenses" name="Expenses" stroke="#EF4444" strokeWidth={2} fillOpacity={1} fill="url(#colorExpense)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Savings Rate Gauge */}
        <Card className="lg:col-span-2 admin-card border-none shadow-sm flex flex-col justify-center items-center">
          <CardHeader className="pb-0 pt-6 text-center">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Savings Rate
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center p-6 flex-1">
            {isLoading ? (
              <Skeleton className="h-32 w-32 rounded-full" />
            ) : (
              <div className="relative flex items-center justify-center h-32 w-32">
                <svg className="h-full w-full transform -rotate-90" viewBox="0 0 100 100">
                  <circle
                    className="text-muted/30 stroke-current"
                    strokeWidth="10"
                    cx="50"
                    cy="50"
                    r="40"
                    fill="transparent"
                  ></circle>
                  <circle
                    className={`${netIsPositive ? "text-emerald-500" : "text-red-500"} stroke-current transition-all duration-1000 ease-out`}
                    strokeWidth="10"
                    strokeLinecap="round"
                    cx="50"
                    cy="50"
                    r="40"
                    fill="transparent"
                    strokeDasharray={`${(summary?.totalIncome ?? 0) > 0 ? Math.max(0, Math.min(100, (netCashFlow / summary!.totalIncome) * 100)) : 0} 100`}
                    pathLength="100"
                  ></circle>
                </svg>
                <div className="absolute flex flex-col items-center justify-center">
                  <span className={`text-2xl font-bold ${netIsPositive ? "text-emerald-500" : "text-red-500"}`}>
                    {summary?.totalIncome ? Math.max(0, (netCashFlow / summary.totalIncome) * 100).toFixed(1) : 0}%
                  </span>
                </div>
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-4 text-center">
              Target: 20%+
            </p>
            {!isLoading && topMerchants.length === 0 && (
              <div className="flex items-center gap-1.5 mt-3 px-3 py-2 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                <p className="text-[10px] leading-tight">
                  Credit card missing — rate is overstated
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Spending by category pie chart */}
        <Card className="lg:col-span-3 admin-card border-none shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">
              Spending by Category
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : (summary?.categoryBreakdown ?? []).length === 0 ? (
              <div className="flex h-64 flex-col items-center justify-center gap-2 px-4 text-center">
                <CreditCard className="h-8 w-8 text-muted-foreground/50" />
                <p className="text-sm font-medium text-foreground">No spending categories yet</p>
                <p className="text-xs text-muted-foreground">
                  Checking accounts route cash but don't track purchases. Add your credit card to see a category breakdown.
                </p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={256}>
                <PieChart>
                  <Pie
                    data={processedCategories}
                    dataKey="amount"
                    nameKey="category"
                    cx="50%"
                    cy="45%"
                    innerRadius={56}
                    outerRadius={84}
                    paddingAngle={2}
                  >
                    {processedCategories.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<PieCustomTooltip />} />
                  <Legend
                    formatter={(value) => (
                      <span style={{ fontSize: "12px", color: "hsl(var(--foreground))" }}>
                        {value}
                      </span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Transactions */}
      <Card className="admin-card border-none shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">
              Recent Transactions
            </CardTitle>
            <Link href="/transactions" className="text-sm text-emerald-600 dark:text-emerald-400 hover:underline font-medium">
              View all
            </Link>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="divide-y divide-border px-6">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between py-3">
                  <div className="space-y-1.5">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-4 w-16" />
                </div>
              ))}
            </div>
          ) : recentTransactions.length === 0 ? (
            <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
              No transactions yet
            </div>
          ) : (
            <div className="divide-y divide-border">
              {recentTransactions.map((tx) => {
                const isPositive = tx.amount > 0;
                return (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between px-6 py-3 hover:bg-muted/30 transition-colors"
                    data-testid={`recent-tx-${tx.id}`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">
                          {tx.description}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-muted-foreground">
                            {formatDate(tx.date)}
                          </span>
                          <Badge variant="secondary" className="text-xs px-1.5 py-0">
                            {tx.category}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <span
                      className={`font-mono text-sm font-semibold ml-4 flex-shrink-0 ${
                        isPositive
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-foreground"
                      }`}
                    >
                      {isPositive ? "+" : "-"}
                      {formatCurrency(tx.amount)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Third Row: Top Merchants + Recurring */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top Merchants */}
        <Card className="admin-card border-none shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Top Merchants</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="space-y-2">
                    <div className="flex justify-between"><Skeleton className="h-4 w-24" /><Skeleton className="h-4 w-16" /></div>
                    <Skeleton className="h-2 w-full" />
                  </div>
                ))}
              </div>
            ) : topMerchants.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-3 px-6 text-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                  <CreditCard className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-foreground">No merchant spending found</p>
                <p className="text-xs text-muted-foreground max-w-[200px]">
                  This account has no direct purchases. Upload your Chase credit card (6199) to see where money is spent.
                </p>
                <Link href="/upload">
                  <button className="mt-1 text-xs text-emerald-600 dark:text-emerald-400 hover:underline font-medium">
                    Upload credit card →
                  </button>
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-border px-6 py-2">
                {topMerchants.map((merchant, i) => {
                  const maxAmount = topMerchants[0].total;
                  const percentage = (merchant.total / maxAmount) * 100;
                  return (
                    <div key={i} className="py-3">
                      <div className="flex justify-between items-end mb-1.5">
                        <span className="text-sm font-medium text-foreground truncate pr-4">{merchant.merchant}</span>
                        <span className="font-mono text-sm text-muted-foreground">{formatCurrency(merchant.total)}</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-1.5">
                        <div 
                          className="bg-emerald-500 h-1.5 rounded-full transition-all duration-1000" 
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recurring Expenses */}
        <Card className="admin-card border-none shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Detected Subscriptions & Recurring</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="divide-y divide-border px-6">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex justify-between py-4"><Skeleton className="h-5 w-32" /><Skeleton className="h-5 w-16" /></div>
                ))}
              </div>
            ) : recurringExpenses.length === 0 ? (
              <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">No recurring expenses detected</div>
            ) : (
              <div className="divide-y divide-border">
                {recurringExpenses.map((sub, i) => (
                  <div key={i} className="flex items-center justify-between px-6 py-3 hover:bg-muted/30 transition-colors">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">{sub.merchant}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant="outline" className="text-[10px] uppercase tracking-wider text-muted-foreground px-1.5 py-0">
                          {sub.frequency}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          Exp. {formatDate(sub.nextExpectedDate)}
                        </span>
                      </div>
                    </div>
                    <span className="font-mono text-sm font-semibold text-foreground ml-4">
                      {formatCurrency(sub.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
