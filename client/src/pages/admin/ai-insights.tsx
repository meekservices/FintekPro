import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Brain,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Target,
  LucideShield as LucideShield,
  Search,
  Download,
  RefreshCw,
  Activity,
  BarChart3,
  Zap,
  AlertCircle,
  Eye,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  Sparkles,
  PieChart,
  LineChart as LineChartIcon,
  Loader2
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from "recharts";

interface PlatformInsight {
  id: string;
  category: 'market_trends' | 'risk_alerts' | 'opportunity' | 'anomaly';
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  timestamp: string;
  impact: string;
  affectedCount: number;
  reasoning: string;
}

interface AgentRecommendation {
  id: number;
  agentName: string;
  recommendedAction: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  impactScore: number;
  category: string;
  deadline?: string;
}

interface TrendChartData {
  date: string;
  riskScore: number;
  alerts: number;
  opportunities: number;
  anomalies: number;
}

const CATEGORY_CONFIG = {
  market_trends: { label: 'Market Trends', icon: TrendingUp, color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  risk_alerts: { label: 'Risk Alert', icon: AlertTriangle, color: 'bg-red-500/20 text-red-400 border-red-500/30' },
  opportunity: { label: 'Opportunity', icon: Target, color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  anomaly: { label: 'Anomaly', icon: Activity, color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' }
};

const SEVERITY_CONFIG = {
  critical: { label: 'Critical', color: 'bg-red-600 text-white', pulse: true },
  high: { label: 'High', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
  medium: { label: 'Medium', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  low: { label: 'Low', color: 'bg-muted/20 text-muted-foreground border-border' }
};

const PRIORITY_CONFIG = {
  critical: { label: 'Critical', color: 'bg-red-600 text-white' },
  high: { label: 'High', color: 'bg-orange-500/20 text-orange-400' },
  medium: { label: 'Medium', color: 'bg-blue-500/20 text-blue-400' },
  low: { label: 'Low', color: 'bg-muted/20 text-muted-foreground' }
};

export default function AdminAIInsights() {
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [timeRange, setTimeRange] = useState("24h");
  const [searchTerm, setSearchTerm] = useState("");

  const { data: platformInsightsData, isLoading: insightsLoading } = useQuery<PlatformInsight[]>({
    queryKey: [`/api/admin/ai-insights/platform?timeRange=${timeRange}`]
  });

  const { data: agentRecommendationsData, isLoading: recommendationsLoading } = useQuery<AgentRecommendation[]>({
    queryKey: ['/api/admin/ai-insights/recommendations']
  });

  const { data: trendChartData, isLoading: trendsLoading } = useQuery<TrendChartData[]>({
    queryKey: [`/api/admin/ai-insights/trends?timeRange=${timeRange}`]
  });

  const isLoading = insightsLoading || recommendationsLoading || trendsLoading;

  const platformInsights = platformInsightsData || [];
  const agentRecommendations = agentRecommendationsData || [];
  const trendData = trendChartData || [];

  const activeAlerts = platformInsights.filter(i => i.category === 'risk_alerts').length;
  const riskScore = platformInsights.length > 0 
    ? Math.round(platformInsights.filter(i => i.severity === 'critical' || i.severity === 'high').length / platformInsights.length * 100)
    : 0;
  const trendSignals = platformInsights.filter(i => i.category === 'market_trends').length;
  const anomaliesDetected = platformInsights.filter(i => i.category === 'anomaly').length;

  const filteredInsights = platformInsights.filter(insight => {
    const matchesCategory = categoryFilter === "all" || insight.category === categoryFilter;
    const matchesPriority = priorityFilter === "all" || insight.severity === priorityFilter;
    const matchesSearch = insight.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         insight.description.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesPriority && matchesSearch;
  });

  const filteredRecommendations = agentRecommendations.filter(rec => {
    const matchesPriority = priorityFilter === "all" || rec.priority === priorityFilter;
    const matchesSearch = rec.agentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         rec.recommendedAction.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesPriority && matchesSearch;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
        <span className="ml-2 text-muted-foreground">Loading AI insights...</span>
      </div>
    );
  }

  if (platformInsights.length === 0 && agentRecommendations.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
          <Brain className="h-16 w-16 text-muted-foreground/50 mb-4" />
          <h3 className="text-xl font-semibold text-foreground mb-2">No AI Insights Available</h3>
          <p className="text-muted-foreground max-w-md">
            AI platform insights, risk alerts, and recommendations will appear here once the system has analyzed platform data.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3" data-testid="text-page-title">
            <div className="p-2 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg">
              <Brain className="h-6 w-6 text-foreground" />
            </div>
            AI Platform Insights
          </h1>
          <p className="text-muted-foreground mt-1">AI-powered platform trends, risk alerts, and actionable recommendations</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="border-border text-muted-foreground hover:bg-muted" data-testid="button-refresh">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button className="bg-emerald-600 hover:bg-emerald-700" data-testid="button-export">
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-card border-border border-l-4 border-l-red-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Alerts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground" data-testid="text-active-alerts">{activeAlerts}</div>
            <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
              <ArrowUpRight className="h-3 w-3" />
              +3 from yesterday
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border border-l-4 border-l-orange-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Risk Score</CardTitle>
            <LucideShield className="h-4 w-4 text-orange-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground" data-testid="text-risk-score">{riskScore}/100</div>
            <p className="text-xs text-orange-400 mt-1 flex items-center gap-1">
              <ArrowUpRight className="h-3 w-3" />
              Elevated - Monitor closely
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Trend Signals</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground" data-testid="text-trend-signals">{trendSignals}</div>
            <p className="text-xs text-blue-400 mt-1 flex items-center gap-1">
              <Sparkles className="h-3 w-3" />
              2 actionable today
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border border-l-4 border-l-purple-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Anomalies Detected</CardTitle>
            <Activity className="h-4 w-4 text-purple-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground" data-testid="text-anomalies">{anomaliesDetected}</div>
            <p className="text-xs text-purple-400 mt-1 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              1 requires review
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search insights..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-muted border-border text-foreground w-64"
            data-testid="input-search"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-40 bg-muted border-border text-foreground" data-testid="select-category">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent className="bg-muted border-border">
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="market_trends">Market Trends</SelectItem>
            <SelectItem value="risk_alerts">Risk Alerts</SelectItem>
            <SelectItem value="opportunity">Opportunities</SelectItem>
            <SelectItem value="anomaly">Anomalies</SelectItem>
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-36 bg-muted border-border text-foreground" data-testid="select-priority">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent className="bg-muted border-border">
            <SelectItem value="all">All Priorities</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-36 bg-muted border-border text-foreground" data-testid="select-time-range">
            <SelectValue placeholder="Time Range" />
          </SelectTrigger>
          <SelectContent className="bg-muted border-border">
            <SelectItem value="1h">Last Hour</SelectItem>
            <SelectItem value="24h">Last 24 Hours</SelectItem>
            <SelectItem value="7d">Last 7 Days</SelectItem>
            <SelectItem value="30d">Last 30 Days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <LineChartIcon className="h-5 w-5 text-emerald-400" />
            AI Insights Trend
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Platform-wide metrics and signal trends over time
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRisk" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorAlerts" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorOpportunities" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorAnomalies" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="date" stroke="#9ca3af" />
                <YAxis stroke="#9ca3af" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                  labelStyle={{ color: '#fff' }}
                />
                <Legend />
                <Area type="monotone" dataKey="riskScore" name="Risk Score" stroke="#ef4444" fillOpacity={1} fill="url(#colorRisk)" />
                <Area type="monotone" dataKey="alerts" name="Alerts" stroke="#f97316" fillOpacity={1} fill="url(#colorAlerts)" />
                <Area type="monotone" dataKey="opportunities" name="Opportunities" stroke="#10b981" fillOpacity={1} fill="url(#colorOpportunities)" />
                <Area type="monotone" dataKey="anomalies" name="Anomalies" stroke="#8b5cf6" fillOpacity={1} fill="url(#colorAnomalies)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {Object.entries(CATEGORY_CONFIG).map(([category, config]) => {
          const categoryInsights = filteredInsights.filter(i => i.category === category);
          const Icon = config.icon;
          
          return (
            <Card key={category} className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-foreground flex items-center gap-2">
                  <div className={`p-2 rounded-lg ${config.color}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  {config.label}
                  <Badge className="ml-auto bg-muted text-muted-foreground">{categoryInsights.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {categoryInsights.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">No insights in this category</p>
                ) : (
                  categoryInsights.slice(0, 3).map((insight) => {
                    const severityConfig = SEVERITY_CONFIG[insight.severity];
                    return (
                      <div
                        key={insight.id}
                        className={`p-4 bg-muted/50 rounded-lg border ${insight.severity === 'critical' ? 'border-red-500/50' : 'border-border'} hover:border-emerald-500/30 transition-colors`}
                        data-testid={`insight-${insight.id}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="text-foreground font-medium text-sm">{insight.title}</h4>
                              <Badge className={severityConfig.color}>{severityConfig.label}</Badge>
                            </div>
                            <p className="text-muted-foreground text-xs mt-1">{insight.description}</p>
                            <div className="flex items-center gap-3 mt-2 text-xs">
                              <span className="text-muted-foreground flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {insight.timestamp}
                              </span>
                              <span className="text-emerald-400">{insight.affectedCount} affected</span>
                            </div>
                            <div className="mt-2 p-2 bg-card/50 rounded-md">
                              <div className="flex items-start gap-2">
                                <Sparkles className="h-3 w-3 text-emerald-400 mt-0.5 flex-shrink-0" />
                                <p className="text-muted-foreground text-xs">{insight.reasoning}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-3">
                          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 h-7 text-xs">
                            <Eye className="h-3 w-3 mr-1" />
                            Review
                          </Button>
                          <Button size="sm" variant="outline" className="border-border text-muted-foreground h-7 text-xs">
                            <Zap className="h-3 w-3 mr-1" />
                            Take Action
                          </Button>
                        </div>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <CardTitle className="text-foreground flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-emerald-400" />
                Agent-Specific AI Recommendations
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                Personalized next-best-actions for each agent based on their client portfolio
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-border bg-muted/50">
                  <TableHead className="text-muted-foreground">Agent Name</TableHead>
                  <TableHead className="text-muted-foreground">Recommended Action</TableHead>
                  <TableHead className="text-muted-foreground text-center">Priority</TableHead>
                  <TableHead className="text-muted-foreground text-center">Impact Score</TableHead>
                  <TableHead className="text-muted-foreground">Category</TableHead>
                  <TableHead className="text-muted-foreground">Deadline</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRecommendations.map((rec) => {
                  const priorityConfig = PRIORITY_CONFIG[rec.priority];
                  return (
                    <TableRow
                      key={rec.id}
                      className="border-border hover:bg-muted/50"
                      data-testid={`row-recommendation-${rec.id}`}
                    >
                      <TableCell className="font-medium text-foreground">{rec.agentName}</TableCell>
                      <TableCell className="text-muted-foreground max-w-xs">
                        <p className="truncate">{rec.recommendedAction}</p>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className={priorityConfig.color}>{priorityConfig.label}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={`font-bold ${
                          rec.impactScore >= 80 ? "text-green-400" :
                          rec.impactScore >= 60 ? "text-yellow-400" : "text-muted-foreground"
                        }`}>
                          {rec.impactScore}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="border-border text-muted-foreground">
                          {rec.category}
                        </Badge>
                      </TableCell>
                      <TableCell className={`${
                        rec.deadline === 'Immediate' || rec.deadline === 'Today' 
                          ? 'text-red-400' 
                          : 'text-muted-foreground'
                      }`}>
                        {rec.deadline || '-'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          {filteredRecommendations.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No recommendations found matching the current filters.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
