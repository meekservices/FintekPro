import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, TrendingUp, TrendingDown, Activity, Shield as LucideShield, Target, Brain } from "lucide-react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { LoadingState } from "@/components/LoadingState";
import { useToast } from "@/hooks/use-toast";

export default function PredictiveAnalytics() {
  const [selectedPortfolio, setSelectedPortfolio] = useState<string>("");
  const [selectedHorizon, setSelectedHorizon] = useState<string>("1Y");
  const { toast } = useToast();

  // Fetch user portfolios
  const { data: portfolios, isLoading: portfoliosLoading } = useQuery<any[]>({
    queryKey: ["/api/portfolios"],
  });

  // Fetch predictions
  const { data: predictions, isLoading: predictionsLoading } = useQuery<any[]>({
    queryKey: ["/api/analytics/predictions", selectedPortfolio],
    enabled: !!selectedPortfolio,
  });

  // Fetch risk analysis
  const { data: riskAnalysis, isLoading: riskLoading } = useQuery<any[]>({
    queryKey: ["/api/analytics/risk", selectedPortfolio],
    enabled: !!selectedPortfolio,
  });

  // Fetch asset forecasts
  const { data: forecasts, isLoading: forecastsLoading } = useQuery<any[]>({
    queryKey: ["/api/analytics/forecasts"],
    enabled: !!selectedPortfolio,
  });

  // Generate predictions mutation
  const generatePredictions = useMutation({
    mutationFn: async (data: { portfolioId: string; horizon: string }) =>
      apiRequest("/api/analytics/generate-predictions", "POST", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/predictions"] });
      toast({
        title: "Success",
        description: "Portfolio predictions generated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to generate predictions",
        variant: "destructive",
      });
    },
  });

  // Generate risk analysis mutation
  const generateRiskAnalysis = useMutation({
    mutationFn: async (portfolioId: string) =>
      apiRequest("/api/analytics/generate-risk-analysis", "POST", { portfolioId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/risk"] });
      toast({
        title: "Success",
        description: "Risk analysis generated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to generate risk analysis",
        variant: "destructive",
      });
    },
  });

  const latestPrediction = predictions && predictions.length > 0 ? predictions[0] : null;
  const latestRisk = riskAnalysis && riskAnalysis.length > 0 ? riskAnalysis[0] : null;

  if (portfoliosLoading) {
    return <LoadingState message="Loading portfolios..." />;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Brain className="h-8 w-8 text-primary" />
            Predictive Analytics
          </h1>
          <p className="text-muted-foreground mt-1">
            AI-powered investment forecasting and risk analysis
          </p>
        </div>
      </div>

      {/* Portfolio Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Select Portfolio</CardTitle>
          <CardDescription>Choose a portfolio to analyze and generate predictions</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <Select value={selectedPortfolio} onValueChange={setSelectedPortfolio}>
              <SelectTrigger className="w-64" data-testid="select-portfolio">
                <SelectValue placeholder="Select portfolio" />
              </SelectTrigger>
              <SelectContent>
                {portfolios?.map((portfolio: any) => (
                  <SelectItem key={portfolio.id} value={portfolio.id}>
                    {portfolio.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedHorizon} onValueChange={setSelectedHorizon}>
              <SelectTrigger className="w-40" data-testid="select-horizon">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1M">1 Month</SelectItem>
                <SelectItem value="3M">3 Months</SelectItem>
                <SelectItem value="6M">6 Months</SelectItem>
                <SelectItem value="1Y">1 Year</SelectItem>
                <SelectItem value="3Y">3 Years</SelectItem>
                <SelectItem value="5Y">5 Years</SelectItem>
              </SelectContent>
            </Select>

            <Button
              onClick={() => generatePredictions.mutate({ portfolioId: selectedPortfolio, horizon: selectedHorizon })}
              disabled={!selectedPortfolio || generatePredictions.isPending}
              data-testid="button-generate-predictions"
            >
              <Target className="mr-2 h-4 w-4" />
              {generatePredictions.isPending ? "Generating..." : "Generate Predictions"}
            </Button>

            <Button
              variant="outline"
              onClick={() => generateRiskAnalysis.mutate(selectedPortfolio)}
              disabled={!selectedPortfolio || generateRiskAnalysis.isPending}
              data-testid="button-generate-risk"
            >
              <LucideShield className="mr-2 h-4 w-4" />
              {generateRiskAnalysis.isPending ? "Analyzing..." : "Analyze Risk"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {selectedPortfolio && (
        <Tabs defaultValue="predictions" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="predictions">Performance Predictions</TabsTrigger>
            <TabsTrigger value="risk">Risk Analysis</TabsTrigger>
            <TabsTrigger value="forecasts">Asset Forecasts</TabsTrigger>
          </TabsList>

          {/* Performance Predictions Tab */}
          <TabsContent value="predictions" className="space-y-4">
            {predictionsLoading ? (
              <LoadingState message="Loading predictions..." />
            ) : latestPrediction ? (
              <>
                {/* Key Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>Expected Return</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold flex items-center gap-2">
                        {parseFloat(latestPrediction.expectedReturn) >= 0 ? (
                          <TrendingUp className="h-5 w-5 text-green-500" />
                        ) : (
                          <TrendingDown className="h-5 w-5 text-red-500" />
                        )}
                        {parseFloat(latestPrediction.expectedReturn).toFixed(2)}%
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {latestPrediction.predictionHorizon} horizon
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>Expected Value</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        ₹{parseFloat(latestPrediction.expectedValue).toLocaleString('en-IN')}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Range: ₹{parseFloat(latestPrediction.lowerBound).toLocaleString('en-IN')} - ₹{parseFloat(latestPrediction.upperBound).toLocaleString('en-IN')}
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>Volatility</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {(parseFloat(latestPrediction.volatility) * 100).toFixed(2)}%
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Sharpe Ratio: {parseFloat(latestPrediction.sharpeRatio).toFixed(2)}
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>Trend</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            latestPrediction.trendDirection === 'bullish'
                              ? 'default'
                              : latestPrediction.trendDirection === 'bearish'
                              ? 'destructive'
                              : 'secondary'
                          }
                        >
                          {latestPrediction.trendDirection}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Strength: {parseFloat(latestPrediction.trendStrength).toFixed(0)}/100
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Technical Indicators */}
                <Card>
                  <CardHeader>
                    <CardTitle>Technical Indicators</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">CAGR</p>
                        <p className="text-lg font-semibold">{parseFloat(latestPrediction.cagr).toFixed(2)}%</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">RSI</p>
                        <p className="text-lg font-semibold">
                          {parseFloat(latestPrediction.rsi).toFixed(0)}
                          <span className="text-xs ml-1">
                            {parseFloat(latestPrediction.rsi) > 70 ? '(Overbought)' : parseFloat(latestPrediction.rsi) < 30 ? '(Oversold)' : ''}
                          </span>
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Beta</p>
                        <p className="text-lg font-semibold">{parseFloat(latestPrediction.beta).toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Confidence</p>
                        <p className="text-lg font-semibold">{parseFloat(latestPrediction.confidenceScore).toFixed(0)}%</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Risk Metrics */}
                <Card>
                  <CardHeader>
                    <CardTitle>Risk Metrics</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Value at Risk (VaR)</p>
                        <p className="text-lg font-semibold">₹{parseFloat(latestPrediction.varValue).toLocaleString('en-IN')}</p>
                        <p className="text-xs text-muted-foreground">95% confidence, 1-day</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Maximum Drawdown</p>
                        <p className="text-lg font-semibold text-red-500">{parseFloat(latestPrediction.maxDrawdown).toFixed(2)}%</p>
                        <p className="text-xs text-muted-foreground">Expected worst-case scenario</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card>
                <CardContent className="text-center py-12">
                  <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    No predictions available. Generate predictions to see portfolio forecasts.
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Risk Analysis Tab */}
          <TabsContent value="risk" className="space-y-4">
            {riskLoading ? (
              <LoadingState message="Loading risk analysis..." />
            ) : latestRisk ? (
              <>
                {/* Overall Risk Score */}
                <Card>
                  <CardHeader>
                    <CardTitle>Overall Risk Assessment</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-4xl font-bold">{parseFloat(latestRisk.overallRiskScore).toFixed(0)}</p>
                        <p className="text-sm text-muted-foreground">out of 100</p>
                      </div>
                      <Badge
                        variant={
                          latestRisk.riskCategory === 'conservative'
                            ? 'default'
                            : latestRisk.riskCategory === 'aggressive'
                            ? 'destructive'
                            : 'secondary'
                        }
                        className="text-lg px-4 py-2"
                      >
                        {latestRisk.riskCategory}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>

                {/* Diversification Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>Diversification Score</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-green-600">
                        {parseFloat(latestRisk.diversificationScore).toFixed(0)}/100
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>Concentration Risk</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-orange-600">
                        {parseFloat(latestRisk.concentrationRisk).toFixed(0)}%
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>Correlation Risk</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {parseFloat(latestRisk.correlationRisk).toFixed(0)}%
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Stress Test Scenarios */}
                <Card>
                  <CardHeader>
                    <CardTitle>Stress Test Scenarios</CardTitle>
                    <CardDescription>Impact on your portfolio under various market conditions</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {latestRisk.marketCrashScenario && (
                        <div className="border-l-4 border-red-500 pl-4">
                          <h4 className="font-semibold">{latestRisk.marketCrashScenario.scenario}</h4>
                          <p className="text-sm text-muted-foreground">
                            Impact: <span className="text-red-600 font-semibold">₹{parseFloat(latestRisk.marketCrashScenario.impactOnPortfolio).toLocaleString('en-IN')}</span>
                          </p>
                          <p className="text-sm text-muted-foreground">
                            New Value: ₹{parseFloat(latestRisk.marketCrashScenario.newValue).toLocaleString('en-IN')}
                          </p>
                          <p className="text-xs text-muted-foreground">Recovery Time: {latestRisk.marketCrashScenario.recoveryTime}</p>
                        </div>
                      )}

                      {latestRisk.recessionScenario && (
                        <div className="border-l-4 border-orange-500 pl-4">
                          <h4 className="font-semibold">{latestRisk.recessionScenario.scenario}</h4>
                          <p className="text-sm text-muted-foreground">
                            Impact: <span className="text-orange-600 font-semibold">₹{parseFloat(latestRisk.recessionScenario.impactOnPortfolio).toLocaleString('en-IN')}</span>
                          </p>
                          <p className="text-sm text-muted-foreground">
                            New Value: ₹{parseFloat(latestRisk.recessionScenario.newValue).toLocaleString('en-IN')}
                          </p>
                        </div>
                      )}

                      {latestRisk.interestRateRise && (
                        <div className="border-l-4 border-yellow-500 pl-4">
                          <h4 className="font-semibold">{latestRisk.interestRateRise.scenario}</h4>
                          <p className="text-sm text-muted-foreground">
                            Impact: <span className="text-yellow-600 font-semibold">₹{parseFloat(latestRisk.interestRateRise.impactOnPortfolio).toLocaleString('en-IN')}</span>
                          </p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Value at Risk */}
                <Card>
                  <CardHeader>
                    <CardTitle>Value at Risk (VaR)</CardTitle>
                    <CardDescription>Maximum expected loss at 95% confidence</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">1 Day</p>
                        <p className="text-lg font-semibold">₹{parseFloat(latestRisk.var1Day).toLocaleString('en-IN')}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">1 Week</p>
                        <p className="text-lg font-semibold">₹{parseFloat(latestRisk.var1Week).toLocaleString('en-IN')}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">1 Month</p>
                        <p className="text-lg font-semibold">₹{parseFloat(latestRisk.var1Month).toLocaleString('en-IN')}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Recommendations */}
                {latestRisk.riskMitigationSuggestions && latestRisk.riskMitigationSuggestions.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Risk Mitigation Recommendations</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {latestRisk.riskMitigationSuggestions.map((suggestion: any, index: number) => (
                          <div key={index} className="flex items-start gap-2">
                            <AlertCircle className="h-4 w-4 mt-0.5 text-muted-foreground" />
                            <div>
                              <p className="text-sm">{suggestion.suggestion}</p>
                              <Badge variant="outline" className="text-xs mt-1">
                                {suggestion.priority} priority
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            ) : (
              <Card>
                <CardContent className="text-center py-12">
                  <LucideShield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    No risk analysis available. Generate risk analysis to see portfolio risk metrics.
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Asset Forecasts Tab */}
          <TabsContent value="forecasts" className="space-y-4">
            {forecastsLoading ? (
              <LoadingState message="Loading forecasts..." />
            ) : forecasts && forecasts.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {forecasts.map((forecast: any) => (
                  <Card key={forecast.id}>
                    <CardHeader>
                      <CardTitle>{forecast.symbol}</CardTitle>
                      <CardDescription>{forecast.assetType}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Current Price</span>
                        <span className="font-semibold">₹{parseFloat(forecast.currentPrice).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Predicted Price</span>
                        <span className="font-semibold">₹{parseFloat(forecast.predictedPrice).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Expected Change</span>
                        <span className={`font-semibold ${parseFloat(forecast.priceChange) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {parseFloat(forecast.priceChange).toFixed(2)}%
                        </span>
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t">
                        <Badge
                          variant={
                            forecast.recommendation === 'strong_buy' || forecast.recommendation === 'buy'
                              ? 'default'
                              : forecast.recommendation === 'strong_sell' || forecast.recommendation === 'sell'
                              ? 'destructive'
                              : 'secondary'
                          }
                        >
                          {forecast.recommendation.replace('_', ' ')}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {parseFloat(forecast.confidenceLevel).toFixed(0)}% confidence
                        </span>
                      </div>
                      {forecast.recommendationReason && (
                        <p className="text-xs text-muted-foreground pt-2 border-t">
                          {forecast.recommendationReason}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="text-center py-12">
                  <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    No asset forecasts available yet.
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
