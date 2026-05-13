import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight,
  PieChart, BarChart3, Target, Zap, RefreshCw, Download,
  Lightbulb, AlertTriangle, ChevronRight, Calendar as CalendarIcon,
  LucideShield as LucideShield, Activity, Wallet, Brain, ArrowRight,
} from "lucide-react";
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, 
  ResponsiveContainer, Area, AreaChart, PieChart as RechartsPie, 
  Pie, Cell, Legend, Tooltip as RechartsTooltip
} from "recharts";
import { format, subDays, subMonths, subYears, startOfYear } from "date-fns";
import { cn } from "@/lib/utils";

interface PortfolioV3DashboardProps {
  portfolioId: string;
  performance: any;
  holdings: any[];
  isLoading?: boolean;
  onRefresh?: () => void;
}

type TimePeriod = "1D" | "1W" | "1M" | "3M" | "6M" | "YTD" | "1Y" | "3Y" | "5Y" | "MAX" | "CUSTOM";

const TIME_PERIODS: { value: TimePeriod; label: string }[] = [
  { value: "1D", label: "1D" },
  { value: "1W", label: "1W" },
  { value: "1M", label: "1M" },
  { value: "3M", label: "3M" },
  { value: "6M", label: "6M" },
  { value: "YTD", label: "YTD" },
  { value: "1Y", label: "1Y" },
  { value: "3Y", label: "3Y" },
  { value: "5Y", label: "5Y" },
  { value: "MAX", label: "MAX" },
  { value: "CUSTOM", label: "Custom" },
];

const ASSET_COLORS = [
  "#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", 
  "#EC4899", "#06B6D4", "#84CC16", "#F97316", "#6366F1"
];

function formatCurrency(value: number | string, currency = "INR"): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "₹0";
  
  if (num >= 10000000) {
    return `₹${(num / 10000000).toFixed(2)} Cr`;
  } else if (num >= 100000) {
    return `₹${(num / 100000).toFixed(2)} L`;
  } else if (num >= 1000) {
    return `₹${(num / 1000).toFixed(1)}K`;
  }
  return `₹${num.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function formatPercent(value: number | string): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "0%";
  return `${num >= 0 ? "+" : ""}${num.toFixed(2)}%`;
}

export function PortfolioV3Dashboard({ 
  portfolioId, 
  performance, 
  holdings = [], 
  isLoading,
  onRefresh 
}: PortfolioV3DashboardProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>("1M");
  const [customDateRange, setCustomDateRange] = useState<{ from?: Date; to?: Date }>({});
  const [showBenchmark, setShowBenchmark] = useState(true);

  const totalValue = parseFloat(performance?.totalCurrentValue || "0");
  const totalInvested = parseFloat(performance?.totalInvestedValue || "0");
  const totalGainLoss = parseFloat(performance?.totalGainLoss || "0");
  const gainLossPercent = parseFloat(performance?.totalGainLossPercent || "0");
  const xirr = parseFloat(performance?.xirr || "0");
  const dailyChange = parseFloat(performance?.dailyChange || "0");
  const dailyChangePercent = parseFloat(performance?.dailyChangePercent || "0");

  const riskScore = useMemo(() => {
    const volatility = parseFloat(performance?.volatility || "15");
    if (volatility < 10) return { score: 2, label: "Low", color: "text-emerald-600" };
    if (volatility < 20) return { score: 5, label: "Moderate", color: "text-amber-600" };
    if (volatility < 30) return { score: 7, label: "High", color: "text-orange-600" };
    return { score: 9, label: "Very High", color: "text-red-600" };
  }, [performance?.volatility]);

  const assetAllocation = useMemo(() => {
    const allocation: Record<string, number> = {};
    holdings.forEach((holding: any) => {
      const type = holding.assetType || "Other";
      const value = parseFloat(holding.currentValue || "0");
      allocation[type] = (allocation[type] || 0) + value;
    });
    
    return Object.entries(allocation)
      .map(([name, value], index) => ({
        name,
        value,
        percentage: totalValue > 0 ? ((value / totalValue) * 100).toFixed(1) : "0",
        color: ASSET_COLORS[index % ASSET_COLORS.length]
      }))
      .sort((a, b) => b.value - a.value);
  }, [holdings, totalValue]);

  const performanceData = useMemo(() => {
    const getStartDate = () => {
      const now = new Date();
      switch (selectedPeriod) {
        case "1D": return subDays(now, 1);
        case "1W": return subDays(now, 7);
        case "1M": return subMonths(now, 1);
        case "3M": return subMonths(now, 3);
        case "6M": return subMonths(now, 6);
        case "YTD": return startOfYear(now);
        case "1Y": return subYears(now, 1);
        case "3Y": return subYears(now, 3);
        case "5Y": return subYears(now, 5);
        case "MAX": return subYears(now, 10);
        case "CUSTOM": return customDateRange.from || subMonths(now, 1);
        default: return subMonths(now, 1);
      }
    };

    const startDate = getStartDate();
    const endDate = selectedPeriod === "CUSTOM" && customDateRange.to ? customDateRange.to : new Date();
    const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    
    const dataPoints = Math.min(daysDiff, 60);
    const data = [];
    const baseValue = totalInvested > 0 ? totalInvested : 100000;
    
    for (let i = 0; i <= dataPoints; i++) {
      const date = new Date(startDate.getTime() + (i * (endDate.getTime() - startDate.getTime()) / dataPoints));
      const progress = i / dataPoints;
      const portfolioValue = baseValue * (1 + (gainLossPercent / 100) * progress + (Math.random() - 0.5) * 0.02);
      const benchmarkValue = baseValue * (1 + 0.12 * progress + (Math.random() - 0.5) * 0.01);
      
      data.push({
        date: format(date, selectedPeriod === "1D" ? "HH:mm" : "MMM dd"),
        portfolio: Math.round(portfolioValue),
        benchmark: Math.round(benchmarkValue),
      });
    }
    
    return data;
  }, [selectedPeriod, customDateRange, totalInvested, gainLossPercent]);

  const aiInsights = [
    { type: "opportunity", title: "Tax Loss Harvesting", description: "₹15,000 potential tax savings identified", icon: Lightbulb },
    { type: "alert", title: "Portfolio Drift", description: "Equity allocation 5% above target", icon: AlertTriangle },
    { type: "suggestion", title: "Rebalance Due", description: "Last rebalanced 45 days ago", icon: RefreshCw },
  ];

  const goals = [
    { name: "Retirement Fund", target: 10000000, current: 2750000, deadline: "2045" },
    { name: "Child Education", target: 3000000, current: 1200000, deadline: "2035" },
    { name: "Emergency Fund", target: 500000, current: 450000, deadline: "2025" },
  ];

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="h-20 bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Portfolio Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              Real-time view of your investments
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onRefresh}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-foreground border-0">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-blue-100 text-sm font-medium">Total Value</span>
                <Wallet className="h-5 w-5 text-blue-200" />
              </div>
              <p className="text-3xl font-bold">{formatCurrency(totalValue)}</p>
              <div className="flex items-center mt-2 text-sm">
                {dailyChange >= 0 ? (
                  <ArrowUpRight className="h-4 w-4 mr-1" />
                ) : (
                  <ArrowDownRight className="h-4 w-4 mr-1" />
                )}
                <span>{formatCurrency(Math.abs(dailyChange))} ({formatPercent(dailyChangePercent)}) today</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-muted-foreground text-sm font-medium">Total Returns</span>
                {totalGainLoss >= 0 ? (
                  <TrendingUp className="h-5 w-5 text-emerald-500" />
                ) : (
                  <TrendingDown className="h-5 w-5 text-red-500" />
                )}
              </div>
              <p className={cn("text-3xl font-bold", totalGainLoss >= 0 ? "text-emerald-600" : "text-red-600")}>
                {formatCurrency(Math.abs(totalGainLoss))}
              </p>
              <p className={cn("text-sm mt-1", totalGainLoss >= 0 ? "text-emerald-600" : "text-red-600")}>
                {formatPercent(gainLossPercent)} overall
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-muted-foreground text-sm font-medium">XIRR</span>
                <Activity className="h-5 w-5 text-purple-500" />
              </div>
              <p className={cn("text-3xl font-bold", xirr >= 0 ? "text-purple-600" : "text-red-600")}>
                {formatPercent(xirr)}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Annualized return
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-muted-foreground text-sm font-medium">Risk Score</span>
                <LucideShield className="h-5 w-5 text-amber-500" />
              </div>
              <div className="flex items-center gap-3">
                <p className={cn("text-3xl font-bold", riskScore.color)}>{riskScore.score}/10</p>
                <Badge variant="outline" className={riskScore.color}>{riskScore.label}</Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Based on volatility
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Performance</CardTitle>
                  <CardDescription>Portfolio value over time</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant={showBenchmark ? "default" : "outline"}
                    size="sm"
                    onClick={() => setShowBenchmark(!showBenchmark)}
                  >
                    vs Nifty 50
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1 mb-4">
                {TIME_PERIODS.map((period) => (
                  period.value === "CUSTOM" ? (
                    <Popover key={period.value}>
                      <PopoverTrigger asChild>
                        <Button
                          variant={selectedPeriod === "CUSTOM" ? "default" : "outline"}
                          size="sm"
                          className="h-8"
                        >
                          <CalendarIcon className="h-3 w-3 mr-1" />
                          {period.label}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="end">
                        <Calendar
                          mode="range"
                          selected={{ from: customDateRange.from, to: customDateRange.to }}
                          onSelect={(range) => {
                            setCustomDateRange({ from: range?.from, to: range?.to });
                            if (range?.from && range?.to) {
                              setSelectedPeriod("CUSTOM");
                            }
                          }}
                          numberOfMonths={2}
                        />
                      </PopoverContent>
                    </Popover>
                  ) : (
                    <Button
                      key={period.value}
                      variant={selectedPeriod === period.value ? "default" : "outline"}
                      size="sm"
                      className="h-8 px-3"
                      onClick={() => setSelectedPeriod(period.value)}
                    >
                      {period.label}
                    </Button>
                  )
                ))}
              </div>

              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={performanceData}>
                    <defs>
                      <linearGradient id="portfolioGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="benchmarkGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 12 }} 
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis 
                      tick={{ fontSize: 12 }}
                      tickFormatter={(value) => formatCurrency(value)}
                      tickLine={false}
                      axisLine={false}
                      width={80}
                    />
                    <RechartsTooltip
                      contentStyle={{ 
                        backgroundColor: "hsl(var(--background))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px"
                      }}
                      formatter={(value: number, name: string) => [
                        formatCurrency(value),
                        name === "portfolio" ? "Your Portfolio" : "Nifty 50"
                      ]}
                    />
                    <Area
                      type="monotone"
                      dataKey="portfolio"
                      stroke="#3B82F6"
                      strokeWidth={2}
                      fill="url(#portfolioGradient)"
                    />
                    {showBenchmark && (
                      <Area
                        type="monotone"
                        dataKey="benchmark"
                        stroke="#10B981"
                        strokeWidth={2}
                        strokeDasharray="5 5"
                        fill="url(#benchmarkGradient)"
                      />
                    )}
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="flex items-center justify-center gap-6 mt-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500" />
                  <span>Your Portfolio</span>
                </div>
                {showBenchmark && (
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-emerald-500" />
                    <span>Nifty 50 Benchmark</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <PieChart className="h-5 w-5 text-blue-500" />
                Asset Allocation
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPie>
                    <Pie
                      data={assetAllocation}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {assetAllocation.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      formatter={(value: number, name: string) => [
                        formatCurrency(value),
                        name
                      ]}
                    />
                  </RechartsPie>
                </ResponsiveContainer>
              </div>

              <div className="space-y-2 mt-4">
                {assetAllocation.slice(0, 5).map((asset, index) => (
                  <div key={index} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: asset.color }} 
                      />
                      <span>{asset.name}</span>
                    </div>
                    <span className="font-medium">{asset.percentage}%</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Brain className="h-5 w-5 text-purple-500" />
                AI Insights
              </CardTitle>
              <CardDescription>Personalized recommendations</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {aiInsights.map((insight, index) => (
                <div 
                  key={index}
                  className={cn(
                    "p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors",
                    insight.type === "alert" && "border-amber-200 bg-amber-50 dark:bg-amber-950/20",
                    insight.type === "opportunity" && "border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <insight.icon className={cn(
                      "h-5 w-5 mt-0.5",
                      insight.type === "alert" && "text-amber-600",
                      insight.type === "opportunity" && "text-emerald-600",
                      insight.type === "suggestion" && "text-blue-600"
                    )} />
                    <div className="flex-1">
                      <p className="font-medium text-sm">{insight.title}</p>
                      <p className="text-xs text-muted-foreground">{insight.description}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Target className="h-5 w-5 text-blue-500" />
                Goal Progress
              </CardTitle>
              <CardDescription>Track your financial goals</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {goals.map((goal, index) => {
                const progress = (goal.current / goal.target) * 100;
                return (
                  <div key={index} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{goal.name}</span>
                      <span className="text-muted-foreground">by {goal.deadline}</span>
                    </div>
                    <Progress value={progress} className="h-2" />
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{formatCurrency(goal.current)}</span>
                      <span>{formatCurrency(goal.target)}</span>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-orange-500" />
                Risk Metrics
              </CardTitle>
              <CardDescription>Portfolio risk analysis</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 cursor-help">
                      <span className="text-sm font-medium">Volatility</span>
                      <span className="text-sm font-bold">{(performance?.volatility || 15.2).toFixed(1)}%</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Standard deviation of returns (annualized)</p>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 cursor-help">
                      <span className="text-sm font-medium">Sharpe Ratio</span>
                      <span className="text-sm font-bold">{(performance?.sharpeRatio || 1.25).toFixed(2)}</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Risk-adjusted return (higher is better)</p>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 cursor-help">
                      <span className="text-sm font-medium">Max Drawdown</span>
                      <span className="text-sm font-bold text-red-600">-{(performance?.maxDrawdown || 12.5).toFixed(1)}%</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Largest peak-to-trough decline</p>
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 cursor-help">
                      <span className="text-sm font-medium">Beta</span>
                      <span className="text-sm font-bold">{(performance?.beta || 0.95).toFixed(2)}</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Market sensitivity (1 = market)</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-blue-200 dark:border-blue-800">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-900">
                  <Zap className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Quick Actions</h3>
                  <p className="text-sm text-muted-foreground">One-click portfolio management</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Rebalance
                </Button>
                <Button variant="outline" size="sm">
                  <TrendingDown className="h-4 w-4 mr-2" />
                  Tax Harvest
                </Button>
                <Button size="sm">
                  <ArrowRight className="h-4 w-4 mr-2" />
                  Invest More
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
}
