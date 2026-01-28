import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  TrendingUp,
  TrendingDown,
  Target,
  Shield,
  Sparkles,
  BarChart3,
  Landmark,
  Building2,
  Globe,
  Coins,
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  Percent,
  History,
  Trophy,
  Bookmark,
  BookmarkCheck,
  Share2,
  Mail,
  MessageSquare,
  Plus,
  Bell,
  BrainCircuit,
  Timer,
  PieChart,
  AlertTriangle,
} from "lucide-react";

interface DailyPick {
  id: number;
  category: string;
  instrumentName: string;
  symbol?: string;
  isin?: string;
  market?: string;
  exchange?: string;
  recoDate: string;
  recoPrice: number;
  targetPrice: number;
  stoplossPrice: number;
  currentPrice?: number;
  status: string;
  expiryDate: string;
  returnPct?: number;
  daysHeld?: number;
  rationale: string;
  riskLevel: string;
  suitableFor: string[];
  keyMetrics?: Record<string, any>;
  timeHorizon?: 'short_term' | 'medium_term' | 'long_term';
  confidenceScore?: number;
  sectorCategory?: string;
}

interface WatchlistItem {
  id: number;
  pickId: number;
  priceAlertEnabled: boolean;
  alertThreshold?: string;
  alertType?: string;
  addedAt: string;
  pick?: DailyPick;
}

interface DiversificationData {
  sectorAllocation: Record<string, { count: number; percentage: number }>;
  concentrationRisk: string;
  diversificationScore: number;
  recommendations: string[];
}

interface PickStats {
  totalPicks: number;
  livePicks: number;
  targetHits: number;
  stoplossHits: number;
  expired: number;
  hitRate: number;
  avgReturn: number;
  byCategory: Record<string, { total: number; hits: number; hitRate: number }>;
}

const categoryIcons: Record<string, any> = {
  listed_stocks: TrendingUp,
  mutual_funds: BarChart3,
  bonds: Landmark,
  unlisted: Building2,
  global_stocks: Globe,
  etfs: Coins,
  reits_invits: Building2,
  fixed_deposits: Shield,
  sgb: Coins,
};

const categoryLabels: Record<string, string> = {
  listed_stocks: "Stocks",
  mutual_funds: "Mutual Funds",
  bonds: "Bonds",
  unlisted: "Unlisted",
  global_stocks: "Global Stocks",
  etfs: "ETFs",
  reits_invits: "REITs/InvITs",
  fixed_deposits: "Fixed Deposits",
  sgb: "SGBs",
};

const statusConfig: Record<string, { color: string; icon: any; label: string }> = {
  live: { color: "bg-green-500", icon: Clock, label: "Live" },
  target_hit: { color: "bg-blue-500", icon: CheckCircle, label: "Target Hit" },
  stoploss_hit: { color: "bg-red-500", icon: XCircle, label: "Stoploss Hit" },
  expired: { color: "bg-gray-500", icon: AlertCircle, label: "Expired" },
};

const riskColors: Record<string, string> = {
  low: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
  high: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
};

const horizonConfig: Record<string, { label: string; color: string; icon: string }> = {
  short_term: { label: "Short Term", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300", icon: "⚡" },
  medium_term: { label: "Medium Term", color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300", icon: "📊" },
  long_term: { label: "Long Term", color: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300", icon: "🎯" },
};

const getConfidenceColor = (score: number) => {
  if (score >= 80) return "text-green-600";
  if (score >= 60) return "text-yellow-600";
  return "text-red-600";
};

const getConfidenceDot = (score: number) => {
  if (score >= 80) return "bg-green-500";
  if (score >= 60) return "bg-yellow-500";
  return "bg-red-500";
};

const allCategories = [
  { key: "all", label: "All", icon: Sparkles },
  { key: "listed_stocks", label: "Stocks", icon: TrendingUp },
  { key: "mutual_funds", label: "Mutual Funds", icon: BarChart3 },
  { key: "bonds", label: "Bonds", icon: Landmark },
  { key: "unlisted", label: "Unlisted", icon: Building2 },
  { key: "global_stocks", label: "Global", icon: Globe },
  { key: "etfs", label: "ETFs", icon: Coins },
  { key: "reits_invits", label: "REITs", icon: Building2 },
  { key: "fixed_deposits", label: "FDs", icon: Shield },
  { key: "sgb", label: "SGBs", icon: Coins },
];

const marketFilters = [
  { key: "all", label: "All Markets" },
  { key: "us", label: "US Stocks" },
  { key: "china", label: "China Stocks" },
  { key: "uk_europe", label: "UK/Europe" },
  { key: "japan", label: "Japan" },
  { key: "other", label: "Other Markets" },
];

export default function AgentPicksPage() {
  const { toast } = useToast();
  const [todayCategoryFilter, setTodayCategoryFilter] = useState<string>("all");
  const [liveCategoryFilter, setLiveCategoryFilter] = useState<string>("all");
  const [historyCategoryFilter, setHistoryCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [todayMarketFilter, setTodayMarketFilter] = useState<string>("all");
  const [liveMarketFilter, setLiveMarketFilter] = useState<string>("all");
  const [historyMarketFilter, setHistoryMarketFilter] = useState<string>("all");
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [sharePickId, setSharePickId] = useState<number | null>(null);
  const [shareEmail, setShareEmail] = useState("");

  const { data: todayData, isLoading: loadingToday } = useQuery<{ success: boolean; picks: DailyPick[] }>({
    queryKey: ["/api/picks/today"],
  });

  const { data: liveData, isLoading: loadingLive } = useQuery<{ success: boolean; picks: DailyPick[] }>({
    queryKey: ["/api/picks/live"],
  });

  const { data: historyData, isLoading: loadingHistory } = useQuery<{ success: boolean; picks: DailyPick[] }>({
    queryKey: ["/api/picks/history"],
  });

  const { data: statsData, isLoading: loadingStats } = useQuery<{ success: boolean; stats: PickStats }>({
    queryKey: ["/api/picks/stats"],
  });

  const { data: watchlistData, isLoading: loadingWatchlist } = useQuery<{ success: boolean; watchlist: WatchlistItem[] }>({
    queryKey: ["/api/picks/watchlist"],
  });

  const { data: diversificationData } = useQuery<{ success: boolean } & DiversificationData>({
    queryKey: ["/api/picks/diversification"],
  });

  const watchlist = watchlistData?.watchlist || [];
  const watchlistPickIds = new Set(watchlist.map(w => w.pickId));

  const addToWatchlistMutation = useMutation({
    mutationFn: async (pickId: number) => {
      return apiRequest('/api/picks/watchlist/add', {
        method: 'POST',
        body: JSON.stringify({ pickId }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/picks/watchlist'] });
      toast({ title: "Added to Watchlist", description: "Pick added to your watchlist" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add to watchlist", variant: "destructive" });
    },
  });

  const removeFromWatchlistMutation = useMutation({
    mutationFn: async (pickId: number) => {
      return apiRequest(`/api/picks/watchlist/${pickId}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/picks/watchlist'] });
      toast({ title: "Removed from Watchlist", description: "Pick removed from your watchlist" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to remove from watchlist", variant: "destructive" });
    },
  });

  const shareMutation = useMutation({
    mutationFn: async ({ pickId, channel, email }: { pickId: number; channel: 'email' | 'whatsapp'; email?: string }) => {
      return apiRequest('/api/picks/share', {
        method: 'POST',
        body: JSON.stringify({ pickId, channel, recipientEmail: email }),
      });
    },
    onSuccess: (data: any) => {
      if (data.whatsappUrl) {
        window.open(data.whatsappUrl, '_blank');
      }
      toast({ title: "Shared Successfully", description: data.message });
      setShareDialogOpen(false);
      setShareEmail("");
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to share pick", variant: "destructive" });
    },
  });

  const handleShare = (pickId: number, channel: 'email' | 'whatsapp') => {
    if (channel === 'email') {
      setSharePickId(pickId);
      setShareDialogOpen(true);
    } else {
      shareMutation.mutate({ pickId, channel });
    }
  };

  const handleEmailShare = () => {
    if (sharePickId && shareEmail) {
      shareMutation.mutate({ pickId: sharePickId, channel: 'email', email: shareEmail });
    }
  };

  const todayPicks = todayData?.picks || [];
  const livePicks = liveData?.picks || [];
  const historyPicks = historyData?.picks || [];
  const stats = statsData?.stats;

  const filterByMarket = (pick: DailyPick, marketFilter: string) => {
    if (marketFilter === "all") return true;
    return pick.market === marketFilter;
  };

  const filteredTodayPicks = todayPicks.filter(p => {
    if (todayCategoryFilter !== "all" && p.category !== todayCategoryFilter) return false;
    if (todayCategoryFilter === "global_stocks" && !filterByMarket(p, todayMarketFilter)) return false;
    return true;
  });

  const filteredLivePicks = livePicks.filter(p => {
    if (liveCategoryFilter !== "all" && p.category !== liveCategoryFilter) return false;
    if (liveCategoryFilter === "global_stocks" && !filterByMarket(p, liveMarketFilter)) return false;
    return true;
  });

  const filteredHistory = historyPicks.filter((pick) => {
    if (historyCategoryFilter !== "all" && pick.category !== historyCategoryFilter) return false;
    if (historyCategoryFilter === "global_stocks" && !filterByMarket(pick, historyMarketFilter)) return false;
    if (statusFilter !== "all" && pick.status !== statusFilter) return false;
    return true;
  });

  const getCategoryCounts = (picks: DailyPick[]) => {
    const counts: Record<string, number> = { all: picks.length };
    picks.forEach(p => {
      counts[p.category] = (counts[p.category] || 0) + 1;
    });
    return counts;
  };

  const getMarketCounts = (picks: DailyPick[]) => {
    const globalPicks = picks.filter(p => p.category === "global_stocks");
    const counts: Record<string, number> = { all: globalPicks.length };
    globalPicks.forEach(p => {
      if (p.market) {
        counts[p.market] = (counts[p.market] || 0) + 1;
      }
    });
    return counts;
  };

  const todayCounts = getCategoryCounts(todayPicks);
  const liveCounts = getCategoryCounts(livePicks);
  const historyCounts = getCategoryCounts(historyPicks);

  const todayMarketCounts = getMarketCounts(todayPicks);
  const liveMarketCounts = getMarketCounts(livePicks);
  const historyMarketCounts = getMarketCounts(historyPicks);

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-yellow-500" />
            Pick of the Day
          </h1>
          <p className="text-muted-foreground">
            AI-powered daily investment recommendations with full tracking
          </p>
        </div>
      </div>

      {/* Performance Stats */}
      {loadingStats ? (
        <div className="grid gap-4 md:grid-cols-5">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : stats ? (
        <div className="grid gap-4 md:grid-cols-5">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Total Picks</span>
              </div>
              <div className="text-2xl font-bold mt-1">{stats.totalPicks}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-green-500" />
                <span className="text-sm text-muted-foreground">Live</span>
              </div>
              <div className="text-2xl font-bold mt-1 text-green-600">{stats.livePicks}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Trophy className="h-4 w-4 text-blue-500" />
                <span className="text-sm text-muted-foreground">Target Hits</span>
              </div>
              <div className="text-2xl font-bold mt-1 text-blue-600">{stats.targetHits}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-orange-500" />
                <span className="text-sm text-muted-foreground">Hit Rate</span>
              </div>
              <div className="text-2xl font-bold mt-1">{stats.hitRate}%</div>
              <Progress value={stats.hitRate} className="mt-2 h-1" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Percent className="h-4 w-4 text-purple-500" />
                <span className="text-sm text-muted-foreground">Avg Return</span>
              </div>
              <div className={`text-2xl font-bold mt-1 ${stats.avgReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {stats.avgReturn >= 0 ? '+' : ''}{stats.avgReturn}%
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      <Tabs defaultValue="today" className="space-y-4">
        <ScrollableTabsList>
          <TabsTrigger value="today" className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Today's Picks
          </TabsTrigger>
          <TabsTrigger value="live" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Live Recommendations
          </TabsTrigger>
          <TabsTrigger value="watchlist" className="flex items-center gap-2">
            <Bookmark className="h-4 w-4" />
            My Watchlist
            {watchlist.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-[10px] px-1.5">{watchlist.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            History & Performance
          </TabsTrigger>
        </ScrollableTabsList>

        <TabsContent value="today" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Today's Top Picks</CardTitle>
              <CardDescription>
                AI-selected investment opportunities for {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Category Filter Tabs */}
              <div className="flex flex-wrap gap-2 mb-4 pb-4 border-b">
                {allCategories.map(({ key, label, icon: Icon }) => {
                  const count = todayCounts[key] || 0;
                  const isActive = todayCategoryFilter === key;
                  return (
                    <Button
                      key={key}
                      variant={isActive ? "default" : "outline"}
                      size="sm"
                      onClick={() => setTodayCategoryFilter(key)}
                      className="flex items-center gap-1.5"
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {label}
                      {count > 0 && (
                        <Badge variant={isActive ? "secondary" : "outline"} className="ml-1 text-[10px] px-1.5">
                          {count}
                        </Badge>
                      )}
                    </Button>
                  );
                })}
              </div>

              {/* Market Filter for Global Stocks */}
              {todayCategoryFilter === "global_stocks" && (
                <div className="flex flex-wrap gap-2 mb-4 pb-4 border-b">
                  <span className="text-sm text-muted-foreground mr-2 self-center">Market:</span>
                  {marketFilters.map(({ key, label }) => {
                    const count = todayMarketCounts[key] || 0;
                    const isActive = todayMarketFilter === key;
                    return (
                      <Button
                        key={key}
                        variant={isActive ? "secondary" : "ghost"}
                        size="sm"
                        onClick={() => setTodayMarketFilter(key)}
                        className="text-xs"
                      >
                        {label}
                        {count > 0 && (
                          <Badge variant="outline" className="ml-1 text-[10px] px-1">
                            {count}
                          </Badge>
                        )}
                      </Button>
                    );
                  })}
                </div>
              )}

              {loadingToday ? (
                <div className="space-y-4">
                  {[1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} className="h-32" />
                  ))}
                </div>
              ) : filteredTodayPicks.length === 0 ? (
                <div className="text-center py-12">
                  <Sparkles className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <h3 className="text-lg font-medium mb-2">No Picks {todayCategoryFilter !== 'all' ? `for ${categoryLabels[todayCategoryFilter] || todayCategoryFilter}` : 'Yet Today'}</h3>
                  <p className="text-muted-foreground">
                    Picks are generated automatically each morning based on market analysis
                  </p>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {filteredTodayPicks.map((pick, index) => (
                    <PickCard 
                      key={`today-${pick.id}-${index}`} 
                      pick={pick}
                      isWatchlisted={watchlistPickIds.has(pick.id)}
                      onAddToWatchlist={(id) => addToWatchlistMutation.mutate(id)}
                      onRemoveFromWatchlist={(id) => removeFromWatchlistMutation.mutate(id)}
                      onShareEmail={(id) => handleShare(id, 'email')}
                      onShareWhatsApp={(id) => handleShare(id, 'whatsapp')}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="live" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Live Recommendations</CardTitle>
              <CardDescription>
                Active picks being tracked for target/stoploss
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Category Filter Tabs */}
              <div className="flex flex-wrap gap-2 mb-4 pb-4 border-b">
                {allCategories.map(({ key, label, icon: Icon }) => {
                  const count = liveCounts[key] || 0;
                  const isActive = liveCategoryFilter === key;
                  return (
                    <Button
                      key={key}
                      variant={isActive ? "default" : "outline"}
                      size="sm"
                      onClick={() => setLiveCategoryFilter(key)}
                      className="flex items-center gap-1.5"
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {label}
                      {count > 0 && (
                        <Badge variant={isActive ? "secondary" : "outline"} className="ml-1 text-[10px] px-1.5">
                          {count}
                        </Badge>
                      )}
                    </Button>
                  );
                })}
              </div>

              {/* Market Filter for Global Stocks */}
              {liveCategoryFilter === "global_stocks" && (
                <div className="flex flex-wrap gap-2 mb-4 pb-4 border-b">
                  <span className="text-sm text-muted-foreground mr-2 self-center">Market:</span>
                  {marketFilters.map(({ key, label }) => {
                    const count = liveMarketCounts[key] || 0;
                    const isActive = liveMarketFilter === key;
                    return (
                      <Button
                        key={key}
                        variant={isActive ? "secondary" : "ghost"}
                        size="sm"
                        onClick={() => setLiveMarketFilter(key)}
                        className="text-xs"
                      >
                        {label}
                        {count > 0 && (
                          <Badge variant="outline" className="ml-1 text-[10px] px-1">
                            {count}
                          </Badge>
                        )}
                      </Button>
                    );
                  })}
                </div>
              )}

              {loadingLive ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-32" />
                  ))}
                </div>
              ) : filteredLivePicks.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No live recommendations {liveCategoryFilter !== 'all' ? `for ${categoryLabels[liveCategoryFilter] || liveCategoryFilter}` : 'at the moment'}
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredLivePicks.map((pick, index) => (
                    <PickCard 
                      key={`live-${pick.id}-${index}`} 
                      pick={pick} 
                      showDetails
                      isWatchlisted={watchlistPickIds.has(pick.id)}
                      onAddToWatchlist={(id) => addToWatchlistMutation.mutate(id)}
                      onRemoveFromWatchlist={(id) => removeFromWatchlistMutation.mutate(id)}
                      onShareEmail={(id) => handleShare(id, 'email')}
                      onShareWhatsApp={(id) => handleShare(id, 'whatsapp')}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <CardTitle>Pick History</CardTitle>
                  <CardDescription>Track the performance of past recommendations</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="live">Live</SelectItem>
                      <SelectItem value="target_hit">Target Hit</SelectItem>
                      <SelectItem value="stoploss_hit">Stoploss Hit</SelectItem>
                      <SelectItem value="expired">Expired</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Category Filter Tabs */}
              <div className="flex flex-wrap gap-2 mb-4 pb-4 border-b">
                {allCategories.map(({ key, label, icon: Icon }) => {
                  const count = historyCounts[key] || 0;
                  const isActive = historyCategoryFilter === key;
                  return (
                    <Button
                      key={key}
                      variant={isActive ? "default" : "outline"}
                      size="sm"
                      onClick={() => setHistoryCategoryFilter(key)}
                      className="flex items-center gap-1.5"
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {label}
                      {count > 0 && (
                        <Badge variant={isActive ? "secondary" : "outline"} className="ml-1 text-[10px] px-1.5">
                          {count}
                        </Badge>
                      )}
                    </Button>
                  );
                })}
              </div>

              {/* Market Filter for Global Stocks */}
              {historyCategoryFilter === "global_stocks" && (
                <div className="flex flex-wrap gap-2 mb-4 pb-4 border-b">
                  <span className="text-sm text-muted-foreground mr-2 self-center">Market:</span>
                  {marketFilters.map(({ key, label }) => {
                    const count = historyMarketCounts[key] || 0;
                    const isActive = historyMarketFilter === key;
                    return (
                      <Button
                        key={key}
                        variant={isActive ? "secondary" : "ghost"}
                        size="sm"
                        onClick={() => setHistoryMarketFilter(key)}
                        className="text-xs"
                      >
                        {label}
                        {count > 0 && (
                          <Badge variant="outline" className="ml-1 text-[10px] px-1">
                            {count}
                          </Badge>
                        )}
                      </Button>
                    );
                  })}
                </div>
              )}

              {loadingHistory ? (
                <div className="space-y-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-24" />
                  ))}
                </div>
              ) : filteredHistory.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  No picks found for the selected filters
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredHistory.map((pick, index) => (
                    <PickCard key={`history-${pick.id}-${index}`} pick={pick} showDetails compact />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="watchlist" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bookmark className="h-5 w-5" />
                    My Watchlist
                  </CardTitle>
                  <CardDescription>
                    Track picks you're interested in with price alerts
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingWatchlist ? (
                    <div className="space-y-4">
                      {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-24" />
                      ))}
                    </div>
                  ) : watchlist.length === 0 ? (
                    <div className="text-center py-12">
                      <Bookmark className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                      <h3 className="text-lg font-medium mb-2">No Picks in Watchlist</h3>
                      <p className="text-muted-foreground text-sm">
                        Add picks to your watchlist to track them and set price alerts
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {watchlist.map((item) => (
                        <div key={item.id} className="flex items-center gap-4 p-3 rounded-lg border hover:bg-accent/50 transition-colors">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium truncate">Pick #{item.pickId}</span>
                              {item.priceAlertEnabled && (
                                <Badge variant="outline" className="text-[10px]">
                                  <Bell className="h-3 w-3 mr-1" />
                                  Alert Active
                                </Badge>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              Added {new Date(item.addedAt).toLocaleDateString('en-IN')}
                              {item.alertType && ` • Alert: ${item.alertType}`}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeFromWatchlistMutation.mutate(item.pickId)}
                          >
                            <XCircle className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4">
              {diversificationData && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <PieChart className="h-5 w-5" />
                      Sector Diversification
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Diversification Score</span>
                      <span className="font-bold">{diversificationData.diversificationScore}/100</span>
                    </div>
                    <Progress value={diversificationData.diversificationScore} className="h-2" />
                    
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-sm">Concentration Risk:</span>
                      <Badge variant={
                        diversificationData.concentrationRisk === 'low' ? 'default' :
                        diversificationData.concentrationRisk === 'medium' ? 'secondary' : 'destructive'
                      }>
                        {diversificationData.concentrationRisk}
                      </Badge>
                    </div>

                    {diversificationData.recommendations?.length > 0 && (
                      <div className="mt-3 pt-3 border-t">
                        <div className="text-sm font-medium mb-2 flex items-center gap-1">
                          <AlertTriangle className="h-4 w-4 text-yellow-500" />
                          Recommendations
                        </div>
                        <ul className="text-xs text-muted-foreground space-y-1">
                          {diversificationData.recommendations.slice(0, 3).map((rec, i) => (
                            <li key={i}>• {rec}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share Pick via Email</DialogTitle>
            <DialogDescription>
              Enter the recipient's email address to share this investment pick.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="client@example.com"
                value={shareEmail}
                onChange={(e) => setShareEmail(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShareDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleEmailShare} disabled={!shareEmail || shareMutation.isPending}>
              {shareMutation.isPending ? "Sending..." : "Send Email"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface PickCardProps {
  pick: DailyPick;
  showDetails?: boolean;
  compact?: boolean;
  isWatchlisted?: boolean;
  onAddToWatchlist?: (pickId: number) => void;
  onRemoveFromWatchlist?: (pickId: number) => void;
  onShareEmail?: (pickId: number) => void;
  onShareWhatsApp?: (pickId: number) => void;
}

function PickCard({ 
  pick, 
  showDetails = false, 
  compact = false,
  isWatchlisted = false,
  onAddToWatchlist,
  onRemoveFromWatchlist,
  onShareEmail,
  onShareWhatsApp,
}: PickCardProps) {
  const Icon = categoryIcons[pick.category] || TrendingUp;
  const status = statusConfig[pick.status] || statusConfig.live;
  const StatusIcon = status.icon;
  const horizon = pick.timeHorizon ? horizonConfig[pick.timeHorizon] : null;
  
  const upside = ((pick.targetPrice - pick.recoPrice) / pick.recoPrice * 100).toFixed(1);
  const downside = ((pick.recoPrice - pick.stoplossPrice) / pick.recoPrice * 100).toFixed(1);
  const currentReturn = pick.currentPrice 
    ? ((pick.currentPrice - pick.recoPrice) / pick.recoPrice * 100).toFixed(1)
    : null;

  if (compact) {
    return (
      <div className="flex items-center gap-4 p-3 rounded-lg border hover:bg-accent/50 transition-colors">
        <div className={`p-2 rounded-full ${status.color} text-white`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium truncate">{pick.instrumentName}</span>
            <Badge variant="outline" className="text-[10px]">
              {categoryLabels[pick.category]}
            </Badge>
            {pick.confidenceScore !== undefined && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <span className={`text-[10px] font-medium flex items-center gap-0.5 ${getConfidenceColor(pick.confidenceScore)}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${getConfidenceDot(pick.confidenceScore)}`} />
                      {pick.confidenceScore}%
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>AI Confidence Score</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
            <span>Reco: ₹{pick.recoPrice.toLocaleString()}</span>
            <span>Target: ₹{pick.targetPrice.toLocaleString()}</span>
            <span>{new Date(pick.recoDate).toLocaleDateString('en-IN')}</span>
          </div>
        </div>
        <div className="text-right">
          <Badge className={status.color}>{status.label}</Badge>
          {currentReturn && (
            <div className={`text-sm font-medium mt-1 ${parseFloat(currentReturn) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {parseFloat(currentReturn) >= 0 ? '+' : ''}{currentReturn}%
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className={`h-1 ${status.color}`} />
      <CardContent className="pt-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-full bg-primary/10">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">{pick.instrumentName}</h3>
                <div className="flex items-center gap-2 flex-wrap">
                  {pick.symbol && (
                    <span className="text-sm text-muted-foreground font-mono">{pick.symbol}</span>
                  )}
                  {pick.exchange && ['listed_stocks', 'reits_invits', 'etfs', 'global_stocks', 'bonds'].includes(pick.category) && (
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      pick.category === 'global_stocks' 
                        ? 'bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200'
                        : 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
                    }`}>{pick.exchange}</span>
                  )}
                  {pick.isin && pick.category === 'mutual_funds' && (
                    <span className="text-xs text-muted-foreground font-mono">ISIN: {pick.isin}</span>
                  )}
                  {pick.isin && pick.category === 'bonds' && (
                    <span className="text-xs text-muted-foreground font-mono">ISIN: {pick.isin}</span>
                  )}
                  {pick.category === 'unlisted' && pick.keyMetrics?.cin && (
                    <span className="text-xs text-orange-600 dark:text-orange-400 font-mono">CIN: {pick.keyMetrics.cin}</span>
                  )}
                  {pick.category === 'sgb' && pick.keyMetrics?.seriesCode && (
                    <span className="text-xs bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 px-1.5 py-0.5 rounded">Series: {pick.keyMetrics.seriesCode}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {pick.confidenceScore !== undefined && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-muted">
                          <BrainCircuit className="h-3 w-3" />
                          <span className={`text-xs font-medium ${getConfidenceColor(pick.confidenceScore)}`}>
                            {pick.confidenceScore}%
                          </span>
                          <span className={`w-2 h-2 rounded-full ${getConfidenceDot(pick.confidenceScore)}`} />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>AI Confidence Score</p>
                        <p className="text-xs text-muted-foreground">
                          {pick.confidenceScore >= 80 ? 'High confidence' : 
                           pick.confidenceScore >= 60 ? 'Moderate confidence' : 'Lower confidence'}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                <Badge className={`${status.color} text-white`}>
                  <StatusIcon className="h-3 w-3 mr-1" />
                  {status.label}
                </Badge>
              </div>
            </div>

            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {horizon && (
                <Badge variant="outline" className={horizon.color}>
                  <Timer className="h-3 w-3 mr-1" />
                  {horizon.label}
                </Badge>
              )}
              {pick.sectorCategory && (
                <Badge variant="secondary" className="text-xs">
                  {pick.sectorCategory}
                </Badge>
              )}
            </div>

            <div className="grid grid-cols-3 gap-4 mt-4">
              <div>
                <div className="text-xs text-muted-foreground">Entry Price</div>
                <div className="font-medium">₹{pick.recoPrice.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <ArrowUpRight className="h-3 w-3 text-green-500" />
                  Target (+{upside}%)
                </div>
                <div className="font-medium text-green-600">₹{pick.targetPrice.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <ArrowDownRight className="h-3 w-3 text-red-500" />
                  Stoploss (-{downside}%)
                </div>
                <div className="font-medium text-red-600">₹{pick.stoplossPrice.toLocaleString()}</div>
              </div>
            </div>

            {pick.currentPrice && (
              <div className="mt-3 p-2 rounded bg-muted/50">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Current: ₹{pick.currentPrice.toLocaleString()}</span>
                  <span className={`font-medium ${parseFloat(currentReturn || '0') >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {parseFloat(currentReturn || '0') >= 0 ? '+' : ''}{currentReturn}%
                  </span>
                </div>
                {pick.daysHeld !== undefined && (
                  <div className="text-xs text-muted-foreground mt-1">
                    Holding for {pick.daysHeld} days
                  </div>
                )}
              </div>
            )}

            <p className="text-sm text-muted-foreground mt-3">{pick.rationale}</p>

            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <Badge variant="outline" className={riskColors[pick.riskLevel] || riskColors.medium}>
                {pick.riskLevel} risk
              </Badge>
              {pick.suitableFor?.map((profile) => (
                <Badge key={profile} variant="secondary" className="text-xs">
                  {profile}
                </Badge>
              ))}
            </div>

            {showDetails && pick.keyMetrics && (
              <div className="mt-3 pt-3 border-t grid grid-cols-4 gap-2 text-xs">
                {Object.entries(pick.keyMetrics).slice(0, 4).map(([key, value]) => (
                  <div key={key}>
                    <span className="text-muted-foreground capitalize">{key.replace(/([A-Z])/g, ' $1')}: </span>
                    <span className="font-medium">{typeof value === 'number' ? value.toFixed(2) : value}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between mt-3 pt-3 border-t">
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {new Date(pick.recoDate).toLocaleDateString('en-IN')}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Valid till {new Date(pick.expiryDate).toLocaleDateString('en-IN')}
                </span>
              </div>
              
              <div className="flex items-center gap-1">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => isWatchlisted ? onRemoveFromWatchlist?.(pick.id) : onAddToWatchlist?.(pick.id)}
                      >
                        {isWatchlisted ? (
                          <BookmarkCheck className="h-4 w-4 text-primary" />
                        ) : (
                          <Bookmark className="h-4 w-4" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{isWatchlisted ? 'Remove from Watchlist' : 'Add to Watchlist'}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => onShareEmail?.(pick.id)}
                      >
                        <Mail className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Share via Email</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => onShareWhatsApp?.(pick.id)}
                      >
                        <MessageSquare className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Share via WhatsApp</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
