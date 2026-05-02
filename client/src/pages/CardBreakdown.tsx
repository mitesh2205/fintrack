import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import { CreditCard, TrendingUp, TrendingDown, Minus, ChevronRight } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface AccountData {
  id: string;
  name: string;
  institution: string;
  type: string;
  color: string;
  lastFour: string | null;
  totalExpenses: number;
  transactionCount: number;
  monthlyAvg: number;
  monthlyExpenses: { month: string; amount: number }[];
  topCategories: { category: string; amount: number }[];
}

interface ByAccountResponse {
  accounts: AccountData[];
  monthlyStackedData: Record<string, any>[];
  allMonths: string[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  n >= 1000
    ? `$${(n / 1000).toFixed(1)}k`
    : `$${n.toFixed(0)}`;

const fmtFull = (n: number) =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtMonth = (m: string) => {
  const [y, mo] = m.split("-");
  return new Date(+y, +mo - 1).toLocaleString("en-US", { month: "short", year: "2-digit" });
};

// Auto-infer a "personality role" for each account based on its top category
function inferRole(acct: AccountData): { label: string; emoji: string } {
  const top = acct.topCategories[0]?.category ?? "";
  const name = acct.name.toLowerCase();

  if (top === "Loan Repayment")             return { label: "Family Support",  emoji: "🏠" };
  if (top === "Peer Payment")               return { label: "Social Card",     emoji: "🤝" };
  if (top === "Groceries")                  return { label: "Grocery Card",    emoji: "🛒" };
  if (top === "Food & Dining")              return { label: "Foodie Card",     emoji: "🍽️" };
  if (top === "Travel")                     return { label: "Travel Card",     emoji: "✈️" };
  if (top === "Shopping")                   return { label: "Shopping Card",   emoji: "🛍️" };
  if (top === "Entertainment")              return { label: "Fun Card",        emoji: "🎬" };
  if (top === "Gas & Fuel")                 return { label: "Road Card",       emoji: "⛽" };
  if (acct.transactionCount === 0)          return { label: "Inactive",        emoji: "💤" };
  if (acct.transactionCount >= 80)          return { label: "Daily Driver",    emoji: "⭐" };
  return { label: "General Use", emoji: "💳" };
}

// ─── Custom tooltip for river chart ──────────────────────────────────────────

function RiverTooltip({ active, payload, label, accounts }: any) {
  if (!active || !payload?.length) return null;

  const total = payload.reduce((s: number, p: any) => s + (p.value ?? 0), 0);
  const acctMap = Object.fromEntries(accounts.map((a: AccountData) => [a.id, a]));

  return (
    <div className="rounded-2xl border border-border bg-card/95 backdrop-blur-md shadow-2xl px-4 py-3 min-w-[200px]">
      <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
        {fmtMonth(label)}
      </p>
      <div className="space-y-1.5">
        {[...payload].reverse().map((p: any) => {
          const acct = acctMap[p.dataKey];
          if (!acct || p.value === 0) return null;
          return (
            <div key={p.dataKey} className="flex items-center justify-between gap-6">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: acct.color }} />
                <span className="text-xs text-muted-foreground truncate max-w-[120px]">
                  {acct.name.replace(/\s\d{4}$/, "")}
                </span>
              </div>
              <span className="text-xs font-semibold text-foreground">{fmt(p.value)}</span>
            </div>
          );
        })}
      </div>
      <div className="mt-2 pt-2 border-t border-border flex justify-between">
        <span className="text-xs text-muted-foreground">Total</span>
        <span className="text-xs font-bold text-foreground">{fmtFull(total)}</span>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CardBreakdown() {
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);

  const { data, isLoading } = useQuery<ByAccountResponse>({
    queryKey: ["/api/analytics/by-account"],
    queryFn: () => fetch("/api/analytics/by-account").then((r) => r.json()),
  });

  const accounts = data?.accounts ?? [];
  const monthlyStackedData = data?.monthlyStackedData ?? [];
  const allMonths = data?.allMonths ?? [];

  // Active accounts only (have some expense)
  const activeAccounts = accounts.filter((a) => a.totalExpenses > 0);

  // Month spotlight data
  const spotlightMonth = selectedMonth ?? allMonths[allMonths.length - 1] ?? null;
  const spotlightData = useMemo(() => {
    if (!spotlightMonth) return [];
    const prevMonth = allMonths[allMonths.indexOf(spotlightMonth) - 1] ?? null;

    return activeAccounts
      .map((acct) => {
        const curr = acct.monthlyExpenses.find((m) => m.month === spotlightMonth)?.amount ?? 0;
        const prev = prevMonth
          ? (acct.monthlyExpenses.find((m) => m.month === prevMonth)?.amount ?? 0)
          : null;
        const delta = prev !== null ? curr - prev : null;
        return { acct, curr, prev, delta };
      })
      .sort((a, b) => b.curr - a.curr);
  }, [spotlightMonth, activeAccounts, allMonths]);

  const spotlightTotal = spotlightData.reduce((s, d) => s + d.curr, 0);

  // Month scrubber: block widths proportional to total spend that month
  const maxMonthTotal = useMemo(() => {
    if (!monthlyStackedData.length) return 1;
    return Math.max(
      ...monthlyStackedData.map((row) =>
        activeAccounts.reduce((s, a) => s + (row[a.id] ?? 0), 0)
      )
    );
  }, [monthlyStackedData, activeAccounts]);

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
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/10">
            <CreditCard className="h-5 w-5 text-violet-500" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Card Breakdown</h1>
        </div>
        <p className="text-sm text-muted-foreground ml-12">
          Every rupee, by every card — {activeAccounts.length} active accounts across {allMonths.length} months
        </p>
      </motion.div>

      {/* ── Section 1: Account Personality Cards ────────────────────── */}
      <div>
        <SectionLabel label="Your Cards & Their Roles" />
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {accounts.map((acct, i) => {
            const role = inferRole(acct);
            const peakMonth = [...acct.monthlyExpenses].sort((a, b) => b.amount - a.amount)[0];
            return (
              <motion.div
                key={acct.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.07 }}
                className="relative rounded-2xl border bg-card p-4 overflow-hidden hover:shadow-lg transition-shadow cursor-default"
                style={{ borderColor: acct.color + "40" }}
              >
                {/* Accent bar at top */}
                <div
                  className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl"
                  style={{ background: `linear-gradient(90deg, ${acct.color}, ${acct.color}88)` }}
                />

                {/* Role badge */}
                <div className="flex items-center justify-between mb-3 mt-1">
                  <span
                    className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: acct.color + "1a", color: acct.color }}
                  >
                    {role.emoji} {role.label}
                  </span>
                </div>

                {/* Account name */}
                <p className="text-sm font-semibold text-foreground leading-tight">
                  {acct.name.replace(/ \d{4}$/, "")}
                </p>
                {acct.lastFour && (
                  <p className="text-[11px] text-muted-foreground mt-0.5">•••• {acct.lastFour}</p>
                )}

                {/* Total */}
                <p className="text-xl font-bold mt-3 text-foreground" style={{ color: acct.color }}>
                  {fmtFull(acct.totalExpenses)}
                </p>
                <p className="text-[11px] text-muted-foreground">total spent</p>

                {/* Stats row */}
                <div className="mt-3 flex justify-between text-[11px] text-muted-foreground">
                  <span>{acct.transactionCount} txns</span>
                  <span>{fmt(acct.monthlyAvg)}/mo</span>
                </div>

                {/* Peak month */}
                {peakMonth && peakMonth.amount > 0 && (
                  <p className="mt-2 text-[10px] text-muted-foreground/70">
                    Peak: {fmtMonth(peakMonth.month)} · {fmt(peakMonth.amount)}
                  </p>
                )}

                {/* Top category */}
                {acct.topCategories[0] && (
                  <div
                    className="mt-3 rounded-lg px-2 py-1.5 text-[11px] font-medium"
                    style={{ background: acct.color + "12", color: acct.color }}
                  >
                    #{1} {acct.topCategories[0].category} · {fmt(acct.topCategories[0].amount)}
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* ── Section 2: River Chart ───────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
        <SectionLabel
          label="Monthly Spending River"
          sub="Each colored stream = one card · hover to see per-card amounts"
        />
        <div className="mt-3 rounded-2xl border border-border bg-card p-4 md:p-6">
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart data={monthlyStackedData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <defs>
                {activeAccounts.map((acct) => (
                  <linearGradient key={acct.id} id={`grad-${acct.id}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={acct.color} stopOpacity={0.7} />
                    <stop offset="95%" stopColor={acct.color} stopOpacity={0.15} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
              <XAxis
                dataKey="month"
                tickFormatter={fmtMonth}
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tickFormatter={(v) => `$${v >= 1000 ? (v / 1000).toFixed(0) + "k" : v}`}
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={48}
              />
              <Tooltip content={<RiverTooltip accounts={accounts} />} />
              {activeAccounts.map((acct) => (
                <Area
                  key={acct.id}
                  type="monotone"
                  dataKey={acct.id}
                  stackId="1"
                  stroke={acct.color}
                  strokeWidth={1.5}
                  fill={`url(#grad-${acct.id})`}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>

          {/* Legend */}
          <div className="mt-4 flex flex-wrap gap-3">
            {activeAccounts.map((acct) => (
              <div key={acct.id} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="h-2.5 w-2.5 rounded-sm flex-shrink-0" style={{ background: acct.color }} />
                {acct.name}
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* ── Section 3: Month Spotlight ───────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
        <SectionLabel
          label="Month Spotlight"
          sub="Block width = how much was spent that month · click to inspect"
        />

        {/* Month scrubber */}
        <div className="mt-3 flex gap-1 overflow-x-auto pb-2 scrollbar-hide">
          {allMonths.map((month) => {
            const row = monthlyStackedData.find((r) => r.month === month);
            const total = row
              ? activeAccounts.reduce((s, a) => s + (row[a.id] ?? 0), 0)
              : 0;
            const widthPct = Math.max(4, (total / maxMonthTotal) * 100);
            const isSelected = month === spotlightMonth;

            return (
              <button
                key={month}
                onClick={() => setSelectedMonth(month)}
                style={{ minWidth: `${Math.max(48, widthPct * 0.9)}px` }}
                className={`relative flex-shrink-0 rounded-xl px-2 py-2 text-center transition-all duration-200 border ${
                  isSelected
                    ? "bg-violet-500 border-violet-500 text-white shadow-lg scale-105"
                    : "border-border bg-card text-muted-foreground hover:border-violet-400 hover:text-foreground"
                }`}
              >
                <p className="text-[10px] font-semibold">{fmtMonth(month)}</p>
                <p className={`text-[9px] mt-0.5 ${isSelected ? "text-white/80" : "text-muted-foreground/60"}`}>
                  {fmt(total)}
                </p>
              </button>
            );
          })}
        </div>

        {/* Spotlight panel */}
        <AnimatePresence mode="wait">
          {spotlightMonth && (
            <motion.div
              key={spotlightMonth}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="mt-3 rounded-2xl border border-border bg-card overflow-hidden"
            >
              {/* Panel header */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-muted/30">
                <div>
                  <p className="text-base font-bold text-foreground">
                    {new Date(spotlightMonth + "-15").toLocaleString("en-US", { month: "long", year: "numeric" })}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Total across all cards: <span className="font-semibold text-foreground">{fmtFull(spotlightTotal)}</span>
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>

              {/* Per-account rows */}
              <div className="divide-y divide-border">
                {spotlightData.map(({ acct, curr, delta }) => {
                  const barPct = spotlightTotal > 0 ? (curr / spotlightTotal) * 100 : 0;
                  const share = spotlightTotal > 0 ? Math.round((curr / spotlightTotal) * 100) : 0;

                  return (
                    <div key={acct.id} className="px-5 py-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2.5">
                          <span
                            className="h-3 w-3 rounded-full flex-shrink-0"
                            style={{ background: acct.color }}
                          />
                          <div>
                            <p className="text-sm font-medium text-foreground">{acct.name}</p>
                            <p className="text-[11px] text-muted-foreground">{share}% of this month</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-foreground">{fmtFull(curr)}</p>
                          {delta !== null && curr > 0 && (
                            <div className={`flex items-center justify-end gap-0.5 text-[11px] ${
                              delta > 0 ? "text-red-500" : delta < 0 ? "text-emerald-500" : "text-muted-foreground"
                            }`}>
                              {delta > 0 ? <TrendingUp className="h-3 w-3" /> :
                               delta < 0 ? <TrendingDown className="h-3 w-3" /> :
                               <Minus className="h-3 w-3" />}
                              {delta !== 0 ? `${delta > 0 ? "+" : ""}${fmt(Math.abs(delta))} vs last mo` : "same as last mo"}
                            </div>
                          )}
                        </div>
                      </div>
                      {/* Share bar */}
                      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                        <motion.div
                          className="h-full rounded-full"
                          style={{ background: acct.color }}
                          initial={{ width: 0 }}
                          animate={{ width: `${barPct}%` }}
                          transition={{ duration: 0.5, ease: "easeOut" }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* ── Section 4: Per-card Category Breakdown ───────────────────── */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}>
        <SectionLabel
          label="What Each Card Is Used For"
          sub="Category breakdown per account"
        />
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {activeAccounts.map((acct, i) => (
            <motion.div
              key={acct.id}
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.45 + i * 0.06 }}
              className="rounded-2xl border bg-card p-4"
              style={{ borderColor: acct.color + "30" }}
            >
              {/* Card header */}
              <div className="flex items-center gap-2 mb-4">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: acct.color }} />
                <p className="text-sm font-semibold text-foreground">{acct.name}</p>
              </div>

              {acct.topCategories.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">No spending data</p>
              ) : (
                <div className="flex items-center gap-4">
                  {/* Donut */}
                  <div className="flex-shrink-0">
                    <PieChart width={90} height={90}>
                      <Pie
                        data={acct.topCategories}
                        dataKey="amount"
                        cx={45}
                        cy={45}
                        innerRadius={28}
                        outerRadius={42}
                        paddingAngle={2}
                        strokeWidth={0}
                      >
                        {acct.topCategories.map((_, idx) => (
                          <Cell
                            key={idx}
                            fill={`${acct.color}${["ff", "cc", "99", "66", "44", "33"][idx] ?? "33"}`}
                          />
                        ))}
                      </Pie>
                    </PieChart>
                  </div>

                  {/* Category list */}
                  <div className="flex-1 space-y-1.5 min-w-0">
                    {acct.topCategories.map((cat, idx) => {
                      const catTotal = acct.topCategories.reduce((s, c) => s + c.amount, 0);
                      const pct = catTotal > 0 ? Math.round((cat.amount / catTotal) * 100) : 0;
                      return (
                        <div key={cat.category} className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span
                              className="h-1.5 w-1.5 rounded-full flex-shrink-0"
                              style={{ background: `${acct.color}${["ff", "cc", "99", "66", "44", "33"][idx] ?? "33"}` }}
                            />
                            <span className="text-[11px] text-muted-foreground truncate">{cat.category}</span>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <span className="text-[11px] font-medium text-foreground">{fmt(cat.amount)}</span>
                            <span className="text-[10px] text-muted-foreground/60 w-6 text-right">{pct}%</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </motion.div>
          ))}
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
