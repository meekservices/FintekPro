import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Users, ArrowRightLeft, FileText, TrendingUp, Shield,
  RefreshCw, AlertTriangle, CheckCircle2, Clock, XCircle,
  Search, Plus, Download, BarChart3, Activity, ChevronRight,
  Landmark, Building2, Wallet, BookOpen, Calendar,
  Globe, KeyRound, ExternalLink, Server, Info, Copy, Lock,
  DollarSign, Zap, Crown, BadgeIndianRupee,
} from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

const BASE = "/api/us-trading";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusBadge(status: string) {
  const map: Record<string, string> = {
    ACTIVE: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    APPROVED: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    SUBMITTED: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    PENDING: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
    ACTION_REQUIRED: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
    ACCOUNT_UPDATED: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
    REJECTED: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
    DISABLED: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
    ACCOUNT_CLOSED: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
    QUEUED: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    SENT_TO_CLEARING: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
    COMPLETE: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    CANCELED: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${map[status] || "bg-muted text-muted-foreground"}`}>
      {status?.replace(/_/g, " ")}
    </span>
  );
}

function usd(val?: string | number) {
  const n = parseFloat(String(val ?? "0"));
  return isNaN(n) ? "—" : `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(s?: string) {
  if (!s) return "—";
  try { return format(new Date(s), "MMM d, yyyy"); } catch { return s; }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ConfigBanner({ configured }: { configured: boolean }) {
  if (configured) return null;
  return (
    <Alert className="border-orange-200 bg-orange-50 dark:bg-orange-950/20 dark:border-orange-800 mb-6">
      <AlertTriangle className="h-4 w-4 text-orange-500" />
      <AlertDescription className="text-orange-700 dark:text-orange-300">
        Alpaca Broker API credentials are not configured. Go to{" "}
        <a href="/us-trading" className="underline font-medium">US Trading → Account tab</a>{" "}
        to configure your broker API key.
      </AlertDescription>
    </Alert>
  );
}

// ─── Revenue & Monetization Tab ──────────────────────────────────────────────

function RevenueTab() {
  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/subscriptions/admin/revenue"],
    staleTime: 30_000,
  });

  function formatInr(paise: number | string) {
    const n = typeof paise === "string" ? parseInt(paise, 10) : paise;
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n / 100);
  }

  const stats = data?.stats?.[0] ?? {};
  const tierBreakdown: { plan_tier: string; cnt: string }[] = data?.tierBreakdown ?? [];
  const recent: any[] = data?.recent ?? [];

  const kpis = [
    { icon: BadgeIndianRupee, label: "MRR", value: isLoading ? "…" : formatInr(stats.mrr_paise || 0), sub: "This month", color: "text-blue-600" },
    { icon: TrendingUp, label: "ARR (run-rate)", value: isLoading ? "…" : formatInr((parseInt(stats.mrr_paise || "0") * 12).toString()), sub: "Annualised", color: "text-green-600" },
    { icon: Users, label: "Active Subscribers", value: isLoading ? "…" : (stats.active_subscriptions || 0), sub: `${stats.pro_count || 0} Pro · ${stats.elite_count || 0} Elite`, color: "text-purple-600" },
    { icon: DollarSign, label: "Total Revenue", value: isLoading ? "…" : formatInr(stats.total_revenue_paise || 0), sub: "All time", color: "text-amber-600" },
  ];

  const tierMeta: Record<string, { icon: typeof Zap; label: string; color: string }> = {
    pro: { icon: Zap, label: "Pro", color: "text-blue-600" },
    elite: { icon: Crown, label: "Elite", color: "text-yellow-600" },
  };

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(({ icon: Icon, label, value, sub, color }) => (
          <Card key={label}>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-2 mb-2">
                <div className={`rounded-lg bg-muted p-1.5`}>
                  <Icon className={`h-4 w-4 ${color}`} />
                </div>
                <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</span>
              </div>
              <div className="text-2xl font-bold">{value}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tier Breakdown */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4" /> Plan Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => <div key={i} className="h-8 bg-muted animate-pulse rounded" />)}
              </div>
            ) : (
              <div className="space-y-3">
                {/* Free users (all users minus active paid subs) */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-slate-500" />
                    <span className="font-medium text-sm">Free</span>
                  </div>
                  <Badge variant="outline">Active</Badge>
                </div>
                {tierBreakdown.length === 0 ? (
                  <div className="text-center py-4 text-sm text-muted-foreground">No paid subscriptions yet</div>
                ) : (
                  tierBreakdown.map(({ plan_tier, cnt }) => {
                    const m = tierMeta[plan_tier];
                    if (!m) return null;
                    return (
                      <div key={plan_tier} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                        <div className="flex items-center gap-2">
                          <m.icon className={`h-4 w-4 ${m.color}`} />
                          <span className="font-medium text-sm">{m.label}</span>
                        </div>
                        <Badge>{cnt} users</Badge>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Revenue Streams Guide */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="h-4 w-4" /> Revenue Streams
            </CardTitle>
            <CardDescription className="text-xs">India-optimized monetization model</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm">
              {[
                { label: "Subscription (SaaS)", value: "₹999–₹1L/yr per user", color: "bg-blue-100 text-blue-800" },
                { label: "FX Spread (LRS/USD)", value: "0.25%–1% per remittance", color: "bg-green-100 text-green-800" },
                { label: "Per-trade fee", value: "₹0–₹10 per order", color: "bg-purple-100 text-purple-800" },
                { label: "Idle Cash Yield", value: "1–1.5% of uninvested cash", color: "bg-amber-100 text-amber-800" },
                { label: "Securities Lending", value: "30–50% of lending income", color: "bg-red-100 text-red-800" },
              ].map(({ label, value, color }) => (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-muted-foreground">{label}</span>
                  <Badge className={`text-xs ${color} border-0`}>{value}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Subscriptions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4" /> Recent Subscriptions
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-10 bg-muted animate-pulse rounded" />)}</div>
          ) : recent.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              No subscriptions yet. Share the <a href="/pricing" className="text-primary underline">/pricing</a> page to get started.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Cycle</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recent.map((sub: any) => (
                  <TableRow key={sub.id}>
                    <TableCell className="font-mono text-xs">{sub.userId?.slice(0, 12)}…</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={sub.planTier === "elite" ? "text-yellow-700 border-yellow-300" : "text-blue-700 border-blue-300"}>
                        {sub.planTier}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs capitalize">{sub.billingCycle}</TableCell>
                    <TableCell className="font-medium">
                      ₹{((sub.amountPaise || 0) / 100).toLocaleString("en-IN")}
                    </TableCell>
                    <TableCell>{statusBadge(sub.status?.toUpperCase())}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {sub.createdAt ? fmtDate(sub.createdAt) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AccountsTab() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [selectedAccount, setSelectedAccount] = useState<any>(null);
  const [cipDialogOpen, setCipDialogOpen] = useState(false);

  const { data, isLoading, refetch } = useQuery<{ configured: boolean; accounts: any[] }>({
    queryKey: ["/api/us-trading/broker/accounts", status, search],
    queryFn: () =>
      fetch(`${BASE}/broker/accounts?${new URLSearchParams({ ...(search ? { query: search } : {}), ...(status !== "all" ? { status } : {}) })}`)
        .then(r => r.json()),
  });

  const { data: cipData, isLoading: cipLoading } = useQuery<{ success: boolean; cip: any }>({
    queryKey: ["/api/us-trading/broker/accounts/:id/cip", selectedAccount?.id],
    enabled: !!selectedAccount?.id && cipDialogOpen,
    queryFn: () => fetch(`${BASE}/broker/accounts/${selectedAccount.id}/cip`).then(r => r.json()),
  });

  const closeMutation = useMutation({
    mutationFn: (accountId: string) =>
      apiRequest("DELETE", `${BASE}/broker/accounts/${accountId}`),
    onSuccess: () => {
      toast({ title: "Account closure initiated" });
      refetch();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const accounts = data?.accounts || [];
  const configured = data?.configured !== false;

  return (
    <div className="space-y-4">
      <ConfigBanner configured={configured} />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by name, email, phone, account number…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Status filter" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="SUBMITTED">Submitted</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="ACTION_REQUIRED">Action Required</SelectItem>
            <SelectItem value="REJECTED">Rejected</SelectItem>
            <SelectItem value="ACCOUNT_CLOSED">Closed</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={() => refetch()}>
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>KYC</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  [...Array(5)].map((_, i) => (
                    <TableRow key={i}>
                      {[...Array(7)].map((_, j) => (
                        <TableCell key={j}><div className="h-4 bg-muted animate-pulse rounded w-24" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : accounts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                      {configured ? "No accounts found" : "Configure Alpaca Broker API to view accounts"}
                    </TableCell>
                  </TableRow>
                ) : (
                  accounts.map((acc: any) => (
                    <TableRow key={acc.id}>
                      <TableCell className="font-mono text-xs">{acc.account_number || acc.id?.slice(0, 8)}</TableCell>
                      <TableCell className="font-medium">
                        {acc.identity?.given_name} {acc.identity?.family_name}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{acc.contact?.email_address || "—"}</TableCell>
                      <TableCell>{statusBadge(acc.status)}</TableCell>
                      <TableCell>
                        {acc.kyc_results?.approved ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : acc.kyc_results ? (
                          <AlertTriangle className="h-4 w-4 text-yellow-500" />
                        ) : (
                          <Clock className="h-4 w-4 text-muted-foreground" />
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{fmtDate(acc.created_at)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Dialog open={cipDialogOpen && selectedAccount?.id === acc.id} onOpenChange={open => { setCipDialogOpen(open); if (open) setSelectedAccount(acc); }}>
                            <DialogTrigger asChild>
                              <Button size="sm" variant="outline" onClick={() => setSelectedAccount(acc)}>
                                <Shield className="h-3.5 w-3.5 mr-1" /> CIP
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl">
                              <DialogHeader>
                                <DialogTitle>CIP / KYC Status — {acc.account_number || acc.id?.slice(0, 8)}</DialogTitle>
                              </DialogHeader>
                              {cipLoading ? (
                                <div className="flex items-center justify-center py-8">
                                  <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
                                </div>
                              ) : cipData?.cip ? (
                                <div className="space-y-4">
                                  <div className="grid grid-cols-2 gap-4">
                                    {[
                                      { label: "KYC Result", value: cipData.cip.kyc?.result, badge: true },
                                      { label: "KYC Status", value: cipData.cip.kyc?.status, badge: true },
                                      { label: "Risk Level", value: cipData.cip.kyc?.risk_level },
                                      { label: "Risk Score", value: cipData.cip.kyc?.risk_score },
                                      { label: "Document", value: cipData.cip.document?.result, badge: true },
                                      { label: "Photo", value: cipData.cip.photo?.result, badge: true },
                                      { label: "Identity", value: cipData.cip.identity?.result, badge: true },
                                      { label: "Watchlist", value: cipData.cip.watchlist?.result, badge: true },
                                    ].map(({ label, value, badge }) => (
                                      <div key={label} className="space-y-1">
                                        <p className="text-xs text-muted-foreground">{label}</p>
                                        {badge ? statusBadge(value || "N/A") : <p className="text-sm font-medium">{value ?? "—"}</p>}
                                      </div>
                                    ))}
                                  </div>
                                  <p className="text-xs text-muted-foreground">Providers: {cipData.cip.provider_name?.join(", ") || "—"}</p>
                                </div>
                              ) : (
                                <p className="text-sm text-muted-foreground py-4">No CIP data available for this account.</p>
                              )}
                            </DialogContent>
                          </Dialog>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-500 hover:text-red-700"
                            onClick={() => { if (confirm(`Close account ${acc.account_number}?`)) closeMutation.mutate(acc.id); }}
                          >
                            Close
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">{accounts.length} account{accounts.length !== 1 ? "s" : ""} total</p>
    </div>
  );
}

function JournalsTab() {
  const { toast } = useToast();
  const [entryType, setEntryType] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({ from_account: "", to_account: "", entry_type: "JNLC", amount: "", symbol: "", qty: "", description: "" });

  const { data, isLoading, refetch } = useQuery<{ success: boolean; journals: any[] }>({
    queryKey: ["/api/us-trading/broker/journals", entryType],
    queryFn: () => fetch(`${BASE}/broker/journals${entryType !== "all" ? `?entry_type=${entryType}` : ""}`).then(r => r.json()),
  });

  const createMutation = useMutation({
    mutationFn: () => apiRequest("POST", `${BASE}/broker/journals`, {
      from_account: form.from_account,
      to_account: form.to_account,
      entry_type: form.entry_type as "JNLC" | "JNLS",
      ...(form.amount ? { amount: form.amount } : {}),
      ...(form.symbol ? { symbol: form.symbol } : {}),
      ...(form.qty ? { qty: form.qty } : {}),
      ...(form.description ? { description: form.description } : {}),
    }),
    onSuccess: () => {
      toast({ title: "Journal entry created" });
      setFormOpen(false);
      setForm({ from_account: "", to_account: "", entry_type: "JNLC", amount: "", symbol: "", qty: "", description: "" });
      refetch();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `${BASE}/broker/journals/${id}`),
    onSuccess: () => { toast({ title: "Journal cancelled" }); refetch(); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const journals = data?.journals || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Select value={entryType} onValueChange={setEntryType}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="JNLC">JNLC (Cash)</SelectItem>
              <SelectItem value="JNLS">JNLS (Securities)</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => refetch()}>
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>
        <Dialog open={formOpen} onOpenChange={setFormOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" /> New Journal</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Journal Entry</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Entry Type</Label>
                  <Select value={form.entry_type} onValueChange={v => setForm(f => ({ ...f, entry_type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="JNLC">JNLC — Cash</SelectItem>
                      <SelectItem value="JNLS">JNLS — Securities</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>{form.entry_type === "JNLC" ? "Amount (USD)" : "Qty"}</Label>
                  <Input
                    placeholder={form.entry_type === "JNLC" ? "100.00" : "10"}
                    value={form.entry_type === "JNLC" ? form.amount : form.qty}
                    onChange={e => setForm(f => form.entry_type === "JNLC" ? { ...f, amount: e.target.value } : { ...f, qty: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>From Account ID</Label>
                <Input placeholder="UUID of source account" value={form.from_account} onChange={e => setForm(f => ({ ...f, from_account: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>To Account ID</Label>
                <Input placeholder="UUID of destination account" value={form.to_account} onChange={e => setForm(f => ({ ...f, to_account: e.target.value }))} />
              </div>
              {form.entry_type === "JNLS" && (
                <div className="space-y-1.5">
                  <Label>Symbol</Label>
                  <Input placeholder="AAPL" value={form.symbol} onChange={e => setForm(f => ({ ...f, symbol: e.target.value.toUpperCase() }))} />
                </div>
              )}
              <div className="space-y-1.5">
                <Label>Description (optional)</Label>
                <Input placeholder="Internal note" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
              <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !form.from_account || !form.to_account}>
                {createMutation.isPending ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : null}
                Create Journal
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Journal ID</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead>Amount / Symbol</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  [...Array(3)].map((_, i) => (
                    <TableRow key={i}>{[...Array(8)].map((_, j) => <TableCell key={j}><div className="h-4 bg-muted animate-pulse rounded w-20" /></TableCell>)}</TableRow>
                  ))
                ) : journals.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No journal entries</TableCell></TableRow>
                ) : (
                  journals.map((j: any) => (
                    <TableRow key={j.id}>
                      <TableCell className="font-mono text-xs">{j.id?.slice(0, 8)}…</TableCell>
                      <TableCell><Badge variant="outline">{j.entry_type}</Badge></TableCell>
                      <TableCell className="font-mono text-xs">{j.from_account?.slice(0, 8)}…</TableCell>
                      <TableCell className="font-mono text-xs">{j.to_account?.slice(0, 8)}…</TableCell>
                      <TableCell>{j.net_amount ? usd(j.net_amount) : j.symbol ? `${j.qty} × ${j.symbol}` : "—"}</TableCell>
                      <TableCell>{statusBadge(j.status)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{fmtDate(j.settle_date)}</TableCell>
                      <TableCell className="text-right">
                        {j.status === "PENDING" && (
                          <Button size="sm" variant="ghost" className="text-red-500" onClick={() => cancelMutation.mutate(j.id)}>
                            Cancel
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ReportsTab() {
  const { toast } = useToast();
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({ type: "account_statement", start: "", end: "", account_ids: "" });

  const { data, isLoading, refetch } = useQuery<{ success: boolean; reports: any[] }>({
    queryKey: ["/api/us-trading/broker/reports"],
    queryFn: () => fetch(`${BASE}/broker/reports`).then(r => r.json()),
  });

  const createMutation = useMutation({
    mutationFn: () => apiRequest("POST", `${BASE}/broker/reports`, {
      type: form.type,
      start: form.start,
      end: form.end,
      ...(form.account_ids ? { account_ids: form.account_ids.split(",").map(s => s.trim()) } : {}),
    }),
    onSuccess: () => {
      toast({ title: "Report requested", description: "It may take a few minutes to generate." });
      setFormOpen(false);
      refetch();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const reports = data?.reports || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="outline" size="icon" onClick={() => refetch()}>
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
        </Button>
        <Dialog open={formOpen} onOpenChange={setFormOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Generate Report</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Generate Report</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="space-y-1.5">
                <Label>Report Type</Label>
                <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="account_statement">Account Statement</SelectItem>
                    <SelectItem value="trade_confirmation">Trade Confirmation</SelectItem>
                    <SelectItem value="tax_1099">Tax 1099</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Start Date</Label>
                  <Input type="date" value={form.start} onChange={e => setForm(f => ({ ...f, start: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>End Date</Label>
                  <Input type="date" value={form.end} onChange={e => setForm(f => ({ ...f, end: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Account IDs (optional, comma-separated)</Label>
                <Input placeholder="Leave empty for all accounts" value={form.account_ids} onChange={e => setForm(f => ({ ...f, account_ids: e.target.value }))} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
              <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !form.start || !form.end}>
                {createMutation.isPending ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : null}
                Request Report
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Download</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  [...Array(3)].map((_, i) => (
                    <TableRow key={i}>{[...Array(5)].map((_, j) => <TableCell key={j}><div className="h-4 bg-muted animate-pulse rounded w-24" /></TableCell>)}</TableRow>
                  ))
                ) : reports.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No reports generated yet</TableCell></TableRow>
                ) : (
                  reports.map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.name || r.id?.slice(0, 8)}</TableCell>
                      <TableCell><Badge variant="outline">{r.type?.replace(/_/g, " ")}</Badge></TableCell>
                      <TableCell>{statusBadge(r.status)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{fmtDate(r.date || r.created_at)}</TableCell>
                      <TableCell className="text-right">
                        {r.url && (
                          <Button size="sm" variant="ghost" asChild>
                            <a href={r.url} target="_blank" rel="noopener noreferrer">
                              <Download className="h-4 w-4" />
                            </a>
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ActivitiesTab() {
  const [activityType, setActivityType] = useState("");

  const { data, isLoading, refetch } = useQuery<{ success: boolean; activities: any[] }>({
    queryKey: ["/api/us-trading/broker/activities", activityType],
    queryFn: () =>
      fetch(`${BASE}/broker/activities${activityType ? `?activity_type=${activityType}` : ""}`).then(r => r.json()),
  });

  const activities = data?.activities || [];

  const activityIcon: Record<string, any> = {
    FILL: TrendingUp,
    ACATC: ArrowRightLeft,
    ACATS: ArrowRightLeft,
    DIV: BarChart3,
    JNLC: Landmark,
    JNLS: Landmark,
    CSD: Wallet,
    CSW: Wallet,
    PTC: Activity,
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Select value={activityType} onValueChange={setActivityType}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All activity types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Types</SelectItem>
            <SelectItem value="FILL">Trade Fills (FILL)</SelectItem>
            <SelectItem value="JNLC">Journal Cash (JNLC)</SelectItem>
            <SelectItem value="JNLS">Journal Securities (JNLS)</SelectItem>
            <SelectItem value="DIV">Dividends (DIV)</SelectItem>
            <SelectItem value="CSD">Deposit (CSD)</SelectItem>
            <SelectItem value="CSW">Withdrawal (CSW)</SelectItem>
            <SelectItem value="ACATC">ACAT (Cash)</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={() => refetch()}>
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
        </Button>
      </div>
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>Symbol</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Net Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  [...Array(5)].map((_, i) => (
                    <TableRow key={i}>{[...Array(7)].map((_, j) => <TableCell key={j}><div className="h-4 bg-muted animate-pulse rounded w-20" /></TableCell>)}</TableRow>
                  ))
                ) : activities.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No activities found</TableCell></TableRow>
                ) : (
                  activities.map((a: any) => {
                    const Icon = activityIcon[a.activity_type] || Activity;
                    return (
                      <TableRow key={a.id}>
                        <TableCell className="text-sm">{fmtDate(a.date)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                            <Badge variant="outline" className="text-xs">{a.activity_type}</Badge>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{a.account_id?.slice(0, 8)}…</TableCell>
                        <TableCell className="font-medium">{a.symbol || "—"}</TableCell>
                        <TableCell>{a.qty || "—"}</TableCell>
                        <TableCell>{a.price ? usd(a.price) : "—"}</TableCell>
                        <TableCell className={parseFloat(a.net_amount || "0") >= 0 ? "text-green-600" : "text-red-500"}>
                          {a.net_amount ? usd(a.net_amount) : "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function CorporateActionsTab() {
  const [caType, setCaType] = useState("");
  const [symbol, setSymbol] = useState("");

  const { data, isLoading, refetch } = useQuery<{ success: boolean; corporate_actions: any[] }>({
    queryKey: ["/api/us-trading/broker/corporate-actions", caType, symbol],
    queryFn: () =>
      fetch(`${BASE}/broker/corporate-actions?${new URLSearchParams({ ...(caType ? { ca_types: caType } : {}), ...(symbol ? { symbol } : {}) })}`)
        .then(r => r.json()),
  });

  const actions = data?.corporate_actions || [];

  const typeLabel: Record<string, string> = {
    dividend: "Dividend",
    merger_update: "Merger",
    spin_off: "Spin-off",
    stock_split: "Stock Split",
    unit_split: "Unit Split",
    name_change: "Name Change",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Select value={caType} onValueChange={setCaType}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All action types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Types</SelectItem>
            <SelectItem value="dividend">Dividend</SelectItem>
            <SelectItem value="merger_update">Merger</SelectItem>
            <SelectItem value="spin_off">Spin-off</SelectItem>
            <SelectItem value="stock_split">Stock Split</SelectItem>
            <SelectItem value="name_change">Name Change</SelectItem>
          </SelectContent>
        </Select>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9 w-32" placeholder="Symbol" value={symbol} onChange={e => setSymbol(e.target.value.toUpperCase())} />
        </div>
        <Button variant="outline" size="icon" onClick={() => refetch()}>
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
        </Button>
      </div>
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Symbol</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Cash</TableHead>
                  <TableHead>Ex Date</TableHead>
                  <TableHead>Record Date</TableHead>
                  <TableHead>Payable Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  [...Array(5)].map((_, i) => (
                    <TableRow key={i}>{[...Array(6)].map((_, j) => <TableCell key={j}><div className="h-4 bg-muted animate-pulse rounded w-20" /></TableCell>)}</TableRow>
                  ))
                ) : actions.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No corporate actions found</TableCell></TableRow>
                ) : (
                  actions.map((a: any) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-bold">{a.initiating_symbol}</TableCell>
                      <TableCell><Badge variant="outline">{typeLabel[a.corporate_action_type] || a.corporate_action_type}</Badge></TableCell>
                      <TableCell>{a.cash !== "0" ? usd(a.cash) : "—"}</TableCell>
                      <TableCell className="text-sm">{fmtDate(a.ex_date)}</TableCell>
                      <TableCell className="text-sm">{fmtDate(a.record_date)}</TableCell>
                      <TableCell className="text-sm">{fmtDate(a.payable_date)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── App Registration & Setup Tab ──────────────────────────────────────────────

function AppRegistrationTab() {
  const { data: configData } = useQuery<{ configured: boolean; isBrokerApi: boolean; baseUrl: string }>({
    queryKey: ["/api/us-trading/alpaca/config"],
    staleTime: 60000,
  });

  const isSandbox = configData?.baseUrl?.includes("sandbox");
  const configured = configData?.configured ?? false;

  const setupSteps = [
    {
      step: 1,
      title: "Apply for Broker API Access",
      description: "Submit your application to Alpaca to become a Fully-Disclosed Broker-Dealer (FD BD). This grants you access to the Broker API to manage sub-accounts.",
      status: configured ? "done" : "pending",
      action: { label: "Alpaca Broker Application", url: "https://alpaca.markets/broker" },
    },
    {
      step: 2,
      title: "Configure API Credentials",
      description: "Once approved, add your ALPACA_API_KEY and ALPACA_SECRET_KEY to the environment. These are your Broker API keys — not trading API keys.",
      status: configured ? "done" : "pending",
      action: null,
    },
    {
      step: 3,
      title: "Switch to Broker API Base URL",
      description: "Sandbox: broker-api.sandbox.alpaca.markets — Production: broker-api.alpaca.markets. Set ALPACA_BASE_URL accordingly.",
      status: configData?.isBrokerApi ? "done" : "pending",
      action: null,
    },
    {
      step: 4,
      title: "Run Account Opening Wizard",
      description: "Clients submit KYC → you call POST /v1/accounts → Alpaca approves → call POST /v1/accounts/{id}/cip to submit CIP result. The wizard handles all of this.",
      status: "info",
      action: null,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Architecture overview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Globe className="h-4 w-4 text-primary" />
            Fully-Disclosed Broker-Dealer Architecture
          </CardTitle>
          <CardDescription>
            FintekPro operates as an FD BD via Alpaca — you run KYC, Alpaca provides custody and clearing.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                icon: Shield,
                color: "text-blue-500",
                bg: "bg-blue-50 dark:bg-blue-950/20",
                title: "FintekPro (You)",
                items: ["Run SEBI/RBI KYC", "Onboard clients", "Place orders", "Manage LRS/FEMA"],
              },
              {
                icon: ArrowRightLeft,
                color: "text-purple-500",
                bg: "bg-purple-50 dark:bg-purple-950/20",
                title: "Alpaca Broker API",
                items: ["Sub-account creation", "Order routing", "Trade settlement", "CIP / AML"],
              },
              {
                icon: Landmark,
                color: "text-green-500",
                bg: "bg-green-50 dark:bg-green-950/20",
                title: "Clearing & Custody",
                items: ["FINRA member", "SIPC protected", "US equities", "Real-time settlement"],
              },
            ].map(({ icon: Icon, color, bg, title, items }) => (
              <div key={title} className={`rounded-lg p-4 ${bg}`}>
                <div className="flex items-center gap-2 mb-3">
                  <Icon className={`h-4 w-4 ${color}`} />
                  <span className="font-medium text-sm">{title}</span>
                </div>
                <ul className="space-y-1">
                  {items.map(item => (
                    <li key={item} className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <ChevronRight className="h-3 w-3 shrink-0" /> {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950/20 py-3">
            <Info className="h-3.5 w-3.5 text-blue-500" />
            <AlertDescription className="text-xs text-blue-700 dark:text-blue-300">
              <strong>Note on "App Registration":</strong> The OAuth App Registration at <code>app.alpaca.markets/connect</code> is for <em>consumer-facing apps</em> that use Alpaca's OAuth to connect retail users' personal Alpaca accounts (revenue sharing model). As a Fully-Disclosed Broker-Dealer, FintekPro does NOT need OAuth app registration — you already have direct Broker API access via your API key/secret.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Setup checklist */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            Broker API Setup Checklist
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {setupSteps.map(s => (
            <div key={s.step} className="flex items-start gap-4 p-3 rounded-lg border">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm font-bold ${
                s.status === "done" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
                s.status === "info" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" :
                "bg-muted text-muted-foreground"
              }`}>
                {s.status === "done" ? <CheckCircle2 className="h-4 w-4" /> : s.step}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{s.title}</span>
                  {s.status === "done" && <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-xs">Done</Badge>}
                  {s.status === "info" && <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 text-xs">Auto</Badge>}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{s.description}</p>
                {s.action && (
                  <a
                    href={s.action.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1.5"
                  >
                    <ExternalLink className="h-3 w-3" />
                    {s.action.label}
                  </a>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Environment & API info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Server className="h-4 w-4 text-primary" />
            Current Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-xs text-muted-foreground">API Status</p>
              <p className="font-semibold text-sm flex items-center gap-1.5 mt-0.5">
                {configured ? <><CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> Connected</> : <><XCircle className="h-3.5 w-3.5 text-red-500" /> Not configured</>}
              </p>
            </div>
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-xs text-muted-foreground">API Type</p>
              <p className="font-semibold text-sm flex items-center gap-1.5 mt-0.5">
                {configData?.isBrokerApi ? <><Lock className="h-3.5 w-3.5 text-primary" /> Broker API</> : "Trading API (basic)"}
              </p>
            </div>
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-xs text-muted-foreground">Environment</p>
              <p className="font-semibold text-sm flex items-center gap-1.5 mt-0.5">
                {isSandbox ? (
                  <><Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">Sandbox</Badge></>
                ) : (
                  <><Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Production</Badge></>
                )}
              </p>
            </div>
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-xs text-muted-foreground">Base URL</p>
              <p className="font-mono text-xs mt-0.5 break-all">{configData?.baseUrl || "Not set"}</p>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Quick Links</p>
            {[
              { label: "Broker API Docs", url: "https://docs.alpaca.markets/reference/getallaccounts" },
              { label: "Sandbox Broker Portal", url: "https://broker-app.sandbox.alpaca.markets" },
              { label: "Production Broker Portal", url: "https://broker-app.alpaca.markets" },
              { label: "FINRA BrokerCheck", url: "https://brokercheck.finra.org" },
            ].map(link => (
              <a
                key={link.url}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-primary hover:underline"
              >
                <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                {link.label}
              </a>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function BrokerDashboard() {
  const { data: configData } = useQuery<{ configured: boolean; isBrokerApi: boolean; baseUrl: string }>({
    queryKey: ["/api/us-trading/alpaca/config"],
    queryFn: () => fetch(`${BASE}/alpaca/config`).then(r => r.json()),
  });

  const configured = configData?.configured ?? false;
  const isBrokerApi = configData?.isBrokerApi ?? false;

  const { data: accountsData } = useQuery<{ configured: boolean; accounts: any[] }>({
    queryKey: ["/api/us-trading/broker/accounts"],
    queryFn: () => fetch(`${BASE}/broker/accounts`).then(r => r.json()),
    enabled: configured && isBrokerApi,
  });

  const accounts = accountsData?.accounts || [];
  const activeCount = accounts.filter((a: any) => a.status === "ACTIVE").length;
  const pendingCount = accounts.filter((a: any) => ["SUBMITTED", "PENDING", "ACTION_REQUIRED"].includes(a.status)).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Alpaca Broker Dashboard</h1>
        <p className="text-muted-foreground text-sm">
          Fully-disclosed broker-dealer — account management, journals, reports & compliance
        </p>
      </div>

      {/* Status Bar */}
      <div className="flex flex-wrap gap-2 items-center">
        <Badge variant={configured ? "default" : "secondary"} className="gap-1">
          {configured ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
          {configured ? "API Connected" : "API Not Configured"}
        </Badge>
        <Badge variant={isBrokerApi ? "default" : "outline"} className="gap-1">
          <Landmark className="h-3 w-3" />
          {isBrokerApi ? "Broker API" : "Trading API"}
        </Badge>
        {configData?.baseUrl && (
          <span className="text-xs text-muted-foreground font-mono">{configData.baseUrl}</span>
        )}
      </div>

      {/* KPI Cards */}
      {configured && isBrokerApi && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { title: "Total Accounts", value: accounts.length, icon: Users, color: "text-blue-500" },
            { title: "Active", value: activeCount, icon: CheckCircle2, color: "text-green-500" },
            { title: "Pending Review", value: pendingCount, icon: Clock, color: "text-yellow-500" },
            { title: "Environment", value: configData?.baseUrl?.includes("sandbox") ? "Sandbox" : "Live", icon: Shield, color: "text-purple-500" },
          ].map(({ title, value, icon: Icon, color }) => (
            <Card key={title}>
              <CardContent className="p-4 flex items-center gap-3">
                <Icon className={`h-5 w-5 ${color}`} />
                <div>
                  <p className="text-xs text-muted-foreground">{title}</p>
                  <p className="text-xl font-bold">{value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="accounts">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="accounts" className="gap-1.5"><Users className="h-3.5 w-3.5" /> Accounts</TabsTrigger>
          <TabsTrigger value="activities" className="gap-1.5"><Activity className="h-3.5 w-3.5" /> Activities</TabsTrigger>
          <TabsTrigger value="journals" className="gap-1.5"><ArrowRightLeft className="h-3.5 w-3.5" /> Journals</TabsTrigger>
          <TabsTrigger value="reports" className="gap-1.5"><FileText className="h-3.5 w-3.5" /> Reports</TabsTrigger>
          <TabsTrigger value="corporate-actions" className="gap-1.5"><BarChart3 className="h-3.5 w-3.5" /> Corp Actions</TabsTrigger>
          <TabsTrigger value="app-registration" className="gap-1.5"><Globe className="h-3.5 w-3.5" /> Setup & BD Model</TabsTrigger>
          <TabsTrigger value="revenue" className="gap-1.5"><BadgeIndianRupee className="h-3.5 w-3.5" /> Revenue</TabsTrigger>
        </TabsList>

        <TabsContent value="accounts" className="mt-4"><AccountsTab /></TabsContent>
        <TabsContent value="activities" className="mt-4"><ActivitiesTab /></TabsContent>
        <TabsContent value="journals" className="mt-4"><JournalsTab /></TabsContent>
        <TabsContent value="reports" className="mt-4"><ReportsTab /></TabsContent>
        <TabsContent value="corporate-actions" className="mt-4"><CorporateActionsTab /></TabsContent>
        <TabsContent value="app-registration" className="mt-4"><AppRegistrationTab /></TabsContent>
        <TabsContent value="revenue" className="mt-4"><RevenueTab /></TabsContent>
      </Tabs>
    </div>
  );
}
