import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Card, CardContent, CardHeader, CardTitle,
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
  Users, TrendingUp, Wallet, Activity, RefreshCw, AlertTriangle,
  CheckCircle2, XCircle, Plus, Search, ArrowUpRight, ArrowDownRight,
  ChevronLeft, FileText, BarChart3, Clock, Eye,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

const BASE = "/api/us-trading";

function usd(val?: string | number) {
  const n = parseFloat(String(val ?? "0"));
  return isNaN(n) ? "—" : `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(s?: string) {
  if (!s) return "—";
  try { return format(new Date(s), "MMM d, yyyy"); } catch { return s; }
}

function fmtDatetime(s?: string) {
  if (!s) return "—";
  try { return format(new Date(s), "MMM d, yyyy HH:mm"); } catch { return s; }
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    ACTIVE: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    APPROVED: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    SUBMITTED: "bg-blue-100 text-blue-800",
    PENDING: "bg-yellow-100 text-yellow-800",
    ACTION_REQUIRED: "bg-orange-100 text-orange-800",
    REJECTED: "bg-red-100 text-red-800",
    DISABLED: "bg-gray-100 text-gray-600",
    ACCOUNT_CLOSED: "bg-gray-100 text-gray-600",
    filled: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    partially_filled: "bg-blue-100 text-blue-800",
    new: "bg-blue-100 text-blue-800",
    canceled: "bg-red-100 text-red-800",
    accepted: "bg-green-100 text-green-800",
    pending_new: "bg-yellow-100 text-yellow-800",
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${map[status] || "bg-muted text-muted-foreground"}`}>
      {status?.replace(/_/g, " ")}
    </span>
  );
}

// ─── Account Detail Panel ──────────────────────────────────────────────────────

function AccountDetail({ account, onBack }: { account: any; onBack: () => void }) {
  const { toast } = useToast();
  const accountId = account.id;

  const { data: tradingData, isLoading: tradingLoading } = useQuery<{ success: boolean; account: any }>({
    queryKey: ["/api/us-trading/broker/accounts/:id/trading", accountId],
    queryFn: () => fetch(`${BASE}/broker/accounts/${accountId}/trading`).then(r => r.json()),
  });

  const { data: positionsData, isLoading: positionsLoading } = useQuery<{ success: boolean; positions: any[] }>({
    queryKey: ["/api/us-trading/broker/accounts/:id/positions", accountId],
    queryFn: () => fetch(`${BASE}/broker/accounts/${accountId}/positions`).then(r => r.json()),
  });

  const { data: ordersData, isLoading: ordersLoading } = useQuery<{ success: boolean; orders: any[] }>({
    queryKey: ["/api/us-trading/broker/accounts/:id/orders", accountId],
    queryFn: () => fetch(`${BASE}/broker/accounts/${accountId}/orders?status=all&limit=25`).then(r => r.json()),
  });

  const { data: activitiesData, isLoading: activitiesLoading } = useQuery<{ success: boolean; activities: any[] }>({
    queryKey: ["/api/us-trading/broker/accounts/:id/activities", accountId],
    queryFn: () => fetch(`${BASE}/broker/accounts/${accountId}/activities?pageSize=25`).then(r => r.json()),
  });

  const { data: transfersData, isLoading: transfersLoading } = useQuery<{ success: boolean; transfers: any[] }>({
    queryKey: ["/api/us-trading/broker/accounts/:id/transfers", accountId],
    queryFn: () => fetch(`${BASE}/broker/accounts/${accountId}/transfers`).then(r => r.json()),
  });

  const { data: achData } = useQuery<{ success: boolean; relationships: any[] }>({
    queryKey: ["/api/us-trading/broker/accounts/:id/ach", accountId],
    queryFn: () => fetch(`${BASE}/broker/accounts/${accountId}/ach-relationships`).then(r => r.json()),
  });

  const [transferDialog, setTransferDialog] = useState(false);
  const [txForm, setTxForm] = useState({ direction: "INCOMING", amount: "", relationship_id: "" });

  const transferMutation = useMutation({
    mutationFn: () => apiRequest("POST", `${BASE}/broker/accounts/${accountId}/transfers`, {
      transfer_type: "ach",
      relationship_id: txForm.relationship_id,
      amount: txForm.amount,
      direction: txForm.direction as "INCOMING" | "OUTGOING",
      timing: "immediate",
    }),
    onSuccess: () => {
      toast({ title: "Transfer initiated" });
      setTransferDialog(false);
      queryClient.invalidateQueries({ queryKey: ["/api/us-trading/broker/accounts/:id/transfers", accountId] });
    },
    onError: (e: any) => toast({ title: "Transfer failed", description: e.message, variant: "destructive" }),
  });

  const trading = tradingData?.account;
  const positions = positionsData?.positions || [];
  const orders = ordersData?.orders || [];
  const activities = activitiesData?.activities || [];
  const transfers = transfersData?.transfers || [];
  const achRelationships = achData?.relationships || [];

  return (
    <div className="space-y-4">
      <Button variant="ghost" onClick={onBack} className="gap-2 -ml-2">
        <ChevronLeft className="h-4 w-4" /> All Accounts
      </Button>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">
            {account.identity?.given_name} {account.identity?.family_name}
          </h2>
          <p className="text-sm text-muted-foreground">
            {account.account_number || account.id} · {account.contact?.email_address}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {statusBadge(account.status)}
          <Dialog open={transferDialog} onOpenChange={setTransferDialog}>
            <DialogTrigger asChild>
              <Button size="sm" disabled={achRelationships.length === 0}>
                <Plus className="h-4 w-4 mr-1" /> Transfer Funds
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Initiate ACH Transfer</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-2">
                <div className="space-y-1.5">
                  <Label>Direction</Label>
                  <Select value={txForm.direction} onValueChange={v => setTxForm(f => ({ ...f, direction: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="INCOMING">Deposit (INCOMING)</SelectItem>
                      <SelectItem value="OUTGOING">Withdrawal (OUTGOING)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Bank Account</Label>
                  <Select value={txForm.relationship_id} onValueChange={v => setTxForm(f => ({ ...f, relationship_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select linked bank…" /></SelectTrigger>
                    <SelectContent>
                      {achRelationships.map((r: any) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.nickname || r.bank_account_type} ···{r.bank_account_number?.slice(-4)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Amount (USD)</Label>
                  <Input placeholder="100.00" value={txForm.amount} onChange={e => setTxForm(f => ({ ...f, amount: e.target.value }))} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setTransferDialog(false)}>Cancel</Button>
                <Button onClick={() => transferMutation.mutate()} disabled={transferMutation.isPending || !txForm.amount || !txForm.relationship_id}>
                  {transferMutation.isPending ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : null}
                  Confirm Transfer
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Equity", val: trading?.equity || trading?.portfolio_value, loading: tradingLoading },
          { label: "Cash", val: trading?.cash, loading: tradingLoading },
          { label: "Buying Power", val: trading?.buying_power, loading: tradingLoading },
          { label: "Unrealized P&L", val: trading?.unrealized_pl, loading: tradingLoading, signed: true },
        ].map(({ label, val, loading, signed }) => (
          <Card key={label}>
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">{label}</p>
              {loading ? (
                <div className="h-5 bg-muted animate-pulse rounded w-20 mt-1" />
              ) : (
                <p className={`text-lg font-bold ${signed && parseFloat(String(val || "0")) < 0 ? "text-red-500" : signed ? "text-green-600" : ""}`}>
                  {usd(val)}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Detail Tabs */}
      <Tabs defaultValue="positions">
        <TabsList>
          <TabsTrigger value="positions">Positions</TabsTrigger>
          <TabsTrigger value="orders">Orders</TabsTrigger>
          <TabsTrigger value="activities">Activities</TabsTrigger>
          <TabsTrigger value="transfers">Transfers</TabsTrigger>
        </TabsList>

        {/* Positions */}
        <TabsContent value="positions" className="mt-3">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Symbol</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Avg Price</TableHead>
                    <TableHead>Current Price</TableHead>
                    <TableHead>Market Value</TableHead>
                    <TableHead>Unrealized P&L</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {positionsLoading ? (
                    [...Array(3)].map((_, i) => <TableRow key={i}>{[...Array(6)].map((_, j) => <TableCell key={j}><div className="h-4 bg-muted animate-pulse rounded w-16" /></TableCell>)}</TableRow>)
                  ) : positions.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">No open positions</TableCell></TableRow>
                  ) : (
                    positions.map((p: any) => (
                      <TableRow key={p.symbol}>
                        <TableCell className="font-bold">{p.symbol}</TableCell>
                        <TableCell>{p.qty}</TableCell>
                        <TableCell>{usd(p.avg_entry_price)}</TableCell>
                        <TableCell>{usd(p.current_price)}</TableCell>
                        <TableCell>{usd(p.market_value)}</TableCell>
                        <TableCell className={parseFloat(p.unrealized_pl) >= 0 ? "text-green-600" : "text-red-500"}>
                          {usd(p.unrealized_pl)} ({(parseFloat(p.unrealized_plpc) * 100).toFixed(2)}%)
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Orders */}
        <TabsContent value="orders" className="mt-3">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Symbol</TableHead>
                    <TableHead>Side</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Submitted</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ordersLoading ? (
                    [...Array(3)].map((_, i) => <TableRow key={i}>{[...Array(6)].map((_, j) => <TableCell key={j}><div className="h-4 bg-muted animate-pulse rounded w-16" /></TableCell>)}</TableRow>)
                  ) : orders.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">No recent orders</TableCell></TableRow>
                  ) : (
                    orders.slice(0, 20).map((o: any) => (
                      <TableRow key={o.id}>
                        <TableCell className="font-bold">{o.symbol}</TableCell>
                        <TableCell>
                          <span className={o.side === "buy" ? "text-green-600 font-medium" : "text-red-500 font-medium"}>
                            {o.side?.toUpperCase()}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{o.order_type || o.type}</TableCell>
                        <TableCell>{o.qty || o.notional}</TableCell>
                        <TableCell>{statusBadge(o.status)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{fmtDatetime(o.submitted_at)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Activities */}
        <TabsContent value="activities" className="mt-3">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Symbol</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Net Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activitiesLoading ? (
                    [...Array(3)].map((_, i) => <TableRow key={i}>{[...Array(6)].map((_, j) => <TableCell key={j}><div className="h-4 bg-muted animate-pulse rounded w-16" /></TableCell>)}</TableRow>)
                  ) : activities.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">No recent activities</TableCell></TableRow>
                  ) : (
                    activities.map((a: any) => (
                      <TableRow key={a.id}>
                        <TableCell className="text-sm">{fmtDate(a.date)}</TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{a.activity_type}</Badge></TableCell>
                        <TableCell className="font-medium">{a.symbol || "—"}</TableCell>
                        <TableCell>{a.qty || "—"}</TableCell>
                        <TableCell>{a.price ? usd(a.price) : "—"}</TableCell>
                        <TableCell className={parseFloat(a.net_amount || "0") >= 0 ? "text-green-600" : "text-red-500"}>
                          {a.net_amount ? usd(a.net_amount) : "—"}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Transfers */}
        <TabsContent value="transfers" className="mt-3">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Direction</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transfersLoading ? (
                    [...Array(3)].map((_, i) => <TableRow key={i}>{[...Array(5)].map((_, j) => <TableCell key={j}><div className="h-4 bg-muted animate-pulse rounded w-16" /></TableCell>)}</TableRow>)
                  ) : transfers.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">No transfers found</TableCell></TableRow>
                  ) : (
                    transfers.map((t: any) => (
                      <TableRow key={t.id}>
                        <TableCell className="text-sm">{fmtDate(t.created_at)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {t.direction === "INCOMING" ? (
                              <ArrowDownRight className="h-4 w-4 text-green-500" />
                            ) : (
                              <ArrowUpRight className="h-4 w-4 text-red-500" />
                            )}
                            <span className={t.direction === "INCOMING" ? "text-green-600" : "text-red-500"}>
                              {t.direction}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{t.type?.toUpperCase()}</TableCell>
                        <TableCell className="font-medium">{usd(t.amount)}</TableCell>
                        <TableCell>{statusBadge(t.status)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function UsClientAccounts() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [selectedAccount, setSelectedAccount] = useState<any>(null);

  const { data, isLoading, refetch } = useQuery<{ configured: boolean; accounts: any[] }>({
    queryKey: ["/api/us-trading/broker/accounts", status, search],
    queryFn: () =>
      fetch(`${BASE}/broker/accounts?${new URLSearchParams({ ...(search ? { query: search } : {}), ...(status !== "all" ? { status } : {}) })}`)
        .then(r => r.json()),
  });

  const configured = data?.configured !== false;
  const accounts = data?.accounts || [];

  if (selectedAccount) {
    return <AccountDetail account={selectedAccount} onBack={() => setSelectedAccount(null)} />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">US Trading — Client Accounts</h1>
        <p className="text-muted-foreground text-sm">
          View and manage your clients' Alpaca US trading accounts, positions, orders, and transfers
        </p>
      </div>

      {!configured && (
        <Alert className="border-orange-200 bg-orange-50 dark:bg-orange-950/20 dark:border-orange-800">
          <AlertTriangle className="h-4 w-4 text-orange-500" />
          <AlertDescription className="text-orange-700 dark:text-orange-300">
            Alpaca Broker API is not configured. Contact your administrator.
          </AlertDescription>
        </Alert>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Accounts", value: accounts.length, icon: Users },
          { label: "Active", value: accounts.filter((a: any) => a.status === "ACTIVE").length, icon: CheckCircle2 },
          { label: "Pending", value: accounts.filter((a: any) => ["SUBMITTED", "PENDING", "ACTION_REQUIRED"].includes(a.status)).length, icon: Clock },
          { label: "Restricted", value: accounts.filter((a: any) => ["REJECTED", "ACCOUNT_CLOSED", "DISABLED"].includes(a.status)).length, icon: XCircle },
        ].map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardContent className="p-4 flex items-center gap-3">
              <Icon className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-xl font-bold">{value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by name, email, account number…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="SUBMITTED">Submitted</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="ACTION_REQUIRED">Action Required</SelectItem>
            <SelectItem value="REJECTED">Rejected</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={() => refetch()}>
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Accounts table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account No.</TableHead>
                  <TableHead>Client Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Opened</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  [...Array(5)].map((_, i) => (
                    <TableRow key={i}>
                      {[...Array(6)].map((_, j) => (
                        <TableCell key={j}><div className="h-4 bg-muted animate-pulse rounded w-24" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : accounts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                      {configured
                        ? "No client accounts found. Accounts created via the Admin Broker Dashboard will appear here."
                        : "Alpaca Broker API is not configured"}
                    </TableCell>
                  </TableRow>
                ) : (
                  accounts.map((acc: any) => (
                    <TableRow key={acc.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedAccount(acc)}>
                      <TableCell className="font-mono text-xs font-medium">
                        {acc.account_number || acc.id?.slice(0, 8)}
                      </TableCell>
                      <TableCell className="font-medium">
                        {acc.identity?.given_name} {acc.identity?.family_name}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{acc.contact?.email_address || "—"}</TableCell>
                      <TableCell>{statusBadge(acc.status)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{fmtDate(acc.created_at)}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" onClick={e => { e.stopPropagation(); setSelectedAccount(acc); }}>
                          <Eye className="h-4 w-4 mr-1" /> View
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
    </div>
  );
}
