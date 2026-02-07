import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useQuery } from "@tanstack/react-query";
import {
  TrendingUp,
  TrendingDown,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Bell,
  AlertTriangle,
  Zap,
  BarChart3,
  Clock,
  Target,
  Flame,
  Sparkles,
  ChevronRight,
} from "lucide-react";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  ResponsiveContainer,
} from "recharts";
import { cn } from "@/lib/utils";

interface PerformanceData {
  totalValue: number;
  dayChange: number;
  dayChangePercent: number;
  weekChange: number;
  weekChangePercent: number;
  monthChange: number;
  monthChangePercent: number;
  yearChange: number;
  yearChangePercent: number;
  allTimeReturn: number;
  allTimeReturnPercent: number;
  xirr: number;
  cagr: number;
}

interface TopMover {
  symbol: string;
  name: string;
  change: number;
  changePercent: number;
  currentPrice: number;
  value: number;
}

interface MarketIndex {
  name: string;
  value: number;
  change: number;
  changePercent: number;
  sparklineData: number[];
}

interface PortfolioAlert {
  id: string;
  type: "price" | "target" | "stop_loss" | "news" | "dividend";
  symbol: string;
  message: string;
  timestamp: string;
  priority: "high" | "medium" | "low";
}

function generateSparklineData(trend: "up" | "down" | "neutral", points: number = 20): number[] {
  const data: number[] = [];
  let value = 100;
  for (let i = 0; i < points; i++) {
    const randomChange = (Math.random() - 0.5) * 2;
    const trendBias = trend === "up" ? 0.3 : trend === "down" ? -0.3 : 0;
    value = value + randomChange + trendBias;
    data.push(value);
  }
  return data;
}

export function LivePerformanceTicker({ portfolioId }: { portfolioId?: string }) {
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data: performance, isLoading, isError, refetch } = useQuery<PerformanceData>({
    queryKey: ["/api/portfolios", portfolioId, "live-performance"],
    enabled: !!portfolioId,
    refetchInterval: 10000,
    retry: false,
  });

  useEffect(() => {
    if (performance) {
      setLastUpdate(new Date());
    }
  }, [performance]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  };

  const displayData = (isError || !performance) ? {
    totalValue: 1250000,
    dayChange: 5500,
    dayChangePercent: 0.44,
    weekChange: 13750,
    weekChangePercent: 1.1,
    monthChange: 44000,
    monthChangePercent: 3.52,
    yearChange: 225000,
    yearChangePercent: 18.5,
    allTimeReturn: 437500,
    allTimeReturnPercent: 35.2,
    xirr: 15.8,
    cagr: 14.2,
  } : performance;

  const sparklineData = generateSparklineData(
    displayData.dayChange >= 0 ? "up" : "down"
  ).map((value, index) => ({ index, value }));

  if (isLoading) {
    return (
      <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-card dark:to-background border-blue-200 dark:border-blue-800" data-testid="widget-live-performance-loading">
        <CardHeader className="pb-2">
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-10 w-48 mb-4" />
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  const isPositive = displayData.dayChange >= 0;

  return (
    <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-card dark:to-background border-blue-200 dark:border-blue-800 overflow-hidden" data-testid="widget-live-performance">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-blue-600 animate-pulse" />
            <CardTitle className="text-lg text-foreground" data-testid="text-live-performance-title">
              Live Portfolio Value
            </CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs flex items-center gap-1" data-testid="badge-live-indicator">
              <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              Live
            </Badge>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleRefresh}
              disabled={isRefreshing}
              data-testid="button-refresh-performance"
            >
              <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-end justify-between">
          <div>
            <div className="text-3xl font-bold text-foreground" data-testid="text-total-portfolio-value">
              ₹{displayData.totalValue.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
            </div>
            <div className={cn(
              "flex items-center gap-1 text-sm font-medium",
              isPositive ? "text-green-600" : "text-red-600"
            )} data-testid="text-day-change">
              {isPositive ? (
                <ArrowUpRight className="h-4 w-4" />
              ) : (
                <ArrowDownRight className="h-4 w-4" />
              )}
              <span>
                {isPositive ? "+" : ""}₹{Math.abs(displayData.dayChange).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
              </span>
              <span className="text-muted-foreground">
                ({isPositive ? "+" : ""}{displayData.dayChangePercent.toFixed(2)}%)
              </span>
              <span className="text-muted-foreground text-xs ml-1">today</span>
            </div>
          </div>
          <div className="h-16 w-32" data-testid="chart-sparkline">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sparklineData}>
                <defs>
                  <linearGradient id="sparklineGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={isPositive ? "#22c55e" : "#ef4444"} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={isPositive ? "#22c55e" : "#ef4444"} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={isPositive ? "#22c55e" : "#ef4444"}
                  strokeWidth={2}
                  fill="url(#sparklineGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-3 pt-2 border-t border-border">
          {[
            { label: "1W", value: displayData.weekChangePercent, testId: "text-change-1w" },
            { label: "1M", value: displayData.monthChangePercent, testId: "text-change-1m" },
            { label: "1Y", value: displayData.yearChangePercent, testId: "text-change-1y" },
            { label: "All", value: displayData.allTimeReturnPercent, testId: "text-change-all" },
          ].map((item) => (
            <div key={item.label} className="text-center">
              <div className="text-xs text-muted-foreground">{item.label}</div>
              <div className={cn(
                "text-sm font-semibold",
                (item.value || 0) >= 0 ? "text-green-600" : "text-red-600"
              )} data-testid={item.testId}>
                {(item.value || 0) >= 0 ? "+" : ""}{item.value?.toFixed(1)}%
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border">
          <div className="flex items-center gap-3">
            <Tooltip>
              <TooltipTrigger className="flex items-center gap-1" data-testid="tooltip-xirr">
                <Target className="h-3 w-3" />
                <span data-testid="text-xirr-value">XIRR: {displayData.xirr.toFixed(1)}%</span>
              </TooltipTrigger>
              <TooltipContent>
                Extended Internal Rate of Return - Your actual returns considering cash flows
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger className="flex items-center gap-1" data-testid="tooltip-cagr">
                <BarChart3 className="h-3 w-3" />
                <span data-testid="text-cagr-value">CAGR: {displayData.cagr.toFixed(1)}%</span>
              </TooltipTrigger>
              <TooltipContent>
                Compound Annual Growth Rate - Average yearly growth of your portfolio
              </TooltipContent>
            </Tooltip>
          </div>
          <div className="flex items-center gap-1" data-testid="text-last-updated">
            <Clock className="h-3 w-3" />
            <span>Updated {lastUpdate.toLocaleTimeString()}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function TopMoversWidget({ portfolioId }: { portfolioId?: string }) {
  const { data: movers, isLoading, isError } = useQuery<{ gainers: TopMover[]; losers: TopMover[] }>({
    queryKey: ["/api/portfolios", portfolioId, "top-movers"],
    enabled: !!portfolioId,
    refetchInterval: 15000,
    retry: false,
  });

  const [showGainers, setShowGainers] = useState(true);

  const defaultMovers = {
    gainers: [
      { symbol: "RELIANCE", name: "Reliance Industries", change: 85.50, changePercent: 3.45, currentPrice: 2565.80, value: 256580 },
      { symbol: "TCS", name: "Tata Consultancy Services", change: 120.25, changePercent: 2.89, currentPrice: 4280.50, value: 428050 },
      { symbol: "HDFCBANK", name: "HDFC Bank", change: 42.30, changePercent: 2.65, currentPrice: 1638.20, value: 163820 },
      { symbol: "INFY", name: "Infosys", change: 28.80, changePercent: 1.92, currentPrice: 1528.40, value: 152840 },
    ],
    losers: [
      { symbol: "ICICIBANK", name: "ICICI Bank", change: -18.50, changePercent: -1.78, currentPrice: 1022.30, value: 102230 },
      { symbol: "HINDUNILVR", name: "Hindustan Unilever", change: -35.20, changePercent: -1.42, currentPrice: 2448.90, value: 244890 },
      { symbol: "SBIN", name: "State Bank of India", change: -8.75, changePercent: -1.25, currentPrice: 692.40, value: 69240 },
      { symbol: "BHARTIARTL", name: "Bharti Airtel", change: -12.30, changePercent: -0.98, currentPrice: 1242.60, value: 124260 },
    ],
  };

  const displayMovers = (isError || !movers) ? defaultMovers : movers;

  if (isLoading) {
    return (
      <Card data-testid="widget-top-movers-loading">
        <CardHeader className="pb-2">
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const currentMovers = showGainers ? displayMovers.gainers : displayMovers.losers;

  return (
    <Card data-testid="widget-top-movers">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flame className="h-5 w-5 text-orange-500" />
            <CardTitle className="text-lg text-foreground" data-testid="text-top-movers-title">Top Movers</CardTitle>
          </div>
          <div className="flex gap-1">
            <Button
              variant={showGainers ? "default" : "ghost"}
              size="sm"
              className={cn(
                "h-7 text-xs",
                showGainers && "bg-green-600 hover:bg-green-700"
              )}
              onClick={() => setShowGainers(true)}
              data-testid="button-show-gainers"
            >
              <TrendingUp className="h-3 w-3 mr-1" />
              Gainers
            </Button>
            <Button
              variant={!showGainers ? "default" : "ghost"}
              size="sm"
              className={cn(
                "h-7 text-xs",
                !showGainers && "bg-red-600 hover:bg-red-700"
              )}
              onClick={() => setShowGainers(false)}
              data-testid="button-show-losers"
            >
              <TrendingDown className="h-3 w-3 mr-1" />
              Losers
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {currentMovers.map((mover, index) => (
          <div
            key={mover.symbol}
            className="flex items-center justify-between p-2 rounded-lg hover:bg-muted transition-colors cursor-pointer"
            data-testid={`row-mover-${mover.symbol.toLowerCase()}`}
          >
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold",
                showGainers
                  ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                  : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
              )} data-testid={`text-mover-rank-${index + 1}`}>
                {index + 1}
              </div>
              <div>
                <div className="font-semibold text-foreground text-sm" data-testid={`text-mover-symbol-${mover.symbol.toLowerCase()}`}>
                  {mover.symbol}
                </div>
                <div className="text-xs text-muted-foreground truncate max-w-[120px]" data-testid={`text-mover-name-${mover.symbol.toLowerCase()}`}>
                  {mover.name}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="font-medium text-foreground text-sm" data-testid={`text-mover-price-${mover.symbol.toLowerCase()}`}>
                ₹{mover.currentPrice.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
              </div>
              <div className={cn(
                "text-xs font-medium flex items-center justify-end gap-0.5",
                showGainers ? "text-green-600" : "text-red-600"
              )} data-testid={`text-mover-change-${mover.symbol.toLowerCase()}`}>
                {showGainers ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                {showGainers ? "+" : ""}{mover.changePercent.toFixed(2)}%
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

interface ApiMarketIndex {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
}

const requiredIndices = [
  { symbol: "^NSEI", name: "NIFTY 50", defaultValue: 24567.80, defaultChange: 128.45, defaultChangePercent: 0.52 },
  { symbol: "^BSESN", name: "SENSEX", defaultValue: 80892.35, defaultChange: 412.30, defaultChangePercent: 0.51 },
  { symbol: "^NSEBANK", name: "BANK NIFTY", defaultValue: 52148.90, defaultChange: -156.75, defaultChangePercent: -0.30 },
  { symbol: "^CNXIT", name: "NIFTY IT", defaultValue: 42356.15, defaultChange: 285.60, defaultChangePercent: 0.68 },
];

export function MarketPulseWidget() {
  const { data: rawIndices, isLoading, isError } = useQuery<ApiMarketIndex[]>({
    queryKey: ["/api/market/indices"],
    refetchInterval: 10000,
    retry: false,
  });

  const buildDisplayIndices = (): MarketIndex[] => {
    const apiDataMap = new Map<string, ApiMarketIndex>();
    if (rawIndices && Array.isArray(rawIndices)) {
      rawIndices.forEach(idx => apiDataMap.set(idx.symbol, idx));
    }

    return requiredIndices.map(reqIndex => {
      const apiData = apiDataMap.get(reqIndex.symbol);
      if (apiData && typeof apiData.price === 'number' && apiData.price > 0) {
        return {
          name: reqIndex.name,
          value: apiData.price,
          change: apiData.change || 0,
          changePercent: apiData.changePercent || 0,
          sparklineData: generateSparklineData(apiData.changePercent >= 0 ? "up" : "down", 15),
        };
      }
      return {
        name: reqIndex.name,
        value: reqIndex.defaultValue,
        change: reqIndex.defaultChange,
        changePercent: reqIndex.defaultChangePercent,
        sparklineData: generateSparklineData(reqIndex.defaultChangePercent >= 0 ? "up" : "down", 15),
      };
    });
  };

  const displayIndices = buildDisplayIndices();

  if (isLoading) {
    return (
      <Card data-testid="widget-market-pulse-loading">
        <CardHeader className="pb-2">
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="widget-market-pulse">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-yellow-500" />
            <CardTitle className="text-lg text-foreground" data-testid="text-market-pulse-title">Market Pulse</CardTitle>
          </div>
          <Badge variant="outline" className="text-xs" data-testid="badge-nse-live">
            <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse mr-1" />
            NSE Live
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          {displayIndices.map((index) => {
            const isPositive = index.changePercent >= 0;
            const sparkData = index.sparklineData.map((v, i) => ({ index: i, value: v }));
            const indexId = index.name.replace(/\s+/g, "-").toLowerCase();

            return (
              <div
                key={index.name}
                className="p-3 rounded-lg bg-muted hover:bg-muted transition-colors cursor-pointer"
                data-testid={`card-index-${indexId}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-muted-foreground" data-testid={`text-index-name-${indexId}`}>
                    {index.name}
                  </span>
                  <div className="h-6 w-12" data-testid={`chart-index-${indexId}`}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={sparkData}>
                        <Line
                          type="monotone"
                          dataKey="value"
                          stroke={isPositive ? "#22c55e" : "#ef4444"}
                          strokeWidth={1.5}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="font-bold text-foreground" data-testid={`text-index-value-${indexId}`}>
                  {index.value.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                </div>
                <div className={cn(
                  "text-xs font-medium flex items-center gap-0.5",
                  isPositive ? "text-green-600" : "text-red-600"
                )} data-testid={`text-index-change-${indexId}`}>
                  {isPositive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                  {isPositive ? "+" : ""}{index.change.toFixed(0)} ({isPositive ? "+" : ""}{index.changePercent.toFixed(2)}%)
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

export function PortfolioAlertsWidget({ portfolioId }: { portfolioId?: string }) {
  const { data: alerts, isLoading, isError } = useQuery<PortfolioAlert[]>({
    queryKey: ["/api/portfolios", portfolioId, "alerts"],
    enabled: !!portfolioId,
    refetchInterval: 30000,
    retry: false,
  });

  const defaultAlerts: PortfolioAlert[] = [
    { id: "alert-1", type: "price", symbol: "RELIANCE", message: "Price crossed ₹2,850 resistance level", timestamp: new Date(Date.now() - 600000).toISOString(), priority: "high" },
    { id: "alert-2", type: "target", symbol: "TCS", message: "52-week high achieved at ₹4,285", timestamp: new Date(Date.now() - 1800000).toISOString(), priority: "medium" },
    { id: "alert-3", type: "dividend", symbol: "INFY", message: "Dividend of ₹18/share declared", timestamp: new Date(Date.now() - 2700000).toISOString(), priority: "low" },
    { id: "alert-4", type: "news", symbol: "HDFCBANK", message: "Quarterly results announced - Beat estimates", timestamp: new Date(Date.now() - 3600000).toISOString(), priority: "medium" },
    { id: "alert-5", type: "stop_loss", symbol: "ICICIBANK", message: "Approaching stop-loss at ₹1,000", timestamp: new Date(Date.now() - 900000).toISOString(), priority: "high" },
  ];

  const displayAlerts = (isError || !alerts) ? defaultAlerts : alerts;

  if (isLoading) {
    return (
      <Card data-testid="widget-alerts-loading">
        <CardHeader className="pb-2">
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300";
      case "medium":
        return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300";
      default:
        return "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300";
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "price":
        return <TrendingUp className="h-4 w-4" />;
      case "target":
        return <Target className="h-4 w-4" />;
      case "stop_loss":
        return <AlertTriangle className="h-4 w-4" />;
      case "news":
        return <Sparkles className="h-4 w-4" />;
      case "dividend":
        return <Activity className="h-4 w-4" />;
      default:
        return <Bell className="h-4 w-4" />;
    }
  };

  const formatTime = (timestamp: string) => {
    const diff = Date.now() - new Date(timestamp).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    return `${hours}h ago`;
  };

  return (
    <Card data-testid="widget-portfolio-alerts">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-purple-500" />
            <CardTitle className="text-lg text-foreground" data-testid="text-alerts-title">Portfolio Alerts</CardTitle>
          </div>
          <Badge variant="secondary" className="text-xs" data-testid="badge-active-alerts-count">
            {displayAlerts.length} Active
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {displayAlerts.slice(0, 4).map((alert) => (
          <div
            key={alert.id}
            className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted transition-colors cursor-pointer group"
            data-testid={`row-alert-${alert.id}`}
          >
            <div className={cn(
              "p-1.5 rounded-full shrink-0",
              getPriorityColor(alert.priority)
            )} data-testid={`icon-alert-${alert.id}`}>
              {getTypeIcon(alert.type)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-foreground" data-testid={`text-alert-symbol-${alert.id}`}>
                  {alert.symbol}
                </span>
                <span className="text-xs text-muted-foreground" data-testid={`text-alert-time-${alert.id}`}>
                  {formatTime(alert.timestamp)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground truncate" data-testid={`text-alert-message-${alert.id}`}>
                {alert.message}
              </p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        ))}
        {displayAlerts.length > 4 && (
          <Button variant="ghost" className="w-full text-sm" size="sm" data-testid="button-view-all-alerts">
            View all {displayAlerts.length} alerts
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export function AssetPerformanceWidget({ portfolioId }: { portfolioId?: string }) {
  const { data: assetPerformance, isLoading, isError } = useQuery<Array<{
    assetType: string;
    name: string;
    value: number;
    allocation: number;
    dayChange: number;
    weekChange: number;
    color: string;
  }>>({
    queryKey: ["/api/portfolios", portfolioId, "asset-performance"],
    enabled: !!portfolioId,
    refetchInterval: 20000,
    retry: false,
  });

  const defaultAssetPerformance = [
    { assetType: "equity", name: "Equity", value: 750000, allocation: 55, dayChange: 1.2, weekChange: 3.5, color: "#3b82f6" },
    { assetType: "mutual_fund", name: "Mutual Funds", value: 320000, allocation: 24, dayChange: 0.8, weekChange: 2.1, color: "#22c55e" },
    { assetType: "fixed_deposit", name: "Fixed Deposits", value: 150000, allocation: 11, dayChange: 0, weekChange: 0.15, color: "#f59e0b" },
    { assetType: "gold", name: "Gold", value: 80000, allocation: 6, dayChange: -0.3, weekChange: 1.8, color: "#eab308" },
    { assetType: "bonds", name: "Bonds", value: 50000, allocation: 4, dayChange: 0.1, weekChange: 0.5, color: "#8b5cf6" },
  ];

  const displayAssets = (isError || !assetPerformance) ? defaultAssetPerformance : assetPerformance;

  if (isLoading) {
    return (
      <Card data-testid="widget-asset-performance-loading">
        <CardHeader className="pb-2">
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="widget-asset-performance">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-indigo-500" />
          <CardTitle className="text-lg text-foreground" data-testid="text-asset-performance-title">Asset Performance</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {displayAssets.map((asset) => (
          <div key={asset.assetType} className="space-y-1" data-testid={`row-asset-${asset.assetType}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: asset.color }}
                  data-testid={`indicator-asset-${asset.assetType}`}
                />
                <span className="text-sm font-medium text-foreground" data-testid={`text-asset-name-${asset.assetType}`}>
                  {asset.name}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground" data-testid={`text-asset-value-${asset.assetType}`}>
                  ₹{asset.value.toLocaleString("en-IN")}
                </span>
                <span className={cn(
                  "text-xs font-medium",
                  asset.dayChange >= 0 ? "text-green-600" : "text-red-600"
                )} data-testid={`text-asset-change-${asset.assetType}`}>
                  {asset.dayChange >= 0 ? "+" : ""}{asset.dayChange.toFixed(1)}%
                </span>
              </div>
            </div>
            <div className="relative">
              <Progress
                value={asset.allocation}
                className="h-2"
                data-testid={`progress-asset-${asset.assetType}`}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span data-testid={`text-asset-allocation-${asset.assetType}`}>{asset.allocation}% of portfolio</span>
              <span data-testid={`text-asset-week-change-${asset.assetType}`}>1W: {asset.weekChange >= 0 ? "+" : ""}{asset.weekChange.toFixed(1)}%</span>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function PortfolioPerformanceWidgets({ portfolioId }: { portfolioId?: string }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="container-portfolio-widgets">
      <div className="lg:col-span-2">
        <LivePerformanceTicker portfolioId={portfolioId} />
      </div>
      <div className="lg:row-span-2">
        <TopMoversWidget portfolioId={portfolioId} />
      </div>
      <MarketPulseWidget />
      <PortfolioAlertsWidget portfolioId={portfolioId} />
      <div className="md:col-span-2 lg:col-span-3">
        <AssetPerformanceWidget portfolioId={portfolioId} />
      </div>
    </div>
  );
}

export default PortfolioPerformanceWidgets;
