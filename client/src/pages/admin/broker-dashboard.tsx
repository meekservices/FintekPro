import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useSearch } from "wouter";
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
  DollarSign, Zap, Crown, BadgeIndianRupee, Rocket, Power,
} from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

const BASE = "/api/us-trading";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusBadge(status: string) {
  const map: { [key: string]: string } = {
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

type RevenueData = {
  stats: {
    mrr_paise: string | number;
    active_subscriptions: number;
    pro_count: number;
    elite_count: number;
    total_revenue_paise: string | number;
  }[];
  tierBreakdown: { plan_tier: string; cnt: string }[];
  recent: {
    id: number;
    userId: string;
    userName: string;
    planTier: string;
    billingCycle: string;
    amountPaise: number;
    status: string;
    createdAt: string;
  }[];
}

type BrokerAccount = {
  id: string;
  account_number: string;
  status: string;
  currency: string;
  created_at: string;
  last_equity?: string;
  account_type?: string;
  identity?: {
    given_name: string;
    family_name: string;
  };
  contact?: {
    email_address: string;
  };
  kyc_results?: {
    approved: boolean;
  };
};

type JournalEntry = {
  id: string;
  entry_type: string;
  from_account: string;
  to_account: string;
  amount: string;
  status: string;
  settle_date: string;
  description?: string;
  net_amount?: string;
  symbol?: string;
  qty?: string;
  compliance_signature?: string;
};

type BrokerReport = {
  id: string;
  type: string;
  status: string;
  created_at: string;
  period_start: string;
  period_end: string;
  name?: string;
  date?: string;
  url?: string;
};

type BrokerActivity = {
  id: string;
  activity_type: string;
  transaction_time: string;
  symbol?: string;
  qty?: string;
  price?: string;
  net_amount?: string;
  date?: string;
  account_id?: string;
};

type CorporateAction = {
  id: string;
  action_type: string;
  symbol: string;
  effective_date: string;
  status: string;
  initiating_symbol?: string;
  corporate_action_type: string;
  cash?: string;
  ex_date?: string;
  record_date?: string;
  payable_date?: string;
};

type TeamMember = {
  id: string;
  user_id: string;
  role: string;
  status: string;
  last_login?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  roles?: string[];
  lastLoginAt?: string;
  isActive?: boolean;
};

type CipData = {
  kyc?: {
    result: string;
    status: string;
    risk_level: string;
    risk_score: string;
    action_flags: string[];
  };
  document?: { result: string };
  photo?: { result: string };
  identity?: { result: string };
  watchlist?: { result: string };
  provider_name?: string[];
};

type FirmAccount = {
  id: string;
  account_number: string;
  status: string;
  currency: string;
  equity: string;
  created_at: string;
};

function RevenueTab() {
  const { data, isLoading } = useQuery<RevenueData>({
    queryKey: ["/api/subscriptions/admin/revenue"],
    staleTime: 30_000,
  });

  function formatInr(paise: number | string) {
    const n = typeof paise === "string" ? parseInt(paise, 10) : paise;
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n / 100);
  }

  const stats = data?.stats?.[0] ?? {
    mrr_paise: 0,
    active_subscriptions: 0,
    pro_count: 0,
    elite_count: 0,
    total_revenue_paise: 0
  };
  const tierBreakdown = data?.tierBreakdown ?? [];
  const recent = data?.recent ?? [];

  const kpis = [
    { icon: BadgeIndianRupee, label: "MRR", value: isLoading ? "…" : formatInr(stats.mrr_paise || 0), sub: "This month", color: "text-blue-600" },
    { icon: TrendingUp, label: "ARR (run-rate)", value: isLoading ? "…" : formatInr(Number(stats.mrr_paise || 0) * 12), sub: "Annualised", color: "text-green-600" },
    { icon: Users, label: "Active Subscribers", value: isLoading ? "…" : (stats.active_subscriptions || 0), sub: `${stats.pro_count || 0} Pro · ${stats.elite_count || 0} Elite`, color: "text-purple-600" },
    { icon: DollarSign, label: "Total Revenue", value: isLoading ? "…" : formatInr(stats.total_revenue_paise || 0), sub: "All time", color: "text-amber-600" },
  ];

  const tierMeta = {
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
                    const m = tierMeta[plan_tier as keyof typeof tierMeta];
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
                {recent.map((sub) => (
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
  const [selectedAccount, setSelectedAccount] = useState<BrokerAccount | null>(null);
  const [cipDialogOpen, setCipDialogOpen] = useState(false);

  type AccountsResponse = { configured: boolean; accounts: BrokerAccount[] };
  const { data, isLoading, refetch } = useQuery<AccountsResponse>({
    queryKey: ["/api/us-trading/broker/accounts", status, search],
    queryFn: () =>
      fetch(`${BASE}/broker/accounts?${new URLSearchParams({ ...(search ? { query: search } : {}), ...(status !== "all" ? { status } : {}) })}`)
        .then(r => r.json()),
  });

  type CipResponse = { success: boolean; cip: CipData };
  const { data: cipData, isLoading: cipLoading } = useQuery<CipResponse>({
    queryKey: ["/api/us-trading/broker/accounts/:id/cip", selectedAccount?.id],
    enabled: !!selectedAccount?.id && cipDialogOpen,
    queryFn: () => {
      if (!selectedAccount?.id) throw new Error("No account selected");
      return fetch(`${BASE}/broker/accounts/${selectedAccount.id}/cip`).then(r => r.json());
    },
  });

  const closeMutation = useMutation({
    mutationFn: (accountId: string) =>
      apiRequest("DELETE", `${BASE}/broker/accounts/${accountId}`),
    onSuccess: () => {
      toast({ title: "Account closure initiated" });
      refetch();
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
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
                  accounts.map((acc: BrokerAccount) => (
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
                                  {(cipData.cip.kyc?.action_flags?.length ?? 0) > 0 && (
                                    <Alert className="border-red-200 bg-red-50 dark:bg-red-950/20 py-2">
                                      <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
                                      <AlertDescription className="text-xs text-red-700 dark:text-red-300">
                                        <strong>Action Required:</strong> {cipData.cip.kyc?.action_flags?.join(", ").replace(/_/g, " ")}
                                      </AlertDescription>
                                    </Alert>
                                  )}
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
  const [form, setForm] = useState<{
    from_account: string;
    to_account: string;
    entry_type: "JNLC" | "JNLS";
    amount: string;
    symbol: string;
    qty: string;
    description: string;
  }>({ from_account: "", to_account: "", entry_type: "JNLC", amount: "", symbol: "", qty: "", description: "" });

  const { data, isLoading, refetch } = useQuery<{ success: boolean; journals: JournalEntry[] }>({
    queryKey: ["/api/us-trading/broker/journals", entryType],
    queryFn: () => fetch(`${BASE}/broker/journals${entryType !== "all" ? `?entry_type=${entryType}` : ""}`).then(r => r.json()),
  });

  const createMutation = useMutation({
    mutationFn: () => apiRequest("POST", `${BASE}/broker/journals`, {
      from_account: form.from_account,
      to_account: form.to_account,
      entry_type: form.entry_type,
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
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `${BASE}/broker/journals/${id}`),
    onSuccess: () => { toast({ title: "Journal cancelled" }); refetch(); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
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
                  <Select value={form.entry_type} onValueChange={v => setForm(f => ({ ...f, entry_type: v as "JNLC" | "JNLS" }))}>
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
                  <TableHead>Forensic</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  [...Array(3)].map((_, i) => (
                    <TableRow key={i}>{[...Array(9)].map((_, j) => <TableCell key={j}><div className="h-4 bg-muted animate-pulse rounded w-20" /></TableCell>)}</TableRow>
                  ))
                ) : journals.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No journal entries</TableCell></TableRow>
                ) : (
                  journals.map((j: JournalEntry) => (
                    <TableRow key={j.id}>
                      <TableCell className="font-mono text-xs">{j.id?.slice(0, 8)}…</TableCell>
                      <TableCell><Badge variant="outline">{j.entry_type}</Badge></TableCell>
                      <TableCell className="font-mono text-xs">{j.from_account?.slice(0, 8)}…</TableCell>
                      <TableCell className="font-mono text-xs">{j.to_account?.slice(0, 8)}…</TableCell>
                      <TableCell>{j.net_amount ? usd(j.net_amount) : j.symbol ? `${j.qty} × ${j.symbol}` : "—"}</TableCell>
                      <TableCell>{statusBadge(j.status)}</TableCell>
                      <TableCell>
                        {j.compliance_signature ? (
                          <div className="flex items-center gap-1 group cursor-help">
                            <Lock className="h-3 w-3 text-green-500" />
                            <span className="text-[10px] text-muted-foreground opacity-50 group-hover:opacity-100 transition-opacity">
                              {j.compliance_signature.slice(0, 8)}…
                            </span>
                          </div>
                        ) : (
                          <span className="text-[10px] text-muted-foreground italic">No signature</span>
                        )}
                      </TableCell>
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

  const { data, isLoading, refetch } = useQuery<{ success: boolean; reports: BrokerReport[] }>({
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
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const downloadMutation = useMutation({
    mutationFn: (reportId: string) =>
      fetch(`${BASE}/broker/reports/${reportId}/download`).then(r => r.json()),
    onSuccess: (data) => {
      if (data?.url) window.open(data.url, "_blank");
      else toast({ title: "Download unavailable", description: "Report may still be processing.", variant: "destructive" });
    },
    onError: (e: Error) => toast({ title: "Download failed", description: e.message, variant: "destructive" }),
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
                  reports.map((r: BrokerReport) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.name || r.id?.slice(0, 8)}</TableCell>
                      <TableCell><Badge variant="outline">{r.type?.replace(/_/g, " ")}</Badge></TableCell>
                      <TableCell>{statusBadge(r.status)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{fmtDate(r.date || r.created_at)}</TableCell>
                      <TableCell className="text-right">
                        {r.status === "complete" || r.url ? (
                          r.url ? (
                            <Button size="sm" variant="ghost" asChild>
                              <a href={r.url} target="_blank" rel="noopener noreferrer" aria-label="Download report">
                                <Download className="h-4 w-4" />
                              </a>
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => downloadMutation.mutate(r.id)}
                              disabled={downloadMutation.isPending}
                            >
                              {downloadMutation.isPending
                                ? <RefreshCw className="h-4 w-4 animate-spin" />
                                : <Download className="h-4 w-4" />}
                            </Button>
                          )
                        ) : null}
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

  const { data, isLoading, refetch } = useQuery<{ success: boolean; activities: BrokerActivity[] }>({
    queryKey: ["/api/us-trading/broker/activities", activityType],
    queryFn: () =>
      fetch(`${BASE}/broker/activities${activityType ? `?activity_type=${activityType}` : ""}`).then(r => r.json()),
  });

  const activities = data?.activities || [];

  const activityIcon: Record<string, React.ComponentType<{ className?: string }>> = {
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
                  activities.map((a) => {
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

  const { data, isLoading, refetch } = useQuery<{ success: boolean; corporate_actions: CorporateAction[] }>({
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
                  actions.map((a: CorporateAction) => (
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

function GatewayHealthCard() {
  const { data, isLoading, refetch, isFetching } = useQuery<{
    summary: { total: number; healthy: number; degraded: number; down: number };
    services: Record<string, { state: string; failures: number; category: string }>;
  }>({
    queryKey: ["/api/admin/system/external-api-health"],
    staleTime: 30000,
  });

  const paymentCategories = ["payment", "broking"];
  const paymentKeywords = ["cashfree", "phonepe", "razorpay", "stripe", "alpaca"];

  const allServices = Object.entries(data?.services ?? {}).map(([name, info]) => ({ name, ...info }));
  const filtered = allServices.filter(s =>
    paymentCategories.includes(s.category) ||
    paymentKeywords.some(k => s.name.toLowerCase().includes(k))
  );

  const stateColor = (state: string) => {
    if (state === "CLOSED") return "text-green-600 bg-green-50 dark:bg-green-950/20 dark:text-green-400";
    if (state === "HALF_OPEN") return "text-amber-600 bg-amber-50 dark:bg-amber-950/20 dark:text-amber-400";
    return "text-red-600 bg-red-50 dark:bg-red-950/20 dark:text-red-400";
  };

  const { healthy = 0, degraded = 0, down = 0 } = data?.summary ?? {};

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            Payment Gateway Health
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
        <CardDescription>
          Circuit breaker status — {healthy} healthy, {degraded} degraded, {down} down
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-sm text-muted-foreground">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="text-sm text-muted-foreground">No payment gateway circuit breakers registered.</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {filtered.map(svc => (
              <div key={svc.name} className="rounded-lg border p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-sm capitalize">{svc.name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded font-medium ${stateColor(svc.state)}`}>
                    {svc.state}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground space-y-0.5">
                  <div>Failures: <span className="text-foreground font-medium">{svc.failures}</span></div>
                  <div>Category: <span className="text-foreground font-medium capitalize">{svc.category}</span></div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AppRegistrationTab() {
  const { toast } = useToast();
  const [apiKey, setApiKey] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("https://broker-api.sandbox.alpaca.markets");
  const [showSecret, setShowSecret] = useState(false);

  const { data: configData, refetch: refetchConfig } = useQuery<{
    configured: boolean; authOk: boolean; authError?: string; isBrokerApi: boolean; baseUrl: string;
  }>({
    queryKey: ["/api/us-trading/alpaca/config"],
    staleTime: 30000,
  });

  const authOk = configData?.authOk ?? false;

  const { data: ipData, refetch: refetchIps } = useQuery<{ success: boolean; ips: string[] }>({
    queryKey: ["/api/us-trading/broker/ip-allowlist"],
    queryFn: () => fetch(`${BASE}/broker/ip-allowlist`).then(r => r.json()),
  });

  const { data: teamData } = useQuery<{ success: boolean; team: TeamMember[] }>({
    queryKey: ["/api/us-trading/admin/team"],
    queryFn: () => fetch(`${BASE}/admin/team`).then(r => r.json()),
  });

  const addIpMutation = useMutation({
    mutationFn: (ip: string) => apiRequest("POST", `${BASE}/broker/ip-allowlist`, { ip }),
    onSuccess: () => {
      toast({ title: "IP Added", description: "IP allowlist updated." });
      refetchIps();
    },
  });

  const removeIpMutation = useMutation({
    mutationFn: (ip: string) => apiRequest("DELETE", `${BASE}/broker/ip-allowlist`, { ip }),
    onSuccess: () => {
      toast({ title: "IP Removed", description: "IP allowlist updated." });
      refetchIps();
    },
  });

  const credentialsMutation = useMutation({
    mutationFn: () => apiRequest("POST", `${BASE}/alpaca/credentials`, { 
      apiKey: apiKey.trim(), 
      secretKey: secretKey.trim(), 
      baseUrl 
    }),
    onSuccess: () => {
      toast({ title: "Credentials saved", description: "Alpaca auth verified. Click Activate US Trading on the dashboard." });
      setSecretKey("");
      refetchConfig();
      queryClient.invalidateQueries({ queryKey: ["/api/us-trading/alpaca/config"] });
    },
    onError: (err: Error) => {
      toast({ title: "Invalid credentials", description: err?.message || "Auth test failed — check Key ID and Secret.", variant: "destructive" });
    },
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
      description: "Use the form below to enter your Broker API Key and Secret. Click 'Test & Save' to verify auth before activating.",
      status: authOk ? "done" : "pending",
      action: null,
    },
    {
      step: 3,
      title: "Switch to Broker API Base URL",
      description: "Sandbox: broker-api.sandbox.alpaca.markets — Production: broker-api.alpaca.markets. Select the environment in the form below.",
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

      {/* ─── Credentials Form ──────────────────────────────────────────── */}
      <Card className="border-primary/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-primary" />
            Set Alpaca Broker Credentials
          </CardTitle>
          <CardDescription>
            Enter the Key ID and Secret from{" "}
            <a href="https://broker-app.sandbox.alpaca.markets" target="_blank" rel="noopener noreferrer"
              className="text-primary underline">
              broker-app.sandbox.alpaca.markets → API/Devs → Generate API Key
            </a>.
            The secret is only shown once at key creation time.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">API Key ID</Label>
              <Input
                placeholder="CK7XXXXXXXXXXXXXXXXXXXXXX"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Secret Key</Label>
              <div className="relative">
                <Input
                  type={showSecret ? "text" : "password"}
                  placeholder="Your secret key (shown once at creation)"
                  value={secretKey}
                  onChange={e => setSecretKey(e.target.value)}
                  className="font-mono text-sm pr-9"
                />
                <button
                  type="button"
                  onClick={() => setShowSecret(s => !s)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showSecret ? <XCircle className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Environment</Label>
            <div className="flex gap-2">
              {[
                { label: "Sandbox (Paper Trading)", value: "https://broker-api.sandbox.alpaca.markets" },
                { label: "Production (Live)", value: "https://broker-api.alpaca.markets" },
              ].map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setBaseUrl(opt.value)}
                  className={`flex-1 text-xs px-3 py-2 rounded-md border transition-colors ${
                    baseUrl === opt.value
                      ? "border-primary bg-primary/10 text-primary font-medium"
                      : "border-border text-muted-foreground hover:border-primary/50"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 py-2">
            <Info className="h-3.5 w-3.5 text-amber-600" />
            <AlertDescription className="text-xs text-amber-700 dark:text-amber-300">
              This saves credentials for the current session. For persistence across restarts, also add
              <code className="mx-1">ALPACA_API_KEY</code> and <code className="mr-1">ALPACA_SECRET_KEY</code>
              to Replit Secrets.
            </AlertDescription>
          </Alert>
          <div className="flex gap-2 items-center">
            <Button
              onClick={() => credentialsMutation.mutate()}
              disabled={credentialsMutation.isPending || !apiKey || !secretKey}
              className="gap-2"
            >
              {credentialsMutation.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {credentialsMutation.isPending ? "Testing…" : "Test & Save"}
            </Button>
            {authOk && (
              <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                <CheckCircle2 className="h-3.5 w-3.5" /> Auth OK — go back to the dashboard and click Activate US Trading
              </span>
            )}
            {configured && !authOk && configData?.authError && (
              <span className="flex items-center gap-1 text-xs text-red-600">
                <XCircle className="h-3.5 w-3.5" /> Auth failing — enter the correct secret above
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Payment Gateway Health */}
      <GatewayHealthCard />

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

      {/* Security: IP Allowlist */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            IP Allowlist (Security Hardening)
          </CardTitle>
          <CardDescription>
            Restrict Broker API access to specific production server IPs.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input id="new-ip" placeholder="e.g. 34.120.10.5" className="max-w-[200px] h-8 text-xs" />
            <Button 
              size="sm" 
              className="h-8 text-xs"
              onClick={() => {
                const val = (document.getElementById("new-ip") as HTMLInputElement).value;
                if (val) addIpMutation.mutate(val);
              }}
              disabled={addIpMutation.isPending}
            >
              Add IP
            </Button>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs h-8">Allowed IP Address</TableHead>
                  <TableHead className="text-xs h-8 text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(!ipData?.ips || ipData.ips.length === 0) ? (
                  <TableRow>
                    <TableCell colSpan={2} className="text-center text-xs py-4 text-muted-foreground">
                      No IPs restricted. API is open to all (Default for Sandbox).
                    </TableCell>
                  </TableRow>
                ) : (
                  ipData.ips.map(ip => (
                    <TableRow key={ip}>
                      <TableCell className="text-xs font-mono">{ip}</TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-7 text-xs text-red-500"
                          onClick={() => removeIpMutation.mutate(ip)}
                          disabled={removeIpMutation.isPending}
                        >
                          Remove
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Staff & Team Visibility */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            Broker Staff & Administrative Access
          </CardTitle>
          <CardDescription>
            Internal users with access to the Broker Dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs h-8">Staff Member</TableHead>
                  <TableHead className="text-xs h-8">Roles</TableHead>
                  <TableHead className="text-xs h-8">Last Activity</TableHead>
                  <TableHead className="text-xs h-8 text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teamData?.team?.map((member: TeamMember) => (
                  <TableRow key={member.id}>
                    <TableCell>
                      <div className="text-xs font-medium">{member.firstName} {member.lastName}</div>
                      <div className="text-[10px] text-muted-foreground">{member.email}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {member.roles?.map(r => (
                          <Badge key={r} variant="secondary" className="text-[10px] px-1 py-0 h-4">{r}</Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-[10px] text-muted-foreground">
                      {fmtDate(member.lastLoginAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      {member.isActive ? (
                        <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 text-[10px] h-4">Active</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] h-4 text-muted-foreground">Inactive</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>

  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

const VALID_TABS = ["accounts", "activities", "journals", "reports", "corporate-actions", "app-registration", "revenue"] as const;
type TabValue = (typeof VALID_TABS)[number];

function tabFromSearch(search: string) {
  const tab = new URLSearchParams(search).get("tab");
  return (VALID_TABS as readonly string[]).includes(tab ?? "") ? (tab as TabValue) : "accounts";
}

export default function BrokerDashboard() {
  const { toast } = useToast();
  const search = useSearch();
  const [activeTab, setActiveTab] = useState<TabValue>(() => tabFromSearch(search));

  useEffect(() => {
    setActiveTab(tabFromSearch(search));
  }, [search]);

  const { data: configData, isLoading: configLoading, refetch: refetchConfig } = useQuery<{
    configured: boolean; authOk: boolean; authError?: string;
    isBrokerApi: boolean; baseUrl: string;
  }>({
    queryKey: ["/api/us-trading/alpaca/config"],
    queryFn: () => fetch(`${BASE}/alpaca/config`).then(r => r.json()),
  });

  const { data: flagsData, refetch: refetchFlags } = useQuery<{
    US_TRADING_ENABLED: boolean; US_TRADING_ALPACA: boolean;
    US_MARKET_DATA_POLYGON: boolean; US_FRACTIONAL_TRADING: boolean;
  }>({
    queryKey: ["/api/us-trading/feature-flags"],
    queryFn: () => fetch(`${BASE}/feature-flags`).then(r => r.json()).then(r => r.flags ?? r),
  });

  const activateMutation = useMutation({
    mutationFn: () => apiRequest(`${BASE}/activate-us-trading`, { method: "POST" }),
    onSuccess: (data) => {
      toast({ title: "US Trading Activated", description: "All trading flags enabled successfully." });
      refetchConfig();
      refetchFlags();
    },
    onError: (err: Error) => {
      toast({
        title: "Activation Failed",
        description: err?.message || "Check ALPACA_SECRET_KEY in Replit Secrets.",
        variant: "destructive",
      });
    },
  });

  const configured = configData?.configured ?? false;
  const authOk = configData?.authOk ?? false;
  const isBrokerApi = configData?.isBrokerApi ?? false;
  const tradingActive = flagsData?.US_TRADING_ENABLED && flagsData?.US_TRADING_ALPACA;

  const { data: accountsData } = useQuery<{ configured: boolean; accounts: BrokerAccount[] }>({
    queryKey: ["/api/us-trading/broker/accounts"],
    queryFn: () => fetch(`${BASE}/broker/accounts`).then(r => r.json()),
    enabled: authOk && isBrokerApi,
  });

  const { data: firmData } = useQuery<{ success: boolean; account: FirmAccount }>({
    queryKey: ["/api/us-trading/broker/firm-account"],
    queryFn: () => fetch(`${BASE}/broker/firm-account`).then(r => r.json()),
    enabled: authOk && isBrokerApi,
  });

  const { data: lrsSummary } = useQuery<{ success: boolean; summary: { totalUsed: number; count: number } }>({
    queryKey: ["/api/us-trading/broker/lrs-summary"],
    queryFn: () => fetch(`${BASE}/broker/lrs-summary`).then(r => r.json()),
    enabled: authOk,
  });

  const accounts = accountsData?.accounts || [];
  const activeCount = accounts.filter((a: BrokerAccount) => a.status === "ACTIVE").length;
  const pendingCount = accounts.filter((a: BrokerAccount) => ["SUBMITTED", "PENDING", "ACTION_REQUIRED"].includes(a.status)).length;

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
        <Badge variant={authOk ? "default" : "destructive"} className="gap-1">
          {authOk ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
          {configLoading ? "Checking…" : authOk ? "Auth OK" : configured ? "Auth Failed" : "Not Configured"}
        </Badge>
        <Badge variant={isBrokerApi ? "default" : "outline"} className="gap-1">
          <Landmark className="h-3 w-3" />
          {isBrokerApi ? "Broker API" : "Trading API"}
        </Badge>
        <Badge variant={tradingActive ? "default" : "secondary"} className="gap-1">
          <Power className="h-3 w-3" />
          {tradingActive ? "Trading Active" : "Trading Inactive"}
        </Badge>
        {configData?.baseUrl && (
          <span className="text-xs text-muted-foreground font-mono">{configData.baseUrl}</span>
        )}
      </div>

      {/* Auth Error Banner */}
      {configured && !authOk && configData?.authError && (
        <Alert className="border-red-200 bg-red-50 dark:bg-red-950/20">
          <AlertTriangle className="h-4 w-4 text-red-500" />
          <AlertDescription className="text-sm text-red-700 dark:text-red-300">
            <strong>Alpaca auth failed (401):</strong> The <code>ALPACA_SECRET_KEY</code> in Replit Secrets
            does not match the active key. To fix:
            <ol className="list-decimal ml-4 mt-1 space-y-0.5 text-xs">
              <li>Go to <strong>broker-app.alpaca.markets → API/Devs → Generate API Key</strong></li>
              <li>Copy the new Secret Key (shown only once)</li>
              <li>In Replit → Secrets → update <code>ALPACA_SECRET_KEY</code></li>
              <li>Restart the server, then click <strong>Activate US Trading</strong> below</li>
            </ol>
          </AlertDescription>
        </Alert>
      )}

      {/* Activate US Trading Panel */}
      {!tradingActive && (
        <Card className="border-blue-200 dark:border-blue-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Rocket className="h-4 w-4 text-blue-500" />
              Activate US Paper Trading
            </CardTitle>
            <CardDescription>
              Enable client paper trading accounts via Alpaca Sandbox. Requires valid API credentials.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3 items-center">
              <Button
                onClick={() => activateMutation.mutate()}
                disabled={activateMutation.isPending || !configured}
                className="gap-2"
              >
                {activateMutation.isPending ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Rocket className="h-4 w-4" />
                )}
                {activateMutation.isPending ? "Activating…" : "Activate US Trading"}
              </Button>
              <div className="flex gap-2 flex-wrap text-xs text-muted-foreground">
                {[
                  { label: "Trading Enabled", ok: flagsData?.US_TRADING_ENABLED },
                  { label: "Alpaca Connected", ok: flagsData?.US_TRADING_ALPACA },
                  { label: "Fractional Shares", ok: flagsData?.US_FRACTIONAL_TRADING },
                ].map(f => (
                  <span key={f.label} className={`flex items-center gap-1 ${f.ok ? "text-green-600" : "text-muted-foreground"}`}>
                    {f.ok ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                    {f.label}
                  </span>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* All Active Banner */}
      {tradingActive && (
        <Alert className="border-green-200 bg-green-50 dark:bg-green-950/20 py-2">
          <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
          <AlertDescription className="text-xs text-green-700 dark:text-green-300">
            US Trading is <strong>active</strong>. Clients can open paper trading accounts via the US Trading section.
          </AlertDescription>
        </Alert>
      )}

      {/* KPI Cards */}
      {authOk && isBrokerApi && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { title: "Total Accounts", value: accounts.length, icon: Users, color: "text-blue-500" },
            { title: "Firm Balance", value: usd(firmData?.account?.equity || 0), icon: Landmark, color: "text-amber-500" },
            { title: "Active", value: activeCount, icon: CheckCircle2, color: "text-green-500" },
            { title: "Pending", value: pendingCount, icon: Clock, color: "text-yellow-500" },
            { title: "LRS Remitted", value: usd(lrsSummary?.summary?.totalUsed || 0), icon: Globe, color: "text-indigo-500" },
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
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)}>
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
