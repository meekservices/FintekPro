import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
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
} from "lucide-react";

interface DailyPick {
  id: number;
  category: string;
  instrumentName: string;
  symbol?: string;
  isin?: string;
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

export default function AgentPicksPage() {
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: todayData, isLoading: loadingToday } = useQuery<{ success: boolean; picks: DailyPick[] }>({
    queryKey: ["/api/picks/today"],
  });

  const { data: historyData, isLoading: loadingHistory } = useQuery<{ success: boolean; picks: DailyPick[] }>({
    queryKey: ["/api/picks/history", categoryFilter],
  });

  const { data: statsData, isLoading: loadingStats } = useQuery<{ success: boolean; stats: PickStats }>({
    queryKey: ["/api/picks/stats"],
  });

  const todayPicks = todayData?.picks || [];
  const historyPicks = historyData?.picks || [];
  const stats = statsData?.stats;

  const filteredHistory = historyPicks.filter((pick) => {
    if (categoryFilter !== "all" && pick.category !== categoryFilter) return false;
    if (statusFilter !== "all" && pick.status !== statusFilter) return false;
    return true;
  });

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
              {loadingToday ? (
                <div className="space-y-4">
                  {[1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} className="h-32" />
                  ))}
                </div>
              ) : todayPicks.length === 0 ? (
                <div className="text-center py-12">
                  <Sparkles className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <h3 className="text-lg font-medium mb-2">No Picks Yet Today</h3>
                  <p className="text-muted-foreground">
                    Picks are generated automatically each morning based on market analysis
                  </p>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {todayPicks.map((pick) => (
                    <PickCard key={pick.id} pick={pick} />
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
              {loadingHistory ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-32" />
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  {historyPicks
                    .filter((p) => p.status === "live")
                    .map((pick) => (
                      <PickCard key={pick.id} pick={pick} showDetails />
                    ))}
                  {historyPicks.filter((p) => p.status === "live").length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      No live recommendations at the moment
                    </div>
                  )}
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
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="w-[160px]">
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {Object.entries(categoryLabels).map(([key, label]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                  {filteredHistory.map((pick) => (
                    <PickCard key={pick.id} pick={pick} showDetails compact />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PickCard({ pick, showDetails = false, compact = false }: { pick: DailyPick; showDetails?: boolean; compact?: boolean }) {
  const Icon = categoryIcons[pick.category] || TrendingUp;
  const status = statusConfig[pick.status] || statusConfig.live;
  const StatusIcon = status.icon;
  
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
          <div className="flex items-center gap-2">
            <span className="font-medium truncate">{pick.instrumentName}</span>
            <Badge variant="outline" className="text-[10px]">
              {categoryLabels[pick.category]}
            </Badge>
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
                {pick.symbol && (
                  <span className="text-sm text-muted-foreground">{pick.symbol}</span>
                )}
              </div>
              <Badge className={`${status.color} text-white`}>
                <StatusIcon className="h-3 w-3 mr-1" />
                {status.label}
              </Badge>
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

            <div className="flex items-center gap-2 mt-3">
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

            <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {new Date(pick.recoDate).toLocaleDateString('en-IN')}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Valid till {new Date(pick.expiryDate).toLocaleDateString('en-IN')}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
