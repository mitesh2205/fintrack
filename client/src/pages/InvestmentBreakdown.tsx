import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { TrendingUp, ArrowDownLeft, ArrowUpRight, Layers, Calendar, Activity } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Platform {
  name: string;
  totalDeposited: number;
  totalWithdrawn: number;
  netInvested: number;
  transactionCount: number;
  firstDate: string;
  lastDate: string;
  monthlyDeposits: { month: string; amount: number }[];
}

interface RecentTx {
  date: string;
  description: string;
  amount: number;
  platform: string;
}

interface InvestmentResponse {
  platforms: Platform[];
  monthlyStackedData: Record<string, any>[];
  cumulativeData: { month: string; cumulative: number }[];
  allMonths: string[];
  recentTransactions: RecentTx[];
  summary: {
    totalDeposited: number;
    totalWithdrawn: number;
    netInvested: number;
    platformCount: number;
    transactionCount: number;
    activeMonths: number;
  };
}

// ─── Platform config ──────────────────────────────────────────────────────────

const PLATFORM_CONFIG: Record<string, { color: string; emoji: string; tagline: string }> = {
  "Robinhood":        { color: "#00C805", emoji: "📈", tagline: "Stock & ETF trades" },
  "Apple GS Savings": { color: "#0071e3", emoji: "🍎", tagline: "High-yield savings" },
  "DUB":              { color: "#FF6B35", emoji: "🎯", tagline: "Auto-pilot portfolio" },
  "Other":            { color: "#8b5cf6", emoji: "💼", tagline: "Other investments" },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtK = (n: number) =>
  n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${n.toFixed(0)}`;

const fmtMonth = (m: string) => {
  const [y, mo] = m.split("-");
  return new Date(+y, +mo - 1).toLocaleString("en-US", { month: "short", year: "2-digit" });
};

const fmtDate = (d: string) =>
  new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" });

// ─── Custom combo chart tooltip ───────────────────────────────────────────────

function ComboTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-2xl border border-border bg-card/95 backdrop-blur-md shadow-2xl px-4 py-3 min-w-[190px]">
      <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
        {fmtMonth(label)}
      </p>
      <div className="space-y-1.5">
        {payload.map((p: any) => (
          <div key={p.dataKey} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
              <span className="text-xs text-muted-foreground">{p.name}</span>
            </div>
            <span className="text-xs font-semibold">{fmtK(p.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, icon, color, delay,
}: {
  label: string; value: string; sub?: string;
  icon: React.ReactNode; color: string; delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="rounded-2xl border border-border bg-card p-4 flex items-start gap-3"
    >
      <div
        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl"
        style={{ background: color + "18" }}
      >
        <span style={{ color }}>{icon}</span>
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-bold text-foreground mt-0.5">{value}</p>
        {sub && <p className="text-[11px] text-muted-foreground/70 mt-0.5">{sub}</p>}
      </div>
    </motion.div>
  );
}

// ─── Consistency grid ─────────────────────────────────────────────────────────

function ConsistencyGrid({ allMonths, monthlyStackedData, platforms }: {
  allMonths: string[];
  monthlyStackedData: Record<string, any>[];
  platforms: Platform[];
}) {
  const monthTotals = useMemo(() => {
    const map: Record<string, number> = {};
    for (const row of monthlyStackedData) {
      map[row.month] = platforms.reduce((s, p) => s + (row[p.name] ?? 0), 0);
    }
    return map;
  }, [monthlyStackedData, platforms]);

  const max = Math.max(...Object.values(monthTotals), 1);

  return (
    <div className="flex flex-wrap gap-1.5 mt-3">
      {allMonths.map((month) => {
        const total = monthTotals[month] ?? 0;
        const intensity = total > 0 ? Math.max(0.15, total / max) : 0;
        return (
          <div key={month} className="group relative">
            <div
              className="h-8 w-8 rounded-md transition-transform hover:scale-110 cursor-default border border-border/50"
              style={{
                background: total > 0
                  ? `rgba(16, 185, 129, ${intensity})`
                  : "hsl(var(--muted))",
              }}
            />
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block z-10 whitespace-nowrap rounded-lg bg-popover border border-border px-2 py-1 text-[11px] shadow-lg">
              <span className="font-semibold">{fmtMonth(month)}</span>
              {total > 0 && <span className="text-muted-foreground ml-1">· {fmtK(total)}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function InvestmentBreakdown() {
  const { data, isLoading } = useQuery<InvestmentResponse>({
    queryKey: ["/api/analytics/investments"],
    queryFn: () => fetch("/api/analytics/investments").then((r) => r.json()),
  });

  const platforms = data?.platforms ?? [];
  const allMonths = data?.allMonths ?? [];
  const monthlyStackedData = data?.monthlyStackedData ?? [];
  const cumulativeData = data?.cumulativeData ?? [];
  const recentTransactions = data?.recentTransactions ?? [];
  const summary = data?.summary ?? {
    totalDeposited: 0, totalWithdrawn: 0, netInvested: 0,
    platformCount: 0, transactionCount: 0, activeMonths: 0,
  };

  // Merge monthly stacked + cumulative for combo chart
  const comboData = useMemo(() => {
    return monthlyStackedData.map((row) => {
      const cum = cumulativeData.find((c) => c.month === row.month);
      return { ...row, cumulative: cum?.cumulative ?? 0 };
    });
  }, [monthlyStackedData, cumulativeData]);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1.2, ease: "linear" }}
          className="h-8 w-8 rounded-full border-2 border-emerald-500 border-t-transparent"
        />
      </div>
    );
  }

  return (
    <div className="min-h-full bg-background px-4 py-6 md:px-8 md:py-8 space-y-8">

      {/* ── Header ─────────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3 mb-1">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10">
            <TrendingUp className="h-5 w-5 text-emerald-500" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Investments</h1>
        </div>
        <p className="text-sm text-muted-foreground ml-12">
          {summary.platformCount} platforms · {summary.transactionCount} moves · {summary.activeMonths} active months
        </p>
      </motion.div>

      {/* ── Section 1: Hero stats ────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Net Invested"
          value={fmt(summary.netInvested)}
          sub="deposited minus withdrawn"
          icon={<TrendingUp className="h-4 w-4" />}
          color="#10b981"
          delay={0.05}
        />
        <StatCard
          label="Total Deposited"
          value={fmt(summary.totalDeposited)}
          sub="money sent to platforms"
          icon={<ArrowDownLeft className="h-4 w-4" />}
          color="#0071e3"
          delay={0.1}
        />
        <StatCard
          label="Total Withdrawn"
          value={fmt(summary.totalWithdrawn)}
          sub="taken back out"
          icon={<ArrowUpRight className="h-4 w-4" />}
          color="#f97316"
          delay={0.15}
        />
        <StatCard
          label="Active Platforms"
          value={String(summary.platformCount)}
          sub={platforms.map((p) => p.name).join(", ")}
          icon={<Layers className="h-4 w-4" />}
          color="#8b5cf6"
          delay={0.2}
        />
      </div>

      {/* ── Section 2: Platform cards ────────────────────────────────── */}
      <div>
        <SectionLabel label="Your Investment Platforms" />
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {platforms.map((p, i) => {
            const cfg = PLATFORM_CONFIG[p.name] ?? PLATFORM_CONFIG["Other"];
            const depositShare = summary.totalDeposited > 0
              ? Math.round((p.totalDeposited / summary.totalDeposited) * 100)
              : 0;
            const peakMonth = [...p.monthlyDeposits].sort((a, b) => b.amount - a.amount)[0];

            return (
              <motion.div
                key={p.name}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.08 }}
                className="relative rounded-2xl border bg-card p-5 overflow-hidden hover:shadow-lg transition-shadow"
                style={{ borderColor: cfg.color + "40" }}
              >
                {/* Top accent */}
                <div
                  className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl"
                  style={{ background: `linear-gradient(90deg, ${cfg.color}, ${cfg.color}55)` }}
                />

                {/* Header row */}
                <div className="flex items-start justify-between mt-1 mb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{cfg.emoji}</span>
                      <p className="text-base font-bold text-foreground">{p.name}</p>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{cfg.tagline}</p>
                  </div>
                  <span
                    className="text-[11px] font-semibold px-2 py-1 rounded-full"
                    style={{ background: cfg.color + "18", color: cfg.color }}
                  >
                    {depositShare}% of total
                  </span>
                </div>

                {/* Net invested — the big number */}
                <p className="text-2xl font-bold" style={{ color: cfg.color }}>
                  {fmt(p.netInvested)}
                </p>
                <p className="text-[11px] text-muted-foreground">net invested</p>

                {/* Deposit / Withdraw row */}
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="rounded-xl bg-muted/50 px-3 py-2">
                    <p className="text-[10px] text-muted-foreground">Deposited</p>
                    <p className="text-sm font-semibold text-foreground">{fmtK(p.totalDeposited)}</p>
                  </div>
                  <div className="rounded-xl bg-muted/50 px-3 py-2">
                    <p className="text-[10px] text-muted-foreground">Withdrawn</p>
                    <p className="text-sm font-semibold text-foreground">{fmtK(p.totalWithdrawn)}</p>
                  </div>
                </div>

                {/* Stats */}
                <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>{p.transactionCount} transactions</span>
                  {peakMonth && peakMonth.amount > 0 && (
                    <span>Peak {fmtMonth(peakMonth.month)} · {fmtK(peakMonth.amount)}</span>
                  )}
                </div>

                {/* Date range */}
                <p className="mt-1.5 text-[10px] text-muted-foreground/60">
                  {fmtDate(p.firstDate)} → {fmtDate(p.lastDate)}
                </p>

                {/* Share bar */}
                <div className="mt-3 h-1 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${depositShare}%`, background: cfg.color }}
                  />
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* ── Section 3: Combo chart ───────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <SectionLabel
          label="Monthly Deposits + Cumulative Growth"
          sub="Bars = what you put in each month · Line = running total invested"
        />
        <div className="mt-3 rounded-2xl border border-border bg-card p-4 md:p-6">
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={comboData} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
              <XAxis
                dataKey="month"
                tickFormatter={fmtMonth}
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                yAxisId="bars"
                tickFormatter={(v) => `$${v >= 1000 ? (v / 1000).toFixed(0) + "k" : v}`}
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={44}
              />
              <YAxis
                yAxisId="line"
                orientation="right"
                tickFormatter={(v) => `$${v >= 1000 ? (v / 1000).toFixed(0) + "k" : v}`}
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={44}
              />
              <Tooltip content={<ComboTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
                formatter={(value) => (
                  <span style={{ color: PLATFORM_CONFIG[value]?.color ?? "#666" }}>{value}</span>
                )}
              />
              {platforms.map((p) => {
                const cfg = PLATFORM_CONFIG[p.name] ?? PLATFORM_CONFIG["Other"];
                return (
                  <Bar
                    key={p.name}
                    dataKey={p.name}
                    yAxisId="bars"
                    stackId="stack"
                    fill={cfg.color}
                    radius={[0, 0, 0, 0]}
                    maxBarSize={40}
                  />
                );
              })}
              <Line
                yAxisId="line"
                type="monotone"
                dataKey="cumulative"
                stroke="#10b981"
                strokeWidth={2.5}
                dot={{ fill: "#10b981", r: 3, strokeWidth: 0 }}
                name="Cumulative"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* ── Section 4: Consistency grid ─────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.38 }}>
        <SectionLabel
          label="Investment Consistency"
          sub="Darker green = more invested that month · hover for details"
        />
        <div className="mt-3 rounded-2xl border border-border bg-card p-4 md:p-6">
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">
              {allMonths.length} months tracked · {
                monthlyStackedData.filter((r) =>
                  platforms.reduce((s, p) => s + (r[p.name] ?? 0), 0) > 0
                ).length
              } months with investments
            </p>
          </div>
          <ConsistencyGrid
            allMonths={allMonths}
            monthlyStackedData={monthlyStackedData}
            platforms={platforms}
          />
          <div className="mt-3 flex items-center gap-3 text-[11px] text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <div className="h-3 w-3 rounded-sm bg-muted border border-border/50" />
              <span>No investment</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-3 w-3 rounded-sm" style={{ background: "rgba(16,185,129,0.25)" }} />
              <span>Small</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-3 w-3 rounded-sm" style={{ background: "rgba(16,185,129,0.75)" }} />
              <span>Large</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── Section 5: Transaction timeline ─────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.44 }}>
        <SectionLabel
          label="Every Investment Move"
          sub="Green = money put in · Orange = money taken out"
        />
        <div className="mt-3 rounded-2xl border border-border bg-card overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-2 px-5 py-3 border-b border-border bg-muted/30">
            <Activity className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">
              {recentTransactions.length} transactions
            </span>
          </div>

          <div className="divide-y divide-border">
            {recentTransactions.map((tx, i) => {
              const cfg = PLATFORM_CONFIG[tx.platform] ?? PLATFORM_CONFIG["Other"];
              const isDeposit = tx.amount < 0;
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.44 + i * 0.025 }}
                  className="flex items-center justify-between px-5 py-3 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Platform dot */}
                    <div
                      className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-sm"
                      style={{ background: cfg.color + "20" }}
                    >
                      <span style={{ fontSize: 14 }}>{cfg.emoji}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {tx.platform}
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate max-w-[260px]">
                        {tx.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 flex-shrink-0 ml-4">
                    <span className="text-[11px] text-muted-foreground">{fmtDate(tx.date)}</span>
                    <div className="flex items-center gap-1">
                      {isDeposit
                        ? <ArrowDownLeft className="h-3.5 w-3.5 text-emerald-500" />
                        : <ArrowUpRight className="h-3.5 w-3.5 text-orange-400" />}
                      <span
                        className="text-sm font-semibold"
                        style={{ color: isDeposit ? "#10b981" : "#f97316" }}
                      >
                        {isDeposit ? "+" : "-"}{fmt(Math.abs(tx.amount))}
                      </span>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </motion.div>

      <div className="h-6" />
    </div>
  );
}

// ─── Section label ────────────────────────────────────────────────────────────

function SectionLabel({ label, sub }: { label: string; sub?: string }) {
  return (
    <div>
      <h2 className="text-base font-semibold text-foreground">{label}</h2>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}
