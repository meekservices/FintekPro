import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeftRight, Plus, Trash2, RefreshCw, AlertTriangle, DollarSign,
  BarChart3, Info, CheckCircle2, Clock, XCircle, RotateCcw,
} from "lucide-react";

interface Journal {
  id: string;
  to_account: string;
  from_account?: string;
  entry_type: string;
  status: string;
  symbol?: string;
  qty?: string;
  price?: string;
  net_amount?: string;
  currency?: string;
  settle_date?: string;
  system_date?: string;
  description?: string;
}

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  executed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
  canceled: "bg-gray-100 text-gray-500",
  rejected: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
};

const STATUS_ICONS: Record<string, JSX.Element> = {
  pending: <Clock className="h-3 w-3" />,
  executed: <CheckCircle2 className="h-3 w-3" />,
  canceled: <XCircle className="h-3 w-3" />,
  rejected: <AlertTriangle className="h-3 w-3" />,
};

export default function JournalsPanel() {
  const { toast } = useToast();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  const [form, setForm] = useState({
    entry_type: "JNLC",
    from_account: "",
    to_account: "",
    amount: "",
    symbol: "",
    qty: "",
    description: "",
  });

  const qKey = ["/api/broker/journals"];

  const { data, isLoading, error, refetch } = useQuery<{ success: boolean; journals: Journal[] }>({
    queryKey: qKey,
    queryFn: () => fetch("/api/broker/journals").then(r => r.json()),
    staleTime: 30_000,
  });

  const journals: Journal[] = (data?.journals ?? []).filter(j => {
    if (statusFilter !== "all" && j.status !== statusFilter) return false;
    if (typeFilter !== "all" && j.entry_type !== typeFilter) return false;
    return true;
  });

  const createMutation = useMutation({
    mutationFn: (body: Record<string, any>) =>
      apiRequest("/api/broker/journals", "POST", body),
    onSuccess: () => {
      toast({ title: "Journal submitted", description: "Journal entry is pending settlement." });
      queryClient.invalidateQueries({ queryKey: qKey });
      setShowCreateDialog(false);
      setForm({ entry_type: "JNLC", from_account: "", to_account: "", amount: "", symbol: "", qty: "", description: "" });
    },
    onError: (err: any) => {
      toast({ title: "Journal failed", description: err.message, variant: "destructive" });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (journalId: string) =>
      apiRequest(`/api/broker/journals/${journalId}`, "DELETE", {}),
    onSuccess: () => {
      toast({ title: "Journal cancelled" });
      queryClient.invalidateQueries({ queryKey: qKey });
    },
    onError: (err: any) => {
      toast({ title: "Cancel failed", description: err.message, variant: "destructive" });
    },
  });

  const reverseMutation = useMutation({
    mutationFn: (journalId: string) =>
      apiRequest(`/api/us-trading/broker/journals/${journalId}/reverse`, "POST", {}),
    onSuccess: () => {
      toast({ title: "Journal reversed", description: "A reversing entry has been created." });
      queryClient.invalidateQueries({ queryKey: qKey });
    },
    onError: (err: any) => {
      toast({ title: "Reverse failed", description: err.message, variant: "destructive" });
    },
  });

  function handleCreate() {
    if (!form.to_account.trim()) return;
    const payload: Record<string, any> = {
      entry_type: form.entry_type,
      to_account: form.to_account.trim(),
      ...(form.from_account.trim() && { from_account: form.from_account.trim() }),
      ...(form.description.trim() && { description: form.description.trim() }),
    };
    if (form.entry_type === "JNLC") {
      if (!form.amount) return;
      payload.amount = parseFloat(form.amount);
    } else {
      if (!form.symbol.trim() || !form.qty) return;
      payload.symbol = form.symbol.trim().toUpperCase();
      payload.qty = parseFloat(form.qty);
    }
    createMutation.mutate(payload);
  }

  const isFormValid = form.entry_type === "JNLC"
    ? !!form.to_account.trim() && !!form.amount && parseFloat(form.amount) > 0
    : !!form.to_account.trim() && !!form.symbol.trim() && !!form.qty && parseFloat(form.qty) > 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="font-semibold text-base">Journals</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            JNLC = cash transfer · JNLS = securities transfer between sub-accounts
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh
          </Button>
          <Button size="sm" onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-1" /> New Journal
          </Button>
        </div>
      </div>

      <Alert className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
        <Info className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        <AlertDescription className="text-xs text-amber-800 dark:text-amber-200">
          <strong>Broker-level operation:</strong> Journals move cash (JNLC) or securities (JNLS) between Alpaca sub-accounts instantly. Irreversible once executed. Requires valid Alpaca account IDs.
        </AlertDescription>
      </Alert>

      <div className="flex gap-2 flex-wrap">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-8 w-36 text-xs">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="executed">Executed</SelectItem>
            <SelectItem value="canceled">Canceled</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="h-8 w-32 text-xs">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="JNLC">JNLC (Cash)</SelectItem>
            <SelectItem value="JNLS">JNLS (Securities)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : error ? (
            <Alert variant="destructive" className="m-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>Failed to load journals. {(error as any).message}</AlertDescription>
            </Alert>
          ) : journals.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 gap-3 text-muted-foreground">
              <ArrowLeftRight className="h-10 w-10 opacity-30" />
              <div className="text-center">
                <p className="font-medium text-sm">No journal entries</p>
                <p className="text-xs mt-1">
                  {statusFilter !== "all" || typeFilter !== "all"
                    ? "No entries match the current filters."
                    : "Journal entries between sub-accounts will appear here."}
                </p>
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>From → To</TableHead>
                  <TableHead>Amount / Qty</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {journals.map(j => (
                  <TableRow key={j.id}>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        {j.entry_type === "JNLC"
                          ? <DollarSign className="h-4 w-4 text-emerald-600" />
                          : <BarChart3 className="h-4 w-4 text-blue-600" />}
                        <Badge variant="outline" className="text-xs font-mono">
                          {j.entry_type}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-xs font-mono">
                        <span className="text-muted-foreground">{j.from_account ? j.from_account.slice(0, 8) + "…" : "Firm"}</span>
                        <span className="mx-1 text-muted-foreground">→</span>
                        <span>{j.to_account.slice(0, 8)}…</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {j.entry_type === "JNLC"
                        ? j.net_amount
                          ? `$${parseFloat(j.net_amount).toFixed(2)}`
                          : "—"
                        : j.qty
                          ? `${j.qty} ${j.symbol || ""}`
                          : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge className={`text-xs flex items-center gap-1 w-fit ${STATUS_STYLES[j.status] ?? "bg-gray-100 text-gray-600"}`}>
                        {STATUS_ICONS[j.status]}
                        {j.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {j.system_date ?? j.settle_date ?? "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {j.status === "pending" && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                                disabled={cancelMutation.isPending}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Cancel journal?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Cancel this pending {j.entry_type} journal entry? This cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Keep</AlertDialogCancel>
                                <AlertDialogAction
                                  className="bg-red-600 hover:bg-red-700"
                                  onClick={() => cancelMutation.mutate(j.id)}
                                >
                                  Cancel Journal
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                        {j.status === "executed" && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-amber-500 hover:text-amber-700 hover:bg-amber-50"
                                disabled={reverseMutation.isPending}
                                title="Reverse journal"
                              >
                                <RotateCcw className="h-3.5 w-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Reverse journal?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Create a reversing entry for this executed {j.entry_type} journal? This will move the funds/securities back to the originating account.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  className="bg-amber-600 hover:bg-amber-700"
                                  onClick={() => reverseMutation.mutate(j.id)}
                                >
                                  Reverse Journal
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowLeftRight className="h-5 w-5" /> New Journal Entry
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Entry Type</label>
              <Select value={form.entry_type} onValueChange={v => setForm(f => ({ ...f, entry_type: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="JNLC">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-emerald-600" />
                      JNLC — Cash Transfer
                    </div>
                  </SelectItem>
                  <SelectItem value="JNLS">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-blue-600" />
                      JNLS — Securities Transfer
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">From Account <span className="text-muted-foreground font-normal">(optional)</span></label>
                <Input
                  placeholder="Alpaca account ID"
                  value={form.from_account}
                  onChange={e => setForm(f => ({ ...f, from_account: e.target.value }))}
                  className="font-mono text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">To Account <span className="text-red-500">*</span></label>
                <Input
                  placeholder="Alpaca account ID"
                  value={form.to_account}
                  onChange={e => setForm(f => ({ ...f, to_account: e.target.value }))}
                  className="font-mono text-xs"
                />
              </div>
            </div>

            {form.entry_type === "JNLC" ? (
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Amount (USD) <span className="text-red-500">*</span></label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input
                    type="number"
                    min="0.01"
                    step="0.01"
                    placeholder="0.00"
                    value={form.amount}
                    onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                    className="pl-7"
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Symbol <span className="text-red-500">*</span></label>
                  <Input
                    placeholder="e.g. AAPL"
                    value={form.symbol}
                    onChange={e => setForm(f => ({ ...f, symbol: e.target.value.toUpperCase() }))}
                    className="font-mono uppercase"
                    maxLength={10}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Quantity <span className="text-red-500">*</span></label>
                  <Input
                    type="number"
                    min="0.001"
                    step="0.001"
                    placeholder="0"
                    value={form.qty}
                    onChange={e => setForm(f => ({ ...f, qty: e.target.value }))}
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Description <span className="text-muted-foreground font-normal">(optional)</span></label>
              <Input
                placeholder="Internal memo / reference"
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                maxLength={256}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!isFormValid || createMutation.isPending}>
              {createMutation.isPending ? (
                <><RefreshCw className="h-4 w-4 mr-1 animate-spin" /> Submitting…</>
              ) : (
                <><ArrowLeftRight className="h-4 w-4 mr-1" /> Submit Journal</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
