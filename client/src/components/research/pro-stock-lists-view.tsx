import React, { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";
import {
  TrendingUp,
  Award,
  ThumbsUp,
  Zap,
  Car,
  ShieldCheck,
  CheckCircle2,
  RefreshCw,
  Flame,
  Handshake,
  ArrowUpRight,
  ArrowDownRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
  Sparkles,
  BookmarkPlus,
  ExternalLink,
  FileText,
  Activity,
  Layers,
  ChevronRight,
  Info,
  Radio,
  Clock,
  Shield,
  Download,
  AlertTriangle,
} from "lucide-react";

export type ProListSlug =
  | "high-potential-upside"
  | "analysts"
  | "top-buy-rating"
  | "green-energy"
  | "ev-leaders"
  | "defence-guardians"
  | "fscore"
  | "turnaround"
  | "profit-blasters"
  | "top-deals"
  | "turning-bullish"
  | "turning-bearish";

interface ProCategoryMeta {
  id: number;
  slug: ProListSlug;
  name: string;
  description: string;
  stockCount: number;
}

interface ProStockItem {
  symbol: string;
  isin?: string;
  companyName: string;
  exchange: "NSE" | "BSE";
  sector?: string;
  marketCapCategory?: "Large Cap" | "Mid Cap" | "Small Cap";
  ltp: number;
  priceChange: number;
  pricePercentChange: number;
  primaryMetricLabel: string;
  primaryMetricValue: string;
  secondaryMetricLabel?: string;
  secondaryMetricValue?: string;
  targetPrice?: number;
  upsidePercent?: number;
  fScore?: number;
  analystsCount?: number;
  buyRatingCount?: number;
  profitGrowthYoY?: number;
  dealValueCr?: number;
  technicalSignal?: string;
  themeBadge?: string;
  quoteTimestamp?: string;
  isFresh?: boolean;
  dataSource?: "UPSTOX" | "INDIAN_API_FALLBACK" | "FINTEKPRO_DB";
  stalenessSeconds?: number;
}

interface ProListResponse {
  success: boolean;
  data: {
    category: {
      id: number;
      slug: ProListSlug;
      name: string;
      description: string;
      tableFooters: string;
      headers: {
        primaryMetric: string;
        secondaryMetric?: string;
      };
    };
    metrics: {
      avg1YReturn: string;
      totalStocks: number;
      gainersCount: number;
      losersCount: number;
      activeProvider: "UPSTOX" | "INDIAN_API_FALLBACK" | "FINTEKPRO_DB";
      lastUpdated: string;
      marketSession?: "LIVE" | "CLOSED";
      isMarketOpen?: boolean;
      freshnessScorePercent?: number;
    };
    stocks: ProStockItem[];
  };
  meta: {
    timestamp: string;
    version: string;
    provider: string;
    disclaimer: string;
    isMarketOpen?: boolean;
    marketSession?: "LIVE" | "CLOSED";
    freshnessScorePercent?: number;
  };
}

const CATEGORY_ICONS: Record<ProListSlug, React.ReactNode> = {
  "high-potential-upside": <TrendingUp className="h-4 w-4" />,
  analysts: <Award className="h-4 w-4" />,
  "top-buy-rating": <ThumbsUp className="h-4 w-4" />,
  "green-energy": <Zap className="h-4 w-4" />,
  "ev-leaders": <Car className="h-4 w-4" />,
  "defence-guardians": <ShieldCheck className="h-4 w-4" />,
  fscore: <CheckCircle2 className="h-4 w-4" />,
  turnaround: <RefreshCw className="h-4 w-4" />,
  "profit-blasters": <Flame className="h-4 w-4" />,
  "top-deals": <Handshake className="h-4 w-4" />,
  "turning-bullish": <ArrowUpRight className="h-4 w-4" />,
  "turning-bearish": <ArrowDownRight className="h-4 w-4" />,
};

export function ProStockListsView() {
  const { toast } = useToast();
  const [activeSlug, setActiveSlug] = useState<ProListSlug>("high-potential-upside");
  const [marketCapFilter, setMarketCapFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [onlyFresh, setOnlyFresh] = useState<boolean>(true);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState<boolean>(false);
  const [saveListName, setSaveListName] = useState<string>("");
  const [plottingStock, setPlottingStock] = useState<{ symbol: string; companyName: string; ltp: number } | null>(null);

  // Time-Series Plot Query
  const { data: plotResponse, isLoading: isPlotLoading } = useQuery<{
    success: boolean;
    data: {
      symbol: string;
      days: number;
      sparkline: Array<{ date: string; close: number }>;
      summary: { startPrice: number; endPrice: number; returnPercent: number; candlesCount: number };
    };
  }>({
    queryKey: ["/api/research-lists/pro-stock-lists/time-series", plottingStock?.symbol],
    queryFn: async () => {
      if (!plottingStock?.symbol) return null;
      const res = await fetch(`/api/research-lists/pro-stock-lists/time-series/${plottingStock.symbol}?days=30`);
      if (!res.ok) throw new Error("Failed to fetch plot data");
      return res.json();
    },
    enabled: Boolean(plottingStock?.symbol),
    staleTime: 60 * 1000,
  });

  // Categories list query
  const { data: categoriesData } = useQuery<{
    success: boolean;
    data: ProCategoryMeta[];
  }>({
    queryKey: ["/api/research-lists/pro-stock-lists/categories"],
    staleTime: 5 * 60 * 1000,
  });

  // Active PRO Stock List Query with Dynamic Auto-Refresh
  const {
    data: listResponse,
    isLoading,
    isRefetching,
    isError,
    refetch,
  } = useQuery<ProListResponse>({
    queryKey: [
      "/api/research-lists/pro-stock-lists",
      activeSlug,
      marketCapFilter,
      searchQuery,
      onlyFresh,
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (marketCapFilter !== "all") params.append("marketCap", marketCapFilter);
      if (searchQuery.trim()) params.append("search", searchQuery.trim());
      params.append("onlyFresh", String(onlyFresh));
      const queryStr = params.toString() ? `?${params.toString()}` : "";
      const res = await fetch(`/api/research-lists/pro-stock-lists/${activeSlug}${queryStr}`);
      if (!res.ok) throw new Error("Failed to fetch PRO stock list");
      return res.json();
    },
    staleTime: 15 * 1000,
    refetchInterval: autoRefresh ? 20_000 : false,
  });

  const handleManualRefresh = async () => {
    try {
      const params = new URLSearchParams();
      if (marketCapFilter !== "all") params.append("marketCap", marketCapFilter);
      if (searchQuery.trim()) params.append("search", searchQuery.trim());
      params.append("onlyFresh", String(onlyFresh));
      params.append("refresh", "true");
      const res = await fetch(`/api/research-lists/pro-stock-lists/${activeSlug}?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to refresh live quotes");
      const json = await res.json();
      queryClient.setQueryData(
        [
          "/api/research-lists/pro-stock-lists",
          activeSlug,
          marketCapFilter,
          searchQuery,
          onlyFresh,
        ],
        json
      );
      toast({
        title: "Live Quotes Refreshed",
        description: `Retrieved fresh dynamic quotes from ${json?.data?.metrics?.activeProvider || "Upstox"} in real-time.`,
      });
    } catch (err: any) {
      toast({
        title: "Refresh Error",
        description: err?.message || "Failed to retrieve fresh quotes",
        variant: "destructive",
      });
    }
  };

  // Save to My Research Lists Mutation
  const saveMutation = useMutation({
    mutationFn: async (customName: string) => {
      return apiRequest(`/api/research-lists/pro-stock-lists/${activeSlug}/save-to-research-list`, {
        method: "POST",
        body: JSON.stringify({ name: customName }),
      });
    },
    onSuccess: (data: any) => {
      toast({
        title: "Saved to Research Lists",
        description: `"${data?.data?.name || "PRO List"}" added to your custom lists (${data?.data?.itemCount || 0} stocks).`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/research-lists"] });
      setIsSaveDialogOpen(false);
      setSaveListName("");
    },
    onError: (err: any) => {
      toast({
        title: "Save Failed",
        description: err?.message || "Failed to copy PRO list to custom lists",
        variant: "destructive",
      });
    },
  });

  const categories = categoriesData?.data || [];
  const listData = listResponse?.data;
  const stocks = listData?.stocks || [];
  const metrics = listData?.metrics;
  const currentCategory = listData?.category;

  // ── High Performance Sorting Architecture ──
  type SortField = "default" | "name" | "metric" | "ltp" | "change";
  type SortOrder = "asc" | "desc";
  const [sortField, setSortField] = useState<SortField>("default");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
  };

  // Memoize sorted stocks to guarantee 60fps rendering and zero re-sorting jitter on auto-refresh
  const sortedStocks = useMemo(() => {
    if (sortField === "default") return stocks;
    return [...stocks].sort((a, b) => {
      let cmp = 0;
      if (sortField === "name") {
        cmp = a.companyName.localeCompare(b.companyName);
      } else if (sortField === "ltp") {
        cmp = a.ltp - b.ltp;
      } else if (sortField === "change") {
        cmp = a.pricePercentChange - b.pricePercentChange;
      } else if (sortField === "metric") {
        const valA = parseFloat(a.primaryMetricValue.replace(/[^\d.-]/g, "")) || 0;
        const valB = parseFloat(b.primaryMetricValue.replace(/[^\d.-]/g, "")) || 0;
        cmp = valA - valB;
      }
      return sortOrder === "asc" ? cmp : -cmp;
    });
  }, [stocks, sortField, sortOrder]);

  // Export Table Data to CSV
  const handleExportCsv = () => {
    if (sortedStocks.length === 0) return;
    const metricHeader = currentCategory?.headers?.primaryMetric || "Key Metric";
    const headers = [
      "Symbol",
      "Company",
      "Sector",
      "Market Cap",
      metricHeader,
      "LTP (INR)",
      "Change (INR)",
      "Change (%)",
      "Data Source",
      "Freshness",
      "Quote Timestamp",
    ];
    const rows = sortedStocks.map((s) => [
      s.symbol,
      `"${s.companyName.replace(/"/g, '""')}"`,
      `"${(s.sector || '').replace(/"/g, '""')}"`,
      `"${s.marketCapCategory || 'Equity'}"`,
      `"${s.primaryMetricValue.replace(/"/g, '""')}"`,
      s.ltp,
      s.priceChange,
      s.pricePercentChange,
      s.dataSource || "UPSTOX",
      s.isFresh ? "LIVE_FRESH" : "EOD_CLOSE",
      s.quoteTimestamp || "",
    ]);
    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `FintekPro_${activeSlug}_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({
      title: "Data Table Exported",
      description: `Exported ${sortedStocks.length} constituents for "${currentCategory?.name || activeSlug}" to CSV.`,
    });
  };

  const handleSaveList = () => {
    saveMutation.mutate(saveListName.trim() || `PRO: ${currentCategory?.name || "List"}`);
  };

  const getMetricBadgeStyle = (slug: ProListSlug, val: string) => {
    if (slug === "fscore") {
      return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30 font-semibold";
    }
    if (slug === "profit-blasters" || slug === "high-potential-upside") {
      return "bg-blue-500/15 text-blue-400 border-blue-500/30 font-semibold";
    }
    if (slug === "turning-bullish") {
      return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
    }
    if (slug === "turning-bearish") {
      return "bg-red-500/15 text-red-400 border-red-500/30";
    }
    return "bg-muted text-foreground border-border";
  };

  return (
    <div className="space-y-6">
      {/* ── Top Header Banner with Live Upstox Feed Badge ── */}
      <div className="rounded-xl border border-blue-500/20 bg-gradient-to-r from-blue-950/40 via-background to-emerald-950/30 p-5 backdrop-blur-sm relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5 flex-wrap">
              <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-black font-bold uppercase text-[10px] tracking-wider px-2 py-0.5">
                PRO Research
              </Badge>
              <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span>
                  {metrics?.activeProvider === "UPSTOX"
                    ? "Upstox Live Quotes (NSE/BSE)"
                    : metrics?.activeProvider === "INDIAN_API_FALLBACK"
                    ? "IndianAPI Gateway (Backup Feed)"
                    : "FintekPro Golden Engine"}
                </span>
              </div>
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Activity className="h-3 w-3" />
                Updated {metrics?.lastUpdated || "live"}
              </span>
            </div>

            <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <span>{currentCategory?.name || "Curated PRO Stock Lists"}</span>
            </h2>
            <p className="text-sm text-muted-foreground max-w-2xl">
              {currentCategory?.description ||
                "Institutional thematic stock lists powered by FintekPro's Golden Database and real-time licensed Upstox market feeds."}
            </p>
          </div>

          <div className="flex items-center gap-2 self-start md:self-center flex-wrap">
            {/* Auto-Refresh Toggle */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`gap-1.5 text-xs border ${
                autoRefresh
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20"
                  : "border-border text-muted-foreground hover:bg-muted"
              }`}
              title={autoRefresh ? "Live polling every 20s active" : "Auto-refresh paused"}
            >
              <Radio className={`h-3 w-3 ${autoRefresh ? "animate-pulse text-emerald-400" : ""}`} />
              <span>{autoRefresh ? "Live Sync (20s)" : "Sync Paused"}</span>
            </Button>

            {/* Force Refresh Now */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleManualRefresh}
              disabled={isRefetching}
              className="gap-1.5 text-xs border-border hover:bg-muted"
              title="Force fetch fresh quotes from Upstox API v2"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRefetching ? "animate-spin text-blue-400" : ""}`} />
              <span>Refresh Now</span>
            </Button>

            <Dialog open={isSaveDialogOpen} onOpenChange={setIsSaveDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1.5 text-xs bg-blue-600 hover:bg-blue-500">
                  <BookmarkPlus className="h-3.5 w-3.5" />
                  Save to My Lists
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Save PRO List to My Research</DialogTitle>
                  <DialogDescription>
                    Copy this curated PRO list into your personal workspace to customize weights,
                    add client notes, or generate an investment proposal.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-3">
                  <div className="space-y-2">
                    <Label htmlFor="custom-list-name">List Name</Label>
                    <Input
                      id="custom-list-name"
                      placeholder={`PRO: ${currentCategory?.name || "Stock List"}`}
                      value={saveListName}
                      onChange={(e) => setSaveListName(e.target.value)}
                    />
                  </div>
                  <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground space-y-1">
                    <p className="font-medium text-foreground">What will be saved:</p>
                    <p>• {stocks.length} stocks from {currentCategory?.name}</p>
                    <p>• Snapshot prices and metric values</p>
                    <p>• Equal default target weights (~{(100 / (stocks.length || 1)).toFixed(1)}% each)</p>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsSaveDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleSaveList} disabled={saveMutation.isPending}>
                    {saveMutation.isPending ? "Saving..." : "Save Research List"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* ── Key Metrics Bar ── */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-5 pt-4 border-t border-border/50 text-xs">
          <div className="bg-background/60 rounded-lg p-2.5 border border-border/40">
            <span className="text-muted-foreground text-[11px] block">Average 1-Yr Return*</span>
            <span className="text-base font-bold text-emerald-400">
              {metrics?.avg1YReturn || "+0.00%"}
            </span>
          </div>
          <div className="bg-background/60 rounded-lg p-2.5 border border-border/40">
            <span className="text-muted-foreground text-[11px] block">Fresh Active Stocks</span>
            <span className="text-base font-bold text-foreground">
              {metrics?.totalStocks || 0} Stocks
            </span>
          </div>
          <div className="bg-background/60 rounded-lg p-2.5 border border-border/40">
            <span className="text-muted-foreground text-[11px] block">Market Breadth</span>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-emerald-400 font-semibold">{metrics?.gainersCount || 0} ▲</span>
              <span className="text-muted-foreground">/</span>
              <span className="text-red-400 font-semibold">{metrics?.losersCount || 0} ▼</span>
            </div>
          </div>
          <div className="bg-background/60 rounded-lg p-2.5 border border-border/40">
            <span className="text-muted-foreground text-[11px] block">Data Freshness</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-xs font-semibold text-emerald-400">
                {metrics?.freshnessScorePercent ?? 100}% Fresh
              </span>
              <Badge variant="outline" className="text-[9px] px-1 py-0 border-emerald-500/30 text-emerald-400">
                {metrics?.marketSession === "LIVE" ? "LIVE" : "EOD"}
              </Badge>
            </div>
          </div>
          <div className="bg-background/60 rounded-lg p-2.5 border border-border/40">
            <span className="text-muted-foreground text-[11px] block">Primary Metric</span>
            <span className="text-xs font-semibold text-blue-400 truncate block mt-0.5">
              {currentCategory?.headers?.primaryMetric || "Valuation"}
            </span>
          </div>
        </div>
      </div>

      {/* ── 12 Moneycontrol-Format Category Selector Pills ── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
          <span className="font-medium text-foreground flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5 text-blue-400" />
            Curated PRO Themes (12 Categories)
          </span>
          <span>Click a theme to load live quotes</span>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-muted">
          {(categories.length > 0 ? categories : Object.keys(CATEGORY_ICONS).map((k, i) => ({
            id: i + 1,
            slug: k as ProListSlug,
            name: k.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
            description: "",
            stockCount: 0,
          }))).map((cat) => {
            const isActive = activeSlug === cat.slug;
            return (
              <button
                key={cat.slug}
                onClick={() => setActiveSlug(cat.slug)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all border shrink-0 ${
                  isActive
                    ? "bg-blue-600/20 text-blue-400 border-blue-500/50 shadow-sm shadow-blue-500/10 font-semibold"
                    : "bg-card/60 text-muted-foreground border-border hover:bg-muted/70 hover:text-foreground"
                }`}
              >
                <span className={isActive ? "text-blue-400" : "text-muted-foreground"}>
                  {CATEGORY_ICONS[cat.slug] || <Sparkles className="h-4 w-4" />}
                </span>
                <span>{cat.name}</span>
                {cat.stockCount > 0 && (
                  <Badge
                    variant="outline"
                    className={`ml-1 px-1.5 py-0 text-[10px] rounded-full ${
                      isActive
                        ? "border-blue-400/40 text-blue-300"
                        : "border-border text-muted-foreground"
                    }`}
                  >
                    {cat.stockCount}
                  </Badge>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Search & Market Cap Filter Toolbar ── */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search stock, sector, or symbol..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 text-xs bg-card/60 border-border"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
          {/* Strict Freshness Guard Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setOnlyFresh(!onlyFresh)}
            className={`h-9 gap-1.5 text-xs border ${
              onlyFresh
                ? "bg-emerald-950/40 text-emerald-400 border-emerald-500/40 font-semibold"
                : "bg-card/60 text-muted-foreground border-border hover:text-foreground"
            }`}
            title={onlyFresh ? "Strict Freshness Guard: Only verified dynamic quotes allowed" : "Display all items including EOD/fallback"}
          >
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            <span>{onlyFresh ? "Fresh Quotes Only (Active)" : "Freshness: Permissive"}</span>
          </Button>

          <Select value={marketCapFilter} onValueChange={setMarketCapFilter}>
            <SelectTrigger className="w-[140px] h-9 text-xs bg-card/60 border-border">
              <SelectValue placeholder="Market Cap" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Market Caps</SelectItem>
              <SelectItem value="Large Cap">Large Cap</SelectItem>
              <SelectItem value="Mid Cap">Mid Cap</SelectItem>
              <SelectItem value="Small Cap">Small Cap</SelectItem>
            </SelectContent>
          </Select>

          {/* Export CSV Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            disabled={sortedStocks.length === 0}
            className="h-9 gap-1.5 text-xs bg-card/60 border-border hover:bg-muted"
            title="Export table data to CSV / Excel"
          >
            <Download className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="hidden sm:inline">Export</span> CSV
          </Button>
        </div>
      </div>

      {/* ── Financial Table (Moneycontrol Format) ── */}
      <Card className="bg-card/60 border-border shadow-sm overflow-hidden">
        <CardContent className="p-0">
          {isError ? (
            <div className="py-16 text-center space-y-3">
              <AlertTriangle className="h-8 w-8 mx-auto text-amber-400" />
              <p className="text-sm font-medium text-foreground">Market Data Feed Temporarily Unavailable</p>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                Unable to retrieve quotes from Upstox or FintekPro market feed. Please check connectivity and retry.
              </p>
              <Button size="sm" onClick={() => refetch()} className="gap-1.5 text-xs bg-blue-600 hover:bg-blue-500">
                <RefreshCw className="h-3.5 w-3.5" />
                Retry Connection
              </Button>
            </div>
          ) : isLoading ? (
            <div className="py-16 text-center space-y-3">
              <RefreshCw className="h-8 w-8 mx-auto text-blue-400 animate-spin" />
              <p className="text-sm text-muted-foreground">
                Connecting to Upstox & FintekPro database...
              </p>
            </div>
          ) : sortedStocks.length === 0 ? (
            <div className="py-16 text-center space-y-2">
              <Info className="h-8 w-8 mx-auto text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">No stocks found matching your filters</p>
              <p className="text-xs text-muted-foreground">
                {onlyFresh
                  ? "All candidate stocks are currently undergoing fresh pricing validation. Try toggling 'Freshness: Permissive' or click 'Refresh Now'."
                  : "Try clearing search or changing market cap filter."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow className="border-border hover:bg-transparent">
                    {/* Sortable: Company Name */}
                    <TableHead className="w-[280px] text-xs font-semibold text-muted-foreground">
                      <button
                        onClick={() => toggleSort("name")}
                        className="flex items-center gap-1.5 hover:text-foreground transition-colors group"
                      >
                        <span>Company & Symbol</span>
                        {sortField === "name" ? (
                          sortOrder === "asc" ? (
                            <ArrowUp className="h-3 w-3 text-blue-400" />
                          ) : (
                            <ArrowDown className="h-3 w-3 text-blue-400" />
                          )
                        ) : (
                          <ArrowUpDown className="h-3 w-3 opacity-30 group-hover:opacity-70 transition-opacity" />
                        )}
                      </button>
                    </TableHead>

                    <TableHead className="text-xs font-semibold text-muted-foreground">
                      Sector & Theme
                    </TableHead>

                    {/* Sortable: Primary Valuation Metric */}
                    <TableHead className="text-right text-xs font-semibold text-muted-foreground">
                      <button
                        onClick={() => toggleSort("metric")}
                        className="inline-flex items-center gap-1.5 ml-auto hover:text-foreground transition-colors group"
                      >
                        <span>{currentCategory?.headers?.primaryMetric || "Key Metric"}</span>
                        {sortField === "metric" ? (
                          sortOrder === "asc" ? (
                            <ArrowUp className="h-3 w-3 text-blue-400" />
                          ) : (
                            <ArrowDown className="h-3 w-3 text-blue-400" />
                          )
                        ) : (
                          <ArrowUpDown className="h-3 w-3 opacity-30 group-hover:opacity-70 transition-opacity" />
                        )}
                      </button>
                    </TableHead>

                    {currentCategory?.headers?.secondaryMetric && (
                      <TableHead className="text-right text-xs font-semibold text-muted-foreground">
                        {currentCategory?.headers?.secondaryMetric}
                      </TableHead>
                    )}

                    {/* Sortable: LTP */}
                    <TableHead className="text-right text-xs font-semibold text-muted-foreground">
                      <button
                        onClick={() => toggleSort("ltp")}
                        className="inline-flex items-center gap-1.5 ml-auto hover:text-foreground transition-colors group"
                      >
                        <span>LTP & Feed</span>
                        {sortField === "ltp" ? (
                          sortOrder === "asc" ? (
                            <ArrowUp className="h-3 w-3 text-blue-400" />
                          ) : (
                            <ArrowDown className="h-3 w-3 text-blue-400" />
                          )
                        ) : (
                          <ArrowUpDown className="h-3 w-3 opacity-30 group-hover:opacity-70 transition-opacity" />
                        )}
                      </button>
                    </TableHead>

                    {/* Sortable: Change */}
                    <TableHead className="text-right text-xs font-semibold text-muted-foreground">
                      <button
                        onClick={() => toggleSort("change")}
                        className="inline-flex items-center gap-1.5 ml-auto hover:text-foreground transition-colors group"
                      >
                        <span>Change (₹ / %)</span>
                        {sortField === "change" ? (
                          sortOrder === "asc" ? (
                            <ArrowUp className="h-3 w-3 text-blue-400" />
                          ) : (
                            <ArrowDown className="h-3 w-3 text-blue-400" />
                          )
                        ) : (
                          <ArrowUpDown className="h-3 w-3 opacity-30 group-hover:opacity-70 transition-opacity" />
                        )}
                      </button>
                    </TableHead>

                    <TableHead className="text-center text-xs font-semibold text-muted-foreground w-[120px]">
                      Quick Analysis
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedStocks.map((stock) => {
                    const isPositive = stock.priceChange >= 0;
                    return (
                      <TableRow
                        key={stock.symbol}
                        className="border-border/60 hover:bg-muted/40 transition-colors"
                      >
                        {/* Company Name & Symbol */}
                        <TableCell className="py-3">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-sm text-foreground hover:text-blue-400 cursor-pointer">
                                {stock.companyName}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Badge
                                variant="outline"
                                className="text-[10px] font-mono px-1.5 py-0 border-border text-muted-foreground"
                              >
                                {stock.symbol}
                              </Badge>
                              <Badge
                                variant="secondary"
                                className="text-[10px] px-1 py-0 bg-muted text-muted-foreground font-mono"
                              >
                                {stock.exchange}
                              </Badge>
                              {stock.marketCapCategory && (
                                <span className="text-[10px] text-muted-foreground">
                                  • {stock.marketCapCategory}
                                </span>
                              )}
                            </div>
                          </div>
                        </TableCell>

                        {/* Sector & Theme Badge */}
                        <TableCell className="py-3">
                          <div className="space-y-1">
                            <span className="text-xs text-foreground block">
                              {stock.sector || "Equities"}
                            </span>
                            {stock.themeBadge && (
                              <Badge
                                variant="outline"
                                className="text-[10px] px-1.5 py-0 bg-blue-500/10 text-blue-400 border-blue-500/20"
                              >
                                {stock.themeBadge}
                              </Badge>
                            )}
                          </div>
                        </TableCell>

                        {/* Primary Metric */}
                        <TableCell className="text-right py-3">
                          <Badge
                            variant="outline"
                            className={`text-xs px-2 py-0.5 ${getMetricBadgeStyle(
                              activeSlug,
                              stock.primaryMetricValue
                            )}`}
                          >
                            {stock.primaryMetricValue}
                          </Badge>
                        </TableCell>

                        {/* Secondary Metric (if applicable) */}
                        {currentCategory?.headers?.secondaryMetric && (
                          <TableCell className="text-right py-3 text-xs text-muted-foreground">
                            {stock.secondaryMetricValue || "—"}
                          </TableCell>
                        )}

                        {/* LTP & Dynamic Feed Provenance */}
                        <TableCell className="text-right py-3 font-mono tabular-nums">
                          <div className="font-semibold text-sm text-foreground">
                            ₹{stock.ltp.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                          <div className="flex items-center justify-end gap-1 mt-0.5">
                            {stock.isFresh ? (
                              <span
                                className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-medium"
                                title={`Quote from ${stock.dataSource || "Upstox"} at ${stock.quoteTimestamp || "live"}`}
                              >
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                {stock.dataSource === "UPSTOX" ? "Upstox Live" : "Verified Live"}
                              </span>
                            ) : (
                              <span
                                className="inline-flex items-center gap-1 text-[10px] text-muted-foreground font-medium"
                                title={`Timestamp: ${stock.quoteTimestamp || "N/A"}`}
                              >
                                <Clock className="h-2.5 w-2.5" />
                                EOD Close
                              </span>
                            )}
                          </div>
                        </TableCell>

                        {/* Price Change & % */}
                        <TableCell className="text-right py-3">
                          <div
                            className={`inline-flex items-center gap-1 font-mono tabular-nums text-xs font-semibold ${
                              isPositive ? "text-emerald-400" : "text-red-400"
                            }`}
                          >
                            {isPositive ? (
                              <ArrowUpRight className="h-3.5 w-3.5" />
                            ) : (
                              <ArrowDownRight className="h-3.5 w-3.5" />
                            )}
                            <span>
                              {isPositive ? "+" : ""}
                              {stock.priceChange.toFixed(2)}
                            </span>
                            <span className="opacity-80">
                              ({isPositive ? "+" : ""}
                              {stock.pricePercentChange.toFixed(2)}%)
                            </span>
                          </div>
                        </TableCell>

                        {/* Quick Analysis Actions */}
                        <TableCell className="text-center py-3">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-cyan-400"
                              title="Plot Dynamic Time-Series"
                              onClick={() =>
                                setPlottingStock({
                                  symbol: stock.symbol,
                                  companyName: stock.companyName,
                                  ltp: stock.ltp,
                                })
                              }
                            >
                              <Activity className="h-3.5 w-3.5" />
                            </Button>
                            <Link href={`/agent/iris-hub?symbol=${stock.symbol}`}>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-blue-400"
                                title="Peer Comparison & Iris Analysis"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                              </Button>
                            </Link>
                            <Link href={`/agent/research-note-generator?symbol=${stock.symbol}`}>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-emerald-400"
                                title="Generate Research Note"
                              >
                                <FileText className="h-3.5 w-3.5" />
                              </Button>
                            </Link>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Table Footer Methodology Note */}
          <div className="p-3 bg-muted/20 border-t border-border/50 text-[11px] text-muted-foreground flex items-center justify-between flex-wrap gap-2">
            <span>{currentCategory?.tableFooters || "* Methodology based on Moneycontrol PRO stock list definitions"}</span>
            <span className="text-[10px] text-muted-foreground/80">
              Quotes: Upstox Developer API v2 (NSE Cash Equities)
            </span>
          </div>
        </CardContent>
      </Card>

      {/* ── Dynamic Price Plot Modal ── */}
      <Dialog open={Boolean(plottingStock)} onOpenChange={(open) => !open && setPlottingStock(null)}>
        <DialogContent className="max-w-2xl bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between text-base">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-cyan-400" />
                <span>{plottingStock?.companyName}</span>
                <Badge variant="outline" className="font-mono text-xs">{plottingStock?.symbol}</Badge>
              </div>
              <span className="font-mono text-sm font-semibold">₹{plottingStock?.ltp?.toFixed(2)}</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              30-Day Trading Session Dynamic Price Plot (Powered by Upstox Market Data Feed)
            </DialogDescription>
          </DialogHeader>

          <div className="py-2">
            {isPlotLoading ? (
              <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">
                <RefreshCw className="h-5 w-5 animate-spin mr-2 text-cyan-400" />
                Plotting historical time-series...
              </div>
            ) : plotResponse?.data?.sparkline && plotResponse.data.sparkline.length > 0 ? (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-2 p-2.5 rounded-lg bg-muted/30 border border-border/50 text-xs font-mono">
                  <div>
                    <span className="text-muted-foreground block text-[10px]">Start Price</span>
                    <span className="font-semibold">₹{plotResponse.data.summary.startPrice?.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px]">Latest Close</span>
                    <span className="font-semibold">₹{plotResponse.data.summary.endPrice?.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px]">30D Trajectory</span>
                    <span className={`font-semibold ${plotResponse.data.summary.returnPercent >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {plotResponse.data.summary.returnPercent >= 0 ? "+" : ""}{plotResponse.data.summary.returnPercent?.toFixed(2)}%
                    </span>
                  </div>
                </div>

                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={plotResponse.data.sparkline} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="plotGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={plotResponse.data.summary.returnPercent >= 0 ? "#10b981" : "#ef4444"} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={plotResponse.data.summary.returnPercent >= 0 ? "#10b981" : "#ef4444"} stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="date" stroke="#64748b" fontSize={10} tickLine={false} />
                      <YAxis domain={["auto", "auto"]} stroke="#64748b" fontSize={10} tickLine={false} />
                      <Tooltip
                        contentStyle={{ backgroundColor: "#0f172a", borderColor: "#334155", borderRadius: "8px", fontSize: "12px" }}
                        formatter={(value: any) => [`₹${Number(value).toFixed(2)}`, "Close Price"]}
                      />
                      <Area
                        type="monotone"
                        dataKey="close"
                        stroke={plotResponse.data.summary.returnPercent >= 0 ? "#10b981" : "#ef4444"}
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#plotGradient)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : (
              <div className="h-64 flex flex-col items-center justify-center text-xs text-muted-foreground">
                <Info className="h-6 w-6 text-muted-foreground mb-2" />
                Historical trading sessions being plotted into database cache.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Regulatory Disclaimer (FASP-AI v1.0) ── */}
      <div className="rounded-lg bg-muted/30 border border-border/40 p-3 text-[11px] text-muted-foreground space-y-1">
        <p className="font-semibold text-foreground flex items-center gap-1">
          <Info className="h-3.5 w-3.5 text-amber-400" />
          SEBI Compliance & Decision Support Notice:
        </p>
        <p>
          FintekPro PRO Stock Lists are designed strictly as an institutional Decision Support System (DSS)
          for SEBI-registered Investment Advisors (RIA) and Research Analysts. The lists do not constitute
          direct portfolio execution or guaranteed return forecasts. Historical prices, ratios, and consensus
          target estimates are subject to market volatility.
        </p>
      </div>
    </div>
  );
}
