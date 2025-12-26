import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

const mockMetrics: PerformanceMetric[] = [
  { name: 'AUM Generated', value: 2500000, target: 3000000, unit: 'INR', trend: 'up', trendValue: 12 },
  { name: 'New Clients', value: 18, target: 25, unit: 'clients', trend: 'up', trendValue: 3 },
  { name: 'Conversion Rate', value: 42, target: 50, unit: '%', trend: 'down', trendValue: 2 },
  { name: 'KYC Completions', value: 22, target: 20, unit: 'KYCs', trend: 'up', trendValue: 5 },
  { name: 'Revenue Generated', value: 85000, target: 100000, unit: 'INR', trend: 'stable', trendValue: 0 },
  { name: 'Client Retention', value: 94, target: 90, unit: '%', trend: 'up', trendValue: 2 },
];

const mockPeerComparison: PeerComparison = {
  rank: 12,
  totalAgents: 48,
  percentile: 75,
  category: 'above_avg'
};

const mockLeaderboard: LeaderboardEntry[] = [
  { rank: 1, name: 'Vikram Singh', aum: 8500000, clients: 45, conversions: 62, isCurrentUser: false },
  { rank: 2, name: 'Priya Menon', aum: 7200000, clients: 38, conversions: 58, isCurrentUser: false },
  { rank: 3, name: 'Rahul Sharma', aum: 6800000, clients: 35, conversions: 55, isCurrentUser: false },
  { rank: 12, name: 'You', aum: 2500000, clients: 18, conversions: 42, isCurrentUser: true },
];

export default function AgentPerformance() {
  const { user, isAuthenticated } = useAuth();
  const [timePeriod, setTimePeriod] = useState('month');

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
      case 'up': return <ArrowUp className="h-4 w-4 text-green-600" />;
      case 'down': return <ArrowDown className="h-4 w-4 text-red-600" />;
      default: return <Minus className="h-4 w-4 text-gray-600" />;
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-950 dark:to-orange-950">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-4 bg-yellow-100 dark:bg-yellow-900 rounded-full">
                <Trophy className="h-8 w-8 text-yellow-600 dark:text-yellow-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Your Rank</p>
                <p className="text-3xl font-bold">#{mockPeerComparison.rank}</p>
                <p className="text-sm text-muted-foreground">of {mockPeerComparison.totalAgents} agents</p>
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
                <p className="text-3xl font-bold">Top {100 - mockPeerComparison.percentile}%</p>
                <Badge className={getCategoryColor(mockPeerComparison.category)}>
                  Above Average
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
                <p className="text-3xl font-bold">{formatCurrency(mockMetrics[0].value)}</p>
                <p className="text-sm text-green-600 flex items-center gap-1">
                  <ArrowUp className="h-3 w-3" />
                  +12% from last month
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {mockMetrics.map((metric, idx) => (
              <Card key={idx} data-testid={`metric-card-${idx}`}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-medium">{metric.name}</p>
                    <div className="flex items-center gap-1">
                      {getTrendIcon(metric.trend)}
                      <span className={`text-sm ${
                        metric.trend === 'up' ? 'text-green-600' : 
                        metric.trend === 'down' ? 'text-red-600' : 'text-gray-600'
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
              <div className="space-y-3">
                {mockLeaderboard.map((entry) => (
                  <div 
                    key={entry.rank}
                    className={`flex items-center justify-between p-4 rounded-lg ${
                      entry.isCurrentUser 
                        ? 'bg-blue-50 dark:bg-blue-950 border-2 border-blue-300' 
                        : 'bg-gray-50 dark:bg-gray-800'
                    }`}
                    data-testid={`leaderboard-entry-${entry.rank}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                        entry.rank === 1 ? 'bg-yellow-100 text-yellow-800' :
                        entry.rank === 2 ? 'bg-gray-100 text-gray-800' :
                        entry.rank === 3 ? 'bg-orange-100 text-orange-800' :
                        'bg-gray-50 text-gray-600'
                      }`}>
                        {entry.rank <= 3 ? (
                          <Trophy className={`h-5 w-5 ${
                            entry.rank === 1 ? 'text-yellow-600' :
                            entry.rank === 2 ? 'text-gray-500' :
                            'text-orange-600'
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
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6 text-center">
              <Award className="h-12 w-12 text-yellow-500 mx-auto mb-3" />
              <h3 className="text-lg font-semibold mb-2">Improve Your Ranking</h3>
              <p className="text-muted-foreground mb-4">
                You need {formatCurrency(mockLeaderboard[2].aum - mockMetrics[0].value)} more AUM to reach Top 3
              </p>
              <Button data-testid="view-insights-btn">
                <Star className="h-4 w-4 mr-2" />
                View Insights
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
