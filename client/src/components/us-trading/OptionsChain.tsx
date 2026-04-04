/**
 * Options Chain Browser
 * Browse call/put option contracts, filter by expiry + strike, place orders.
 */
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RefreshCw, TrendingUp, TrendingDown, Search, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { AlpacaOptionContract } from "@/components/us-trading/types";

function formatExpiry(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" });
}

interface OptionsChainProps {
  defaultSymbol?: string;
}

export default function OptionsChain({ defaultSymbol = "AAPL" }: OptionsChainProps) {
  const { toast } = useToast();
  const [underlying, setUnderlying] = useState(defaultSymbol);
  const [searchInput, setSearchInput] = useState(defaultSymbol);
  const [expiryFilter, setExpiryFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState<"" | "call" | "put">("");
  const [orderOpen, setOrderOpen] = useState(false);
  const [selectedContract, setSelectedContract] = useState<any>(null);
  const [orderSide, setOrderSide] = useState<"buy" | "sell">("buy");
  const [orderQty, setOrderQty] = useState("1");
  const [orderType, setOrderType] = useState("market");
  const [limitPrice, setLimitPrice] = useState("");

  const { data, isLoading, refetch } = useQuery<{ success: boolean; contracts: AlpacaOptionContract[] }>({
    queryKey: ["/api/us-trading/options/contracts", underlying, expiryFilter, typeFilter],
    queryFn: () => {
      const params = new URLSearchParams({ symbol: underlying, limit: "100" });
      if (expiryFilter) params.set("expiry_from", expiryFilter);
      if (typeFilter) params.set("type", typeFilter);
      return fetch(`/api/us-trading/options/contracts?${params}`).then(r => r.json());
    },
    enabled: underlying.length >= 1,
    staleTime: 30_000,
  });

  const orderMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/us-trading/orders", {
      symbol: selectedContract?.symbol,
      side: orderSide,
      type: orderType,
      time_in_force: "day",
      quantity: parseFloat(orderQty),
      limitPrice: orderType === "limit" ? parseFloat(limitPrice) : undefined,
    }),
    onSuccess: () => {
      toast({ title: "Options order placed!", description: `${orderSide.toUpperCase()} ${orderQty}x ${selectedContract?.symbol}` });
      queryClient.invalidateQueries({ queryKey: ["/api/us-trading/orders"] });
      setOrderOpen(false);
    },
    onError: (e: any) => toast({ title: "Order failed", description: e.message, variant: "destructive" }),
  });

  const contracts = data?.contracts ?? [];
  const calls = contracts.filter(c => c.type === "call");
  const puts = contracts.filter(c => c.type === "put");
  const expiries = [...new Set(contracts.map(c => c.expiration_date))].sort();

  function openOrder(contract: any, side: "buy" | "sell") {
    setSelectedContract(contract);
    setOrderSide(side);
    setOrderOpen(true);
  }

  function ContractRow({ contract, side }: { contract: AlpacaOptionContract; side: "call" | "put" }) {
    return (
      <TableRow key={contract.id} className={`text-xs ${!contract.tradable ? "opacity-40" : ""}`}>
        <TableCell className="font-mono">{contract.strike_price}</TableCell>
        <TableCell className="font-mono text-muted-foreground">{formatExpiry(contract.expiration_date)}</TableCell>
        <TableCell>{contract.close_price ? `$${parseFloat(contract.close_price).toFixed(2)}` : "—"}</TableCell>
        <TableCell>{contract.open_interest || "—"}</TableCell>
        <TableCell>
          <Badge variant="outline" className={side === "call" ? "text-green-700 border-green-300 text-xs" : "text-red-700 border-red-300 text-xs"}>
            {side.toUpperCase()}
          </Badge>
        </TableCell>
        <TableCell>
          {contract.tradable && (
            <div className="flex gap-1">
              <Button size="sm" className="h-6 px-2 text-xs bg-green-600 hover:bg-green-700" onClick={() => openOrder(contract, "buy")}>Buy</Button>
              <Button size="sm" variant="outline" className="h-6 px-2 text-xs text-red-600 border-red-300 hover:bg-red-50" onClick={() => openOrder(contract, "sell")}>Sell</Button>
            </div>
          )}
        </TableCell>
      </TableRow>
    );
  }

  return (
    <div className="space-y-4">
      <Alert className="border-purple-200 bg-purple-50 dark:bg-purple-950/20">
        <AlertTriangle className="h-4 w-4 text-purple-600" />
        <AlertDescription className="text-sm text-purple-700 dark:text-purple-300">
          <strong>Options Risk Disclosure:</strong> Options trading involves significant risk. Options may expire worthless. Ensure your account has been approved for options trading (Level 1–3). Per FINRA Rule 2360.
        </AlertDescription>
      </Alert>

      {/* Search / Filters */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex gap-3 items-end flex-wrap">
            <div>
              <Label className="text-xs">Underlying Symbol</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  value={searchInput}
                  onChange={e => setSearchInput(e.target.value.toUpperCase())}
                  onKeyDown={e => e.key === "Enter" && setUnderlying(searchInput)}
                  placeholder="AAPL"
                  className="h-8 w-28 font-mono text-sm uppercase"
                />
                <Button size="sm" className="h-8 gap-1" onClick={() => setUnderlying(searchInput)}>
                  <Search className="h-3.5 w-3.5" /> Search
                </Button>
              </div>
            </div>
            <div>
              <Label className="text-xs">Option Type</Label>
              <Select value={typeFilter || "all"} onValueChange={(v) => setTypeFilter(v === "all" ? "" : v as any)}>
                <SelectTrigger className="h-8 text-xs w-24 mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="call">Calls</SelectItem>
                  <SelectItem value="put">Puts</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Expiry</Label>
              <Select value={expiryFilter || "all"} onValueChange={(v) => setExpiryFilter(v === "all" ? "" : v)}>
                <SelectTrigger className="h-8 text-xs w-36 mt-1"><SelectValue placeholder="All expiries" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All expiries</SelectItem>
                  {expiries.map(e => <SelectItem key={e} value={e}>{formatExpiry(e)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button variant="ghost" size="sm" className="h-8 gap-1" onClick={() => refetch()}>
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Options Table */}
      {isLoading ? (
        <div className="space-y-2">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-8" />)}</div>
      ) : contracts.length === 0 ? (
        <div className="text-center py-12 text-sm text-muted-foreground">
          No option contracts found for <strong>{underlying}</strong>. Try a different symbol or expiry filter.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Calls */}
          {(typeFilter === "" || typeFilter === "call") && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2 text-green-700">
                  <TrendingUp className="h-4 w-4" /> Calls ({calls.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Strike</TableHead>
                      <TableHead className="text-xs">Expiry</TableHead>
                      <TableHead className="text-xs">Last</TableHead>
                      <TableHead className="text-xs">OI</TableHead>
                      <TableHead className="text-xs">Type</TableHead>
                      <TableHead className="text-xs"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {calls.slice(0, 50).map(c => <ContractRow key={c.id} contract={c} side="call" />)}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Puts */}
          {(typeFilter === "" || typeFilter === "put") && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2 text-red-700">
                  <TrendingDown className="h-4 w-4" /> Puts ({puts.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Strike</TableHead>
                      <TableHead className="text-xs">Expiry</TableHead>
                      <TableHead className="text-xs">Last</TableHead>
                      <TableHead className="text-xs">OI</TableHead>
                      <TableHead className="text-xs">Type</TableHead>
                      <TableHead className="text-xs"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {puts.slice(0, 50).map(c => <ContractRow key={c.id} contract={c} side="put" />)}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Place Options Order Dialog */}
      <Dialog open={orderOpen} onOpenChange={setOrderOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">
              {orderSide === "buy" ? "Buy" : "Sell"} Option — {selectedContract?.symbol}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 text-sm">
            <div className="rounded-lg bg-muted/40 p-3 text-xs space-y-1">
              <div className="flex justify-between"><span className="text-muted-foreground">Contract</span><span className="font-mono">{selectedContract?.symbol}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Type</span><span className="capitalize">{selectedContract?.type}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Strike</span><span>${selectedContract?.strike_price}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Expiry</span><span>{selectedContract ? formatExpiry(selectedContract.expiration_date) : "—"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Last Price</span><span>{selectedContract?.close_price ? `$${parseFloat(selectedContract.close_price).toFixed(2)}` : "—"}</span></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Contracts (qty)</Label>
                <Input type="number" value={orderQty} onChange={e => setOrderQty(e.target.value)} className="h-8 text-sm mt-1" min="1" />
              </div>
              <div>
                <Label className="text-xs">Order Type</Label>
                <Select value={orderType} onValueChange={setOrderType}>
                  <SelectTrigger className="h-8 text-sm mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="market">Market</SelectItem>
                    <SelectItem value="limit">Limit</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {orderType === "limit" && (
              <div>
                <Label className="text-xs">Limit Price (per contract)</Label>
                <Input type="number" value={limitPrice} onChange={e => setLimitPrice(e.target.value)} className="h-8 text-sm mt-1" step="0.01" />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOrderOpen(false)}>Cancel</Button>
            <Button
              onClick={() => orderMutation.mutate()}
              disabled={orderMutation.isPending}
              className={orderSide === "buy" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}
            >
              {orderMutation.isPending ? "Placing…" : `${orderSide === "buy" ? "Buy" : "Sell"} ${orderQty} Contract${parseInt(orderQty) !== 1 ? "s" : ""}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
