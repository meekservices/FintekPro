import { useState } from "react";
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
  Shield,
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
  LineChart as LineChartIcon
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

const platformInsights: PlatformInsight[] = [
  {
    id: '1',
    category: 'market_trends',
    title: 'Bullish Sentiment in IT Sector',
    description: 'AI detects strong buying momentum in IT stocks with 73% positive sentiment across social signals.',
    severity: 'medium',
    timestamp: '2 hours ago',
    impact: 'Potential sector rotation opportunity',
    affectedCount: 156,
    reasoning: 'NLP analysis of 50K+ social mentions shows 73% bullish sentiment. Volume patterns confirm institutional accumulation.'
  },
  {
    id: '2',
    category: 'risk_alerts',
    title: 'High Portfolio Concentration - Banking',
    description: '34 portfolios show >40% allocation to banking sector, exceeding recommended limits.',
    severity: 'high',
    timestamp: '1 hour ago',
    impact: 'Sector-specific risk exposure',
    affectedCount: 34,
    reasoning: 'Concentration risk identified. Banking sector represents systemic risk; diversification recommended for affected clients.'
  },
  {
    id: '3',
    category: 'risk_alerts',
    title: 'Market Volatility Alert',
    description: 'VIX equivalent shows 28% increase. Elevated volatility expected in next 5 trading days.',
    severity: 'critical',
    timestamp: '30 mins ago',
    impact: 'Increased portfolio fluctuations',
    affectedCount: 892,
    reasoning: 'Historical patterns at current VIX levels show 2.3x normal intraday swings. Consider hedging strategies.'
  },
  {
    id: '4',
    category: 'opportunity',
    title: 'Underperforming Portfolios Detected',
    description: '18 portfolios underperforming benchmark by >5% - rebalancing opportunity.',
    severity: 'medium',
    timestamp: '3 hours ago',
    impact: 'Revenue opportunity: ₹4.2L potential',
    affectedCount: 18,
    reasoning: 'Portfolios showing drift from optimal allocation. Proactive outreach could convert to rebalancing revenue.'
  },
  {
    id: '5',
    category: 'opportunity',
    title: 'NPS Upsell Opportunity',
    description: '67 HNI clients in 30%+ tax bracket without NPS investment.',
    severity: 'low',
    timestamp: '4 hours ago',
    impact: 'Tax savings: ₹33.5L potential',
    affectedCount: 67,
    reasoning: 'Clients can benefit from additional ₹50K deduction under 80CCD(1B). Commission opportunity: ₹2.1L.'
  },
  {
    id: '6',
    category: 'anomaly',
    title: 'Unusual Trading Pattern Detected',
    description: 'Client ID 4521 shows 15x normal trading volume in small-cap stocks.',
    severity: 'high',
    timestamp: '45 mins ago',
    impact: 'Potential compliance concern',
    affectedCount: 1,
    reasoning: 'Pattern may indicate speculative behavior or front-running. Recommend compliance review.'
  },
  {
    id: '7',
    category: 'anomaly',
    title: 'KYC Expiry Cluster',
    description: '23 client KYCs expiring within 7 days - unusual concentration.',
    severity: 'medium',
    timestamp: '1 hour ago',
    impact: 'Service disruption risk',
    affectedCount: 23,
    reasoning: 'Batch of onboardings from same period. Proactive renewal campaign recommended.'
  },
  {
    id: '8',
    category: 'market_trends',
    title: 'FII Outflow Pattern',
    description: 'FII selling detected in 8 consecutive sessions - ₹12,450 Cr net outflow.',
    severity: 'high',
    timestamp: '2 hours ago',
    impact: 'Market pressure expected',
    affectedCount: 445,
    reasoning: 'Historical correlation suggests 3-5% index correction when FII outflow exceeds ₹10K Cr in 10 days.'
  }
];

const agentRecommendations: AgentRecommendation[] = [
  { id: 1, agentName: 'Rajesh Kumar', recommendedAction: 'Review 5 concentrated portfolios - banking sector risk', priority: 'high', impactScore: 85, category: 'Risk Management', deadline: 'Today' },
  { id: 2, agentName: 'Priya Sharma', recommendedAction: 'Initiate NPS upsell campaign for 12 eligible HNIs', priority: 'medium', impactScore: 72, category: 'Revenue Growth' },
  { id: 3, agentName: 'Amit Patel', recommendedAction: 'Schedule rebalancing calls for 8 underperforming portfolios', priority: 'high', impactScore: 78, category: 'Client Retention', deadline: '3 days' },
  { id: 4, agentName: 'Sneha Reddy', recommendedAction: 'Follow up on pending KYC renewals (4 clients)', priority: 'critical', impactScore: 92, category: 'Compliance', deadline: 'Today' },
  { id: 5, agentName: 'Vikram Singh', recommendedAction: 'Review unusual trading activity for Client #4521', priority: 'critical', impactScore: 95, category: 'Compliance', deadline: 'Immediate' },
  { id: 6, agentName: 'Anita Desai', recommendedAction: 'Present hedging strategies to 15 high-volatility clients', priority: 'medium', impactScore: 68, category: 'Risk Management' },
  { id: 7, agentName: 'Kiran Mehta', recommendedAction: 'Convert 6 pending proposals to orders', priority: 'medium', impactScore: 65, category: 'Revenue Growth', deadline: 'This week' },
  { id: 8, agentName: 'Suresh Nair', recommendedAction: 'Re-engage 3 dormant HNI clients with market update', priority: 'low', impactScore: 55, category: 'Client Retention' },
];

const trendChartData = [
  { date: 'Dec 1', riskScore: 45, alerts: 12, opportunities: 8, anomalies: 3 },
  { date: 'Dec 5', riskScore: 52, alerts: 18, opportunities: 12, anomalies: 5 },
  { date: 'Dec 10', riskScore: 48, alerts: 15, opportunities: 15, anomalies: 4 },
  { date: 'Dec 15', riskScore: 61, alerts: 24, opportunities: 18, anomalies: 7 },
  { date: 'Dec 18', riskScore: 58, alerts: 21, opportunities: 22, anomalies: 6 },
  { date: 'Dec 20', riskScore: 65, alerts: 28, opportunities: 25, anomalies: 8 },
  { date: 'Dec 22', riskScore: 72, alerts: 34, opportunities: 28, anomalies: 12 },
];

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
  low: { label: 'Low', color: 'bg-gray-500/20 text-muted-foreground border-gray-500/30' }
};

const PRIORITY_CONFIG = {
  critical: { label: 'Critical', color: 'bg-red-600 text-white' },
  high: { label: 'High', color: 'bg-orange-500/20 text-orange-400' },
  medium: { label: 'Medium', color: 'bg-blue-500/20 text-blue-400' },
  low: { label: 'Low', color: 'bg-gray-500/20 text-muted-foreground' }
};

export default function AdminAIInsights() {
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [timeRange, setTimeRange] = useState("24h");
  const [searchTerm, setSearchTerm] = useState("");

  const activeAlerts = platformInsights.filter(i => i.category === 'risk_alerts').length;
  const riskScore = 72;
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3" data-testid="text-page-title">
            <div className="p-2 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg">
              <Brain className="h-6 w-6 text-white" />
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
            <div className="text-2xl font-bold text-white" data-testid="text-active-alerts">{activeAlerts}</div>
            <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
              <ArrowUpRight className="h-3 w-3" />
              +3 from yesterday
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border border-l-4 border-l-orange-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Risk Score</CardTitle>
            <Shield className="h-4 w-4 text-orange-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white" data-testid="text-risk-score">{riskScore}/100</div>
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
            <div className="text-2xl font-bold text-white" data-testid="text-trend-signals">{trendSignals}</div>
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
            <div className="text-2xl font-bold text-white" data-testid="text-anomalies">{anomaliesDetected}</div>
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
            className="pl-10 bg-muted border-border text-white w-64"
            data-testid="input-search"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-40 bg-muted border-border text-white" data-testid="select-category">
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
          <SelectTrigger className="w-36 bg-muted border-border text-white" data-testid="select-priority">
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
          <SelectTrigger className="w-36 bg-muted border-border text-white" data-testid="select-time-range">
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
          <CardTitle className="text-white flex items-center gap-2">
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
              <AreaChart data={trendChartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
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
                <CardTitle className="text-white flex items-center gap-2">
                  <div className={`p-2 rounded-lg ${config.color}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  {config.label}
                  <Badge className="ml-auto bg-gray-700 text-muted-foreground">{categoryInsights.length}</Badge>
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
                              <h4 className="text-white font-medium text-sm">{insight.title}</h4>
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
              <CardTitle className="text-white flex items-center gap-2">
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
                      <TableCell className="font-medium text-white">{rec.agentName}</TableCell>
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
