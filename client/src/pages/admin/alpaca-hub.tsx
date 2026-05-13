/**
 * Alpaca Broker Hub — Admin View
 * Mirrors the layout / data surfaces of broker-app.alpaca.markets/dashboard:
 *   - KPI summary row (total accounts, AUM, pending reviews, new sign-ups)
 *   - Accounts tab  : searchable list with status filter, CIP drill-down
 *   - Orders tab    : cross-account order book with side/status badges
 *   - Positions tab : aggregate open positions across all sub-accounts
 *   - Activities tab: chronological transaction feed (fills, deposits, dividends…)
 *   - Funding tab   : deposit / withdrawal list + journal entry creator
 *   - Compliance tab: CIP / KYC status, LRS watchlist, AML flags
 *   - Reports tab   : generate & download Alpaca broker reports
 */

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
import { Progress } from "@/components/ui/progress";
import {
  Users, ArrowRightLeft, FileText, TrendingUp, LucideShield as LucideShield,
  RefreshCw, AlertTriangle, CheckCircle2, Clock, XCircle,
  Search, Plus, Download, BarChart3, Activity, DollarSign,
  Landmark, Wallet, BookOpen, Globe, ExternalLink, Info,
  TrendingDown, ArrowUp, ArrowDown, Zap, BadgeIndianRupee,
  AlertCircle, LineChart, PieChart, ChevronRight, Building2,
  Flag, Eye, Lock, KeyRound,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";

const BASE = "/api/us-trading";

// ─── Utility helpers ──────────────────────────────────────────────────────────

function usd(val?: string | number | null) {
  const n = parseFloat(String(val ?? "0"));
  return isNaN(n) ? "—" : `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function inr(paise: number | string) {
  const n = typeof paise === "string" ? parseInt(paise, 10) : paise;
  return isNaN(n) ? "—" : new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n / 100);
}

function fmtDate(s?: string | null) {
  if (!s) return "—";
  try { return format(parseISO(s), "MMM d, yyyy"); } catch { return s; }
}

function fmtDateTime(s?: string | null) {
  if (!s) return "—";
  try { return format(parseISO(s), "MMM d, HH:mm"); } catch { return s; }
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    ACTIVE:            "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
    APPROVED:          "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
    SUBMITTED:         "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    APPROVAL_PENDING:  "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    PENDING:           "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
    ACTION_REQUIRED:   "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
    ACCOUNT_UPDATED:   "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
    REJECTED:          "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
    DISABLED:          "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
    ACCOUNT_CLOSED:    "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
    COMPLETE:          "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
    COMPLETED:         "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
    CANCELED:          "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
    CANCELLED:         "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
    QUEUED:            "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300",
    SENT_TO_CLEARING:  "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300",
    PARTIALLY_FILLED:  "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300",
    FILLED:            "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
    NEW:               "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    HELD:              "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
    EXPIRED:           "bg-gray-100 text-gray-500 dark:bg-gray-900/30 dark:text-gray-400",
    PASS:              "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${map[status?.toUpperCase()] || "bg-muted text-muted-foreground"}`}>
      {status?.replace(/_/g, " ")}
    </span>
  );
}

// ─── KPI Summary Row ─────────────────────────────────────────────────────────

function KpiRow() {
  const { data: accounts } = useQuery<{ accounts: any[] }>({
    queryKey: ["/api/us-trading/broker/accounts"],
    queryFn: () => fetch(`${BASE}/broker/accounts`).then(r => r.json()),
  });

  const { data: revenue } = useQuery<any>({
    queryKey: ["/api/subscriptions/admin/revenue"],
    staleTime: 60_000,
  });

  const accs = accounts?.accounts || [];
  const active   = accs.filter((a: any) => a.status === "ACTIVE").length;
  const pending  = accs.filter((a: any) => ["SUBMITTED", "PENDING", "APPROVAL_PENDING", "ACTION_REQUIRED"].includes(a.status)).length;
  const newToday = accs.filter((a: any) => {
    try { return new Date(a.created_at) > new Date(Date.now() - 86_400_000); } catch { return false; }
  }).length;

  const mrr = revenue?.stats?.[0]?.mrr_paise || 0;

  const kpis = [
    {
      icon: Users, label: "Total Accounts", value: accs.length,
      sub: `${active} active · ${pending} pending`,
      color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-950/30",
    },
    {
      icon: CheckCircle2, label: "Active Accounts", value: active,
      sub: "KYC approved & live",
      color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950/30",
    },
    {
      icon: Clock, label: "Pending Review", value: pending,
      sub: "Awaiting Alpaca approval",
      color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-950/30",
    },
    {
      icon: BadgeIndianRupee, label: "Monthly Revenue", value: inr(mrr),
      sub: "Subscription MRR",
      color: "text-purple-600", bg: "bg-purple-50 dark:bg-purple-950/30",
    },
    {
      icon: Zap, label: "New Today", value: newToday,
      sub: "Accounts opened in 24h",
      color: "text-sky-600", bg: "bg-sky-50 dark:bg-sky-950/30",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      {kpis.map(({ icon: Icon, label, value, sub, color, bg }) => (
        <Card key={label} className="relative overflow-hidden">
          <div className={`absolute inset-0 opacity-30 ${bg}`} />
          <CardContent className="relative pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <div className={`p-1 rounded ${bg}`}><Icon className={`h-3.5 w-3.5 ${color}`} /></div>
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</span>
            </div>
            <div className="text-2xl font-bold">{value}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ─── Accounts Tab ────────────────────────────────────────────────────────────

function AccountsTab() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [selectedAcc, setSelectedAcc] = useState<any>(null);
  const [cipOpen, setCipOpen] = useState(false);

  const { data, isLoading, refetch } = useQuery<{ configured: boolean; accounts: any[] }>({
    queryKey: ["/api/us-trading/broker/accounts", status, search],
    queryFn: () =>
      fetch(`${BASE}/broker/accounts?${new URLSearchParams({
        ...(search ? { query: search } : {}),
        ...(status !== "all" ? { status } : {}),
      })}`).then(r => r.json()),
  });

  const { data: cipData, isLoading: cipLoading } = useQuery<{ cip: any }>({
    queryKey: ["/api/us-trading/broker/accounts/cip", selectedAcc?.id],
    enabled: !!selectedAcc?.id && cipOpen,
    queryFn: () => fetch(`${BASE}/broker/accounts/${selectedAcc.id}/cip`).then(r => r.json()),
  });

  const closeMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `${BASE}/broker/accounts/${id}`),
    onSuccess: () => { toast({ title: "Account closure initiated" }); refetch(); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const accounts = data?.accounts || [];

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, email, phone, account number…"
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[190px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="SUBMITTED">Submitted</SelectItem>
            <SelectItem value="APPROVAL_PENDING">Approval Pending</SelectItem>
            <SelectItem value="ACTION_REQUIRED">Action Required</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="REJECTED">Rejected</SelectItem>
            <SelectItem value="ACCOUNT_CLOSED">Closed</SelectItem>
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
                  <TableHead>Account #</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>KYC</TableHead>
                  <TableHead>Opened</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  [...Array(5)].map((_, i) => (
                    <TableRow key={i}>
                      {[...Array(8)].map((_, j) => (
                        <TableCell key={j}><div className="h-4 bg-muted animate-pulse rounded w-24" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : accounts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                      <Users className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      No accounts found
                    </TableCell>
                  </TableRow>
                ) : (
                  accounts.map((acc: any) => (
                    <TableRow key={acc.id} className="hover:bg-muted/30">
                      <TableCell className="font-mono text-xs font-medium">
                        {acc.account_number || acc.id?.slice(0, 8)}
                      </TableCell>
                      <TableCell className="font-medium">
                        {acc.identity?.given_name} {acc.identity?.family_name}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{acc.contact?.email_address || "—"}</TableCell>
                      <TableCell className="text-sm">{acc.contact?.country || "IND"}</TableCell>
                      <TableCell><StatusBadge status={acc.status} /></TableCell>
                      <TableCell>
                        {acc.kyc_results?.approved ? (
                          <span className="flex items-center gap-1 text-emerald-600 text-xs"><CheckCircle2 className="h-3.5 w-3.5" /> Approved</span>
                        ) : acc.kyc_results ? (
                          <span className="flex items-center gap-1 text-amber-600 text-xs"><AlertTriangle className="h-3.5 w-3.5" /> Review</span>
                        ) : (
                          <span className="flex items-center gap-1 text-muted-foreground text-xs"><Clock className="h-3.5 w-3.5" /> Pending</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{fmtDate(acc.created_at)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* CIP Dialog */}
                          <Dialog open={cipOpen && selectedAcc?.id === acc.id}
                            onOpenChange={open => { setCipOpen(open); if (open) setSelectedAcc(acc); }}>
                            <DialogTrigger asChild>
                              <Button size="sm" variant="outline" className="h-7 text-xs px-2"
                                onClick={() => setSelectedAcc(acc)}>
                                <LucideShield className="h-3 w-3 mr-1" /> CIP
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl">
                              <DialogHeader>
                                <DialogTitle>CIP / KYC — {acc.account_number || acc.id?.slice(0, 8)}</DialogTitle>
                              </DialogHeader>
                              {cipLoading ? (
                                <div className="flex items-center justify-center py-10">
                                  <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
                                </div>
                              ) : cipData?.cip ? (
                                <div className="space-y-4">
                                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    {[
                                      { label: "KYC Result", value: cipData.cip.kyc?.result },
                                      { label: "KYC Status", value: cipData.cip.kyc?.status },
                                      { label: "Risk Level", value: cipData.cip.kyc?.risk_level },
                                      { label: "Document", value: cipData.cip.document?.result },
                                      { label: "Photo", value: cipData.cip.photo?.result },
                                      { label: "Identity", value: cipData.cip.identity?.result },
                                      { label: "Watchlist", value: cipData.cip.watchlist?.result },
                                      { label: "Provider", value: cipData.cip.provider_name?.join(", ") },
                                    ].map(({ label, value }) => (
                                      <div key={label} className="space-y-1 p-2 rounded bg-muted/30">
                                        <p className="text-xs text-muted-foreground">{label}</p>
                                        <StatusBadge status={value || "N/A"} />
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ) : (
                                <p className="text-sm text-muted-foreground py-6 text-center">No CIP data available.</p>
                              )}
                            </DialogContent>
                          </Dialog>

                          <Button size="sm" variant="ghost" className="h-7 text-xs px-2 text-red-500 hover:text-red-700"
                            onClick={() => { if (confirm(`Close account ${acc.account_number}?`)) closeMutation.mutate(acc.id); }}>
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
      <p className="text-xs text-muted-foreground">{accounts.length} account{accounts.length !== 1 ? "s" : ""}</p>
    </div>
  );
}

// ─── Orders Tab ───────────────────────────────────────────────────────────────

function OrdersTab() {
  const [acctId, setAcctId] = useState("");
  const [orderStatus, setOrderStatus] = useState("all");

  const { data, isLoading, refetch } = useQuery<{ success: boolean; orders: any[] }>({
    queryKey: ["/api/us-trading/broker/orders", acctId, orderStatus],
    queryFn: () =>
      fetch(`${BASE}/broker/orders?${new URLSearchParams({
        ...(acctId ? { account_id: acctId } : {}),
        ...(orderStatus !== "all" ? { status: orderStatus } : {}),
      })}`).then(r => r.json()),
  });

  const orders = data?.orders || [];

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Filter by Account ID (UUID)…" value={acctId}
            onChange={e => setAcctId(e.target.value)} />
        </div>
        <Select value={orderStatus} onValueChange={setOrderStatus}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Orders</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
            <SelectItem value="filled">Filled</SelectItem>
            <SelectItem value="canceled">Canceled</SelectItem>
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
                  <TableHead>Symbol</TableHead>
                  <TableHead>Side</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Filled Qty</TableHead>
                  <TableHead>Avg Price</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  [...Array(5)].map((_, i) => (
                    <TableRow key={i}>
                      {[...Array(9)].map((_, j) => (
                        <TableCell key={j}><div className="h-4 bg-muted animate-pulse rounded w-20" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : orders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                      <TrendingUp className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      No orders found
                    </TableCell>
                  </TableRow>
                ) : (
                  orders.map((o: any) => (
                    <TableRow key={o.id} className="hover:bg-muted/30">
                      <TableCell className="font-bold">{o.symbol}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center gap-1 text-xs font-semibold ${o.side === "buy" ? "text-emerald-600" : "text-red-500"}`}>
                          {o.side === "buy" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                          {o.side?.toUpperCase()}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs capitalize">{o.order_type || o.type}</TableCell>
                      <TableCell>{o.qty || o.notional || "—"}</TableCell>
                      <TableCell>{o.filled_qty || "0"}</TableCell>
                      <TableCell>{o.filled_avg_price ? usd(o.filled_avg_price) : "—"}</TableCell>
                      <TableCell><StatusBadge status={o.status} /></TableCell>
                      <TableCell className="font-mono text-xs">{o.account_id?.slice(0, 8) || "—"}…</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{fmtDateTime(o.created_at || o.submitted_at)}</TableCell>
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

// ─── Positions Tab ────────────────────────────────────────────────────────────

function PositionsTab() {
  const { data, isLoading, refetch } = useQuery<any>({
    queryKey: ["/api/us-trading/positions"],
    queryFn: () => fetch(`${BASE}/positions`).then(r => r.json()),
    refetchInterval: 30_000,
  });

  const positions: any[] = data?.positions || [];
  const totalValueUSD = data?.totalValueUSD || 0;
  const totalGainLoss = data?.totalGainLossUSD || 0;

  return (
    <div className="space-y-4">
      {/* Portfolio Summary */}
      {data?.configured && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Portfolio Value", value: usd(totalValueUSD), color: "text-blue-600" },
            { label: "Total P&L", value: usd(totalGainLoss), color: totalGainLoss >= 0 ? "text-emerald-600" : "text-red-500" },
            { label: "INR Equivalent", value: `₹${(data.totalValueINR || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`, color: "text-purple-600" },
            { label: "# Positions", value: positions.length, color: "text-sky-600" },
          ].map(({ label, value, color }) => (
            <Card key={label}>
              <CardContent className="pt-4 pb-3 px-4">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className={`text-xl font-bold ${color}`}>{value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className={`h-4 w-4 mr-1.5 ${isLoading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Symbol</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Avg Cost</TableHead>
                  <TableHead>Current Price</TableHead>
                  <TableHead>Market Value</TableHead>
                  <TableHead>Unrealised P&L</TableHead>
                  <TableHead>P&L %</TableHead>
                  <TableHead>Side</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  [...Array(4)].map((_, i) => (
                    <TableRow key={i}>
                      {[...Array(8)].map((_, j) => (
                        <TableCell key={j}><div className="h-4 bg-muted animate-pulse rounded w-20" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : !data?.configured ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                      <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      Alpaca API not configured
                    </TableCell>
                  </TableRow>
                ) : positions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                      <LineChart className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      No open positions
                    </TableCell>
                  </TableRow>
                ) : (
                  positions.map((p: any) => (
                    <TableRow key={p.symbol} className="hover:bg-muted/30">
                      <TableCell className="font-bold">{p.symbol}</TableCell>
                      <TableCell>{p.quantity}</TableCell>
                      <TableCell>{usd(p.avgPrice)}</TableCell>
                      <TableCell>{usd(p.currentPrice)}</TableCell>
                      <TableCell className="font-medium">{usd(p.marketValue)}</TableCell>
                      <TableCell className={p.gainLoss >= 0 ? "text-emerald-600 font-medium" : "text-red-500 font-medium"}>
                        {p.gainLoss >= 0 ? "+" : ""}{usd(p.gainLoss)}
                      </TableCell>
                      <TableCell className={p.gainLossPercent >= 0 ? "text-emerald-600" : "text-red-500"}>
                        {p.gainLossPercent >= 0 ? "+" : ""}{p.gainLossPercent?.toFixed(2)}%
                      </TableCell>
                      <TableCell>
                        <span className={`text-xs font-medium ${p.side === "long" ? "text-emerald-600" : "text-red-500"}`}>
                          {p.side?.toUpperCase()}
                        </span>
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

// ─── Activities Tab ────────────────────────────────────────────────────────────

const ACTIVITY_TYPES = [
  { value: "", label: "All Types" },
  { value: "FILL", label: "Trade Fills (FILL)" },
  { value: "JNLC", label: "Journal Cash (JNLC)" },
  { value: "JNLS", label: "Journal Securities (JNLS)" },
  { value: "DIV", label: "Dividends (DIV)" },
  { value: "CSD", label: "Deposit (CSD)" },
  { value: "CSW", label: "Withdrawal (CSW)" },
  { value: "ACATC", label: "ACAT Cash" },
  { value: "ACATS", label: "ACAT Securities" },
  { value: "PTC", label: "Pass-Through Charge" },
];

function ActivitiesTab() {
  const [actType, setActType] = useState("");

  const { data, isLoading, refetch } = useQuery<{ activities: any[] }>({
    queryKey: ["/api/us-trading/broker/activities", actType],
    queryFn: () =>
      fetch(`${BASE}/broker/activities${actType ? `?activity_type=${actType}` : ""}`).then(r => r.json()),
  });

  const activities = data?.activities || [];

  const typeIcon: Record<string, any> = {
    FILL: TrendingUp, JNLC: Landmark, JNLS: Landmark,
    DIV: BarChart3, CSD: ArrowUp, CSW: ArrowDown,
    ACATC: ArrowRightLeft, ACATS: ArrowRightLeft, PTC: Activity,
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Select value={actType} onValueChange={setActType}>
          <SelectTrigger className="w-[230px]"><SelectValue placeholder="All activity types" /></SelectTrigger>
          <SelectContent>
            {ACTIVITY_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={() => refetch()}>
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
        </Button>
        <span className="text-xs text-muted-foreground ml-auto">{activities.length} records</span>
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
                  [...Array(6)].map((_, i) => (
                    <TableRow key={i}>
                      {[...Array(7)].map((_, j) => (
                        <TableCell key={j}><div className="h-4 bg-muted animate-pulse rounded w-20" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : activities.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                      <Activity className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      No activities found
                    </TableCell>
                  </TableRow>
                ) : (
                  activities.map((a: any) => {
                    const Icon = typeIcon[a.activity_type] || Activity;
                    const net = parseFloat(a.net_amount || "0");
                    return (
                      <TableRow key={a.id} className="hover:bg-muted/30">
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
                        <TableCell className={net >= 0 ? "text-emerald-600 font-medium" : "text-red-500 font-medium"}>
                          {a.net_amount ? `${net >= 0 ? "+" : ""}${usd(net)}` : "—"}
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

// ─── Funding Tab ──────────────────────────────────────────────────────────────

function FundingTab() {
  const { toast } = useToast();
  const [entryType, setEntryType] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({ from_account: "", to_account: "", entry_type: "JNLC", amount: "", symbol: "", qty: "", description: "" });

  const { data, isLoading, refetch } = useQuery<{ journals: any[] }>({
    queryKey: ["/api/us-trading/broker/journals", entryType],
    queryFn: () =>
      fetch(`${BASE}/broker/journals${entryType !== "all" ? `?entry_type=${entryType}` : ""}`).then(r => r.json()),
  });

  const createMutation = useMutation({
    mutationFn: () => apiRequest("POST", `${BASE}/broker/journals`, {
      from_account: form.from_account, to_account: form.to_account,
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
      <div className="flex items-center gap-3">
        <Select value={entryType} onValueChange={setEntryType}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="JNLC">JNLC Cash</SelectItem>
            <SelectItem value="JNLS">JNLS Securities</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={() => refetch()}>
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
        </Button>
        <Dialog open={formOpen} onOpenChange={setFormOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="ml-auto"><Plus className="h-4 w-4 mr-1" /> New Journal</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Journal Entry</DialogTitle></DialogHeader>
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
                  <Input placeholder={form.entry_type === "JNLC" ? "100.00" : "10"}
                    value={form.entry_type === "JNLC" ? form.amount : form.qty}
                    onChange={e => setForm(f => form.entry_type === "JNLC" ? { ...f, amount: e.target.value } : { ...f, qty: e.target.value })} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>From Account ID</Label>
                <Input placeholder="Source account UUID" value={form.from_account} onChange={e => setForm(f => ({ ...f, from_account: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>To Account ID</Label>
                <Input placeholder="Destination account UUID" value={form.to_account} onChange={e => setForm(f => ({ ...f, to_account: e.target.value }))} />
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
              <Button onClick={() => createMutation.mutate()}
                disabled={createMutation.isPending || !form.from_account || !form.to_account}>
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
                  <TableHead>From →</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead>Amount / Symbol</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Settle Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  [...Array(3)].map((_, i) => (
                    <TableRow key={i}>{[...Array(8)].map((_, j) => <TableCell key={j}><div className="h-4 bg-muted animate-pulse rounded w-20" /></TableCell>)}</TableRow>
                  ))
                ) : journals.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                      <Wallet className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      No journal entries
                    </TableCell>
                  </TableRow>
                ) : (
                  journals.map((j: any) => (
                    <TableRow key={j.id} className="hover:bg-muted/30">
                      <TableCell className="font-mono text-xs">{j.id?.slice(0, 8)}…</TableCell>
                      <TableCell><Badge variant="outline">{j.entry_type}</Badge></TableCell>
                      <TableCell className="font-mono text-xs">{j.from_account?.slice(0, 8)}…</TableCell>
                      <TableCell className="font-mono text-xs">{j.to_account?.slice(0, 8)}…</TableCell>
                      <TableCell>{j.net_amount ? usd(j.net_amount) : j.symbol ? `${j.qty} × ${j.symbol}` : "—"}</TableCell>
                      <TableCell><StatusBadge status={j.status} /></TableCell>
                      <TableCell className="text-sm text-muted-foreground">{fmtDate(j.settle_date)}</TableCell>
                      <TableCell className="text-right">
                        {j.status === "PENDING" && (
                          <Button size="sm" variant="ghost" className="h-7 text-xs text-red-500"
                            onClick={() => cancelMutation.mutate(j.id)}>Cancel</Button>
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

// ─── Compliance Tab ───────────────────────────────────────────────────────────

function ComplianceTab() {
  const { data: accounts } = useQuery<{ accounts: any[] }>({
    queryKey: ["/api/us-trading/broker/accounts"],
    queryFn: () => fetch(`${BASE}/broker/accounts`).then(r => r.json()),
  });

  const accs = accounts?.accounts || [];
  const actionRequired = accs.filter((a: any) => a.status === "ACTION_REQUIRED");
  const rejected = accs.filter((a: any) => a.status === "REJECTED");
  const noKyc = accs.filter((a: any) => !a.kyc_results);

  const complianceScore = accs.length > 0
    ? Math.round((accs.filter((a: any) => a.status === "ACTIVE" && a.kyc_results?.approved).length / accs.length) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Score Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="md:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <LucideShield className="h-4 w-4 text-primary" /> Compliance Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-primary mb-2">{complianceScore}%</div>
            <Progress value={complianceScore} className="h-2 mb-2" />
            <p className="text-xs text-muted-foreground">
              {accs.filter((a: any) => a.status === "ACTIVE" && a.kyc_results?.approved).length} of {accs.length} accounts fully compliant
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-500" /> Action Required
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-500">{actionRequired.length}</div>
            <p className="text-xs text-muted-foreground">Accounts needing attention</p>
            {actionRequired.slice(0, 3).map((a: any) => (
              <div key={a.id} className="mt-2 text-xs p-1.5 bg-orange-50 dark:bg-orange-950/20 rounded border border-orange-200 dark:border-orange-800">
                {a.identity?.given_name} {a.identity?.family_name} · {a.account_number?.slice(0, 8)}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-500" /> KYC Not Started
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-amber-500">{noKyc.length}</div>
            <p className="text-xs text-muted-foreground">Accounts without CIP data</p>
          </CardContent>
        </Card>
      </div>

      {/* Action Required List */}
      {actionRequired.length > 0 && (
        <Card className="border-orange-200 dark:border-orange-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2 text-orange-700 dark:text-orange-300">
              <Flag className="h-4 w-4" /> Accounts Requiring Action
            </CardTitle>
            <CardDescription>These accounts need additional documentation or verification</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Application Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {actionRequired.map((a: any) => (
                  <TableRow key={a.id} className="bg-orange-50/50 dark:bg-orange-950/10">
                    <TableCell className="font-mono text-xs">{a.account_number || a.id?.slice(0, 8)}</TableCell>
                    <TableCell className="font-medium">{a.identity?.given_name} {a.identity?.family_name}</TableCell>
                    <TableCell className="text-sm">{a.contact?.email_address}</TableCell>
                    <TableCell><StatusBadge status={a.status} /></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{fmtDate(a.created_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* LRS Compliance Info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Globe className="h-4 w-4 text-primary" /> India LRS / FEMA Compliance
          </CardTitle>
          <CardDescription>RBI Liberalised Remittance Scheme compliance overview</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            {[
              { label: "LRS Annual Limit", value: "$250,000 per PAN", color: "text-blue-600" },
              { label: "TCS Threshold (FY)", value: "₹7,00,000", color: "text-amber-600" },
              { label: "TCS Rate Above Threshold", value: "20%", color: "text-red-600" },
              { label: "Purpose Code", value: "S0001 (Portfolio Investment)", color: "text-purple-600" },
              { label: "Form Required", value: "Form A2 (at AD-I bank)", color: "text-emerald-600" },
              { label: "FEMA Declaration", value: "Required per transaction", color: "text-sky-600" },
            ].map(({ label, value, color }) => (
              <div key={label} className="p-3 rounded-lg border bg-muted/20">
                <p className="text-xs text-muted-foreground mb-1">{label}</p>
                <p className={`font-semibold ${color}`}>{value}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Reports Tab ──────────────────────────────────────────────────────────────

function ReportsTab() {
  const { toast } = useToast();
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({ type: "account_statement", start: "", end: "", account_ids: "" });

  const { data, isLoading, refetch } = useQuery<{ reports: any[] }>({
    queryKey: ["/api/us-trading/broker/reports"],
    queryFn: () => fetch(`${BASE}/broker/reports`).then(r => r.json()),
  });

  const createMutation = useMutation({
    mutationFn: () => apiRequest("POST", `${BASE}/broker/reports`, {
      type: form.type, start: form.start, end: form.end,
      ...(form.account_ids ? { account_ids: form.account_ids.split(",").map(s => s.trim()) } : {}),
    }),
    onSuccess: () => {
      toast({ title: "Report requested", description: "It may take a few minutes to generate." });
      setFormOpen(false);
      refetch();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const downloadMutation = useMutation({
    mutationFn: (id: string) => fetch(`${BASE}/broker/reports/${id}/download`).then(r => r.json()),
    onSuccess: (d: any) => {
      if (d?.url) window.open(d.url, "_blank");
      else toast({ title: "Download unavailable", variant: "destructive" });
    },
    onError: (e: any) => toast({ title: "Download failed", description: e.message, variant: "destructive" }),
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
            <DialogHeader><DialogTitle>Generate Report</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="space-y-1.5">
                <Label>Report Type</Label>
                <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="account_statement">Account Statement</SelectItem>
                    <SelectItem value="trade_confirmation">Trade Confirmation</SelectItem>
                    <SelectItem value="tax_1099">Tax 1099-B</SelectItem>
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
                <Input placeholder="Leave empty for all accounts" value={form.account_ids}
                  onChange={e => setForm(f => ({ ...f, account_ids: e.target.value }))} />
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
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                      <FileText className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      No reports generated yet
                    </TableCell>
                  </TableRow>
                ) : (
                  reports.map((r: any) => (
                    <TableRow key={r.id} className="hover:bg-muted/30">
                      <TableCell className="font-medium">{r.name || r.id?.slice(0, 8)}</TableCell>
                      <TableCell><Badge variant="outline">{r.type?.replace(/_/g, " ")}</Badge></TableCell>
                      <TableCell><StatusBadge status={r.status} /></TableCell>
                      <TableCell className="text-sm text-muted-foreground">{fmtDate(r.date || r.created_at)}</TableCell>
                      <TableCell className="text-right">
                        {(r.status === "complete" || r.url) && (
                          r.url ? (
                            <Button size="sm" variant="ghost" asChild>
                              <a href={r.url} target="_blank" rel="noopener noreferrer" aria-label="Download report">
                                <Download className="h-4 w-4" />
                              </a>
                            </Button>
                          ) : (
                            <Button size="sm" variant="ghost" onClick={() => downloadMutation.mutate(r.id)}
                              disabled={downloadMutation.isPending}
                              aria-label="Download report">
                              {downloadMutation.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                            </Button>
                          )
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

// ─── Main Page ─────────────────────────────────────────────────────────────────

const TABS = [
  { value: "accounts",    label: "Accounts",    icon: Users },
  { value: "orders",      label: "Orders",      icon: TrendingUp },
  { value: "positions",   label: "Positions",   icon: LineChart },
  { value: "activities",  label: "Activities",  icon: Activity },
  { value: "funding",     label: "Funding",     icon: Wallet },
  { value: "compliance",  label: "Compliance",  icon: LucideShield },
  { value: "reports",     label: "Reports",     icon: FileText },
] as const;

type TabValue = typeof TABS[number]["value"];

export default function AlpacaHubAdmin() {
  const [activeTab, setActiveTab] = useState<TabValue>("accounts");

  const { data: configData } = useQuery<{ configured: boolean; authOk: boolean; isBrokerApi: boolean; baseUrl: string }>({
    queryKey: ["/api/us-trading/alpaca/config"],
    queryFn: () => fetch(`${BASE}/alpaca/config`).then(r => r.json()),
    staleTime: 60_000,
  });

  const configured = configData?.configured ?? false;
  const authOk = configData?.authOk ?? false;
  const isSandbox = configData?.baseUrl?.includes("sandbox");

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary" />
            Alpaca Broker Hub
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Fully-disclosed broker-dealer dashboard — accounts, trading, funding & compliance
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <Badge variant={authOk ? "default" : "destructive"} className="gap-1">
            {authOk ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
            {authOk ? "Auth OK" : configured ? "Auth Failed" : "Not Configured"}
          </Badge>
          <Badge variant={configData?.isBrokerApi ? "default" : "outline"} className="gap-1">
            <Landmark className="h-3 w-3" />
            {configData?.isBrokerApi ? "Broker API" : "Trading API"}
          </Badge>
          {isSandbox !== undefined && (
            <Badge className={isSandbox
              ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
              : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"}>
              {isSandbox ? "Sandbox" : "Production"}
            </Badge>
          )}
          <Button variant="outline" size="sm" asChild>
            <a href="https://broker-app.alpaca.markets" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> Alpaca Portal
            </a>
          </Button>
        </div>
      </div>

      {/* Auth Error */}
      {configured && !authOk && (
        <Alert className="border-red-200 bg-red-50 dark:bg-red-950/20">
          <AlertTriangle className="h-4 w-4 text-red-500" />
          <AlertDescription className="text-sm text-red-700 dark:text-red-300">
            <strong>Alpaca auth failed (401).</strong> Update <code>ALPACA_SECRET_KEY</code> in environment secrets,
            then go to <a href="/admin/broker-dashboard?tab=app-registration" className="underline">Setup tab</a> to re-verify.
          </AlertDescription>
        </Alert>
      )}

      {/* KPI Row */}
      <KpiRow />

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={v => setActiveTab(v as TabValue)}>
        <TabsList className="flex-wrap h-auto gap-1 bg-muted/50 p-1 rounded-lg">
          {TABS.map(({ value, label, icon: Icon }) => (
            <TabsTrigger key={value} value={value} className="gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Icon className="h-3.5 w-3.5" /> {label}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="mt-4">
          <TabsContent value="accounts"   className="mt-0"><AccountsTab /></TabsContent>
          <TabsContent value="orders"     className="mt-0"><OrdersTab /></TabsContent>
          <TabsContent value="positions"  className="mt-0"><PositionsTab /></TabsContent>
          <TabsContent value="activities" className="mt-0"><ActivitiesTab /></TabsContent>
          <TabsContent value="funding"    className="mt-0"><FundingTab /></TabsContent>
          <TabsContent value="compliance" className="mt-0"><ComplianceTab /></TabsContent>
          <TabsContent value="reports"    className="mt-0"><ReportsTab /></TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
