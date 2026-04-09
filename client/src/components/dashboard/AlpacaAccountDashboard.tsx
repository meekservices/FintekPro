import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import {
  Wallet, TrendingUp, TrendingDown, Clock, RefreshCw, X, AlertTriangle,
  DollarSign, BarChart3, Activity, XCircle, CheckCircle2,
  Building2, KeyRound, Eye, EyeOff, Link2, FileText, Banknote, Trash2,
  ArrowUpCircle, ArrowDownCircle, Plus, Download, Globe, ChevronRight,
  Zap, Crown, Lock, Landmark, Send, Settings2, CalendarDays, Radio,
  ListOrdered, ShieldCheck, GitMerge, Scale, Info, Receipt, FilePlus,
  Bookmark, ArrowLeftRight,
} from "lucide-react";
import FundingWalletPanel from "@/components/us-trading/FundingWalletPanel";
import RecipientBanksPanel from "@/components/us-trading/RecipientBanksPanel";
import EnhancedOrderForm from "@/components/us-trading/EnhancedOrderForm";
import OptionsChain from "@/components/us-trading/OptionsChain";
import AccountConfigPanel from "@/components/us-trading/AccountConfigPanel";
import AlpacaEventFeed from "@/components/us-trading/AlpacaEventFeed";
import MarketCalendarPanel from "@/components/us-trading/MarketCalendarPanel";
import CorporateActionsPanel from "@/components/us-trading/CorporateActionsPanel";
import RebalancingPanel from "@/components/us-trading/RebalancingPanel";
import WatchlistsPanel from "@/components/us-trading/WatchlistsPanel";
import JournalsPanel from "@/components/us-trading/JournalsPanel";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AlpacaAccount {
  id: string;
  account_number: string;
  status: string;
  cash: string;
  portfolio_value: string;
  buying_power: string;
  equity: string;
  currency: string;
  long_market_value: string;
  unrealized_pl: string;
  unrealized_plpc: string;
  realized_pl: string;
  daytrade_count: number;
  pattern_day_trader: boolean;
  trading_blocked: boolean;
  account_blocked: boolean;
  created_at: string;
}

interface AlpacaOrder {
  id: string;
  client_order_id: string;
  status: string;
  symbol: string;
  qty?: string;
  notional?: string;
  filled_qty: string;
  filled_avg_price: string | null;
  order_type: string;
  side: string;
  time_in_force: string;
  created_at: string;
  submitted_at: string;
  filled_at: string | null;
}

interface AlpacaPosition {
  symbol: string;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  marketValue: number;
  gainLoss: number;
  gainLossPercent: number;
  side: string;
  currency: string;
}

interface MarketClock {
  timestamp: string;
  is_open: boolean;
  next_open: string;
  next_close: string;
}

interface PortfolioHistory {
  timestamp: number[];
  equity: number[];
  profit_loss: number[];
  profit_loss_pct: number[];
  base_value: number;
  timeframe: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(val: number | string, decimals = 2): string {
  const n = typeof val === "string" ? parseFloat(val) : val;
  if (isNaN(n)) return "—";
  return n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtUSD(val: number | string): string {
  const n = typeof val === "string" ? parseFloat(val) : val;
  if (isNaN(n)) return "—";
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtPct(val: number | string, multiply = false): string {
  const n = typeof val === "string" ? parseFloat(val) : val;
  if (isNaN(n)) return "—";
  const pct = multiply ? n * 100 : n;
  return (pct >= 0 ? "+" : "") + pct.toFixed(2) + "%";
}

const PERIODS = [
  { value: "1D", label: "1 Day" },
  { value: "1W", label: "1 Week" },
  { value: "1M", label: "1 Month" },
  { value: "3M", label: "3 Months" },
  { value: "1A", label: "1 Year" },
];

const PERIOD_TIMEFRAME: Record<string, string> = {
  "1D": "5Min",
  "1W": "1H",
  "1M": "1D",
  "3M": "1D",
  "1A": "1D",
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  title, value, sub, icon: Icon, positive, loading,
}: {
  title: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  positive?: boolean;
  loading?: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</span>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        {loading ? (
          <Skeleton className="h-7 w-28 mb-1" />
        ) : (
          <div className="text-2xl font-bold tracking-tight">{value}</div>
        )}
        {sub && !loading && (
          <div className={`text-xs mt-1 font-medium ${positive === undefined ? "text-muted-foreground" : positive ? "text-green-600 dark:text-green-400" : "text-red-500"}`}>
            {sub}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MarketClockBadge({ clock, loading }: { clock?: MarketClock; loading: boolean }) {
  if (loading) return <Skeleton className="h-6 w-24" />;
  if (!clock) return null;
  const nextEvent = clock.is_open
    ? new Date(clock.next_close).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
    : new Date(clock.next_open).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="flex items-center gap-2">
      <div className={`h-2 w-2 rounded-full ${clock.is_open ? "bg-green-500 animate-pulse" : "bg-gray-400"}`} />
      <span className="text-sm font-medium">
        {clock.is_open ? "Market Open" : "Market Closed"}
      </span>
      <span className="text-xs text-muted-foreground">
        {clock.is_open ? `Closes ${nextEvent}` : `Opens ${nextEvent}`}
      </span>
    </div>
  );
}

function PortfolioChart({
  period, setPeriod, isPaper,
}: {
  period: string;
  setPeriod: (p: string) => void;
  isPaper: boolean;
}) {
  const { data, isLoading } = useQuery<{ configured: boolean; history: PortfolioHistory | null }>({
    queryKey: ["/api/us-trading/alpaca/portfolio/history", period],
    queryFn: () =>
      fetch(`/api/us-trading/alpaca/portfolio/history?period=${period}&timeframe=${PERIOD_TIMEFRAME[period]}`).then(r => r.json()),
    staleTime: 60000,
  });

  const chartData = (data?.history?.timestamp || []).map((ts, i) => ({
    time: period === "1D"
      ? new Date(ts * 1000).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
      : new Date(ts * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    equity: data!.history!.equity[i],
    pl: data!.history!.profit_loss[i],
  }));

  const baseValue = data?.history?.base_value ?? 0;
  const lastEquity = chartData.length > 0 ? chartData[chartData.length - 1].equity : 0;
  const isPositive = lastEquity >= baseValue;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Portfolio History
              {isPaper && (
                <Badge variant="outline" className="text-xs ml-1 border-amber-400 text-amber-600 dark:text-amber-400">
                  Paper
                </Badge>
              )}
            </CardTitle>
            {!isLoading && chartData.length > 0 && (
              <p className={`text-sm font-semibold mt-0.5 ${isPositive ? "text-green-600 dark:text-green-400" : "text-red-500"}`}>
                {fmtUSD(lastEquity)} &nbsp;
                <span className="font-normal text-xs">
                  {isPositive ? "▲" : "▼"} {fmtUSD(Math.abs(lastEquity - baseValue))} ({fmtPct((lastEquity - baseValue) / baseValue * 100)})
                </span>
              </p>
            )}
          </div>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[110px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIODS.map(p => (
                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-44 w-full" />
        ) : chartData.length === 0 ? (
          <div className="h-44 flex items-center justify-center text-sm text-muted-foreground">
            No portfolio history data available
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={176}>
            <LineChart data={chartData} margin={{ left: 0, right: 0, top: 4, bottom: 0 }}>
              <XAxis
                dataKey="time"
                tick={{ fontSize: 10 }}
                interval="preserveStartEnd"
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 10 }}
                tickFormatter={v => "$" + (v >= 1000 ? (v / 1000).toFixed(1) + "k" : v.toFixed(0))}
                axisLine={false}
                tickLine={false}
                width={55}
              />
              <Tooltip
                formatter={(val: number) => [fmtUSD(val), "Equity"]}
                labelStyle={{ fontSize: 11 }}
                contentStyle={{ fontSize: 12 }}
              />
              {baseValue > 0 && (
                <ReferenceLine y={baseValue} stroke="#6b7280" strokeDasharray="4 2" strokeWidth={1} />
              )}
              <Line
                type="monotone"
                dataKey="equity"
                stroke={isPositive ? "#16a34a" : "#ef4444"}
                dot={false}
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

function PositionsTable({ isPaper }: { isPaper: boolean }) {
  const { toast } = useToast();
  const { data, isLoading, refetch } = useQuery<{
    configured: boolean;
    positions: AlpacaPosition[];
    totalValueUSD: number;
    totalGainLossUSD: number;
  }>({
    queryKey: ["/api/us-trading/positions"],
    staleTime: 30000,
  });

  const closeMutation = useMutation({
    mutationFn: (symbol: string) =>
      apiRequest(`/api/us-trading/alpaca/positions/${symbol}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/us-trading/positions"] });
      toast({ title: "Position closed", description: "The position has been closed." });
    },
    onError: (e: any) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const positions = data?.positions ?? [];

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Live Positions
            {isPaper && (
              <Badge variant="outline" className="text-xs border-amber-400 text-amber-600 dark:text-amber-400">Paper</Badge>
            )}
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={() => refetch()} className="h-7 px-2">
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
        {!isLoading && positions.length > 0 && (
          <CardDescription>
            Total: {fmtUSD(data?.totalValueUSD ?? 0)} · P&L: {" "}
            <span className={(data?.totalGainLossUSD ?? 0) >= 0 ? "text-green-600 dark:text-green-400" : "text-red-500"}>
              {fmtUSD(data?.totalGainLossUSD ?? 0)}
            </span>
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-4 space-y-2">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : positions.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            No open positions
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Symbol</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Avg Price</TableHead>
                <TableHead className="text-right">Current</TableHead>
                <TableHead className="text-right">Mkt Value</TableHead>
                <TableHead className="text-right">P&L</TableHead>
                <TableHead className="text-right">P&L %</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {positions.map(p => (
                <TableRow key={p.symbol}>
                  <TableCell className="font-semibold">{p.symbol}</TableCell>
                  <TableCell className="text-right">{fmt(p.quantity)}</TableCell>
                  <TableCell className="text-right">{fmtUSD(p.avgPrice)}</TableCell>
                  <TableCell className="text-right">{fmtUSD(p.currentPrice)}</TableCell>
                  <TableCell className="text-right">{fmtUSD(p.marketValue)}</TableCell>
                  <TableCell className={`text-right ${p.gainLoss >= 0 ? "text-green-600 dark:text-green-400" : "text-red-500"}`}>
                    {fmtUSD(p.gainLoss)}
                  </TableCell>
                  <TableCell className={`text-right ${p.gainLossPercent >= 0 ? "text-green-600 dark:text-green-400" : "text-red-500"}`}>
                    {fmtPct(p.gainLossPercent)}
                  </TableCell>
                  <TableCell>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20">
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Close Position: {p.symbol}</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will place a market sell order for {fmt(p.quantity)} shares of {p.symbol} at market price.
                            {isPaper && " (Paper trading — no real money involved.)"}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-red-500 hover:bg-red-600"
                            onClick={() => closeMutation.mutate(p.symbol)}
                          >
                            Close Position
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function OrdersTable({ isPaper }: { isPaper: boolean }) {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState("open");
  const { data, isLoading, refetch } = useQuery<{ configured: boolean; orders: AlpacaOrder[] }>({
    queryKey: ["/api/us-trading/alpaca/orders", statusFilter],
    queryFn: () =>
      fetch(`/api/us-trading/alpaca/orders?status=${statusFilter}&limit=50`).then(r => r.json()),
    staleTime: 15000,
  });

  const cancelOneMutation = useMutation({
    mutationFn: (orderId: string) =>
      apiRequest(`/api/us-trading/alpaca/orders/${orderId}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/us-trading/alpaca/orders"] });
      toast({ title: "Order cancelled" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const cancelAllMutation = useMutation({
    mutationFn: () => apiRequest("/api/us-trading/alpaca/orders", { method: "DELETE" }),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/us-trading/alpaca/orders"] });
      toast({ title: `Cancelled ${res.cancelled ?? "all"} orders` });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const orders = data?.orders ?? [];
  const openOrders = orders.filter(o => ["new", "partially_filled", "pending_new", "accepted", "held"].includes(o.status));

  const statusColor: Record<string, string> = {
    filled: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    partially_filled: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    new: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    pending_new: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    cancelled: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
    expired: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
    rejected: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Orders
            {isPaper && (
              <Badge variant="outline" className="text-xs border-amber-400 text-amber-600 dark:text-amber-400">Paper</Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-8 w-[110px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
                <SelectItem value="all">All</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="ghost" size="sm" onClick={() => refetch()} className="h-8 px-2">
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
            {openOrders.length > 0 && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 text-xs border-red-300 text-red-600 dark:text-red-400">
                    <XCircle className="h-3.5 w-3.5 mr-1" />
                    Cancel All
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Cancel All Open Orders?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will cancel all {openOrders.length} open order{openOrders.length !== 1 ? "s" : ""}.
                      {isPaper && " (Paper trading — no real money involved.)"}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Keep Orders</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-red-500 hover:bg-red-600"
                      onClick={() => cancelAllMutation.mutate()}
                    >
                      Cancel All
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-4 space-y-2">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : orders.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            No {statusFilter} orders
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Symbol</TableHead>
                <TableHead>Side</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Filled</TableHead>
                <TableHead className="text-right">Avg Fill</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map(o => {
                const isOpen = ["new", "partially_filled", "pending_new", "accepted", "held"].includes(o.status);
                return (
                  <TableRow key={o.id}>
                    <TableCell className="font-semibold">{o.symbol}</TableCell>
                    <TableCell>
                      <Badge className={`text-xs ${o.side === "buy" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"}`} variant="outline">
                        {o.side.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs capitalize">{o.order_type}</TableCell>
                    <TableCell className="text-right">{o.qty ?? o.notional ? (o.qty ?? "$" + o.notional) : "—"}</TableCell>
                    <TableCell className="text-right">{o.filled_qty || "0"}</TableCell>
                    <TableCell className="text-right">{o.filled_avg_price ? fmtUSD(parseFloat(o.filled_avg_price)) : "—"}</TableCell>
                    <TableCell>
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${statusColor[o.status] ?? "bg-gray-100 text-gray-600"}`}>
                        {o.status.replace("_", " ")}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(o.submitted_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </TableCell>
                    <TableCell>
                      {isOpen && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                          onClick={() => cancelOneMutation.mutate(o.id)}
                          disabled={cancelOneMutation.isPending}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Wallet Tab ───────────────────────────────────────────────────────────────

interface AchRelationship {
  id: string;
  account_id: string;
  created_at: string;
  updated_at: string;
  status: string;
  account_owner_name: string;
  bank_account_type: string;
  bank_account_number: string;
  bank_routing_number: string;
  nickname: string;
}

interface Transfer {
  id: string;
  relationship_id?: string;
  account_id: string;
  type: string;
  status: string;
  amount: string;
  direction: string;
  created_at: string;
  updated_at: string;
  requested_amount?: string;
  fee?: string;
  reason?: string;
}

function WalletTab({ accountId }: { accountId: string }) {
  const { toast } = useToast();
  const [transferOpen, setTransferOpen] = useState(false);
  const [direction, setDirection] = useState<"INCOMING" | "OUTGOING">("INCOMING");
  const [amount, setAmount] = useState("");
  const [relId, setRelId] = useState("");

  const { data: achData, isLoading: achLoading, refetch: refetchAch } = useQuery<{ relationships: AchRelationship[] }>({
    queryKey: ["/api/us-trading/broker/accounts", accountId, "ach-relationships"],
    queryFn: () => fetch(`/api/us-trading/broker/accounts/${accountId}/ach-relationships`).then(r => r.json()),
    staleTime: 60000,
  });

  const { data: transferData, isLoading: transferLoading, refetch: refetchTransfers } = useQuery<{ transfers: Transfer[] }>({
    queryKey: ["/api/us-trading/broker/accounts", accountId, "transfers"],
    queryFn: () => fetch(`/api/us-trading/broker/accounts/${accountId}/transfers`).then(r => r.json()),
    staleTime: 30000,
  });

  const deleteAchMutation = useMutation({
    mutationFn: (relId: string) =>
      apiRequest(`/api/us-trading/broker/accounts/${accountId}/ach-relationships/${relId}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/us-trading/broker/accounts", accountId, "ach-relationships"] });
      toast({ title: "ACH relationship removed" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const transferMutation = useMutation({
    mutationFn: () =>
      apiRequest(`/api/us-trading/broker/accounts/${accountId}/transfers`, {
        method: "POST",
        body: JSON.stringify({ relationship_id: relId, type: "ach", direction, amount: parseFloat(amount) }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/us-trading/broker/accounts", accountId, "transfers"] });
      toast({ title: "Transfer initiated", description: `$${amount} ${direction === "INCOMING" ? "deposit" : "withdrawal"} submitted.` });
      setTransferOpen(false);
      setAmount("");
    },
    onError: (e: any) => toast({ title: "Transfer failed", description: e.message, variant: "destructive" }),
  });

  const relationships = achData?.relationships ?? [];
  const transfers = transferData?.transfers ?? [];

  const statusColors: Record<string, string> = {
    APPROVED: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    PENDING: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    CANCELED: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
    COMPLETE: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    RETURNED: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
    FAILED: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
  };

  return (
    <div className="space-y-5">
      {/* ACH Relationships */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Banknote className="h-4 w-4" />
              ACH Bank Relationships
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => refetchAch()} className="h-7 px-2">
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {achLoading ? (
            <div className="p-4 space-y-2">{[...Array(2)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : relationships.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">No ACH relationships found</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nickname</TableHead>
                  <TableHead>Bank Account</TableHead>
                  <TableHead>Routing</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {relationships.map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.nickname || r.account_owner_name}</TableCell>
                    <TableCell className="font-mono text-xs">****{r.bank_account_number.slice(-4)}</TableCell>
                    <TableCell className="font-mono text-xs">{r.bank_routing_number}</TableCell>
                    <TableCell className="capitalize text-xs">{r.bank_account_type}</TableCell>
                    <TableCell>
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${statusColors[r.status] ?? "bg-gray-100 text-gray-600"}`}>
                        {r.status}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-red-500 hover:text-red-600"
                        onClick={() => deleteAchMutation.mutate(r.id)}
                        disabled={deleteAchMutation.isPending}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Transfers */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <ArrowUpCircle className="h-4 w-4" />
              Transfers
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => refetchTransfers()} className="h-7 px-2">
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
              {relationships.some(r => r.status === "APPROVED") && (
                <Button size="sm" className="h-7 text-xs" onClick={() => setTransferOpen(true)}>
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  New Transfer
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {transferLoading ? (
            <div className="p-4 space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : transfers.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">No transfers found</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Direction</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transfers.map(t => (
                  <TableRow key={t.id}>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        {t.direction === "INCOMING"
                          ? <ArrowDownCircle className="h-3.5 w-3.5 text-green-500" />
                          : <ArrowUpCircle className="h-3.5 w-3.5 text-blue-500" />
                        }
                        <span className="text-xs">{t.direction === "INCOMING" ? "Deposit" : "Withdrawal"}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-semibold">{fmtUSD(parseFloat(t.amount))}</TableCell>
                    <TableCell className="text-xs capitalize">{t.type}</TableCell>
                    <TableCell>
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${statusColors[t.status] ?? "bg-gray-100 text-gray-600"}`}>
                        {t.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(t.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* New Transfer Dialog */}
      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>New ACH Transfer</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Direction</Label>
              <Select value={direction} onValueChange={v => setDirection(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="INCOMING">Deposit (Bank → Account)</SelectItem>
                  <SelectItem value="OUTGOING">Withdrawal (Account → Bank)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>ACH Relationship</Label>
              <Select value={relId} onValueChange={setRelId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select bank account" />
                </SelectTrigger>
                <SelectContent>
                  {relationships.filter(r => r.status === "APPROVED").map(r => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.nickname || r.account_owner_name} (****{r.bank_account_number.slice(-4)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Amount (USD)</Label>
              <Input
                type="number"
                min="1"
                placeholder="0.00"
                value={amount}
                onChange={e => setAmount(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransferOpen(false)}>Cancel</Button>
            <Button
              onClick={() => transferMutation.mutate()}
              disabled={!relId || !amount || parseFloat(amount) <= 0 || transferMutation.isPending}
            >
              {transferMutation.isPending ? "Submitting…" : "Submit Transfer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Activities Tab ────────────────────────────────────────────────────────────

interface AccountActivity {
  id: string;
  activity_type: string;
  date?: string;
  net_amount?: string;
  symbol?: string;
  qty?: string;
  price?: string;
  per_share_amount?: string;
  description?: string;
  status?: string;
  side?: string;
  type?: string;
  leaves_qty?: string;
  cum_qty?: string;
  transaction_time?: string;
}

function ActivitiesTab({ accountId }: { accountId: string }) {
  const [activityType, setActivityType] = useState("all");
  const { data, isLoading, refetch } = useQuery<{ activities: AccountActivity[] }>({
    queryKey: ["/api/us-trading/broker/accounts", accountId, "activities", activityType],
    queryFn: () => {
      const params = activityType !== "all" ? `?activity_type=${activityType}` : "";
      return fetch(`/api/us-trading/broker/accounts/${accountId}/activities${params}`).then(r => r.json());
    },
    staleTime: 30000,
  });

  const activities = data?.activities ?? [];

  const ACTIVITY_TYPES: Array<{ value: string; label: string; tooltip: string }> = [
    { value: "all", label: "All Types", tooltip: "Show every activity type" },
    { value: "FILL", label: "Fills", tooltip: "Order executions (buys/sells)" },
    { value: "DIV", label: "Dividends", tooltip: "Cash dividends for US residents" },
    { value: "DIVNRA", label: "Dividends (NRA)", tooltip: "25% withholding tax on dividends for non-US residents (DIVNRA)" },
    { value: "INT", label: "Interest", tooltip: "Cash interest earned on uninvested cash via the High-Yield program" },
    { value: "CSD", label: "Cash Deposits", tooltip: "ACH or wire transfers into the account" },
    { value: "CSW", label: "Cash Withdrawals", tooltip: "Cash withdrawn to external bank" },
    { value: "JNLC", label: "Journal Cash", tooltip: "Internal cash journal between Alpaca accounts" },
    { value: "JNLS", label: "Journal Securities", tooltip: "Internal securities journal between Alpaca accounts" },
    { value: "ACATC", label: "ACAT Cash", tooltip: "Automated Customer Account Transfer — cash component" },
    { value: "ACATS", label: "ACAT Securities", tooltip: "Automated Customer Account Transfer — securities component" },
    { value: "SSO", label: "Stock Settlement", tooltip: "Stock settlement out of account" },
    { value: "SSOI", label: "Stock Settlement In", tooltip: "Stock settlement into account" },
    { value: "REORG", label: "Reorganisation", tooltip: "Corporate reorganisation event (spin-off, merger, split)" },
    { value: "PTC", label: "Pass-through Charge", tooltip: "Exchange or regulatory pass-through fee" },
    { value: "NC", label: "Name Change", tooltip: "Security name/symbol change" },
  ];

  const activityTypeColor: Record<string, string> = {
    FILL: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    ACATC: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    ACATS: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    DIV: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    DIVNRA: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    INT: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400",
    CSD: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
    CSW: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
    JNLC: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
    JNLS: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
    SSO: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
    SSOI: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
    REORG: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    PTC: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
    NC: "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300",
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Account Activities
          </CardTitle>
          <div className="flex items-center gap-2">
            <Select value={activityType} onValueChange={setActivityType}>
              <SelectTrigger className="h-8 w-[140px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACTIVITY_TYPES.map(t => (
                  <SelectItem key={t.value} value={t.value} title={t.tooltip}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="ghost" size="sm" onClick={() => refetch()} className="h-7 px-2">
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-4 space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : activities.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">No activities found</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Symbol</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-right">Net Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activities.slice(0, 50).map(a => (
                <TableRow key={a.id}>
                  <TableCell>
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${activityTypeColor[a.activity_type] ?? "bg-gray-100 text-gray-600"}`}>
                      {a.activity_type}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {a.date ?? (a.transaction_time ? new Date(a.transaction_time).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—")}
                  </TableCell>
                  <TableCell className="font-medium">{a.symbol ?? "—"}</TableCell>
                  <TableCell className="text-right text-xs">{a.qty ?? a.cum_qty ?? "—"}</TableCell>
                  <TableCell className="text-right text-xs">
                    {a.price ? fmtUSD(parseFloat(a.price)) : a.per_share_amount ? fmtUSD(parseFloat(a.per_share_amount)) : "—"}
                  </TableCell>
                  <TableCell className={`text-right font-semibold text-sm ${parseFloat(a.net_amount ?? "0") >= 0 ? "text-green-600 dark:text-green-400" : "text-red-500"}`}>
                    {a.net_amount ? fmtUSD(parseFloat(a.net_amount)) : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Documents + Tax Center Tab ────────────────────────────────────────────────

interface BrokerDocument {
  id: string;
  document_type: string;
  document_sub_type?: string;
  date?: string;
  content?: string;
}

const DOC_TYPE_LABEL: Record<string, string> = {
  account_statement: "Account Statement",
  trade_confirmation: "Trade Confirmation",
  tax_statement: "Tax Statement",
  "1099": "1099",
  tax_1099b: "1099-B (Capital Gains)",
  tax_1099div: "1099-DIV (Dividends)",
  tax_1099int: "1099-INT (Interest)",
  tax_w8ben: "W-8BEN",
  identity_verification: "Identity Verification",
  cip_result: "CIP Result",
  cip_approval: "CIP Approval",
  schedule_c_gain_loss: "P&L / Schedule C",
  pnl: "Realized P&L Report",
};

const DOC_CATEGORY: Record<string, "tax" | "kyc" | "trade"> = {
  account_statement: "trade",
  trade_confirmation: "trade",
  tax_statement: "tax",
  "1099": "tax",
  tax_1099b: "tax",
  tax_1099div: "tax",
  tax_1099int: "tax",
  tax_w8ben: "kyc",
  schedule_c_gain_loss: "tax",
  pnl: "tax",
  identity_verification: "kyc",
  cip_result: "kyc",
  cip_approval: "kyc",
};

const REPORT_TYPES = [
  { value: "account_statement", label: "Account Statement", desc: "Monthly or quarterly account summary" },
  { value: "trade_confirmation", label: "Trade Confirmations", desc: "Executed order confirmations" },
  { value: "tax_1099b", label: "1099-B (Capital Gains)", desc: "For US tax reporting; informational for India ITR Schedule FA/FSI" },
  { value: "tax_1099div", label: "1099-DIV (Dividends)", desc: "Dividend income report incl. DIVNRA withholding" },
  { value: "tax_1099int", label: "1099-INT (Interest)", desc: "Cash interest earned (report in India ITR Schedule FSI)" },
  { value: "pnl", label: "Realized P&L", desc: "Realized gains/losses — use for India Capital Gains computation" },
  { value: "schedule_c_gain_loss", label: "P&L / Schedule C", desc: "Detailed gain/loss breakdown per security" },
];

function DocumentsTab({ accountId }: { accountId: string }) {
  const { toast } = useToast();
  const [docFilter, setDocFilter] = useState<"all" | "tax" | "kyc" | "trade">("all");
  const [generateType, setGenerateType] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>(() => {
    const d = new Date(); d.setFullYear(d.getFullYear() - 1);
    return d.toISOString().split("T")[0];
  });
  const [dateTo, setDateTo] = useState<string>(new Date().toISOString().split("T")[0]);

  const { data, isLoading, refetch } = useQuery<{ documents: BrokerDocument[] }>({
    queryKey: ["/api/us-trading/broker/accounts", accountId, "documents"],
    queryFn: () => fetch(`/api/us-trading/broker/accounts/${accountId}/documents`).then(r => r.json()),
    staleTime: 120000,
  });

  const downloadMutation = useMutation({
    mutationFn: (docId: string) =>
      fetch(`/api/us-trading/broker/accounts/${accountId}/documents/${docId}/download`)
        .then(r => r.json()),
    onSuccess: (data: any) => {
      if (data?.url) window.open(data.url, "_blank");
      else toast({ title: "Download ready", description: "Document URL opened in new tab." });
    },
    onError: (e: any) => toast({ title: "Download failed", description: e.message, variant: "destructive" }),
  });

  const generateMutation = useMutation({
    mutationFn: () =>
      apiRequest(`/api/us-trading/broker/accounts/${accountId}/documents`, {
        method: "POST",
        body: JSON.stringify({ document_type: generateType, date_from: dateFrom, date_to: dateTo }),
      }),
    onSuccess: () => {
      toast({ title: "Report requested", description: "The document will appear in your list shortly." });
      setTimeout(() => refetch(), 2000);
    },
    onError: (e: any) => toast({ title: "Generate failed", description: e.message, variant: "destructive" }),
  });

  const allDocs = data?.documents ?? [];
  const docs = docFilter === "all" ? allDocs : allDocs.filter(d => (DOC_CATEGORY[d.document_type] ?? "trade") === docFilter);
  const taxDocs = allDocs.filter(d => DOC_CATEGORY[d.document_type] === "tax");
  const kycDocs = allDocs.filter(d => DOC_CATEGORY[d.document_type] === "kyc");

  return (
    <div className="space-y-4">
      {/* ── Tax Center Card ──────────────────────────────── */}
      <Card className="border-amber-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Receipt className="h-4 w-4 text-amber-600" />
            Tax Center
          </CardTitle>
          <CardDescription className="text-xs">
            Generate tax documents for Indian ITR filing. Use P&L / 1099 data for Schedule FA, FSI, and Capital Gains schedules.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {taxDocs.length === 0 ? (
              <div className="col-span-2 text-xs text-muted-foreground bg-muted/40 rounded p-3">
                No tax documents found. Use the generator below to request them.
              </div>
            ) : (
              taxDocs.map(d => (
                <div key={d.id} className="flex items-center justify-between border rounded-md p-3">
                  <div>
                    <div className="text-xs font-medium">{DOC_TYPE_LABEL[d.document_type] ?? d.document_type.replace(/_/g, " ")}</div>
                    {d.date && <div className="text-[10px] text-muted-foreground">{new Date(d.date).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}</div>}
                  </div>
                  <Button variant="outline" size="sm" className="h-7 px-2" onClick={() => downloadMutation.mutate(d.id)}>
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))
            )}
          </div>
          <Separator />
          <div>
            <p className="text-xs font-medium mb-2 flex items-center gap-1"><FilePlus className="h-3.5 w-3.5" /> Generate Report</p>
            <div className="flex flex-col sm:flex-row gap-2">
              <Select value={generateType} onValueChange={setGenerateType}>
                <SelectTrigger className="h-8 text-xs flex-1">
                  <SelectValue placeholder="Select report type..." />
                </SelectTrigger>
                <SelectContent>
                  {REPORT_TYPES.map(r => (
                    <SelectItem key={r.value} value={r.value}>
                      <div>
                        <div className="text-xs font-medium">{r.label}</div>
                        <div className="text-[10px] text-muted-foreground">{r.desc}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-8 text-xs w-36" />
              <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-8 text-xs w-36" />
              <Button
                size="sm"
                className="h-8 text-xs whitespace-nowrap"
                disabled={!generateType || generateMutation.isPending}
                onClick={() => generateMutation.mutate()}
              >
                {generateMutation.isPending ? <RefreshCw className="h-3 w-3 animate-spin mr-1" /> : <FilePlus className="h-3 w-3 mr-1" />}
                Generate
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Alert className="border-amber-200 bg-amber-50/50 py-2">
        <Info className="h-3.5 w-3.5 text-amber-600" />
        <AlertDescription className="text-xs text-amber-700">
          <strong>India Tax Filing Tip:</strong> US capital gains go in <strong>Schedule CG → FA</strong>. Dividend income (with DIVNRA withholding) goes in <strong>Schedule FSI</strong>. Use Form 67 before filing to claim Foreign Tax Credit. Maintain position records for Schedule FA (foreign assets) if portfolio value exceeds ₹5L at year-end.
        </AlertDescription>
      </Alert>

      {/* ── All Documents ─────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" />
              All Documents
            </CardTitle>
            <div className="flex items-center gap-2">
              <Select value={docFilter} onValueChange={v => setDocFilter(v as any)}>
                <SelectTrigger className="h-8 w-[110px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="tax">Tax</SelectItem>
                  <SelectItem value="kyc">KYC</SelectItem>
                  <SelectItem value="trade">Trade</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="ghost" size="sm" onClick={() => refetch()} className="h-7 px-2">
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : docs.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">No documents available</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Document Type</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="w-16"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {docs.map(d => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium text-sm">
                      {DOC_TYPE_LABEL[d.document_type] ?? d.document_type.replace(/_/g, " ")}
                      {d.document_sub_type && <span className="text-xs text-muted-foreground ml-1 capitalize">({d.document_sub_type.replace(/_/g, " ")})</span>}
                    </TableCell>
                    <TableCell>
                      <Badge className={
                        DOC_CATEGORY[d.document_type] === "tax" ? "bg-amber-100 text-amber-700 text-[10px]" :
                        DOC_CATEGORY[d.document_type] === "kyc" ? "bg-blue-100 text-blue-700 text-[10px]" :
                        "bg-gray-100 text-gray-600 text-[10px]"
                      }>
                        {DOC_CATEGORY[d.document_type] ?? "trade"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {d.date ? new Date(d.date).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2"
                        onClick={() => downloadMutation.mutate(d.id)}
                        disabled={downloadMutation.isPending}
                      >
                        <Download className="h-3.5 w-3.5" />
                      </Button>
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

// ─── LRS Tracker Card ─────────────────────────────────────────────────────────

function LrsTrackerCard() {
  const { data, isLoading } = useQuery<{
    success: boolean;
    data: {
      financialYear: string;
      lrsLimitUsd: number;
      totalRemittedUsd: number;
      remainingLimitUsd: number;
      transactionCount: number;
      taxImplications: { tcsRate: number; tcsThreshold: number; note: string };
    };
  }>({
    queryKey: ["/api/global-advisory/lrs/status"],
    queryFn: () => fetch("/api/global-advisory/lrs/status").then(r => r.json()),
    staleTime: 120_000,
  });

  const d = data?.data;
  const usedPct = d ? Math.min((d.totalRemittedUsd / d.lrsLimitUsd) * 100, 100) : 0;

  return (
    <Card className="border-indigo-200">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Globe className="h-4 w-4 text-indigo-600" />
            LRS Tracker — FY {d?.financialYear ?? "2024-25"}
          </CardTitle>
          <Badge className="bg-indigo-100 text-indigo-700 text-xs">FEMA/RBI</Badge>
        </div>
        <CardDescription className="text-xs">Liberalised Remittance Scheme — $250,000/FY cap</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="space-y-2"><Skeleton className="h-6 w-full" /><Skeleton className="h-3 w-full" /></div>
        ) : (
          <>
            <div className="flex items-end justify-between">
              <div>
                <div className="text-2xl font-bold">${(d?.totalRemittedUsd ?? 0).toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">of $250,000 used ({usedPct.toFixed(1)}%)</div>
              </div>
              <div className="text-right">
                <div className="text-base font-semibold text-green-600">${(d?.remainingLimitUsd ?? 250000).toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">remaining</div>
              </div>
            </div>
            <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${usedPct > 80 ? "bg-red-500" : usedPct > 50 ? "bg-amber-500" : "bg-emerald-500"}`}
                style={{ width: `${usedPct}%` }}
              />
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-amber-50 dark:bg-amber-900/20 rounded p-2 border border-amber-200">
                <div className="font-medium text-amber-700">TCS Threshold</div>
                <div className="text-muted-foreground">₹7 Lakh ({d?.taxImplications?.tcsRate ?? 20}% TCS above)</div>
              </div>
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded p-2 border border-blue-200">
                <div className="font-medium text-blue-700">Transactions</div>
                <div className="text-muted-foreground">{d?.transactionCount ?? 0} remittances this FY</div>
              </div>
            </div>
            {(d?.totalRemittedUsd ?? 0) > 0 && (
              <div className="text-xs text-muted-foreground bg-muted/40 rounded p-2">
                {d?.taxImplications?.note}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Credentials Form ─────────────────────────────────────────────────────────

const DEFAULT_BASE_URL = "https://broker-api.sandbox.alpaca.markets";

function CredentialsForm({ onSuccess }: { onSuccess: () => void }) {
  const [apiKey, setApiKey] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [baseUrl, setBaseUrl] = useState(DEFAULT_BASE_URL);
  const [showSecret, setShowSecret] = useState(false);
  const { toast } = useToast();

  const saveMutation = useMutation({
    mutationFn: () =>
      apiRequest("/api/us-trading/alpaca/credentials", {
        method: "POST",
        body: JSON.stringify({ apiKey, secretKey, baseUrl }),
      }),
    onSuccess: (data: any) => {
      toast({
        title: "Connected to Alpaca",
        description: data.message ?? "Credentials saved and verified.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/us-trading/alpaca/account"] });
      queryClient.invalidateQueries({ queryKey: ["/api/us-trading/alpaca/market-clock"] });
      queryClient.invalidateQueries({ queryKey: ["/api/us-trading/positions"] });
      onSuccess();
    },
    onError: (e: any) => {
      toast({
        title: "Connection failed",
        description: e.message ?? "Check your API key and secret.",
        variant: "destructive",
      });
    },
  });

  const canSubmit = apiKey.trim().length > 0 && secretKey.trim().length > 0;

  return (
    <div className="max-w-xl mx-auto space-y-5">
      <div className="text-center mb-2">
        <div className="flex items-center justify-center w-14 h-14 rounded-full bg-primary/10 mx-auto mb-3">
          <Building2 className="h-7 w-7 text-primary" />
        </div>
        <h2 className="text-xl font-semibold">Connect Alpaca Account</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Enter your Alpaca API credentials to enable live account data, positions, and order management.
        </p>
      </div>

      <Card>
        <CardContent className="p-6 space-y-5">
          {/* Base URL */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5">
              <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
              API Base URL
            </Label>
            <Input
              value={baseUrl}
              onChange={e => setBaseUrl(e.target.value)}
              placeholder={DEFAULT_BASE_URL}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Broker Sandbox: <code className="bg-muted px-1 rounded">{DEFAULT_BASE_URL}</code>
            </p>
          </div>

          <Separator />

          {/* API Key */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5">
              <KeyRound className="h-3.5 w-3.5 text-muted-foreground" />
              API Key ID
            </Label>
            <Input
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder="CK7IOXXXXXXXXXXXXXXXXXXXXXXXX"
              className="font-mono text-sm"
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">
              Broker API keys start with <code className="bg-muted px-1 rounded">CK</code> (e.g. <code className="bg-muted px-1 rounded">CK7IO…</code>)
            </p>
          </div>

          {/* Secret Key */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5">
              <KeyRound className="h-3.5 w-3.5 text-muted-foreground" />
              Secret Key
            </Label>
            <div className="relative">
              <Input
                type={showSecret ? "text" : "password"}
                value={secretKey}
                onChange={e => setSecretKey(e.target.value)}
                placeholder="••••••••••••••••••••••••••••••••"
                className="font-mono text-sm pr-10"
                autoComplete="new-password"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowSecret(s => !s)}
              >
                {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800 py-3">
            <AlertTriangle className="h-3.5 w-3.5 text-blue-500" />
            <AlertDescription className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
              <p>
                <strong>Broker API</strong> credentials (keys starting with <code className="bg-blue-100 dark:bg-blue-900/40 px-1 rounded">CK</code>) are required for{" "}
                <code className="bg-blue-100 dark:bg-blue-900/40 px-1 rounded">broker-api.sandbox.alpaca.markets</code>.
                These are different from regular paper/live trading keys.
              </p>
              <p>
                For persistence across restarts, save{" "}
                <code className="bg-blue-100 dark:bg-blue-900/40 px-1 rounded">ALPACA_API_KEY</code>,{" "}
                <code className="bg-blue-100 dark:bg-blue-900/40 px-1 rounded">ALPACA_SECRET_KEY</code>, and{" "}
                <code className="bg-blue-100 dark:bg-blue-900/40 px-1 rounded">ALPACA_BASE_URL</code> as environment secrets.
              </p>
            </AlertDescription>
          </Alert>

          {saveMutation.isError && (
            <Alert className="border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800 py-3">
              <XCircle className="h-3.5 w-3.5 text-red-500" />
              <AlertDescription className="text-xs text-red-700 dark:text-red-300">
                <strong>Connection failed:</strong>{" "}
                {(saveMutation.error as any)?.message ?? "Check that your Broker API credentials are correct and the sandbox account is active."}{" "}
                <a
                  href="https://broker-app.sandbox.alpaca.markets"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  Open Broker Sandbox →
                </a>
              </AlertDescription>
            </Alert>
          )}

          <Button
            className="w-full"
            onClick={() => saveMutation.mutate()}
            disabled={!canSubmit || saveMutation.isPending}
          >
            {saveMutation.isPending ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Verifying connection…
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Connect & Verify
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <p className="text-center text-xs text-muted-foreground">
        Get Broker API credentials from{" "}
        <a
          href="https://broker-app.sandbox.alpaca.markets"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-foreground"
        >
          Alpaca Broker Sandbox
        </a>
        {" "}→ API Keys section.
      </p>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AlpacaAccountDashboard() {
  const [chartPeriod, setChartPeriod] = useState("1M");
  const [showCredentials, setShowCredentials] = useState(false);
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const { data: accountData, isLoading: isLoadingAccount, refetch: refetchAccount } = useQuery<{
    configured: boolean;
    isPaper: boolean;
    account?: AlpacaAccount;
  }>({
    queryKey: ["/api/us-trading/alpaca/account"],
    staleTime: 30000,
  });

  const { data: clockData, isLoading: isLoadingClock } = useQuery<{
    configured: boolean;
    clock?: MarketClock;
  }>({
    queryKey: ["/api/us-trading/alpaca/market-clock"],
    refetchInterval: 60000,
    staleTime: 30000,
  });

  // Broker account status (FD BD model)
  const { data: prefillData } = useQuery<{
    success: boolean;
    brokerAccount: any;
    compliance: { eligible: boolean; blockers: string[] };
  }>({
    queryKey: ["/api/us-trading/account/prefill"],
    staleTime: 60000,
  });
  const brokerAccount = prefillData?.brokerAccount;
  const hasBrokerAccount = Boolean(brokerAccount?.alpacaAccountId);

  // Subscription plan gate
  const { data: subData } = useQuery<{ planTier: string; isActive: boolean }>({
    queryKey: ["/api/subscriptions/status"],
    staleTime: 60000,
  });
  const planTier = subData?.planTier ?? "free";
  const isPaidPlan = planTier === "pro" || planTier === "elite";

  const configured = accountData?.configured ?? false;
  const isPaper = accountData?.isPaper ?? true;
  const account = accountData?.account;

  const equity = parseFloat(account?.equity ?? "0");
  const cash = parseFloat(account?.cash ?? "0");
  const buyingPower = parseFloat(account?.buying_power ?? "0");
  const unrealizedPL = parseFloat(account?.unrealized_pl ?? "0");
  const unrealizedPLPC = parseFloat(account?.unrealized_plpc ?? "0");
  const longMarketValue = parseFloat(account?.long_market_value ?? "0");

  if (!isLoadingAccount && (!configured || showCredentials)) {
    return (
      <div className="py-4">
        <CredentialsForm onSuccess={() => {
          setShowCredentials(false);
          refetchAccount();
        }} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Plan tier badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {planTier === "elite" && (
            <Badge className="gap-1 bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-300">
              <Crown className="h-3 w-3" /> Elite
            </Badge>
          )}
          {planTier === "pro" && (
            <Badge className="gap-1 bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300">
              <Zap className="h-3 w-3" /> Pro
            </Badge>
          )}
          {planTier === "free" && (
            <Badge variant="outline" className="gap-1 text-muted-foreground">
              Free Plan
            </Badge>
          )}
        </div>
        {planTier === "free" && (
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => navigate("/pricing")}>
            <Zap className="h-3 w-3 text-blue-500" /> Upgrade to Pro
          </Button>
        )}
      </div>

      {/* Broker account CTA — FD BD model */}
      {!hasBrokerAccount && isPaidPlan && (
        <Card className="border-primary/30 bg-gradient-to-r from-primary/5 to-blue-500/5">
          <CardContent className="p-5">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Globe className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-base">Open Your US Brokerage Account</h3>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Trade US stocks directly via our Alpaca FINRA/SEC licensed broker-dealer. Complete the 5-step application — takes under 3 minutes.
                  </p>
                  {prefillData?.compliance && !prefillData.compliance.eligible && (
                    <p className="text-xs text-red-500 mt-1">
                      ⚠ {prefillData.compliance.blockers?.[0] || "Complete KYC to proceed"}
                    </p>
                  )}
                </div>
              </div>
              <Button
                onClick={() => navigate("/us-trading/open-account")}
                disabled={prefillData?.compliance && !prefillData.compliance.eligible}
                className="gap-2 shrink-0"
              >
                Open Account
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upgrade gate — free users cannot open US account */}
      {!hasBrokerAccount && !isPaidPlan && (
        <Card className="border-dashed border-2 border-blue-200 dark:border-blue-800 bg-gradient-to-br from-blue-50/50 to-purple-50/50 dark:from-blue-950/20 dark:to-purple-950/20">
          <CardContent className="p-6 text-center">
            <div className="w-14 h-14 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center mx-auto mb-4">
              <Lock className="h-7 w-7 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="font-semibold text-lg mb-1">US Trading — Pro & Elite Feature</h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-sm mx-auto">
              Direct US stock trading via Alpaca's FINRA/SEC licensed infrastructure is available on Pro (₹999/mo) and Elite (₹25K/yr) plans. Upgrade to unlock unlimited trades at 0.5% FX spread.
            </p>
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <Button onClick={() => navigate("/pricing")} className="gap-2">
                <Zap className="h-4 w-4" /> View Plans & Upgrade
              </Button>
              <Button variant="outline" onClick={() => navigate("/pricing")} className="gap-2 text-yellow-700 border-yellow-300 hover:bg-yellow-50">
                <Crown className="h-4 w-4" /> Elite — ₹25,000/yr
              </Button>
            </div>
            <div className="mt-4 flex items-center justify-center gap-6 text-xs text-muted-foreground">
              <span>✓ Unlimited US trades</span>
              <span>✓ 0.5% FX spread</span>
              <span>✓ Real-time market data</span>
              <span>✓ Portfolio analytics</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Existing broker account status banner */}
      {hasBrokerAccount && brokerAccount.alpacaStatus && brokerAccount.alpacaStatus !== "ACTIVE" && (
        <div className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-sm ${
          brokerAccount.alpacaStatus === "SUBMITTED" ? "border-blue-200 bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-300" :
          brokerAccount.alpacaStatus === "ACTION_REQUIRED" ? "border-orange-200 bg-orange-50 dark:bg-orange-950/20 text-orange-700 dark:text-orange-300" :
          brokerAccount.alpacaStatus === "REJECTED" ? "border-red-200 bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-300" :
          "border-amber-200 bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-300"
        }`}>
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>Broker account status: <strong>{brokerAccount.alpacaStatus?.replace(/_/g, " ")}</strong>
            {brokerAccount.alpacaStatus === "SUBMITTED" && " — Alpaca is reviewing your application (1-2 business days)."}
            {brokerAccount.alpacaStatus === "ACTION_REQUIRED" && " — Additional documents needed. Check your email."}
          </span>
          <Button variant="link" size="sm" className="ml-auto h-auto p-0 text-xs" onClick={() => navigate("/us-trading/open-account")}>
            View Status →
          </Button>
        </div>
      )}

      {/* Header row */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          {isPaper && (
            <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-300">
              Paper Trading
            </Badge>
          )}
          {account && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {account.trading_blocked || account.account_blocked ? (
                <>
                  <XCircle className="h-3.5 w-3.5 text-red-500" />
                  <span className="text-red-500">Trading blocked</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                  <span>Account active · {account.account_number}</span>
                </>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <MarketClockBadge clock={clockData?.clock} loading={isLoadingClock} />
          <Button variant="ghost" size="sm" onClick={() => refetchAccount()} className="h-7 px-2">
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs gap-1"
            onClick={() => setShowCredentials(true)}
          >
            <KeyRound className="h-3 w-3" />
            Change Keys
          </Button>
        </div>
      </div>

      {/* Stats row — always visible */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          title="Portfolio Equity"
          value={isLoadingAccount ? "—" : fmtUSD(equity)}
          sub={account ? `${account.currency} · ${isPaper ? "Paper" : "Live"}` : undefined}
          icon={Wallet}
          loading={isLoadingAccount}
        />
        <StatCard
          title="Cash Balance"
          value={isLoadingAccount ? "—" : fmtUSD(cash)}
          icon={DollarSign}
          loading={isLoadingAccount}
        />
        <StatCard
          title="Buying Power"
          value={isLoadingAccount ? "—" : fmtUSD(buyingPower)}
          icon={Activity}
          loading={isLoadingAccount}
        />
        <StatCard
          title="Unrealized P&L"
          value={isLoadingAccount ? "—" : fmtUSD(unrealizedPL)}
          sub={isLoadingAccount ? undefined : fmtPct(unrealizedPLPC, true)}
          positive={unrealizedPL >= 0}
          icon={unrealizedPL >= 0 ? TrendingUp : TrendingDown}
          loading={isLoadingAccount}
        />
      </div>

      {/* Secondary stats row */}
      {account && (
        <div className="grid grid-cols-3 gap-3">
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground mb-1">Long Market Value</div>
              <div className="font-semibold">{fmtUSD(longMarketValue)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground mb-1">Realized P&L</div>
              <div className={`font-semibold ${parseFloat(account.realized_pl) >= 0 ? "text-green-600 dark:text-green-400" : "text-red-500"}`}>
                {fmtUSD(parseFloat(account.realized_pl))}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground mb-1">Day Trades (PDT)</div>
              <div className="font-semibold flex items-center gap-1.5">
                {account.daytrade_count}
                {account.pattern_day_trader && (
                  <Badge variant="destructive" className="text-xs">PDT</Badge>
                )}
                {!account.pattern_day_trader && (
                  <span className="text-xs text-muted-foreground">/ 3 limit</span>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* FX Spread + Trade Fee disclosure */}
      {account && (
        <div className="flex items-center gap-3 rounded-lg border bg-muted/30 px-4 py-2.5 text-xs text-muted-foreground flex-wrap">
          <span className="font-medium text-foreground">Your fee structure:</span>
          <span className="flex items-center gap-1">
            <DollarSign className="h-3 w-3 text-green-500" />
            FX Spread:
            <strong className="text-foreground ml-1">
              {planTier === "elite" ? "0.3%" : planTier === "pro" ? "0.5%" : "1.0%"}
            </strong>
            on USD remittances
          </span>
          <span className="text-muted-foreground/50">·</span>
          <span className="flex items-center gap-1">
            <Activity className="h-3 w-3 text-blue-500" />
            Per trade:
            <strong className="text-foreground ml-1">
              {planTier === "elite" ? "₹0" : planTier === "pro" ? "₹10" : "₹10"}
            </strong>
          </span>
          {planTier === "free" && (
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0 text-xs text-primary"
              onClick={() => navigate("/pricing")}
            >
              Upgrade to reduce fees →
            </Button>
          )}
        </div>
      )}

      {/* Tabbed sections */}
      <Tabs defaultValue="overview" className="mt-2">
        <TabsList className="mb-4 flex-wrap h-auto gap-y-1">
          <TabsTrigger value="overview" className="flex items-center gap-1.5">
            <BarChart3 className="h-3.5 w-3.5" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="trading" className="flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5" />
            Trade
          </TabsTrigger>
          <TabsTrigger value="wallet" className="flex items-center gap-1.5">
            <Banknote className="h-3.5 w-3.5" />
            Wallet
          </TabsTrigger>
          <TabsTrigger value="deposit" className="flex items-center gap-1.5">
            <Landmark className="h-3.5 w-3.5" />
            Deposit
          </TabsTrigger>
          <TabsTrigger value="withdraw" className="flex items-center gap-1.5">
            <Send className="h-3.5 w-3.5" />
            Withdraw
          </TabsTrigger>
          <TabsTrigger value="options" className="flex items-center gap-1.5">
            <ListOrdered className="h-3.5 w-3.5" />
            Options
          </TabsTrigger>
          <TabsTrigger value="activities" className="flex items-center gap-1.5">
            <Activity className="h-3.5 w-3.5" />
            Activities
          </TabsTrigger>
          <TabsTrigger value="calendar" className="flex items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5" />
            Calendar
          </TabsTrigger>
          <TabsTrigger value="config" className="flex items-center gap-1.5">
            <Settings2 className="h-3.5 w-3.5" />
            Config
          </TabsTrigger>
          <TabsTrigger value="events" className="flex items-center gap-1.5">
            <Radio className="h-3.5 w-3.5" />
            Live Events
          </TabsTrigger>
          <TabsTrigger value="documents" className="flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5" />
            Documents
          </TabsTrigger>
          <TabsTrigger value="corp-actions" className="flex items-center gap-1.5">
            <GitMerge className="h-3.5 w-3.5" />
            Corp Actions
          </TabsTrigger>
          <TabsTrigger value="rebalance" className="flex items-center gap-1.5">
            <Scale className="h-3.5 w-3.5" />
            Rebalance
          </TabsTrigger>
          <TabsTrigger value="watchlists" className="flex items-center gap-1.5">
            <Bookmark className="h-3.5 w-3.5" />
            Watchlists
          </TabsTrigger>
          <TabsTrigger value="journals" className="flex items-center gap-1.5">
            <ArrowLeftRight className="h-3.5 w-3.5" />
            Journals
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-5 mt-0">
          {configured && (
            <PortfolioChart period={chartPeriod} setPeriod={setChartPeriod} isPaper={isPaper} />
          )}
          <LrsTrackerCard />
        </TabsContent>

        <TabsContent value="trading" className="space-y-5 mt-0">
          <EnhancedOrderForm />
          <Separator />
          <PositionsTable isPaper={isPaper} />
          <Separator />
          <OrdersTable isPaper={isPaper} />
        </TabsContent>

        <TabsContent value="wallet" className="mt-0">
          {account ? (
            <WalletTab accountId={account.id} />
          ) : (
            <div className="py-8 text-center text-sm text-muted-foreground">Account data not loaded</div>
          )}
        </TabsContent>

        <TabsContent value="deposit" className="mt-0">
          {account ? (
            <FundingWalletPanel alpacaAccountId={account.id} isSandbox={isPaper} />
          ) : (
            <div className="py-8 text-center text-sm text-muted-foreground">Account data not loaded</div>
          )}
        </TabsContent>

        <TabsContent value="withdraw" className="mt-0">
          {account ? (
            <RecipientBanksPanel alpacaAccountId={account.id} />
          ) : (
            <div className="py-8 text-center text-sm text-muted-foreground">Account data not loaded</div>
          )}
        </TabsContent>

        <TabsContent value="options" className="mt-0">
          <OptionsChain />
        </TabsContent>

        <TabsContent value="activities" className="mt-0">
          {account ? (
            <ActivitiesTab accountId={account.id} />
          ) : (
            <div className="py-8 text-center text-sm text-muted-foreground">Account data not loaded</div>
          )}
        </TabsContent>

        <TabsContent value="calendar" className="mt-0">
          <MarketCalendarPanel />
        </TabsContent>

        <TabsContent value="config" className="mt-0">
          <AccountConfigPanel accountId={account?.id} />
        </TabsContent>

        <TabsContent value="events" className="mt-0">
          <AlpacaEventFeed alpacaAccountId={account?.id} />
        </TabsContent>

        <TabsContent value="documents" className="mt-0">
          {account ? (
            <DocumentsTab accountId={account.id} />
          ) : (
            <div className="py-8 text-center text-sm text-muted-foreground">Account data not loaded</div>
          )}
        </TabsContent>

        <TabsContent value="corp-actions" className="mt-0">
          <CorporateActionsPanel accountId={account?.id} />
        </TabsContent>

        <TabsContent value="rebalance" className="mt-0">
          <RebalancingPanel accountId={account?.id} />
        </TabsContent>

        <TabsContent value="watchlists" className="mt-0">
          {account ? (
            <WatchlistsPanel accountId={account.id} />
          ) : (
            <div className="py-8 text-center text-sm text-muted-foreground">Account data not loaded</div>
          )}
        </TabsContent>

        <TabsContent value="journals" className="mt-0">
          <JournalsPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
