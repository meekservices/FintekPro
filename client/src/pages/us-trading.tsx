import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useClientCapabilities } from "@/hooks/useClientCapabilities";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  Search, TrendingUp, TrendingDown, Star, Globe, DollarSign, ArrowUpRight, 
  ArrowDownRight, Clock, Info, Shield, AlertTriangle, CheckCircle, BarChart3,
  Wallet, RefreshCw, Plus, Minus, Building2, Sparkles, ArrowRight, LineChart,
  Bell, Scale, Target, ChevronRight
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import AlpacaAccountDashboard from "@/components/dashboard/AlpacaAccountDashboard";

interface StockQuote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  previousClose: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  marketCap: number;
  exchange: string;
  priceInINR?: number;
}

interface MarketIndex {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
}

interface USHolding {
  id: number;
  symbol: string;
  companyName: string;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  totalValue: number;
  profitLoss: number;
  profitLossPercent: number;
  priceInINR: number;
}

const POPULAR_STOCKS = [
  { symbol: "AAPL", name: "Apple Inc.", sector: "Technology" },
  { symbol: "MSFT", name: "Microsoft Corporation", sector: "Technology" },
  { symbol: "GOOGL", name: "Alphabet Inc.", sector: "Technology" },
  { symbol: "AMZN", name: "Amazon.com Inc.", sector: "Consumer" },
  { symbol: "TSLA", name: "Tesla Inc.", sector: "Automotive" },
  { symbol: "NVDA", name: "NVIDIA Corporation", sector: "Technology" },
  { symbol: "META", name: "Meta Platforms Inc.", sector: "Technology" },
  { symbol: "BRK.B", name: "Berkshire Hathaway", sector: "Financials" },
  { symbol: "JPM", name: "JPMorgan Chase & Co.", sector: "Financials" },
  { symbol: "V", name: "Visa Inc.", sector: "Financials" },
  { symbol: "JNJ", name: "Johnson & Johnson", sector: "Healthcare" },
  { symbol: "UNH", name: "UnitedHealth Group", sector: "Healthcare" },
];

const POPULAR_ETFS = [
  { symbol: "SPY", name: "SPDR S&P 500 ETF", category: "Index" },
  { symbol: "QQQ", name: "Invesco QQQ Trust", category: "Tech" },
  { symbol: "VTI", name: "Vanguard Total Stock Market", category: "Broad Market" },
  { symbol: "VOO", name: "Vanguard S&P 500 ETF", category: "Index" },
  { symbol: "IWM", name: "iShares Russell 2000", category: "Small Cap" },
  { symbol: "VUG", name: "Vanguard Growth ETF", category: "Growth" },
];

function ErrorCard({ title, message, onRetry }: { title: string; message: string; onRetry?: () => void }) {
  return (
    <Card className="border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800">
      <CardContent className="p-6 text-center">
        <AlertTriangle className="h-10 w-10 mx-auto mb-3 text-red-500" />
        <h3 className="font-semibold text-red-800 dark:text-red-200 mb-2">{title}</h3>
        <p className="text-sm text-red-600 dark:text-red-400 mb-4">{message}</p>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry} className="border-red-300 dark:border-red-700">
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export default function USTradingPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("discover");
  const [selectedStock, setSelectedStock] = useState<StockQuote | null>(null);
  const [tradeModalOpen, setTradeModalOpen] = useState(false);
  const [orderType, setOrderType] = useState<"buy" | "sell">("buy");
  const [quantity, setQuantity] = useState("");
  const [consentChecked, setConsentChecked] = useState(false);
  const [lrsDeclaration, setLrsDeclaration] = useState(false);
  const { toast } = useToast();
  const { isAuthenticated, user } = useAuth();

  const { data: eligibilityData, isLoading: isLoadingEligibility, isError: isEligibilityError, refetch: refetchEligibility } = useQuery<{
    eligible: boolean;
    reasons: string[];
    lrsUsed: number;
    lrsLimit: number;
    lrsRemaining: number;
    riskProfile: string;
    panVerified: boolean;
    kycComplete: boolean;
  }>({
    queryKey: ["/api/us-trading/eligibility"],
    enabled: isAuthenticated,
    retry: 2,
  });

  const { data: marketData, isLoading: isLoadingMarket, isError: isMarketError, refetch: refetchMarket } = useQuery<{
    indices: MarketIndex[];
    stocks: StockQuote[];
    etfs: StockQuote[];
    exchangeRate: { rate: number; currency: string };
    marketStatus: string;
    lastUpdated: string;
  }>({
    queryKey: ["/api/us-trading/market-data"],
    refetchInterval: 60000,
    retry: 2,
  });

  const { data: holdings, isLoading: isLoadingHoldings, isError: isHoldingsError, refetch: refetchHoldings } = useQuery<{
    holdings: USHolding[];
    totalValue: number;
    totalValueINR: number;
    totalProfitLoss: number;
    totalProfitLossPercent: number;
  }>({
    queryKey: ["/api/us-trading/holdings"],
    enabled: isAuthenticated,
    retry: 2,
  });

  const { data: watchlist, isLoading: isLoadingWatchlist, isError: isWatchlistError, refetch: refetchWatchlist } = useQuery<{
    items: Array<{ symbol: string; addedAt: string }>;
  }>({
    queryKey: ["/api/us-trading/watchlist"],
    enabled: isAuthenticated,
    retry: 2,
  });

  const { data: orders, isLoading: isLoadingOrders, isError: isOrdersError, refetch: refetchOrders } = useQuery<{
    orders: Array<{
      id: number;
      symbol: string;
      side: string;
      quantity: number;
      price: number;
      status: string;
      createdAt: string;
    }>;
  }>({
    queryKey: ["/api/us-trading/orders"],
    enabled: isAuthenticated,
    retry: 2,
  });

  const { data: notifications } = useQuery<{
    notifications: Array<{
      id: string;
      type: string;
      title: string;
      message: string;
      isRead: boolean;
      createdAt: string;
    }>;
    unreadCount: number;
  }>({
    queryKey: ["/api/us-trading/notifications"],
    enabled: isAuthenticated,
    refetchInterval: 30000,
  });

  const { canUseAi, canViewRecommendations, feeMode, requiresModeSelection } = useClientCapabilities();

  const { data: rebalancing, isLoading: isLoadingRebalancing, refetch: refetchRebalancing } = useQuery<{
    analysis: {
      currentAllocation: Record<string, number>;
      targetAllocation: Record<string, number>;
      deviations: Record<string, number>;
      suggestedTrades: Array<{
        symbol: string;
        name: string;
        side: 'buy' | 'sell';
        quantity: number;
        estimatedValue: number;
        reason: string;
        priority: 'high' | 'medium' | 'low';
      }>;
      riskScore: number;
      rationale: string;
      expectedImpact: string;
    };
  }>({
    queryKey: ["/api/us-trading/rebalancing/analyze"],
    enabled: isAuthenticated && activeTab === "portfolio" && canUseAi,
    staleTime: 5 * 60 * 1000,
  });

  const placeOrderMutation = useMutation({
    mutationFn: async (orderData: {
      symbol: string;
      side: "buy" | "sell";
      quantity: number;
      orderType: string;
      consent: boolean;
      lrsDeclaration: boolean;
    }) => {
      // Format payload for canonical MPAL order
      const mpalPayload = {
        symbol: orderData.symbol,
        side: orderData.side,
        qty: orderData.quantity,
        type: orderData.orderType,
        timeInForce: "day"
      };
      const response = await apiRequest("POST", "/api/mpal/broker/US_EQUITY/orders", mpalPayload);
      if (!response.ok) {
        throw new Error("Failed to place order via MPAL");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Order Placed Successfully",
        description: `Your ${orderType} order for ${selectedStock?.symbol} has been submitted.`,
      });
      setTradeModalOpen(false);
      setQuantity("");
      setConsentChecked(false);
      setLrsDeclaration(false);
      queryClient.invalidateQueries({ queryKey: ["/api/us-trading/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/us-trading/holdings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/us-trading/eligibility"] });
    },
    onError: (error: any) => {
      toast({
        title: "Order Failed",
        description: error.message || "Failed to place order. Please try again.",
        variant: "destructive",
      });
    },
  });

  const addToWatchlistMutation = useMutation({
    mutationFn: async (symbol: string) => {
      const response = await apiRequest("/api/us-trading/watchlist", {
        method: "POST",
        body: JSON.stringify({ symbol }),
      });
      return response;
    },
    onSuccess: (_, symbol) => {
      toast({
        title: "Added to Watchlist",
        description: `${symbol} has been added to your watchlist.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/us-trading/watchlist"] });
    },
  });

  const handleTrade = (stock: StockQuote, side: "buy" | "sell") => {
    setSelectedStock(stock);
    setOrderType(side);
    setTradeModalOpen(true);
  };

  const handlePlaceOrder = () => {
    if (!selectedStock || !quantity || !consentChecked || !lrsDeclaration) {
      toast({
        title: "Missing Information",
        description: "Please fill all fields and accept the declarations.",
        variant: "destructive",
      });
      return;
    }

    placeOrderMutation.mutate({
      symbol: selectedStock.symbol,
      side: orderType,
      quantity: parseInt(quantity),
      orderType: "market",
      consent: consentChecked,
      lrsDeclaration,
    });
  };

  const exchangeRate = marketData?.exchangeRate?.rate || 83.5;

  const filteredStocks = (marketData?.stocks || []).filter(stock => 
    stock.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
    stock.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const isInWatchlist = (symbol: string) => 
    watchlist?.items?.some(item => item.symbol === symbol);

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto p-6">
        <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950/20 dark:border-orange-800">
          <CardContent className="p-6 text-center">
            <Shield className="h-12 w-12 mx-auto mb-4 text-orange-600" />
            <h2 className="text-xl font-semibold mb-2">Authentication Required</h2>
            <p className="text-muted-foreground mb-4">
              Please log in to access US equity trading features.
            </p>
            <Button>Sign In</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-background dark:to-blue-950">
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3" data-testid="page-title">
              <Globe className="h-8 w-8 text-blue-600" />
              US Equity Trading
            </h1>
            <p className="text-muted-foreground mt-1">
              Trade NASDAQ & S&P 500 stocks with full LRS compliance
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="text-sm py-1 px-3" data-testid="exchange-rate-badge">
              <DollarSign className="h-3 w-3 mr-1" />
              1 USD = ₹{exchangeRate.toFixed(2)}
            </Badge>
            <Badge 
              variant={marketData?.marketStatus === "open" ? "default" : "secondary"} 
              className="text-sm py-1 px-3"
              data-testid="market-status-badge"
            >
              <Clock className="h-3 w-3 mr-1" />
              Market {marketData?.marketStatus || "Closed"}
            </Badge>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="icon" className="relative" data-testid="notifications-bell">
                  <Bell className="h-4 w-4" />
                  {(notifications?.unreadCount || 0) > 0 && (
                    <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">
                      {notifications?.unreadCount}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0" align="end">
                <div className="p-3 border-b">
                  <h4 className="font-semibold">Notifications</h4>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {notifications?.notifications?.length ? (
                    notifications.notifications.slice(0, 5).map((notif) => (
                      <div 
                        key={notif.id} 
                        className={`p-3 border-b last:border-0 hover:bg-muted/50 cursor-pointer ${!notif.isRead ? 'bg-blue-50 dark:bg-blue-950/20' : ''}`}
                      >
                        <p className="font-medium text-sm">{notif.title}</p>
                        <p className="text-xs text-muted-foreground mt-1">{notif.message}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(notif.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    ))
                  ) : (
                    <div className="p-6 text-center text-muted-foreground">
                      <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No notifications yet</p>
                    </div>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {isLoadingEligibility ? (
          <Skeleton className="h-24" />
        ) : isEligibilityError ? (
          <ErrorCard 
            title="Could not check eligibility" 
            message="Unable to verify your trading eligibility. Please try again."
            onRetry={() => refetchEligibility()}
          />
        ) : eligibilityData && !eligibilityData.eligible ? (
          <Alert variant="destructive" data-testid="eligibility-alert">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Trading Not Available</AlertTitle>
            <AlertDescription>
              <ul className="list-disc ml-4 mt-2">
                {eligibilityData.reasons.map((reason, i) => (
                  <li key={i}>{reason}</li>
                ))}
              </ul>
              <Button variant="link" className="mt-2 p-0 h-auto">Complete Requirements →</Button>
            </AlertDescription>
          </Alert>
        ) : eligibilityData ? (
          <Card className="border-green-200 bg-green-50/50 dark:bg-green-950/20 dark:border-green-800">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="font-medium text-green-800 dark:text-green-200">
                      You are eligible for US equity trading
                    </p>
                    <p className="text-sm text-green-600 dark:text-green-400">
                      Risk Profile: {eligibilityData.riskProfile} | PAN Verified: ✓
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">LRS Limit Remaining</p>
                  <p className="font-semibold text-lg">
                    ${eligibilityData.lrsRemaining.toLocaleString()} / ${eligibilityData.lrsLimit.toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {(marketData?.indices || [
            { symbol: "^GSPC", name: "S&P 500", price: 5998.74, change: 23.45, changePercent: 0.39 },
            { symbol: "^IXIC", name: "NASDAQ", price: 19764.88, change: -45.32, changePercent: -0.23 },
            { symbol: "^DJI", name: "Dow Jones", price: 42992.21, change: 168.53, changePercent: 0.39 },
            { symbol: "^VIX", name: "VIX", price: 14.58, change: -0.87, changePercent: -5.63 },
          ]).map((index) => (
            <Card key={index.symbol} className="bg-background" data-testid={`index-card-${index.symbol}`}>
              <CardContent className="p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm text-muted-foreground">{index.name}</p>
                    <p className="text-xl font-bold">{index.price.toLocaleString()}</p>
                  </div>
                  <Badge 
                    variant={index.change >= 0 ? "default" : "destructive"}
                    className={index.change >= 0 ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300" : ""}
                  >
                    {index.change >= 0 ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
                    {index.changePercent.toFixed(2)}%
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full max-w-2xl grid-cols-5">
            <TabsTrigger value="discover" data-testid="tab-discover">
              <Sparkles className="h-4 w-4 mr-1" />
              Discover
            </TabsTrigger>
            <TabsTrigger value="watchlist" data-testid="tab-watchlist">
              <Star className="h-4 w-4 mr-1" />
              Watchlist
            </TabsTrigger>
            <TabsTrigger value="portfolio" data-testid="tab-portfolio">
              <Wallet className="h-4 w-4 mr-1" />
              Portfolio
            </TabsTrigger>
            <TabsTrigger value="orders" data-testid="tab-orders">
              <BarChart3 className="h-4 w-4 mr-1" />
              Orders
            </TabsTrigger>
            <TabsTrigger value="account" data-testid="tab-account">
              <Building2 className="h-4 w-4 mr-1" />
              Account
            </TabsTrigger>
          </TabsList>

          <TabsContent value="discover" className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search stocks by name or symbol..."
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  data-testid="search-stocks-input"
                />
              </div>
              <Button variant="outline" onClick={() => refetchMarket()} data-testid="refresh-market-button">
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>

            {isMarketError ? (
              <ErrorCard 
                title="Market Data Unavailable" 
                message="Could not load market data. Please try refreshing."
                onRetry={() => refetchMarket()}
              />
            ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-blue-600" />
                    Popular Stocks
                  </CardTitle>
                  <CardDescription>Most traded US equities</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {isLoadingMarket ? (
                    Array(6).fill(0).map((_, i) => (
                      <Skeleton key={i} className="h-16" />
                    ))
                  ) : (
                    POPULAR_STOCKS.slice(0, 6).map((stock) => {
                      const quote = marketData?.stocks?.find(s => s.symbol === stock.symbol);
                      return (
                        <div 
                          key={stock.symbol}
                          className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50 cursor-pointer transition-colors"
                          onClick={() => quote && handleTrade(quote, "buy")}
                          data-testid={`stock-row-${stock.symbol}`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-foreground font-bold text-xs">
                              {stock.symbol.slice(0, 2)}
                            </div>
                            <div>
                              <p className="font-medium">{stock.symbol}</p>
                              <p className="text-sm text-muted-foreground">{stock.name}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold">
                              ${quote?.price?.toFixed(2) || "---"}
                            </p>
                            {quote && (
                              <Badge 
                                variant={quote.change >= 0 ? "default" : "destructive"}
                                className={quote.change >= 0 ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300" : ""}
                              >
                                {quote.change >= 0 ? "+" : ""}{quote.changePercent?.toFixed(2)}%
                              </Badge>
                            )}
                          </div>
                          <div className="flex gap-1">
                            <Button 
                              size="sm" 
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                addToWatchlistMutation.mutate(stock.symbol);
                              }}
                              disabled={isInWatchlist(stock.symbol)}
                              data-testid={`watchlist-add-${stock.symbol}`}
                            >
                              <Star className={`h-4 w-4 ${isInWatchlist(stock.symbol) ? "fill-yellow-400 text-yellow-400" : ""}`} />
                            </Button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-green-600" />
                    Popular ETFs
                  </CardTitle>
                  <CardDescription>Diversified investment options</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {isLoadingMarket ? (
                    Array(6).fill(0).map((_, i) => (
                      <Skeleton key={i} className="h-16" />
                    ))
                  ) : (
                    POPULAR_ETFS.map((etf) => {
                      const quote = marketData?.etfs?.find(e => e.symbol === etf.symbol);
                      return (
                        <div 
                          key={etf.symbol}
                          className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50 cursor-pointer transition-colors"
                          onClick={() => quote && handleTrade(quote, "buy")}
                          data-testid={`etf-row-${etf.symbol}`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-500 to-teal-600 flex items-center justify-center text-foreground font-bold text-xs">
                              {etf.symbol.slice(0, 2)}
                            </div>
                            <div>
                              <p className="font-medium">{etf.symbol}</p>
                              <p className="text-sm text-muted-foreground">{etf.name}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold">
                              ${quote?.price?.toFixed(2) || "---"}
                            </p>
                            <Badge variant="outline">{etf.category}</Badge>
                          </div>
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              addToWatchlistMutation.mutate(etf.symbol);
                            }}
                            disabled={isInWatchlist(etf.symbol)}
                            data-testid={`watchlist-add-${etf.symbol}`}
                          >
                            <Star className={`h-4 w-4 ${isInWatchlist(etf.symbol) ? "fill-yellow-400 text-yellow-400" : ""}`} />
                          </Button>
                        </div>
                      );
                    })
                  )}
                </CardContent>
              </Card>
            </div>
            )}
          </TabsContent>

          <TabsContent value="watchlist" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Your Watchlist</CardTitle>
                <CardDescription>Track your favorite US stocks</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingWatchlist ? (
                  <div className="space-y-2">
                    {Array(3).fill(0).map((_, i) => (
                      <Skeleton key={i} className="h-16" />
                    ))}
                  </div>
                ) : isWatchlistError ? (
                  <div className="text-center py-8">
                    <AlertTriangle className="h-10 w-10 mx-auto text-red-500 mb-3" />
                    <p className="text-muted-foreground mb-4">Could not load watchlist</p>
                    <Button variant="outline" size="sm" onClick={() => refetchWatchlist()}>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Retry
                    </Button>
                  </div>
                ) : watchlist?.items?.length ? (
                  <div className="space-y-2">
                    {watchlist.items.map((item) => {
                      const quote = marketData?.stocks?.find(s => s.symbol === item.symbol);
                      return (
                        <div 
                          key={item.symbol}
                          className="flex items-center justify-between p-4 rounded-lg border"
                          data-testid={`watchlist-item-${item.symbol}`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-foreground font-bold text-xs">
                              {item.symbol.slice(0, 2)}
                            </div>
                            <div>
                              <p className="font-medium">{item.symbol}</p>
                              <p className="text-sm text-muted-foreground">{quote?.name || item.symbol}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold">${quote?.price?.toFixed(2) || "---"}</p>
                            <p className="text-sm text-muted-foreground">
                              ₹{((quote?.price || 0) * exchangeRate).toFixed(2)}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Button 
                              size="sm" 
                              variant="default"
                              onClick={() => quote && handleTrade(quote, "buy")}
                              data-testid={`buy-${item.symbol}`}
                            >
                              Buy
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Star className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No stocks in your watchlist yet</p>
                    <Button variant="link" onClick={() => setActiveTab("discover")}>
                      Discover stocks to add →
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="portfolio" className="space-y-4">
            {isLoadingHoldings ? (
              <Skeleton className="h-48" />
            ) : isHoldingsError ? (
              <ErrorCard 
                title="Could not load portfolio" 
                message="Unable to fetch your holdings. Please try again."
                onRetry={() => refetchHoldings()}
              />
            ) : holdings?.holdings?.length ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card className="bg-gradient-to-br from-blue-500 to-blue-700 text-foreground">
                    <CardContent className="p-6">
                      <p className="text-blue-100">Total Value (USD)</p>
                      <p className="text-3xl font-bold">${holdings.totalValue.toLocaleString()}</p>
                    </CardContent>
                  </Card>
                  <Card className="bg-gradient-to-br from-green-500 to-green-700 text-foreground">
                    <CardContent className="p-6">
                      <p className="text-green-100">Total Value (INR)</p>
                      <p className="text-3xl font-bold">₹{holdings.totalValueINR.toLocaleString()}</p>
                    </CardContent>
                  </Card>
                  <Card className={`bg-gradient-to-br ${holdings.totalProfitLoss >= 0 ? "from-emerald-500 to-emerald-700" : "from-red-500 to-red-700"} text-foreground`}>
                    <CardContent className="p-6">
                      <p className="text-foreground/80">Total P&L</p>
                      <p className="text-3xl font-bold">
                        {holdings.totalProfitLoss >= 0 ? "+" : ""}{holdings.totalProfitLossPercent.toFixed(2)}%
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle>Your US Holdings</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {holdings.holdings.map((holding) => (
                        <div 
                          key={holding.id}
                          className="flex items-center justify-between p-4 rounded-lg border"
                          data-testid={`holding-${holding.symbol}`}
                        >
                          <div>
                            <p className="font-medium">{holding.symbol}</p>
                            <p className="text-sm text-muted-foreground">{holding.companyName}</p>
                          </div>
                          <div className="text-center">
                            <p className="font-medium">{holding.quantity} shares</p>
                            <p className="text-sm text-muted-foreground">@ ${holding.avgPrice}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold">${holding.totalValue.toFixed(2)}</p>
                            <p className="text-sm text-muted-foreground">₹{holding.priceInINR.toFixed(2)}</p>
                          </div>
                          <Badge variant={holding.profitLoss >= 0 ? "default" : "destructive"}>
                            {holding.profitLoss >= 0 ? "+" : ""}{holding.profitLossPercent.toFixed(2)}%
                          </Badge>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleTrade({ 
                              symbol: holding.symbol, 
                              name: holding.companyName,
                              price: holding.currentPrice,
                              change: 0,
                              changePercent: 0,
                              previousClose: holding.avgPrice,
                              open: holding.currentPrice,
                              high: holding.currentPrice,
                              low: holding.currentPrice,
                              volume: 0,
                              marketCap: 0,
                              exchange: "NASDAQ"
                            }, "sell")}
                            data-testid={`sell-${holding.symbol}`}
                          >
                            Sell
                          </Button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-blue-200 dark:border-blue-800">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Scale className="h-5 w-5 text-blue-600" />
                        <CardTitle>AI Portfolio Rebalancing</CardTitle>
                      </div>
                      {canUseAi && (
                        <Button variant="ghost" size="sm" onClick={() => refetchRebalancing()} data-testid="refresh-rebalancing">
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    <CardDescription>AI-powered suggestions to optimize your portfolio allocation</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {!canUseAi ? (
                      <div className="text-center py-6" data-testid="ai-disabled-notice">
                        <Scale className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-50" />
                        <p className="font-medium text-muted-foreground mb-2">AI Recommendations Unavailable</p>
                        <p className="text-sm text-muted-foreground max-w-md mx-auto mb-4">
                          {feeMode === 'PLATFORM_ONLY' 
                            ? "You are using Platform-Only mode which does not include AI-powered recommendations. To access AI insights, switch to Advisory + Platform mode."
                            : requiresModeSelection
                              ? "Please select your fee mode to access AI-powered recommendations."
                              : "AI recommendations are not available for your current subscription."
                          }
                        </p>
                        <Badge variant="secondary">Platform Only Mode</Badge>
                      </div>
                    ) : isLoadingRebalancing ? (
                      <div className="space-y-3">
                        <Skeleton className="h-16" />
                        <Skeleton className="h-24" />
                      </div>
                    ) : rebalancing?.analysis ? (
                      <div className="space-y-4">
                        <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                          <p className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-1">Analysis</p>
                          <p className="text-sm text-blue-700 dark:text-blue-300">{rebalancing.analysis.rationale}</p>
                        </div>
                        
                        {rebalancing.analysis.suggestedTrades.length > 0 ? (
                          <>
                            <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-lg">
                              <div className="flex items-center gap-2 mb-1">
                                <Target className="h-4 w-4 text-green-600" />
                                <p className="text-sm font-medium text-green-800 dark:text-green-200">Expected Impact</p>
                              </div>
                              <p className="text-sm text-green-700 dark:text-green-300">{rebalancing.analysis.expectedImpact}</p>
                            </div>
                            
                            <div className="space-y-2">
                              <p className="text-sm font-medium">Suggested Trades</p>
                              {rebalancing.analysis.suggestedTrades.map((trade, idx) => (
                                <div 
                                  key={idx} 
                                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
                                  data-testid={`rebalance-trade-${trade.symbol}`}
                                >
                                  <div className="flex items-center gap-3">
                                    <Badge variant={trade.side === "buy" ? "default" : "secondary"}>
                                      {(trade.side || 'buy').toUpperCase()}
                                    </Badge>
                                    <div>
                                      <p className="font-medium">{trade.symbol}</p>
                                      <p className="text-xs text-muted-foreground">{trade.name}</p>
                                    </div>
                                  </div>
                                  <div className="text-center">
                                    <p className="font-medium">{trade.quantity} shares</p>
                                    <p className="text-xs text-muted-foreground">₹{(trade.estimatedValue / 100000).toFixed(2)}L</p>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Badge 
                                      variant="outline" 
                                      className={trade.priority === 'high' ? 'border-red-300 dark:border-red-700 text-red-600' : trade.priority === 'medium' ? 'border-yellow-300 dark:border-yellow-700 text-yellow-600' : 'border-border'}
                                    >
                                      {trade.priority}
                                    </Badge>
                                    <Button 
                                      size="sm" 
                                      onClick={() => {
                                        const stockData: StockQuote = {
                                          symbol: trade.symbol,
                                          name: trade.name,
                                          price: trade.estimatedValue / trade.quantity / exchangeRate,
                                          change: 0,
                                          changePercent: 0,
                                          previousClose: 0,
                                          open: 0,
                                          high: 0,
                                          low: 0,
                                          volume: 0,
                                          marketCap: 0,
                                          exchange: "NASDAQ"
                                        };
                                        handleTrade(stockData, trade.side);
                                      }}
                                      data-testid={`execute-rebalance-${trade.symbol}`}
                                    >
                                      Execute <ChevronRight className="h-4 w-4 ml-1" />
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </>
                        ) : (
                          <div className="text-center py-4 text-muted-foreground">
                            <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
                            <p>Your portfolio is well-balanced. No rebalancing needed.</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-6 text-muted-foreground">
                        <Scale className="h-10 w-10 mx-auto mb-2 opacity-50" />
                        <p>Complete your risk profile to get personalized rebalancing suggestions</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card>
                <CardContent className="p-12 text-center">
                  <LineChart className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-xl font-semibold mb-2">No US Holdings Yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Start investing in US equities to build your global portfolio.
                  </p>
                  <Button onClick={() => setActiveTab("discover")}>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Discover Stocks
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="orders" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Order History</CardTitle>
                <CardDescription>Your recent US equity orders</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingOrders ? (
                  <div className="space-y-2">
                    {Array(3).fill(0).map((_, i) => (
                      <Skeleton key={i} className="h-16" />
                    ))}
                  </div>
                ) : isOrdersError ? (
                  <div className="text-center py-8">
                    <AlertTriangle className="h-10 w-10 mx-auto text-red-500 mb-3" />
                    <p className="text-muted-foreground mb-4">Could not load orders</p>
                    <Button variant="outline" size="sm" onClick={() => refetchOrders()}>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Retry
                    </Button>
                  </div>
                ) : orders?.orders?.length ? (
                  <div className="space-y-2">
                    {orders.orders.map((order) => (
                      <div 
                        key={order.id}
                        className="flex items-center justify-between p-4 rounded-lg border"
                        data-testid={`order-${order.id}`}
                      >
                        <div className="flex items-center gap-3">
                          <Badge variant={order.side === "buy" ? "default" : "secondary"}>
                            {(order.side || 'buy').toUpperCase()}
                          </Badge>
                          <div>
                            <p className="font-medium">{order.symbol}</p>
                            <p className="text-sm text-muted-foreground">
                              {order.quantity} shares @ ${order.price}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge 
                            variant={
                              order.status === "filled" ? "default" : 
                              order.status === "pending" ? "outline" : 
                              "destructive"
                            }
                          >
                            {order.status}
                          </Badge>
                          <p className="text-sm text-muted-foreground mt-1">
                            {new Date(order.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No orders yet</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="account" className="space-y-4">
            <AlpacaAccountDashboard />
          </TabsContent>
        </Tabs>

        <Dialog open={tradeModalOpen} onOpenChange={setTradeModalOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {orderType === "buy" ? (
                  <ArrowUpRight className="h-5 w-5 text-green-600" />
                ) : (
                  <ArrowDownRight className="h-5 w-5 text-red-600" />
                )}
                {orderType === "buy" ? "Buy" : "Sell"} {selectedStock?.symbol}
              </DialogTitle>
              <DialogDescription>
                {selectedStock?.name} - Current Price: ${selectedStock?.price?.toFixed(2)}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                <div>
                  <p className="text-sm text-muted-foreground">Price (USD)</p>
                  <p className="text-xl font-bold">${selectedStock?.price?.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Price (INR)</p>
                  <p className="text-xl font-bold">
                    ₹{((selectedStock?.price || 0) * exchangeRate).toFixed(2)}
                  </p>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Quantity</label>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={() => setQuantity(String(Math.max(0, (parseInt(quantity) || 0) - 1)))}
                    data-testid="decrease-quantity"
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <Input
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder="Enter quantity"
                    className="text-center"
                    min="1"
                    data-testid="quantity-input"
                  />
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={() => setQuantity(String((parseInt(quantity) || 0) + 1))}
                    data-testid="increase-quantity"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {quantity && selectedStock && (
                <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                  <div className="flex justify-between mb-2">
                    <span>Estimated Total (USD)</span>
                    <span className="font-bold">
                      ${(parseInt(quantity) * selectedStock.price).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Estimated Total (INR)</span>
                    <span className="font-bold">
                      ₹{(parseInt(quantity) * selectedStock.price * exchangeRate).toFixed(2)}
                    </span>
                  </div>
                </div>
              )}

              <Alert className="border-orange-200 bg-orange-50 dark:bg-orange-950/30">
                <AlertTriangle className="h-4 w-4 text-orange-600" />
                <AlertTitle className="text-orange-800 dark:text-orange-200">Important Disclosures</AlertTitle>
                <AlertDescription className="text-orange-700 dark:text-orange-300 text-sm">
                  US equity trading is subject to FEMA regulations. This investment counts towards your LRS annual limit of $250,000.
                </AlertDescription>
              </Alert>

              <div className="space-y-3">
                <div className="flex items-start gap-2">
                  <Checkbox 
                    id="consent" 
                    checked={consentChecked}
                    onCheckedChange={(checked) => setConsentChecked(checked as boolean)}
                    data-testid="consent-checkbox"
                  />
                  <label htmlFor="consent" className="text-sm leading-tight cursor-pointer">
                    I understand and accept the risks associated with US equity trading, including currency fluctuation and regulatory risks.
                  </label>
                </div>
                <div className="flex items-start gap-2">
                  <Checkbox 
                    id="lrs" 
                    checked={lrsDeclaration}
                    onCheckedChange={(checked) => setLrsDeclaration(checked as boolean)}
                    data-testid="lrs-checkbox"
                  />
                  <label htmlFor="lrs" className="text-sm leading-tight cursor-pointer">
                    I declare this transaction is within my LRS limit and complies with FEMA regulations for Indian residents.
                  </label>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setTradeModalOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handlePlaceOrder}
                disabled={!consentChecked || !lrsDeclaration || !quantity || placeOrderMutation.isPending}
                className={orderType === "buy" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}
                data-testid="place-order-button"
              >
                {placeOrderMutation.isPending ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : null}
                {orderType === "buy" ? "Place Buy Order" : "Place Sell Order"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
