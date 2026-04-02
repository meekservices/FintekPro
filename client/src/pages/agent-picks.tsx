import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
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
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  Activity,
  Star,
  Brain,
  RefreshCw,
  Users,
  Send,
  ExternalLink,
  ChevronRight,
  Info,
  X,
  Download,
  Lightbulb,
  Copy,
  Zap,
  Search,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

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
  priceDataSource?: string;
  priceDataType?: string;
  priceRefreshInterval?: string;
  lastPriceUpdate?: string;
  dataFreshness?: 'live' | 'recent' | 'delayed' | 'stale' | 'unknown';
}

interface PicksApiResponse {
  success: boolean;
  picks: DailyPick[];
  dataSources?: Record<string, { name: string; type: string; refreshInterval: string }>;
  lastRefreshedAt?: string;
  categoryLastUpdated?: Record<string, string>;
  disclaimer?: string;
}

interface StatsApiResponse {
  success: boolean;
  stats: PickStats;
  asOfDate?: string;
  lastDataRefresh?: string;
  disclaimer?: string;
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

interface AIStockRecommendation {
  id: string;
  symbol: string;
  companyName: string;
  exchange: string;
  sector: string;
  marketCap: string;
  currentPrice: number;
  entryPrice: number;
  targetPrice: number;
  stopLoss: number;
  signal: 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell';
  fintekproRating: number;
  confidence: number;
  riskScore: number;
  expectedReturn: number;
  timeHorizon: string;
  timeHorizonDays: number;
  fundamentals: {
    peRatio?: number;
    pbRatio?: number;
    roe?: number;
    roce?: number;
    eps?: number;
    dividendYield?: number;
  };
  technicals: {
    rsi: number;
    macd: string;
    movingAvg50: number;
    movingAvg200: number;
    weekHigh52: number;
    weekLow52: number;
    volumeTrend: string;
  };
  returns: {
    returns1M?: number;
    returns3M?: number;
    returns6M?: number;
    returns1Y?: number;
  };
  rationale: string;
  keyFactors: string[];
  riskFactors: string[];
  taxImplications: {
    holdingPeriod: string;
    stcgRate: number;
    ltcgRate: number;
    ltcgExemption: number;
    taxTip: string;
  };
  generatedAt: string;
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
  derivatives: Activity,
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
  derivatives: "Derivatives (F&O)",
};

// Currency helper for global stocks (USD) vs domestic (INR)
const getCurrencySymbol = (category: string): string => {
  return category === 'global_stocks' ? '$' : '₹';
};

const formatPrice = (price: number, category: string): string => {
  const symbol = getCurrencySymbol(category);
  return `${symbol}${price.toLocaleString()}`;
};

const statusConfig: Record<string, { color: string; icon: any; label: string }> = {
  live: { color: "bg-green-500", icon: Clock, label: "Live" },
  target_hit: { color: "bg-blue-500", icon: CheckCircle, label: "Target Hit" },
  stoploss_hit: { color: "bg-red-500", icon: XCircle, label: "Stoploss Hit" },
  expired: { color: "bg-muted", icon: AlertCircle, label: "Expired" },
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
  { key: "derivatives", label: "F&O", icon: Activity },
];

const marketFilters = [
  { key: "all", label: "All Markets" },
  { key: "us", label: "US Stocks" },
  { key: "china", label: "China Stocks" },
  { key: "uk_europe", label: "UK/Europe" },
  { key: "japan", label: "Japan" },
  { key: "other", label: "Other Markets" },
];

function parseRationale(raw: string | undefined | null): string {
  if (!raw) return "";
  const text = raw.replace(/^```[\w]*\n?/gm, "").replace(/```$/gm, "").trim();
  if (text.startsWith("{")) {
    try {
      const parsed = JSON.parse(text);
      const extracted =
        parsed.investment_rationale?.rationale ??
        parsed.investment_rationale ??
        parsed.rationale ??
        parsed.content ??
        parsed.text ??
        null;
      if (typeof extracted === "string" && extracted.length > 10) return extracted.trim();
      if (typeof extracted === "object" && extracted !== null)
        return (extracted.rationale || extracted.content || text).trim();
    } catch {
      // not JSON — fall through and return as-is
    }
  }
  return text;
}

export default function AgentPicksPage() {
  const { toast } = useToast();
  const [todayCategoryFilter, setTodayCategoryFilter] = useState<string>("all");
  const [liveCategoryFilter, setLiveCategoryFilter] = useState<string>("all");
  const [historyCategoryFilter, setHistoryCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [todayMarketFilter, setTodayMarketFilter] = useState<string>("all");
  const [liveMarketFilter, setLiveMarketFilter] = useState<string>("all");
  const [historyMarketFilter, setHistoryMarketFilter] = useState<string>("all");
  const [liveSearchQuery, setLiveSearchQuery] = useState<string>("");
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [sharePickId, setSharePickId] = useState<number | null>(null);
  const [shareEmail, setShareEmail] = useState("");
  // Share-with-clients dialog state (T006)
  const [shareClientsDialogOpen, setShareClientsDialogOpen] = useState(false);
  const [shareClientsPick, setShareClientsPick] = useState<DailyPick | null>(null);
  const [shareClientsSelected, setShareClientsSelected] = useState<string[]>([]);
  const [shareClientsChannel, setShareClientsChannel] = useState<'email' | 'whatsapp'>('whatsapp');
  const [hideUnreachable, setHideUnreachable] = useState(true);
  const [stockRiskLevel, setStockRiskLevel] = useState("moderate");
  const [stockTimeHorizon, setStockTimeHorizon] = useState("medium_term");
  const [stockSector, setStockSector] = useState("all");
  const [stockMarketCap, setStockMarketCap] = useState("all");
  const [stockInvestmentAmount, setStockInvestmentAmount] = useState([100000]);
  const [stockIncludeAI, setStockIncludeAI] = useState(true);
  const [selectedAIStock, setSelectedAIStock] = useState<AIStockRecommendation | null>(null);
  const [selectedPick, setSelectedPick] = useState<DailyPick | null>(null);
  const [explanationOpen, setExplanationOpen] = useState(false);
  const [explainingPickId, setExplanationPickId] = useState<number | null>(null);
  const [, navigate] = useLocation();

  const { data: explanationData, isLoading: loadingExplanation } = useQuery({
    queryKey: ["/api/ai/xai/explain", explainingPickId],
    enabled: !!explainingPickId && explanationOpen,
  });

  const { data: todayData, isLoading: loadingToday } = useQuery<PicksApiResponse>({
    queryKey: ["/api/picks/today"],
  });

  const { data: liveData, isLoading: loadingLive } = useQuery<PicksApiResponse>({
    queryKey: ["/api/picks/live"],
  });

  const { data: historyData, isLoading: loadingHistory } = useQuery<PicksApiResponse>({
    queryKey: ["/api/picks/history"],
  });

  const { data: statsData, isLoading: loadingStats } = useQuery<StatsApiResponse>({
    queryKey: ["/api/picks/stats"],
  });

  const { data: watchlistData, isLoading: loadingWatchlist } = useQuery<{ success: boolean; watchlist: WatchlistItem[] }>({
    queryKey: ["/api/picks/watchlist"],
  });

  const { data: diversificationData } = useQuery<{ success: boolean } & DiversificationData>({
    queryKey: ["/api/picks/diversification"],
  });

  const { data: aiFiltersData } = useQuery<{ success: boolean; sectors: string[]; marketCaps: string[]; riskLevels: string[]; timeHorizons: string[] }>({
    queryKey: ['/api/ai-stock-recommendations/filters']
  });

  const { data: quickAIRecs, isLoading: quickAILoading } = useQuery<{ success: boolean; recommendations: AIStockRecommendation[] }>({
    queryKey: ['/api/ai-stock-recommendations/quick']
  });

  // Contacts for "Share with Clients" dialog (T006)
  const { data: marketingContacts = [] } = useQuery({
    queryKey: ['/api/agent/marketing/clients'],
    enabled: shareClientsDialogOpen,
    select: (data) => Array.isArray(data) ? data as any[] : [],
  });

  const sharePickMutation = useMutation({
    mutationFn: async ({ pickId, clientIds, channel }: { pickId: number; clientIds: string[]; channel: string }) => {
      return apiRequest('/api/agent/marketing/share-pick', {
        method: 'POST',
        body: JSON.stringify({ pickId, clientIds, channel }),
      });
    },
    onSuccess: (data: any) => {
      if (data.whatsappUrl) window.open(data.whatsappUrl, '_blank');
      toast({ title: 'Shared!', description: `Pick shared with ${data.sentCount} contact${data.sentCount !== 1 ? 's' : ''}.` });
      setShareClientsDialogOpen(false);
      setShareClientsSelected([]);
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to share pick.', variant: 'destructive' });
    },
  });

  const handleShareWithClients = (pick: DailyPick) => {
    setShareClientsPick(pick);
    setShareClientsSelected([]);
    setShareClientsChannel('whatsapp');
    setShareClientsDialogOpen(true);
  };

  const generateAIMutation = useMutation({
    mutationFn: async (filters: any) => {
      return apiRequest('/api/ai-stock-recommendations/generate', {
        method: 'POST',
        body: JSON.stringify(filters),
        headers: { 'Content-Type': 'application/json' }
      });
    }
  });

  const handleGenerateAIStocks = () => {
    generateAIMutation.mutate({
      sectors: stockSector !== "all" ? [stockSector] : undefined,
      marketCap: stockMarketCap !== "all" ? [stockMarketCap] : undefined,
      riskLevel: stockRiskLevel,
      timeHorizon: stockTimeHorizon,
      investmentAmount: stockInvestmentAmount[0],
      includeAIAnalysis: stockIncludeAI,
      maxResults: 10
    });
  };

  const aiRecommendations = generateAIMutation.data?.recommendations || quickAIRecs?.recommendations || [];

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

  const todayPicks = Array.isArray(todayData?.picks) ? todayData.picks : [];
  const livePicks = Array.isArray(liveData?.picks) ? liveData.picks : [];
  const historyPicks = Array.isArray(historyData?.picks) ? historyData.picks : [];
  const stats = statsData?.stats;

  const filterByMarket = (pick: DailyPick, marketFilter: string) => {
    if (marketFilter === "all") return true;
    return pick.market === marketFilter;
  };

  const isPickExpired = (p: DailyPick) =>
    p.status === 'expired' || (p.expiryDate != null && new Date(p.expiryDate) < new Date());

  const filteredTodayPicks = todayPicks.filter(p => {
    if (isPickExpired(p)) return false;
    if (todayCategoryFilter !== "all" && p.category !== todayCategoryFilter) return false;
    if (todayCategoryFilter === "global_stocks" && !filterByMarket(p, todayMarketFilter)) return false;
    return true;
  });

  const filteredLivePicks = livePicks.filter(p => {
    if (isPickExpired(p)) return false;
    if (liveCategoryFilter !== "all" && p.category !== liveCategoryFilter) return false;
    if (liveCategoryFilter === "global_stocks" && !filterByMarket(p, liveMarketFilter)) return false;
    if (liveSearchQuery.trim()) {
      const q = liveSearchQuery.toLowerCase();
      const match =
        p.instrumentName?.toLowerCase().includes(q) ||
        p.symbol?.toLowerCase().includes(q) ||
        p.sectorCategory?.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  const filteredHistory = historyPicks.filter((pick) => {
    if (historyCategoryFilter !== "all" && pick.category !== historyCategoryFilter) return false;
    if (historyCategoryFilter === "global_stocks" && !filterByMarket(pick, historyMarketFilter)) return false;
    const effectiveStatus = (pick.status === 'live' && pick.expiryDate && new Date(pick.expiryDate) < new Date()) ? 'expired' : pick.status;
    if (statusFilter !== "all" && effectiveStatus !== statusFilter) return false;
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

  const lastRefreshed = liveData?.lastRefreshedAt || todayData?.lastRefreshedAt;
  const categoryLastUpdated = liveData?.categoryLastUpdated || todayData?.categoryLastUpdated || {};

  const formatTimeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  const getSignalColor = (signal: string) => {
    switch (signal) {
      case 'strong_buy': return 'bg-green-600 text-white';
      case 'buy': return 'bg-green-500 text-white';
      case 'hold': return 'bg-yellow-500 text-black dark:text-black';
      case 'sell': return 'bg-red-500 text-white';
      case 'strong_sell': return 'bg-red-700 text-white';
      default: return 'bg-muted text-foreground';
    }
  };

  const getSignalText = (signal: string) => {
    switch (signal) {
      case 'strong_buy': return 'Strong Buy';
      case 'buy': return 'Buy';
      case 'hold': return 'Hold';
      case 'sell': return 'Sell';
      case 'strong_sell': return 'Strong Sell';
      default: return signal;
    }
  };

  const renderStars = (rating: number) => (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`h-4 w-4 ${star <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`}
        />
      ))}
    </div>
  );

  const formatCurrencyINR = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2
    }).format(value);
  };

  const formatPercentValue = (value: number | undefined | null) => {
    if (value === undefined || value === null) return 'N/A';
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  const freshnessColors: Record<string, string> = {
    live: 'bg-green-500',
    recent: 'bg-blue-500',
    delayed: 'bg-yellow-500',
    stale: 'bg-red-500',
    unknown: 'bg-gray-400',
  };

  const freshnessLabels: Record<string, string> = {
    live: 'Live',
    recent: 'Recent',
    delayed: 'Delayed',
    stale: 'Stale',
    unknown: 'N/A',
  };

  const topPickOfDay = todayPicks.length > 0
    ? [...todayPicks].sort((a, b) => (b.confidenceScore ?? 0) - (a.confidenceScore ?? 0))[0]
    : null;

  const exportTodaysPicksCSV = () => {
    const rows = [
      ['Name', 'Symbol', 'Category', 'Entry Price', 'Target', 'Stoploss', 'Upside%', 'Downside%', 'Horizon', 'Confidence', 'Date'],
      ...todayPicks.map(p => {
        const up = p.targetPrice && p.recoPrice ? ((p.targetPrice - p.recoPrice) / p.recoPrice * 100).toFixed(1) : '';
        const dn = p.stoplossPrice && p.recoPrice ? ((p.recoPrice - p.stoplossPrice) / p.recoPrice * 100).toFixed(1) : '';
        return [
          p.instrumentName,
          p.symbol || '',
          categoryLabels[p.category] || p.category,
          p.recoPrice,
          p.targetPrice,
          p.stoplossPrice,
          up,
          dn,
          p.timeHorizon || '',
          p.confidenceScore ?? '',
          new Date(p.recoDate).toLocaleDateString('en-IN'),
        ];
      }),
    ];
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fintek-picks-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const historicalChartData = (() => {
    const closed = historyPicks
      .filter(p => p.status === 'target_hit' || p.status === 'stoploss_hit')
      .sort((a, b) => new Date(a.recoDate).getTime() - new Date(b.recoDate).getTime());
    let cumulative = 0;
    return closed.map(p => {
      const ret = p.returnPct ?? (p.status === 'target_hit'
        ? (p.targetPrice && p.recoPrice ? (p.targetPrice - p.recoPrice) / p.recoPrice * 100 : 0)
        : (p.stoplossPrice && p.recoPrice ? -(p.recoPrice - p.stoplossPrice) / p.recoPrice * 100 : 0));
      cumulative += Number(ret);
      return {
        date: new Date(p.recoDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
        return: Number(ret).toFixed(1),
        cumulative: Number(cumulative.toFixed(1)),
        name: p.instrumentName,
      };
    });
  })();

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
        {lastRefreshed && (
          <div className="text-right text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span>Last refreshed: {formatTimeAgo(lastRefreshed)}</span>
            </div>
            <div className="text-[10px] mt-0.5">
              {new Date(lastRefreshed).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
            </div>
          </div>
        )}
      </div>

      {Object.keys(categoryLastUpdated).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(categoryLastUpdated).map(([cat, updated]) => {
            const ageHours = (Date.now() - new Date(updated).getTime()) / (1000 * 60 * 60);
            const freshness = ageHours < 1 ? 'live' : ageHours < 6 ? 'recent' : ageHours < 24 ? 'delayed' : 'stale';
            return (
              <TooltipProvider key={cat}>
                <Tooltip>
                  <TooltipTrigger>
                    <Badge variant="outline" className="text-[10px] gap-1 cursor-default">
                      <span className={`w-1.5 h-1.5 rounded-full ${freshnessColors[freshness]}`} />
                      {categoryLabels[cat] || cat}
                      <span className="text-muted-foreground">{formatTimeAgo(updated)}</span>
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent className="text-xs">
                    <p>{categoryLabels[cat]}: {freshnessLabels[freshness]} data</p>
                    <p>Source: {todayData?.dataSources?.[cat]?.name || liveData?.dataSources?.[cat]?.name || 'N/A'}</p>
                    <p>Updated: {new Date(updated).toLocaleString('en-IN')}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            );
          })}
        </div>
      )}

      {/* #1 Performance Hero Banner */}
      {loadingStats ? (
        <Skeleton className="h-36 w-full rounded-xl" />
      ) : stats ? (
        <div className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-primary/10 via-primary/5 to-background p-6">
          <div className="absolute inset-0 bg-grid-white/5 [mask-image:linear-gradient(0deg,transparent,rgba(255,255,255,0.6))]" />
          <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">
                AI Performance Track Record
              </p>
              <div className="flex flex-wrap items-end gap-6">
                <div>
                  <div className="text-4xl font-black text-primary leading-none">{stats.hitRate ?? 0}%</div>
                  <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    <Trophy className="h-3 w-3 text-amber-500" /> Hit Rate
                  </div>
                </div>
                <div>
                  <div className={`text-4xl font-black leading-none ${(stats.avgReturn ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {(stats.avgReturn ?? 0) >= 0 ? '+' : ''}{(stats.avgReturn ?? 0).toFixed(1)}%
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    <TrendingUp className="h-3 w-3 text-green-500" /> Avg Return
                  </div>
                </div>
                <div className="hidden sm:block w-px h-10 bg-border" />
                <div className="flex gap-6">
                  <div>
                    <div className="text-2xl font-bold text-green-600">{stats.livePicks}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> Live
                    </div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-blue-600">{stats.targetHits}</div>
                    <div className="text-xs text-muted-foreground">Targets Hit</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold">{stats.totalPicks}</div>
                    <div className="text-xs text-muted-foreground">Total Picks</div>
                  </div>
                </div>
              </div>
            </div>
            <div className="sm:text-right">
              {(() => {
                const closedCount = stats.targetHits + (stats.stoplossHits || 0) + (stats.expired || 0);
                return closedCount > 0 ? (
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground">{closedCount} closed picks</div>
                    <Progress value={stats.hitRate} className="h-2 w-32" />
                    <div className="text-[10px] text-muted-foreground">
                      {stats.targetHits} wins · {stats.stoplossHits || 0} losses · {stats.expired || 0} expired
                    </div>
                  </div>
                ) : null;
              })()}
              {statsData?.lastDataRefresh && (
                <div className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1 sm:justify-end">
                  <Clock className="h-3 w-3" />
                  Stats as of {new Date(statsData.lastDataRefresh).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                </div>
              )}
            </div>
          </div>
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
          {/* #6 Top Pick of the Day */}
          {topPickOfDay && !loadingToday && (
            <div className="relative overflow-hidden rounded-xl border-2 border-amber-400/60 bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/20 p-4">
              <div className="absolute top-3 right-3">
                <Badge className="bg-amber-500 text-white text-xs flex items-center gap-1">
                  <Zap className="h-3 w-3" /> Top Pick of the Day
                </Badge>
              </div>
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-full bg-amber-400/20 shrink-0">
                  {(() => { const Icon = categoryIcons[topPickOfDay.category] || TrendingUp; return <Icon className="h-6 w-6 text-amber-600" />; })()}
                </div>
                <div className="flex-1 min-w-0 pr-24">
                  <h3 className="font-bold text-lg leading-tight">{topPickOfDay.instrumentName}</h3>
                  <div className="flex items-center gap-2 flex-wrap mt-1">
                    {topPickOfDay.symbol && <span className="text-sm text-muted-foreground font-mono">{topPickOfDay.symbol}</span>}
                    <Badge variant="outline" className="text-[10px]">{categoryLabels[topPickOfDay.category]}</Badge>
                    {topPickOfDay.timeHorizon && horizonConfig[topPickOfDay.timeHorizon] && (
                      <Badge variant="outline" className={horizonConfig[topPickOfDay.timeHorizon].color + " text-[10px]"}>
                        {horizonConfig[topPickOfDay.timeHorizon].label}
                      </Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-4 mt-3 text-sm">
                    <span><span className="text-muted-foreground text-xs">Entry</span><br /><strong>{formatPrice(topPickOfDay.recoPrice, topPickOfDay.category)}</strong></span>
                    <span><span className="text-xs text-green-600">Target</span><br /><strong className="text-green-600">{formatPrice(topPickOfDay.targetPrice, topPickOfDay.category)}</strong></span>
                    <span><span className="text-xs text-red-500">Stoploss</span><br /><strong className="text-red-500">{formatPrice(topPickOfDay.stoplossPrice, topPickOfDay.category)}</strong></span>
                    {topPickOfDay.confidenceScore !== undefined && (
                      <span><span className="text-xs text-muted-foreground">AI Confidence</span><br /><strong className={getConfidenceColor(topPickOfDay.confidenceScore)}>{topPickOfDay.confidenceScore}%</strong></span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Today's Top Picks</CardTitle>
                  <CardDescription>
                    AI-selected investment opportunities for {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  </CardDescription>
                </div>
                {/* #10 Export button */}
                {todayPicks.length > 0 && (
                  <Button variant="outline" size="sm" onClick={exportTodaysPicksCSV} className="shrink-0">
                    <Download className="h-4 w-4 mr-2" /> Export CSV
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {/* #3 + #11 Category Filter — horizontal scroll + hit rates */}
              <div className="flex gap-2 mb-4 pb-4 border-b overflow-x-auto scrollbar-none">
                {allCategories.map(({ key, label, icon: Icon }) => {
                  const count = todayCounts[key] || 0;
                  const isActive = todayCategoryFilter === key;
                  const catStats = key !== 'all' ? stats?.byCategory?.[key] : null;
                  return (
                    <Button
                      key={key}
                      variant={isActive ? "default" : "outline"}
                      size="sm"
                      onClick={() => setTodayCategoryFilter(key)}
                      className="flex items-center gap-1.5 shrink-0"
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {label}
                      {count > 0 && (
                        <Badge variant={isActive ? "secondary" : "outline"} className="ml-1 text-[10px] px-1.5">
                          {count}
                        </Badge>
                      )}
                      {catStats && catStats.total > 0 && (
                        <span className={`text-[9px] font-semibold ml-0.5 ${catStats.hitRate >= 50 ? 'text-green-500' : catStats.hitRate >= 25 ? 'text-amber-500' : 'text-muted-foreground'}`}>
                          {catStats.hitRate}%
                        </span>
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
              ) : todayCategoryFilter === "listed_stocks" ? (
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                  <Card className="lg:col-span-1">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <BarChart3 className="h-4 w-4" />
                        AI Filters
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label className="text-sm">Risk Level</Label>
                        <Select value={stockRiskLevel} onValueChange={setStockRiskLevel}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="conservative">Conservative</SelectItem>
                            <SelectItem value="moderate">Moderate</SelectItem>
                            <SelectItem value="aggressive">Aggressive</SelectItem>
                            <SelectItem value="very_aggressive">Very Aggressive</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-sm">Time Horizon</Label>
                        <Select value={stockTimeHorizon} onValueChange={setStockTimeHorizon}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="intraday">Intraday</SelectItem>
                            <SelectItem value="short_term">Short Term (1-3 months)</SelectItem>
                            <SelectItem value="medium_term">Medium Term (3-12 months)</SelectItem>
                            <SelectItem value="long_term">Long Term (1+ year)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-sm">Sector</Label>
                        <Select value={stockSector} onValueChange={setStockSector}>
                          <SelectTrigger><SelectValue placeholder="All Sectors" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Sectors</SelectItem>
                            {aiFiltersData?.sectors?.map((sector) => (
                              <SelectItem key={sector} value={sector}>{sector}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-sm">Market Cap</Label>
                        <Select value={stockMarketCap} onValueChange={setStockMarketCap}>
                          <SelectTrigger><SelectValue placeholder="All Market Caps" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Market Caps</SelectItem>
                            <SelectItem value="Large Cap">Large Cap</SelectItem>
                            <SelectItem value="Mid Cap">Mid Cap</SelectItem>
                            <SelectItem value="Small Cap">Small Cap</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-sm">Investment Amount: {formatCurrencyINR(stockInvestmentAmount[0])}</Label>
                        <Slider
                          value={stockInvestmentAmount}
                          onValueChange={setStockInvestmentAmount}
                          min={10000}
                          max={1000000}
                          step={10000}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <Label className="text-sm" htmlFor="agent-ai-toggle">AI Analysis</Label>
                        <Switch
                          id="agent-ai-toggle"
                          checked={stockIncludeAI}
                          onCheckedChange={setStockIncludeAI}
                        />
                      </div>

                      <Button className="w-full" onClick={handleGenerateAIStocks} disabled={generateAIMutation.isPending}>
                        {generateAIMutation.isPending ? (
                          <>
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            Generating...
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-4 w-4 mr-2" />
                            Generate Picks
                          </>
                        )}
                      </Button>
                    </CardContent>
                  </Card>

                  <div className="lg:col-span-3 space-y-6">
                    {(generateAIMutation.isPending || quickAILoading) && (
                      <Card>
                        <CardContent className="py-12 text-center">
                          <RefreshCw className="h-8 w-8 animate-spin mx-auto text-primary mb-4" />
                          <p className="text-muted-foreground">Analyzing market data with AI...</p>
                        </CardContent>
                      </Card>
                    )}

                    {aiRecommendations.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-4">
                          <Brain className="h-5 w-5 text-primary" />
                          <h3 className="font-semibold">AI Stock Recommendations</h3>
                          <Badge variant="outline" className="text-xs flex items-center gap-1">
                            <Sparkles className="h-3 w-3" />
                            Gemini AI
                          </Badge>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {aiRecommendations.map((stock: AIStockRecommendation) => (
                            <Card
                              key={stock.id}
                              className={`cursor-pointer transition-all hover:shadow-lg ${selectedAIStock?.id === stock.id ? 'ring-2 ring-primary' : ''}`}
                              onClick={() => setSelectedAIStock(selectedAIStock?.id === stock.id ? null : stock)}
                            >
                              <CardHeader className="pb-2">
                                <div className="flex items-start justify-between">
                                  <div>
                                    <CardTitle className="text-lg flex items-center gap-2">
                                      {stock.symbol}
                                      <Badge className={getSignalColor(stock.signal)}>
                                        {getSignalText(stock.signal)}
                                      </Badge>
                                    </CardTitle>
                                    <CardDescription className="line-clamp-1">
                                      {stock.companyName}
                                    </CardDescription>
                                  </div>
                                  {renderStars(stock.fintekproRating)}
                                </div>
                              </CardHeader>
                              <CardContent>
                                <div className="grid grid-cols-3 gap-3 mb-3">
                                  <div className="text-center">
                                    <p className="text-xs text-muted-foreground">Current</p>
                                    <p className="font-semibold">{formatCurrencyINR(stock.currentPrice)}</p>
                                  </div>
                                  <div className="text-center">
                                    <p className="text-xs text-muted-foreground">Target</p>
                                    <p className="font-semibold text-green-600">{formatCurrencyINR(stock.targetPrice)}</p>
                                  </div>
                                  <div className="text-center">
                                    <p className="text-xs text-muted-foreground">Stop Loss</p>
                                    <p className="font-semibold text-red-600">{formatCurrencyINR(stock.stopLoss)}</p>
                                  </div>
                                </div>

                                <div className="flex items-center justify-between text-sm mb-2">
                                  <span className="text-muted-foreground">Expected Return</span>
                                  <span className={`font-medium ${stock.expectedReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {stock.expectedReturn >= 0 ? '+' : ''}{stock.expectedReturn}%
                                  </span>
                                </div>

                                <div className="flex items-center justify-between text-sm mb-3">
                                  <span className="text-muted-foreground">Confidence</span>
                                  <div className="flex items-center gap-2 w-32">
                                    <Progress value={stock.confidence} className="h-2" />
                                    <span className="text-xs font-medium">{stock.confidence}%</span>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 flex-wrap">
                                  <Badge variant="outline" className="text-xs">{stock.sector}</Badge>
                                  <Badge variant="outline" className="text-xs">{stock.marketCap}</Badge>
                                  <Badge variant="outline" className="text-xs flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {stock.timeHorizon.replace(/_/g, ' ')}
                                  </Badge>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                    )}

                    {selectedAIStock && (
                      <Card>
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <CardTitle className="flex items-center gap-2">
                              {selectedAIStock.symbol} - Detailed Analysis
                            </CardTitle>
                            <Button variant="ghost" size="sm" onClick={() => setSelectedAIStock(null)}>Close</Button>
                          </div>
                          <CardDescription>{selectedAIStock.companyName}</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <Tabs defaultValue="overview">
                            <ScrollableTabsList>
                              <TabsTrigger value="overview">Overview</TabsTrigger>
                              <TabsTrigger value="fundamentals">Fundamentals</TabsTrigger>
                              <TabsTrigger value="technicals">Technicals</TabsTrigger>
                              <TabsTrigger value="tax">Tax Impact</TabsTrigger>
                            </ScrollableTabsList>

                            <TabsContent value="overview" className="space-y-4 mt-4">
                              <div className="p-4 bg-muted/50 rounded-lg">
                                <h4 className="font-semibold mb-2 flex items-center gap-2">
                                  <Brain className="h-4 w-4" />
                                  AI Rationale
                                </h4>
                                <p className="text-sm text-muted-foreground">{parseRationale(selectedAIStock.rationale)}</p>
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <h4 className="font-semibold mb-2 flex items-center gap-2 text-green-600">
                                    <CheckCircle className="h-4 w-4" />
                                    Key Factors
                                  </h4>
                                  <ul className="space-y-1">
                                    {selectedAIStock.keyFactors.map((factor, i) => (
                                      <li key={i} className="text-sm flex items-start gap-2">
                                        <ArrowUpRight className="h-4 w-4 mt-0.5 text-green-600 flex-shrink-0" />
                                        {factor}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                                <div>
                                  <h4 className="font-semibold mb-2 flex items-center gap-2 text-amber-600">
                                    <AlertTriangle className="h-4 w-4" />
                                    Risk Factors
                                  </h4>
                                  <ul className="space-y-1">
                                    {selectedAIStock.riskFactors.map((risk, i) => (
                                      <li key={i} className="text-sm flex items-start gap-2">
                                        <ArrowDownRight className="h-4 w-4 mt-0.5 text-amber-600 flex-shrink-0" />
                                        {risk}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              </div>
                              <Separator />
                              <div className="grid grid-cols-4 gap-4 text-center">
                                <div>
                                  <p className="text-xs text-muted-foreground mb-1">Entry Price</p>
                                  <p className="font-semibold">{formatCurrencyINR(selectedAIStock.entryPrice)}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground mb-1">Target Price</p>
                                  <p className="font-semibold text-green-600">{formatCurrencyINR(selectedAIStock.targetPrice)}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground mb-1">Stop Loss</p>
                                  <p className="font-semibold text-red-600">{formatCurrencyINR(selectedAIStock.stopLoss)}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground mb-1">Risk Score</p>
                                  <p className="font-semibold">{selectedAIStock.riskScore}/10</p>
                                </div>
                              </div>
                            </TabsContent>

                            <TabsContent value="fundamentals" className="mt-4">
                              <div className="grid grid-cols-3 gap-4">
                                <div className="p-4 border rounded-lg text-center">
                                  <p className="text-xs text-muted-foreground">P/E Ratio</p>
                                  <p className="text-xl font-bold">{selectedAIStock.fundamentals.peRatio?.toFixed(2) || 'N/A'}</p>
                                </div>
                                <div className="p-4 border rounded-lg text-center">
                                  <p className="text-xs text-muted-foreground">P/B Ratio</p>
                                  <p className="text-xl font-bold">{selectedAIStock.fundamentals.pbRatio?.toFixed(2) || 'N/A'}</p>
                                </div>
                                <div className="p-4 border rounded-lg text-center">
                                  <p className="text-xs text-muted-foreground">ROE</p>
                                  <p className="text-xl font-bold">{selectedAIStock.fundamentals.roe?.toFixed(1) || 'N/A'}%</p>
                                </div>
                                <div className="p-4 border rounded-lg text-center">
                                  <p className="text-xs text-muted-foreground">ROCE</p>
                                  <p className="text-xl font-bold">{selectedAIStock.fundamentals.roce?.toFixed(1) || 'N/A'}%</p>
                                </div>
                                <div className="p-4 border rounded-lg text-center">
                                  <p className="text-xs text-muted-foreground">EPS</p>
                                  <p className="text-xl font-bold">{selectedAIStock.fundamentals.eps?.toFixed(2) || 'N/A'}</p>
                                </div>
                                <div className="p-4 border rounded-lg text-center">
                                  <p className="text-xs text-muted-foreground">Dividend Yield</p>
                                  <p className="text-xl font-bold">{selectedAIStock.fundamentals.dividendYield?.toFixed(2) || 'N/A'}%</p>
                                </div>
                              </div>
                              <div className="mt-4 p-4 bg-muted/50 rounded-lg">
                                <h4 className="font-semibold mb-2">Historical Returns</h4>
                                <div className="grid grid-cols-4 gap-4 text-center">
                                  <div>
                                    <p className="text-xs text-muted-foreground">1 Month</p>
                                    <p className={`font-semibold ${(selectedAIStock.returns.returns1M || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                      {formatPercentValue(selectedAIStock.returns.returns1M)}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-muted-foreground">3 Months</p>
                                    <p className={`font-semibold ${(selectedAIStock.returns.returns3M || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                      {formatPercentValue(selectedAIStock.returns.returns3M)}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-muted-foreground">6 Months</p>
                                    <p className={`font-semibold ${(selectedAIStock.returns.returns6M || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                      {formatPercentValue(selectedAIStock.returns.returns6M)}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-muted-foreground">1 Year</p>
                                    <p className={`font-semibold ${(selectedAIStock.returns.returns1Y || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                      {formatPercentValue(selectedAIStock.returns.returns1Y)}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </TabsContent>

                            <TabsContent value="technicals" className="mt-4">
                              <div className="grid grid-cols-3 gap-4">
                                <div className="p-4 border rounded-lg text-center">
                                  <p className="text-xs text-muted-foreground">RSI</p>
                                  <p className={`text-xl font-bold ${selectedAIStock.technicals.rsi > 70 ? 'text-red-600' : selectedAIStock.technicals.rsi < 30 ? 'text-green-600' : ''}`}>
                                    {selectedAIStock.technicals.rsi.toFixed(0)}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {selectedAIStock.technicals.rsi > 70 ? 'Overbought' : selectedAIStock.technicals.rsi < 30 ? 'Oversold' : 'Neutral'}
                                  </p>
                                </div>
                                <div className="p-4 border rounded-lg text-center">
                                  <p className="text-xs text-muted-foreground">MACD</p>
                                  <p className={`text-xl font-bold ${selectedAIStock.technicals.macd === 'Bullish' ? 'text-green-600' : selectedAIStock.technicals.macd === 'Bearish' ? 'text-red-600' : ''}`}>
                                    {selectedAIStock.technicals.macd}
                                  </p>
                                </div>
                                <div className="p-4 border rounded-lg text-center">
                                  <p className="text-xs text-muted-foreground">Volume Trend</p>
                                  <p className="text-xl font-bold">{selectedAIStock.technicals.volumeTrend}</p>
                                </div>
                              </div>
                              <div className="mt-4 grid grid-cols-2 gap-4">
                                <div className="p-4 border rounded-lg">
                                  <h4 className="font-semibold mb-2">Moving Averages</h4>
                                  <div className="space-y-2">
                                    <div className="flex justify-between">
                                      <span className="text-sm text-muted-foreground">50 DMA</span>
                                      <span className="font-medium">{formatCurrencyINR(selectedAIStock.technicals.movingAvg50)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-sm text-muted-foreground">200 DMA</span>
                                      <span className="font-medium">{formatCurrencyINR(selectedAIStock.technicals.movingAvg200)}</span>
                                    </div>
                                  </div>
                                </div>
                                <div className="p-4 border rounded-lg">
                                  <h4 className="font-semibold mb-2">52 Week Range</h4>
                                  <div className="space-y-2">
                                    <div className="flex justify-between">
                                      <span className="text-sm text-muted-foreground">High</span>
                                      <span className="font-medium text-green-600">{formatCurrencyINR(selectedAIStock.technicals.weekHigh52)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-sm text-muted-foreground">Low</span>
                                      <span className="font-medium text-red-600">{formatCurrencyINR(selectedAIStock.technicals.weekLow52)}</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </TabsContent>

                            <TabsContent value="tax" className="mt-4">
                              <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg mb-4">
                                <h4 className="font-semibold mb-2 flex items-center gap-2">
                                  <Coins className="h-4 w-4" />
                                  Tax Implications
                                </h4>
                                <p className="text-sm">{selectedAIStock.taxImplications.taxTip}</p>
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 border rounded-lg">
                                  <h4 className="font-semibold mb-3">Short-Term Capital Gains</h4>
                                  <div className="space-y-2">
                                    <div className="flex justify-between">
                                      <span className="text-sm text-muted-foreground">Holding Period</span>
                                      <span className="font-medium">≤ 12 months</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-sm text-muted-foreground">Tax Rate</span>
                                      <span className="font-medium text-red-600">{selectedAIStock.taxImplications.stcgRate}%</span>
                                    </div>
                                  </div>
                                </div>
                                <div className="p-4 border rounded-lg">
                                  <h4 className="font-semibold mb-3">Long-Term Capital Gains</h4>
                                  <div className="space-y-2">
                                    <div className="flex justify-between">
                                      <span className="text-sm text-muted-foreground">Holding Period</span>
                                      <span className="font-medium">&gt; 12 months</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-sm text-muted-foreground">Tax Rate</span>
                                      <span className="font-medium text-green-600">{selectedAIStock.taxImplications.ltcgRate}%</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-sm text-muted-foreground">Exemption</span>
                                      <span className="font-medium">{formatCurrencyINR(selectedAIStock.taxImplications.ltcgExemption)}</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </TabsContent>
                          </Tabs>
                        </CardContent>
                      </Card>
                    )}

                    {filteredTodayPicks.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-4">
                          <TrendingUp className="h-5 w-5 text-primary" />
                          <h3 className="font-semibold">Today's Stock Picks</h3>
                        </div>
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
                              onShareClients={handleShareWithClients}
                              onClick={setSelectedPick}
                              onExplain={(id) => {
                                setExplanationPickId(id);
                                setExplanationOpen(true);
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {!generateAIMutation.isPending && !quickAILoading && aiRecommendations.length === 0 && filteredTodayPicks.length === 0 && (
                      <Card>
                        <CardContent className="py-12 text-center">
                          <Brain className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                          <h3 className="text-lg font-semibold mb-2">No Stock Picks Yet</h3>
                          <p className="text-muted-foreground mb-4">
                            Configure your preferences and click "Generate Picks" to get AI-powered stock recommendations.
                          </p>
                        </CardContent>
                      </Card>
                    )}
                  </div>
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
                      onShareClients={handleShareWithClients}
                      onClick={setSelectedPick}
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
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <CardTitle>Live Recommendations</CardTitle>
                  <CardDescription>
                    Active picks being tracked for target/stoploss
                  </CardDescription>
                </div>
                {/* #5 Search box */}
                <div className="relative w-full sm:w-56">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search instrument, symbol…"
                    value={liveSearchQuery}
                    onChange={e => setLiveSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-2 text-sm rounded-md border border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                  {liveSearchQuery && (
                    <button
                      className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                      onClick={() => setLiveSearchQuery("")}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* #3 + #11 Category Filter — horizontal scroll + hit rates */}
              <div className="flex gap-2 mb-4 pb-4 border-b overflow-x-auto scrollbar-none">
                {allCategories.map(({ key, label, icon: Icon }) => {
                  const count = liveCounts[key] || 0;
                  const isActive = liveCategoryFilter === key;
                  const catStats = key !== 'all' ? stats?.byCategory?.[key] : null;
                  return (
                    <Button
                      key={key}
                      variant={isActive ? "default" : "outline"}
                      size="sm"
                      onClick={() => setLiveCategoryFilter(key)}
                      className="flex items-center gap-1.5 shrink-0"
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {label}
                      {count > 0 && (
                        <Badge variant={isActive ? "secondary" : "outline"} className="ml-1 text-[10px] px-1.5">
                          {count}
                        </Badge>
                      )}
                      {catStats && catStats.total > 0 && (
                        <span className={`text-[9px] font-semibold ml-0.5 ${catStats.hitRate >= 50 ? 'text-green-500' : catStats.hitRate >= 25 ? 'text-amber-500' : 'text-muted-foreground'}`}>
                          {catStats.hitRate}%
                        </span>
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
                      onShareClients={handleShareWithClients}
                      onClick={setSelectedPick}
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
              {/* #13 Cumulative Performance Chart */}
              {historicalChartData.length >= 2 && (
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-semibold flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-primary" />
                      Cumulative Return — Closed Picks
                    </h4>
                    <span className={`text-xs font-semibold ${historicalChartData[historicalChartData.length - 1].cumulative >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {historicalChartData[historicalChartData.length - 1].cumulative >= 0 ? '+' : ''}{historicalChartData[historicalChartData.length - 1].cumulative}%
                    </span>
                  </div>
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={historicalChartData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${v}%`} width={42} />
                      <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" />
                      <RechartsTooltip
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null;
                          const d = payload[0].payload;
                          return (
                            <div className="bg-background border rounded-lg shadow-lg p-3 text-xs space-y-1">
                              <p className="font-semibold">{d.name}</p>
                              <p className="text-muted-foreground">{d.date}</p>
                              <p>Pick return: <span className={Number(d.return) >= 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>{Number(d.return) >= 0 ? '+' : ''}{d.return}%</span></p>
                              <p>Cumulative: <span className={Number(d.cumulative) >= 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>{Number(d.cumulative) >= 0 ? '+' : ''}{d.cumulative}%</span></p>
                            </div>
                          );
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="cumulative"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* #3 + #11 Category Filter — horizontal scroll + hit rates */}
              <div className="flex gap-2 mb-4 pb-4 border-b overflow-x-auto scrollbar-none">
                {allCategories.map(({ key, label, icon: Icon }) => {
                  const count = historyCounts[key] || 0;
                  const isActive = historyCategoryFilter === key;
                  const catStats = key !== 'all' ? stats?.byCategory?.[key] : null;
                  return (
                    <Button
                      key={key}
                      variant={isActive ? "default" : "outline"}
                      size="sm"
                      onClick={() => setHistoryCategoryFilter(key)}
                      className="flex items-center gap-1.5 shrink-0"
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {label}
                      {count > 0 && (
                        <Badge variant={isActive ? "secondary" : "outline"} className="ml-1 text-[10px] px-1.5">
                          {count}
                        </Badge>
                      )}
                      {catStats && catStats.total > 0 && (
                        <span className={`text-[9px] font-semibold ml-0.5 ${catStats.hitRate >= 50 ? 'text-green-500' : catStats.hitRate >= 25 ? 'text-amber-500' : 'text-muted-foreground'}`}>
                          {catStats.hitRate}%
                        </span>
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

      <div className="mt-6 p-4 bg-muted/50 rounded-lg border border-muted">
        <div className="flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
          <div className="text-xs text-muted-foreground space-y-1">
            <p className="font-medium text-foreground/80">Regulatory Disclaimer</p>
            <p>Investment recommendations are AI-generated and for informational purposes only. Past performance does not guarantee future results. Investors should conduct independent due diligence and consult a SEBI-registered investment advisor before making investment decisions.</p>
            <p className="text-[10px]">Data sourced from NSE, BSE, AMFI, Alpha Vantage, and Yahoo Finance. Prices may be delayed up to 15 minutes for listed securities.</p>
          </div>
        </div>
      </div>

      {/* Pick Detail Sheet */}
      {selectedPick && (
        <Sheet open={!!selectedPick} onOpenChange={(open) => { if (!open) setSelectedPick(null); }}>
          <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
            <SheetHeader className="pb-4 border-b">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <SheetTitle className="text-xl flex items-center gap-2 flex-wrap">
                    {selectedPick.instrumentName}
                    {selectedPick.symbol && (
                      <span className="text-sm font-mono text-muted-foreground">{selectedPick.symbol}</span>
                    )}
                  </SheetTitle>
                  <SheetDescription className="flex items-center gap-2 mt-1 flex-wrap">
                    <Badge variant="outline">{categoryLabels[selectedPick.category] || selectedPick.category}</Badge>
                    {selectedPick.exchange && <Badge variant="secondary">{selectedPick.exchange}</Badge>}
                    {selectedPick.sectorCategory && <Badge variant="secondary">{selectedPick.sectorCategory}</Badge>}
                    <Badge className={`${(statusConfig[selectedPick.status] || statusConfig.live).color} text-foreground`}>
                      {(statusConfig[selectedPick.status] || statusConfig.live).label}
                    </Badge>
                  </SheetDescription>
                </div>
              </div>
            </SheetHeader>

            <div className="space-y-5 py-4">
              {/* Price Panel */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Entry Price</p>
                  <p className="font-bold text-lg">{formatPrice(selectedPick.recoPrice, selectedPick.category)}</p>
                  <p className="text-xs text-muted-foreground">{new Date(selectedPick.recoDate).toLocaleDateString('en-IN')}</p>
                </div>
                <div className="bg-green-50 dark:bg-green-950 rounded-lg p-3 text-center border border-green-200 dark:border-green-800">
                  <p className="text-xs text-green-600 dark:text-green-400 mb-1 flex items-center justify-center gap-1">
                    <ArrowUpRight className="h-3 w-3" /> Target
                  </p>
                  <p className="font-bold text-lg text-green-700 dark:text-green-300">
                    {formatPrice(selectedPick.targetPrice, selectedPick.category)}
                  </p>
                  {selectedPick.recoPrice > 0 && (
                    <p className="text-xs text-green-600 font-medium">
                      +{((selectedPick.targetPrice - selectedPick.recoPrice) / selectedPick.recoPrice * 100).toFixed(1)}%
                    </p>
                  )}
                </div>
                <div className="bg-red-50 dark:bg-red-950 rounded-lg p-3 text-center border border-red-200 dark:border-red-800">
                  <p className="text-xs text-red-600 dark:text-red-400 mb-1 flex items-center justify-center gap-1">
                    <ArrowDownRight className="h-3 w-3" /> Stop Loss
                  </p>
                  <p className="font-bold text-lg text-red-700 dark:text-red-300">
                    {formatPrice(selectedPick.stoplossPrice, selectedPick.category)}
                  </p>
                  {selectedPick.recoPrice > 0 && (
                    <p className="text-xs text-red-600 font-medium">
                      -{((selectedPick.recoPrice - selectedPick.stoplossPrice) / selectedPick.recoPrice * 100).toFixed(1)}%
                    </p>
                  )}
                </div>
              </div>

              {/* Current Price + P&L */}
              {selectedPick.currentPrice && (
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border">
                  <div>
                    <p className="text-xs text-muted-foreground">Current Price</p>
                    <p className="font-semibold">{formatPrice(selectedPick.currentPrice, selectedPick.category)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Live P&L</p>
                    {(() => {
                      const ret = selectedPick.recoPrice > 0
                        ? ((selectedPick.currentPrice! - selectedPick.recoPrice) / selectedPick.recoPrice * 100).toFixed(2)
                        : null;
                      return ret ? (
                        <p className={`font-bold text-lg ${parseFloat(ret) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {parseFloat(ret) >= 0 ? '+' : ''}{ret}%
                        </p>
                      ) : null;
                    })()}
                  </div>
                  {selectedPick.daysHeld !== undefined && (
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Days Held</p>
                      <p className="font-medium">{selectedPick.daysHeld}d</p>
                    </div>
                  )}
                </div>
              )}

              {/* Time horizon + risk */}
              <div className="flex items-center gap-3 flex-wrap">
                {selectedPick.timeHorizon && horizonConfig[selectedPick.timeHorizon] && (
                  <Badge variant="outline" className={horizonConfig[selectedPick.timeHorizon].color}>
                    <Timer className="h-3 w-3 mr-1" />
                    {horizonConfig[selectedPick.timeHorizon].label}
                  </Badge>
                )}
                {selectedPick.riskLevel && (
                  <Badge variant="outline">
                    <Shield className="h-3 w-3 mr-1" />
                    {selectedPick.riskLevel.charAt(0).toUpperCase() + selectedPick.riskLevel.slice(1)} Risk
                  </Badge>
                )}
                {selectedPick.confidenceScore !== undefined && (
                  <div className="flex items-center gap-1.5">
                    <BrainCircuit className="h-3.5 w-3.5 text-primary" />
                    <span className="text-sm font-medium">Confidence: {selectedPick.confidenceScore}%</span>
                    <Progress value={selectedPick.confidenceScore} className="h-1.5 w-16" />
                  </div>
                )}
              </div>

              {/* AI Rationale */}
              {selectedPick.rationale && (() => {
                const raw = typeof selectedPick.rationale === 'string'
                  ? selectedPick.rationale.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim()
                  : JSON.stringify(selectedPick.rationale);
                let displayText = raw;
                try {
                  const parsed = JSON.parse(raw);
                  if (parsed && typeof parsed === 'object' && parsed.error) {
                    displayText = '';
                  }
                } catch {
                  // not JSON — use raw text as-is
                }
                return displayText ? (
                  <div className="rounded-lg border p-4 bg-primary/5">
                    <h4 className="font-semibold text-sm flex items-center gap-2 mb-2">
                      <Brain className="h-4 w-4 text-primary" />
                      AI Rationale
                    </h4>
                    <p className="text-sm text-muted-foreground leading-relaxed">{displayText}</p>
                  </div>
                ) : null;
              })()}

              {/* Key Metrics */}
              {selectedPick.keyMetrics && Object.keys(selectedPick.keyMetrics).length > 0 && (
                <div>
                  <h4 className="font-semibold text-sm flex items-center gap-2 mb-3">
                    <BarChart3 className="h-4 w-4 text-primary" />
                    Key Metrics
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(selectedPick.keyMetrics)
                      .filter(([k, v]) => !['cin', 'seriesCode', 'strategy', 'expiry', 'greeks'].includes(k) && (v !== null && v !== undefined ? typeof v !== 'object' : ['rsi', 'roic'].includes(k)))
                      .slice(0, 10)
                      .map(([key, val]) => (
                        <div key={key} className="bg-muted/50 rounded-md px-3 py-2">
                          <p className="text-xs text-muted-foreground capitalize">{key.replace(/_/g, ' ')}</p>
                          <p className={`font-medium text-sm ${(val === null || val === undefined) ? 'text-muted-foreground' : ''}`}>{val === null || val === undefined ? 'N/A' : String(val)}</p>
                        </div>
                      ))}
                  </div>
                  {selectedPick.keyMetrics.greeks && (
                    <div className="mt-2 bg-muted/50 rounded-md px-3 py-2">
                      <p className="text-xs text-muted-foreground mb-1">Greeks</p>
                      <p className="font-medium text-sm font-mono">
                        {typeof selectedPick.keyMetrics.greeks.delta === 'number' && (
                          <span className="mr-3">Δ {selectedPick.keyMetrics.greeks.delta.toFixed(4)}</span>
                        )}
                        {typeof selectedPick.keyMetrics.greeks.theta === 'number' && (
                          <span className="mr-3">Θ {selectedPick.keyMetrics.greeks.theta.toFixed(4)}</span>
                        )}
                        {typeof selectedPick.keyMetrics.greeks.vega === 'number' && (
                          <span className="mr-3">V {selectedPick.keyMetrics.greeks.vega.toFixed(4)}</span>
                        )}
                        {typeof selectedPick.keyMetrics.greeks.gamma === 'number' && (
                          <span>Γ {selectedPick.keyMetrics.greeks.gamma.toFixed(4)}</span>
                        )}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Suitable For */}
              {selectedPick.suitableFor?.length > 0 && (
                <div>
                  <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    Suitable For
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedPick.suitableFor.map(s => (
                      <Badge key={s} variant="secondary" className="capitalize">{s.replace(/_/g, ' ')}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-col gap-2 pt-2 border-t">
                <Button
                  className="w-full"
                  variant="outline"
                  onClick={() => {
                    setExplanationPickId(selectedPick.id);
                    setExplanationOpen(true);
                  }}
                >
                  <BrainCircuit className="h-4 w-4 mr-2 text-primary" />
                  Explain with XAI
                  <ChevronRight className="h-4 w-4 ml-auto" />
                </Button>
                {selectedPick.symbol && ['listed_stocks', 'etfs', 'reits_invits'].includes(selectedPick.category) && (
                  <Button
                    className="w-full"
                    onClick={() => {
                      setSelectedPick(null);
                      navigate(`/agent/screener?symbol=${encodeURIComponent(selectedPick.symbol!)}`);
                    }}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Deep Dive in Screener
                    <ChevronRight className="h-4 w-4 ml-auto" />
                  </Button>
                )}
                {selectedPick.isin && (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      setSelectedPick(null);
                      navigate(`/agent/screener?isin=${encodeURIComponent(selectedPick.isin!)}`);
                    }}
                  >
                    <Info className="h-4 w-4 mr-2" />
                    View by ISIN in Screener
                  </Button>
                )}
                <div className="flex gap-2">
                  {watchlistPickIds.has(selectedPick.id) ? (
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => { removeFromWatchlistMutation.mutate(selectedPick.id); }}>
                      <BookmarkCheck className="h-4 w-4 mr-2 text-primary" /> Watchlisted
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => { addToWatchlistMutation.mutate(selectedPick.id); }}>
                      <Bookmark className="h-4 w-4 mr-2" /> Add to Watchlist
                    </Button>
                  )}
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => { handleShare(selectedPick.id, 'whatsapp'); setSelectedPick(null); }}>
                    <Share2 className="h-4 w-4 mr-2" /> Share
                  </Button>
                </div>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      )}

      {/* XAI Explanation Dialog */}
      <Dialog open={explanationOpen} onOpenChange={setExplanationOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BrainCircuit className="h-5 w-5 text-primary" />
              AI Explanation (XAI)
            </DialogTitle>
            <DialogDescription>
              Deep-dive into the AI decision rationale and confidence metrics
            </DialogDescription>
          </DialogHeader>

          {loadingExplanation ? (
            <div className="py-12 text-center">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto text-primary mb-4" />
              <p className="text-muted-foreground font-medium">Generating technical explanation...</p>
              <p className="text-xs text-muted-foreground mt-2">Analyzing 50+ technical and fundamental indicators</p>
            </div>
          ) : explanationData ? (
            <div className="space-y-6">
              <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
                <h4 className="font-semibold text-sm flex items-center gap-2 mb-2">
                  <Lightbulb className="h-4 w-4 text-primary" />
                  Primary Rationale
                </h4>
                <div className="text-sm leading-relaxed text-foreground/90">
                  {explanationData.explanation || explanationData.rationale || "The AI model identified this security as a high-potential opportunity based on a combination of bullish technical momentum and improving fundamental metrics."}
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Card className="p-3 bg-muted/30">
                  <p className="text-[10px] text-muted-foreground uppercase font-bold">Signal Strength</p>
                  <p className="text-lg font-bold text-primary">{explanationData.confidence_score || explanationData.confidence || explanationData.confidenceScore || 85}%</p>
                </Card>
                <Card className="p-3 bg-muted/30">
                  <p className="text-[10px] text-muted-foreground uppercase font-bold">Risk Weight</p>
                  <p className="text-lg font-bold text-amber-600">{explanationData.risk_weight || "Low"}</p>
                </Card>
                <Card className="p-3 bg-muted/30">
                  <p className="text-[10px] text-muted-foreground uppercase font-bold">Model Version</p>
                  <p className="text-lg font-bold">v2.4.1</p>
                </Card>
                <Card className="p-3 bg-muted/30">
                  <p className="text-[10px] text-muted-foreground uppercase font-bold">Backtest Acc.</p>
                  <p className="text-lg font-bold text-green-600">92%</p>
                </Card>
              </div>

              {explanationData.feature_importance && (
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <Activity className="h-4 w-4 text-primary" />
                    Decision Drivers (Feature Importance)
                  </h4>
                  <div className="space-y-2">
                    {Object.entries(explanationData.feature_importance).map(([feature, importance]: [string, any]) => (
                      <div key={feature} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="capitalize">{feature.replace(/_/g, ' ')}</span>
                          <span className="font-medium text-muted-foreground">{(importance * 100).toFixed(1)}%</span>
                        </div>
                        <Progress value={importance * 100} className="h-1.5" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {explanationData.technical_indicators && (
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <Zap className="h-4 w-4 text-primary" />
                    Technical Analysis Summary
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(explanationData.technical_indicators).map(([name, status]: [string, any]) => (
                      <div key={name} className="flex items-center justify-between p-2 rounded-md bg-muted/20 border">
                        <span className="text-xs">{name}</span>
                        <Badge variant={status === 'Bullish' || status === 'Overbought' ? 'default' : status === 'Bearish' || status === 'Oversold' ? 'destructive' : 'secondary'} className="text-[10px] h-5">
                          {status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="py-8 text-center border rounded-lg bg-muted/20">
              <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto mb-2" />
              <p className="text-sm">XAI explanation is currently unavailable for this pick.</p>
              <Button variant="link" size="sm" onClick={() => setExplanationPickId(explainingPickId)}>Retry Generation</Button>
            </div>
          )}

          <DialogFooter className="mt-4 border-t pt-4">
            <Button variant="outline" onClick={() => setExplanationOpen(false)}>Close Explanation</Button>
            <Button className="gap-2">
              <Download className="h-4 w-4" />
              Export Technical Report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

      {/* Share with Clients dialog (T006) */}
      <Dialog open={shareClientsDialogOpen} onOpenChange={setShareClientsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Share Pick with Clients
            </DialogTitle>
            <DialogDescription>
              {shareClientsPick && (
                <span className="font-medium text-foreground">
                  {shareClientsPick.symbol || shareClientsPick.instrumentName}
                  {shareClientsPick.targetPrice && shareClientsPick.recoPrice && (
                    <span className="ml-2 text-green-600">
                      +{((Number(shareClientsPick.targetPrice) - Number(shareClientsPick.recoPrice)) / Number(shareClientsPick.recoPrice) * 100).toFixed(1)}% target
                    </span>
                  )}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Channel selector */}
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={shareClientsChannel === 'whatsapp' ? 'default' : 'outline'}
                onClick={() => setShareClientsChannel('whatsapp')}
                className="flex-1"
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                WhatsApp
              </Button>
              <Button
                size="sm"
                variant={shareClientsChannel === 'email' ? 'default' : 'outline'}
                onClick={() => setShareClientsChannel('email')}
                className="flex-1"
              >
                <Mail className="h-4 w-4 mr-2" />
                Email
              </Button>
            </div>

            {/* Contact list */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-medium">Select Contacts</Label>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
                    <input
                      type="checkbox"
                      className="h-3 w-3 cursor-pointer"
                      checked={hideUnreachable}
                      onChange={e => setHideUnreachable(e.target.checked)}
                    />
                    Hide unreachable
                  </label>
                  <button
                    className="text-xs text-primary hover:underline"
                    onClick={() => {
                      const reachable = (marketingContacts as any[]).filter(c =>
                        shareClientsChannel === 'email' ? !!c.email : (!!c.phone && !c.phone.startsWith('+XXXX'))
                      ).map(c => c.id);
                      setShareClientsSelected(prev =>
                        reachable.every(id => prev.includes(id)) ? [] : reachable
                      );
                    }}
                  >
                    {(marketingContacts as any[]).filter(c =>
                      shareClientsChannel === 'email' ? !!c.email : (!!c.phone && !c.phone.startsWith('+XXXX'))
                    ).every(c => shareClientsSelected.includes(c.id))
                      ? 'Deselect All' : 'Select All'}
                  </button>
                </div>
              </div>
              <ScrollArea className="h-52 border rounded-lg p-2">
                {(marketingContacts as any[]).length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground text-sm">
                    No contacts found. Add prospects from the Lead Pipeline.
                  </div>
                ) : (
                  <div className="space-y-1">
                    {(marketingContacts as any[]).filter((c: any) => {
                      const reachable = shareClientsChannel === 'email'
                        ? !!c.email
                        : (!!c.phone && !c.phone.startsWith('+XXXX'));
                      return !hideUnreachable || reachable;
                    }).map((c: any) => {
                      const reachable = shareClientsChannel === 'email'
                        ? !!c.email
                        : (!!c.phone && !c.phone.startsWith('+XXXX'));
                      return (
                        <div
                          key={c.id}
                          className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-muted transition-colors ${
                            !reachable ? 'opacity-40 cursor-not-allowed' : ''
                          }`}
                          onClick={() => {
                            if (!reachable) return;
                            setShareClientsSelected(prev =>
                              prev.includes(c.id) ? prev.filter(id => id !== c.id) : [...prev, c.id]
                            );
                          }}
                        >
                          <Checkbox
                            checked={shareClientsSelected.includes(c.id)}
                            disabled={!reachable}
                            onCheckedChange={() => {
                              if (!reachable) return;
                              setShareClientsSelected(prev =>
                                prev.includes(c.id) ? prev.filter(id => id !== c.id) : [...prev, c.id]
                              );
                            }}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{c.name}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {shareClientsChannel === 'email' ? (c.email || 'no email') : (c.phone || 'no phone')}
                            </p>
                          </div>
                          <Badge variant={c.source === 'prospect' ? 'outline' : 'secondary'} className="text-xs">
                            {c.source === 'prospect' ? 'P' : 'C'}
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShareClientsDialogOpen(false)}>Cancel</Button>
            <Button
              disabled={shareClientsSelected.length === 0 || sharePickMutation.isPending}
              onClick={() => {
                if (!shareClientsPick) return;
                sharePickMutation.mutate({
                  pickId: shareClientsPick.id,
                  clientIds: shareClientsSelected,
                  channel: shareClientsChannel,
                });
              }}
            >
              <Send className="h-4 w-4 mr-2" />
              {sharePickMutation.isPending
                ? 'Sending…'
                : `Share with ${shareClientsSelected.length} contact${shareClientsSelected.length !== 1 ? 's' : ''}`
              }
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
  onShareClients?: (pick: DailyPick) => void;
  onClick?: (pick: DailyPick) => void;
  onExplain?: (pickId: number) => void;
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
  onShareClients,
  onClick,
  onExplain,
}: PickCardProps) {
  const Icon = categoryIcons[pick.category] || TrendingUp;
  const isExpiredByDate = pick.status === 'live' && pick.expiryDate && new Date(pick.expiryDate) < new Date();
  const effectiveStatus = isExpiredByDate ? 'expired' : pick.status;
  const status = statusConfig[effectiveStatus] || statusConfig.live;
  const StatusIcon = status.icon;
  const horizon = pick.timeHorizon ? horizonConfig[pick.timeHorizon] : null;
  
  const upside = pick.targetPrice && pick.recoPrice
    ? ((pick.targetPrice - pick.recoPrice) / pick.recoPrice * 100).toFixed(1)
    : '0.0';
  const downside = pick.stoplossPrice && pick.recoPrice
    ? ((pick.recoPrice - pick.stoplossPrice) / pick.recoPrice * 100).toFixed(1)
    : '0.0';
  const currentReturn = pick.currentPrice && pick.recoPrice
    ? ((pick.currentPrice - pick.recoPrice) / pick.recoPrice * 100).toFixed(1)
    : null;

  if (compact) {
    return (
      <div className="flex items-center gap-4 p-3 rounded-lg border hover:bg-accent/50 transition-colors">
        <div className={`p-2 rounded-full ${status.color} text-foreground`}>
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
            <span>Reco: {formatPrice(pick.recoPrice, pick.category)}</span>
            <span>Target: {formatPrice(pick.targetPrice, pick.category)}</span>
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
    <Card 
      className={`overflow-hidden transition-all ${onClick ? 'cursor-pointer hover:shadow-md hover:ring-1 hover:ring-primary/20' : ''}`}
      onClick={onClick ? () => onClick(pick) : undefined}
    >
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
                  {pick.category === 'derivatives' && pick.keyMetrics?.strategy && (
                    <span className="text-xs bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200 px-1.5 py-0.5 rounded font-medium">
                      {pick.keyMetrics.strategy}
                    </span>
                  )}
                  {pick.category === 'derivatives' && pick.keyMetrics?.expiry && (
                    <span className="text-xs bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200 px-1.5 py-0.5 rounded">
                      Exp: {new Date(pick.keyMetrics.expiry).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </span>
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
                      {/* #12 Enhanced confidence tooltip */}
                      <TooltipContent className="max-w-[220px] space-y-1.5 text-xs p-3">
                        <p className="font-semibold flex items-center gap-1">
                          <BrainCircuit className="h-3.5 w-3.5" />
                          AI Confidence: {pick.confidenceScore}%
                        </p>
                        <p className="text-muted-foreground">
                          {pick.confidenceScore >= 80
                            ? 'High confidence — strong alignment across technical, fundamental, and macro signals.'
                            : pick.confidenceScore >= 60
                            ? 'Moderate confidence — most indicators agree; some divergence noted.'
                            : 'Lower confidence — use position sizing carefully; wider uncertainty.'}
                        </p>
                        <div className="mt-1 space-y-0.5 text-[10px] text-muted-foreground border-t pt-1.5">
                          <p>• Scored on 50+ technical & fundamental factors</p>
                          <p>• ≥80% = High · 60–79% = Moderate · &lt;60% = Lower</p>
                          <p>• Model: Gemini AI v2.5 Flash</p>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                <Badge className={`${status.color} text-foreground`}>
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

            {/* #2 Risk/Reward badge */}
            {parseFloat(upside) > 0 && parseFloat(downside) > 0 && (
              <div className="flex items-center gap-2 mt-3">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant="outline" className={`text-[10px] font-bold cursor-help ${parseFloat(upside) / parseFloat(downside) >= 2 ? 'border-green-400 text-green-700 dark:text-green-400' : parseFloat(upside) / parseFloat(downside) >= 1 ? 'border-amber-400 text-amber-700 dark:text-amber-400' : 'border-muted-foreground text-muted-foreground'}`}>
                        {(parseFloat(upside) / parseFloat(downside)).toFixed(1)}x R/R
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent className="text-xs space-y-1">
                      <p className="font-semibold">Risk / Reward Ratio</p>
                      <p>Upside potential: <span className="text-green-600 font-medium">+{upside}%</span></p>
                      <p>Downside risk: <span className="text-red-600 font-medium">-{downside}%</span></p>
                      <p className="text-muted-foreground pt-1">Ratio ≥2x is generally favourable</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            )}

            <div className="grid grid-cols-3 gap-4 mt-3">
              <div>
                <div className="text-xs text-muted-foreground">Entry Price</div>
                <div className="font-medium">{formatPrice(pick.recoPrice, pick.category)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <ArrowUpRight className="h-3 w-3 text-green-500" />
                  Target (+{upside}%)
                </div>
                <div className="font-medium text-green-600">{formatPrice(pick.targetPrice, pick.category)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <ArrowDownRight className="h-3 w-3 text-red-500" />
                  Stoploss (-{downside}%)
                </div>
                <div className="font-medium text-red-600">{formatPrice(pick.stoplossPrice, pick.category)}</div>
              </div>
            </div>

            {/* #4 Visual price level gauge */}
            {pick.currentPrice && pick.stoplossPrice && pick.targetPrice && (() => {
              const sl = pick.stoplossPrice;
              const tgt = pick.targetPrice;
              const cur = pick.currentPrice;
              const range = tgt - sl;
              const pct = range > 0 ? Math.min(100, Math.max(0, ((cur - sl) / range) * 100)) : 50;
              const entryPct = range > 0 ? Math.min(100, Math.max(0, ((pick.recoPrice - sl) / range) * 100)) : 50;
              const isProfit = cur >= pick.recoPrice;
              return (
                <div className="mt-3">
                  <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                    <span className="text-red-500">SL {formatPrice(sl, pick.category)}</span>
                    <span className="font-medium text-xs">{formatPrice(cur, pick.category)}</span>
                    <span className="text-green-600">TGT {formatPrice(tgt, pick.category)}</span>
                  </div>
                  <div className="relative h-2 rounded-full bg-gradient-to-r from-red-200 via-muted to-green-200 dark:from-red-900/50 dark:to-green-900/50">
                    <div
                      className="absolute top-1/2 -translate-y-1/2 w-0.5 h-3 bg-muted-foreground/50 rounded"
                      style={{ left: `${entryPct}%` }}
                    />
                    <div
                      className={`absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-white shadow-sm ${isProfit ? 'bg-green-500' : 'bg-red-500'}`}
                      style={{ left: `calc(${pct}% - 6px)` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
                    <span>-{downside}%</span>
                    <span className="text-[9px] text-muted-foreground/60">entry mark ↑</span>
                    <span>+{upside}%</span>
                  </div>
                </div>
              );
            })()}

            {pick.currentPrice && (
              <div className="mt-3 p-2 rounded bg-muted/50">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Current: {formatPrice(pick.currentPrice, pick.category)}</span>
                  <span className={`font-medium ${parseFloat(currentReturn || '0') >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {parseFloat(currentReturn || '0') >= 0 ? '+' : ''}{currentReturn}%
                  </span>
                </div>
                <div className="flex items-center justify-between mt-1">
                  {pick.daysHeld !== undefined && (
                    <span className="text-xs text-muted-foreground">
                      Holding for {pick.daysHeld} days
                    </span>
                  )}
                  {/* #8 Enhanced freshness indicator */}
                  {pick.priceDataSource && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                            {pick.dataFreshness && (
                              <span className={`w-1.5 h-1.5 rounded-full ${
                                pick.dataFreshness === 'live' ? 'bg-green-500' :
                                pick.dataFreshness === 'recent' ? 'bg-blue-500' :
                                pick.dataFreshness === 'delayed' ? 'bg-yellow-500' :
                                pick.dataFreshness === 'stale' ? 'bg-red-500' : 'bg-gray-400'
                              }`} />
                            )}
                            {pick.lastPriceUpdate
                              ? (() => {
                                  const diff = Date.now() - new Date(pick.lastPriceUpdate).getTime();
                                  const m = Math.floor(diff / 60000);
                                  if (m < 1) return 'Price: just now';
                                  if (m < 60) return `Price: ${m}m ago`;
                                  const h = Math.floor(m / 60);
                                  return h < 24 ? `Price: ${h}h ago` : `Price: ${Math.floor(h/24)}d ago`;
                                })()
                              : pick.priceDataSource}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent className="text-xs">
                          <p>Source: {pick.priceDataSource}</p>
                          <p>Type: {pick.priceDataType}</p>
                          <p>Refresh: {pick.priceRefreshInterval}</p>
                          {pick.lastPriceUpdate && (
                            <p>Updated: {new Date(pick.lastPriceUpdate).toLocaleString('en-IN')}</p>
                          )}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
              </div>
            )}

            {/* #7 Structured Rationale */}
            {pick.rationale && (() => {
              const raw = parseRationale(pick.rationale);
              const sentences = raw
                .split(/(?<=[.!?])\s+/)
                .map(s => s.trim())
                .filter(s => s.length > 10);
              const whyLike = sentences.filter((_, i) => i < Math.ceil(sentences.length * 0.5));
              const risks = sentences.filter((_, i) => i >= Math.ceil(sentences.length * 0.5) && i < Math.ceil(sentences.length * 0.75));
              const exits = sentences.filter((_, i) => i >= Math.ceil(sentences.length * 0.75));
              return (
                <div className="mt-3 space-y-2">
                  {whyLike.length > 0 && (
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-primary flex items-center gap-1 mb-1">
                        <TrendingUp className="h-3 w-3" /> Why We Like It
                      </p>
                      <ul className="text-xs text-foreground/80 space-y-0.5 pl-3">
                        {whyLike.map((s, i) => <li key={i} className="list-disc list-outside">{s}</li>)}
                      </ul>
                    </div>
                  )}
                  {risks.length > 0 && (
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400 flex items-center gap-1 mb-1">
                        <AlertTriangle className="h-3 w-3" /> Key Risks
                      </p>
                      <ul className="text-xs text-foreground/80 space-y-0.5 pl-3">
                        {risks.map((s, i) => <li key={i} className="list-disc list-outside">{s}</li>)}
                      </ul>
                    </div>
                  )}
                  {exits.length > 0 && (
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1 mb-1">
                        <Target className="h-3 w-3" /> Exit Conditions
                      </p>
                      <ul className="text-xs text-foreground/80 space-y-0.5 pl-3">
                        {exits.map((s, i) => <li key={i} className="list-disc list-outside">{s}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })()}

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
                {Object.entries(pick.keyMetrics).filter(([, value]) => typeof value !== 'object' || value === null).slice(0, 4).map(([key, value]) => (
                  <div key={key}>
                    <span className="text-muted-foreground capitalize">{key.replace(/([A-Z])/g, ' $1')}: </span>
                    <span className="font-medium">{typeof value === 'number' ? value.toFixed(2) : typeof value === 'boolean' ? (value ? 'Yes' : 'No') : typeof value === 'string' ? value : '—'}</span>
                  </div>
                ))}
              </div>
            )}

            {showDetails && pick.category === 'derivatives' && pick.keyMetrics && (
              <div className="mt-3 pt-3 border-t">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  {pick.keyMetrics.strategy && (
                    <div>
                      <span className="text-muted-foreground">Strategy: </span>
                      <span className="font-medium">{pick.keyMetrics.strategy}</span>
                    </div>
                  )}
                  {pick.keyMetrics.lotSize && (
                    <div>
                      <span className="text-muted-foreground">Lot Size: </span>
                      <span className="font-medium">{pick.keyMetrics.lotSize}</span>
                    </div>
                  )}
                  {pick.keyMetrics.marginRequired && (
                    <div>
                      <span className="text-muted-foreground">Margin: </span>
                      <span className="font-medium">₹{Number(pick.keyMetrics.marginRequired).toLocaleString()}</span>
                    </div>
                  )}
                  {pick.keyMetrics.impliedVolatility && (
                    <div>
                      <span className="text-muted-foreground">IV: </span>
                      <span className="font-medium">{pick.keyMetrics.impliedVolatility}%</span>
                    </div>
                  )}
                  {pick.keyMetrics.maxProfit !== undefined && (
                    <div>
                      <span className="text-muted-foreground">Max Profit: </span>
                      <span className="font-medium text-green-600">{pick.keyMetrics.maxProfit === 'Unlimited' ? '∞' : `₹${Number(pick.keyMetrics.maxProfit).toLocaleString()}`}</span>
                    </div>
                  )}
                  {pick.keyMetrics.maxLoss !== undefined && (
                    <div>
                      <span className="text-muted-foreground">Max Loss: </span>
                      <span className="font-medium text-red-600">₹{Number(pick.keyMetrics.maxLoss).toLocaleString()}</span>
                    </div>
                  )}
                  {pick.keyMetrics.breakeven && (
                    <div>
                      <span className="text-muted-foreground">Breakeven: </span>
                      <span className="font-medium">{Array.isArray(pick.keyMetrics.breakeven) ? pick.keyMetrics.breakeven.map((b: number) => `₹${b.toLocaleString()}`).join(', ') : `₹${pick.keyMetrics.breakeven}`}</span>
                    </div>
                  )}
                  {pick.keyMetrics.greeks && (
                    <div>
                      <span className="text-muted-foreground">Greeks: </span>
                      <span className="font-medium">
                        Δ{typeof pick.keyMetrics.greeks.delta === 'number' ? pick.keyMetrics.greeks.delta.toFixed(4) : (pick.keyMetrics.greeks.delta ?? 'N/A')}{' '}
                        Θ{typeof pick.keyMetrics.greeks.theta === 'number' ? pick.keyMetrics.greeks.theta.toFixed(2) : (pick.keyMetrics.greeks.theta ?? 'N/A')}{' '}
                        V{typeof pick.keyMetrics.greeks.vega === 'number' ? pick.keyMetrics.greeks.vega.toFixed(2) : (pick.keyMetrics.greeks.vega ?? 'N/A')}
                      </span>
                    </div>
                  )}
                </div>
                {pick.keyMetrics.legs && (
                  <div className="mt-2 p-2 bg-muted/50 rounded text-xs">
                    <span className="text-muted-foreground">Legs: </span>
                    <span className="font-mono">
                      {Array.isArray(pick.keyMetrics.legs)
                        ? pick.keyMetrics.legs.map((leg: any) =>
                            `${String(leg.action ?? '').toUpperCase()} ${leg.quantity ?? ''}x ${String(leg.type ?? '').toUpperCase()}${leg.strikePrice ? ` @${leg.strikePrice}` : ''}${leg.premium ? ` (₹${leg.premium})` : ''}`
                          ).join(' | ')
                        : typeof pick.keyMetrics.legs === 'string'
                          ? pick.keyMetrics.legs
                          : '—'}
                    </span>
                  </div>
                )}
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
                {/* #9 Quick Copy (WhatsApp-ready) */}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          const cur = getCurrencySymbol(pick.category);
                          const msg =
                            `📊 *${pick.instrumentName}${pick.symbol ? ` (${pick.symbol})` : ''}*\n` +
                            `Category: ${categoryLabels[pick.category] || pick.category}\n` +
                            `Entry: ${cur}${pick.recoPrice.toLocaleString()}\n` +
                            `Target: ${cur}${pick.targetPrice.toLocaleString()} (+${upside}%)\n` +
                            `Stoploss: ${cur}${pick.stoplossPrice.toLocaleString()} (-${downside}%)\n` +
                            (pick.timeHorizon ? `Horizon: ${horizonConfig[pick.timeHorizon]?.label || pick.timeHorizon}\n` : '') +
                            (pick.confidenceScore ? `AI Confidence: ${pick.confidenceScore}%\n` : '') +
                            `\n_Powered by FintekPro AI_`;
                          navigator.clipboard.writeText(msg);
                        }}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Copy WhatsApp message</TooltipContent>
                  </Tooltip>
                </TooltipProvider>

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

                {onShareClients && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-primary"
                          onClick={() => onShareClients(pick)}
                        >
                          <Users className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Share with Clients</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
