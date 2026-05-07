import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Building2, CreditCard, Landmark, Pencil, Check } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import type { Account, Transaction } from "@shared/schema";

const INSTITUTIONS = [
  { value: "apple_card", label: "Apple Card" },
  { value: "chase", label: "Chase" },
  { value: "bank_of_america", label: "Bank of America" },
  { value: "other", label: "Other" },
];

const ACCOUNT_TYPES = [
  { value: "credit_card", label: "Credit Card" },
  { value: "checking", label: "Checking" },
  { value: "savings", label: "Savings" },
];

const COLORS = [
  "#10B981",
  "#3B82F6",
  "#8B5CF6",
  "#F59E0B",
  "#EF4444",
  "#EC4899",
  "#06B6D4",
  "#6366F1",
];

function getInstitutionLabel(value: string): string {
  return INSTITUTIONS.find((i) => i.value === value)?.label ?? value;
}

function getTypeLabel(value: string): string {
  return ACCOUNT_TYPES.find((t) => t.value === value)?.label ?? value;
}

function AccountTypeIcon({ type }: { type: string }) {
  if (type === "credit_card") return <CreditCard className="h-4 w-4" />;
  if (type === "savings") return <Landmark className="h-4 w-4" />;
  return <Building2 className="h-4 w-4" />;
}

interface AccountFormData {
  name: string;
  institution: string;
  type: string;
  lastFour: string;
  color: string;
}

const defaultForm: AccountFormData = {
  name: "",
  institution: "",
  type: "credit_card",
  lastFour: "",
  color: COLORS[0],
};

function AddAccountDialog() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<AccountFormData>(defaultForm);

  const mutation = useMutation({
    mutationFn: async (data: AccountFormData) => {
      const res = await apiRequest("POST", "/api/accounts", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts"] });
      setOpen(false);
      setForm(defaultForm);
      toast({ title: "Account added" });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to add account",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.institution || !form.type) {
      toast({
        title: "Missing fields",
        description: "Name, institution and type are required.",
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
          data-testid="add-account-btn"
        >
          <Plus className="h-4 w-4" />
          Add Account
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Account</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Account Name</Label>
            <Input
              id="name"
              placeholder="e.g. Chase Sapphire"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              data-testid="account-name-input"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Institution</Label>
              <Select
                value={form.institution}
                onValueChange={(v) => setForm((p) => ({ ...p, institution: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  {INSTITUTIONS.map((inst) => (
                    <SelectItem key={inst.value} value={inst.value}>
                      {inst.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select
                value={form.type}
                onValueChange={(v) => setForm((p) => ({ ...p, type: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACCOUNT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="last-four">Last 4 Digits (optional)</Label>
            <Input
              id="last-four"
              placeholder="1234"
              maxLength={4}
              value={form.lastFour}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  lastFour: e.target.value.replace(/\D/g, ""),
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Card Color</Label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, color }))}
                  className={cn(
                    "h-7 w-7 rounded-full transition-transform hover:scale-110",
                    form.color === color &&
                      "ring-2 ring-offset-2 ring-foreground scale-110"
                  )}
                  style={{ backgroundColor: color }}
                  aria-label={`Select color ${color}`}
                />
              ))}
            </div>
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
              {mutation.isPending ? "Adding..." : "Add Account"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AccountCard({
  account,
  transactionCount,
}: {
  account: Account;
  transactionCount: number;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingBalance, setEditingBalance] = useState(false);
  const [balanceInput, setBalanceInput] = useState("");
  const balanceRef = useRef<HTMLInputElement>(null);

  const updateMutation = useMutation({
    mutationFn: async (currentBalance: number | null) => {
      const res = await apiRequest("PATCH", `/api/accounts/${account.id}`, { currentBalance });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/cashflow"] });
      setEditingBalance(false);
      toast({ title: "Balance updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update balance", description: error.message, variant: "destructive" });
    },
  });

  function startEditBalance() {
    setBalanceInput(account.currentBalance != null ? String(account.currentBalance) : "");
    setEditingBalance(true);
    setTimeout(() => balanceRef.current?.focus(), 0);
  }

  function saveBalance() {
    const val = parseFloat(balanceInput);
    if (balanceInput.trim() === "") {
      updateMutation.mutate(null);
    } else if (!isNaN(val)) {
      updateMutation.mutate(val);
    } else {
      toast({ title: "Invalid amount", variant: "destructive" });
    }
  }

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/accounts/${account.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/cashflow"] });
      toast({ title: "Account deleted" });
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
      className="overflow-hidden hover:shadow-md transition-shadow"
      data-testid={`account-card-${account.id}`}
    >
      {/* Colored left border accent */}
      <div
        className="h-1.5 w-full"
        style={{ backgroundColor: account.color ?? COLORS[0] }}
      />
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {/* Icon circle */}
            <div
              className="flex h-10 w-10 items-center justify-center rounded-full flex-shrink-0"
              style={{ backgroundColor: `${account.color ?? COLORS[0]}20` }}
            >
              <span style={{ color: account.color ?? COLORS[0] }}>
                <AccountTypeIcon type={account.type} />
              </span>
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-foreground truncate">
                {account.name}
              </h3>
              {account.lastFour && (
                <p className="text-sm text-muted-foreground font-mono">
                  ••••&nbsp;{account.lastFour}
                </p>
              )}
            </div>
          </div>

          {/* Delete button */}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive flex-shrink-0"
                data-testid={`delete-account-${account.id}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete account?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete &ldquo;{account.name}&rdquo; and
                  all {transactionCount} associated transaction
                  {transactionCount !== 1 ? "s" : ""}. This cannot be undone.
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

        {/* Metadata row */}
        <div className="mt-4 flex items-center gap-2 flex-wrap">
          <Badge variant="secondary" className="text-xs">
            {getInstitutionLabel(account.institution)}
          </Badge>
          <Badge variant="outline" className="text-xs">
            {getTypeLabel(account.type)}
          </Badge>
          <span className="ml-auto text-xs text-muted-foreground">
            {transactionCount} transaction{transactionCount !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Current balance — only for checking/savings, used for Roj-Med Baki */}
        {(account.type === "checking" || account.type === "savings") && (
          <div className="mt-3 pt-3 border-t border-border flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">Current Balance</span>
            {editingBalance ? (
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">$</span>
                <input
                  ref={balanceRef}
                  type="number"
                  step="0.01"
                  value={balanceInput}
                  onChange={(e) => setBalanceInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") saveBalance(); if (e.key === "Escape") setEditingBalance(false); }}
                  className="w-24 h-6 text-xs border border-border rounded px-1.5 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  placeholder="0.00"
                />
                <button
                  onClick={saveBalance}
                  disabled={updateMutation.isPending}
                  className="h-6 w-6 flex items-center justify-center rounded text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                >
                  <Check className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={startEditBalance}
                className="flex items-center gap-1.5 group"
              >
                <span className={`text-sm font-semibold ${account.currentBalance != null ? "text-foreground" : "text-muted-foreground/50 text-xs"}`}>
                  {account.currentBalance != null
                    ? `$${account.currentBalance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    : "Set balance"}
                </span>
                <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function Accounts() {
  const { data: accounts = [], isLoading: acctLoading } = useQuery<Account[]>({
    queryKey: ["/api/accounts"],
  });

  const { data: transactions = [], isLoading: txLoading } = useQuery<Transaction[]>({
    queryKey: ["/api/transactions"],
  });

  const isLoading = acctLoading || txLoading;

  // Count transactions per account
  const txCountByAccount = transactions.reduce<Record<string, number>>(
    (acc, tx) => {
      acc[tx.accountId] = (acc[tx.accountId] ?? 0) + 1;
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
            Accounts
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {accounts.length} account{accounts.length !== 1 ? "s" : ""} connected
          </p>
        </div>
        <AddAccountDialog />
      </div>

      {/* Account grid */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="overflow-hidden">
              <Skeleton className="h-1.5 w-full" />
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <Skeleton className="h-5 w-20" />
                  <Skeleton className="h-5 w-16" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : accounts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-blue-500/10">
            <Building2 className="h-8 w-8 text-blue-500" />
          </div>
          <h2 className="mb-2 text-xl font-semibold text-foreground">
            No accounts yet
          </h2>
          <p className="mb-8 max-w-sm text-muted-foreground text-sm">
            Add your bank and credit card accounts to start importing transactions.
          </p>
          <AddAccountDialog />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map((account) => (
            <AccountCard
              key={account.id}
              account={account}
              transactionCount={txCountByAccount[account.id] ?? 0}
            />
          ))}
        </div>
      )}
    </div>
  );
}
