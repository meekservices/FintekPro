/**
 * Tax Lots Panel
 * Shows individual tax lots (purchase tranches) for each position.
 * Enables India investors to identify LTCG vs STCG treatment and plan tax-efficient exits.
 *
 * India Tax Context:
 * - US equities are treated as foreign assets → Schedule FA (ITR-2/3)
 * - Holding > 24 months = Long-Term Capital Gain (20% + cess with indexation under Section 112)
 * - Holding ≤ 24 months = Short-Term Capital Gain (taxed at slab rate)
 * - US tax: >1 year = LTCG (15% federal); ≤1 year = STCG (ordinary income rates)
 * - DTAA India–US: claim Foreign Tax Credit on Schedule FSI to avoid double-taxation
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { RefreshCw, ChevronDown, ChevronRight, Info, TrendingUp, TrendingDown, Calculator } from "lucide-react";

interface TaxLot {
  id?: string;
  symbol?: string;
  qty: number;
  price: number;
  cost_basis: number;
  purchase_date: string;
  current_price?: number;
  unrealized_pl?: number;
  unrealized_plpc?: number;
}

interface PositionTaxLots {
  symbol: string;
  lots: TaxLot[];
  total_qty: number;
  total_cost: number;
  current_value?: number;
  unrealized_pl?: number;
}

function holdingDays(purchaseDate: string): number {
  return Math.floor((Date.now() - new Date(purchaseDate).getTime()) / 86_400_000);
}

function isLtcgIndia(purchaseDate: string): boolean {
  return holdingDays(purchaseDate) > 730; // >24 months for India
}

function isLtcgUs(purchaseDate: string): boolean {
  return holdingDays(purchaseDate) > 365; // >12 months for US
}

function TaxTypeBadge({ purchaseDate }: { purchaseDate: string }) {
  const indiaLt = isLtcgIndia(purchaseDate);
  const usLt = isLtcgUs(purchaseDate);
  const days = holdingDays(purchaseDate);
  const years = (days / 365).toFixed(1);

  if (indiaLt) {
    return (
      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 font-medium">
        LTCG 🇮🇳🇺🇸 ({years}y)
      </span>
    );
  }
  if (usLt) {
    return (
      <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 font-medium">
        LTCG 🇺🇸 / STCG 🇮🇳 ({years}y)
      </span>
    );
  }
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 font-medium">
      STCG 🇮🇳🇺🇸 ({years}y)
    </span>
  );
}

function formatUsd(v: number | undefined) {
  if (v == null) return "—";
  const abs = Math.abs(v);
  const sign = v < 0 ? "-" : "+";
  return `${sign}$${abs.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

interface TaxLotsPanelProps {
  accountId?: string;
}

export default function TaxLotsPanel({ accountId }: TaxLotsPanelProps) {
  const [expandedSymbols, setExpandedSymbols] = useState<Set<string>>(new Set());

  const { data, isLoading, refetch, isFetching } = useQuery<{
    success: boolean;
    tax_lots: PositionTaxLots[] | TaxLot[];
  }>({
    queryKey: ["/api/us-trading/broker/accounts", accountId, "positions/tax-lots"],
    queryFn: () =>
      fetch(`/api/us-trading/broker/accounts/${accountId}/positions/tax-lots`).then(r => r.json()),
    enabled: !!accountId,
    staleTime: 60_000,
  });

  const toggleSymbol = (symbol: string) => {
    setExpandedSymbols(prev => {
      const next = new Set(prev);
      if (next.has(symbol)) next.delete(symbol);
      else next.add(symbol);
      return next;
    });
  };

  // Normalize: API may return flat array of lots (with symbol field) or grouped array
  const rawLots = data?.tax_lots ?? [];
  const grouped: Record<string, TaxLot[]> = {};
  rawLots.forEach((item: any) => {
    const sym = item.symbol ?? "Unknown";
    if (!grouped[sym]) grouped[sym] = [];
    if (item.lots) {
      item.lots.forEach((l: TaxLot) => grouped[sym].push({ ...l, symbol: sym }));
    } else {
      grouped[sym].push(item as TaxLot);
    }
  });
  const symbols = Object.keys(grouped).sort();

  // Summary totals
  const totalCost = symbols.reduce((sum, s) => sum + grouped[s].reduce((a, l) => a + (l.cost_basis ?? l.price * l.qty), 0), 0);
  const totalPl = symbols.reduce((sum, s) => sum + grouped[s].reduce((a, l) => a + (l.unrealized_pl ?? 0), 0), 0);
  const ltcgLots = symbols.flatMap(s => grouped[s].filter(l => isLtcgIndia(l.purchase_date)));
  const stcgLots = symbols.flatMap(s => grouped[s].filter(l => !isLtcgIndia(l.purchase_date)));

  if (!accountId) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          Account not loaded — open a broker account first
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Header */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Cost Basis", value: `$${totalCost.toLocaleString("en-US", { maximumFractionDigits: 0 })}`, sub: "All lots" },
          { label: "Unrealized P&L", value: formatUsd(totalPl), sub: "All positions", positive: totalPl > 0 },
          { label: "LTCG Lots (India)", value: ltcgLots.length.toString(), sub: "Held >24 months" },
          { label: "STCG Lots (India)", value: stcgLots.length.toString(), sub: "Held ≤24 months" },
        ].map(item => (
          <Card key={item.label} className="p-3">
            <p className="text-xs text-muted-foreground">{item.label}</p>
            <p className={`text-lg font-bold mt-0.5 ${item.positive === true ? "text-emerald-600" : item.positive === false && totalPl < 0 ? "text-red-500" : ""}`}>
              {item.value}
            </p>
            <p className="text-[10px] text-muted-foreground">{item.sub}</p>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Calculator className="h-4 w-4" />
                Position Tax Lots
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Individual purchase lots — showing LTCG/STCG status for India and US tax rules
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isFetching} className="h-8 px-2">
              <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-2">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : symbols.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              No tax lot data available. You may not have any open positions, or the broker does not expose lot-level data for this account type.
            </div>
          ) : (
            <div className="divide-y">
              {symbols.map(symbol => {
                const lots = grouped[symbol];
                const totalQty = lots.reduce((s, l) => s + l.qty, 0);
                const totalCostSym = lots.reduce((s, l) => s + (l.cost_basis ?? l.price * l.qty), 0);
                const totalPlSym = lots.reduce((s, l) => s + (l.unrealized_pl ?? 0), 0);
                const expanded = expandedSymbols.has(symbol);

                return (
                  <Collapsible key={symbol} open={expanded} onOpenChange={() => toggleSymbol(symbol)}>
                    <CollapsibleTrigger className="w-full">
                      <div className="flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors">
                        <div className="flex items-center gap-3">
                          {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                          <span className="font-semibold text-sm">{symbol}</span>
                          <Badge variant="secondary" className="text-[10px] h-4 px-1">
                            {lots.length} {lots.length === 1 ? "lot" : "lots"}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-right">
                          <div>
                            <p className="text-xs text-muted-foreground">Qty</p>
                            <p className="text-sm font-medium">{totalQty}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Cost Basis</p>
                            <p className="text-sm font-medium">${totalCostSym.toLocaleString("en-US", { maximumFractionDigits: 2 })}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Unrealized P&L</p>
                            <p className={`text-sm font-medium ${totalPlSym > 0 ? "text-emerald-600" : totalPlSym < 0 ? "text-red-500" : ""}`}>
                              {formatUsd(totalPlSym)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </CollapsibleTrigger>

                    <CollapsibleContent>
                      <div className="px-4 pb-3 overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-xs">Purchase Date</TableHead>
                              <TableHead className="text-xs">Tax Status</TableHead>
                              <TableHead className="text-xs text-right">Qty</TableHead>
                              <TableHead className="text-xs text-right">Avg Cost</TableHead>
                              <TableHead className="text-xs text-right">Cost Basis</TableHead>
                              <TableHead className="text-xs text-right">Unrealized P&L</TableHead>
                              <TableHead className="text-xs text-right">Days Held</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {lots
                              .sort((a, b) => new Date(a.purchase_date).getTime() - new Date(b.purchase_date).getTime())
                              .map((lot, idx) => {
                                const days = holdingDays(lot.purchase_date);
                                const costBasis = lot.cost_basis ?? lot.price * lot.qty;
                                const avgCost = costBasis / lot.qty;
                                const pl = lot.unrealized_pl ?? 0;
                                return (
                                  <TableRow key={lot.id ?? idx}>
                                    <TableCell className="text-xs py-2">
                                      {new Date(lot.purchase_date).toLocaleDateString("en-IN", {
                                        day: "numeric", month: "short", year: "numeric",
                                      })}
                                    </TableCell>
                                    <TableCell className="text-xs py-2">
                                      <TaxTypeBadge purchaseDate={lot.purchase_date} />
                                    </TableCell>
                                    <TableCell className="text-xs py-2 text-right">{lot.qty}</TableCell>
                                    <TableCell className="text-xs py-2 text-right">
                                      ${avgCost.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                                    </TableCell>
                                    <TableCell className="text-xs py-2 text-right">
                                      ${costBasis.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </TableCell>
                                    <TableCell className={`text-xs py-2 text-right font-medium ${pl > 0 ? "text-emerald-600" : pl < 0 ? "text-red-500" : ""}`}>
                                      {pl !== 0 ? (
                                        <span className="flex items-center justify-end gap-1">
                                          {pl > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                                          {formatUsd(pl)}
                                        </span>
                                      ) : "—"}
                                    </TableCell>
                                    <TableCell className="text-xs py-2 text-right text-muted-foreground">{days}d</TableCell>
                                  </TableRow>
                                );
                              })}
                          </TableBody>
                        </Table>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Alert className="border-blue-200 bg-blue-50/50 py-2">
        <Info className="h-3.5 w-3.5 text-blue-600" />
        <AlertDescription className="text-xs text-blue-700 space-y-0.5">
          <p>
            <strong>India Tax on US Equity (Section 112 / 112A):</strong>{" "}
            Gains from US stocks held <strong>≤24 months</strong> = Short-Term (slab rate, up to 30%).{" "}
            Held <strong>&gt;24 months</strong> = Long-Term (20% with indexation, or 10% without above ₹1L).
          </p>
          <p>
            <strong>US Tax:</strong> ≤1 yr = ordinary income; &gt;1 yr = 0–20% LTCG (based on income bracket).
            Claim credit in India under <strong>India–US DTAA Article 13</strong> via Schedule FSI + Form 67 of ITR.
          </p>
          <p>
            <strong>Tax-Loss Harvesting:</strong> Realising STCG losses before 31 March offsets STCG gains.
            Use specific-lot selection to close high-cost lots first.
          </p>
        </AlertDescription>
      </Alert>
    </div>
  );
}
