import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, Pencil, Trash2, Check, X, CalendarDays, BookOpen, List } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { apiRequest, queryClient as qc } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Transaction, Account } from "@shared/schema";

const CATEGORIES = [
  "Food & Dining",
  "Shopping",
  "Transportation",
  "Entertainment",
  "Health & Fitness",
  "Travel",
  "Bills & Utilities",
  "Income",
  "Transfer",
  "Education",
  "Personal Care",
  "Gifts & Donations",
  "Fees & Charges",
  "Other",
];

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(amount));
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

interface EditingState {
  id: string;
  description: string;
  category: string;
}

export default function Transactions() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [accountFilter, setAccountFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState<"all" | "expense" | "income">("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [editing, setEditing] = useState<EditingState | null>(null);

  const { data: transactions = [], isLoading: txLoading } = useQuery<Transaction[]>({
    queryKey: ["/api/transactions"],
  });

  const { data: accounts = [], isLoading: acctLoading } = useQuery<Account[]>({
    queryKey: ["/api/accounts"],
  });

  const isLoading = txLoading || acctLoading;

  // Unique categories from transactions
  const categories = useMemo(() => {
    const cats = new Set(transactions.map((tx) => tx.category));
    return Array.from(cats).sort();
  }, [transactions]);

  // Filtered transactions
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return transactions
      .filter((tx) => {
        const matchesSearch =
          q === "" ||
          tx.description.toLowerCase().includes(q) ||
          tx.category.toLowerCase().includes(q) ||
          (tx.merchant ?? "").toLowerCase().includes(q);
        const matchesCategory =
          categoryFilter === "all" || tx.category === categoryFilter;
        const matchesAccount =
          accountFilter === "all" || tx.accountId === accountFilter;
        const matchesType =
          typeFilter === "all" ||
          (typeFilter === "expense" && tx.amount < 0) ||
          (typeFilter === "income" && tx.amount > 0);
        const matchesStart = startDate === "" || tx.date >= startDate;
        const matchesEnd = endDate === "" || tx.date <= endDate;
        return matchesSearch && matchesCategory && matchesAccount && matchesType && matchesStart && matchesEnd;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [transactions, search, categoryFilter, accountFilter, typeFilter, startDate, endDate]);

  // Sum of filtered results (for the header)
  const filteredSummary = useMemo(() => {
    let expenses = 0;
    let income = 0;
    for (const tx of filtered) {
      if (tx.amount < 0) expenses += Math.abs(tx.amount);
      else income += tx.amount;
    }
    return { expenses, income };
  }, [filtered]);

  const hasActiveFilters =
    search !== "" ||
    categoryFilter !== "all" ||
    accountFilter !== "all" ||
    typeFilter !== "all" ||
    startDate !== "" ||
    endDate !== "";

  function clearFilters() {
    setSearch("");
    setCategoryFilter("all");
    setAccountFilter("all");
    setTypeFilter("all");
    setStartDate("");
    setEndDate("");
  }

  const [viewMode, setViewMode] = useState<"list" | "khata">("list");

  // Roj-Med running Baki: anchor from account's currentBalance, walk backwards
  // through all account transactions to find the opening balance at start of data,
  // then walk forward through filtered transactions to build per-day Baki.
  const khataRows = useMemo(() => {
    if (viewMode !== "khata") return [];

    // Work per account when a single account is selected, or all together
    const acctId = accountFilter !== "all" ? accountFilter : null;
    const relevantAccounts = acctId
      ? accounts.filter((a) => a.id === acctId)
      : accounts.filter((a) => a.type === "checking" || a.type === "savings");

    // Compute opening balance: currentBalance minus net of ALL transactions for those accounts
    let openingBalance: number | null = null;
    const hasBalance = relevantAccounts.some((a) => a.currentBalance != null);

    if (hasBalance) {
      const currentBalanceSum = relevantAccounts.reduce(
        (s, a) => s + (a.currentBalance ?? 0), 0
      );
      const allAccountIds = new Set(relevantAccounts.map((a) => a.id));
      const allTxForAccounts = transactions.filter((tx) => allAccountIds.has(tx.accountId));
      const netOfAll = allTxForAccounts.reduce((s, tx) => s + tx.amount, 0);
      openingBalance = currentBalanceSum - netOfAll;
    }

    // Group filtered transactions by date (newest first already sorted)
    const byDate: Record<string, Transaction[]> = {};
    for (const tx of filtered) {
      if (!byDate[tx.date]) byDate[tx.date] = [];
      byDate[tx.date].push(tx);
    }

    const dates = Object.keys(byDate).sort(); // ascending for Baki calculation
    let runningBaki = openingBalance ?? 0;
    const rows: {
      date: string;
      transactions: Transaction[];
      dayUdhar: number;
      dayJama: number;
      closingBaki: number;
      hasBalance: boolean;
    }[] = [];

    for (const date of dates) {
      const txs = byDate[date];
      let dayUdhar = 0;
      let dayJama = 0;
      for (const tx of txs) {
        if (tx.amount < 0) dayUdhar += Math.abs(tx.amount);
        else dayJama += tx.amount;
      }
      runningBaki = runningBaki - dayUdhar + dayJama;
      rows.push({ date, transactions: txs, dayUdhar, dayJama, closingBaki: runningBaki, hasBalance });
    }

    return rows.reverse(); // newest first for display
  }, [viewMode, filtered, transactions, accounts, accountFilter]);

  const updateMutation = useMutation({
    mutationFn: async (data: { id: string; description: string; category: string }) => {
      const res = await apiRequest("PATCH", `/api/transactions/${data.id}`, {
        description: data.description,
        category: data.category,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/summary"] });
      setEditing(null);
      toast({ title: "Transaction updated" });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/transactions/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/summary"] });
      toast({ title: "Transaction deleted" });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const accountMap = useMemo(() => {
    return Object.fromEntries(accounts.map((a) => [a.id, a]));
  }, [accounts]);

  function startEdit(tx: Transaction) {
    setEditing({
      id: tx.id,
      description: tx.description,
      category: tx.category,
    });
  }

  function cancelEdit() {
    setEditing(null);
  }

  function saveEdit() {
    if (!editing) return;
    updateMutation.mutate(editing);
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Transactions
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {filtered.length} of {transactions.length} transaction
            {transactions.length !== 1 ? "s" : ""}
            {filteredSummary.expenses > 0 && (
              <>
                {" · "}
                <span className="font-medium text-foreground">
                  {formatCurrency(filteredSummary.expenses)}
                </span>
                {" expenses"}
              </>
            )}
            {filteredSummary.income > 0 && (
              <>
                {" · "}
                <span className="font-medium text-emerald-600 dark:text-emerald-400">
                  +{formatCurrency(filteredSummary.income)}
                </span>
                {" income"}
              </>
            )}
          </p>
        </div>

        {/* View toggle: List ↔ Khata (Roj-Med) */}
        <div className="flex rounded-lg border border-border overflow-hidden flex-shrink-0">
          <button
            onClick={() => setViewMode("list")}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors ${
              viewMode === "list"
                ? "bg-emerald-600 text-white"
                : "bg-background text-muted-foreground hover:bg-muted"
            }`}
          >
            <List className="h-3.5 w-3.5" />
            List
          </button>
          <button
            onClick={() => setViewMode("khata")}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors border-l border-border ${
              viewMode === "khata"
                ? "bg-amber-600 text-white"
                : "bg-background text-muted-foreground hover:bg-muted"
            }`}
          >
            <BookOpen className="h-3.5 w-3.5" />
            Roj-Med
          </button>
        </div>
      </div>

      {/* Filters */}
      <Card className="admin-card border-none shadow-sm">
        <CardContent className="p-4">
          <div className="space-y-3">
            {/* Row 1: Search + Category + Account */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search description, merchant, or category…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                  data-testid="transaction-search"
                />
              </div>

              {/* Category filter */}
              <Select
                value={categoryFilter}
                onValueChange={setCategoryFilter}
                data-testid="category-filter"
              >
                <SelectTrigger className="w-full sm:w-44">
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Account filter */}
              <Select
                value={accountFilter}
                onValueChange={setAccountFilter}
                data-testid="account-filter"
              >
                <SelectTrigger className="w-full sm:w-44">
                  <SelectValue placeholder="All accounts" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All accounts</SelectItem>
                  {accounts.map((acct) => (
                    <SelectItem key={acct.id} value={acct.id}>
                      {acct.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Row 2: Date range + Type toggle + Clear */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border">
              <CalendarDays className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                max={endDate || undefined}
                className="w-36 h-8 text-xs px-2"
                data-testid="start-date-filter"
              />
              <span className="text-xs text-muted-foreground">to</span>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate || undefined}
                className="w-36 h-8 text-xs px-2"
                data-testid="end-date-filter"
              />

              <div className="flex-1" />

              {/* Type toggle */}
              <div className="flex rounded-md border border-border overflow-hidden">
                {(["all", "expense", "income"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTypeFilter(t)}
                    data-testid={`type-filter-${t}`}
                    className={`px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                      typeFilter === t
                        ? "bg-emerald-600 text-white"
                        : "bg-background text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>

              {/* Clear all — only visible when a filter is active */}
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-3 text-xs"
                  onClick={clearFilters}
                  data-testid="clear-filters"
                >
                  Clear all
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Khata / Roj-Med view */}
      {viewMode === "khata" && (
        <KhataView
          rows={khataRows}
          formatCurrency={formatCurrency}
          formatDate={formatDate}
          hasFiltered={filtered.length > 0}
          isLoading={isLoading}
        />
      )}

      {/* Transactions table — list view */}
      {viewMode === "list" && <Card className="admin-card border-none shadow-sm">
        <CardHeader className="pb-2 px-6">
          <CardTitle className="text-base font-semibold">All Transactions</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="divide-y divide-border px-6">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 py-3">
                  <Skeleton className="h-4 w-20 flex-shrink-0" />
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-5 w-20" />
                  <Skeleton className="h-4 w-16 flex-shrink-0" />
                  <Skeleton className="h-7 w-16" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-muted-foreground text-sm">
                {transactions.length === 0
                  ? "No transactions yet. Import a statement to get started."
                  : "No transactions match your filters."}
              </p>
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-3"
                  onClick={clearFilters}
                >
                  Clear filters
                </Button>
              )}
            </div>
          ) : (
            <>
              {/* Table header */}
              <div className="hidden md:grid grid-cols-[120px_1fr_160px_120px_80px] gap-4 border-b border-border px-6 py-2">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Date
                </span>
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Description
                </span>
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Category
                </span>
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide text-right">
                  Amount
                </span>
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide text-right">
                  Actions
                </span>
              </div>

              {/* Rows */}
              <div className="divide-y divide-border">
                {filtered.map((tx) => {
                  const isEditing = editing?.id === tx.id;
                  const isPositive = tx.amount > 0;

                  return (
                    <div
                      key={tx.id}
                      className="group px-6 py-3 hover:bg-muted/30 transition-colors"
                      data-testid={`tx-row-${tx.id}`}
                    >
                      {isEditing ? (
                        /* Edit mode */
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                          <span className="text-xs text-muted-foreground w-24 flex-shrink-0">
                            {formatDate(tx.date)}
                          </span>
                          <Input
                            value={editing.description}
                            onChange={(e) =>
                              setEditing((prev) =>
                                prev ? { ...prev, description: e.target.value } : null
                              )
                            }
                            className="flex-1 h-8 text-sm"
                            data-testid={`edit-description-${tx.id}`}
                          />
                          <Select
                            value={editing.category}
                            onValueChange={(val) =>
                              setEditing((prev) =>
                                prev ? { ...prev, category: val } : null
                              )
                            }
                          >
                            <SelectTrigger className="w-full sm:w-44 h-8 text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {CATEGORIES.map((cat) => (
                                <SelectItem key={cat} value={cat}>
                                  {cat}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white"
                              onClick={saveEdit}
                              disabled={updateMutation.isPending}
                              data-testid={`save-edit-${tx.id}`}
                            >
                              <Check className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8"
                              onClick={cancelEdit}
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      ) : (
                        /* View mode */
                        <div className="flex items-center gap-4">
                          <span className="text-xs text-muted-foreground w-24 flex-shrink-0 hidden md:block">
                            {formatDate(tx.date)}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">
                              {tx.description}
                            </p>
                            <span className="text-xs text-muted-foreground md:hidden">
                              {formatDate(tx.date)}
                            </span>
                          </div>
                          <Badge
                            variant="secondary"
                            className="text-xs hidden md:inline-flex flex-shrink-0 w-36 justify-center truncate"
                          >
                            {tx.category}
                          </Badge>
                          <span
                            className={`font-mono text-sm font-semibold text-right w-20 flex-shrink-0 ${
                              isPositive
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-foreground"
                            }`}
                          >
                            {isPositive ? "+" : "-"}
                            {formatCurrency(tx.amount)}
                          </span>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0"
                              onClick={() => startEdit(tx)}
                              data-testid={`edit-tx-${tx.id}`}
                            >
                              <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 w-7 p-0"
                                  data-testid={`delete-tx-${tx.id}`}
                                >
                                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete transaction?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This will permanently delete &ldquo;{tx.description}&rdquo;.
                                    This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deleteMutation.mutate(tx.id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>}
    </div>
  );
}

// ─── Khata (Roj-Med) View ─────────────────────────────────────────────────────

interface KhataRow {
  date: string;
  transactions: Transaction[];
  dayUdhar: number;
  dayJama: number;
  closingBaki: number;
  hasBalance: boolean;
}

function KhataView({
  rows,
  formatCurrency,
  formatDate,
  hasFiltered,
  isLoading,
}: {
  rows: KhataRow[];
  formatCurrency: (n: number) => string;
  formatDate: (s: string) => string;
  hasFiltered: boolean;
  isLoading: boolean;
}) {
  if (isLoading) return null;

  if (!hasFiltered || rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <BookOpen className="h-10 w-10 text-amber-400 mb-3 opacity-50" />
        <p className="text-muted-foreground text-sm">No transactions to display in Roj-Med view.</p>
      </div>
    );
  }

  const totalUdhar = rows.reduce((s, r) => s + r.dayUdhar, 0);
  const totalJama = rows.reduce((s, r) => s + r.dayJama, 0);
  const finalBaki = rows[0]?.closingBaki ?? 0;
  const showBaki = rows[0]?.hasBalance;

  return (
    <div
      className="rounded-2xl overflow-hidden shadow-md"
      style={{ background: "hsl(43 60% 97%)", border: "1px solid hsl(43 40% 85%)" }}
    >
      {/* Ledger header */}
      <div
        className="px-6 py-4 flex items-center justify-between"
        style={{ background: "hsl(43 50% 92%)", borderBottom: "2px solid hsl(43 40% 80%)" }}
      >
        <div className="flex items-center gap-3">
          <BookOpen className="h-5 w-5 text-amber-700" />
          <div>
            <h2 className="text-base font-bold text-amber-900 tracking-tight">
              રોજ-મેળ · Roj-Med
            </h2>
            <p className="text-xs text-amber-700/70">{rows.length} days · Daily Balance Sheet</p>
          </div>
        </div>
        {!showBaki && (
          <p className="text-[11px] text-amber-700/60 max-w-[200px] text-right">
            Set account balance on Accounts page for exact Baki
          </p>
        )}
      </div>

      {/* Column headers */}
      <div
        className="grid grid-cols-[120px_1fr_140px_140px_120px] gap-0 px-6 py-2 text-[11px] font-bold uppercase tracking-widest"
        style={{ color: "hsl(30 50% 35%)", borderBottom: "1px solid hsl(43 40% 82%)" }}
      >
        <span>તારીખ · Date</span>
        <span>વિવરણ · Particulars</span>
        <span className="text-right text-red-700">ઉધાર · Udhar</span>
        <span className="text-right text-emerald-700">જમા · Jama</span>
        <span className="text-right" style={{ color: "hsl(220 60% 40%)" }}>
          {showBaki ? "બાકી · Baki" : "Net"}
        </span>
      </div>

      {/* Day groups */}
      <div>
        {rows.map((row, rowIdx) => (
          <div
            key={row.date}
            style={{
              borderBottom: "1px solid hsl(43 35% 86%)",
              background: rowIdx % 2 === 0 ? "hsl(43 60% 97%)" : "hsl(43 45% 95%)",
            }}
          >
            {/* Individual transactions for this day */}
            {row.transactions.map((tx, txIdx) => {
              const isJama = tx.amount > 0;
              return (
                <div
                  key={tx.id}
                  className="grid grid-cols-[120px_1fr_140px_140px_120px] gap-0 px-6 py-1.5 items-center"
                >
                  {/* Date — only on first tx of day */}
                  <span className="text-xs font-medium" style={{ color: "hsl(30 40% 40%)" }}>
                    {txIdx === 0 ? formatDate(row.date) : ""}
                  </span>

                  {/* Description */}
                  <span className="text-xs text-amber-900/90 truncate pr-4">
                    {tx.description}
                    {tx.category && (
                      <span className="ml-1.5 text-[10px] opacity-50">· {tx.category}</span>
                    )}
                  </span>

                  {/* Udhar */}
                  <span className="text-xs font-mono text-right pr-4">
                    {!isJama ? (
                      <span className="text-red-700 font-semibold">{formatCurrency(tx.amount)}</span>
                    ) : (
                      <span className="text-amber-300">—</span>
                    )}
                  </span>

                  {/* Jama */}
                  <span className="text-xs font-mono text-right pr-4">
                    {isJama ? (
                      <span className="text-emerald-700 font-semibold">+{formatCurrency(tx.amount)}</span>
                    ) : (
                      <span className="text-amber-300">—</span>
                    )}
                  </span>

                  {/* Baki — only on last tx of day */}
                  <span className="text-xs font-mono text-right">
                    {txIdx === row.transactions.length - 1 ? (
                      <span
                        className="font-bold"
                        style={{ color: row.closingBaki >= 0 ? "hsl(220 60% 40%)" : "hsl(0 70% 45%)" }}
                      >
                        {row.closingBaki >= 0 ? "" : "-"}
                        {showBaki ? formatCurrency(Math.abs(row.closingBaki)) : ""}
                        {!showBaki && (
                          <span style={{ color: row.dayJama >= row.dayUdhar ? "hsl(140 50% 35%)" : "hsl(0 70% 45%)" }}>
                            {row.dayJama >= row.dayUdhar ? "+" : "-"}
                            {formatCurrency(Math.abs(row.dayJama - row.dayUdhar))}
                          </span>
                        )}
                      </span>
                    ) : null}
                  </span>
                </div>
              );
            })}

            {/* Day subtotal row */}
            <div
              className="grid grid-cols-[120px_1fr_140px_140px_120px] gap-0 px-6 py-1 items-center"
              style={{ borderTop: "1px dashed hsl(43 35% 82%)" }}
            >
              <span />
              <span className="text-[10px] uppercase tracking-wider" style={{ color: "hsl(30 40% 55%)" }}>
                Day Total
              </span>
              <span className="text-[11px] font-bold font-mono text-right pr-4 text-red-600">
                {row.dayUdhar > 0 ? formatCurrency(row.dayUdhar) : "—"}
              </span>
              <span className="text-[11px] font-bold font-mono text-right pr-4 text-emerald-600">
                {row.dayJama > 0 ? `+${formatCurrency(row.dayJama)}` : "—"}
              </span>
              <span />
            </div>
          </div>
        ))}
      </div>

      {/* Month-end footer */}
      <div
        className="grid grid-cols-[120px_1fr_140px_140px_120px] gap-0 px-6 py-3 items-center"
        style={{
          background: "hsl(43 50% 88%)",
          borderTop: "2px solid hsl(43 40% 75%)",
        }}
      >
        <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "hsl(30 50% 35%)" }}>
          કુલ · Total
        </span>
        <span />
        <span className="text-sm font-bold font-mono text-right pr-4 text-red-700">
          {formatCurrency(totalUdhar)}
        </span>
        <span className="text-sm font-bold font-mono text-right pr-4 text-emerald-700">
          +{formatCurrency(totalJama)}
        </span>
        <div className="text-right">
          <p
            className="text-sm font-bold font-mono"
            style={{ color: finalBaki >= 0 ? "hsl(220 60% 40%)" : "hsl(0 70% 45%)" }}
          >
            {showBaki
              ? `${finalBaki >= 0 ? "" : "-"}${formatCurrency(Math.abs(finalBaki))}`
              : `${totalJama >= totalUdhar ? "+" : "-"}${formatCurrency(Math.abs(totalJama - totalUdhar))}`}
          </p>
          <p className="text-[9px] uppercase tracking-wider" style={{ color: "hsl(30 40% 55%)" }}>
            {showBaki ? "Closing Baki" : "Net Flow"}
          </p>
        </div>
      </div>
    </div>
  );
}
