import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { PortfolioSummary } from "@/components/dashboard/portfolio-summary";
import { AssetAllocation } from "@/components/dashboard/asset-allocation";
import { RebalanceDashboard } from "@/components/dashboard/rebalance-dashboard";
import { RebalancingSuggestions } from "@/components/rebalancing-suggestions";
import { PiChatSummaries } from "@/components/portfolio/pi-chat-summaries";
import { CommodityTracker } from "@/components/portfolio/commodity-tracker";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEnhancedPortfolioHoldings, usePortfolioPerformance } from "@/hooks/use-portfolio";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, TrendingUp, TrendingDown, RefreshCw, Bot, Coins } from "lucide-react";

export default function Portfolio() {
  const clientId = "demo-user-1"; // Demo client ID
  const portfolioId = "demo-portfolio-1";

  const { data: enhancedHoldings, isLoading: holdingsLoading, refetch: refetchHoldings } = useEnhancedPortfolioHoldings(portfolioId);
  const { data: performance, isLoading: performanceLoading } = usePortfolioPerformance(portfolioId);
  
  const isLoading = holdingsLoading || performanceLoading;
  const totalValue = performance ? parseFloat(performance.totalCurrentValue) : 1250000;

  return (
    <div className="min-h-screen bg-finance-light" data-testid="portfolio-page">
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-24">
        
        {/* Page Header */}
        <div className="flex justify-between items-center mb-8" data-testid="portfolio-header">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Portfolio Management</h1>
            <p className="text-gray-600 mt-2">Track, analyze, and rebalance your investments with live market data</p>
            {performance && (
              <div className="flex items-center space-x-4 mt-3">
                <div className="text-sm text-gray-500">
                  Last updated: {new Date(performance.lastUpdated).toLocaleTimeString()}
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => refetchHoldings()}
                  className="flex items-center space-x-1"
                >
                  <RefreshCw className="h-3 w-3" />
                  <span>Refresh</span>
                </Button>
              </div>
            )}
          </div>
          <Button className="bg-finance-blue text-white hover:bg-blue-700" data-testid="add-investment-button">
            <Plus className="h-4 w-4 mr-2" />
            Add Investment
          </Button>
        </div>

        {/* Enhanced Portfolio with Tabs */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Portfolio Overview</TabsTrigger>
            <TabsTrigger value="pi-chat" className="flex items-center space-x-1">
              <Bot className="h-4 w-4" />
              <span>Pi Chat Insights</span>
            </TabsTrigger>
            <TabsTrigger value="commodities" className="flex items-center space-x-1">
              <Coins className="h-4 w-4" />
              <span>Commodities</span>
            </TabsTrigger>
            <TabsTrigger value="rebalance">AI Rebalancing</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-8">
            {/* Asset Class Summary */}
            {performance && performance.assetBreakdown && (
              <div className="mb-8">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Asset Class Overview</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {performance.assetBreakdown.map((asset) => (
                    <Card key={asset.assetType} className="border-l-4" style={{ borderLeftColor: asset.color }}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-600">{asset.name}</p>
                            <p className="text-xl font-bold text-gray-900">
                              ₹{asset.value.toLocaleString()}
                            </p>
                            <p className="text-xs text-gray-500">
                              {asset.percentage}% of portfolio
                            </p>
                          </div>
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: asset.color }}
                          />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

        {/* Portfolio Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8" data-testid="portfolio-overview">
          <div className="lg:col-span-2">
            {/* Holdings Table */}
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Portfolio Holdings by Asset Class</CardTitle>
                  {enhancedHoldings && (
                    <div className="text-sm text-gray-500">
                      {enhancedHoldings.length} total holdings
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-4">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="flex justify-between items-center p-4 border-b">
                        <div>
                          <Skeleton className="h-4 w-24 mb-2" />
                          <Skeleton className="h-3 w-16" />
                        </div>
                        <div className="text-right">
                          <Skeleton className="h-4 w-20 mb-2" />
                          <Skeleton className="h-3 w-16" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : enhancedHoldings && enhancedHoldings.length > 0 ? (
                  <div className="space-y-6" data-testid="holdings-list">
                    {/* Group holdings by asset class */}
                    {Object.entries(
                      enhancedHoldings.reduce((groups, holding) => {
                        const assetType = holding.assetType;
                        if (!groups[assetType]) {
                          groups[assetType] = [];
                        }
                        groups[assetType].push(holding);
                        return groups;
                      }, {} as Record<string, typeof enhancedHoldings>)
                    ).map(([assetType, holdings]) => {
                      // Calculate summary for this asset class
                      const totalInvested = holdings.reduce((sum, h) => sum + parseFloat(h.investedValue), 0);
                      const totalCurrent = holdings.reduce((sum, h) => sum + parseFloat(h.currentValue), 0);
                      const totalGainLoss = totalCurrent - totalInvested;
                      const totalGainLossPercent = (totalGainLoss / totalInvested) * 100;
                      const assetTypeLabel = assetType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
                      
                      return (
                        <div key={assetType} className="bg-gray-50 rounded-lg p-4">
                          {/* Asset Class Header */}
                          <div className="flex justify-between items-center mb-4 pb-3 border-b border-gray-200">
                            <div>
                              <h3 className="text-lg font-semibold text-gray-900 capitalize">
                                {assetTypeLabel}
                              </h3>
                              <p className="text-sm text-gray-600">
                                {holdings.length} holding{holdings.length !== 1 ? 's' : ''}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-lg font-bold text-gray-900">
                                ₹{totalCurrent.toLocaleString()}
                              </p>
                              <div className={`text-sm flex items-center justify-end ${totalGainLoss >= 0 ? 'text-finance-green' : 'text-finance-red'}`}>
                                {totalGainLoss >= 0 ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
                                {totalGainLoss >= 0 ? '+' : ''}₹{totalGainLoss.toFixed(2)} ({totalGainLossPercent.toFixed(2)}%)
                              </div>
                            </div>
                          </div>

                          {/* Holdings in this asset class */}
                          <div className="space-y-3">
                            {holdings.map((holding) => {
                              const gainLoss = parseFloat(holding.gainLoss);
                              const gainLossPercent = parseFloat(holding.gainLossPercent);
                              const dayChange = parseFloat(holding.dayChange);
                              const dayChangePercent = parseFloat(holding.dayChangePercent);

                              return (
                                <div 
                                  key={holding.id} 
                                  className="flex justify-between items-center p-3 bg-white rounded-md hover:bg-gray-50 transition-colors"
                                  data-testid={`holding-${holding.symbol}`}
                                >
                                  <div className="flex-1">
                                    <div className="flex items-center space-x-2">
                                      <h4 className="font-semibold text-gray-900">{holding.symbol}</h4>
                                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                                        {holding.exchange}
                                      </span>
                                    </div>
                                    <p className="text-sm text-gray-600">
                                      Qty: {holding.quantity} | Avg: ₹{holding.avgPrice} | Current: ₹{holding.currentPrice}
                                    </p>
                                  </div>
                                  <div className="text-right space-y-1">
                                    <p className="font-bold text-gray-900">₹{parseFloat(holding.currentValue).toLocaleString()}</p>
                                    <div className={`text-sm flex items-center justify-end ${gainLoss >= 0 ? 'text-finance-green' : 'text-finance-red'}`}>
                                      {gainLoss >= 0 ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
                                      {gainLoss >= 0 ? '+' : ''}₹{gainLoss.toFixed(2)} ({gainLossPercent.toFixed(2)}%)
                                    </div>
                                    {Math.abs(dayChange) > 0 && (
                                      <div className={`text-xs flex items-center justify-end ${dayChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                        Day: {dayChange >= 0 ? '+' : ''}₹{dayChange.toFixed(2)} ({dayChangePercent.toFixed(2)}%)
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8" data-testid="empty-holdings">
                    <p className="text-gray-500 mb-4">No holdings found</p>
                    <Button variant="outline">Add Your First Investment</Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
          
          <PortfolioSummary userId={userId} />
        </div>

          </TabsContent>

          <TabsContent value="pi-chat" className="space-y-8">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
              <PiChatSummaries portfolioId={portfolioId} />
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Bot className="h-5 w-5 text-blue-600" />
                      <span>AI Portfolio Analysis</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="p-4 bg-blue-50 rounded-lg">
                        <div className="font-medium text-blue-900 mb-2">Overall Portfolio Health</div>
                        <div className="text-sm text-blue-700">
                          Your portfolio shows strong diversification with good risk-adjusted returns. 
                          Consider the commodity allocation recommendations for better inflation protection.
                        </div>
                      </div>
                      <div className="p-4 bg-green-50 rounded-lg">
                        <div className="font-medium text-green-900 mb-2">Performance Score</div>
                        <div className="text-sm text-green-700">
                          <span className="text-2xl font-bold">8.2/10</span> - Excellent performance 
                          with balanced risk exposure across asset classes.
                        </div>
                      </div>
                      <div className="p-4 bg-yellow-50 rounded-lg">
                        <div className="font-medium text-yellow-900 mb-2">Next Actions</div>
                        <div className="text-sm text-yellow-700">
                          Review commodity exposure and consider rebalancing equity allocation 
                          for optimal yield generation.
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <RebalancingSuggestions portfolioId={portfolioId} />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="commodities" className="space-y-8">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
              <CommodityTracker className="xl:col-span-1" />
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Coins className="h-5 w-5 text-yellow-600" />
                      <span>Commodity Portfolio Impact</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="p-4 bg-yellow-50 rounded-lg">
                        <div className="font-medium text-yellow-900 mb-2">Current Allocation</div>
                        <div className="text-sm text-yellow-700">
                          10% of your portfolio (₹1,34,785) is allocated to commodities, 
                          providing good inflation protection.
                        </div>
                      </div>
                      <div className="p-4 bg-orange-50 rounded-lg">
                        <div className="font-medium text-orange-900 mb-2">Diversification Benefits</div>
                        <div className="text-sm text-orange-700">
                          Commodity exposure reduces portfolio correlation and provides 
                          hedge against economic uncertainty.
                        </div>
                      </div>
                      <div className="p-4 bg-green-50 rounded-lg">
                        <div className="font-medium text-green-900 mb-2">Performance</div>
                        <div className="text-sm text-green-700">
                          +1.75% today • Outperforming broader market with gold and silver gains.
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <AssetAllocation portfolioId={portfolioId} />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="rebalance" className="space-y-8">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
              <RebalancingSuggestions portfolioId={portfolioId} />
              <RebalanceDashboard portfolioId={portfolioId} totalValue={totalValue} />
            </div>
          </TabsContent>
        </Tabs>

      </main>

      <Footer />
    </div>
  );
}
