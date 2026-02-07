import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  ArrowLeft, Search, Loader2, TrendingUp, CheckCircle, 
  AlertCircle, Package, BarChart3, Building2,
  RefreshCw, Eye, EyeOff, Download, Clock
} from "lucide-react";
import { Link } from "wouter";

interface ListedStock {
  id: string;
  symbol: string;
  companyName: string;
  isin?: string;
  bseCode?: string;
  nseCode?: string;
  sector?: string;
  industry?: string;
  marketCap?: string;
  currentPrice?: string;
  peRatio?: string;
  pbRatio?: string;
  dividendYield?: string;
  returns1Y?: string;
  returns3Y?: string;
  analystRating?: string;
  targetPrice?: string;
  isPublished: boolean;
  lastUpdated?: string;
  broadSector?: string;
  enrichmentStatus?: string;
  cin?: string;
  companyPan?: string;
}

interface SyncProgress {
  exchange: 'NSE' | 'BSE';
  status: 'idle' | 'fetching_symbols' | 'fetching_details' | 'saving' | 'complete' | 'error';
  total: number;
  processed: number;
  added: number;
  updated: number;
  errors: number;
  startedAt?: string;
  completedAt?: string;
  errorMessage?: string;
}

interface EnrichmentStats {
  total: number;
  withCin: number;
  withPan: number;
  withBroadSector: number;
  withPe: number;
  pending: number;
  complete: number;
  failed: number;
}

const BROAD_SECTORS = [
  'Technology',
  'Banking & Finance',
  'Healthcare & Pharma',
  'Manufacturing',
  'Infrastructure & Construction',
  'Consumer Goods & Retail',
  'Energy & Utilities',
  'Metals & Mining',
  'Chemicals',
  'Real Estate',
  'Services',
  'Others'
];

// Legacy sectors (for backward compatibility)
const SECTORS = [
  'Information Technology',
  'Financial Services',
  'Healthcare',
  'Consumer Goods',
  'Automobile',
  'Energy',
  'Metals & Mining',
  'Pharmaceuticals',
  'Telecommunications',
  'Real Estate',
  'Utilities',
  'Infrastructure',
  'FMCG',
  'Banking',
  'Insurance'
];

const MARKET_CAPS = ['Large Cap', 'Mid Cap', 'Small Cap', 'Micro Cap'];

export default function ListedStocksSeed() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [sectorFilter, setSectorFilter] = useState<string>("all");
  const [broadSectorFilter, setBroadSectorFilter] = useState<string>("all");
  const [marketCapFilter, setMarketCapFilter] = useState<string>("all");
  const [exchangeFilter, setExchangeFilter] = useState<string>("all");
  const [selectedStocks, setSelectedStocks] = useState<Set<string>>(new Set());
  const [nseProgress, setNseProgress] = useState<SyncProgress | null>(null);
  const [bseProgress, setBseProgress] = useState<SyncProgress | null>(null);

  const { data: stocks, isLoading, refetch } = useQuery<ListedStock[]>({
    queryKey: ['/api/admin/listed-stocks'],
  });

  // Enrichment stats query
  const { data: enrichmentStats, refetch: refetchEnrichmentStats } = useQuery<EnrichmentStats>({
    queryKey: ['/api/admin/stocks/enrichment/stats'],
  });

  // Enrichment mutation
  const enrichMutation = useMutation({
    mutationFn: () => apiRequest('/api/admin/stocks/enrichment/start', 'POST'),
    onSuccess: () => {
      toast({
        title: "Enrichment Started",
        description: "Stock data enrichment is now running in the background.",
      });
      refetchEnrichmentStats();
    },
    onError: (error: any) => {
      toast({
        title: "Enrichment Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Poll for sync progress when syncing
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    
    const pollProgress = async () => {
      try {
        const [nseRes, bseRes] = await Promise.all([
          fetch('/api/admin/exchange-sync/progress/nse').then(r => r.json()),
          fetch('/api/admin/exchange-sync/progress/bse').then(r => r.json())
        ]);
        setNseProgress(nseRes);
        setBseProgress(bseRes);

        // Refetch stocks when sync completes
        if (nseRes.status === 'complete' || bseRes.status === 'complete') {
          refetch();
        }

        // Stop polling if both are idle/complete/error
        const nseActive = ['fetching_symbols', 'fetching_details', 'saving'].includes(nseRes.status);
        const bseActive = ['fetching_symbols', 'fetching_details', 'saving'].includes(bseRes.status);
        if (!nseActive && !bseActive && interval) {
          clearInterval(interval);
          interval = null;
        }
      } catch (error) {
        console.error('Error polling sync progress:', error);
      }
    };

    // Initial fetch
    pollProgress();

    // Start polling
    interval = setInterval(pollProgress, 2000);

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [refetch]);

  const syncNSEMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('/api/admin/exchange-sync/nse', {
        method: 'POST',
        body: JSON.stringify({ topOnly: false }),
      });
    },
    onSuccess: () => {
      toast({ title: "NSE Sync Started", description: "Fetching all NSE stocks. This may take several minutes..." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to start NSE sync", variant: "destructive" });
    }
  });

  const syncBSEMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('/api/admin/exchange-sync/bse', {
        method: 'POST',
        body: JSON.stringify({ topOnly: false }),
      });
    },
    onSuccess: () => {
      toast({ title: "BSE Sync Started", description: "Fetching all BSE stocks. This may take several minutes..." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to start BSE sync", variant: "destructive" });
    }
  });

  const togglePublishMutation = useMutation({
    mutationFn: async ({ id, isPublished }: { id: string; isPublished: boolean }) => {
      return await apiRequest(`/api/admin/listed-stocks/${id}/publish`, {
        method: 'PATCH',
        body: JSON.stringify({ isPublished }),
      });
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Stock updated successfully" });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/listed-stocks'] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update stock", variant: "destructive" });
    }
  });

  const bulkPublishMutation = useMutation({
    mutationFn: async ({ ids, isPublished }: { ids: string[]; isPublished: boolean }) => {
      return await apiRequest('/api/admin/listed-stocks/bulk-publish', {
        method: 'PATCH',
        body: JSON.stringify({ ids, isPublished }),
      });
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Stocks updated successfully" });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/listed-stocks'] });
      setSelectedStocks(new Set());
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update stocks", variant: "destructive" });
    }
  });

  const filteredStocks = stocks?.filter(stock => {
    const matchesSearch = searchQuery === "" || 
      stock.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
      stock.companyName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSector = sectorFilter === "all" || stock.sector === sectorFilter;
    const matchesBroadSector = broadSectorFilter === "all" || stock.broadSector === broadSectorFilter;
    const matchesMarketCap = marketCapFilter === "all" || stock.marketCap === marketCapFilter;
    const matchesExchange = exchangeFilter === "all" || 
      (exchangeFilter === "NSE" && stock.nseCode) ||
      (exchangeFilter === "BSE" && stock.bseCode);
    return matchesSearch && matchesSector && matchesBroadSector && matchesMarketCap && matchesExchange;
  }) || [];

  const handleSelectAll = () => {
    if (selectedStocks.size === filteredStocks.length) {
      setSelectedStocks(new Set());
    } else {
      setSelectedStocks(new Set(filteredStocks.map(s => s.id)));
    }
  };

  const handleSelectStock = (id: string) => {
    const newSelected = new Set(selectedStocks);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedStocks(newSelected);
  };

  const getProgressPercent = (progress: SyncProgress | null) => {
    if (!progress || progress.total === 0) return 0;
    return Math.round((progress.processed / progress.total) * 100);
  };

  const isSyncing = (progress: SyncProgress | null) => {
    return progress && ['fetching_symbols', 'fetching_details', 'saving'].includes(progress.status);
  };

  const publishedCount = stocks?.filter(s => s.isPublished).length || 0;
  const totalCount = stocks?.length || 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 text-foreground p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link href="/admin/store-management">
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground" data-testid="button-back">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Store
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <TrendingUp className="h-6 w-6 text-green-400" />
                Listed Stocks - Exchange Sync
              </h1>
              <p className="text-muted-foreground text-sm">Sync stock data from NSE and BSE exchanges</p>
            </div>
          </div>
          <Button onClick={() => refetch()} variant="outline" size="sm" data-testid="button-refresh">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Exchange Sync Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* NSE Sync Card */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-blue-500/20">
                    <Building2 className="h-5 w-5 text-blue-400" />
                  </div>
                  <div>
                    <CardTitle className="text-lg text-foreground">NSE Exchange</CardTitle>
                    <CardDescription className="text-muted-foreground">National Stock Exchange</CardDescription>
                  </div>
                </div>
                <Button 
                  onClick={() => syncNSEMutation.mutate()}
                  disabled={isSyncing(nseProgress) || syncNSEMutation.isPending}
                  className="bg-blue-600 hover:bg-blue-700"
                  data-testid="button-sync-nse"
                >
                  {isSyncing(nseProgress) ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4 mr-2" />
                  )}
                  {isSyncing(nseProgress) ? 'Syncing...' : 'Sync NSE'}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {nseProgress && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Status:</span>
                    <Badge variant={nseProgress.status === 'complete' ? 'default' : nseProgress.status === 'error' ? 'destructive' : 'secondary'}>
                      {nseProgress.status === 'complete' ? 'Complete' : 
                       nseProgress.status === 'error' ? 'Error' :
                       nseProgress.status === 'idle' ? 'Ready' :
                       'Syncing...'}
                    </Badge>
                  </div>
                  {isSyncing(nseProgress) && (
                    <>
                      <Progress value={getProgressPercent(nseProgress)} className="h-2" />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Processing: {nseProgress.processed}/{nseProgress.total}</span>
                        <span>{getProgressPercent(nseProgress)}%</span>
                      </div>
                    </>
                  )}
                  {nseProgress.status === 'complete' && (
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="p-2 rounded bg-green-500/20">
                        <div className="text-green-400 font-semibold">{nseProgress.added}</div>
                        <div className="text-xs text-muted-foreground">Synced</div>
                      </div>
                      <div className="p-2 rounded bg-yellow-500/20">
                        <div className="text-yellow-400 font-semibold">{nseProgress.updated}</div>
                        <div className="text-xs text-muted-foreground">Updated</div>
                      </div>
                      <div className="p-2 rounded bg-red-500/20">
                        <div className="text-red-400 font-semibold">{nseProgress.errors}</div>
                        <div className="text-xs text-muted-foreground">Errors</div>
                      </div>
                    </div>
                  )}
                  {nseProgress.completedAt && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      Last sync: {new Date(nseProgress.completedAt).toLocaleString()}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* BSE Sync Card */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-orange-500/20">
                    <BarChart3 className="h-5 w-5 text-orange-400" />
                  </div>
                  <div>
                    <CardTitle className="text-lg text-foreground">BSE Exchange</CardTitle>
                    <CardDescription className="text-muted-foreground">Bombay Stock Exchange</CardDescription>
                  </div>
                </div>
                <Button 
                  onClick={() => syncBSEMutation.mutate()}
                  disabled={isSyncing(bseProgress) || syncBSEMutation.isPending}
                  className="bg-orange-600 hover:bg-orange-700"
                  data-testid="button-sync-bse"
                >
                  {isSyncing(bseProgress) ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4 mr-2" />
                  )}
                  {isSyncing(bseProgress) ? 'Syncing...' : 'Sync BSE'}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {bseProgress && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Status:</span>
                    <Badge variant={bseProgress.status === 'complete' ? 'default' : bseProgress.status === 'error' ? 'destructive' : 'secondary'}>
                      {bseProgress.status === 'complete' ? 'Complete' : 
                       bseProgress.status === 'error' ? 'Error' :
                       bseProgress.status === 'idle' ? 'Ready' :
                       'Syncing...'}
                    </Badge>
                  </div>
                  {isSyncing(bseProgress) && (
                    <>
                      <Progress value={getProgressPercent(bseProgress)} className="h-2" />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Processing: {bseProgress.processed}/{bseProgress.total}</span>
                        <span>{getProgressPercent(bseProgress)}%</span>
                      </div>
                    </>
                  )}
                  {bseProgress.status === 'complete' && (
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="p-2 rounded bg-green-500/20">
                        <div className="text-green-400 font-semibold">{bseProgress.added}</div>
                        <div className="text-xs text-muted-foreground">Synced</div>
                      </div>
                      <div className="p-2 rounded bg-yellow-500/20">
                        <div className="text-yellow-400 font-semibold">{bseProgress.updated}</div>
                        <div className="text-xs text-muted-foreground">Updated</div>
                      </div>
                      <div className="p-2 rounded bg-red-500/20">
                        <div className="text-red-400 font-semibold">{bseProgress.errors}</div>
                        <div className="text-xs text-muted-foreground">Errors</div>
                      </div>
                    </div>
                  )}
                  {bseProgress.completedAt && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      Last sync: {new Date(bseProgress.completedAt).toLocaleString()}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card className="bg-card/50 border-border">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <Package className="h-8 w-8 text-blue-400" />
                <div>
                  <div className="text-2xl font-bold text-foreground">{totalCount}</div>
                  <div className="text-sm text-muted-foreground">Total Stocks</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-border">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-8 w-8 text-green-400" />
                <div>
                  <div className="text-2xl font-bold text-foreground">{publishedCount}</div>
                  <div className="text-sm text-muted-foreground">Published</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-border">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-8 w-8 text-yellow-400" />
                <div>
                  <div className="text-2xl font-bold text-foreground">{totalCount - publishedCount}</div>
                  <div className="text-sm text-muted-foreground">Unpublished</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-border">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <TrendingUp className="h-8 w-8 text-purple-400" />
                <div>
                  <div className="text-2xl font-bold text-foreground">{filteredStocks.length}</div>
                  <div className="text-sm text-muted-foreground">Filtered</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Data Enrichment Card */}
        <Card className="bg-card border-border mb-6">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-purple-500/20">
                  <BarChart3 className="h-5 w-5 text-purple-400" />
                </div>
                <div>
                  <CardTitle className="text-lg text-foreground">Data Enrichment</CardTitle>
                  <CardDescription className="text-muted-foreground">
                    Fill missing PE ratios, CIN, PAN, and BSE codes using external APIs
                  </CardDescription>
                </div>
              </div>
              <Button 
                onClick={() => enrichMutation.mutate()}
                disabled={enrichMutation.isPending}
                className="bg-purple-600 hover:bg-purple-700"
                data-testid="button-enrich"
              >
                {enrichMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                {enrichMutation.isPending ? 'Enriching...' : 'Enrich Missing Data'}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {enrichmentStats && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-muted/50 rounded-lg p-3">
                  <div className="text-sm text-muted-foreground">With Broad Sector</div>
                  <div className="text-xl font-bold text-foreground">{enrichmentStats.withBroadSector}/{enrichmentStats.total}</div>
                  <Progress value={(enrichmentStats.withBroadSector / enrichmentStats.total) * 100} className="h-1 mt-2" />
                </div>
                <div className="bg-muted/50 rounded-lg p-3">
                  <div className="text-sm text-muted-foreground">With PE Ratio</div>
                  <div className="text-xl font-bold text-foreground">{enrichmentStats.withPe}/{enrichmentStats.total}</div>
                  <Progress value={(enrichmentStats.withPe / enrichmentStats.total) * 100} className="h-1 mt-2" />
                </div>
                <div className="bg-muted/50 rounded-lg p-3">
                  <div className="text-sm text-muted-foreground">With CIN</div>
                  <div className="text-xl font-bold text-foreground">{enrichmentStats.withCin}/{enrichmentStats.total}</div>
                  <Progress value={(enrichmentStats.withCin / enrichmentStats.total) * 100} className="h-1 mt-2" />
                </div>
                <div className="bg-muted/50 rounded-lg p-3">
                  <div className="text-sm text-muted-foreground">With PAN</div>
                  <div className="text-xl font-bold text-foreground">{enrichmentStats.withPan}/{enrichmentStats.total}</div>
                  <Progress value={(enrichmentStats.withPan / enrichmentStats.total) * 100} className="h-1 mt-2" />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Filters and Bulk Actions */}
        <Card className="bg-card border-border mb-6">
          <CardContent className="pt-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by symbol or company name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-muted border-border text-foreground"
                  data-testid="input-search"
                />
              </div>
              <Select value={exchangeFilter} onValueChange={setExchangeFilter}>
                <SelectTrigger className="w-[150px] bg-muted border-border text-foreground" data-testid="select-exchange">
                  <SelectValue placeholder="Exchange" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Exchanges</SelectItem>
                  <SelectItem value="NSE">NSE</SelectItem>
                  <SelectItem value="BSE">BSE</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sectorFilter} onValueChange={setSectorFilter}>
                <SelectTrigger className="w-[180px] bg-muted border-border text-foreground" data-testid="select-sector">
                  <SelectValue placeholder="Sector" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sectors</SelectItem>
                  {SECTORS.map(sector => (
                    <SelectItem key={sector} value={sector}>{sector}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={broadSectorFilter} onValueChange={setBroadSectorFilter}>
                <SelectTrigger className="w-[200px] bg-muted border-border text-foreground" data-testid="select-broad-sector">
                  <SelectValue placeholder="Broad Sector" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Broad Sectors</SelectItem>
                  {BROAD_SECTORS.map(sector => (
                    <SelectItem key={sector} value={sector}>{sector}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={marketCapFilter} onValueChange={setMarketCapFilter}>
                <SelectTrigger className="w-[150px] bg-muted border-border text-foreground" data-testid="select-marketcap">
                  <SelectValue placeholder="Market Cap" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Caps</SelectItem>
                  {MARKET_CAPS.map(cap => (
                    <SelectItem key={cap} value={cap}>{cap}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectedStocks.size > 0 && (
                <div className="flex items-center gap-2 ml-auto">
                  <span className="text-sm text-muted-foreground">{selectedStocks.size} selected</span>
                  <Button 
                    size="sm" 
                    onClick={() => bulkPublishMutation.mutate({ ids: Array.from(selectedStocks), isPublished: true })}
                    disabled={bulkPublishMutation.isPending}
                    className="bg-green-600 hover:bg-green-700"
                    data-testid="button-bulk-publish"
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    Publish
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => bulkPublishMutation.mutate({ ids: Array.from(selectedStocks), isPublished: false })}
                    disabled={bulkPublishMutation.isPending}
                    className="border-border"
                    data-testid="button-bulk-unpublish"
                  >
                    <EyeOff className="h-4 w-4 mr-1" />
                    Unpublish
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Stocks Table */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground">Synced Stocks</CardTitle>
            <CardDescription className="text-muted-foreground">
              Manage stocks synced from NSE and BSE exchanges
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
              </div>
            ) : filteredStocks.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No stocks found. Click "Sync NSE" or "Sync BSE" to fetch stocks.</p>
              </div>
            ) : (
              <ScrollArea className="h-[600px]">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border">
                      <TableHead className="w-[50px]">
                        <Checkbox 
                          checked={selectedStocks.size === filteredStocks.length && filteredStocks.length > 0}
                          onCheckedChange={handleSelectAll}
                          data-testid="checkbox-select-all"
                        />
                      </TableHead>
                      <TableHead className="text-muted-foreground">Symbol</TableHead>
                      <TableHead className="text-muted-foreground">Company</TableHead>
                      <TableHead className="text-muted-foreground">Exchange</TableHead>
                      <TableHead className="text-muted-foreground">Sector</TableHead>
                      <TableHead className="text-muted-foreground">Market Cap</TableHead>
                      <TableHead className="text-muted-foreground text-right">Price</TableHead>
                      <TableHead className="text-muted-foreground text-right">P/E</TableHead>
                      <TableHead className="text-muted-foreground text-right">1Y Return</TableHead>
                      <TableHead className="text-muted-foreground">Status</TableHead>
                      <TableHead className="text-muted-foreground w-[100px]">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStocks.map((stock) => (
                      <TableRow key={stock.id} className="border-border hover:bg-muted/50" data-testid={`row-stock-${stock.id}`}>
                        <TableCell>
                          <Checkbox 
                            checked={selectedStocks.has(stock.id)}
                            onCheckedChange={() => handleSelectStock(stock.id)}
                          />
                        </TableCell>
                        <TableCell className="font-medium text-foreground">{stock.symbol}</TableCell>
                        <TableCell className="text-muted-foreground max-w-[200px] truncate">
                          {stock.companyName}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {stock.nseCode && <Badge variant="outline" className="text-blue-400 border-blue-400">NSE</Badge>}
                            {stock.bseCode && <Badge variant="outline" className="text-orange-400 border-orange-400">BSE</Badge>}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{stock.sector || '-'}</TableCell>
                        <TableCell>
                          {stock.marketCap && (
                            <Badge variant="secondary" className={
                              stock.marketCap === 'Large Cap' ? 'bg-blue-500/20 text-blue-400' :
                              stock.marketCap === 'Mid Cap' ? 'bg-yellow-500/20 text-yellow-400' :
                              'bg-purple-500/20 text-purple-400'
                            }>
                              {stock.marketCap}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono text-foreground">
                          {stock.currentPrice ? `₹${parseFloat(stock.currentPrice).toLocaleString()}` : '-'}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {stock.peRatio ? parseFloat(stock.peRatio).toFixed(1) : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          {stock.returns1Y ? (
                            <span className={parseFloat(stock.returns1Y) >= 0 ? 'text-green-400' : 'text-red-400'}>
                              {parseFloat(stock.returns1Y) >= 0 ? '+' : ''}{parseFloat(stock.returns1Y).toFixed(1)}%
                            </span>
                          ) : '-'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={stock.isPublished ? "default" : "secondary"}>
                            {stock.isPublished ? 'Published' : 'Draft'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => togglePublishMutation.mutate({ 
                              id: stock.id, 
                              isPublished: !stock.isPublished 
                            })}
                            disabled={togglePublishMutation.isPending}
                            data-testid={`button-toggle-${stock.id}`}
                          >
                            {stock.isPublished ? (
                              <EyeOff className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <Eye className="h-4 w-4 text-green-400" />
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
