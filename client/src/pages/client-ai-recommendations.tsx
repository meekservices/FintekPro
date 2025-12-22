import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Brain,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Calculator,
  Sparkles,
  Target,
  Clock,
  IndianRupee,
  Eye,
  X,
  ShoppingCart,
  Scale,
  Percent,
  ArrowUpRight,
  ArrowDownRight,
  ChevronDown,
  Filter,
  Zap
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface AIRecommendation {
  id: string;
  type: 'buy' | 'sell' | 'hold' | 'rebalance' | 'tax_optimization';
  title: string;
  description: string;
  expectedBenefit: string;
  riskLevel: 'low' | 'medium' | 'high';
  confidenceScore: number;
  priority: 'high' | 'medium' | 'low';
  symbol?: string;
  sector?: string;
  reasoning: string;
}

const SAMPLE_RECOMMENDATIONS: AIRecommendation[] = [
  {
    id: '1',
    type: 'buy',
    title: 'Consider Adding HDFC Bank',
    description: 'Strong fundamentals with consistent dividend history. Currently trading at attractive valuations relative to historical P/E.',
    expectedBenefit: '+12% potential return',
    riskLevel: 'medium',
    confidenceScore: 87,
    priority: 'high',
    symbol: 'HDFCBANK',
    sector: 'Banking',
    reasoning: 'AI analysis shows undervaluation based on DCF model. Strong loan growth and improving NPA ratios support bullish outlook.'
  },
  {
    id: '2',
    type: 'sell',
    title: 'Consider Exiting Paytm',
    description: 'Stock has reached resistance levels with declining volume. Regulatory concerns persist affecting business outlook.',
    expectedBenefit: 'Protect capital from potential 15% decline',
    riskLevel: 'high',
    confidenceScore: 78,
    priority: 'high',
    symbol: 'PAYTM',
    sector: 'Fintech',
    reasoning: 'Technical indicators suggest overbought conditions. Fundamental analysis indicates challenges in path to profitability.'
  },
  {
    id: '3',
    type: 'rebalance',
    title: 'Reduce IT Sector Exposure',
    description: 'Your IT allocation at 35% exceeds the recommended 25% for your risk profile. Consider rebalancing to banking sector.',
    expectedBenefit: 'Better risk-adjusted returns',
    riskLevel: 'medium',
    confidenceScore: 92,
    priority: 'high',
    reasoning: 'Portfolio drift detected. Sector concentration increases volatility risk. Diversification to other sectors recommended.'
  },
  {
    id: '4',
    type: 'tax_optimization',
    title: 'Tax Loss Harvesting Opportunity',
    description: 'Sell Wipro at loss to offset gains from Infosys sale. Estimated tax savings of ₹45,000.',
    expectedBenefit: 'Save ₹45,000 in taxes',
    riskLevel: 'low',
    confidenceScore: 95,
    priority: 'high',
    symbol: 'WIPRO',
    sector: 'IT Services',
    reasoning: 'Portfolio has ₹3L STCG. Wipro loss of ₹1.5L can offset gains. Recommend reinvesting in similar IT ETF after 30 days.'
  },
  {
    id: '5',
    type: 'buy',
    title: 'Add Reliance Industries',
    description: 'Retail and Jio segments showing strong growth. New energy initiatives position for long-term growth.',
    expectedBenefit: '+18% potential return over 12 months',
    riskLevel: 'medium',
    confidenceScore: 82,
    priority: 'medium',
    symbol: 'RELIANCE',
    sector: 'Conglomerate',
    reasoning: 'Sum-of-parts valuation suggests 20% upside. Jio and retail continue to deliver strong growth metrics.'
  },
  {
    id: '6',
    type: 'hold',
    title: 'Maintain TCS Position',
    description: 'Strong fundamentals with consistent performance. Wait for better entry point for additional investment.',
    expectedBenefit: 'Steady 8-10% annual returns',
    riskLevel: 'low',
    confidenceScore: 88,
    priority: 'low',
    symbol: 'TCS',
    sector: 'IT Services',
    reasoning: 'Stock fairly valued at current levels. Strong cash flows and dividend yield provide downside protection.'
  },
  {
    id: '7',
    type: 'buy',
    title: 'Consider SBI for Value Pick',
    description: 'Largest PSU bank trading below book value. Government support and improving asset quality.',
    expectedBenefit: '+15% potential return',
    riskLevel: 'medium',
    confidenceScore: 79,
    priority: 'medium',
    symbol: 'SBIN',
    sector: 'Banking',
    reasoning: 'P/B ratio at 0.9x vs historical average of 1.2x. Credit growth improving with stable NIMs.'
  },
  {
    id: '8',
    type: 'rebalance',
    title: 'Increase Debt Allocation',
    description: 'With rising interest rates, consider moving 10% from equity to debt funds for better stability.',
    expectedBenefit: 'Reduce portfolio volatility by 15%',
    riskLevel: 'low',
    confidenceScore: 85,
    priority: 'medium',
    reasoning: 'Current equity allocation at 80% exceeds target of 70%. Debt funds offering attractive yields of 7-8%.'
  },
  {
    id: '9',
    type: 'sell',
    title: 'Book Profits in Adani Enterprises',
    description: 'Stock up 45% in 3 months. Consider booking partial profits to lock in gains.',
    expectedBenefit: 'Lock in ₹1.2L gains',
    riskLevel: 'high',
    confidenceScore: 74,
    priority: 'medium',
    symbol: 'ADANIENT',
    sector: 'Infrastructure',
    reasoning: 'Technical RSI at 75 indicates overbought. Booking 50% profits recommended with trailing stop for rest.'
  },
  {
    id: '10',
    type: 'tax_optimization',
    title: 'Maximize 80C with ELSS',
    description: 'You have ₹50,000 remaining in 80C limit. Invest in ELSS funds before March 31.',
    expectedBenefit: 'Tax saving of ₹15,600',
    riskLevel: 'low',
    confidenceScore: 98,
    priority: 'low',
    reasoning: 'ELSS offers dual benefit of tax saving and equity exposure. 3-year lock-in suits long-term goals.'
  }
];

const TYPE_CONFIG = {
  buy: { label: 'Buy Signal', icon: TrendingUp, color: 'bg-emerald-100 text-emerald-700 border-emerald-200', iconColor: 'text-emerald-600' },
  sell: { label: 'Sell Signal', icon: TrendingDown, color: 'bg-red-100 text-red-700 border-red-200', iconColor: 'text-red-600' },
  hold: { label: 'Hold', icon: Target, color: 'bg-blue-100 text-blue-700 border-blue-200', iconColor: 'text-blue-600' },
  rebalance: { label: 'Rebalance', icon: Scale, color: 'bg-purple-100 text-purple-700 border-purple-200', iconColor: 'text-purple-600' },
  tax_optimization: { label: 'Tax Optimization', icon: Calculator, color: 'bg-amber-100 text-amber-700 border-amber-200', iconColor: 'text-amber-600' }
};

const RISK_CONFIG = {
  low: { label: 'Low Risk', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  medium: { label: 'Medium Risk', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  high: { label: 'High Risk', color: 'bg-red-100 text-red-700 border-red-200' }
};

const PRIORITY_CONFIG = {
  high: { label: 'High Priority', color: 'bg-red-100 text-red-700 border-red-200' },
  medium: { label: 'Medium', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  low: { label: 'Low', color: 'bg-gray-100 text-gray-700 border-gray-200' }
};

export default function ClientAIRecommendations() {
  const [activeTab, setActiveTab] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);

  const activeRecommendations = SAMPLE_RECOMMENDATIONS.filter(
    rec => !dismissedIds.includes(rec.id)
  );

  const filteredRecommendations = activeRecommendations.filter(rec => {
    const matchesTab = activeTab === 'all' ||
      (activeTab === 'buy' && rec.type === 'buy') ||
      (activeTab === 'sell' && rec.type === 'sell') ||
      (activeTab === 'rebalancing' && rec.type === 'rebalance') ||
      (activeTab === 'tax' && rec.type === 'tax_optimization');
    
    const matchesPriority = priorityFilter === 'all' || rec.priority === priorityFilter;
    
    return matchesTab && matchesPriority;
  });

  const stats = {
    total: activeRecommendations.length,
    highPriority: activeRecommendations.filter(r => r.priority === 'high').length,
    potentialGains: activeRecommendations
      .filter(r => r.type === 'buy' || r.type === 'tax_optimization')
      .length,
    lastUpdated: 'Today, 2:30 PM'
  };

  const handleDismiss = (id: string) => {
    setDismissedIds([...dismissedIds, id]);
  };

  const getConfidenceColor = (score: number) => {
    if (score >= 90) return 'text-emerald-600';
    if (score >= 75) return 'text-blue-600';
    if (score >= 60) return 'text-amber-600';
    return 'text-gray-600';
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6" data-testid="client-ai-recommendations-page">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2" data-testid="text-page-title">
              <Brain className="h-7 w-7 text-blue-600" />
              AI Investment Insights
            </h1>
            <p className="text-gray-600 mt-1">
              Personalized investment recommendations based on your risk profile and portfolio
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="bg-blue-100 text-blue-700 border-blue-200" data-testid="badge-ai-powered">
              <Sparkles className="h-3 w-3 mr-1" />
              AI-Powered
            </Badge>
            <Button variant="outline" size="sm" className="border-gray-300" data-testid="button-refresh">
              <RefreshCw className="h-4 w-4 mr-1" />
              Refresh
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-white border-gray-200 shadow-sm" data-testid="card-total-recommendations">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-100">
                  <Zap className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-gray-500 text-sm">Total Recommendations</p>
                  <p className="text-2xl font-bold text-gray-900" data-testid="text-total-count">{stats.total}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-gray-200 shadow-sm" data-testid="card-high-priority">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-100">
                  <Target className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-gray-500 text-sm">High Priority</p>
                  <p className="text-2xl font-bold text-gray-900" data-testid="text-high-priority-count">{stats.highPriority}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-gray-200 shadow-sm" data-testid="card-potential-gains">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-100">
                  <ArrowUpRight className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-gray-500 text-sm">Potential Gains</p>
                  <p className="text-2xl font-bold text-gray-900" data-testid="text-gains-count">{stats.potentialGains}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-gray-200 shadow-sm" data-testid="card-last-updated">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-gray-100">
                  <Clock className="h-5 w-5 text-gray-600" />
                </div>
                <div>
                  <p className="text-gray-500 text-sm">Last Updated</p>
                  <p className="text-sm font-medium text-gray-900" data-testid="text-last-updated">{stats.lastUpdated}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full md:w-auto">
            <TabsList className="bg-white border border-gray-200 shadow-sm">
              <TabsTrigger value="all" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white" data-testid="tab-all">
                All
              </TabsTrigger>
              <TabsTrigger value="buy" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white" data-testid="tab-buy">
                Buy Signals
              </TabsTrigger>
              <TabsTrigger value="sell" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white" data-testid="tab-sell">
                Sell Signals
              </TabsTrigger>
              <TabsTrigger value="rebalancing" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white" data-testid="tab-rebalancing">
                Rebalancing
              </TabsTrigger>
              <TabsTrigger value="tax" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white" data-testid="tab-tax">
                Tax Optimization
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="border-gray-300" data-testid="button-priority-filter">
                <Filter className="h-4 w-4 mr-2" />
                Priority: {priorityFilter === 'all' ? 'All' : priorityFilter.charAt(0).toUpperCase() + priorityFilter.slice(1)}
                <ChevronDown className="h-4 w-4 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setPriorityFilter('all')} data-testid="filter-all">
                All Priorities
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setPriorityFilter('high')} data-testid="filter-high">
                High Priority
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setPriorityFilter('medium')} data-testid="filter-medium">
                Medium Priority
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setPriorityFilter('low')} data-testid="filter-low">
                Low Priority
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <Card className="bg-white border-gray-200 shadow-sm">
          <CardContent className="p-0">
            <ScrollArea className="h-[600px]">
              <div className="divide-y divide-gray-100">
                {filteredRecommendations.length === 0 ? (
                  <div className="p-8 text-center">
                    <Brain className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">No recommendations found for this filter</p>
                  </div>
                ) : (
                  filteredRecommendations.map((rec) => {
                    const typeConfig = TYPE_CONFIG[rec.type];
                    const Icon = typeConfig.icon;
                    return (
                      <div
                        key={rec.id}
                        className="p-5 hover:bg-gray-50 transition-colors"
                        data-testid={`recommendation-card-${rec.id}`}
                      >
                        <div className="flex items-start gap-4">
                          <div className={`p-3 rounded-lg border ${typeConfig.color}`}>
                            <Icon className={`h-6 w-6 ${typeConfig.iconColor}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-3">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 flex-wrap mb-2">
                                  <h3 className="font-semibold text-gray-900" data-testid={`rec-title-${rec.id}`}>
                                    {rec.title}
                                  </h3>
                                  <Badge variant="outline" className={typeConfig.color} data-testid={`rec-type-${rec.id}`}>
                                    {typeConfig.label}
                                  </Badge>
                                  {rec.symbol && (
                                    <Badge variant="outline" className="bg-gray-100 text-gray-700 border-gray-200" data-testid={`rec-symbol-${rec.id}`}>
                                      {rec.symbol}
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-gray-600 text-sm mb-3" data-testid={`rec-description-${rec.id}`}>
                                  {rec.description}
                                </p>
                                
                                <div className="flex items-center gap-4 flex-wrap mb-3">
                                  <div className="flex items-center gap-1">
                                    {rec.type === 'buy' || rec.type === 'tax_optimization' ? (
                                      <ArrowUpRight className="h-4 w-4 text-emerald-600" />
                                    ) : rec.type === 'sell' ? (
                                      <ArrowDownRight className="h-4 w-4 text-red-600" />
                                    ) : (
                                      <Target className="h-4 w-4 text-blue-600" />
                                    )}
                                    <span className={`text-sm font-medium ${
                                      rec.type === 'buy' || rec.type === 'tax_optimization' ? 'text-emerald-600' :
                                      rec.type === 'sell' ? 'text-red-600' : 'text-blue-600'
                                    }`} data-testid={`rec-benefit-${rec.id}`}>
                                      {rec.expectedBenefit}
                                    </span>
                                  </div>
                                  <Badge variant="outline" className={RISK_CONFIG[rec.riskLevel].color} data-testid={`rec-risk-${rec.id}`}>
                                    {RISK_CONFIG[rec.riskLevel].label}
                                  </Badge>
                                  <div className="flex items-center gap-1">
                                    <Percent className="h-4 w-4 text-gray-400" />
                                    <span className={`text-sm font-medium ${getConfidenceColor(rec.confidenceScore)}`} data-testid={`rec-confidence-${rec.id}`}>
                                      {rec.confidenceScore}% AI Confidence
                                    </span>
                                  </div>
                                </div>

                                <div className="p-3 bg-blue-50 rounded-lg border border-blue-100 mb-3">
                                  <div className="flex items-start gap-2">
                                    <Sparkles className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                                    <div>
                                      <p className="text-blue-700 text-xs font-medium">AI Analysis</p>
                                      <p className="text-blue-600 text-sm mt-0.5" data-testid={`rec-reasoning-${rec.id}`}>
                                        {rec.reasoning}
                                      </p>
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 flex-wrap">
                                  <Badge variant="outline" className={PRIORITY_CONFIG[rec.priority].color} data-testid={`rec-priority-${rec.id}`}>
                                    {PRIORITY_CONFIG[rec.priority].label}
                                  </Badge>
                                  {rec.sector && (
                                    <Badge variant="outline" className="bg-gray-100 text-gray-600 border-gray-200">
                                      {rec.sector}
                                    </Badge>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-2 flex-shrink-0 lg:flex-col lg:items-end">
                                <Button 
                                  size="sm" 
                                  className="bg-blue-600 hover:bg-blue-700 text-white"
                                  data-testid={`button-view-details-${rec.id}`}
                                >
                                  <Eye className="h-4 w-4 mr-1" />
                                  View Details
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  className="border-gray-300 text-gray-600 hover:bg-gray-100"
                                  onClick={() => handleDismiss(rec.id)}
                                  data-testid={`button-dismiss-${rec.id}`}
                                >
                                  <X className="h-4 w-4 mr-1" />
                                  Dismiss
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Brain className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">How AI Recommendations Work</h3>
                  <p className="text-gray-600 text-sm">
                    Our AI analyzes your portfolio, risk profile, market trends, and tax situation to provide personalized suggestions.
                  </p>
                </div>
              </div>
              <Button variant="outline" className="border-blue-300 text-blue-700 hover:bg-blue-100" data-testid="button-learn-more">
                Learn More
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
