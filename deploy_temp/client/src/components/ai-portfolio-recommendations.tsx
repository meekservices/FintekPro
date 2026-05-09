import { AIAdvisoryDisclosure } from "@/components/regulatory/AIAdvisoryDisclosure";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Brain, TrendingUp, AlertTriangle, CheckCircle, RefreshCw, Lightbulb, Target, Shield, Clock, IndianRupee, PieChart } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface AIRecommendation {
  id: string;
  title: string;
  priority: 'high' | 'medium' | 'low';
  recommendation: string;
  reasoning: string;
  expectedImpact: string;
  actionRequired: string;
  estimatedCost?: number;
  timeframe: string;
  riskLevel: 'low' | 'medium' | 'high';
}

interface InvestmentProposal {
  id: string;
  title: string;
  summary: string;
  totalRecommendedInvestment: number;
  recommendations: {
    assetType: string;
    recommendedAllocation: number;
    currentAllocation: number;
    suggestedInstruments: {
      name: string;
      symbol: string;
      type: string;
      recommendedAmount: number;
      reasoning: string;
      riskLevel: string;
      expectedReturn?: string;
    }[];
  }[];
  riskAssessment: {
    overallRisk: 'low' | 'medium' | 'high';
    riskFactors: string[];
    mitigationStrategies: string[];
  };
  expectedOutcomes: {
    shortTerm: string;
    mediumTerm: string;
    longTerm: string;
  };
  implementationPlan: {
    phase: number;
    title: string;
    actions: string[];
    timeframe: string;
    priority: 'high' | 'medium' | 'low';
  }[];
  generatedAt: Date;
  validUntil: Date;
}

interface AIPortfolioRecommendationsProps {
  portfolioId: string;
}

export default function AIPortfolioRecommendations({ portfolioId }: AIPortfolioRecommendationsProps) {
  const [activeTab, setActiveTab] = useState("rebalancing");
  const [additionalCapital, setAdditionalCapital] = useState<number>(0);
  const { toast } = useToast();

  // AI Rebalancing Recommendations Query
  const { 
    data: rebalancingData, 
    isLoading: rebalancingLoading, 
    refetch: refetchRebalancing 
  } = useQuery({
    queryKey: [`/api/ai/portfolios/${portfolioId}/rebalancing-recommendations`],
    enabled: !!portfolioId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false
  });

  // AI Investment Proposal Mutation
  const investmentProposalMutation = useMutation({
    mutationFn: async (data: { additionalCapital: number }) => {
      return apiRequest("POST", `/api/ai/portfolios/${portfolioId}/investment-proposal`, { body: data });
    },
    onSuccess: (data: any) => {
      if (data?.success) {
        toast({
          title: "Investment Proposal Generated",
          description: "AI has analyzed your portfolio and generated personalized recommendations.",
        });
        queryClient.invalidateQueries({ queryKey: [`/api/ai/portfolios/${portfolioId}/investment-proposal`] });
      } else {
        toast({
          title: "Generation Failed",
          description: data?.message || "Unable to generate investment proposal",
          variant: "destructive"
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to generate investment proposal. Please try again.",
        variant: "destructive"
      });
    }
  });

  const handleGenerateProposal = () => {
    investmentProposalMutation.mutate({ additionalCapital });
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 border-red-200 dark:border-red-800';
      case 'medium': return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 border-yellow-200 dark:border-yellow-800';
      case 'low': return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 border-green-200 dark:border-green-800';
      default: return 'bg-muted text-foreground border-border';
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'high': return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200';
      case 'medium': return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200';
      case 'low': return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200';
      default: return 'bg-muted text-foreground';
    }
  };

  const rebalancingRecommendations: AIRecommendation[] = (rebalancingData as any)?.data || [];
  const portfolioSummary = (rebalancingData as any)?.portfolioSummary;

  return (
    <div className="space-y-6" data-testid="ai-portfolio-recommendations">
      {/* Header */}
      <Card className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border-purple-200 dark:border-purple-800">
        <CardHeader>
          <CardTitle className="flex items-center text-purple-700 dark:text-purple-300">
            <Brain className="w-6 h-6 mr-2" />
            AI-Powered Portfolio Intelligence
          </CardTitle>
          <CardDescription className="text-purple-600 dark:text-purple-400">
            Get personalized investment recommendations and portfolio optimization powered by advanced AI analysis
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Portfolio Summary */}
      {portfolioSummary && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <PieChart className="w-5 h-5 mr-2 text-blue-600" />
              Portfolio Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  ₹{portfolioSummary.totalValue?.toLocaleString('en-IN') || '0'}
                </div>
                <div className="text-sm text-muted-foreground">Total Value</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {portfolioSummary.holdingsCount || 0}
                </div>
                <div className="text-sm text-muted-foreground">Holdings</div>
              </div>
              <div className="text-center">
                <div className={`text-2xl font-bold ${portfolioSummary.performance?.totalGainLossPercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {portfolioSummary.performance?.totalGainLossPercent > 0 ? '+' : ''}{portfolioSummary.performance?.totalGainLossPercent?.toFixed(2) || '0.00'}%
                </div>
                <div className="text-sm text-muted-foreground">Total Return</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <ScrollableTabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="rebalancing" data-testid="tab-rebalancing">
            <TrendingUp className="w-4 h-4 mr-2" />
            Rebalancing Recommendations
          </TabsTrigger>
          <TabsTrigger value="investment-proposal" data-testid="tab-investment-proposal">
            <Target className="w-4 h-4 mr-2" />
            Investment Proposal
          </TabsTrigger>
        </ScrollableTabsList>

        {/* Rebalancing Recommendations Tab */}
        <TabsContent value="rebalancing" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">AI Rebalancing Analysis</h3>
            <Button 
              onClick={() => refetchRebalancing()}
              disabled={rebalancingLoading}
              size="sm"
              variant="outline"
              data-testid="button-refresh-rebalancing"
            >
              {rebalancingLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Brain className="w-4 h-4 mr-2" />
                  Refresh Analysis
                </>
              )}
            </Button>
          </div>

          {rebalancingLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="animate-pulse">
                  <CardContent className="p-6">
                    <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                    <div className="h-3 bg-muted rounded w-full mb-2"></div>
                    <div className="h-3 bg-muted rounded w-2/3"></div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : rebalancingRecommendations.length > 0 ? (
            <div className="space-y-4">
              {rebalancingRecommendations.map((rec) => (
                <Card key={rec.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg mb-2">{rec.title}</CardTitle>
                        <div className="flex items-center space-x-2">
                          <Badge className={getPriorityColor(rec.priority)}>
                            {(rec.priority || 'medium').toUpperCase()} Priority
                          </Badge>
                          <Badge className={getRiskColor(rec.riskLevel)}>
                            {(rec.riskLevel || 'moderate').toUpperCase()} Risk
                          </Badge>
                          <Badge variant="outline" className="text-muted-foreground">
                            <Clock className="w-3 h-3 mr-1" />
                            {rec.timeframe}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <h4 className="font-medium text-blue-700 dark:text-blue-300 mb-2">Recommendation</h4>
                        <p className="text-muted-foreground text-sm">{rec.recommendation}</p>
                      </div>
                      
                      <div>
                        <h4 className="font-medium text-green-700 dark:text-green-300 mb-2">Reasoning</h4>
                        <p className="text-muted-foreground text-sm">{rec.reasoning}</p>
                      </div>
                      
                      <div>
                        <h4 className="font-medium text-purple-700 dark:text-purple-300 mb-2">Expected Impact</h4>
                        <p className="text-muted-foreground text-sm">{rec.expectedImpact}</p>
                      </div>
                      
                      <Separator />
                      
                      <div>
                        <h4 className="font-medium text-orange-700 dark:text-orange-300 mb-2 flex items-center">
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Action Required
                        </h4>
                        <p className="text-muted-foreground text-sm">{rec.actionRequired}</p>
                        {rec.estimatedCost && (
                          <p className="text-sm text-muted-foreground mt-1">
                            <IndianRupee className="w-3 h-3 inline mr-1" />
                            Estimated Cost: ₹{rec.estimatedCost.toLocaleString('en-IN')}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <Brain className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">No rebalancing recommendations available</p>
                <Button 
                  onClick={() => refetchRebalancing()}
                  disabled={rebalancingLoading}
                  data-testid="button-generate-recommendations"
                >
                  <Lightbulb className="w-4 h-4 mr-2" />
                  Generate AI Recommendations
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Investment Proposal Tab */}
        <TabsContent value="investment-proposal" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Target className="w-5 h-5 mr-2 text-purple-600" />
                Generate Investment Proposal
              </CardTitle>
              <CardDescription>
                Get a comprehensive AI-generated investment proposal based on your portfolio and goals
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Additional Investment Capital (₹)
                  </label>
                  <Input
                    type="number"
                    placeholder="e.g. 100000"
                    value={additionalCapital || ''}
                    onChange={(e) => setAdditionalCapital(Number(e.target.value) || 0)}
                    data-testid="input-additional-capital"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Optional: Specify additional capital you want to invest for personalized recommendations
                  </p>
                </div>
                
                <Button
                  onClick={handleGenerateProposal}
                  disabled={investmentProposalMutation.isPending}
                  className="w-full bg-purple-600 hover:bg-purple-700"
                  data-testid="button-generate-proposal"
                >
                  {investmentProposalMutation.isPending ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Generating Proposal...
                    </>
                  ) : (
                    <>
                      <Brain className="w-4 h-4 mr-2" />
                      Generate AI Investment Proposal
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Disclaimer:</strong> AI-generated recommendations are for informational purposes only and should not be considered as financial advice. Please consult with a qualified financial advisor before making investment decisions.
            </AlertDescription>
          </Alert>
        </TabsContent>
      </Tabs>
    </div>
  );
}