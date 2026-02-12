import { AgentLayout } from "@/components/layout/agent-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Filter, Search, Save, Play, TrendingUp, TrendingDown, Percent, IndianRupee, ArrowUpDown, ArrowUp, ArrowDown, Star, BarChart3, RefreshCw, ChevronLeft, ChevronRight, Database, Loader2, Activity } from "lucide-react";
import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type ScreenerType = "mutual_fund" | "stock" | "bond" | "etf";

interface ScreenerCriteria {
  field: string;
  operator: string;
  value: string;
}

type SortDirection = "asc" | "desc" | null;
interface SortConfig {
  key: string;
  direction: SortDirection;
}

function formatNum(val: string | number | null | undefined, decimals = 2): string {
  if (val == null || val === '') return '-';
  const n = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(n)) return '-';
  return n.toFixed(decimals);
}

function formatCurrency(val: string | number | null | undefined): string {
  if (val == null || val === '') return '-';
  const n = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(n)) return '-';
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatMarketCap(val: string | number | null | undefined): string {
  if (val == null || val === '') return '-';
  const n = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(n)) return '-';
  const crores = n / 10000000;
  if (crores >= 100000) return `₹${(crores / 100000).toFixed(1)}L Cr`;
  if (crores >= 1000) return `₹${(crores / 1000).toFixed(1)}K Cr`;
  return `₹${crores.toFixed(0)} Cr`;
}

function RatingStars({ rating }: { rating: number | null }) {
  if (!rating) return <span className="text-muted-foreground">-</span>;
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={`h-3.5 w-3.5 ${i < rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'}`}
        />
      ))}
    </div>
  );
}

function ScoreBadge({ score, label }: { score: string | null; label: string }) {
  if (!score) return null;
  const n = parseFloat(score);
  if (isNaN(n)) return null;
  const color = n >= 70 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
    : n >= 45 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
    : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
  return (
    <div className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${color}`}>
      {n.toFixed(0)}
    </div>
  );
}

export default function AgentScreener() {
  const { toast } = useToast();
  const [screenerType, setScreenerType] = useState<ScreenerType>("stock");
  const [criteria, setCriteria] = useState<ScreenerCriteria[]>([
    { field: "", operator: ">=", value: "" }
  ]);
  const [screenerName, setScreenerName] = useState("");
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: "", direction: null });

  const [dbSearch, setDbSearch] = useState("");
  const [dbSector, setDbSector] = useState("");
  const [dbMarketCap, setDbMarketCap] = useState("");
  const [dbMinPE, setDbMinPE] = useState("");
  const [dbMaxPE, setDbMaxPE] = useState("");
  const [dbMinROE, setDbMinROE] = useState("");
  const [dbMaxDE, setDbMaxDE] = useState("");
  const [dbMinRating, setDbMinRating] = useState("");
  const [dbSortBy, setDbSortBy] = useState("compositeScore");
  const [dbSortOrder, setDbSortOrder] = useState<"asc" | "desc">("desc");
  const [dbPage, setDbPage] = useState(1);
  const dbLimit = 25;

  const buildQueryParams = () => {
    const params = new URLSearchParams();
    params.set('page', String(dbPage));
    params.set('limit', String(dbLimit));
    if (dbSearch) params.set('search', dbSearch);
    if (dbSector) params.set('sector', dbSector);
    if (dbMarketCap) params.set('marketCapCategory', dbMarketCap);
    if (dbMinPE) params.set('minPE', dbMinPE);
    if (dbMaxPE) params.set('maxPE', dbMaxPE);
    if (dbMinROE) params.set('minROE', dbMinROE);
    if (dbMaxDE) params.set('maxDebtToEquity', dbMaxDE);
    if (dbMinRating) params.set('minFintekRating', dbMinRating);
    if (dbSortBy) params.set('sortBy', dbSortBy);
    params.set('sortOrder', dbSortOrder);
    return params.toString();
  };

  const { data: dbScreenerData, isLoading: dbLoading } = useQuery<any>({
    queryKey: ['/api/screener/stocks', dbPage, dbSearch, dbSector, dbMarketCap, dbMinPE, dbMaxPE, dbMinROE, dbMaxDE, dbMinRating, dbSortBy, dbSortOrder],
    queryFn: () => fetch(`/api/screener/stocks?${buildQueryParams()}`).then(r => r.json()),
  });

  const { data: screenerStats } = useQuery<any>({
    queryKey: ['/api/screener/stats'],
    queryFn: () => fetch('/api/screener/stats').then(r => r.json()),
  });

  const mfFields = [
    { value: "returns_1y", label: "1Y Returns (%)" },
    { value: "returns_3y", label: "3Y Returns (%)" },
    { value: "returns_5y", label: "5Y Returns (%)" },
    { value: "expense_ratio", label: "Expense Ratio (%)" },
    { value: "aum", label: "AUM (Cr)" },
    { value: "nav", label: "NAV" },
  ];

  const stockFields = [
    { value: "market_cap", label: "Market Cap (Cr)" },
    { value: "pe_ratio", label: "P/E Ratio" },
    { value: "pb_ratio", label: "P/B Ratio" },
    { value: "dividend_yield", label: "Dividend Yield (%)" },
    { value: "roe", label: "ROE (%)" },
    { value: "debt_equity", label: "Debt/Equity" },
  ];

  const operators = [
    { value: ">=", label: ">=" },
    { value: "<=", label: "<=" },
    { value: ">", label: ">" },
    { value: "<", label: "<" },
    { value: "=", label: "=" },
  ];

  const fields = screenerType === "mutual_fund" ? mfFields : stockFields;

  const addCriteria = () => {
    setCriteria([...criteria, { field: "", operator: ">=", value: "" }]);
  };

  const removeCriteria = (index: number) => {
    setCriteria(criteria.filter((_, i) => i !== index));
  };

  const updateCriteria = (index: number, key: keyof ScreenerCriteria, value: string) => {
    const updated = [...criteria];
    updated[index][key] = value;
    setCriteria(updated);
  };

  const runScreenerMutation = useMutation({
    mutationFn: async () => {
      const filters: Record<string, Record<string, number>> = {};
      criteria.forEach(c => {
        if (c.field && c.value) {
          filters[c.field] = { [c.operator]: parseFloat(c.value) };
        }
      });
      const universe = screenerType === "mutual_fund" ? "MF" : screenerType === "stock" ? "STOCK" : screenerType.toUpperCase();
      return apiRequest("/api/research-lists/screener/run", {
        method: "POST",
        body: JSON.stringify({
          universe,
          filters,
        }),
      });
    },
    onSuccess: (data: any) => {
      toast({
        title: "Screener executed",
        description: `Found ${data.results?.length || 0} matching instruments`,
      });
    },
    onError: () => {
      toast({
        title: "Screener failed",
        description: "Could not execute screener",
        variant: "destructive",
      });
    },
  });

  const saveScreenerMutation = useMutation({
    mutationFn: async () => {
      const dslCriteria: Record<string, Record<string, number>> = {};
      criteria.forEach(c => {
        if (c.field && c.value) {
          dslCriteria[c.field] = { [c.operator]: parseFloat(c.value) };
        }
      });
      return apiRequest("/api/research-lists/screeners", {
        method: "POST",
        body: JSON.stringify({
          name: screenerName,
          screenerType,
          criteria: dslCriteria,
        }),
      });
    },
    onSuccess: () => {
      toast({
        title: "Screener saved",
        description: "Your screener has been saved",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/research-lists/screeners"] });
    },
  });

  const { data: savedScreeners } = useQuery({
    queryKey: ["/api/research-lists/screeners"],
  });

  const handleSort = (key: string) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        if (prev.direction === "asc") return { key, direction: "desc" };
        if (prev.direction === "desc") return { key: "", direction: null };
        return { key, direction: "asc" };
      }
      return { key, direction: "asc" };
    });
  };

  const sortedResults = useMemo(() => {
    const results = runScreenerMutation.data?.results || [];
    if (!sortConfig.key || !sortConfig.direction) return results;
    
    return [...results].sort((a: any, b: any) => {
      const aVal = a[sortConfig.key];
      const bVal = b[sortConfig.key];
      
      const aNull = aVal === null || aVal === undefined || aVal === "";
      const bNull = bVal === null || bVal === undefined || bVal === "";
      
      if (aNull && bNull) return 0;
      if (aNull) return 1;
      if (bNull) return -1;
      
      const aNum = parseFloat(aVal);
      const bNum = parseFloat(bVal);
      
      if (!isNaN(aNum) && !isNaN(bNum)) {
        return sortConfig.direction === "asc" ? aNum - bNum : bNum - aNum;
      }
      
      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();
      
      if (sortConfig.direction === "asc") {
        return aStr.localeCompare(bStr);
      }
      return bStr.localeCompare(aStr);
    });
  }, [runScreenerMutation.data?.results, sortConfig]);

  const SortableHeader = ({ label, sortKey, align = "left" }: { label: string; sortKey: string; align?: "left" | "right" | "center" }) => {
    const alignClass = align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left";
    const justifyClass = align === "right" ? "justify-end" : align === "center" ? "justify-center" : "";
    return (
      <th 
        className={`${alignClass} py-3 px-3 font-medium whitespace-nowrap cursor-pointer hover:bg-muted select-none transition-colors`}
        onClick={() => handleSort(sortKey)}
      >
        <div className={`flex items-center gap-1 ${justifyClass}`}>
          {label}
          {sortConfig.key === sortKey ? (
            sortConfig.direction === "asc" ? (
              <ArrowUp className="h-3 w-3" />
            ) : (
              <ArrowDown className="h-3 w-3" />
            )
          ) : (
            <ArrowUpDown className="h-3 w-3 opacity-40" />
          )}
        </div>
      </th>
    );
  };

  const handleDbSort = (col: string) => {
    if (dbSortBy === col) {
      setDbSortOrder(dbSortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setDbSortBy(col);
      setDbSortOrder('desc');
    }
    setDbPage(1);
  };

  const DbSortableHeader = ({ label, sortKey, align = "left" }: { label: string; sortKey: string; align?: "left" | "right" | "center" }) => {
    const alignClass = align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left";
    const justifyClass = align === "right" ? "justify-end" : align === "center" ? "justify-center" : "";
    return (
      <th
        className={`${alignClass} py-3 px-3 font-medium whitespace-nowrap cursor-pointer hover:bg-muted select-none transition-colors`}
        onClick={() => handleDbSort(sortKey)}
      >
        <div className={`flex items-center gap-1 ${justifyClass}`}>
          {label}
          {dbSortBy === sortKey ? (
            dbSortOrder === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
          ) : (
            <ArrowUpDown className="h-3 w-3 opacity-40" />
          )}
        </div>
      </th>
    );
  };

  const resetDbFilters = () => {
    setDbSearch("");
    setDbSector("");
    setDbMarketCap("");
    setDbMinPE("");
    setDbMaxPE("");
    setDbMinROE("");
    setDbMaxDE("");
    setDbMinRating("");
    setDbPage(1);
  };

  return (
    <AgentLayout>
      <div className="space-y-6">
        <Tabs defaultValue="db-screener" className="w-full">
          <Card>
            <CardHeader className="pb-4 border-b">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <Filter className="h-5 w-5 text-primary" />
                    Investment Screener
                  </CardTitle>
                  <CardDescription className="mt-1.5">
                    Filter and find instruments based on financial metrics
                  </CardDescription>
                </div>
                <TabsList className="w-fit">
                  <TabsTrigger value="db-screener" className="px-4">
                    <Database className="h-4 w-4 mr-1.5" />
                    Stock Screener
                  </TabsTrigger>
                  <TabsTrigger value="builder" className="px-4">Custom Builder</TabsTrigger>
                  <TabsTrigger value="saved" className="px-4">Saved</TabsTrigger>
                </TabsList>
              </div>
            </CardHeader>

            <TabsContent value="db-screener" className="m-0">
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="flex-1 min-w-[200px]">
                      <Label className="text-xs text-muted-foreground mb-1">Search</Label>
                      <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Symbol or company name..."
                          className="pl-9"
                          value={dbSearch}
                          onChange={(e) => { setDbSearch(e.target.value); setDbPage(1); }}
                        />
                      </div>
                    </div>
                    <div className="w-40">
                      <Label className="text-xs text-muted-foreground mb-1">Sector</Label>
                      <Select value={dbSector} onValueChange={(v) => { setDbSector(v === 'all' ? '' : v); setDbPage(1); }}>
                        <SelectTrigger><SelectValue placeholder="All Sectors" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Sectors</SelectItem>
                          {(dbScreenerData?.filters?.sectors || []).map((s: string) => (
                            <SelectItem key={s} value={s}>{s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="w-32">
                      <Label className="text-xs text-muted-foreground mb-1">Market Cap</Label>
                      <Select value={dbMarketCap} onValueChange={(v) => { setDbMarketCap(v === 'all' ? '' : v); setDbPage(1); }}>
                        <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All</SelectItem>
                          <SelectItem value="mega">Mega Cap</SelectItem>
                          <SelectItem value="large">Large Cap</SelectItem>
                          <SelectItem value="mid">Mid Cap</SelectItem>
                          <SelectItem value="small">Small Cap</SelectItem>
                          <SelectItem value="micro">Micro Cap</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-end gap-3 pb-4 border-b">
                    <div className="w-24">
                      <Label className="text-xs text-muted-foreground mb-1">Min P/E</Label>
                      <Input type="number" placeholder="0" value={dbMinPE} onChange={(e) => { setDbMinPE(e.target.value); setDbPage(1); }} />
                    </div>
                    <div className="w-24">
                      <Label className="text-xs text-muted-foreground mb-1">Max P/E</Label>
                      <Input type="number" placeholder="100" value={dbMaxPE} onChange={(e) => { setDbMaxPE(e.target.value); setDbPage(1); }} />
                    </div>
                    <div className="w-24">
                      <Label className="text-xs text-muted-foreground mb-1">Min ROE %</Label>
                      <Input type="number" placeholder="0" value={dbMinROE} onChange={(e) => { setDbMinROE(e.target.value); setDbPage(1); }} />
                    </div>
                    <div className="w-24">
                      <Label className="text-xs text-muted-foreground mb-1">Max D/E</Label>
                      <Input type="number" placeholder="2" value={dbMaxDE} onChange={(e) => { setDbMaxDE(e.target.value); setDbPage(1); }} />
                    </div>
                    <div className="w-32">
                      <Label className="text-xs text-muted-foreground mb-1">Min Rating</Label>
                      <Select value={dbMinRating} onValueChange={(v) => { setDbMinRating(v === 'any' ? '' : v); setDbPage(1); }}>
                        <SelectTrigger><SelectValue placeholder="Any" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="any">Any</SelectItem>
                          <SelectItem value="5">5 Stars</SelectItem>
                          <SelectItem value="4">4+ Stars</SelectItem>
                          <SelectItem value="3">3+ Stars</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button variant="ghost" size="sm" onClick={resetDbFilters}>
                      <RefreshCw className="h-3.5 w-3.5 mr-1" />
                      Reset
                    </Button>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-3 text-muted-foreground">
                      <span>{dbScreenerData?.total ?? 0} stocks found</span>
                      {screenerStats?.database && (
                        <span className="text-xs">
                          DB: {screenerStats.database.totalStocks} stocks, {screenerStats.database.withFinancials} with financials, {screenerStats.database.withDerivedMetrics} scored
                        </span>
                      )}
                    </div>
                    {screenerStats?.apiUsage && (
                      <div className="flex items-center gap-2">
                        <Activity className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">
                          API: {screenerStats.apiUsage.count}/{screenerStats.apiUsage.limit} calls today ({screenerStats.apiUsage.remaining} remaining)
                        </span>
                      </div>
                    )}
                  </div>

                  {dbLoading ? (
                    <div className="flex items-center justify-center py-16">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      <span className="ml-2 text-muted-foreground">Loading screener data...</span>
                    </div>
                  ) : dbScreenerData?.stocks?.length > 0 ? (
                    <>
                      <div className="border rounded-lg overflow-hidden">
                        <div className="overflow-x-auto overflow-y-auto max-h-[600px]">
                          <table className="w-full text-sm min-w-[1200px]">
                            <thead className="bg-card text-foreground sticky top-0 z-10 border-b">
                              <tr>
                                <th className="py-3 px-3 text-left font-medium">Company</th>
                                <DbSortableHeader label="Price" sortKey="currentPrice" align="right" />
                                <DbSortableHeader label="Market Cap" sortKey="marketCap" align="right" />
                                <th className="py-3 px-3 text-center font-medium">Cap</th>
                                <DbSortableHeader label="P/E" sortKey="peRatio" align="right" />
                                <th className="py-3 px-3 text-right font-medium">P/B</th>
                                <DbSortableHeader label="ROE %" sortKey="roe" align="right" />
                                <th className="py-3 px-3 text-right font-medium">D/E</th>
                                <th className="py-3 px-3 text-right font-medium">NPM %</th>
                                <th className="py-3 px-3 text-right font-medium">Div Yield</th>
                                <DbSortableHeader label="Score" sortKey="compositeScore" align="center" />
                                <DbSortableHeader label="Rating" sortKey="fintekRating" align="center" />
                              </tr>
                            </thead>
                            <tbody>
                              {dbScreenerData.stocks.map((stock: any) => (
                                <tr key={stock.symbol} className="border-b hover:bg-muted/50 transition-colors">
                                  <td className="py-3 px-3">
                                    <div className="font-medium truncate max-w-[200px]" title={stock.companyName}>{stock.companyName}</div>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                      <Badge variant="outline" className="font-mono text-[10px] py-0">{stock.symbol}</Badge>
                                      {stock.sector && <span className="text-[10px] text-muted-foreground truncate max-w-[100px]">{stock.sector}</span>}
                                    </div>
                                  </td>
                                  <td className="py-3 px-3 text-right font-mono text-sm">
                                    {formatCurrency(stock.currentPrice)}
                                  </td>
                                  <td className="py-3 px-3 text-right font-mono text-sm">
                                    {formatMarketCap(stock.marketCapValue)}
                                  </td>
                                  <td className="py-3 px-3 text-center">
                                    {stock.marketCapCategory && (
                                      <Badge variant="secondary" className="text-[10px] capitalize">{stock.marketCapCategory}</Badge>
                                    )}
                                  </td>
                                  <td className="py-3 px-3 text-right font-mono text-sm">{formatNum(stock.peRatio)}</td>
                                  <td className="py-3 px-3 text-right font-mono text-sm">{formatNum(stock.pbRatio)}</td>
                                  <td className={`py-3 px-3 text-right font-mono text-sm ${parseFloat(stock.roe || '0') >= 0.15 ? 'text-green-600 dark:text-green-400' : ''}`}>
                                    {stock.roe ? `${(parseFloat(stock.roe) * 100).toFixed(1)}%` : '-'}
                                  </td>
                                  <td className={`py-3 px-3 text-right font-mono text-sm ${parseFloat(stock.debtToEquity || '0') > 1.5 ? 'text-red-600 dark:text-red-400' : ''}`}>
                                    {formatNum(stock.debtToEquity)}
                                  </td>
                                  <td className="py-3 px-3 text-right font-mono text-sm">
                                    {stock.netProfitMargin ? `${(parseFloat(stock.netProfitMargin) * 100).toFixed(1)}%` : '-'}
                                  </td>
                                  <td className="py-3 px-3 text-right font-mono text-sm text-blue-600 dark:text-blue-400">
                                    {stock.dividendYield ? `${(parseFloat(stock.dividendYield) * 100).toFixed(2)}%` : '-'}
                                  </td>
                                  <td className="py-3 px-3 text-center">
                                    <ScoreBadge score={stock.compositeScore} label="Composite" />
                                  </td>
                                  <td className="py-3 px-3 text-center">
                                    <RatingStars rating={stock.fintekRating} />
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2">
                        <div className="text-sm text-muted-foreground">
                          Page {dbScreenerData.page} of {dbScreenerData.totalPages}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={dbPage <= 1}
                            onClick={() => setDbPage(p => Math.max(1, p - 1))}
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={dbPage >= (dbScreenerData?.totalPages || 1)}
                            onClick={() => setDbPage(p => p + 1)}
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-16">
                      <Database className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                      <p className="text-muted-foreground font-medium">No stocks match your filters</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {dbScreenerData?.total === 0 && !dbSearch && !dbSector
                          ? "The screener database is being populated. Use Admin tools to seed stock data."
                          : "Try adjusting your filters or search criteria."}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </TabsContent>

            <TabsContent value="builder" className="m-0">
              <CardContent className="pt-6">
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Instrument Type</Label>
                      <Select value={screenerType} onValueChange={(v) => setScreenerType(v as ScreenerType)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="mutual_fund">Mutual Funds</SelectItem>
                          <SelectItem value="stock">Stocks</SelectItem>
                          <SelectItem value="etf">ETFs</SelectItem>
                          <SelectItem value="bond">Bonds</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Screener Name (for saving)</Label>
                      <Input
                        placeholder="e.g., High Return Low Cost MFs"
                        value={screenerName}
                        onChange={(e) => setScreenerName(e.target.value)}
                      />
                    </div>
                  </div>

                <div className="space-y-3">
                  <Label>Filter Criteria</Label>
                  {criteria.map((c, index) => (
                    <div key={index} className="flex gap-2 items-center">
                      <Select value={c.field} onValueChange={(v) => updateCriteria(index, "field", v)}>
                        <SelectTrigger className="w-48">
                          <SelectValue placeholder="Select field" />
                        </SelectTrigger>
                        <SelectContent>
                          {fields.map(f => (
                            <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={c.operator} onValueChange={(v) => updateCriteria(index, "operator", v)}>
                        <SelectTrigger className="w-20">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {operators.map(o => (
                            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        placeholder="Value"
                        className="w-32"
                        value={c.value}
                        onChange={(e) => updateCriteria(index, "value", e.target.value)}
                      />
                      {criteria.length > 1 && (
                        <Button variant="ghost" size="sm" onClick={() => removeCriteria(index)}>
                          Remove
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={addCriteria}>
                    + Add Criteria
                  </Button>
                </div>

                <div className="flex gap-2 pt-4 border-t">
                  <Button onClick={() => runScreenerMutation.mutate()} disabled={runScreenerMutation.isPending}>
                    <Play className="h-4 w-4 mr-2" />
                    Run Screener
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => saveScreenerMutation.mutate()}
                    disabled={!screenerName || saveScreenerMutation.isPending}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Save Screener
                  </Button>
                </div>

                <div className="pt-6 border-t">
                  <h3 className="text-lg font-semibold mb-2">Screener Results</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    {runScreenerMutation.data?.results 
                      ? `${runScreenerMutation.data.results.length} instruments match your criteria`
                      : "Results will appear here after running the screener"
                    }
                  </p>
                <div>
                {runScreenerMutation.isPending ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Running screener...
                  </div>
                ) : runScreenerMutation.data?.results?.length > 0 ? (
                  <div className="border rounded-lg overflow-hidden">
                    <div className="overflow-x-auto overflow-y-auto max-h-[600px]">
                      <table className="w-full text-sm min-w-[1800px]">
                        <thead className="bg-card text-foreground sticky top-0 z-10">
                          <tr>
                            <SortableHeader label="Name" sortKey="name" />
                            <SortableHeader label="Symbol" sortKey="symbol" />
                            <SortableHeader label="ISIN" sortKey="isin" />
                            {screenerType === "mutual_fund" ? (
                              <>
                                <SortableHeader label="Category" sortKey="category" />
                                <SortableHeader label="Fund House" sortKey="fundHouse" />
                                <SortableHeader label="NAV" sortKey="nav" align="right" />
                                <SortableHeader label="1Y Return" sortKey="returns1y" align="right" />
                                <SortableHeader label="3Y Return" sortKey="returns3y" align="right" />
                                <SortableHeader label="5Y Return" sortKey="returns5y" align="right" />
                                <SortableHeader label="Expense %" sortKey="expenseRatio" align="right" />
                                <SortableHeader label="AUM (Cr)" sortKey="aum" align="right" />
                                <SortableHeader label="Risk" sortKey="riskLevel" align="center" />
                                <SortableHeader label="Rating" sortKey="rating" align="center" />
                              </>
                            ) : (
                              <>
                                <SortableHeader label="Sector" sortKey="sector" />
                                <SortableHeader label="Industry" sortKey="industry" />
                                <SortableHeader label="Price" sortKey="currentPrice" align="right" />
                                <SortableHeader label="Change %" sortKey="dayChangePercent" align="right" />
                                <SortableHeader label="52W High" sortKey="weekHigh52" align="right" />
                                <SortableHeader label="52W Low" sortKey="weekLow52" align="right" />
                                <SortableHeader label="Mkt Cap (Cr)" sortKey="marketCapValue" align="right" />
                                <SortableHeader label="Cap Type" sortKey="marketCap" align="center" />
                                <SortableHeader label="P/E" sortKey="peRatio" align="right" />
                                <SortableHeader label="P/B" sortKey="pbRatio" align="right" />
                                <SortableHeader label="Div Yield %" sortKey="dividendYield" align="right" />
                                <SortableHeader label="ROE %" sortKey="roe" align="right" />
                                <SortableHeader label="ROCE %" sortKey="roce" align="right" />
                              </>
                            )}
                          </tr>
                        </thead>
                        <tbody>
                          {sortedResults.map((item: any) => (
                            <tr key={item.id} className="border-b hover:bg-muted/50">
                              <td className="py-3 px-3">
                                <div className="font-medium max-w-[220px] truncate" title={item.name}>
                                  {item.name}
                                </div>
                              </td>
                              <td className="py-3 px-3">
                                <Badge variant="outline" className="font-mono text-xs">{item.symbol}</Badge>
                              </td>
                              <td className="py-3 px-3 font-mono text-xs text-muted-foreground">
                                {item.isin || "-"}
                              </td>
                              {screenerType === "mutual_fund" ? (
                                <>
                                  <td className="py-3 px-3 text-muted-foreground max-w-[150px] truncate" title={item.category}>
                                    {item.category || "-"}
                                  </td>
                                  <td className="py-3 px-3 text-muted-foreground max-w-[150px] truncate" title={item.fundHouse}>
                                    {item.fundHouse || "-"}
                                  </td>
                                  <td className="py-3 px-3 text-right font-mono">
                                    ₹{parseFloat(item.nav || 0).toFixed(2)}
                                  </td>
                                  <td className={`py-3 px-3 text-right font-mono ${parseFloat(item.returns1y || 0) >= 0 ? "text-green-600" : "text-red-600"}`}>
                                    {parseFloat(item.returns1y || 0) >= 0 ? "+" : ""}{parseFloat(item.returns1y || 0).toFixed(2)}%
                                  </td>
                                  <td className={`py-3 px-3 text-right font-mono ${parseFloat(item.returns3y || 0) >= 0 ? "text-green-600" : "text-red-600"}`}>
                                    {parseFloat(item.returns3y || 0) >= 0 ? "+" : ""}{parseFloat(item.returns3y || 0).toFixed(2)}%
                                  </td>
                                  <td className={`py-3 px-3 text-right font-mono ${parseFloat(item.returns5y || 0) >= 0 ? "text-green-600" : "text-red-600"}`}>
                                    {parseFloat(item.returns5y || 0) >= 0 ? "+" : ""}{parseFloat(item.returns5y || 0).toFixed(2)}%
                                  </td>
                                  <td className="py-3 px-3 text-right font-mono">
                                    {item.expenseRatio ? `${parseFloat(item.expenseRatio).toFixed(2)}%` : "-"}
                                  </td>
                                  <td className="py-3 px-3 text-right font-mono">
                                    {item.aum ? `₹${parseFloat(item.aum).toLocaleString("en-IN")}` : "-"}
                                  </td>
                                  <td className="py-3 px-3 text-center">
                                    <Badge variant={item.riskLevel === "Low" ? "default" : item.riskLevel === "Moderate" ? "secondary" : "destructive"} className="text-xs">
                                      {item.riskLevel || "-"}
                                    </Badge>
                                  </td>
                                  <td className="py-3 px-3 text-center">
                                    <Badge variant="outline" className="text-xs">{item.rating || "-"}</Badge>
                                  </td>
                                </>
                              ) : (
                                <>
                                  <td className="py-3 px-3 text-muted-foreground max-w-[150px] truncate" title={item.sector}>
                                    {item.sector || "-"}
                                  </td>
                                  <td className="py-3 px-3 text-muted-foreground max-w-[150px] truncate" title={item.industry}>
                                    {item.industry || "-"}
                                  </td>
                                  <td className="py-3 px-3 text-right font-mono">
                                    ₹{parseFloat(item.currentPrice || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                                  </td>
                                  <td className={`py-3 px-3 text-right font-mono ${parseFloat(item.dayChangePercent || 0) >= 0 ? "text-green-600" : "text-red-600"}`}>
                                    {parseFloat(item.dayChangePercent || 0) >= 0 ? "+" : ""}{parseFloat(item.dayChangePercent || 0).toFixed(2)}%
                                  </td>
                                  <td className="py-3 px-3 text-right font-mono text-green-600">
                                    {item.weekHigh52 ? `₹${parseFloat(item.weekHigh52).toLocaleString("en-IN")}` : "-"}
                                  </td>
                                  <td className="py-3 px-3 text-right font-mono text-red-600">
                                    {item.weekLow52 ? `₹${parseFloat(item.weekLow52).toLocaleString("en-IN")}` : "-"}
                                  </td>
                                  <td className="py-3 px-3 text-right font-mono">
                                    {item.marketCapValue ? `₹${parseFloat(item.marketCapValue).toLocaleString("en-IN")}` : "-"}
                                  </td>
                                  <td className="py-3 px-3 text-center">
                                    <Badge variant="secondary" className="text-xs">{item.marketCap || "-"}</Badge>
                                  </td>
                                  <td className="py-3 px-3 text-right font-mono">
                                    {item.peRatio ? parseFloat(item.peRatio).toFixed(2) : "-"}
                                  </td>
                                  <td className="py-3 px-3 text-right font-mono">
                                    {item.pbRatio ? parseFloat(item.pbRatio).toFixed(2) : "-"}
                                  </td>
                                  <td className="py-3 px-3 text-right font-mono text-blue-600">
                                    {item.dividendYield ? `${parseFloat(item.dividendYield).toFixed(2)}%` : "-"}
                                  </td>
                                  <td className={`py-3 px-3 text-right font-mono ${parseFloat(item.roe || 0) >= 15 ? "text-green-600" : ""}`}>
                                    {item.roe ? `${parseFloat(item.roe).toFixed(2)}%` : "-"}
                                  </td>
                                  <td className={`py-3 px-3 text-right font-mono ${parseFloat(item.roce || 0) >= 15 ? "text-green-600" : ""}`}>
                                    {item.roce ? `${parseFloat(item.roce).toFixed(2)}%` : "-"}
                                  </td>
                                </>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    {runScreenerMutation.data?.results?.length === 0 
                      ? "No instruments match your criteria. Try adjusting your filters."
                      : "Click 'Run Screener' to search for matching instruments"
                    }
                  </div>
                )}
                  </div>
                </div>
              </div>
            </CardContent>
          </TabsContent>

          <TabsContent value="saved" className="m-0">
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold mb-2">Saved Screeners</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Your saved screeners for quick access
                  </p>
                </div>
                {(savedScreeners as any)?.screeners?.length > 0 ? (
                  <div className="space-y-2">
                    {(savedScreeners as any).screeners.map((s: any) => (
                      <div key={s.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <div className="font-medium">{s.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {s.screenerType} • {s.runCount || 0} runs
                          </div>
                        </div>
                        <Button variant="outline" size="sm">
                          <Play className="h-4 w-4 mr-1" />
                          Run
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No saved screeners yet. Create and save a screener to see it here.
                  </div>
                )}
              </div>
            </CardContent>
          </TabsContent>
          </Card>
        </Tabs>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Database className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{screenerStats?.database?.totalStocks ?? 0}</div>
                  <div className="text-sm text-muted-foreground">Stocks in DB</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                  <BarChart3 className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{screenerStats?.database?.withFinancials ?? 0}</div>
                  <div className="text-sm text-muted-foreground">With Financials</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 dark:bg-amber-900 rounded-lg">
                  <Star className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{screenerStats?.database?.withDerivedMetrics ?? 0}</div>
                  <div className="text-sm text-muted-foreground">Scored & Rated</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                  <Activity className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <div className="text-2xl font-bold">{screenerStats?.apiUsage?.remaining ?? 220}</div>
                  <div className="text-sm text-muted-foreground">API Calls Left</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AgentLayout>
  );
}
