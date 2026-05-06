import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Eye, ShieldCheck, TrendingDown, Wallet } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DailyBalance {
  date: string;
  balance: number;
  delta: number;
  zone: "safe" | "watch" | "danger";
  events: ProjectedEvent[];
}

interface ProjectedEvent {
  date: string;
  label: string;
  amount: number;
  type: "income" | "expense" | "transfer";
  category: string;
}

interface ForecastData {
  currentBalance: number;
  safeFloor: number;
  days: number;
  dailyBalances: DailyBalance[];
  upcomingEvents: ProjectedEvent[];
  summary: {
    minBalance: number;
    dangerDays: number;
    watchDays: number;
    firstDangerDate: string | null;
    projectedEventCount: number;
    liquidAccountCount: number;
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD",
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(n);
}

function fmtFull(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD",
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(n);
}

function fmtDate(dateStr: string) {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", {
    month: "short", day: "numeric",
  });
}

function fmtDateFull(dateStr: string) {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

// ─── Custom tooltip ───────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const d: DailyBalance = payload[0]?.payload;
  if (!d) return null;

  const zoneColor =
    d.zone === "danger" ? "#ef4444" :
    d.zone === "watch"  ? "#f59e0b" : "#10b981";

  return (
    <div className="rounded-xl border border-border bg-card/95 backdrop-blur px-4 py-3 shadow-xl text-sm min-w-[180px]">
      <p className="font-semibold text-foreground mb-2">{fmtDateFull(label)}</p>
      <p className="font-mono text-base font-bold" style={{ color: zoneColor }}>
        {fmtFull(d.balance)}
      </p>
      {d.delta !== 0 && (
        <p className={`text-xs mt-0.5 ${d.delta > 0 ? "text-emerald-500" : "text-rose-500"}`}>
          {d.delta > 0 ? "+" : ""}{fmtFull(d.delta)} that day
        </p>
      )}
      {d.events.length > 0 && (
        <div className="mt-2 space-y-1 border-t border-border pt-2">
          {d.events.slice(0, 3).map((ev, i) => (
            <p key={i} className={`text-xs truncate ${ev.amount > 0 ? "text-emerald-500" : "text-rose-400"}`}>
              {ev.amount > 0 ? "+" : ""}{fmtFull(ev.amount)} · {ev.label}
            </p>
          ))}
          {d.events.length > 3 && (
            <p className="text-xs text-muted-foreground">+{d.events.length - 3} more</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, icon, accent,
}: {
  label: string; value: string; sub?: string;
  icon: React.ReactNode; accent: string;
}) {
  return (
    <Card className="admin-card border-none shadow-sm">
      <CardContent className="pt-5 pb-4 px-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
            <p className={`mt-1 text-2xl font-bold ${accent}`}>{value}</p>
            {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
          </div>
          <div className="rounded-lg p-2 bg-muted/50">{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const HORIZON_OPTIONS = [
  { label: "30 days", value: 30 },
  { label: "60 days", value: 60 },
  { label: "90 days", value: 90 },
];

export default function Forecast() {
  const [horizon, setHorizon] = useState(90);

  const { data, isLoading } = useQuery<ForecastData>({
    queryKey: ["/api/analytics/cashflow", horizon],
    queryFn: () => fetch(`/api/analytics/cashflow?days=${horizon}`).then((r) => r.json()),
  });

  // Thin out chart data: show every 3rd point for 90-day, every 2nd for 60-day, every 1st for 30-day
  const chartData = useMemo(() => {
    if (!data) return [];
    const step = horizon >= 90 ? 3 : horizon >= 60 ? 2 : 1;
    return data.dailyBalances.filter((_, i) => i % step === 0 || i === data.dailyBalances.length - 1);
  }, [data, horizon]);

  const noAccounts = !isLoading && data && data.summary.liquidAccountCount === 0;
  const noEvents   = !isLoading && data && data.summary.projectedEventCount === 0;

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Cash Flow Forecast</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Projected balance based on recurring patterns — see money before it moves
            </p>
          </div>
          {/* Horizon selector */}
          <div className="flex gap-2">
            {HORIZON_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setHorizon(opt.value)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors border ${
                  horizon === opt.value
                    ? "bg-emerald-500 text-white border-emerald-500 shadow-sm"
                    : "bg-card text-muted-foreground border-border hover:bg-muted"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* No accounts warning */}
        {noAccounts && (
          <Card className="admin-card border-none shadow-sm border-l-4 border-l-amber-500">
            <CardContent className="flex items-start gap-3 py-4 px-5">
              <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-foreground">No account balances set</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Go to <strong>Accounts</strong> and set the current balance on your checking/savings accounts to enable the projection.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats row */}
        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="admin-card border-none shadow-sm">
                <CardContent className="pt-5 pb-4 px-5">
                  <Skeleton className="h-4 w-24 mb-2" />
                  <Skeleton className="h-7 w-28" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : data ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Current Balance"
              value={fmt(data.currentBalance)}
              sub={`${data.summary.liquidAccountCount} liquid account${data.summary.liquidAccountCount !== 1 ? "s" : ""}`}
              icon={<Wallet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />}
              accent="text-emerald-600 dark:text-emerald-400"
            />
            <StatCard
              label={`Lowest in ${horizon} days`}
              value={fmt(data.summary.minBalance)}
              sub={data.summary.minBalance < data.safeFloor ? "Below safe floor!" : "Above safe floor"}
              icon={<TrendingDown className={`h-4 w-4 ${data.summary.minBalance < data.safeFloor ? "text-red-500" : "text-blue-500"}`} />}
              accent={data.summary.minBalance < data.safeFloor ? "text-red-500" : "text-foreground"}
            />
            <StatCard
              label="Danger Days"
              value={String(data.summary.dangerDays)}
              sub={data.summary.firstDangerDate ? `First: ${fmtDateFull(data.summary.firstDangerDate)}` : "None detected"}
              icon={<AlertTriangle className={`h-4 w-4 ${data.summary.dangerDays > 0 ? "text-red-500" : "text-muted-foreground"}`} />}
              accent={data.summary.dangerDays > 0 ? "text-red-500" : "text-foreground"}
            />
            <StatCard
              label="Upcoming Events"
              value={String(data.summary.projectedEventCount)}
              sub={`in next ${horizon} days`}
              icon={<Eye className="h-4 w-4 text-blue-500" />}
              accent="text-foreground"
            />
          </div>
        ) : null}

        {/* Chart */}
        <Card className="admin-card border-none shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              Projected Balance
              <span className="text-xs font-normal text-muted-foreground">· {horizon}-day horizon</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-4">
            {isLoading ? (
              <Skeleton className="h-64 w-full rounded-lg" />
            ) : noAccounts || !data ? (
              <div className="flex items-center justify-center h-64 text-sm text-muted-foreground">
                Set account balances to see projection
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="balGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#10b981" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="balGradWatch" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#f59e0b" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={fmtDate}
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    tickLine={false}
                    axisLine={false}
                    interval={Math.floor(chartData.length / 6)}
                  />
                  <YAxis
                    tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    tickLine={false}
                    axisLine={false}
                    width={48}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  {/* Safe floor reference line */}
                  <ReferenceLine
                    y={data.safeFloor}
                    stroke="#f59e0b"
                    strokeDasharray="4 4"
                    strokeWidth={1.5}
                    label={{ value: `$${data.safeFloor} floor`, position: "insideTopRight", fontSize: 10, fill: "#f59e0b" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="balance"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    fill="url(#balGrad)"
                    dot={false}
                    activeDot={{ r: 5, fill: "#10b981", stroke: "white", strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Upcoming events timeline */}
        <Card className="admin-card border-none shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">
              Upcoming Events
              <span className="ml-2 text-xs font-normal text-muted-foreground">· next 14 days</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="divide-y divide-border px-6">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex justify-between py-3">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                ))}
              </div>
            ) : !data || data.upcomingEvents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center px-6">
                <ShieldCheck className="h-8 w-8 text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">
                  {noEvents
                    ? "No recurring patterns detected yet — import more statements"
                    : "No events in the next 14 days"}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {data.upcomingEvents.map((ev, i) => (
                  <div key={i} className="flex items-center justify-between px-6 py-3 hover:bg-muted/30 transition-colors">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">{ev.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {fmtDateFull(ev.date)} · {ev.category}
                      </p>
                    </div>
                    <span className={`font-mono text-sm font-semibold ml-4 flex-shrink-0 ${ev.amount > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500"}`}>
                      {ev.amount > 0 ? "+" : ""}{fmtFull(ev.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Disclaimer */}
        {!isLoading && data && (
          <p className="text-center text-xs text-muted-foreground/60 pb-4">
            Projections are based on detected recurring patterns only. One-off and variable expenses are not included.
            Actual balances will differ.
          </p>
        )}

      </div>
    </div>
  );
}
