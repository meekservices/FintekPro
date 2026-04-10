/**
 * Enhanced Order Form
 * Adds: notional "Invest ₹X" flow (INR→USD), extended hours toggle,
 * trailing stop type, short selling, live market clock, PDT warning,
 * fractionability notice, W-8BEN / LRS / wash sale disclosures.
 */
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  TrendingUp, TrendingDown, Clock, Moon, AlertTriangle, RefreshCw,
  BadgeIndianRupee, DollarSign, Info, CheckCircle2, XCircle, Zap,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useKycGuard } from "@/hooks/use-kyc-guard";
import { KycGuardModal } from "@/components/kyc/KycGuardModal";

interface EnhancedOrderFormProps {
  defaultSymbol?: string;
  onSuccess?: () => void;
}

const ORDER_TYPES = [
  { value: "market", label: "Market" },
  { value: "limit", label: "Limit" },
  { value: "stop", label: "Stop" },
  { value: "stop_limit", label: "Stop Limit" },
  { value: "trailing_stop", label: "Trailing Stop" },
];

const TIF_OPTIONS = [
  { value: "day", label: "Day" },
  { value: "gtc", label: "GTC (Good Till Cancelled)" },
  { value: "ioc", label: "IOC (Immediate or Cancel)" },
  { value: "fok", label: "FOK (Fill or Kill)" },
  { value: "opg", label: "OPG (Opening)" },
  { value: "cls", label: "CLS (Closing)" },
];

export default function EnhancedOrderForm({ defaultSymbol = "", onSuccess }: EnhancedOrderFormProps) {
  const { toast } = useToast();
  const { guardAction, isChecking, modalState, closeModal, proceedToKyc } = useKycGuard();
  const [symbol, setSymbol] = useState(defaultSymbol);
  const [side, setSide] = useState<"buy" | "sell" | "sell_short">("buy");
  const [orderType, setOrderType] = useState("market");
  const [tif, setTif] = useState("day");
  const [qtyMode, setQtyMode] = useState<"shares" | "notional_usd" | "notional_inr">("shares");
  const [qty, setQty] = useState("");
  const [limitPrice, setLimitPrice] = useState("");
  const [stopPrice, setStopPrice] = useState("");
  const [trailBy, setTrailBy] = useState<"price" | "percent">("percent");
  const [trailValue, setTrailValue] = useState("");
  const [extendedHours, setExtendedHours] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [inrAmount, setInrAmount] = useState("");

  // Live FX rate for INR→USD conversion
  const { data: fxData } = useQuery<{ rate: number; source: string }>({
    queryKey: ["/api/us-trading/market/fx-rate"],
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
  const fxRate = fxData?.rate ?? 83.5;

  // Live market clock — open/closed/pre-market/after-hours
  const { data: clockData } = useQuery<{
    success: boolean; is_open: boolean; next_open: string; next_close: string; timestamp: string;
  }>({
    queryKey: ["/api/us-trading/market/clock"],
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
  const isMarketOpen = clockData?.is_open ?? false;

  // Detect pre-market / after-hours window for extended hours relevance
  const etHour = clockData?.timestamp
    ? new Date(new Date(clockData.timestamp).toLocaleString("en-US", { timeZone: "America/New_York" })).getHours()
    : -1;
  const isPreMarket   = etHour >= 4  && etHour < 9;
  const isAfterHours  = etHour >= 16 && etHour < 20;
  const isExtendedWindow = isPreMarket || isAfterHours;

  // Live quote
  const { data: quoteData, isLoading: quoteLoading } = useQuery<{
    success: boolean;
    quote: { price: number; bid: number; ask: number; symbol: string };
  }>({
    queryKey: ["/api/us-trading/market/quote", symbol.toUpperCase()],
    queryFn: () => fetch(`/api/us-trading/market/quote/${symbol.toUpperCase()}`).then(r => r.json()),
    enabled: symbol.length >= 1,
    staleTime: 15_000,
    refetchInterval: 15_000,
  });

  const livePrice = quoteData?.quote?.price ?? 0;

  // Account info — PDT flag and equity check
  const { data: accountData } = useQuery<{
    success: boolean;
    account: { pattern_day_trader: boolean; equity: string; daytrade_count: number };
  }>({
    queryKey: ["/api/us-trading/account/details"],
    staleTime: 120_000,
  });
  const isPdt        = accountData?.account?.pattern_day_trader ?? false;
  const equity       = parseFloat(accountData?.account?.equity ?? "0");
  const daytradeCount = accountData?.account?.daytrade_count ?? 0;
  const pdtRisk      = isPdt && equity < 25_000;

  // Compute preview values
  const notionalUsd = qtyMode === "notional_inr"
    ? parseFloat(inrAmount || "0") / fxRate
    : qtyMode === "notional_usd"
    ? parseFloat(qty || "0")
    : parseFloat(qty || "0") * livePrice;

  const notionalInr = notionalUsd * fxRate;

  const orderMutation = useMutation({
    mutationFn: () => {
      const payload: any = {
        symbol: symbol.toUpperCase(),
        side,
        type: orderType,
        time_in_force: tif,
        extended_hours: extendedHours || undefined,
      };

      if (qtyMode === "shares") {
        payload.quantity = parseFloat(qty);
      } else if (qtyMode === "notional_usd") {
        payload.notionalUsd = parseFloat(qty);
      } else {
        payload.notionalUsd = parseFloat(inrAmount) / fxRate;
      }

      if (orderType === "limit" || orderType === "stop_limit") payload.limitPrice = parseFloat(limitPrice);
      if (orderType === "stop" || orderType === "stop_limit") payload.stopPrice = parseFloat(stopPrice);
      if (orderType === "trailing_stop") {
        if (trailBy === "price") payload.trailPrice = parseFloat(trailValue);
        else payload.trailPercent = parseFloat(trailValue);
      }

      return apiRequest("POST", "/api/us-trading/orders", payload);
    },
    onSuccess: () => {
      toast({ title: "Order placed!", description: `${side.replace("_", " ").toUpperCase()} ${symbol.toUpperCase()} order submitted` });
      queryClient.invalidateQueries({ queryKey: ["/api/us-trading/orders"] });
      onSuccess?.();
    },
    onError: (e: any) => toast({ title: "Order failed", description: e.message, variant: "destructive" }),
  });

  const canSubmit = symbol.length >= 1 && (
    qtyMode === "notional_inr" ? parseFloat(inrAmount) > 0 : parseFloat(qty) > 0
  );

  return (
    <>
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2 flex-wrap">
          Place Order
          {/* Live market status */}
          {clockData && (
            isMarketOpen
              ? <Badge className="bg-green-100 text-green-700 text-xs gap-1"><CheckCircle2 className="h-3 w-3" /> Market Open</Badge>
              : isExtendedWindow
              ? <Badge className="bg-indigo-100 text-indigo-700 text-xs gap-1"><Zap className="h-3 w-3" /> {isPreMarket ? "Pre-Market" : "After-Hours"}</Badge>
              : <Badge className="bg-gray-100 text-gray-600 text-xs gap-1"><XCircle className="h-3 w-3" /> Market Closed</Badge>
          )}
          {extendedHours && <Badge className="bg-indigo-100 text-indigo-700 text-xs gap-1"><Moon className="h-3 w-3" /> Extended Hours On</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* PDT Warning — shown before the user places an order */}
        {pdtRisk && (
          <Alert className="border-red-200 bg-red-50 dark:bg-red-950/20">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-sm text-red-700 dark:text-red-300">
              <strong>Pattern Day Trader (PDT) Restriction:</strong> Your account is flagged as a PDT and equity (${equity.toLocaleString()}) is below $25,000 — the FINRA minimum. Day trades will be rejected until equity is restored. Use GTC orders or consider adding funds. Day trades this week: {daytradeCount}/4.
            </AlertDescription>
          </Alert>
        )}
        {isPdt && !pdtRisk && (
          <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 py-2">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
            <AlertDescription className="text-xs text-amber-700">
              <strong>PDT Account:</strong> Your account is flagged as a Pattern Day Trader. You can place unlimited day trades since equity exceeds $25,000. Day trades this week: {daytradeCount}.
            </AlertDescription>
          </Alert>
        )}
        {/* Symbol */}
        <div>
          <Label className="text-xs">Symbol</Label>
          <div className="flex gap-2 mt-1">
            <Input
              value={symbol}
              onChange={e => setSymbol(e.target.value.toUpperCase())}
              placeholder="AAPL"
              className="h-9 font-mono uppercase"
            />
            {quoteLoading && <RefreshCw className="h-4 w-4 mt-2.5 animate-spin text-muted-foreground" />}
            {livePrice > 0 && (
              <div className="flex items-center text-sm font-medium text-green-600 whitespace-nowrap">
                ${livePrice.toFixed(2)}
              </div>
            )}
          </div>
        </div>

        {/* Buy / Sell / Short */}
        <div>
          <Label className="text-xs mb-1 block">Side</Label>
          <div className="flex gap-2">
            {(["buy", "sell", "sell_short"] as const).map(s => (
              <Button
                key={s}
                size="sm"
                variant={side === s ? "default" : "outline"}
                className={`flex-1 gap-1.5 ${
                  side === s && s === "buy" ? "bg-green-600 hover:bg-green-700" :
                  side === s && s !== "buy" ? "bg-red-600 hover:bg-red-700" : ""
                }`}
                onClick={() => setSide(s)}
              >
                {s === "buy" ? <TrendingUp className="h-3.5 w-3.5" /> :
                 s === "sell" ? <TrendingDown className="h-3.5 w-3.5" /> :
                 <TrendingDown className="h-3.5 w-3.5 opacity-70" />}
                {s === "sell_short" ? "Short" : s.charAt(0).toUpperCase() + s.slice(1)}
              </Button>
            ))}
          </div>
        </div>

        {/* Order Type */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Order Type</Label>
            <Select value={orderType} onValueChange={setOrderType}>
              <SelectTrigger className="h-9 text-sm mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ORDER_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Time in Force</Label>
            <Select value={tif} onValueChange={setTif}>
              <SelectTrigger className="h-9 text-sm mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIF_OPTIONS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Quantity Mode */}
        <div>
          <Label className="text-xs mb-1 block">Quantity Mode</Label>
          <Tabs value={qtyMode} onValueChange={(v: any) => setQtyMode(v)}>
            <TabsList className="h-8 w-full">
              <TabsTrigger value="shares" className="flex-1 text-xs">Shares</TabsTrigger>
              <TabsTrigger value="notional_usd" className="flex-1 text-xs gap-1"><DollarSign className="h-3 w-3" />USD Amount</TabsTrigger>
              <TabsTrigger value="notional_inr" className="flex-1 text-xs gap-1"><BadgeIndianRupee className="h-3 w-3" />₹ Amount</TabsTrigger>
            </TabsList>
            <TabsContent value="shares" className="mt-2">
              <Input type="number" value={qty} onChange={e => setQty(e.target.value)}
                placeholder="e.g. 10 shares" className="h-9 text-sm" min="0.000001" step="any" />
              {qty && parseFloat(qty) > 0 && parseFloat(qty) < 1 && (
                <p className="text-xs text-amber-600 mt-1">
                  Fractional quantity — asset must be fractionable. Only market orders with time_in_force=day are supported.
                </p>
              )}
            </TabsContent>
            <TabsContent value="notional_usd" className="mt-2">
              <div className="relative">
                <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input type="number" value={qty} onChange={e => setQty(e.target.value)}
                  placeholder="e.g. 500.00" className="h-9 text-sm pl-8" min="1" step="any" />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Notional orders require the asset to be fractionable. Market orders only. Min $1.
              </p>
            </TabsContent>
            <TabsContent value="notional_inr" className="mt-2">
              <div className="relative">
                <BadgeIndianRupee className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input type="number" value={inrAmount} onChange={e => setInrAmount(e.target.value)}
                  placeholder="e.g. 50000" className="h-9 text-sm pl-8" min="1" step="any" />
              </div>
              {inrAmount && (
                <p className="text-xs text-muted-foreground mt-1">
                  ≈ ${(parseFloat(inrAmount) / fxRate).toFixed(2)} at ₹{fxRate.toFixed(2)}/USD · Notional = fractionable assets only
                </p>
              )}
            </TabsContent>
          </Tabs>
        </div>

        {/* Conditional price fields */}
        {(orderType === "limit" || orderType === "stop_limit") && (
          <div>
            <Label className="text-xs">Limit Price (USD)</Label>
            <Input type="number" value={limitPrice} onChange={e => setLimitPrice(e.target.value)}
              placeholder={livePrice ? `~$${livePrice.toFixed(2)}` : "0.00"} className="h-9 text-sm mt-1" step="0.01" />
          </div>
        )}
        {(orderType === "stop" || orderType === "stop_limit") && (
          <div>
            <Label className="text-xs">Stop Price (USD)</Label>
            <Input type="number" value={stopPrice} onChange={e => setStopPrice(e.target.value)}
              placeholder="0.00" className="h-9 text-sm mt-1" step="0.01" />
          </div>
        )}
        {orderType === "trailing_stop" && (
          <div className="space-y-2">
            <Label className="text-xs">Trail By</Label>
            <div className="flex gap-2">
              <Button size="sm" variant={trailBy === "percent" ? "default" : "outline"} className="h-8 text-xs"
                onClick={() => setTrailBy("percent")}>% Percent</Button>
              <Button size="sm" variant={trailBy === "price" ? "default" : "outline"} className="h-8 text-xs"
                onClick={() => setTrailBy("price")}>$ Price</Button>
            </div>
            <Input type="number" value={trailValue} onChange={e => setTrailValue(e.target.value)}
              placeholder={trailBy === "percent" ? "e.g. 5 (= 5%)" : "e.g. 2.50 (= $2.50)"}
              className="h-9 text-sm" step={trailBy === "percent" ? "0.1" : "0.01"} />
          </div>
        )}

        {/* Extended Hours */}
        <div className="flex items-center justify-between rounded-lg border px-3 py-2">
          <div>
            <div className="flex items-center gap-1.5 text-sm font-medium">
              <Clock className="h-3.5 w-3.5 text-indigo-500" /> Extended Hours Trading
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">Pre-market (4–9:30 AM ET) &amp; after-hours (4–8 PM ET)</p>
          </div>
          <Switch checked={extendedHours} onCheckedChange={setExtendedHours} />
        </div>
        {extendedHours && (
          <Alert className="border-amber-200 bg-amber-50/50 py-2">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
            <AlertDescription className="text-xs text-amber-700 space-y-0.5">
              <p><strong>Extended Hours Risk Disclosure (Alpaca):</strong></p>
              <p>Overnight 8 PM–4 AM ET · Pre-market 4–9:30 AM ET · After-hours 4–8 PM ET. Lower liquidity, wider bid-ask spreads, and higher price volatility than regular hours. Only limit orders accepted. Fractional orders are also supported during extended hours. By enabling this, you acknowledge Alpaca's Extended Hours Trading Risk Disclosure.</p>
            </AlertDescription>
          </Alert>
        )}

        {/* Order preview */}
        {canSubmit && (
          <div className="rounded-lg bg-muted/40 px-3 py-2.5 text-xs space-y-1">
            <div className="font-medium text-sm mb-1">Order Preview</div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Symbol</span>
              <span className="font-mono font-medium">{symbol.toUpperCase()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Side</span>
              <span className={`font-medium ${side === "buy" ? "text-green-600" : "text-red-600"}`}>
                {side.replace("_", " ").toUpperCase()}
              </span>
            </div>
            {notionalUsd > 0 && (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Est. USD Value</span>
                  <span className="font-medium">${notionalUsd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Est. INR Value</span>
                  <span className="font-medium">₹{notionalInr.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</span>
                </div>
              </>
            )}
          </div>
        )}

        {/* Wash Sale Warning (US IRC §1091) */}
        {side === "buy" && (
          <Alert className="border-blue-200 bg-blue-50/50 py-2">
            <Info className="h-3.5 w-3.5 text-blue-600" />
            <AlertDescription className="text-xs text-blue-700">
              <strong>Wash Sale Rule (US IRC §1091):</strong> Buying a substantially identical security within 30 days before/after a loss sale disallows the capital loss. Consult your tax advisor before placing this order. As an Indian resident, corresponding DTAA treatment may apply.
            </AlertDescription>
          </Alert>
        )}

        {/* Schedule FA Reminder */}
        <Alert className="border-violet-200 bg-violet-50/50 py-2">
          <Info className="h-3.5 w-3.5 text-violet-600" />
          <AlertDescription className="text-xs text-violet-700">
            <strong>ITR Disclosure:</strong> Gains/losses from US equities are taxable in India as capital gains. Report foreign assets in <strong>Schedule FA</strong> and foreign income in <strong>Schedule FSI</strong> of ITR-2/ITR-3. TCS deducted by your AD bank (20% above ₹7 lakh/FY) is creditable against tax liability.
          </AlertDescription>
        </Alert>

        <Button
          className="w-full"
          onClick={() => guardAction("us_equity", () => orderMutation.mutate())}
          disabled={!canSubmit || orderMutation.isPending || isChecking}
        >
          {orderMutation.isPending || isChecking ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : null}
          {isChecking ? "Checking KYC..." : side === "buy" ? "Place Buy Order" : side === "sell" ? "Place Sell Order" : "Place Short Order"}
        </Button>
      </CardContent>
    </Card>

    <KycGuardModal
      open={modalState.open}
      checkResult={modalState.checkResult}
      onClose={closeModal}
      onProceedToKyc={() => proceedToKyc()}
    />
    </>
  );
}
