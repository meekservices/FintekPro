import { useState, useEffect } from 'react';
import { RequestMeetingDialog } from "@/components/RequestMeetingDialog";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsTrigger } from '@/components/ui/tabs';
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, TrendingDown, AlertCircle, Brain, Target, DollarSign, BarChart3, Lightbulb, Bell, CheckCircle, XCircle, Activity, PieChart as PieChartIcon, TrendingDown as TrendingDownIcon, Video } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

// Type definitions
interface InvestmentIdea {
  id: string;
  symbol: string;
  instrumentType: string;
  recommendation: 'BUY' | 'SELL' | 'HOLD';
  entryPrice: number;
  targetPrice: number;
  stopLoss: number;
  confidence: number;
  reasoning: string;
  technicalAnalysis: any;
  riskLevel: 'low' | 'medium' | 'high';
  timeHorizon: string;
  status: 'active' | 'completed' | 'stopped_out';
  createdAt: string;
  currentPrice?: number;
  totalReturn?: number;
}

interface YieldTracker {
  id: string;
  symbol: string;
  instrumentType: string;
  initialInvestment: number;
  currentValue: number;
  totalReturn: number;
  targetYield: number;
  riskProfile: string;
  benchmark: string;
  lastUpdated: string;
}

interface PerformanceMetrics {
  totalReturn: number;
  annualizedReturn: number;
  volatility: number;
  sharpeRatio: number;
  maxDrawdown: number;
  beta: number;
  alpha: number;
  sortinoRatio: number;
  calmarRatio: number;
}

interface OptimizationSuggestion {
  type: 'rebalance' | 'diversify' | 'risk_adjust' | 'yield_enhance';
  priority: 'high' | 'medium' | 'low';
  description: string;
  expectedImpact: string;
  actionRequired: string;
}

// Form schema
const newIdeaSchema = z.object({
  symbols: z.string().min(1, 'At least one symbol is required'),
  riskLevel: z.enum(['low', 'medium', 'high']),
  timeHorizon: z.string().min(1, 'Time horizon is required'),
  investmentAmount: z.coerce.number().min(100, 'Minimum investment amount is 100')
});

type NewIdeaFormData = z.infer<typeof newIdeaSchema>;

export default function InvestmentDashboard() {
  const [selectedTab, setSelectedTab] = useState('overview');
  const [selectedIdea, setSelectedIdea] = useState<InvestmentIdea | null>(null);
  const [showBookMeeting, setShowBookMeeting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Forms
  const newIdeaForm = useForm<NewIdeaFormData>({
    resolver: zodResolver(newIdeaSchema),
    defaultValues: {
      symbols: '',
      riskLevel: 'medium',
      timeHorizon: '3-6 months',
      investmentAmount: 10000
    }
  });

  // Queries with proper typing
  const { data: investmentIdeas = [], isLoading: loadingIdeas } = useQuery<InvestmentIdea[]>({
    queryKey: ['/api/investment-ideas']
  });

  const { data: yieldTrackers = [], isLoading: loadingTrackers } = useQuery<YieldTracker[]>({
    queryKey: ['/api/yield-tracker']
  });

  const { data: unreadAlerts = [], isLoading: loadingAlerts } = useQuery<any[]>({
    queryKey: ['/api/investment-alerts/unread']
  });

  const { data: portfolioYield } = useQuery<{
    totalValue: number;
    totalInvestment: number;
    totalReturn: number;
    weightedYield: number;
    diversificationRatio: number;
    sectorAllocation: Record<string, number>;
  }>({
    queryKey: ['/api/yield-tracker/portfolio-yield']
  });

  const { data: optimizationSuggestions = [] } = useQuery<OptimizationSuggestion[]>({
    queryKey: ['/api/yield-tracker/optimization-suggestions']
  });

  const { data: popularRecommendations } = useQuery<{recommendations: InvestmentIdea[]}>({
    queryKey: ['/api/investment-ideas/recommendations/popular']
  });

  // Portfolio Analytics
  const { data: portfolioAnalytics, isLoading: loadingAnalytics } = useQuery<any>({
    queryKey: ['/api/analytics/portfolio']
  });

  // Mutations
  const generateIdeasMutation = useMutation({
    mutationFn: async (data: NewIdeaFormData) => {
      const symbols = data.symbols.split(',').map(s => s.trim().toUpperCase());
      return apiRequest('POST', '/api/investment-ideas/generate', {
        body: { symbols, riskLevel: data.riskLevel, timeHorizon: data.timeHorizon }
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/investment-ideas'] });
      toast({
        title: 'Investment Ideas Generated',
        description: `Generated ${data.recommendations?.length || 0} new investment recommendations`
      });
      setIsGenerating(false);
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to generate investment ideas',
        variant: 'destructive'
      });
      setIsGenerating(false);
    }
  });

  const markAlertReadMutation = useMutation({
    mutationFn: async (alertId: string) => {
      return apiRequest('PUT', `/api/investment-alerts/${alertId}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/investment-alerts/unread'] });
    }
  });

  // Calculate portfolio overview metrics
  const portfolioOverview = {
    totalValue: portfolioYield?.totalValue || 0,
    totalInvestment: portfolioYield?.totalInvestment || 0,
    totalReturn: portfolioYield?.totalReturn || 0,
    activeIdeas: investmentIdeas.filter((idea: InvestmentIdea) => idea.status === 'active').length,
    completedIdeas: investmentIdeas.filter((idea: InvestmentIdea) => idea.status === 'completed').length,
    trackedInvestments: yieldTrackers.length,
    unreadAlerts: unreadAlerts.length
  };

  // Color schemes
  const colors = {
    green: '#10b981',
    red: '#ef4444',
    blue: '#3b82f6',
    orange: '#f97316',
    purple: '#8b5cf6',
    gray: '#6b7280'
  };

  const handleGenerateIdeas = (data: NewIdeaFormData) => {
    setIsGenerating(true);
    generateIdeasMutation.mutate(data);
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'low': return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200';
      case 'medium': return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200';
      case 'high': return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200';
      default: return 'bg-muted text-foreground';
    }
  };

  const getRecommendationColor = (rec: string) => {
    switch (rec) {
      case 'BUY': return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200';
      case 'SELL': return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200';
      case 'HOLD': return 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200';
      default: return 'bg-muted text-foreground';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatPercentage = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted">
      <div className="container mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-foreground flex items-center gap-3" data-testid="title-investment-dashboard">
                <Brain className="h-10 w-10 text-blue-600" />
                Smart Investment Dashboard
              </h1>
              <p className="text-muted-foreground mt-2">
                AI-powered investment ideas and comprehensive yield tracking
              </p>
            </div>
            
            
            {/* Book Meeting Button */}
            <Button
              variant="outline"
              onClick={() => setShowBookMeeting(true)}
              className="gap-2"
              data-testid="btn-book-meeting"
            >
              <Video className="w-4 h-4" />
              Book Meeting
            </Button>

            {/* Alert Notifications */}
            {unreadAlerts.length > 0 && (
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-orange-500" />
                <Badge variant="destructive" data-testid="badge-unread-alerts">
                  {unreadAlerts.length} new alerts
                </Badge>
              </div>
            )}
          </div>
        </div>

        {/* Quick Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="border-l-4 border-l-blue-500" data-testid="card-portfolio-value">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Portfolio Value</p>
                  <p className="text-2xl font-bold text-foreground">
                    {formatCurrency(portfolioOverview.totalValue)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Total Return: {formatPercentage(portfolioOverview.totalReturn)}
                  </p>
                </div>
                <DollarSign className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-green-500" data-testid="card-active-ideas">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Active Ideas</p>
                  <p className="text-2xl font-bold text-foreground">
                    {portfolioOverview.activeIdeas}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {portfolioOverview.completedIdeas} completed
                  </p>
                </div>
                <Lightbulb className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-purple-500" data-testid="card-tracked-investments">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Tracked Investments</p>
                  <p className="text-2xl font-bold text-foreground">
                    {portfolioOverview.trackedInvestments}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Yield monitored
                  </p>
                </div>
                <BarChart3 className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-orange-500" data-testid="card-alerts">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Alert Status</p>
                  <p className="text-2xl font-bold text-foreground">
                    {portfolioOverview.unreadAlerts}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Unread notifications
                  </p>
                </div>
                <AlertCircle className="h-8 w-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-6">
          <ScrollableTabsList className="grid w-full grid-cols-5" data-testid="tabs-investment-dashboard">
            <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
            <TabsTrigger value="ideas" data-testid="tab-ideas">Investment Ideas</TabsTrigger>
            <TabsTrigger value="yield" data-testid="tab-yield">Yield Tracking</TabsTrigger>
            <TabsTrigger value="analytics" data-testid="tab-analytics">Analytics</TabsTrigger>
            <TabsTrigger value="alerts" data-testid="tab-alerts">Alerts</TabsTrigger>
          </ScrollableTabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Portfolio Performance Chart */}
              <Card data-testid="card-portfolio-performance">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Portfolio Performance
                  </CardTitle>
                  <CardDescription>
                    Portfolio value trend over time
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={[
                        { month: 'Jan', value: 45000, benchmark: 43000 },
                        { month: 'Feb', value: 47000, benchmark: 44000 },
                        { month: 'Mar', value: 52000, benchmark: 46000 },
                        { month: 'Apr', value: 49000, benchmark: 47000 },
                        { month: 'May', value: 55000, benchmark: 48000 },
                        { month: 'Jun', value: portfolioOverview.totalValue, benchmark: 50000 }
                      ]}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis />
                        <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                        <Area type="monotone" dataKey="value" stroke={colors.blue} fill={colors.blue} fillOpacity={0.3} />
                        <Area type="monotone" dataKey="benchmark" stroke={colors.gray} fill="none" strokeDasharray="5 5" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Top Recommendations */}
              <Card data-testid="card-top-recommendations">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5" />
                    Top AI Recommendations
                  </CardTitle>
                  <CardDescription>
                    Popular investment ideas based on market analysis
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-64">
                    <div className="space-y-4">
                      {popularRecommendations?.recommendations?.slice(0, 5).map((rec: any, index: number) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                          <div>
                            <p className="font-medium">{rec.symbol}</p>
                            <p className="text-sm text-muted-foreground">{rec.instrumentType}</p>
                          </div>
                          <div className="text-right">
                            <Badge className={getRecommendationColor(rec.recommendation)}>
                              {rec.recommendation}
                            </Badge>
                            <p className="text-sm text-muted-foreground mt-1">
                              {rec.confidence}% confidence
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>

            {/* Optimization Suggestions */}
            {optimizationSuggestions.length > 0 && (
              <Card data-testid="card-optimization-suggestions">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    Portfolio Optimization Suggestions
                  </CardTitle>
                  <CardDescription>
                    AI-powered recommendations to improve your portfolio
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {optimizationSuggestions.map((suggestion: OptimizationSuggestion, index: number) => (
                      <Alert key={index} className={suggestion.priority === 'high' ? 'border-red-200 dark:border-red-800' : suggestion.priority === 'medium' ? 'border-orange-200 dark:border-orange-800' : 'border-blue-200 dark:border-blue-800'}>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <p className="font-medium">{suggestion.type.replace('_', ' ').toUpperCase()}</p>
                              <Badge variant={suggestion.priority === 'high' ? 'destructive' : suggestion.priority === 'medium' ? 'secondary' : 'default'}>
                                {suggestion.priority}
                              </Badge>
                            </div>
                            <p className="text-sm">{suggestion.description}</p>
                            <p className="text-xs text-muted-foreground">{suggestion.expectedImpact}</p>
                          </div>
                        </AlertDescription>
                      </Alert>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Investment Ideas Tab */}
          <TabsContent value="ideas" className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold" data-testid="title-investment-ideas">Investment Ideas</h2>
              
              {/* Generate New Ideas Dialog */}
              <Dialog>
                <DialogTrigger asChild>
                  <Button data-testid="button-generate-ideas" disabled={isGenerating}>
                    <Brain className="h-4 w-4 mr-2" />
                    {isGenerating ? 'Generating...' : 'Generate Ideas'}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Generate Investment Ideas</DialogTitle>
                    <DialogDescription>
                      Use AI to generate personalized investment recommendations
                    </DialogDescription>
                  </DialogHeader>
                  <Form {...newIdeaForm}>
                    <form onSubmit={newIdeaForm.handleSubmit(handleGenerateIdeas)} className="space-y-4">
                      <FormField
                        control={newIdeaForm.control}
                        name="symbols"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Stock Symbols</FormLabel>
                            <FormControl>
                              <Input placeholder="RELIANCE, TCS, HDFC (comma separated)" {...field} data-testid="input-symbols" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={newIdeaForm.control}
                        name="investmentAmount"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Investment Amount (₹)</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                placeholder="10000" 
                                {...field} 
                                data-testid="input-investment-amount" 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={newIdeaForm.control}
                        name="riskLevel"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Risk Level</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-risk-level">
                                  <SelectValue placeholder="Select risk level" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="low">Low Risk</SelectItem>
                                <SelectItem value="medium">Medium Risk</SelectItem>
                                <SelectItem value="high">High Risk</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <div className="flex justify-end space-x-2">
                        <Button type="submit" disabled={isGenerating} data-testid="button-submit-generate">
                          {isGenerating ? 'Generating...' : 'Generate'}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </div>

            {/* Investment Ideas Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {loadingIdeas ? (
                <div className="col-span-full text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="mt-2 text-muted-foreground">Loading investment ideas...</p>
                </div>
              ) : investmentIdeas.length === 0 ? (
                <div className="col-span-full text-center py-8" data-testid="empty-investment-ideas">
                  <Lightbulb className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No investment ideas yet. Generate some to get started!</p>
                </div>
              ) : (
                investmentIdeas.map((idea: InvestmentIdea) => (
                  <Card key={idea.id} className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setSelectedIdea(idea)} data-testid={`card-idea-${idea.id}`}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">{idea.symbol}</CardTitle>
                        <Badge className={getRecommendationColor(idea.recommendation)}>
                          {idea.recommendation}
                        </Badge>
                      </div>
                      <CardDescription>{idea.instrumentType}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Entry Price:</span>
                          <span className="font-medium">{formatCurrency(idea.entryPrice)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Target:</span>
                          <span className="font-medium text-green-600">{formatCurrency(idea.targetPrice)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Stop Loss:</span>
                          <span className="font-medium text-red-600">{formatCurrency(idea.stopLoss)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Confidence:</span>
                          <div className="flex items-center gap-2">
                            <Progress value={idea.confidence} className="w-16" />
                            <span className="text-sm font-medium">{idea.confidence}%</span>
                          </div>
                        </div>
                        <div className="flex justify-between items-center">
                          <Badge className={getRiskColor(idea.riskLevel)}>
                            {idea.riskLevel} risk
                          </Badge>
                          <Badge variant="outline">{idea.timeHorizon}</Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          {/* Yield Tracking Tab */}
          <TabsContent value="yield" className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold" data-testid="title-yield-tracking">Yield Tracking</h2>
              <Button data-testid="button-add-tracker">
                <DollarSign className="h-4 w-4 mr-2" />
                Add Tracker
              </Button>
            </div>

            {/* Yield Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card data-testid="card-weighted-yield">
                <CardHeader>
                  <CardTitle className="text-lg">Weighted Yield</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-green-600">
                    {formatPercentage(portfolioYield?.weightedYield || 0)}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Portfolio-wide yield
                  </p>
                </CardContent>
              </Card>

              <Card data-testid="card-diversification">
                <CardHeader>
                  <CardTitle className="text-lg">Diversification</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-blue-600">
                    {((portfolioYield?.diversificationRatio || 0) * 10).toFixed(1)}/10
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Diversification score
                  </p>
                </CardContent>
              </Card>

              <Card data-testid="card-total-investment">
                <CardHeader>
                  <CardTitle className="text-lg">Total Investment</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-purple-600">
                    {formatCurrency(portfolioYield?.totalInvestment || 0)}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Across all trackers
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Yield Trackers List */}
            <Card data-testid="card-yield-trackers-list">
              <CardHeader>
                <CardTitle>Active Yield Trackers</CardTitle>
                <CardDescription>
                  Monitor performance of your investments
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingTrackers ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-2 text-muted-foreground">Loading yield trackers...</p>
                  </div>
                ) : yieldTrackers.length === 0 ? (
                  <div className="text-center py-8" data-testid="empty-yield-trackers">
                    <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No yield trackers yet. Add one to start monitoring performance!</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {yieldTrackers.map((tracker: YieldTracker) => (
                      <div key={tracker.id} className="flex items-center justify-between p-4 bg-muted rounded-lg" data-testid={`tracker-${tracker.id}`}>
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <h3 className="font-medium">{tracker.symbol}</h3>
                            <Badge variant="outline">{tracker.instrumentType}</Badge>
                            <Badge className={tracker.totalReturn >= 0 ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200' : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200'}>
                              {formatPercentage(tracker.totalReturn)}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-6 mt-2 text-sm text-muted-foreground">
                            <span>Investment: {formatCurrency(tracker.initialInvestment)}</span>
                            <span>Current: {formatCurrency(tracker.currentValue)}</span>
                            <span>Target: {formatPercentage(tracker.targetYield)}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="flex items-center gap-2">
                            {tracker.totalReturn >= 0 ? (
                              <TrendingUp className="h-4 w-4 text-green-500" />
                            ) : (
                              <TrendingDown className="h-4 w-4 text-red-500" />
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            vs {tracker.benchmark}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-6">
            <h2 className="text-2xl font-bold" data-testid="title-analytics">Portfolio Analytics</h2>
            
            {loadingAnalytics ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-2 text-muted-foreground">Loading analytics...</p>
              </div>
            ) : portfolioAnalytics ? (
              <>
                {/* Portfolio Summary */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card data-testid="card-total-invested">
                    <CardHeader className="pb-2">
                      <CardDescription>Total Invested</CardDescription>
                      <CardTitle className="text-2xl">{formatCurrency(portfolioAnalytics.totalInvested)}</CardTitle>
                    </CardHeader>
                  </Card>
                  <Card data-testid="card-current-value">
                    <CardHeader className="pb-2">
                      <CardDescription>Current Value</CardDescription>
                      <CardTitle className="text-2xl">{formatCurrency(portfolioAnalytics.currentValue)}</CardTitle>
                    </CardHeader>
                  </Card>
                  <Card data-testid="card-absolute-returns">
                    <CardHeader className="pb-2">
                      <CardDescription>Absolute Returns</CardDescription>
                      <CardTitle className={`text-2xl ${portfolioAnalytics.absoluteReturns >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {portfolioAnalytics.absoluteReturns >= 0 ? '+' : ''}{formatCurrency(portfolioAnalytics.absoluteReturns)}
                        <span className="text-sm ml-2">({portfolioAnalytics.absoluteReturnsPercentage}%)</span>
                      </CardTitle>
                    </CardHeader>
                  </Card>
                  <Card data-testid="card-xirr">
                    <CardHeader className="pb-2">
                      <CardDescription>Portfolio XIRR</CardDescription>
                      <CardTitle className={`text-2xl ${portfolioAnalytics.xirr?.success ? (portfolioAnalytics.xirr.xirrPercentage >= 0 ? 'text-green-600' : 'text-red-600') : ''}`}>
                        {portfolioAnalytics.xirr?.success ? `${portfolioAnalytics.xirr.xirrPercentage}%` : 'N/A'}
                      </CardTitle>
                    </CardHeader>
                  </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Asset Allocation */}
                  <Card data-testid="card-asset-allocation">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <PieChartIcon className="h-5 w-5" />
                        Asset Allocation
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {Object.entries(portfolioAnalytics.assetAllocation || {})
                          .filter(([key]) => key !== 'total')
                          .map(([asset, data]: [string, any]) => (
                            data.percentage > 0 && (
                              <div key={asset} className="space-y-1">
                                <div className="flex justify-between text-sm">
                                  <span className="capitalize">{asset}</span>
                                  <span className="font-medium">{data?.percentage ?? 0}% ({data?.count ?? 0})</span>
                                </div>
                                <Progress value={data.percentage} className="h-2" />
                              </div>
                            )
                          ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Risk Profile */}
                  <Card data-testid="card-risk-profile">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Target className="h-5 w-5" />
                        Risk Profile
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="text-center py-4">
                          <div className="text-4xl font-bold text-blue-600">{portfolioAnalytics.riskProfile?.score || 0}</div>
                          <Badge className="mt-2">{portfolioAnalytics.riskProfile?.classification || 'N/A'}</Badge>
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Equity Exposure</span>
                            <span className="font-medium">{portfolioAnalytics.riskProfile?.equityExposure?.toFixed(2) || 0}%</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Debt Exposure</span>
                            <span className="font-medium">{portfolioAnalytics.riskProfile?.debtExposure?.toFixed(2) || 0}%</span>
                          </div>
                        </div>
                        <Separator />
                        <p className="text-sm text-muted-foreground">{portfolioAnalytics.riskProfile?.recommendation}</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Category Performance */}
                <Card data-testid="card-category-performance">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5" />
                      Category Performance
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {portfolioAnalytics.categoryPerformance?.map((cat: any) => (
                        <div key={cat.category} className="border-b pb-3 last:border-0">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <h4 className="font-medium">{cat.category}</h4>
                              <p className="text-xs text-muted-foreground">Invested: {formatCurrency(cat.invested)}</p>
                            </div>
                            <div className="text-right">
                              <p className="font-medium">{formatCurrency(cat.currentValue)}</p>
                              <p className={`text-sm ${cat.returnsPercentage >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {cat.returnsPercentage >= 0 ? '+' : ''}{cat.returnsPercentage}%
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No analytics data available</p>
              </div>
            )}
          </TabsContent>

          {/* Alerts Tab */}
          <TabsContent value="alerts" className="space-y-6">
            <h2 className="text-2xl font-bold" data-testid="title-alerts">Investment Alerts</h2>
            
            <Card data-testid="card-alerts-list">
              <CardHeader>
                <CardTitle>Recent Alerts</CardTitle>
                <CardDescription>
                  Stay updated with important investment notifications
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingAlerts ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-2 text-muted-foreground">Loading alerts...</p>
                  </div>
                ) : unreadAlerts.length === 0 ? (
                  <div className="text-center py-8" data-testid="empty-alerts">
                    <CheckCircle className="h-12 w-12 text-green-400 mx-auto mb-4" />
                    <p className="text-muted-foreground">All caught up! No new alerts.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {unreadAlerts.map((alert: any) => (
                      <Alert key={alert.id} className="cursor-pointer hover:bg-muted" onClick={() => markAlertReadMutation.mutate(alert.id)} data-testid={`alert-${alert.id}`}>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">{alert.alertType}</p>
                              <p className="text-sm text-muted-foreground">{alert.message}</p>
                            </div>
                            <Badge variant="outline">{alert.priority}</Badge>
                          </div>
                        </AlertDescription>
                      </Alert>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Selected Investment Idea Detail Modal */}
        {selectedIdea && (
          <Dialog open={!!selectedIdea} onOpenChange={() => setSelectedIdea(null)}>
            <DialogContent className="max-w-2xl" data-testid="dialog-idea-detail">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  {selectedIdea.symbol} - Investment Analysis
                </DialogTitle>
                <DialogDescription>
                  Detailed AI-powered investment recommendation
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-6">
                {/* Key Metrics */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Recommendation</Label>
                    <Badge className={getRecommendationColor(selectedIdea.recommendation)} data-testid="badge-recommendation">
                      {selectedIdea.recommendation}
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    <Label>Confidence Level</Label>
                    <div className="flex items-center gap-2">
                      <Progress value={selectedIdea.confidence} className="flex-1" />
                      <span className="text-sm font-medium">{selectedIdea.confidence}%</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Entry Price</Label>
                    <p className="text-lg font-medium">{formatCurrency(selectedIdea.entryPrice)}</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Target Price</Label>
                    <p className="text-lg font-medium text-green-600">{formatCurrency(selectedIdea.targetPrice)}</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Stop Loss</Label>
                    <p className="text-lg font-medium text-red-600">{formatCurrency(selectedIdea.stopLoss)}</p>
                  </div>
                </div>

                {/* AI Reasoning */}
                <div className="space-y-2">
                  <Label>AI Analysis & Reasoning</Label>
                  <div className="bg-muted p-4 rounded-lg">
                    <p className="text-sm">{selectedIdea.reasoning}</p>
                  </div>
                </div>

                {/* Technical Analysis */}
                {selectedIdea.technicalAnalysis && (
                  <div className="space-y-2">
                    <Label>Technical Indicators</Label>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">RSI:</span>
                        <span className="ml-2 font-medium">{selectedIdea.technicalAnalysis.rsi}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">MACD:</span>
                        <span className="ml-2 font-medium">{selectedIdea.technicalAnalysis.macd}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">SMA 20:</span>
                        <span className="ml-2 font-medium">{selectedIdea.technicalAnalysis.sma20}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">SMA 50:</span>
                        <span className="ml-2 font-medium">{selectedIdea.technicalAnalysis.sma50}</span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => setSelectedIdea(null)} data-testid="button-close-idea">
                    Close
                  </Button>
                  <Button data-testid="button-add-to-portfolio">
                    Add to Portfolio
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}

      {/* Request Meeting Dialog */}
      <RequestMeetingDialog
        open={showBookMeeting}
        onOpenChange={setShowBookMeeting}
      />
      </div>
    </div>
  );
}