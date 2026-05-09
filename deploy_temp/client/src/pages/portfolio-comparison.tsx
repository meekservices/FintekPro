import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, TrendingUp, TrendingDown, Star, Plus, X, BarChart3, PieChart, Target, AlertCircle, CheckCircle, ArrowUpRight, ArrowDownRight, Shuffle, FolderOpen } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface PortfolioData {
  id: string;
  name: string;
  description?: string;
  totalValue: number;
  holdings: Array<{
    symbol: string;
    quantity: number;
    currentPrice: number;
    value: number;
  }>;
}

interface PortfolioComparisonResult {
  portfolios: Array<{
    id: string;
    name: string;
    totalValue: number;
    returns: {
      "1M": number;
      "6M": number;
      "1Y": number;
      "3Y": number;
      "5Y": number;
    };
    metrics: {
      volatility: number;
      sharpeRatio: number;
      alpha: number;
      beta: number;
      maxDrawdown: number;
      diversificationRatio: number;
      treynorRatio: number;
      sortinoRatio: number;
      informationRatio: number;
      downsideDeviation: number;
      trackingError: number;
    };
    assetAllocation: {
      equity: number;
      debt: number;
      cash: number;
      others: number;
    };
    topHoldings: Array<{
      symbol: string;
      allocation: number;
    }>;
    riskProfile: string;
  }>;
  analysis: {
    bestPerformer: string;
    mostStable: string;
    highestSharpe: string;
    bestDiversified: string;
    highestAlpha: string;
    bestTreynor: string;
    correlationMatrix: number[][];
  };
  aiInsights: string;
  recommendationScore: number;
}

function PortfolioSearchInput({ onPortfolioSelect, selectedPortfolios }: { 
  onPortfolioSelect: (portfolio: PortfolioData) => void;
  selectedPortfolios: PortfolioData[];
}) {
  const [searchTerm, setSearchTerm] = useState("");
  
  const { data: portfoliosResponse, isLoading } = useQuery<{ portfolios: PortfolioData[] }>({
    queryKey: ['/api/portfolios'],
    queryFn: async () => {
      try {
        const data = await apiRequest('/api/portfolios');
        return data;
      } catch {
        return { portfolios: [] };
      }
    },
  });

  const availablePortfolios = portfoliosResponse?.portfolios || [];

  const filteredResults = availablePortfolios.filter(portfolio => 
    portfolio.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
    !selectedPortfolios.some(selected => selected.id === portfolio.id)
  ).slice(0, 5);

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search for portfolios to compare..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
          data-testid="input-portfolio-search"
        />
      </div>
      
      {searchTerm && (
        <div className="absolute z-10 w-full mt-1 bg-card border border-border rounded-md shadow-lg max-h-64 overflow-y-auto">
          {isLoading ? (
            <div className="p-4">
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            </div>
          ) : filteredResults.length > 0 ? (
            <div className="py-2">
              {filteredResults.map((portfolio) => (
                <div
                  key={portfolio.id}
                  className="px-4 py-3 hover:bg-muted cursor-pointer border-b border-border"
                  onClick={() => {
                    onPortfolioSelect(portfolio);
                    setSearchTerm("");
                  }}
                  data-testid={`portfolio-option-${portfolio.id}`}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="font-medium text-sm">{portfolio.name}</div>
                      {portfolio.description && (
                        <div className="text-xs text-muted-foreground">{portfolio.description}</div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium">₹{portfolio.totalValue.toLocaleString()}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 text-center text-muted-foreground">
              No portfolios found
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SelectedPortfolioCard({ portfolio, onRemove }: {
  portfolio: PortfolioData;
  onRemove: () => void;
}) {
  return (
    <Card className="border-2 border-dashed border-blue-200 dark:border-blue-800">
      <CardContent className="p-4">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <h3 className="font-semibold text-sm">{portfolio.name}</h3>
            {portfolio.description && (
              <p className="text-xs text-muted-foreground mt-1">{portfolio.description}</p>
            )}
            <div className="mt-2">
              <span className="text-lg font-bold text-green-600 dark:text-green-400">
                ₹{portfolio.totalValue.toLocaleString()}
              </span>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onRemove}
            className="text-muted-foreground hover:text-red-500 p-1"
            data-testid={`button-remove-portfolio-${portfolio.id}`}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ComparisonResults({ comparison }: { comparison: PortfolioComparisonResult }) {
  const getReturnColor = (value: number) => {
    if (value > 15) return "text-green-600 dark:text-green-400";
    if (value > 8) return "text-blue-600 dark:text-blue-400";
    if (value > 0) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  const getRiskColor = (profile: string) => {
    switch (profile.toLowerCase()) {
      case "low": return "text-green-600 dark:text-green-400";
      case "moderate": return "text-yellow-600 dark:text-yellow-400";
      case "high": return "text-red-600 dark:text-red-400";
      default: return "text-muted-foreground";
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-600" />
              Best Performer
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-semibold">{comparison.analysis.bestPerformer}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Target className="h-4 w-4 text-blue-600" />
              Most Stable
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-semibold">{comparison.analysis.mostStable}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Star className="h-4 w-4 text-yellow-600" />
              Highest Sharpe
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-semibold">{comparison.analysis.highestSharpe}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <PieChart className="h-4 w-4 text-purple-600" />
              Best Diversified
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-semibold">{comparison.analysis.bestDiversified}</p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Comparison */}
      <Tabs defaultValue="performance" className="w-full">
        <ScrollableTabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="risk">Risk Metrics</TabsTrigger>
          <TabsTrigger value="allocation">Asset Allocation</TabsTrigger>
          <TabsTrigger value="holdings">Top Holdings</TabsTrigger>
        </ScrollableTabsList>

        <TabsContent value="performance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Returns Comparison</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Portfolio</th>
                      <th className="text-center p-2">1M</th>
                      <th className="text-center p-2">6M</th>
                      <th className="text-center p-2">1Y</th>
                      <th className="text-center p-2">3Y</th>
                      <th className="text-center p-2">5Y</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparison.portfolios.map((portfolio) => (
                      <tr key={portfolio.id} className="border-b">
                        <td className="p-2 font-medium">{portfolio.name}</td>
                        <td className={`text-center p-2 ${getReturnColor(portfolio.returns["1M"])}`}>
                          {portfolio.returns["1M"].toFixed(2)}%
                        </td>
                        <td className={`text-center p-2 ${getReturnColor(portfolio.returns["6M"])}`}>
                          {portfolio.returns["6M"].toFixed(2)}%
                        </td>
                        <td className={`text-center p-2 ${getReturnColor(portfolio.returns["1Y"])}`}>
                          {portfolio.returns["1Y"].toFixed(2)}%
                        </td>
                        <td className={`text-center p-2 ${getReturnColor(portfolio.returns["3Y"])}`}>
                          {portfolio.returns["3Y"].toFixed(2)}%
                        </td>
                        <td className={`text-center p-2 ${getReturnColor(portfolio.returns["5Y"])}`}>
                          {portfolio.returns["5Y"].toFixed(2)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="risk" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Risk Metrics Comparison</CardTitle>
              <CardDescription>
                Compare risk-adjusted performance metrics across portfolios. Higher values are better for ratios (except Beta &gt; 1 means higher market sensitivity).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left p-2 font-semibold">Portfolio</th>
                      <th className="text-center p-2">
                        <div className="flex flex-col items-center gap-1">
                          <span className="font-semibold">Alpha</span>
                          <span className="text-xs text-muted-foreground font-normal">Excess Return</span>
                        </div>
                      </th>
                      <th className="text-center p-2">
                        <div className="flex flex-col items-center gap-1">
                          <span className="font-semibold">Beta</span>
                          <span className="text-xs text-muted-foreground font-normal">Market Sensitivity</span>
                        </div>
                      </th>
                      <th className="text-center p-2">
                        <div className="flex flex-col items-center gap-1">
                          <span className="font-semibold">Sharpe</span>
                          <span className="text-xs text-muted-foreground font-normal">Risk-Adj Return</span>
                        </div>
                      </th>
                      <th className="text-center p-2">
                        <div className="flex flex-col items-center gap-1">
                          <span className="font-semibold">Treynor</span>
                          <span className="text-xs text-muted-foreground font-normal">Return/Beta</span>
                        </div>
                      </th>
                      <th className="text-center p-2">
                        <div className="flex flex-col items-center gap-1">
                          <span className="font-semibold">Sortino</span>
                          <span className="text-xs text-muted-foreground font-normal">Downside-Adj</span>
                        </div>
                      </th>
                      <th className="text-center p-2">
                        <div className="flex flex-col items-center gap-1">
                          <span className="font-semibold">Info Ratio</span>
                          <span className="text-xs text-muted-foreground font-normal">Active Return</span>
                        </div>
                      </th>
                      <th className="text-center p-2">
                        <div className="flex flex-col items-center gap-1">
                          <span className="font-semibold">Max DD</span>
                          <span className="text-xs text-muted-foreground font-normal">Worst Loss</span>
                        </div>
                      </th>
                      <th className="text-center p-2">
                        <div className="flex flex-col items-center gap-1">
                          <span className="font-semibold">Volatility</span>
                          <span className="text-xs text-muted-foreground font-normal">Std Dev</span>
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparison.portfolios.map((portfolio) => (
                      <tr key={portfolio.id} className="border-b hover:bg-muted/30">
                        <td className="p-2 font-medium">{portfolio.name}</td>
                        <td className={`text-center p-2 font-medium ${(portfolio.metrics.alpha || 0) > 0 ? 'text-green-600' : (portfolio.metrics.alpha || 0) < 0 ? 'text-red-600' : ''}`}>
                          {(portfolio.metrics.alpha || 0).toFixed(2)}%
                        </td>
                        <td className={`text-center p-2 ${(portfolio.metrics.beta || 1) > 1.2 ? 'text-orange-600' : (portfolio.metrics.beta || 1) < 0.8 ? 'text-blue-600' : ''}`}>
                          {(portfolio.metrics.beta || 1).toFixed(2)}
                        </td>
                        <td className={`text-center p-2 font-medium ${(portfolio.metrics.sharpeRatio || 0) > 1 ? 'text-green-600' : (portfolio.metrics.sharpeRatio || 0) < 0.5 ? 'text-red-600' : ''}`}>
                          {(portfolio.metrics.sharpeRatio || 0).toFixed(2)}
                        </td>
                        <td className={`text-center p-2 ${(portfolio.metrics.treynorRatio || 0) > 5 ? 'text-green-600' : ''}`}>
                          {(portfolio.metrics.treynorRatio || 0).toFixed(2)}
                        </td>
                        <td className={`text-center p-2 ${portfolio.metrics.sortinoRatio != null && portfolio.metrics.sortinoRatio > 1.5 ? 'text-green-600' : ''}`}>
                          {portfolio.metrics.sortinoRatio != null ? portfolio.metrics.sortinoRatio.toFixed(2) : 'N/A'}
                        </td>
                        <td className={`text-center p-2 ${(portfolio.metrics.informationRatio || 0) > 0.5 ? 'text-green-600' : ''}`}>
                          {(portfolio.metrics.informationRatio || 0).toFixed(2)}
                        </td>
                        <td className="text-center p-2 text-red-600">
                          -{(portfolio.metrics.maxDrawdown || 0).toFixed(1)}%
                        </td>
                        <td className="text-center p-2">
                          {(portfolio.metrics.volatility || 0).toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Metrics Legend */}
              <div className="mt-6 p-4 bg-muted/30 rounded-lg">
                <h4 className="font-semibold mb-3">Understanding the Metrics</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
                  <div>
                    <span className="font-medium text-primary">Alpha (Jensen's)</span>
                    <p className="text-muted-foreground">Excess returns over benchmark. Positive = outperforming market on risk-adjusted basis.</p>
                  </div>
                  <div>
                    <span className="font-medium text-primary">Beta</span>
                    <p className="text-muted-foreground">Market sensitivity. Beta=1 moves with market, &gt;1 more volatile, &lt;1 less volatile.</p>
                  </div>
                  <div>
                    <span className="font-medium text-primary">Sharpe Ratio</span>
                    <p className="text-muted-foreground">Return per unit of total risk. &gt;1 is good, &gt;2 is excellent.</p>
                  </div>
                  <div>
                    <span className="font-medium text-primary">Treynor Ratio</span>
                    <p className="text-muted-foreground">Return per unit of systematic risk (beta). Higher is better for diversified portfolios.</p>
                  </div>
                  <div>
                    <span className="font-medium text-primary">Sortino Ratio</span>
                    <p className="text-muted-foreground">Like Sharpe but only penalizes downside volatility. Better for asymmetric returns.</p>
                  </div>
                  <div>
                    <span className="font-medium text-primary">Information Ratio</span>
                    <p className="text-muted-foreground">Active return per tracking error. Measures manager skill vs benchmark.</p>
                  </div>
                  <div>
                    <span className="font-medium text-primary">Max Drawdown</span>
                    <p className="text-muted-foreground">Largest peak-to-trough decline. Worst-case historical loss.</p>
                  </div>
                  <div>
                    <span className="font-medium text-primary">Volatility</span>
                    <p className="text-muted-foreground">Standard deviation of returns. Higher = more price fluctuation.</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="allocation" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {comparison.portfolios.map((portfolio) => (
              <Card key={portfolio.id}>
                <CardHeader>
                  <CardTitle className="text-lg">{portfolio.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span>Equity</span>
                      <span className="font-semibold">{portfolio.assetAllocation.equity.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full" 
                        style={{ width: `${portfolio.assetAllocation.equity}%` }}
                      ></div>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span>Debt</span>
                      <span className="font-semibold">{portfolio.assetAllocation.debt.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div 
                        className="bg-green-600 h-2 rounded-full" 
                        style={{ width: `${portfolio.assetAllocation.debt}%` }}
                      ></div>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span>Cash</span>
                      <span className="font-semibold">{portfolio.assetAllocation.cash.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div 
                        className="bg-yellow-600 h-2 rounded-full" 
                        style={{ width: `${portfolio.assetAllocation.cash}%` }}
                      ></div>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span>Others</span>
                      <span className="font-semibold">{portfolio.assetAllocation.others.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div 
                        className="bg-purple-600 h-2 rounded-full" 
                        style={{ width: `${portfolio.assetAllocation.others}%` }}
                      ></div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="holdings" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {comparison.portfolios.map((portfolio) => (
              <Card key={portfolio.id}>
                <CardHeader>
                  <CardTitle className="text-lg">{portfolio.name}</CardTitle>
                  <CardDescription>Top Holdings</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {portfolio.topHoldings.map((holding, index) => (
                      <div key={index} className="flex justify-between items-center">
                        <span className="text-sm">{holding.symbol}</span>
                        <span className="font-semibold">{holding.allocation.toFixed(1)}%</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* AI Insights */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 text-yellow-500" />
            AI Insights & Recommendations
          </CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Recommendation Score:</span>
            <Badge variant={comparison.recommendationScore >= 8 ? "default" : comparison.recommendationScore >= 6 ? "secondary" : "destructive"}>
              {comparison.recommendationScore}/10
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground leading-relaxed">
            {comparison.aiInsights}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function PortfolioComparison() {
  const [selectedPortfolios, setSelectedPortfolios] = useState<PortfolioData[]>([]);
  const [timePeriod, setTimePeriod] = useState("1Y");
  const [benchmarkIndex, setBenchmarkIndex] = useState("NIFTY_50");
  const [comparisonType, setComparisonType] = useState("comprehensive");
  const [comparison, setComparison] = useState<PortfolioComparisonResult | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const comparePortfoliosMutation = useMutation({
    mutationFn: async (requestData: {
      portfolioIds: string[];
      timePeriod: string;
      benchmarkIndex: string;
      comparisonType: string;
    }) => {
      const response = await fetch("/api/portfolios/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestData)
      });
      
      if (!response.ok) {
        throw new Error("Failed to compare portfolios");
      }
      
      return response.json();
    },
    onSuccess: (data: any) => {
      setComparison(data.data);
      toast({
        title: "Success",
        description: "Portfolio comparison completed successfully!",
        variant: "default"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to compare portfolios",
        variant: "destructive"
      });
    }
  });

  const handlePortfolioSelect = (portfolio: PortfolioData) => {
    if (selectedPortfolios.length >= 5) {
      toast({
        title: "Maximum Limit Reached",
        description: "You can compare up to 5 portfolios at once.",
        variant: "destructive"
      });
      return;
    }
    setSelectedPortfolios([...selectedPortfolios, portfolio]);
  };

  const handlePortfolioRemove = (portfolioId: string) => {
    setSelectedPortfolios(selectedPortfolios.filter(p => p.id !== portfolioId));
  };

  const handleCompare = () => {
    if (selectedPortfolios.length < 2) {
      toast({
        title: "Insufficient Portfolios",
        description: "Please select at least 2 portfolios to compare.",
        variant: "destructive"
      });
      return;
    }

    comparePortfoliosMutation.mutate({
      portfolioIds: selectedPortfolios.map(p => p.id),
      timePeriod,
      benchmarkIndex,
      comparisonType
    });
  };

  const clearAll = () => {
    setSelectedPortfolios([]);
    setComparison(null);
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2 flex items-center gap-3">
          <FolderOpen className="h-8 w-8 text-blue-600" />
          Portfolio Comparison
        </h1>
        <p className="text-muted-foreground">
          Compare multiple portfolios side by side to analyze performance, risk metrics, and asset allocation.
        </p>
      </div>

      {/* Portfolio Selection */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Select Portfolios to Compare</span>
            {selectedPortfolios.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={clearAll}
                data-testid="button-clear-all"
              >
                <X className="h-4 w-4 mr-2" />
                Clear All
              </Button>
            )}
          </CardTitle>
          <CardDescription>
            Search and select 2-5 portfolios for detailed comparison analysis.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <PortfolioSearchInput
              onPortfolioSelect={handlePortfolioSelect}
              selectedPortfolios={selectedPortfolios}
            />

            {selectedPortfolios.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                {selectedPortfolios.map((portfolio) => (
                  <SelectedPortfolioCard
                    key={portfolio.id}
                    portfolio={portfolio}
                    onRemove={() => handlePortfolioRemove(portfolio.id)}
                  />
                ))}
              </div>
            )}

            {selectedPortfolios.length >= 2 && (
              <div className="border-t pt-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Time Period</label>
                    <Select value={timePeriod} onValueChange={setTimePeriod}>
                      <SelectTrigger data-testid="select-time-period">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1M">1 Month</SelectItem>
                        <SelectItem value="6M">6 Months</SelectItem>
                        <SelectItem value="1Y">1 Year</SelectItem>
                        <SelectItem value="3Y">3 Years</SelectItem>
                        <SelectItem value="5Y">5 Years</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Benchmark Index</label>
                    <Select value={benchmarkIndex} onValueChange={setBenchmarkIndex}>
                      <SelectTrigger data-testid="select-benchmark">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NIFTY_50">NIFTY 50</SelectItem>
                        <SelectItem value="SENSEX">SENSEX</SelectItem>
                        <SelectItem value="NIFTY_100">NIFTY 100</SelectItem>
                        <SelectItem value="NIFTY_MIDCAP">NIFTY MIDCAP</SelectItem>
                        <SelectItem value="NIFTY_SMALLCAP">NIFTY SMALLCAP</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Analysis Type</label>
                    <Select value={comparisonType} onValueChange={setComparisonType}>
                      <SelectTrigger data-testid="select-comparison-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="comprehensive">Comprehensive</SelectItem>
                        <SelectItem value="performance">Performance Only</SelectItem>
                        <SelectItem value="risk">Risk Analysis</SelectItem>
                        <SelectItem value="allocation">Asset Allocation</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Button
                  onClick={handleCompare}
                  disabled={comparePortfoliosMutation.isPending}
                  className="w-full"
                  data-testid="button-compare-portfolios"
                >
                  {comparePortfoliosMutation.isPending ? (
                    <>
                      <div className="animate-spin h-4 w-4 mr-2 border-2 border-white border-t-transparent rounded-full" />
                      Analyzing Portfolios...
                    </>
                  ) : (
                    <>
                      <BarChart3 className="h-4 w-4 mr-2" />
                      Compare Portfolios ({selectedPortfolios.length})
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Comparison Results */}
      {comparison && (
        <div data-testid="comparison-results">
          <ComparisonResults comparison={comparison} />
        </div>
      )}

      {/* Empty State */}
      {selectedPortfolios.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <PieChart className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">
              No Portfolios Selected
            </h3>
            <p className="text-muted-foreground mb-6">
              Start by searching and selecting portfolios you want to compare.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}