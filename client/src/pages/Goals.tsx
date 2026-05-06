import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Target, TrendingUp, CalendarDays, CheckCircle2 } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Goal {
  id: string;
  name: string;
  targetAmount: number;
  savedAmount: number;
  deadline: string | null;
  icon: string | null;
  color: string | null;
  note: string | null;
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

function monthsUntil(dateStr: string): number {
  const now = new Date();
  const target = new Date(dateStr + "T00:00:00");
  return Math.max(
    0,
    (target.getFullYear() - now.getFullYear()) * 12 +
      (target.getMonth() - now.getMonth())
  );
}

function fmtDate(dateStr: string) {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

const PRESET_ICONS = ["🏠", "✈️", "💍", "🎓", "🏥", "🚗", "👶", "🪙", "💻", "🎉", "🌍", "📈", "🛡️", "🏖️", "🎯"];
const PRESET_COLORS = [
  "#10b981", "#3b82f6", "#8b5cf6", "#f59e0b",
  "#ef4444", "#06b6d4", "#ec4899", "#84cc16",
];

// ─── Goal Form ────────────────────────────────────────────────────────────────

interface GoalFormState {
  name: string;
  targetAmount: string;
  savedAmount: string;
  deadline: string;
  icon: string;
  color: string;
  note: string;
}

const EMPTY_FORM: GoalFormState = {
  name: "", targetAmount: "", savedAmount: "0",
  deadline: "", icon: "🎯", color: "#10b981", note: "",
};

function GoalFormDialog({
  open,
  onClose,
  initial,
  onSave,
  saving,
}: {
  open: boolean;
  onClose: () => void;
  initial: GoalFormState;
  onSave: (data: GoalFormState) => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<GoalFormState>(initial);
  // reset when dialog opens
  useMemo(() => { if (open) setForm(initial); }, [open, initial]);

  const set = (k: keyof GoalFormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const valid = form.name.trim() && Number(form.targetAmount) > 0;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="text-xl">{form.icon}</span>
            {initial.name ? "Edit Goal" : "New Goal"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Icon picker */}
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">Icon</Label>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_ICONS.map((ic) => (
                <button
                  key={ic}
                  onClick={() => setForm((f) => ({ ...f, icon: ic }))}
                  className={`text-lg rounded-lg p-1.5 transition-colors border ${
                    form.icon === ic ? "border-primary bg-primary/10" : "border-transparent hover:bg-muted"
                  }`}
                >
                  {ic}
                </button>
              ))}
            </div>
          </div>

          {/* Name */}
          <div>
            <Label htmlFor="goal-name" className="text-xs text-muted-foreground mb-1 block">Goal name</Label>
            <Input id="goal-name" placeholder="e.g. India trip, Down payment" value={form.name} onChange={set("name")} />
          </div>

          {/* Target + Saved */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="goal-target" className="text-xs text-muted-foreground mb-1 block">Target ($)</Label>
              <Input id="goal-target" type="number" min="0" step="100" placeholder="10000" value={form.targetAmount} onChange={set("targetAmount")} />
            </div>
            <div>
              <Label htmlFor="goal-saved" className="text-xs text-muted-foreground mb-1 block">Already saved ($)</Label>
              <Input id="goal-saved" type="number" min="0" step="10" placeholder="0" value={form.savedAmount} onChange={set("savedAmount")} />
            </div>
          </div>

          {/* Deadline */}
          <div>
            <Label htmlFor="goal-deadline" className="text-xs text-muted-foreground mb-1 block">Target date (optional)</Label>
            <Input id="goal-deadline" type="date" value={form.deadline} onChange={set("deadline")} />
          </div>

          {/* Color picker */}
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">Color</Label>
            <div className="flex gap-2 flex-wrap">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setForm((f) => ({ ...f, color: c }))}
                  className={`h-7 w-7 rounded-full border-2 transition-transform ${
                    form.color === c ? "border-foreground scale-110" : "border-transparent"
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {/* Note */}
          <div>
            <Label htmlFor="goal-note" className="text-xs text-muted-foreground mb-1 block">Note (optional)</Label>
            <Input id="goal-note" placeholder="Why this goal matters..." value={form.note} onChange={set("note")} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={() => onSave(form)} disabled={!valid || saving}>
            {saving ? "Saving…" : "Save Goal"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Goal Card ────────────────────────────────────────────────────────────────

function GoalCard({
  goal,
  onEdit,
  onDelete,
  onAddSavings,
}: {
  goal: Goal;
  onEdit: (g: Goal) => void;
  onDelete: (id: string) => void;
  onAddSavings: (g: Goal) => void;
}) {
  const pct = Math.min(100, goal.targetAmount > 0 ? (goal.savedAmount / goal.targetAmount) * 100 : 0);
  const remaining = Math.max(0, goal.targetAmount - goal.savedAmount);
  const done = pct >= 100;
  const color = goal.color ?? "#10b981";

  const monthsLeft = goal.deadline ? monthsUntil(goal.deadline) : null;
  const monthlyNeeded = monthsLeft && monthsLeft > 0 && remaining > 0
    ? remaining / monthsLeft
    : null;

  return (
    <Card className="admin-card border-none shadow-sm overflow-hidden">
      {/* Color strip */}
      <div className="h-1 w-full" style={{ backgroundColor: color }} />

      <CardContent className="pt-4 pb-4 px-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-2xl flex-shrink-0">{goal.icon ?? "🎯"}</span>
            <div className="min-w-0">
              <p className="font-semibold text-foreground truncate">{goal.name}</p>
              {goal.note && <p className="text-xs text-muted-foreground truncate mt-0.5">{goal.note}</p>}
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(goal)}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => onDelete(goal.id)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Progress */}
        <div className="mt-4">
          <div className="flex justify-between items-baseline mb-1.5">
            <span className="text-sm font-mono font-semibold" style={{ color }}>{fmtFull(goal.savedAmount)}</span>
            <span className="text-xs text-muted-foreground">of {fmt(goal.targetAmount)}</span>
          </div>
          <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${pct}%`, backgroundColor: color }}
            />
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-xs text-muted-foreground">{pct.toFixed(0)}% saved</span>
            {!done && <span className="text-xs text-muted-foreground">{fmt(remaining)} to go</span>}
            {done && (
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> Complete!
              </span>
            )}
          </div>
        </div>

        {/* Stats row */}
        {!done && (
          <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
            {goal.deadline && (
              <span className="flex items-center gap-1">
                <CalendarDays className="h-3 w-3" />
                {fmtDate(goal.deadline)}
                {monthsLeft !== null && ` · ${monthsLeft}mo left`}
              </span>
            )}
            {monthlyNeeded && (
              <span className="flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                {fmt(monthlyNeeded)}/mo needed
              </span>
            )}
          </div>
        )}

        {/* Add savings button */}
        {!done && (
          <Button
            variant="outline"
            size="sm"
            className="mt-3 w-full text-xs h-7"
            onClick={() => onAddSavings(goal)}
          >
            + Add savings
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Add Savings Dialog ───────────────────────────────────────────────────────

function AddSavingsDialog({
  goal,
  onClose,
  onSave,
  saving,
}: {
  goal: Goal | null;
  onClose: () => void;
  onSave: (id: string, amount: number) => void;
  saving: boolean;
}) {
  const [amount, setAmount] = useState("");

  useMemo(() => { if (goal) setAmount(""); }, [goal?.id]);

  if (!goal) return null;
  const addAmt = parseFloat(amount) || 0;
  const newTotal = goal.savedAmount + addAmt;
  const valid = addAmt > 0;

  return (
    <Dialog open={!!goal} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-xs">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>{goal.icon ?? "🎯"}</span> Add to {goal.name}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label htmlFor="add-amount" className="text-xs text-muted-foreground mb-1 block">Amount to add ($)</Label>
            <Input
              id="add-amount"
              type="number"
              min="0"
              step="10"
              placeholder="100"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              autoFocus
            />
          </div>
          {addAmt > 0 && (
            <p className="text-xs text-muted-foreground">
              New total: <span className="font-semibold text-foreground">{fmtFull(newTotal)}</span>
              {" "}of {fmt(goal.targetAmount)}
              {" "}({Math.min(100, (newTotal / goal.targetAmount) * 100).toFixed(0)}%)
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={() => onSave(goal.id, addAmt)} disabled={!valid || saving}>
            {saving ? "Saving…" : "Add"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Goals() {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Goal | null>(null);
  const [addSavingsTarget, setAddSavingsTarget] = useState<Goal | null>(null);

  const { data: goals = [], isLoading } = useQuery<Goal[]>({
    queryKey: ["/api/goals"],
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["/api/goals"] });

  const createMutation = useMutation({
    mutationFn: (body: object) =>
      fetch("/api/goals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json()),
    onSuccess: () => { invalidate(); setDialogOpen(false); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: object }) =>
      fetch(`/api/goals/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json()),
    onSuccess: () => { invalidate(); setEditTarget(null); setAddSavingsTarget(null); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => fetch(`/api/goals/${id}`, { method: "DELETE" }).then((r) => r.json()),
    onSuccess: invalidate,
  });

  function handleSave(form: GoalFormState) {
    const body = {
      name: form.name.trim(),
      targetAmount: parseFloat(form.targetAmount),
      savedAmount: parseFloat(form.savedAmount) || 0,
      deadline: form.deadline || null,
      icon: form.icon,
      color: form.color,
      note: form.note.trim() || null,
    };
    if (editTarget) {
      updateMutation.mutate({ id: editTarget.id, body });
    } else {
      createMutation.mutate(body);
    }
  }

  function handleAddSavings(id: string, amount: number) {
    const goal = goals.find((g) => g.id === id);
    if (!goal) return;
    updateMutation.mutate({ id, body: { savedAmount: goal.savedAmount + amount } });
  }

  const formInitial: GoalFormState = editTarget
    ? {
        name: editTarget.name,
        targetAmount: String(editTarget.targetAmount),
        savedAmount: String(editTarget.savedAmount),
        deadline: editTarget.deadline ?? "",
        icon: editTarget.icon ?? "🎯",
        color: editTarget.color ?? "#10b981",
        note: editTarget.note ?? "",
      }
    : EMPTY_FORM;

  // Summary stats
  const stats = useMemo(() => {
    const totalTarget = goals.reduce((s, g) => s + g.targetAmount, 0);
    const totalSaved  = goals.reduce((s, g) => s + g.savedAmount, 0);
    const completed   = goals.filter((g) => g.savedAmount >= g.targetAmount).length;
    return { totalTarget, totalSaved, completed };
  }, [goals]);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Goals</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Every rupee with a destination — track your saving targets
            </p>
          </div>
          <Button onClick={() => { setEditTarget(null); setDialogOpen(true); }} className="gap-2">
            <Plus className="h-4 w-4" /> New Goal
          </Button>
        </div>

        {/* Summary stats */}
        {!isLoading && goals.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="admin-card border-none shadow-sm">
              <CardContent className="pt-4 pb-4 px-5">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Target</p>
                <p className="mt-1 text-2xl font-bold text-foreground">{fmt(stats.totalTarget)}</p>
              </CardContent>
            </Card>
            <Card className="admin-card border-none shadow-sm">
              <CardContent className="pt-4 pb-4 px-5">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Saved</p>
                <p className="mt-1 text-2xl font-bold text-emerald-600 dark:text-emerald-400">{fmt(stats.totalSaved)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {stats.totalTarget > 0 ? ((stats.totalSaved / stats.totalTarget) * 100).toFixed(0) : 0}% of all goals
                </p>
              </CardContent>
            </Card>
            <Card className="admin-card border-none shadow-sm">
              <CardContent className="pt-4 pb-4 px-5">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Completed</p>
                <p className="mt-1 text-2xl font-bold text-foreground">
                  {stats.completed} <span className="text-base font-normal text-muted-foreground">/ {goals.length}</span>
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Goal cards */}
        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="admin-card border-none shadow-sm overflow-hidden">
                <div className="h-1 bg-muted" />
                <CardContent className="pt-4 pb-4 px-5 space-y-3">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-2.5 w-full rounded-full" />
                  <Skeleton className="h-4 w-32" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : goals.length === 0 ? (
          <Card className="admin-card border-none shadow-sm">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <Target className="h-12 w-12 text-muted-foreground/30 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">No goals yet</p>
              <p className="mt-1 text-xs text-muted-foreground/60">
                Create your first goal — down payment, India trip, emergency fund…
              </p>
              <Button className="mt-4 gap-2" onClick={() => { setEditTarget(null); setDialogOpen(true); }}>
                <Plus className="h-4 w-4" /> Add your first goal
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {goals.map((g) => (
              <GoalCard
                key={g.id}
                goal={g}
                onEdit={(goal) => { setEditTarget(goal); setDialogOpen(true); }}
                onDelete={(id) => deleteMutation.mutate(id)}
                onAddSavings={(goal) => setAddSavingsTarget(goal)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create / Edit dialog */}
      <GoalFormDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditTarget(null); }}
        initial={formInitial}
        onSave={handleSave}
        saving={createMutation.isPending || updateMutation.isPending}
      />

      {/* Add savings dialog */}
      <AddSavingsDialog
        goal={addSavingsTarget}
        onClose={() => setAddSavingsTarget(null)}
        onSave={handleAddSavings}
        saving={updateMutation.isPending}
      />
    </div>
  );
}
