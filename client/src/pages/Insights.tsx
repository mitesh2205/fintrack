import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Treemap,
  Cell,
} from "recharts";
import {
  Sparkles,
  IndianRupee,
  Repeat2,
  MapPin,
  Star,
  TrendingUp,
  ShoppingBag,
  Utensils,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────

interface Merchant {
  merchant: string;
  total: number;
  count: number;
  avgPerVisit: number;
  category: string;
  lastDate: string;
}

// ─── Category colour palette ─────────────────────────────────────────────────

const CAT_COLORS: Record<string, string> = {
  Groceries: "#10b981",
  "Food & Dining": "#f59e0b",
  Shopping: "#8b5cf6",
  Travel: "#3b82f6",
  Entertainment: "#ec4899",
  "Gas & Fuel": "#f97316",
  "Bills & Utilities": "#64748b",
  Education: "#14b8a6",
  Business: "#94a3b8",
  "Health & Fitness": "#22c55e",
  "Peer Payment": "#a855f7",
  Taxes: "#ef4444",
  "Loan Repayment": "#dc2626",
  Transportation: "#0ea5e9",
  "Personal Care": "#d97706",
  "Gifts & Donations": "#f43f5e",
  "Bank Fees": "#6366f1",
};

function catColor(cat: string) {
  return CAT_COLORS[cat] ?? "#6b7280";
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${n.toFixed(0)}`;
}
function fmtFull(n: number) {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ─── Stagger animation helper ─────────────────────────────────────────────────

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.45, ease: "easeOut" },
  }),
};

// ─── Custom scatter tooltip ───────────────────────────────────────────────────

function BubbleTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-xl border border-border bg-card/95 backdrop-blur-sm px-4 py-3 shadow-xl text-sm">
      <p className="font-semibold text-foreground mb-1">{d.merchant}</p>
      <div
        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium mb-2"
        style={{ background: catColor(d.category) + "22", color: catColor(d.category) }}
      >
        {d.category}
      </div>
      <div className="space-y-0.5 text-muted-foreground">
        <p>Total spent: <span className="text-foreground font-medium">{fmtFull(d.total)}</span></p>
        <p>Visits: <span className="text-foreground font-medium">{d.count}×</span></p>
        <p>Avg / visit: <span className="text-foreground font-medium">{fmtFull(d.avgPerVisit)}</span></p>
      </div>
    </div>
  );
}

// ─── Custom treemap cell ──────────────────────────────────────────────────────

function TreemapCell(props: any) {
  const { x, y, width, height, name, value, category, depth } = props;
  if (width < 2 || height < 2) return null;
  const color = catColor(category ?? name);
  const showLabel = width > 55 && height > 30;
  const showValue = width > 70 && height > 48;

  return (
    <g>
      <rect
        x={x + 1}
        y={y + 1}
        width={width - 2}
        height={height - 2}
        rx={6}
        style={{
          fill: depth === 1 ? color + "30" : color,
          stroke: color,
          strokeWidth: depth === 1 ? 1.5 : 0,
          opacity: 0.92,
        }}
      />
      {showLabel && (
        <text
          x={x + 8}
          y={y + 20}
          fill={depth === 1 ? color : "#fff"}
          fontSize={depth === 1 ? 11 : 12}
          fontWeight={depth === 1 ? 600 : 500}
          style={{ pointerEvents: "none", userSelect: "none" }}
        >
          {name?.length > 16 ? name.slice(0, 15) + "…" : name}
        </text>
      )}
      {showValue && depth !== 1 && (
        <text
          x={x + 8}
          y={y + 35}
          fill="rgba(255,255,255,0.8)"
          fontSize={10}
          style={{ pointerEvents: "none", userSelect: "none" }}
        >
          {fmt(value)}
        </text>
      )}
    </g>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Insights() {
  const { data: merchants = [], isLoading } = useQuery<Merchant[]>({
    queryKey: ["/api/analytics/merchants"],
    queryFn: () => fetch("/api/analytics/merchants").then((r) => r.json()),
  });

  // ── Derived data ────────────────────────────────────────────────────────────

  // Scatter data — exclude massive outliers (Peer Payment, Taxes etc.) for a
  // readable chart; keep everything for treemap.
  const scatterMerchants = merchants.filter(
    (m) => !["Peer Payment", "Taxes", "Loan Repayment"].includes(m.category)
  );

  // Median visit count & avg/visit to draw quadrant lines
  const medCount = scatterMerchants.length
    ? [...scatterMerchants].sort((a, b) => a.count - b.count)[
        Math.floor(scatterMerchants.length / 2)
      ]?.count ?? 3
    : 3;
  const medAvg = scatterMerchants.length
    ? [...scatterMerchants].sort((a, b) => a.avgPerVisit - b.avgPerVisit)[
        Math.floor(scatterMerchants.length / 2)
      ]?.avgPerVisit ?? 20
    : 20;

  // Group by category for scatter series
  const categories = Array.from(new Set(scatterMerchants.map((m) => m.category)));
  const scatterSeries = categories.map((cat) => ({
    cat,
    data: scatterMerchants.filter((m) => m.category === cat),
  }));

  // Treemap data — top categories and their top merchants
  const catGroups: Record<string, Merchant[]> = {};
  for (const m of merchants) {
    if (!catGroups[m.category]) catGroups[m.category] = [];
    catGroups[m.category].push(m);
  }
  const treemapData = {
    name: "Spending",
    children: Object.entries(catGroups)
      .sort(([, a], [, b]) => b.reduce((s, x) => s + x.total, 0) - a.reduce((s, x) => s + x.total, 0))
      .slice(0, 10)
      .map(([cat, ms]) => ({
        name: cat,
        category: cat,
        children: ms.slice(0, 6).map((m) => ({
          name: m.merchant,
          value: m.total,
          category: cat,
        })),
      })),
  };

  // DNA stat cards
  const topByVisits = [...merchants].sort((a, b) => b.count - a.count)[0];
  const topByTotal = merchants[0];
  const groceryTotal = merchants
    .filter((m) => m.category === "Groceries")
    .reduce((s, m) => s + m.total, 0);
  const groceryCount = merchants
    .filter((m) => m.category === "Groceries")
    .reduce((s, m) => s + m.count, 0);
  const avgGroceryRun = groceryCount ? groceryTotal / groceryCount : 0;

  const foodTotal = merchants
    .filter((m) => ["Food & Dining", "Groceries"].includes(m.category))
    .reduce((s, m) => s + m.total, 0);
  const indianMerchants = merchants.filter((m) =>
    /apni mandi|ulavacharu|paradise biryani|patel brothers|new india|india bazar|mylapore|samosa|chaat|biryani/i.test(
      m.merchant
    )
  );
  const indianTotal = indianMerchants.reduce((s, m) => s + m.total, 0);
  const indianPct = foodTotal ? Math.round((indianTotal / foodTotal) * 100) : 0;

  const aiMerchants = merchants.filter((m) =>
    /claude|openai|anthropic|perplexity/i.test(m.merchant)
  );
  const aiTotal = aiMerchants.reduce((s, m) => s + m.total, 0);

  const dnaCards = [
    {
      icon: <Star className="h-5 w-5" />,
      color: "#f59e0b",
      label: "Most Loyal To",
      value: topByVisits?.merchant ?? "—",
      sub: `${topByVisits?.count ?? 0} visits · ${fmtFull(topByVisits?.total ?? 0)} total`,
    },
    {
      icon: <ShoppingBag className="h-5 w-5" />,
      color: "#8b5cf6",
      label: "Biggest Wallet Hit",
      value: topByTotal?.merchant ?? "—",
      sub: `${fmtFull(topByTotal?.total ?? 0)} · ${topByTotal?.count ?? 0} transactions`,
    },
    {
      icon: <Utensils className="h-5 w-5" />,
      color: "#10b981",
      label: "Indian Food Share",
      value: `${indianPct}%`,
      sub: `${fmtFull(indianTotal)} of ${fmtFull(foodTotal)} food spend`,
    },
    {
      icon: <Sparkles className="h-5 w-5" />,
      color: "#ec4899",
      label: "AI Subscriptions",
      value: fmtFull(aiTotal),
      sub: aiMerchants.map((m) => m.merchant).join(", ") || "None",
    },
    {
      icon: <IndianRupee className="h-5 w-5" />,
      color: "#3b82f6",
      label: "Avg Grocery Run",
      value: fmtFull(avgGroceryRun),
      sub: `${groceryCount} trips · ${fmtFull(groceryTotal)} total`,
    },
  ];

  const leaderboard = merchants.slice(0, 15);
  const maxTotal = leaderboard[0]?.total ?? 1;

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
    <div className="min-h-full bg-background px-4 py-6 md:px-8 md:py-8 space-y-10">

      {/* ── Page header ──────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <div className="flex items-center gap-3 mb-1">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10">
            <Sparkles className="h-5 w-5 text-emerald-500" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Spending Insights</h1>
        </div>
        <p className="text-sm text-muted-foreground ml-12">
          Where your money actually goes — across {merchants.length} merchants
        </p>
      </motion.div>

      {/* ── Section 1 · DNA stat cards ──────────────────────────────── */}
      <div>
        <SectionLabel icon={<Star className="h-4 w-4" />} label="Your Spending DNA" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 mt-3">
          {dnaCards.map((card, i) => (
            <motion.div
              key={card.label}
              custom={i}
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              className="rounded-2xl border border-border bg-card p-4 flex flex-col gap-2 hover:shadow-md transition-shadow"
            >
              <div
                className="flex h-8 w-8 items-center justify-center rounded-lg"
                style={{ background: card.color + "1a", color: card.color }}
              >
                {card.icon}
              </div>
              <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider leading-tight">
                {card.label}
              </p>
              <p className="text-lg font-bold leading-tight text-foreground truncate">{card.value}</p>
              <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2">{card.sub}</p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* ── Section 2 · Spending Matrix (bubble scatter) ─────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.5 }}
      >
        <SectionLabel
          icon={<TrendingUp className="h-4 w-4" />}
          label="Spending Priority Matrix"
          sub="Bubble size = total spend · Top-right = most impactful to cut"
        />
        <div className="mt-3 rounded-2xl border border-border bg-card p-4 md:p-6">
          {/* Quadrant legend */}
          <div className="mb-4 grid grid-cols-2 gap-2 md:flex md:gap-4">
            {[
              { label: "High Priority", color: "#ef4444", desc: "Frequent + expensive" },
              { label: "Splurges", color: "#f97316", desc: "Rare + pricey" },
              { label: "Daily Habits", color: "#10b981", desc: "Frequent + cheap" },
              { label: "Background Noise", color: "#6b7280", desc: "Rare + cheap" },
            ].map((q) => (
              <div key={q.label} className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ background: q.color }} />
                <span><strong className="text-foreground">{q.label}</strong> — {q.desc}</span>
              </div>
            ))}
          </div>

          <div className="relative">
            {/* Quadrant background labels */}
            <div className="pointer-events-none absolute inset-0 grid grid-cols-2 grid-rows-2 z-10 px-10 py-4">
              {[
                { label: "🔴 High Priority", pos: "col-start-2 row-start-1", align: "text-right" },
                { label: "🟠 Splurges", pos: "col-start-1 row-start-1", align: "text-left" },
                { label: "🟢 Daily Habits", pos: "col-start-2 row-start-2", align: "text-right" },
                { label: "⚪ Background", pos: "col-start-1 row-start-2", align: "text-left" },
              ].map((q) => (
                <div
                  key={q.label}
                  className={`${q.pos} ${q.align} text-[10px] text-muted-foreground/40 font-medium flex items-center`}
                >
                  {q.label}
                </div>
              ))}
            </div>

            <ResponsiveContainer width="100%" height={420}>
              <ScatterChart margin={{ top: 16, right: 24, bottom: 16, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                <XAxis
                  dataKey="count"
                  name="Visits"
                  type="number"
                  label={{ value: "Number of Visits →", position: "insideBottom", offset: -6, fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  dataKey="avgPerVisit"
                  name="Avg/Visit"
                  type="number"
                  tickFormatter={(v) => `$${v}`}
                  label={{ value: "Avg $ per Visit →", angle: -90, position: "insideLeft", offset: 16, fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <ZAxis dataKey="total" range={[120, 2400]} name="Total" />
                <Tooltip content={<BubbleTooltip />} />
                {scatterSeries.map(({ cat, data }) => (
                  <Scatter key={cat} name={cat} data={data} fill={catColor(cat)} fillOpacity={0.82}>
                    {data.map((_, i) => (
                      <Cell key={i} fill={catColor(cat)} />
                    ))}
                  </Scatter>
                ))}
              </ScatterChart>
            </ResponsiveContainer>
          </div>

          {/* Category legend */}
          <div className="mt-3 flex flex-wrap gap-2">
            {categories.map((cat) => (
              <div key={cat} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ background: catColor(cat) }} />
                {cat}
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* ── Section 3 · Category Treemap ─────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.5 }}
      >
        <SectionLabel
          icon={<MapPin className="h-4 w-4" />}
          label="Where Your Money Flows"
          sub="Category → merchant breakdown · area = spend size"
        />
        <div className="mt-3 rounded-2xl border border-border bg-card p-4 md:p-6">
          <ResponsiveContainer width="100%" height={380}>
            <Treemap
              data={treemapData.children}
              dataKey="value"
              aspectRatio={4 / 3}
              stroke="transparent"
              content={<TreemapCell />}
            >
              {treemapData.children.map((cat) => (
                <Cell key={cat.name} fill={catColor(cat.name)} />
              ))}
            </Treemap>
          </ResponsiveContainer>
          <div className="mt-3 flex flex-wrap gap-2">
            {treemapData.children.map((cat) => (
              <div key={cat.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ background: catColor(cat.name) }} />
                {cat.name}
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* ── Section 4 · Top Merchants leaderboard ───────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.5 }}
      >
        <SectionLabel
          icon={<Repeat2 className="h-4 w-4" />}
          label="Merchant Leaderboard"
          sub="Your top 15 by total spend"
        />
        <div className="mt-3 rounded-2xl border border-border bg-card divide-y divide-border overflow-hidden">
          {leaderboard.map((m, i) => {
            const barPct = (m.total / maxTotal) * 100;
            const color = catColor(m.category);
            return (
              <motion.div
                key={m.merchant}
                custom={i}
                initial="hidden"
                animate="visible"
                variants={fadeUp}
                className="flex items-center gap-4 px-4 py-3 hover:bg-muted/30 transition-colors"
              >
                {/* Rank */}
                <span
                  className="w-7 h-7 flex-shrink-0 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{
                    background: i < 3 ? color + "22" : "hsl(var(--muted))",
                    color: i < 3 ? color : "hsl(var(--muted-foreground))",
                  }}
                >
                  {i + 1}
                </span>

                {/* Merchant + bar */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1 gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-medium text-sm text-foreground truncate">{m.merchant}</span>
                      <span
                        className="flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium"
                        style={{ background: color + "22", color }}
                      >
                        {m.category}
                      </span>
                    </div>
                    <span className="text-sm font-semibold text-foreground flex-shrink-0">{fmtFull(m.total)}</span>
                  </div>
                  {/* Animated bar */}
                  <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: color }}
                      initial={{ width: 0 }}
                      animate={{ width: `${barPct}%` }}
                      transition={{ delay: 0.4 + i * 0.04, duration: 0.6, ease: "easeOut" }}
                    />
                  </div>
                </div>

                {/* Visit count */}
                <div className="flex-shrink-0 text-right hidden sm:block">
                  <p className="text-sm font-medium text-foreground">{m.count}×</p>
                  <p className="text-[11px] text-muted-foreground">{fmtFull(m.avgPerVisit)}/visit</p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </motion.div>

      {/* bottom padding */}
      <div className="h-6" />
    </div>
  );
}

// ─── Section label helper ─────────────────────────────────────────────────────

function SectionLabel({
  icon,
  label,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  sub?: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-500">
        {icon}
      </div>
      <div>
        <h2 className="text-base font-semibold text-foreground">{label}</h2>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}
