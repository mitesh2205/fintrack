import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { parseCSV, parsePDFText, detectInstitution, inferCategory } from "./parsers";
import type { Transaction } from "@shared/schema";
import multer from "multer";

// Categories that represent money moving between own accounts —
// NOT real income or expenses.
const EXCLUDED_FROM_TOTALS = new Set(["Transfer", "Payment", "Investment"]);

// Categories that aren't real merchant spending — exclude from
// "Top Merchants" and "Recurring" analytics. Loan/remittance and
// own-account transfers are internal flows, not spending.
// Peer Payment is intentionally included: recurring peer payments
// (e.g. rent paid via Zelle) and top recipients are valuable insights.
const NON_MERCHANT_CATEGORIES = new Set([
  "Transfer", "Payment", "Investment", "Loan Repayment",
]);

// pdf-parse v2 is loaded dynamically to avoid CJS/ESM bundling issues
let PDFParseClass: any = null;
async function parsePDF(buffer: Buffer): Promise<string> {
  if (!PDFParseClass) {
    const mod = await import("pdf-parse");
    PDFParseClass = mod.PDFParse;
  }
  const uint8 = new Uint8Array(buffer);
  const parser = new PDFParseClass(uint8);
  const result = await parser.getText();
  return result.text;
}

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // === ACCOUNTS ===
  app.get("/api/accounts", async (_req, res) => {
    const accounts = await storage.getAccounts();
    res.json(accounts);
  });

  app.post("/api/accounts", async (req, res) => {
    try {
      const account = await storage.createAccount(req.body);
      res.json(account);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.patch("/api/accounts/:id", async (req, res) => {
    const updated = await storage.updateAccount(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: "Not found" });
    res.json(updated);
  });

  app.delete("/api/accounts/:id", async (req, res) => {
    await storage.deleteTransactionsByAccount(req.params.id);
    await storage.deleteAccount(req.params.id);
    res.json({ ok: true });
  });

  // === TRANSACTIONS ===
  app.get("/api/transactions", async (req, res) => {
    const { accountId, category, startDate, endDate } = req.query as any;
    const transactions = await storage.getTransactions({
      accountId,
      category,
      startDate,
      endDate,
    });
    res.json(transactions);
  });

  app.patch("/api/transactions/:id", async (req, res) => {
    const updated = await storage.updateTransaction(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: "Not found" });
    res.json(updated);
  });

  app.delete("/api/transactions/:id", async (req, res) => {
    await storage.deleteTransaction(req.params.id);
    res.json({ ok: true });
  });

  // === UPLOAD / PARSE STATEMENTS ===
  app.post("/api/upload", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const { accountId, institution } = req.body;
      if (!accountId) {
        return res.status(400).json({ error: "Account ID required" });
      }

      const fileName = req.file.originalname.toLowerCase();
      const mimeType = req.file.mimetype;
      let transactions: any[] = [];

      if (fileName.endsWith(".csv") || mimeType === "text/csv") {
        const content = req.file.buffer.toString("utf-8");
        const detected = institution || detectInstitution(content);
        transactions = parseCSV(content, accountId, detected);
      } else if (fileName.endsWith(".pdf") || mimeType === "application/pdf") {
        // Parse PDF using pdf-parse v2
        const text = await parsePDF(req.file.buffer);
        const inst = institution || "unknown";
        transactions = parsePDFText(text, accountId, inst);
      } else {
        return res.status(400).json({ error: "Unsupported file type. Use CSV or PDF." });
      }

      if (transactions.length === 0) {
        return res.status(400).json({ error: "No transactions found in file. Check format." });
      }

      const { created, skipped } = await storage.createTransactions(transactions);
      res.json({ count: created.length, skipped, transactions: created });
    } catch (e: any) {
      console.error("Upload error:", e);
      res.status(500).json({ error: e.message || "Failed to parse file" });
    }
  });

  // === BUDGETS ===
  app.get("/api/budgets", async (_req, res) => {
    const budgets = await storage.getBudgets();
    res.json(budgets);
  });

  app.post("/api/budgets", async (req, res) => {
    try {
      const budget = await storage.createBudget(req.body);
      res.json(budget);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.patch("/api/budgets/:id", async (req, res) => {
    const updated = await storage.updateBudget(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: "Not found" });
    res.json(updated);
  });

  app.delete("/api/budgets/:id", async (req, res) => {
    await storage.deleteBudget(req.params.id);
    res.json({ ok: true });
  });

  // === GOALS ===
  app.get("/api/goals", async (_req, res) => {
    const data = await storage.getGoals();
    res.json(data);
  });

  app.post("/api/goals", async (req, res) => {
    try {
      const goal = await storage.createGoal(req.body);
      res.json(goal);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.patch("/api/goals/:id", async (req, res) => {
    const updated = await storage.updateGoal(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: "Not found" });
    res.json(updated);
  });

  app.delete("/api/goals/:id", async (req, res) => {
    await storage.deleteGoal(req.params.id);
    res.json({ ok: true });
  });

  // === ANALYTICS ===
  app.get("/api/analytics/summary", async (req, res) => {
    const { startDate, endDate } = req.query as any;
    const transactions = await storage.getTransactions({ startDate, endDate });

    let totalIncome = 0;
    let totalExpenses = 0;
    let totalRefunds = 0;
    let totalPeerReimbursements = 0;
    let transferVolume = 0;
    const categoryTotals: Record<string, number> = {};
    const monthlyTotals: Record<string, { income: number; expenses: number }> = {};

    for (const tx of transactions) {
      const isExcluded = EXCLUDED_FROM_TOTALS.has(tx.category);
      const isRefund = tx.category === "Refund/Return";
      // Incoming Zelle/Venmo from other people: cost-sharing, not salary.
      // Track separately so the Income card shows real earnings only.
      const isPeerReimbursement = tx.category === "Peer Payment" && tx.amount > 0;

      if (isExcluded) {
        transferVolume += Math.abs(tx.amount);
      } else if (isPeerReimbursement) {
        totalPeerReimbursements += tx.amount;
      } else if (isRefund) {
        // Refunds reduce expenses — they are NOT income
        totalRefunds += tx.amount;           // positive amount (money back)
        totalExpenses -= tx.amount;          // subtract from expenses total
      } else {
        if (tx.amount >= 0) {
          totalIncome += tx.amount;
        } else {
          totalExpenses += Math.abs(tx.amount);
        }
      }

      // Category breakdown (real expenses only — exclude payments, transfers & refunds)
      if (tx.amount < 0 && !EXCLUDED_FROM_TOTALS.has(tx.category) && !isRefund) {
        categoryTotals[tx.category] = (categoryTotals[tx.category] || 0) + Math.abs(tx.amount);
      }

      // Monthly totals (exclude transfers/payments; peer reimbursements & refunds reduce expenses)
      const month = tx.date.substring(0, 7);
      if (!monthlyTotals[month]) {
        monthlyTotals[month] = { income: 0, expenses: 0 };
      }
      if (isExcluded || isPeerReimbursement) {
        // skip — neither income nor expense in the monthly view
      } else if (isRefund) {
        monthlyTotals[month].expenses = Math.max(0, monthlyTotals[month].expenses - tx.amount);
      } else {
        if (tx.amount >= 0) {
          monthlyTotals[month].income += tx.amount;
        } else {
          monthlyTotals[month].expenses += Math.abs(tx.amount);
        }
      }
    }

    const categoryBreakdown = Object.entries(categoryTotals)
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount);

    const monthlyBreakdown = Object.entries(monthlyTotals)
      .map(([month, data]) => ({ month, ...data }))
      .sort((a, b) => a.month.localeCompare(b.month));

    res.json({
      totalIncome,
      totalExpenses,
      netFlow: totalIncome - totalExpenses,
      totalRefunds,
      totalPeerReimbursements,
      transferVolume,
      transactionCount: transactions.length,
      categoryBreakdown,
      monthlyBreakdown,
    });
  });

  // === Helper for Analytics ===
  function normalizeMerchantName(tx: Transaction): string | null {
    const rawName = tx.merchant || tx.description || "";
    let name = rawName;
    
    const lowerRaw = rawName.toLowerCase();
    
    // Zelle Special Handling
    if (lowerRaw.includes("zelle")) {
      const match = rawName.match(/zelle payment (?:from|to) (.+?)(?: for | conf#|;|\s+[A-Z0-9]+$|$)/i);
      if (match && match[1]) {
         const person = match[1].trim().toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
         return `Zelle - ${person}`;
      }
      return "Zelle";
    }

    // Clean ACH bank formats
    if (name.includes(" DES:")) name = name.split(" DES:")[0];
    if (name.includes("Instant Payment;")) name = name.replace("Instant Payment;", "");

    // Remove filler
    name = name.replace(/\b(payment|transfer|from|to)\b/gi, "");

    // Remove phone numbers
    name = name.replace(/[0-9]{3}-?[0-9]{3}-?[0-9]{4}/g, "");

    // Strip payment-processor prefixes (e.g. "SQ *FIVE SPICE", "TST*ULAVACHARU",
    // "DD *DOORDASH", "CTL*INNOVATIVE FOTO") so the actual merchant name surfaces.
    name = name.replace(/^\s*(SQ|TST|DD|DP|PY|PP|GP|EP|UB|MP|CTL|IN)\s*\*\s*/i, "");

    // Remove remaining asterisks and hashes
    name = name.replace(/[*#]/g, "");

    const lowerName = name.toLowerCase();
    
    // Known overrides based on actual statement data
    if (lowerName.includes("cybrid")) return "Cybrid-Crobo";
    if (lowerName.includes("claude.ai") || lowerName.includes("anthropic")) return "Claude.ai";
    if (lowerName.includes("uber") && lowerName.includes("eats")) return "Uber Eats";
    if (lowerName.includes("uber")) return "Uber";
    if (lowerName.includes("starbucks")) return "Starbucks";
    if (lowerName.includes("robinhood")) return "Robinhood";
    if (lowerName.includes("apple") && lowerName.includes("savings")) return "Apple Savings";
    if (lowerName.includes("applecard") || lowerName.includes("apple card")) return "Apple Card";
    if (lowerName.includes("paypal")) return "PayPal";
    if (lowerName.includes("venmo")) return "Venmo";

    // Clean numbers and extra spaces
    name = name.replace(/[0-9]/g, "").trim();

    // Take first 2 words — folds trailing city/branch (e.g. "Apni Mandi Milpitas"
    // → "Apni Mandi", "Patel Brothers Monroeville" → "Patel Brothers").
    name = name.split(/\s+/).slice(0, 2).join(" ");

    if (!name || name.length < 3) return null;
    return name.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  }

  // === Investment Analytics ===
  app.get("/api/analytics/investments", async (req, res) => {
    const txns = await storage.getTransactions({ category: "Investment" });

    function normalizePlatform(desc: string): string {
      const d = desc.toLowerCase();
      if (d.includes("robinhood")) return "Robinhood";
      if (d.includes("apple gs")) return "Apple GS Savings";
      if (d.includes("dub")) return "DUB";
      return "Other";
    }

    type PlatformAgg = {
      deposited: number;
      withdrawn: number;
      count: number;
      firstDate: string;
      lastDate: string;
      monthMap: Record<string, number>;
    };
    const platformMap: Record<string, PlatformAgg> = {};
    const allMonthSet = new Set<string>();

    for (const tx of txns) {
      const platform = normalizePlatform(tx.description);
      const month = tx.date.substring(0, 7);
      allMonthSet.add(month);

      if (!platformMap[platform]) {
        platformMap[platform] = {
          deposited: 0, withdrawn: 0, count: 0,
          firstDate: tx.date, lastDate: tx.date, monthMap: {},
        };
      }
      const p = platformMap[platform];
      p.count++;
      if (tx.date < p.firstDate) p.firstDate = tx.date;
      if (tx.date > p.lastDate) p.lastDate = tx.date;

      if (tx.amount < 0) {
        const abs = Math.abs(tx.amount);
        p.deposited += abs;
        p.monthMap[month] = (p.monthMap[month] ?? 0) + abs;
      } else {
        p.withdrawn += tx.amount;
      }
    }

    const allMonths = Array.from(allMonthSet).sort();
    const round = (n: number) => Math.round(n * 100) / 100;

    const platforms = Object.entries(platformMap).map(([name, p]) => ({
      name,
      totalDeposited: round(p.deposited),
      totalWithdrawn: round(p.withdrawn),
      netInvested: round(p.deposited - p.withdrawn),
      transactionCount: p.count,
      firstDate: p.firstDate,
      lastDate: p.lastDate,
      monthlyDeposits: allMonths.map((m) => ({
        month: m,
        amount: round(p.monthMap[m] ?? 0),
      })),
    }));

    // Monthly stacked deposits per platform
    const monthlyStackedData = allMonths.map((month) => {
      const row: Record<string, any> = { month };
      for (const p of platforms) {
        const md = p.monthlyDeposits.find((d) => d.month === month);
        row[p.name] = md?.amount ?? 0;
      }
      return row;
    });

    // Cumulative invested over time
    let cumulative = 0;
    const cumulativeData = allMonths.map((month) => {
      const monthTotal = platforms.reduce((s, p) => {
        const md = p.monthlyDeposits.find((d) => d.month === month);
        return s + (md?.amount ?? 0);
      }, 0);
      cumulative += monthTotal;
      return { month, cumulative: round(cumulative) };
    });

    const totalDeposited = round(platforms.reduce((s, p) => s + p.totalDeposited, 0));
    const totalWithdrawn = round(platforms.reduce((s, p) => s + p.totalWithdrawn, 0));

    // Recent transactions enriched with platform name
    const recentTxns = [...txns]
      .sort((a, b) => (b.date > a.date ? 1 : -1))
      .slice(0, 30)
      .map((tx) => ({
        date: tx.date,
        description: tx.description,
        amount: tx.amount,
        platform: normalizePlatform(tx.description),
      }));

    res.json({
      platforms,
      monthlyStackedData,
      cumulativeData,
      allMonths,
      recentTransactions: recentTxns,
      summary: {
        totalDeposited,
        totalWithdrawn,
        netInvested: round(totalDeposited - totalWithdrawn),
        platformCount: platforms.length,
        transactionCount: txns.length,
        activeMonths: allMonths.length,
      },
    });
  });

  // === By-Account Analytics ===
  app.get("/api/analytics/by-account", async (req, res) => {
    const { startDate, endDate } = req.query as any;
    const [allAccounts, txns] = await Promise.all([
      storage.getAccounts(),
      storage.getTransactions({ startDate, endDate }),
    ]);

    type AccAgg = {
      expenses: number;
      count: number;
      monthMap: Record<string, number>;
      catMap: Record<string, number>;
    };
    const agg: Record<string, AccAgg> = {};

    for (const tx of txns) {
      if (tx.amount >= 0) continue;
      if (EXCLUDED_FROM_TOTALS.has(tx.category)) continue;

      const { accountId, category, date } = tx;
      const month = date.substring(0, 7);
      const abs = Math.abs(tx.amount);

      if (!agg[accountId]) agg[accountId] = { expenses: 0, count: 0, monthMap: {}, catMap: {} };
      agg[accountId].expenses += abs;
      agg[accountId].count += 1;
      agg[accountId].monthMap[month] = (agg[accountId].monthMap[month] ?? 0) + abs;
      agg[accountId].catMap[category] = (agg[accountId].catMap[category] ?? 0) + abs;
    }

    // All months across all accounts, sorted
    const allMonths = Array.from(new Set(
      Object.values(agg).flatMap((a) => Object.keys(a.monthMap))
    )).sort();

    // Per-account summary objects
    const accounts = allAccounts.map((acct) => {
      const a = agg[acct.id] ?? { expenses: 0, count: 0, monthMap: {}, catMap: {} };
      const round = (n: number) => Math.round(n * 100) / 100;
      return {
        ...acct,
        totalExpenses: round(a.expenses),
        transactionCount: a.count,
        monthlyAvg: allMonths.length ? round(a.expenses / allMonths.length) : 0,
        monthlyExpenses: allMonths.map((m) => ({ month: m, amount: round(a.monthMap[m] ?? 0) })),
        topCategories: Object.entries(a.catMap)
          .map(([category, amount]) => ({ category, amount: round(amount) }))
          .sort((x, y) => y.amount - x.amount)
          .slice(0, 6),
      };
    });

    // Stacked river chart data — one row per month, keyed by accountId
    const monthlyStackedData = allMonths.map((month) => {
      const row: Record<string, any> = { month };
      for (const acct of allAccounts) {
        const amt = agg[acct.id]?.monthMap[month] ?? 0;
        row[acct.id] = Math.round(amt * 100) / 100;
      }
      return row;
    });

    res.json({ accounts, monthlyStackedData, allMonths });
  });

  // === Top Merchants ===
  app.get("/api/analytics/merchants", async (req, res) => {
    const transactions = await storage.getTransactions({});

    type MerchantAgg = {
      total: number;
      count: number;
      category: string;
      lastDate: string;
    };
    const merchantMap: Record<string, MerchantAgg> = {};

    for (const tx of transactions) {
      if (tx.amount >= 0) continue;
      if (NON_MERCHANT_CATEGORIES.has(tx.category)) continue;

      const name = normalizeMerchantName(tx);
      if (!name) continue;

      if (!merchantMap[name]) {
        merchantMap[name] = { total: 0, count: 0, category: tx.category, lastDate: tx.date };
      }
      merchantMap[name].total += Math.abs(tx.amount);
      merchantMap[name].count += 1;
      if (tx.date > merchantMap[name].lastDate) merchantMap[name].lastDate = tx.date;
    }

    const sortedMerchants = Object.entries(merchantMap)
      .map(([merchant, agg]) => ({
        merchant,
        total: Math.round(agg.total * 100) / 100,
        count: agg.count,
        avgPerVisit: Math.round((agg.total / agg.count) * 100) / 100,
        category: agg.category,
        lastDate: agg.lastDate,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 40);

    res.json(sortedMerchants);
  });

  // === Auto-detect Recurring Expenses ===
  app.get("/api/analytics/recurring", async (req, res) => {
    const transactions = await storage.getTransactions({});
    const merchantGroups: Record<string, Transaction[]> = {};

    for (const tx of transactions) {
      if (tx.amount >= 0) continue; // Only expenses
      if (NON_MERCHANT_CATEGORIES.has(tx.category)) continue;

      const name = normalizeMerchantName(tx);
      if (!name) continue;

      if (!merchantGroups[name]) merchantGroups[name] = [];
      merchantGroups[name].push(tx);
    }

    const median = (nums: number[]): number => {
      const sorted = [...nums].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
    };

    const recurring = [];

    for (const [merchant, txs] of Object.entries(merchantGroups)) {
      // Need at least 3 occurrences to call something recurring
      if (txs.length < 3) continue;

      // Sort by date descending (most recent first)
      txs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      // Compute median amount across all transactions for this merchant.
      const amounts = txs.map((t) => Math.abs(t.amount));
      const medAmount = median(amounts);
      const maxAmount = Math.max(...amounts);

      // Amounts must be roughly consistent — reject if max is more than 3×
      // the median (catches groups where one outlier inflates a series).
      if (medAmount > 0 && maxAmount > medAmount * 3) continue;

      // Use only transactions near the median amount to compute cadence.
      // Outlier amounts mixed with a recurring charge (e.g. $20 misc + $1,450
      // monthly rent sent to the same person) would skew the average interval
      // and cause false negatives. Keep transactions within 50%–200% of median.
      const cadenceTxs = txs.filter((t) => {
        const a = Math.abs(t.amount);
        return a >= medAmount * 0.5 && a <= medAmount * 2;
      });
      if (cadenceTxs.length < 3) continue;

      // Average days between consecutive same-magnitude transactions
      let totalDays = 0;
      for (let i = 0; i < cadenceTxs.length - 1; i++) {
        const d1 = new Date(cadenceTxs[i].date).getTime();
        const d2 = new Date(cadenceTxs[i + 1].date).getTime();
        totalDays += (d1 - d2) / (1000 * 60 * 60 * 24);
      }
      const avgDays = totalDays / (cadenceTxs.length - 1);

      // Reject same-day clusters (e.g. multiple charges on the same day are
      // not a subscription cadence).
      if (avgDays < 5) continue;

      // Cadence must match a recognized recurring band — drop "Variable".
      // "Twice Monthly" catches subscriptions billed on two cards/cycles
      // (e.g. Claude.ai charged on the 15th and 28th from different cards,
      // producing an average interval of ~15 days).
      const isWeekly       = avgDays >= 6   && avgDays <= 10;
      const isTwiceMonthly = avgDays >= 11  && avgDays <= 18;
      const isMonthly      = avgDays >= 25  && avgDays <= 35;
      const isAnnual       = avgDays >= 350 && avgDays <= 380;
      if (!isWeekly && !isTwiceMonthly && !isMonthly && !isAnnual) continue;

      const frequency = isWeekly ? "Weekly"
        : isTwiceMonthly ? "Twice Monthly"
        : isMonthly      ? "Monthly"
        :                  "Annually";

      // Drop subscriptions that look inactive — last transaction is more than
      // one full cycle overdue (e.g. 60+ days since last monthly charge).
      const lastTxnMs = new Date(cadenceTxs[0].date).getTime();
      const daysSinceLast = (Date.now() - lastTxnMs) / (1000 * 60 * 60 * 24);
      if (daysSinceLast > avgDays * 2) continue;

      // Predict next occurrence from the most recent cadence transaction
      const intervalDaysForNext = isWeekly ? 7 : isTwiceMonthly ? 15 : isMonthly ? 30 : 365;
      const lastDate = new Date(cadenceTxs[0].date);
      lastDate.setDate(lastDate.getDate() + intervalDaysForNext);
      const nextExpectedDate = lastDate.toISOString().split("T")[0];

      const annualizedCost = Math.round((
        isWeekly       ? medAmount * 52 :
        isTwiceMonthly ? medAmount * 24 :
        isMonthly      ? medAmount * 12 :
        medAmount
      ) * 100) / 100;

      recurring.push({
        merchant,
        amount: medAmount,
        frequency,
        count: txs.length,
        avgDaysBetween: Math.round(avgDays),
        nextExpectedDate,
        category: txs[0].category,
        lastChargedDate: cadenceTxs[0].date,
        daysSinceLastCharge: Math.round(daysSinceLast),
        annualizedCost,
        amountIncreased: Math.abs(txs[0].amount) > medAmount * 1.1,
      });
    }

    // Sort by annualized cost descending
    recurring.sort((a, b) => b.annualizedCost - a.annualizedCost);
    const totalAnnualCost = Math.round(
      recurring.reduce((s, r) => s + r.annualizedCost, 0) * 100
    ) / 100;

    res.json({ items: recurring, totalAnnualCost });
  });

  // === CASH FLOW FORECAST ===
  app.get("/api/analytics/cashflow", async (req, res) => {
    const days = Math.min(180, Math.max(7, parseInt((req.query.days as string) ?? "90") || 90));

    const [allAccounts, allTxns] = await Promise.all([
      storage.getAccounts(),
      storage.getTransactions({}),
    ]);

    // Only checking/savings accounts with a known balance participate in projection
    const liquidAccounts = allAccounts.filter(
      (a) => (a.type === "checking" || a.type === "savings") && a.currentBalance != null
    );
    const totalCurrentBalance = liquidAccounts.reduce((s, a) => s + (a.currentBalance ?? 0), 0);

    // ── Detect recurring patterns (same logic as /api/analytics/recurring) ──
    const merchantGroups: Record<string, typeof allTxns> = {};
    for (const tx of allTxns) {
      if (NON_MERCHANT_CATEGORIES.has(tx.category)) continue;
      const name = normalizeMerchantName(tx);
      if (!name) continue;
      if (!merchantGroups[name]) merchantGroups[name] = [];
      merchantGroups[name].push(tx);
    }

    const median = (nums: number[]) => {
      const s = [...nums].sort((a, b) => a - b);
      const m = Math.floor(s.length / 2);
      return s.length % 2 === 0 ? (s[m - 1] + s[m]) / 2 : s[m];
    };

    interface ProjectedEvent {
      date: string;
      label: string;
      amount: number;  // negative = expense, positive = income
      type: "income" | "expense" | "transfer";
      category: string;
    }

    const projectedEvents: ProjectedEvent[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const [merchant, txs] of Object.entries(merchantGroups)) {
      if (txs.length < 3) continue;
      txs.sort((a, b) => (b.date > a.date ? 1 : -1));

      const amounts = txs.map((t) => Math.abs(t.amount));
      const medAmount = median(amounts);
      if (medAmount <= 0) continue;

      const cadenceTxs = txs.filter((t) => {
        const a = Math.abs(t.amount);
        return a >= medAmount * 0.5 && a <= medAmount * 2;
      });
      if (cadenceTxs.length < 3) continue;

      let totalD = 0;
      for (let i = 0; i < cadenceTxs.length - 1; i++) {
        totalD += (new Date(cadenceTxs[i].date).getTime() - new Date(cadenceTxs[i + 1].date).getTime()) / 86400000;
      }
      const avgDays = totalD / (cadenceTxs.length - 1);
      if (avgDays < 5) continue;

      const isWeekly2       = avgDays >= 6   && avgDays <= 10;
      const isTwiceMonthly2 = avgDays >= 11  && avgDays <= 18;
      const isMonthly2      = avgDays >= 25  && avgDays <= 35;
      const isAnnual2       = avgDays >= 350 && avgDays <= 380;
      if (!isWeekly2 && !isTwiceMonthly2 && !isMonthly2 && !isAnnual2) continue;

      const daysSinceLast = (Date.now() - new Date(cadenceTxs[0].date).getTime()) / 86400000;
      if (daysSinceLast > avgDays * 2) continue;

      const isIncome = txs[0].amount > 0;
      const intervalDays = isWeekly2 ? 7 : isTwiceMonthly2 ? 15 : isMonthly2 ? 30 : 365;

      // Project forward: first occurrence = lastDate + interval
      let nextDate = new Date(cadenceTxs[0].date + "T00:00:00");
      nextDate.setDate(nextDate.getDate() + intervalDays);

      const horizonDate = new Date(today);
      horizonDate.setDate(horizonDate.getDate() + days);

      while (nextDate <= horizonDate) {
        if (nextDate >= today) {
          projectedEvents.push({
            date: nextDate.toISOString().split("T")[0],
            label: merchant,
            amount: isIncome ? medAmount : -medAmount,
            type: isIncome ? "income" : "expense",
            category: txs[0].category,
          });
        }
        nextDate = new Date(nextDate);
        nextDate.setDate(nextDate.getDate() + intervalDays);
      }
    }

    // Sort events by date
    projectedEvents.sort((a, b) => (a.date > b.date ? 1 : -1));

    // ── Build daily balance projection ──────────────────────────────────────
    // Group events by date
    const eventsByDate: Record<string, ProjectedEvent[]> = {};
    for (const ev of projectedEvents) {
      if (!eventsByDate[ev.date]) eventsByDate[ev.date] = [];
      eventsByDate[ev.date].push(ev);
    }

    const safeFloor = 500; // configurable in future
    const dailyBalances: Array<{
      date: string;
      balance: number;
      delta: number;
      zone: "safe" | "watch" | "danger";
      events: ProjectedEvent[];
    }> = [];

    let runningBalance = totalCurrentBalance;
    const todayStr = today.toISOString().split("T")[0];

    for (let i = 0; i <= days; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().split("T")[0];

      const dayEvents = eventsByDate[dateStr] ?? [];
      const delta = dayEvents.reduce((s, e) => s + e.amount, 0);
      runningBalance += delta;

      const zone: "safe" | "watch" | "danger" =
        runningBalance < safeFloor * 0.5 ? "danger" :
        runningBalance < safeFloor        ? "watch"  : "safe";

      dailyBalances.push({ date: dateStr, balance: Math.round(runningBalance * 100) / 100, delta: Math.round(delta * 100) / 100, zone, events: dayEvents });
    }

    // ── Summary ─────────────────────────────────────────────────────────────
    const minBalance = Math.min(...dailyBalances.map((d) => d.balance));
    const dangerDays = dailyBalances.filter((d) => d.zone === "danger").length;
    const watchDays  = dailyBalances.filter((d) => d.zone === "watch").length;
    const firstDanger = dailyBalances.find((d) => d.zone === "danger");

    // Upcoming events in next 14 days (for the event timeline)
    const next14 = new Date(today);
    next14.setDate(next14.getDate() + 14);
    const upcomingEvents = projectedEvents
      .filter((e) => e.date >= todayStr && e.date <= next14.toISOString().split("T")[0])
      .slice(0, 20);

    res.json({
      currentBalance: Math.round(totalCurrentBalance * 100) / 100,
      safeFloor,
      days,
      dailyBalances,
      upcomingEvents,
      summary: {
        minBalance: Math.round(minBalance * 100) / 100,
        dangerDays,
        watchDays,
        firstDangerDate: firstDanger?.date ?? null,
        projectedEventCount: projectedEvents.length,
        liquidAccountCount: liquidAccounts.length,
      },
    });
  });

  // === RE-CATEGORIZE existing transactions with updated rules ===
  app.post("/api/recategorize", async (_req, res) => {
    try {
      const transactions = await storage.getTransactions({});
      let updated = 0;

      for (const tx of transactions) {
        const newCategory = inferCategory(
          tx.description + " " + (tx.originalDescription ?? ""),
          tx.merchant
        );
        if (newCategory !== tx.category) {
          await storage.updateTransaction(tx.id, { category: newCategory });
          updated++;
        }
      }

      res.json({ total: transactions.length, updated });
    } catch (e: any) {
      console.error("Recategorize error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // === DEDUP — Remove existing duplicate transactions ===
  // Assumes duplicates came from uploading the same file twice.
  // For each fingerprint that appears N times, keeps ceil(N/2) and removes the rest.
  // This correctly halves double-uploaded data while preserving legitimate
  // same-day identical charges (e.g. 3x $10 Electrify America → uploaded twice = 6 → keeps 3).
  app.post("/api/dedup", async (_req, res) => {
    try {
      const transactions = await storage.getTransactions({});

      // Group transaction IDs by fingerprint
      const groups = new Map<string, string[]>();
      for (const tx of transactions) {
        const desc = tx.description.toLowerCase().replace(/\s+/g, " ").trim();
        const amt = Math.round(tx.amount * 100);
        const fp = `${tx.accountId}|${tx.date}|${desc}|${amt}`;

        if (!groups.has(fp)) {
          groups.set(fp, []);
        }
        groups.get(fp)!.push(tx.id);
      }

      const toDelete: string[] = [];

      for (const [_fp, ids] of Array.from(groups)) {
        if (ids.length <= 1) continue;

        // If count is even, it was likely uploaded twice → keep half
        // If count is odd and > 1, still halve (ceil) to be safe
        const keep = Math.ceil(ids.length / 2);
        const remove = ids.slice(keep);
        toDelete.push(...remove);
      }

      // Delete duplicates
      for (const id of toDelete) {
        await storage.deleteTransaction(id);
      }

      res.json({
        total: transactions.length,
        duplicatesRemoved: toDelete.length,
        remaining: transactions.length - toDelete.length,
      });
    } catch (e: any) {
      console.error("Dedup error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  return httpServer;
}
