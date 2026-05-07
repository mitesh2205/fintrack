import { useState, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Upload as UploadIcon, FileText, ChevronRight, Check, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  "#10B981", // emerald
  "#3B82F6", // blue
  "#8B5CF6", // violet
  "#F59E0B", // amber
  "#EF4444", // red
  "#EC4899", // pink
  "#06B6D4", // cyan
  "#6366F1", // indigo
];

type Step = 1 | 2 | 3;

interface NewAccountForm {
  name: string;
  institution: string;
  type: string;
  lastFour: string;
  color: string;
}

function StepIndicator({ current, total }: { current: Step; total: number }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }).map((_, i) => {
        const stepNum = (i + 1) as Step;
        const isCompleted = stepNum < current;
        const isCurrent = stepNum === current;
        return (
          <div key={i} className="flex items-center gap-2">
            <div
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-colors",
                isCompleted
                  ? "bg-emerald-600 text-white"
                  : isCurrent
                  ? "bg-emerald-600 text-white"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {isCompleted ? <Check className="h-3.5 w-3.5" /> : stepNum}
            </div>
            {i < total - 1 && (
              <div
                className={cn(
                  "h-0.5 w-8 transition-colors",
                  isCompleted ? "bg-emerald-600" : "bg-muted"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function detectInstitution(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.includes("apple")) return "apple_card";
  if (lower.includes("chase")) return "chase";
  if (
    lower.includes("bofa") ||
    lower.includes("bank_of_america") ||
    lower.includes("bankofamerica")
  )
    return "bank_of_america";
  return "";
}

export default function Upload() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>(1);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newAccount, setNewAccount] = useState<NewAccountForm>({
    name: "",
    institution: "",
    type: "credit_card",
    lastFour: "",
    color: COLORS[0],
  });
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [detectedInstitution, setDetectedInstitution] = useState<string>("");
  const [parsedCount, setParsedCount] = useState<number>(0);
  const [skippedCount, setSkippedCount] = useState<number>(0);
  const [previewTransactions, setPreviewTransactions] = useState<Transaction[]>([]);
  const [importedAccountId, setImportedAccountId] = useState<string>("");

  const { data: accounts = [] } = useQuery<Account[]>({
    queryKey: ["/api/accounts"],
  });

  const createAccountMutation = useMutation({
    mutationFn: async (data: NewAccountForm) => {
      const res = await apiRequest("POST", "/api/accounts", data);
      return res.json() as Promise<Account>;
    },
    onSuccess: (account) => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts"] });
      setSelectedAccountId(account.id);
      setIsCreatingNew(false);
      toast({ title: "Account created" });
      setStep(2);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create account",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async ({ file, accountId, institution }: { file: File; accountId: string; institution?: string }) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("accountId", accountId);
      if (institution) formData.append("institution", institution);
      const res = await fetch(`/api/upload`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        throw new Error(errBody?.error || "Upload failed");
      }
      return res.json() as Promise<{ count: number; skipped: number; transactions: Transaction[] }>;
    },
    onSuccess: (data) => {
      setParsedCount(data.count);
      setSkippedCount(data.skipped ?? 0);
      setPreviewTransactions(data.transactions?.slice(0, 5) ?? []);
      setStep(3);
    },
    onError: (error: Error) => {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Transactions are already saved during upload, so "confirm" just
  // refreshes caches and resets the wizard.
  function confirmImport() {
    queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
    queryClient.invalidateQueries({ queryKey: ["/api/analytics/summary"] });
    queryClient.invalidateQueries({ queryKey: ["/api/analytics/merchants"] });
    queryClient.invalidateQueries({ queryKey: ["/api/analytics/recurring"] });
    // Imports advance the auto-balance anchor on liquid accounts → refresh
    // accounts and cashflow so balance and runway reflect new transactions.
    queryClient.invalidateQueries({ queryKey: ["/api/accounts"] });
    queryClient.invalidateQueries({ queryKey: ["/api/analytics/cashflow"] });
    const parts = [`${parsedCount} transaction${parsedCount !== 1 ? "s" : ""} imported successfully.`];
    if (skippedCount > 0) {
      parts.push(`${skippedCount} duplicate${skippedCount !== 1 ? "s" : ""} skipped.`);
    }
    toast({
      title: "Import complete!",
      description: parts.join(" "),
    });
    // Reset flow
    setStep(1);
    setSelectedAccountId("");
    setSelectedFile(null);
    setPreviewTransactions([]);
    setParsedCount(0);
    setSkippedCount(0);
  }

  const handleFileSelect = useCallback((file: File) => {
    if (!file.name.match(/\.(csv|pdf)$/i)) {
      toast({
        title: "Invalid file type",
        description: "Please upload a CSV or PDF file.",
        variant: "destructive",
      });
      return;
    }
    setSelectedFile(file);
    const detected = detectInstitution(file.name);
    setDetectedInstitution(detected);
  }, [toast]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFileSelect(file);
    },
    [handleFileSelect]
  );

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  };

  function proceedStep1() {
    if (isCreatingNew) {
      if (!newAccount.name || !newAccount.institution || !newAccount.type) {
        toast({
          title: "Missing fields",
          description: "Please fill in all account details.",
          variant: "destructive",
        });
        return;
      }
      createAccountMutation.mutate(newAccount);
    } else {
      if (!selectedAccountId) {
        toast({
          title: "No account selected",
          description: "Please select or create an account.",
          variant: "destructive",
        });
        return;
      }
      setStep(2);
    }
  }

  function proceedStep2() {
    if (!selectedFile) {
      toast({
        title: "No file selected",
        description: "Please select a CSV or PDF file to upload.",
        variant: "destructive",
      });
      return;
    }
    const accountId = selectedAccountId;
    setImportedAccountId(accountId);
    uploadMutation.mutate({ file: selectedFile, accountId, institution: detectedInstitution || undefined });
  }

  function formatCurrency(amount: number): string {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(Math.abs(amount));
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Import Statement
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload a bank or credit card statement to import transactions.
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center justify-between">
        <StepIndicator current={step} total={3} />
        <div className="text-sm text-muted-foreground">
          Step {step} of 3
        </div>
      </div>

      {/* Step 1: Select / Create Account */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Select Account</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!isCreatingNew ? (
              <>
                <div className="space-y-2">
                  <Label>Account</Label>
                  <Select
                    value={selectedAccountId}
                    onValueChange={(val) => {
                      if (val === "__new__") {
                        setIsCreatingNew(true);
                        setSelectedAccountId("");
                      } else {
                        setSelectedAccountId(val);
                      }
                    }}
                    data-testid="account-select"
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select an account..." />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map((acct) => (
                        <SelectItem key={acct.id} value={acct.id}>
                          {acct.name}{" "}
                          {acct.lastFour && `(••${acct.lastFour})`}
                        </SelectItem>
                      ))}
                      <SelectItem value="__new__" className="text-emerald-600 dark:text-emerald-400 font-medium">
                        + Create new account
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={proceedStep1}
                  disabled={!selectedAccountId}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                  data-testid="step1-continue"
                >
                  Continue
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </>
            ) : (
              <>
                <div className="grid gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="acct-name">Account Name</Label>
                    <Input
                      id="acct-name"
                      placeholder="e.g. Chase Sapphire"
                      value={newAccount.name}
                      onChange={(e) =>
                        setNewAccount((p) => ({ ...p, name: e.target.value }))
                      }
                      data-testid="new-account-name"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Institution</Label>
                      <Select
                        value={newAccount.institution}
                        onValueChange={(val) =>
                          setNewAccount((p) => ({ ...p, institution: val }))
                        }
                      >
                        <SelectTrigger data-testid="new-account-institution">
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
                        value={newAccount.type}
                        onValueChange={(val) =>
                          setNewAccount((p) => ({ ...p, type: val }))
                        }
                      >
                        <SelectTrigger data-testid="new-account-type">
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
                      value={newAccount.lastFour}
                      onChange={(e) =>
                        setNewAccount((p) => ({
                          ...p,
                          lastFour: e.target.value.replace(/\D/g, ""),
                        }))
                      }
                      data-testid="new-account-last-four"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Card Color</Label>
                    <div className="flex gap-2">
                      {COLORS.map((color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() =>
                            setNewAccount((p) => ({ ...p, color }))
                          }
                          className={cn(
                            "h-7 w-7 rounded-full transition-transform hover:scale-110",
                            newAccount.color === color &&
                              "ring-2 ring-offset-2 ring-foreground scale-110"
                          )}
                          style={{ backgroundColor: color }}
                          aria-label={`Select color ${color}`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button
                    variant="ghost"
                    onClick={() => setIsCreatingNew(false)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={proceedStep1}
                    disabled={createAccountMutation.isPending}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                    data-testid="create-account-submit"
                  >
                    {createAccountMutation.isPending ? "Creating..." : "Create & Continue"}
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 2: Upload File */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Upload Statement</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Drag-and-drop zone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-10 text-center cursor-pointer transition-colors",
                dragOver
                  ? "border-emerald-500 bg-emerald-500/5"
                  : "border-border hover:border-emerald-500/50 hover:bg-muted/30"
              )}
              data-testid="file-drop-zone"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.pdf"
                className="hidden"
                onChange={handleFileInput}
                data-testid="file-input"
              />
              {selectedFile ? (
                <div className="space-y-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 mx-auto">
                    <FileText className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {selectedFile.name}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formatFileSize(selectedFile.size)}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Click to change file
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mx-auto">
                    <UploadIcon className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      Drop your statement here
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      or click to browse — CSV or PDF accepted
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Institution detection hint */}
            {detectedInstitution && (
              <div className="flex items-center gap-2 rounded-md bg-emerald-500/10 px-3 py-2">
                <AlertCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                <p className="text-xs text-emerald-700 dark:text-emerald-400">
                  Detected:{" "}
                  <strong>
                    {INSTITUTIONS.find((i) => i.value === detectedInstitution)
                      ?.label ?? detectedInstitution}
                  </strong>{" "}
                  statement format
                </p>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                variant="ghost"
                onClick={() => setStep(1)}
                className="flex-1"
              >
                Back
              </Button>
              <Button
                onClick={proceedStep2}
                disabled={!selectedFile || uploadMutation.isPending}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                data-testid="step2-upload"
              >
                {uploadMutation.isPending ? "Parsing..." : "Parse Statement"}
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Review & Import */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Review Results</CardTitle>
              <Badge
                variant="secondary"
                className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
              >
                {parsedCount} new{parsedCount !== 1 ? "" : ""}
              </Badge>
              {skippedCount > 0 && (
                <Badge
                  variant="secondary"
                  className="bg-amber-500/10 text-amber-700 dark:text-amber-400"
                >
                  {skippedCount} duplicate{skippedCount !== 1 ? "s" : ""} skipped
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Preview table */}
            {previewTransactions.length > 0 && (
              <div className="rounded-lg border border-border overflow-hidden">
                <div className="grid grid-cols-[100px_1fr_80px] gap-4 border-b border-border bg-muted/50 px-4 py-2">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Date
                  </span>
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Description
                  </span>
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide text-right">
                    Amount
                  </span>
                </div>
                <div className="divide-y divide-border">
                  {previewTransactions.map((tx, i) => (
                    <div
                      key={i}
                      className="grid grid-cols-[100px_1fr_80px] gap-4 px-4 py-2"
                    >
                      <span className="text-xs text-muted-foreground">
                        {tx.date}
                      </span>
                      <span className="text-sm text-foreground truncate">
                        {tx.description}
                      </span>
                      <span
                        className={`text-sm font-mono text-right ${
                          tx.amount > 0
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-foreground"
                        }`}
                      >
                        {tx.amount > 0 ? "+" : "-"}
                        {formatCurrency(tx.amount)}
                      </span>
                    </div>
                  ))}
                </div>
                {parsedCount > previewTransactions.length && (
                  <div className="border-t border-border bg-muted/30 px-4 py-2 text-center">
                    <span className="text-xs text-muted-foreground">
                      + {parsedCount - previewTransactions.length} more transactions
                    </span>
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-2">
              <Button
                variant="ghost"
                onClick={() => setStep(2)}
                className="flex-1"
              >
                Back
              </Button>
              <Button
                onClick={confirmImport}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                data-testid="confirm-import"
              >
                {parsedCount > 0
                  ? `Import ${parsedCount} Transaction${parsedCount !== 1 ? "s" : ""}`
                  : "Done"}
                <Check className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
