import type {
  Account,
  InsertAccount,
  Transaction,
  InsertTransaction,
  Budget,
  InsertBudget,
  Goal,
  InsertGoal,
} from "@shared/schema";
import { accounts, transactions, budgets, goals } from "@shared/schema";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { eq, gte, lte, and, inArray, desc } from "drizzle-orm";
import path from "path";

// ─── Shared interface ────────────────────────────────────────────────────────

export interface TransactionFilters {
  accountId?: string;
  category?: string;
  startDate?: string;
  endDate?: string;
}

export interface IStorage {
  // Accounts
  getAccounts(): Promise<Account[]>;
  createAccount(data: InsertAccount): Promise<Account>;
  updateAccount(id: string, data: Partial<InsertAccount>): Promise<Account | null>;
  deleteAccount(id: string): Promise<void>;

  // Transactions
  getTransactions(filters?: TransactionFilters): Promise<Transaction[]>;
  createTransactions(data: InsertTransaction[]): Promise<{ created: Transaction[]; skipped: number }>;
  updateTransaction(id: string, data: Partial<InsertTransaction>): Promise<Transaction | null>;
  deleteTransaction(id: string): Promise<void>;
  deleteTransactionsByAccount(accountId: string): Promise<void>;

  // Budgets
  getBudgets(): Promise<Budget[]>;
  createBudget(data: InsertBudget): Promise<Budget>;
  updateBudget(id: string, data: Partial<InsertBudget>): Promise<Budget | null>;
  deleteBudget(id: string): Promise<void>;

  // Goals
  getGoals(): Promise<Goal[]>;
  createGoal(data: InsertGoal): Promise<Goal>;
  updateGoal(id: string, data: Partial<InsertGoal>): Promise<Goal | null>;
  deleteGoal(id: string): Promise<void>;
}

// ─── Shared dedup fingerprint (used by both implementations) ─────────────────

function txFingerprint(tx: {
  accountId: string;
  date: string;
  description: string;
  amount: number;
}): string {
  const desc = tx.description.toLowerCase().replace(/\s+/g, " ").trim();
  const amt = Math.round(tx.amount * 100);
  return `${tx.accountId}|${tx.date}|${desc}|${amt}`;
}

// ─── Count-based dedup (shared logic) ────────────────────────────────────────
//
// Allows legitimate identical transactions (e.g. 3× $10 Electrify America on
// the same day) while still blocking re-uploads of the same statement file.
//
// allowance[fp] = max(0, incomingCount[fp] - dbCount[fp])
// We only insert up to that many rows per fingerprint.

function applyDedup(
  data: InsertTransaction[],
  existingRows: { accountId: string; date: string; description: string; amount: number }[]
): { toInsert: InsertTransaction[]; skipped: number } {
  // Step 1: count existing fingerprints from DB
  const dbCounts = new Map<string, number>();
  for (const row of existingRows) {
    const fp = txFingerprint(row);
    dbCounts.set(fp, (dbCounts.get(fp) ?? 0) + 1);
  }

  // Step 2: count fingerprints in incoming batch
  const incomingCounts = new Map<string, number>();
  const incomingFPs: string[] = [];
  for (const item of data) {
    const fp = txFingerprint(item);
    incomingFPs.push(fp);
    incomingCounts.set(fp, (incomingCounts.get(fp) ?? 0) + 1);
  }

  // Step 3: allowance per fingerprint
  const allowance = new Map<string, number>();
  for (const [fp, count] of Array.from(incomingCounts)) {
    allowance.set(fp, Math.max(0, count - (dbCounts.get(fp) ?? 0)));
  }

  // Step 4: filter
  const insertedSoFar = new Map<string, number>();
  const toInsert: InsertTransaction[] = [];
  let skipped = 0;

  for (let i = 0; i < data.length; i++) {
    const fp = incomingFPs[i];
    const allowed = allowance.get(fp) ?? 0;
    const done = insertedSoFar.get(fp) ?? 0;

    if (done >= allowed) {
      skipped++;
    } else {
      insertedSoFar.set(fp, done + 1);
      toInsert.push(data[i]);
    }
  }

  return { toInsert, skipped };
}

// ─── SQLite / Drizzle storage ────────────────────────────────────────────────

const DB_PATH = path.resolve(process.cwd(), "data.db");

function openDb() {
  const sqlite = new Database(DB_PATH);
  // WAL mode: much faster writes, safe concurrent reads
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  return drizzle(sqlite);
}

class DrizzleStorage implements IStorage {
  private db = openDb();

  // ── Accounts ────────────────────────────────────────────────────────────────

  async getAccounts(): Promise<Account[]> {
    return this.db.select().from(accounts);
  }

  async createAccount(data: InsertAccount): Promise<Account> {
    const id = crypto.randomUUID();
    const row = {
      id,
      name: data.name,
      institution: data.institution,
      type: data.type,
      lastFour: data.lastFour ?? null,
      color: data.color ?? null,
      currentBalance: data.currentBalance ?? null,
    };
    await this.db.insert(accounts).values(row);
    return row;
  }

  async updateAccount(id: string, data: Partial<InsertAccount>): Promise<Account | null> {
    const [existing] = await this.db.select().from(accounts).where(eq(accounts.id, id));
    if (!existing) return null;
    await this.db.update(accounts).set(data).where(eq(accounts.id, id));
    return { ...existing, ...data };
  }

  async deleteAccount(id: string): Promise<void> {
    await this.db.delete(accounts).where(eq(accounts.id, id));
  }

  // ── Transactions ─────────────────────────────────────────────────────────────

  async getTransactions(filters: TransactionFilters = {}): Promise<Transaction[]> {
    const conditions = [];

    if (filters.accountId) conditions.push(eq(transactions.accountId, filters.accountId));
    if (filters.category)  conditions.push(eq(transactions.category, filters.category));
    if (filters.startDate) conditions.push(gte(transactions.date, filters.startDate));
    if (filters.endDate)   conditions.push(lte(transactions.date, filters.endDate));

    const rows = await (
      conditions.length > 0
        ? this.db.select().from(transactions).where(and(...conditions))
        : this.db.select().from(transactions)
    );

    // Sort by date descending (newest first)
    return rows.sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : 0));
  }

  async createTransactions(
    data: InsertTransaction[]
  ): Promise<{ created: Transaction[]; skipped: number }> {
    if (data.length === 0) return { created: [], skipped: 0 };

    // Fetch existing transactions for only the affected accounts so dedup
    // doesn't have to scan the full table.
    const accountIds = Array.from(new Set(data.map((d) => d.accountId)));
    const existing =
      accountIds.length === 1
        ? await this.db.select().from(transactions).where(eq(transactions.accountId, accountIds[0]))
        : await this.db.select().from(transactions).where(inArray(transactions.accountId, accountIds));

    const { toInsert, skipped } = applyDedup(data, existing);

    if (toInsert.length === 0) return { created: [], skipped };

    const rows: Transaction[] = toInsert.map((item) => ({
      id: crypto.randomUUID(),
      accountId: item.accountId,
      date: item.date,
      description: item.description,
      merchant: item.merchant ?? null,
      category: item.category,
      amount: item.amount,
      type: item.type,
      originalDescription: item.originalDescription ?? null,
    }));

    // Insert in chunks of 500 to stay within SQLite's variable limit
    const CHUNK = 500;
    for (let i = 0; i < rows.length; i += CHUNK) {
      await this.db.insert(transactions).values(rows.slice(i, i + CHUNK));
    }

    return { created: rows, skipped };
  }

  async updateTransaction(
    id: string,
    data: Partial<InsertTransaction>
  ): Promise<Transaction | null> {
    const [existing] = await this.db
      .select()
      .from(transactions)
      .where(eq(transactions.id, id));
    if (!existing) return null;

    const updated = { ...existing, ...data };
    await this.db.update(transactions).set(data).where(eq(transactions.id, id));
    return updated;
  }

  async deleteTransaction(id: string): Promise<void> {
    await this.db.delete(transactions).where(eq(transactions.id, id));
  }

  async deleteTransactionsByAccount(accountId: string): Promise<void> {
    await this.db.delete(transactions).where(eq(transactions.accountId, accountId));
  }

  // ── Budgets ──────────────────────────────────────────────────────────────────

  async getBudgets(): Promise<Budget[]> {
    return this.db.select().from(budgets);
  }

  async createBudget(data: InsertBudget): Promise<Budget> {
    const id = crypto.randomUUID();
    const row = {
      id,
      category: data.category,
      limit: data.limit,
      period: data.period,
      color: data.color ?? null,
    };
    await this.db.insert(budgets).values(row);
    return row;
  }

  async updateBudget(id: string, data: Partial<InsertBudget>): Promise<Budget | null> {
    const [existing] = await this.db
      .select()
      .from(budgets)
      .where(eq(budgets.id, id));
    if (!existing) return null;

    const updated = { ...existing, ...data };
    await this.db.update(budgets).set(data).where(eq(budgets.id, id));
    return updated;
  }

  async deleteBudget(id: string): Promise<void> {
    await this.db.delete(budgets).where(eq(budgets.id, id));
  }

  // ── Goals ────────────────────────────────────────────────────────────────────

  async getGoals(): Promise<Goal[]> {
    return this.db.select().from(goals);
  }

  async createGoal(data: InsertGoal): Promise<Goal> {
    const id = crypto.randomUUID();
    const row = {
      id,
      name: data.name,
      targetAmount: data.targetAmount,
      savedAmount: data.savedAmount ?? 0,
      deadline: data.deadline ?? null,
      icon: data.icon ?? null,
      color: data.color ?? null,
      note: data.note ?? null,
    };
    await this.db.insert(goals).values(row);
    return row;
  }

  async updateGoal(id: string, data: Partial<InsertGoal>): Promise<Goal | null> {
    const [existing] = await this.db.select().from(goals).where(eq(goals.id, id));
    if (!existing) return null;
    await this.db.update(goals).set(data).where(eq(goals.id, id));
    return { ...existing, ...data };
  }

  async deleteGoal(id: string): Promise<void> {
    await this.db.delete(goals).where(eq(goals.id, id));
  }
}

// ─── MemStorage (kept as fallback) ──────────────────────────────────────────

class MemStorage implements IStorage {
  private accounts: Map<string, Account> = new Map();
  private transactions: Map<string, Transaction> = new Map();
  private budgets: Map<string, Budget> = new Map();

  async getAccounts() { return Array.from(this.accounts.values()); }

  async createAccount(data: InsertAccount): Promise<Account> {
    const id = crypto.randomUUID();
    const account: Account = { id, name: data.name, institution: data.institution,
      type: data.type, lastFour: data.lastFour ?? null, color: data.color ?? null,
      currentBalance: data.currentBalance ?? null };
    this.accounts.set(id, account);
    return account;
  }

  async updateAccount(id: string, data: Partial<InsertAccount>): Promise<Account | null> {
    const existing = this.accounts.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...data };
    this.accounts.set(id, updated);
    return updated;
  }

  async deleteAccount(id: string) { this.accounts.delete(id); }

  async getTransactions(filters: TransactionFilters = {}): Promise<Transaction[]> {
    let results = Array.from(this.transactions.values());
    if (filters.accountId) results = results.filter((t) => t.accountId === filters.accountId);
    if (filters.category)  results = results.filter((t) => t.category === filters.category);
    if (filters.startDate) results = results.filter((t) => t.date >= filters.startDate!);
    if (filters.endDate)   results = results.filter((t) => t.date <= filters.endDate!);
    return results.sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : 0));
  }

  async createTransactions(data: InsertTransaction[]): Promise<{ created: Transaction[]; skipped: number }> {
    const existing = Array.from(this.transactions.values());
    const { toInsert, skipped } = applyDedup(data, existing);

    const created: Transaction[] = toInsert.map((item) => ({
      id: crypto.randomUUID(),
      accountId: item.accountId, date: item.date, description: item.description,
      merchant: item.merchant ?? null, category: item.category, amount: item.amount,
      type: item.type, originalDescription: item.originalDescription ?? null,
    }));
    for (const tx of created) this.transactions.set(tx.id, tx);
    return { created, skipped };
  }

  async updateTransaction(id: string, data: Partial<InsertTransaction>): Promise<Transaction | null> {
    const existing = this.transactions.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...data };
    this.transactions.set(id, updated);
    return updated;
  }

  async deleteTransaction(id: string) { this.transactions.delete(id); }

  async deleteTransactionsByAccount(accountId: string) {
    for (const [id, tx] of Array.from(this.transactions.entries())) {
      if (tx.accountId === accountId) this.transactions.delete(id);
    }
  }

  async getBudgets() { return Array.from(this.budgets.values()); }

  async createBudget(data: InsertBudget): Promise<Budget> {
    const id = crypto.randomUUID();
    const budget: Budget = { id, category: data.category, limit: data.limit,
      period: data.period, color: data.color ?? null };
    this.budgets.set(id, budget);
    return budget;
  }

  async updateBudget(id: string, data: Partial<InsertBudget>): Promise<Budget | null> {
    const existing = this.budgets.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...data };
    this.budgets.set(id, updated);
    return updated;
  }

  async deleteBudget(id: string) { this.budgets.delete(id); }

  private goals: Map<string, Goal> = new Map();

  async getGoals() { return Array.from(this.goals.values()); }

  async createGoal(data: InsertGoal): Promise<Goal> {
    const id = crypto.randomUUID();
    const goal: Goal = {
      id, name: data.name, targetAmount: data.targetAmount,
      savedAmount: data.savedAmount ?? 0, deadline: data.deadline ?? null,
      icon: data.icon ?? null, color: data.color ?? null, note: data.note ?? null,
    };
    this.goals.set(id, goal);
    return goal;
  }

  async updateGoal(id: string, data: Partial<InsertGoal>): Promise<Goal | null> {
    const existing = this.goals.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...data };
    this.goals.set(id, updated);
    return updated;
  }

  async deleteGoal(id: string) { this.goals.delete(id); }
}

// ─── Export ──────────────────────────────────────────────────────────────────

export const storage: IStorage = new DrizzleStorage();
