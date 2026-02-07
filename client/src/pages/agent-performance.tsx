import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Trophy, 
  TrendingUp, 
  TrendingDown, 
  Users, 
  Target,
  Award,
  Star,
  ArrowUp,
  ArrowDown,
  Minus,
  BarChart3,
  PieChart,
  Calendar,
  IndianRupee
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "wouter";

interface PerformanceMetric {
  name: string;
  value: number;
  target: number;
  unit: string;
  trend: 'up' | 'down' | 'stable';
  trendValue: number;
}

interface PeerComparison {
  rank: number;
  totalAgents: number;
  percentile: number;
  category: 'top' | 'above_avg' | 'average' | 'below_avg';
}

interface LeaderboardEntry {
  rank: number;
  name: string;
  aum: number;
  clients: number;
  conversions: number;
  isCurrentUser: boolean;
}

interface PerformanceData {
  metrics: PerformanceMetric[];
  peerComparison: PeerComparison;
  leaderboard: LeaderboardEntry[];
}

export default function AgentPerformance() {
  const { user, isAuthenticated } = useAuth();
  const [timePeriod, setTimePeriod] = useState('month');

  const { data: performanceData, isLoading } = useQuery<PerformanceData>({
    queryKey: [`/api/agent/performance?period=${timePeriod}`],
    enabled: isAuthenticated
  });

  const metrics = performanceData?.metrics || [];
  const peerComparison = performanceData?.peerComparison;
  const leaderboard = performanceData?.leaderboard || [];

  const formatCurrency = (value: number) => {
    if (value >= 10000000) return `${(value / 10000000).toFixed(1)}Cr`;
    if (value >= 100000) return `${(value / 100000).toFixed(1)}L`;
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
    return value.toString();
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'top': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'above_avg': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'average': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      default: return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up': return <ArrowUp className="h-4 w-4 text-green-600 dark:text-green-400" />;
      case 'down': return <ArrowDown className="h-4 w-4 text-red-600 dark:text-red-400" />;
      default: return <Minus className="h-4 w-4 text-muted-foreground" />;
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="max-w-2xl mx-auto py-12">
        <Card className="text-center">
          <CardContent className="pt-6">
            <Trophy className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Agent Login Required</h2>
            <p className="text-muted-foreground mb-4">Please log in to view performance metrics.</p>
            <Link href="/auth">
              <Button data-testid="perf-login-btn">Login to Continue</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container py-8 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 w-full" />)}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="container py-8 space-y-6" data-testid="agent-performance-page">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Trophy className="h-8 w-8 text-yellow-500" />
            Performance Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">
            Track your progress and compare with peers
          </p>
        </div>
        <Select value={timePeriod} onValueChange={setTimePeriod}>
          <SelectTrigger className="w-[180px]" data-testid="time-period-select">
            <Calendar className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Select period" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="week">This Week</SelectItem>
            <SelectItem value="month">This Month</SelectItem>
            <SelectItem value="quarter">This Quarter</SelectItem>
            <SelectItem value="year">This Year</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {peerComparison ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-950 dark:to-orange-950">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-4 bg-yellow-100 dark:bg-yellow-900 rounded-full">
                  <Trophy className="h-8 w-8 text-yellow-600 dark:text-yellow-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Your Rank</p>
                  <p className="text-3xl font-bold">#{peerComparison.rank}</p>
                  <p className="text-sm text-muted-foreground">of {peerComparison.totalAgents} agents</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-4 bg-blue-100 dark:bg-blue-900 rounded-full">
                  <BarChart3 className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Percentile</p>
                  <p className="text-3xl font-bold">Top {100 - peerComparison.percentile}%</p>
                  <Badge className={getCategoryColor(peerComparison.category)}>
                    {peerComparison.category === 'top' ? 'Top Performer' : 
                     peerComparison.category === 'above_avg' ? 'Above Average' :
                     peerComparison.category === 'average' ? 'Average' : 'Below Average'}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-4 bg-green-100 dark:bg-green-900 rounded-full">
                  <IndianRupee className="h-8 w-8 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total AUM</p>
                  <p className="text-3xl font-bold">{metrics.length > 0 ? formatCurrency(metrics[0].value) : '₹0'}</p>
                  {metrics.length > 0 && metrics[0].trendValue !== 0 && (
                    <p className={`text-sm flex items-center gap-1 ${metrics[0].trend === 'up' ? 'text-green-600' : 'text-red-600'}`}>
                      {metrics[0].trend === 'up' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                      {metrics[0].trendValue > 0 ? '+' : ''}{metrics[0].trendValue}% from last period
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <Trophy className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Performance Data Yet</h3>
            <p className="text-muted-foreground">Start closing deals to track your performance!</p>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="metrics" className="space-y-6">
        <TabsList>
          <TabsTrigger value="metrics" data-testid="metrics-tab">
            <Target className="h-4 w-4 mr-2" />
            Metrics
          </TabsTrigger>
          <TabsTrigger value="leaderboard" data-testid="leaderboard-tab">
            <Trophy className="h-4 w-4 mr-2" />
            Leaderboard
          </TabsTrigger>
        </TabsList>

        <TabsContent value="metrics" className="space-y-4">
          {metrics.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Target className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Metrics Data</h3>
                <p className="text-muted-foreground">Performance metrics will appear here once you start working.</p>
              </CardContent>
            </Card>
          ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {metrics.map((metric, idx) => (
              <Card key={idx} data-testid={`metric-card-${idx}`}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-medium">{metric.name}</p>
                    <div className="flex items-center gap-1">
                      {getTrendIcon(metric.trend)}
                      <span className={`text-sm ${
                        metric.trend === 'up' ? 'text-green-600' : 
                        metric.trend === 'down' ? 'text-red-600' : 'text-muted-foreground'
                      }`}>
                        {metric.trendValue > 0 ? '+' : ''}{metric.trendValue}%
                      </span>
                    </div>
                  </div>
                  <div className="flex items-baseline gap-2 mb-2">
                    <span className="text-2xl font-bold">
                      {metric.unit === 'INR' ? formatCurrency(metric.value) : metric.value}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      / {metric.unit === 'INR' ? formatCurrency(metric.target) : metric.target} {metric.unit !== 'INR' ? metric.unit : ''}
                    </span>
                  </div>
                  <Progress 
                    value={Math.min((metric.value / metric.target) * 100, 100)} 
                    className="h-2"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {((metric.value / metric.target) * 100).toFixed(0)}% of target
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
          )}
        </TabsContent>

        <TabsContent value="leaderboard" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-yellow-500" />
                Top Performers
              </CardTitle>
              <CardDescription>Regional leaderboard for {timePeriod === 'month' ? 'this month' : timePeriod}</CardDescription>
            </CardHeader>
            <CardContent>
              {leaderboard.length === 0 ? (
                <div className="text-center py-8">
                  <Trophy className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">No leaderboard data available yet.</p>
                </div>
              ) : (
              <div className="space-y-3">
                {leaderboard.map((entry) => (
                  <div 
                    key={entry.rank}
                    className={`flex items-center justify-between p-4 rounded-lg ${
                      entry.isCurrentUser 
                        ? 'bg-blue-50 dark:bg-blue-950 border-2 border-blue-300' 
                        : 'bg-muted'
                    }`}
                    data-testid={`leaderboard-entry-${entry.rank}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                        entry.rank === 1 ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                        entry.rank === 2 ? 'bg-muted text-foreground' :
                        entry.rank === 3 ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' :
                        'bg-muted text-muted-foreground'
                      }`}>
                        {entry.rank <= 3 ? (
                          <Trophy className={`h-5 w-5 ${
                            entry.rank === 1 ? 'text-yellow-600 dark:text-yellow-400' :
                            entry.rank === 2 ? 'text-muted-foreground' :
                            'text-orange-600 dark:text-orange-400'
                          }`} />
                        ) : (
                          `#${entry.rank}`
                        )}
                      </div>
                      <div>
                        <p className="font-semibold">{entry.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {entry.clients} clients | {entry.conversions}% conversion
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-green-600">{formatCurrency(entry.aum)}</p>
                      <p className="text-xs text-muted-foreground">AUM</p>
                    </div>
                  </div>
                ))}
              </div>
              )}
            </CardContent>
          </Card>

          {leaderboard.length >= 3 && metrics.length > 0 && (
            <Card>
              <CardContent className="pt-6 text-center">
                <Award className="h-12 w-12 text-yellow-500 mx-auto mb-3" />
                <h3 className="text-lg font-semibold mb-2">Improve Your Ranking</h3>
                <p className="text-muted-foreground mb-4">
                  You need {formatCurrency(Math.max(0, leaderboard[2].aum - metrics[0].value))} more AUM to reach Top 3
                </p>
                <Button data-testid="view-insights-btn">
                  <Star className="h-4 w-4 mr-2" />
                  View Insights
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
