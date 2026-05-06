import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Calendar, Clock, DollarSign, RefreshCw, TrendingUp } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SubscriptionItem {
  merchant: string;
  amount: number;
  frequency: "Monthly" | "Twice Monthly" | "Weekly" | "Annually";
  count: number;
  avgDaysBetween: number;
  nextExpectedDate: string;
  category: string;
  lastChargedDate: string;
  daysSinceLastCharge: number;
  annualizedCost: number;
  amountIncreased: boolean;
}

interface RecurringData {
  items: SubscriptionItem[];
  totalAnnualCost: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function fmtDate(dateStr: string) {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function daysUntil(dateStr: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + "T00:00:00");
  return Math.round((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

const CATEGORY_EMOJI: Record<string, string> = {
  "Food & Dining": "🍔",
  "Groceries": "🛒",
  "Entertainment": "🎬",
  "Shopping": "🛍️",
  "Transportation": "🚗",
  "Health & Fitness": "💪",
  "Utilities": "⚡",
  "Telecommunications": "📱",
  "Software": "💻",
  "Streaming": "📺",
  "Subscriptions": "🔄",
  "Travel": "✈️",
  "Education": "📚",
  "Insurance": "🛡️",
  "Peer Payment": "👤",
  "Other": "📦",
};

function getCategoryEmoji(category: string): string {
  return CATEGORY_EMOJI[category] ?? "📦";
}

const FREQ_COLORS: Record<string, string> = {
  Monthly:        "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  "Twice Monthly": "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20",
  Weekly:         "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
  Annually:       "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
};

function FreqBadge({ frequency }: { frequency: string }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${FREQ_COLORS[frequency] ?? ""}`}>
      {frequency}
    </span>
  );
}

function NextChargeBadge({ nextExpectedDate }: { nextExpectedDate: string }) {
  const days = daysUntil(nextExpectedDate);
  if (days < 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 border border-red-500/20 px-2 py-0.5 text-[10px] font-semibold text-red-600 dark:text-red-400">
        <AlertTriangle className="h-2.5 w-2.5" />
        Overdue {Math.abs(days)}d
      </span>
    );
  }
  if (days <= 5) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
        <Clock className="h-2.5 w-2.5" />
        Due in {days}d
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
      <Calendar className="h-2.5 w-2.5" />
      {fmtDate(nextExpectedDate)}
    </span>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  icon,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  accent: string;
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
          <div className={`rounded-lg p-2 ${accent.replace("text-", "bg-").replace("-600", "-500/10").replace("-400", "-400/10")}`}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Subscription Card ────────────────────────────────────────────────────────

function SubscriptionCard({ item }: { item: SubscriptionItem }) {
  const perPeriod =
    item.frequency === "Monthly"
      ? `${fmt(item.amount)}/mo`
      : item.frequency === "Weekly"
      ? `${fmt(item.amount)}/wk`
      : `${fmt(item.amount)}/yr`;

  return (
    <div className="flex items-start gap-4 rounded-xl border border-border bg-card px-4 py-4 hover:bg-muted/30 transition-colors">
      {/* Emoji icon */}
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-muted text-xl">
        {getCategoryEmoji(item.category)}
      </div>

      {/* Main info */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-sm font-semibold text-foreground">{item.merchant}</span>
          <FreqBadge frequency={item.frequency} />
          {item.amountIncreased && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-orange-500/10 border border-orange-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-orange-600 dark:text-orange-400">
              <TrendingUp className="h-2.5 w-2.5" />
              Amount up
            </span>
          )}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-xs text-muted-foreground">
            Last charged {fmtDate(item.lastChargedDate)}
          </span>
          <span className="text-xs text-muted-foreground">
            {item.count} charges detected
          </span>
        </div>
        <div className="mt-1.5">
          <NextChargeBadge nextExpectedDate={item.nextExpectedDate} />
        </div>
      </div>

      {/* Amount */}
      <div className="flex-shrink-0 text-right">
        <p className="text-sm font-bold text-foreground font-mono">{perPeriod}</p>
        <p className="mt-0.5 text-xs text-muted-foreground font-mono">
          {fmt(item.annualizedCost)}/yr
        </p>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type FreqFilter = "All" | "Monthly" | "Twice Monthly" | "Weekly" | "Annually";

export default function Subscriptions() {
  const [freqFilter, setFreqFilter] = useState<FreqFilter>("All");

  const { data, isLoading } = useQuery<RecurringData>({
    queryKey: ["/api/analytics/recurring"],
  });

  const items = data?.items ?? [];
  const totalAnnualCost = data?.totalAnnualCost ?? 0;

  const stats = useMemo(() => {
    const monthly      = items.filter((i) => i.frequency === "Monthly");
    const twiceMonthly = items.filter((i) => i.frequency === "Twice Monthly");
    const weekly       = items.filter((i) => i.frequency === "Weekly");
    const annually     = items.filter((i) => i.frequency === "Annually");
    const upcomingIn7  = items.filter((i) => {
      const d = daysUntil(i.nextExpectedDate);
      return d >= 0 && d <= 7;
    });
    // Monthly fixed = true monthly + twice-monthly (each occurrence)
    const monthlyFixedTotal = Math.round((
      monthly.reduce((s, i) => s + i.amount, 0) +
      twiceMonthly.reduce((s, i) => s + i.amount * 2, 0) +
      weekly.reduce((s, i) => s + i.amount * 4.33, 0)
    ) * 100) / 100;

    return {
      monthlyTotal:      monthlyFixedTotal,
      weeklyTotal:       Math.round(weekly.reduce((s, i) => s + i.amount, 0) * 100) / 100,
      upcomingIn7:       upcomingIn7.length,
      monthlyCount:      monthly.length,
      twiceMonthlyCount: twiceMonthly.length,
      weeklyCount:       weekly.length,
      annuallyCount:     annually.length,
    };
  }, [items]);

  const filtered = useMemo(
    () => (freqFilter === "All" ? items : items.filter((i) => i.frequency === freqFilter)),
    [items, freqFilter]
  );

  const FILTERS: FreqFilter[] = ["All", "Monthly", "Twice Monthly", "Weekly", "Annually"];

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Fixed Costs</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Auto-detected recurring charges — your financial floor before you spend a single dollar
          </p>
        </div>

        {/* Stats */}
        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="admin-card border-none shadow-sm">
                <CardContent className="pt-5 pb-4 px-5">
                  <Skeleton className="h-4 w-24 mb-2" />
                  <Skeleton className="h-7 w-32" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Annual Fixed Cost"
              value={fmt(totalAnnualCost)}
              sub={`${items.length} recurring charges`}
              icon={<DollarSign className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />}
              accent="text-emerald-600 dark:text-emerald-400"
            />
            <StatCard
              label="Monthly Fixed"
              value={fmt(stats.monthlyTotal)}
              sub={`${stats.monthlyCount} subscriptions`}
              icon={<RefreshCw className="h-4 w-4 text-blue-600 dark:text-blue-400" />}
              accent="text-blue-600 dark:text-blue-400"
            />
            <StatCard
              label="Weekly Fixed"
              value={fmt(stats.weeklyTotal)}
              sub={`${stats.weeklyCount} recurring`}
              icon={<RefreshCw className="h-4 w-4 text-purple-600 dark:text-purple-400" />}
              accent="text-purple-600 dark:text-purple-400"
            />
            <StatCard
              label="Due This Week"
              value={String(stats.upcomingIn7)}
              sub="charges expected in 7 days"
              icon={<Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />}
              accent="text-amber-600 dark:text-amber-400"
            />
          </div>
        )}

        {/* Frequency filter */}
        <div className="flex gap-2 flex-wrap">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFreqFilter(f)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors border ${
                freqFilter === f
                  ? "bg-emerald-500 text-white border-emerald-500 shadow-sm"
                  : "bg-card text-muted-foreground border-border hover:bg-muted"
              }`}
            >
              {f}
              {f !== "All" && (
                <span className="ml-1.5 text-xs opacity-70">
                  ({items.filter((i) => i.frequency === f).length})
                </span>
              )}
            </button>
          ))}
        </div>

        {/* List */}
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-start gap-4 rounded-xl border border-border bg-card px-4 py-4">
                <Skeleton className="h-10 w-10 rounded-xl flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-60" />
                  <Skeleton className="h-5 w-24 rounded-full" />
                </div>
                <div className="space-y-1 text-right">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <Card className="admin-card border-none shadow-sm">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <RefreshCw className="h-10 w-10 text-muted-foreground/30 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">
                {items.length === 0
                  ? "No recurring charges detected yet"
                  : `No ${freqFilter.toLowerCase()} recurring charges`}
              </p>
              <p className="mt-1 text-xs text-muted-foreground/60">
                {items.length === 0
                  ? "Import more statements to detect patterns"
                  : "Try a different frequency filter"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {filtered.map((item, i) => (
              <SubscriptionCard key={`${item.merchant}-${i}`} item={item} />
            ))}
          </div>
        )}

        {/* Footer note */}
        {!isLoading && items.length > 0 && (
          <p className="text-center text-xs text-muted-foreground/60 pb-4">
            Recurring charges are detected automatically from your transaction history.
            A charge must appear in 3+ months with a consistent amount and interval to qualify.
          </p>
        )}

      </div>
    </div>
  );
}
