import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Bitcoin, TrendingUp, TrendingDown, Zap, Info, RefreshCw,
  ArrowUpCircle, ArrowDownCircle,
} from "lucide-react";

const POPULAR_CRYPTO = [
  { symbol: "BTC/USD", name: "Bitcoin", icon: "₿" },
  { symbol: "ETH/USD", name: "Ethereum", icon: "Ξ" },
  { symbol: "SOL/USD", name: "Solana", icon: "◎" },
  { symbol: "USDC/USD", name: "USD Coin", icon: "$" },
  { symbol: "AVAX/USD", name: "Avalanche", icon: "▲" },
  { symbol: "DOGE/USD", name: "Dogecoin", icon: "Ð" },
  { symbol: "LINK/USD", name: "Chainlink", icon: "⬡" },
  { symbol: "BCH/USD", name: "Bitcoin Cash", icon: "Ƀ" },
  { symbol: "LTC/USD", name: "Litecoin", icon: "Ł" },
  { symbol: "SHIB/USD", name: "Shiba Inu", icon: "🐕" },
];

interface CryptoPosition {
  symbol: string;
  qty: string;
  market_value: string;
  unrealized_pl: string;
  unrealized_plpc: string;
  avg_entry_price: string;
  current_price: string;
  asset_class: string;
}

interface Props {
  accountId?: string;
}

function fmtUSD(v: string | number) {
  const n = parseFloat(String(v));
  if (isNaN(n)) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(n);
}

function fmtQty(v: string) {
  const n = parseFloat(v);
  if (isNaN(n)) return "—";
  return n.toLocaleString("en-US", { maximumSignificantDigits: 8 });
}

export default function CryptoTradingPanel({ accountId }: Props) {
  const { toast } = useToast();
  const [symbol, setSymbol] = useState("BTC/USD");
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [orderType, setOrderType] = useState<"market" | "limit">("market");
  const [qtyMode, setQtyMode] = useState<"qty" | "notional">("notional");
  const [qty, setQty] = useState("");
  const [notional, setNotional] = useState("");
  const [limitPrice, setLimitPrice] = useState("");

  const { data: assetsData, isLoading: loadingAssets } = useQuery<{ success: boolean; assets: any[] }>({
    queryKey: ["/api/crypto/assets"],
    staleTime: 10 * 60 * 1000,
  });

  const { data: posData, isLoading: loadingPositions, refetch: refetchPositions } = useQuery<{
    success: boolean; positions: CryptoPosition[];
  }>({
    queryKey: ["/api/crypto/positions", accountId],
    queryFn: () => fetch(`/api/crypto/positions${accountId ? `?account_id=${accountId}` : ""}`).then(r => r.json()),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const positions = posData?.positions || [];

  const orderMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await apiRequest("/api/crypto/orders", "POST", payload);
      return res;
    },
    onSuccess: (data: any) => {
      toast({
        title: "Crypto Order Placed",
        description: `${side.toUpperCase()} ${symbol} order submitted (ID: ${data.order?.id?.slice(0, 8)}…)`,
      });
      setQty("");
      setNotional("");
      setLimitPrice("");
      queryClient.invalidateQueries({ queryKey: ["/api/crypto/positions"] });
    },
    onError: (e: any) => {
      toast({ title: "Order Failed", description: e.message, variant: "destructive" });
    },
  });

  function handleOrder() {
    if (!symbol) return toast({ title: "Select a symbol", variant: "destructive" });
    const payload: any = {
      symbol,
      side,
      type: orderType,
      time_in_force: "gtc",
      ...(accountId && { account_id: accountId }),
    };
    if (qtyMode === "qty") {
      if (!qty) return toast({ title: "Enter quantity", variant: "destructive" });
      payload.qty = parseFloat(qty);
    } else {
      if (!notional) return toast({ title: "Enter USD amount", variant: "destructive" });
      payload.notional = parseFloat(notional);
    }
    if (orderType === "limit") {
      if (!limitPrice) return toast({ title: "Enter limit price", variant: "destructive" });
      payload.limit_price = parseFloat(limitPrice);
    }
    orderMutation.mutate(payload);
  }

  const allAssets: any[] = assetsData?.assets || [];
  const assetOptions = allAssets.length > 0
    ? allAssets.slice(0, 50)
    : POPULAR_CRYPTO.map(c => ({ symbol: c.symbol, name: c.name }));

  const selectedCrypto = POPULAR_CRYPTO.find(c => c.symbol === symbol);

  return (
    <div className="space-y-4">
      <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950/20">
        <Info className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-700 dark:text-blue-300 text-xs">
          <strong>India / LRS note:</strong> Crypto trading via Alpaca US brokerage is treated as a foreign investment under LRS (₹7L/yr cap, TCS 20% above ₹7L). These are crypto assets held in your US brokerage account — not Indian crypto exchanges. FEMA compliance applies. Gains are taxable in India as per IT Act.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Order Form */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Bitcoin className="h-4 w-4 text-orange-500" />
              Place Crypto Order
            </CardTitle>
            <CardDescription className="text-xs">
              Trade crypto 24/7 via Alpaca Broker API
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Symbol */}
            <div className="space-y-1">
              <Label className="text-xs">Symbol</Label>
              <Select value={symbol} onValueChange={setSymbol}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {POPULAR_CRYPTO.map(c => (
                    <SelectItem key={c.symbol} value={c.symbol} className="text-xs">
                      <span className="font-mono mr-2">{c.icon}</span>
                      {c.symbol} — {c.name}
                    </SelectItem>
                  ))}
                  {loadingAssets ? null : allAssets
                    .filter(a => !POPULAR_CRYPTO.find(p => p.symbol === a.symbol))
                    .slice(0, 20)
                    .map((a: any) => (
                      <SelectItem key={a.symbol} value={a.symbol} className="text-xs">
                        {a.symbol}
                      </SelectItem>
                    ))
                  }
                </SelectContent>
              </Select>
            </div>

            {/* Side */}
            <div className="grid grid-cols-2 gap-2">
              <Button
                size="sm"
                variant={side === "buy" ? "default" : "outline"}
                onClick={() => setSide("buy")}
                className={side === "buy" ? "bg-green-600 hover:bg-green-700 text-xs" : "text-xs"}
              >
                <ArrowUpCircle className="h-3 w-3 mr-1" /> Buy
              </Button>
              <Button
                size="sm"
                variant={side === "sell" ? "default" : "outline"}
                onClick={() => setSide("sell")}
                className={side === "sell" ? "bg-red-600 hover:bg-red-700 text-xs" : "text-xs"}
              >
                <ArrowDownCircle className="h-3 w-3 mr-1" /> Sell
              </Button>
            </div>

            {/* Order Type */}
            <div className="grid grid-cols-2 gap-2">
              <Button
                size="sm"
                variant={orderType === "market" ? "secondary" : "outline"}
                onClick={() => setOrderType("market")}
                className="text-xs"
              >
                Market
              </Button>
              <Button
                size="sm"
                variant={orderType === "limit" ? "secondary" : "outline"}
                onClick={() => setOrderType("limit")}
                className="text-xs"
              >
                Limit
              </Button>
            </div>

            {/* Qty Mode */}
            <div className="grid grid-cols-2 gap-2">
              <Button
                size="sm"
                variant={qtyMode === "notional" ? "secondary" : "outline"}
                onClick={() => setQtyMode("notional")}
                className="text-xs"
              >
                By USD Amount
              </Button>
              <Button
                size="sm"
                variant={qtyMode === "qty" ? "secondary" : "outline"}
                onClick={() => setQtyMode("qty")}
                className="text-xs"
              >
                By Quantity
              </Button>
            </div>

            {/* Amount / Qty */}
            {qtyMode === "notional" ? (
              <div className="space-y-1">
                <Label className="text-xs">USD Amount ($)</Label>
                <Input
                  type="number"
                  value={notional}
                  onChange={e => setNotional(e.target.value)}
                  placeholder="e.g. 100"
                  className="h-8 text-xs"
                  min="1"
                />
              </div>
            ) : (
              <div className="space-y-1">
                <Label className="text-xs">Quantity</Label>
                <Input
                  type="number"
                  value={qty}
                  onChange={e => setQty(e.target.value)}
                  placeholder="e.g. 0.001"
                  className="h-8 text-xs"
                  step="any"
                />
              </div>
            )}

            {/* Limit Price */}
            {orderType === "limit" && (
              <div className="space-y-1">
                <Label className="text-xs">Limit Price (USD)</Label>
                <Input
                  type="number"
                  value={limitPrice}
                  onChange={e => setLimitPrice(e.target.value)}
                  placeholder="e.g. 65000"
                  className="h-8 text-xs"
                  step="any"
                />
              </div>
            )}

            <Button
              className="w-full text-xs"
              size="sm"
              onClick={handleOrder}
              disabled={orderMutation.isPending}
              variant={side === "buy" ? "default" : "destructive"}
            >
              {orderMutation.isPending ? (
                <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
              ) : side === "buy" ? (
                <ArrowUpCircle className="h-3 w-3 mr-1" />
              ) : (
                <ArrowDownCircle className="h-3 w-3 mr-1" />
              )}
              {orderMutation.isPending ? "Submitting…" : `${side === "buy" ? "Buy" : "Sell"} ${selectedCrypto?.name || symbol}`}
            </Button>
          </CardContent>
        </Card>

        {/* Market Info */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Zap className="h-4 w-4 text-yellow-500" />
              Supported Crypto Assets
            </CardTitle>
            <CardDescription className="text-xs">
              Alpaca supports {loadingAssets ? "…" : (allAssets.length || POPULAR_CRYPTO.length)}+ crypto pairs — 24/7 trading
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2">
              {POPULAR_CRYPTO.map(c => (
                <button
                  key={c.symbol}
                  onClick={() => setSymbol(c.symbol)}
                  className={`text-left px-2 py-1.5 rounded border text-xs transition-colors ${
                    symbol === c.symbol
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:border-primary/50 hover:bg-muted"
                  }`}
                >
                  <span className="font-mono text-sm mr-1">{c.icon}</span>
                  <span className="font-medium">{c.symbol.replace("/USD", "")}</span>
                  <div className="text-muted-foreground text-[10px]">{c.name}</div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Crypto Positions */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm flex items-center gap-2">
              <Bitcoin className="h-4 w-4 text-orange-500" />
              Crypto Positions
            </CardTitle>
            <CardDescription className="text-xs">Current holdings in your US account</CardDescription>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => refetchPositions()}
            className="h-7 px-2"
          >
            <RefreshCw className="h-3 w-3" />
          </Button>
        </CardHeader>
        <CardContent>
          {loadingPositions ? (
            <div className="py-6 text-center text-xs text-muted-foreground">Loading positions…</div>
          ) : positions.length === 0 ? (
            <div className="py-6 text-center text-xs text-muted-foreground">
              No crypto positions. Place your first order above.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Symbol</TableHead>
                  <TableHead className="text-xs text-right">Quantity</TableHead>
                  <TableHead className="text-xs text-right">Avg Price</TableHead>
                  <TableHead className="text-xs text-right">Market Value</TableHead>
                  <TableHead className="text-xs text-right">P&L</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {positions.map(pos => {
                  const pl = parseFloat(pos.unrealized_pl);
                  const plPct = parseFloat(pos.unrealized_plpc) * 100;
                  const isPos = pl >= 0;
                  return (
                    <TableRow key={pos.symbol}>
                      <TableCell className="text-xs font-medium">{pos.symbol}</TableCell>
                      <TableCell className="text-xs text-right font-mono">{fmtQty(pos.qty)}</TableCell>
                      <TableCell className="text-xs text-right">{fmtUSD(pos.avg_entry_price)}</TableCell>
                      <TableCell className="text-xs text-right font-medium">{fmtUSD(pos.market_value)}</TableCell>
                      <TableCell className="text-xs text-right">
                        <span className={isPos ? "text-green-600" : "text-red-600"}>
                          {isPos ? "+" : ""}{fmtUSD(pos.unrealized_pl)}
                          <span className="text-[10px] ml-1">({isPos ? "+" : ""}{plPct.toFixed(2)}%)</span>
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
