import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Pencil, PiggyBank, Check, X } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Budget, Transaction } from "@shared/schema";

const CATEGORIES = [
  "Food & Dining",
  "Shopping",
  "Transportation",
  "Entertainment",
  "Health & Fitness",
  "Travel",
  "Bills & Utilities",
  "Education",
  "Personal Care",
  "Gifts & Donations",
  "Fees & Charges",
  "Other",
];

const PERIODS = [
  { value: "monthly", label: "Monthly" },
  { value: "weekly", label: "Weekly" },
];

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Math.abs(amount));
}

function getProgressColor(pct: number): string {
  if (pct >= 90) return "bg-red-500";
  if (pct >= 70) return "bg-amber-500";
  return "bg-emerald-500";
}

function getProgressTextColor(pct: number): string {
  if (pct >= 90) return "text-red-600 dark:text-red-400";
  if (pct >= 70) return "text-amber-600 dark:text-amber-400";
  return "text-emerald-600 dark:text-emerald-400";
}

interface BudgetFormData {
  category: string;
  limit: string;
  period: string;
}

const defaultForm: BudgetFormData = {
  category: "",
  limit: "",
  period: "monthly",
};

function AddBudgetDialog() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<BudgetFormData>(defaultForm);

  const mutation = useMutation({
    mutationFn: async (data: BudgetFormData) => {
      const res = await apiRequest("POST", "/api/budgets", {
        ...data,
        limit: parseFloat(data.limit),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/budgets"] });
      setOpen(false);
      setForm(defaultForm);
      toast({ title: "Budget created" });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create budget",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.category || !form.limit || !form.period) {
      toast({
        title: "Missing fields",
        description: "Please fill in all budget details.",
        variant: "destructive",
      });
      return;
    }
    const limitNum = parseFloat(form.limit);
    if (isNaN(limitNum) || limitNum <= 0) {
      toast({
        title: "Invalid limit",
        description: "Limit must be a positive number.",
        variant: "destructive",
      });
      return;
    }
    mutation.mutate(form);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
          data-testid="add-budget-btn"
        >
          <Plus className="h-4 w-4" />
          Add Budget
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>New Budget</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Category</Label>
            <Select
              value={form.category}
              onValueChange={(v) => setForm((p) => ({ ...p, category: v }))}
            >
              <SelectTrigger data-testid="budget-category-select">
                <SelectValue placeholder="Select category..." />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="limit">Limit Amount</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                $
              </span>
              <Input
                id="limit"
                type="number"
                min="1"
                step="1"
                placeholder="500"
                value={form.limit}
                onChange={(e) =>
                  setForm((p) => ({ ...p, limit: e.target.value }))
                }
                className="pl-7"
                data-testid="budget-limit-input"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Period</Label>
            <Select
              value={form.period}
              onValueChange={(v) => setForm((p) => ({ ...p, period: v }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERIODS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={mutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {mutation.isPending ? "Creating..." : "Create Budget"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface EditingBudget {
  id: string;
  limit: string;
  period: string;
}

function BudgetCard({
  budget,
  spent,
}: {
  budget: Budget;
  spent: number;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<EditingBudget | null>(null);

  const limitNum = budget.limit;
  const pct = limitNum > 0 ? Math.min((spent / limitNum) * 100, 100) : 0;
  const remaining = Math.max(limitNum - spent, 0);

  const updateMutation = useMutation({
    mutationFn: async (data: EditingBudget) => {
      const res = await apiRequest("PATCH", `/api/budgets/${data.id}`, {
        limit: parseFloat(data.limit),
        period: data.period,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/budgets"] });
      setEditing(null);
      toast({ title: "Budget updated" });
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
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/budgets/${budget.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/budgets"] });
      toast({ title: "Budget deleted" });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <Card
      className="hover:shadow-md transition-shadow"
      data-testid={`budget-card-${budget.id}`}
    >
      <CardHeader className="pb-3 px-5 pt-5">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-semibold text-foreground">{budget.category}</h3>
            <Badge variant="secondary" className="text-xs mt-1">
              {PERIODS.find((p) => p.value === budget.period)?.label ??
                budget.period}
            </Badge>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
              onClick={() =>
                setEditing({
                  id: budget.id,
                  limit: String(budget.limit),
                  period: budget.period,
                })
              }
              data-testid={`edit-budget-${budget.id}`}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                  data-testid={`delete-budget-${budget.id}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete budget?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete the &ldquo;{budget.category}
                    &rdquo; budget. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => deleteMutation.mutate()}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-5 pb-5 space-y-3">
        {editing ? (
          /* Inline edit */
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Limit</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                  $
                </span>
                <Input
                  type="number"
                  min="1"
                  value={editing.limit}
                  onChange={(e) =>
                    setEditing((p) => p ? { ...p, limit: e.target.value } : null)
                  }
                  className="pl-7 h-8 text-sm"
                  data-testid={`edit-budget-limit-${budget.id}`}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Period</Label>
              <Select
                value={editing.period}
                onValueChange={(v) =>
                  setEditing((p) => p ? { ...p, period: v } : null)
                }
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PERIODS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="ghost"
                className="flex-1 h-8"
                onClick={() => setEditing(null)}
              >
                <X className="h-3.5 w-3.5 mr-1" />
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => editing && updateMutation.mutate(editing)}
                disabled={updateMutation.isPending}
                className="flex-1 h-8 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <Check className="h-3.5 w-3.5 mr-1" />
                Save
              </Button>
            </div>
          </div>
        ) : (
          /* View mode */
          <>
            {/* Amounts */}
            <div className="flex items-baseline justify-between">
              <div>
                <span className={cn("text-xl font-bold font-mono", getProgressTextColor(pct))}>
                  {formatCurrency(spent)}
                </span>
                <span className="text-sm text-muted-foreground ml-1">
                  / {formatCurrency(limitNum)}
                </span>
              </div>
              <span className="text-xs text-muted-foreground">
                {Math.round(pct)}%
              </span>
            </div>

            {/* Progress bar */}
            <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  getProgressColor(pct)
                )}
                style={{ width: `${pct}%` }}
              />
            </div>

            {/* Remaining */}
            <p className="text-xs text-muted-foreground">
              {pct >= 100 ? (
                <span className="text-red-600 dark:text-red-400 font-medium">
                  Over budget by {formatCurrency(spent - limitNum)}
                </span>
              ) : (
                <>
                  {formatCurrency(remaining)} remaining
                </>
              )}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function Budgets() {
  const { data: budgets = [], isLoading: budgetLoading } = useQuery<Budget[]>({
    queryKey: ["/api/budgets"],
  });

  const { data: transactions = [], isLoading: txLoading } = useQuery<Transaction[]>({
    queryKey: ["/api/transactions"],
  });

  const isLoading = budgetLoading || txLoading;

  // Calculate spending per category (expenses only, current month)
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const spentByCategory = transactions.reduce<Record<string, number>>(
    (acc, tx) => {
      // Only count expenses (negative amounts) in current month
      if (tx.amount < 0 && tx.date.startsWith(currentMonth)) {
        acc[tx.category] = (acc[tx.category] ?? 0) + Math.abs(tx.amount);
      }
      return acc;
    },
    {}
  );

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Budgets
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {budgets.length} budget{budgets.length !== 1 ? "s" : ""} ·{" "}
            {now.toLocaleString("en-US", { month: "long", year: "numeric" })}
          </p>
        </div>
        <AddBudgetDialog />
      </div>

      {/* Budget grid */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-3 px-5 pt-5">
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                  <Skeleton className="h-7 w-14" />
                </div>
              </CardHeader>
              <CardContent className="px-5 pb-5 space-y-3">
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-2 w-full rounded-full" />
                <Skeleton className="h-3 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : budgets.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
            <PiggyBank className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h2 className="mb-2 text-xl font-semibold text-foreground">
            No budgets yet
          </h2>
          <p className="mb-8 max-w-sm text-muted-foreground text-sm">
            Set spending limits for categories to track where your money goes
            each month.
          </p>
          <AddBudgetDialog />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {budgets.map((budget) => (
            <BudgetCard
              key={budget.id}
              budget={budget}
              spent={spentByCategory[budget.category] ?? 0}
            />
          ))}
        </div>
      )}
    </div>
  );
}
