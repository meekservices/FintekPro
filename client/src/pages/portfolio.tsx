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
import { Plus, TrendingUp, TrendingDown, RefreshCw, Bot, Coins, CreditCard, PiggyBank } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

export default function Portfolio() {
  // Get authenticated user data
  const { data: user } = useQuery({ queryKey: ["/api/user"], retry: false });
  const clientId = user?.id || "demo-user-1";
  const portfolioId = `portfolio-${clientId}`;

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
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="overview">Portfolio Overview</TabsTrigger>
            <TabsTrigger value="pi-chat" className="flex items-center space-x-1">
              <Bot className="h-4 w-4" />
              <span>Pi Chat Insights</span>
            </TabsTrigger>
            <TabsTrigger value="commodities" className="flex items-center space-x-1">
              <Coins className="h-4 w-4" />
              <span>Commodities</span>
            </TabsTrigger>
            <TabsTrigger value="epf" className="flex items-center space-x-1">
              <CreditCard className="h-4 w-4" />
              <span>EPF Holdings</span>
            </TabsTrigger>
            <TabsTrigger value="ppf" className="flex items-center space-x-1">
              <PiggyBank className="h-4 w-4" />
              <span>PPF Holdings</span>
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
          
          <PortfolioSummary userId={clientId} />
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

          <TabsContent value="epf" className="space-y-8">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
              {/* EPF Account Overview */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center space-x-2">
                      <CreditCard className="h-5 w-5 text-blue-600" />
                      <span>EPF Account Summary</span>
                    </CardTitle>
                    <Badge variant="outline" className="text-green-600 border-green-600">Active</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {/* Account Details */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Account Number</p>
                        <p className="font-medium">KN/DEL/12345/67890</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Employer</p>
                        <p className="font-medium">Tech Solutions Pvt Ltd</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Date of Joining</p>
                        <p className="font-medium">15-Jan-2020</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Interest Rate</p>
                        <p className="font-medium text-green-600">8.15%</p>
                      </div>
                    </div>

                    {/* Balance Breakdown */}
                    <div className="space-y-4">
                      <h4 className="font-semibold text-gray-900">Balance Breakdown</h4>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                          <span className="text-sm font-medium text-blue-900">Employee Contribution</span>
                          <span className="font-bold text-blue-900">₹4,82,350</span>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                          <span className="text-sm font-medium text-green-900">Employer Contribution</span>
                          <span className="font-bold text-green-900">₹4,82,350</span>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-purple-50 rounded-lg">
                          <span className="text-sm font-medium text-purple-900">Pension Fund (EPS)</span>
                          <span className="font-bold text-purple-900">₹1,45,620</span>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-orange-50 rounded-lg">
                          <span className="text-sm font-medium text-orange-900">Interest Earned</span>
                          <span className="font-bold text-orange-900">₹1,23,480</span>
                        </div>
                      </div>
                    </div>

                    {/* Total Balance */}
                    <div className="pt-4 border-t">
                      <div className="flex justify-between items-center">
                        <span className="text-lg font-semibold text-gray-900">Total EPF Balance</span>
                        <span className="text-2xl font-bold text-green-600">₹12,33,800</span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        As of {new Date().toLocaleDateString('en-IN')}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* EPF Performance & Growth */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <TrendingUp className="h-5 w-5 text-green-600" />
                    <span>EPF Performance & Growth</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {/* Monthly Contribution */}
                    <div className="space-y-3">
                      <h4 className="font-semibold text-gray-900">Monthly Contribution</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 bg-gray-50 rounded-lg">
                          <p className="text-sm text-muted-foreground">Employee (12%)</p>
                          <p className="text-lg font-bold text-gray-900">₹7,200</p>
                        </div>
                        <div className="p-3 bg-gray-50 rounded-lg">
                          <p className="text-sm text-muted-foreground">Employer (12%)</p>
                          <p className="text-lg font-bold text-gray-900">₹7,200</p>
                        </div>
                      </div>
                      <div className="p-3 bg-green-50 rounded-lg">
                        <p className="text-sm text-muted-foreground">Total Monthly Addition</p>
                        <p className="text-xl font-bold text-green-600">₹14,400</p>
                      </div>
                    </div>

                    {/* Growth Statistics */}
                    <div className="space-y-3">
                      <h4 className="font-semibold text-gray-900">Growth Statistics</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Current Year Interest</span>
                          <span className="font-medium text-green-600">₹45,280</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">5-Year Growth</span>
                          <span className="font-medium text-green-600">+89.4%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Annual Average Growth</span>
                          <span className="font-medium text-green-600">8.12%</span>
                        </div>
                      </div>
                    </div>

                    {/* Withdrawal Options */}
                    <div className="space-y-3">
                      <h4 className="font-semibold text-gray-900">Withdrawal Information</h4>
                      <div className="space-y-2">
                        <div className="p-3 bg-yellow-50 rounded-lg">
                          <p className="text-sm font-medium text-yellow-900">Partial Withdrawal</p>
                          <p className="text-xs text-yellow-700">Available after 5 years for specific purposes</p>
                        </div>
                        <div className="p-3 bg-blue-50 rounded-lg">
                          <p className="text-sm font-medium text-blue-900">Full Withdrawal</p>
                          <p className="text-xs text-blue-700">Available after employment termination or retirement</p>
                        </div>
                      </div>
                    </div>

                    {/* Nominee Details */}
                    <div className="space-y-3">
                      <h4 className="font-semibold text-gray-900">Nominee Details</h4>
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <p className="text-sm text-muted-foreground">Name</p>
                            <p className="font-medium">Priya Sharma</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Relationship</p>
                            <p className="font-medium">Spouse</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* EPF Portfolio Integration */}
              <Card className="xl:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <CreditCard className="h-5 w-5 text-purple-600" />
                    <span>EPF in Your Overall Portfolio</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Portfolio Contribution */}
                    <div className="space-y-3">
                      <h4 className="font-semibold text-gray-900">Portfolio Weight</h4>
                      <div className="text-center">
                        <div className="text-3xl font-bold text-purple-600">8.9%</div>
                        <p className="text-sm text-muted-foreground">of total wealth</p>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div className="bg-purple-600 h-2 rounded-full" style={{ width: '8.9%' }}></div>
                      </div>
                    </div>

                    {/* Risk Profile */}
                    <div className="space-y-3">
                      <h4 className="font-semibold text-gray-900">Risk Profile</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm">Risk Level</span>
                          <Badge variant="outline" className="text-green-600 border-green-600">Low</Badge>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm">Volatility</span>
                          <span className="text-sm font-medium">Very Low</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm">Liquidity</span>
                          <Badge variant="outline" className="text-yellow-600 border-yellow-600">Restricted</Badge>
                        </div>
                      </div>
                    </div>

                    {/* Retirement Planning */}
                    <div className="space-y-3">
                      <h4 className="font-semibold text-gray-900">Retirement Impact</h4>
                      <div className="space-y-2">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-blue-600">₹85.2L</div>
                          <p className="text-sm text-muted-foreground">Projected at 60</p>
                        </div>
                        <div className="text-xs text-gray-600">
                          Based on current contributions and 8.15% annual growth
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-4 mt-6 pt-4 border-t">
                    <Button variant="outline" size="sm">
                      View Passbook
                    </Button>
                    <Button variant="outline" size="sm">
                      Download Statement
                    </Button>
                    <Button variant="outline" size="sm">
                      Update Nominee
                    </Button>
                    <Button variant="outline" size="sm">
                      Check Claim Status
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="ppf" className="space-y-8">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
              {/* PPF Account Overview */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center space-x-2">
                      <PiggyBank className="h-5 w-5 text-purple-600" />
                      <span>PPF Account Summary</span>
                    </CardTitle>
                    <Badge variant="outline" className="text-green-600 border-green-600">Active</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {/* Account Details */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Account Number</p>
                        <p className="font-medium">PPF-SBI-12345678</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Bank & Branch</p>
                        <p className="font-medium">SBI - Connaught Place</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Account Opening Date</p>
                        <p className="font-medium">01-Apr-2015</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Maturity Date</p>
                        <p className="font-medium text-blue-600">01-Apr-2030</p>
                      </div>
                    </div>

                    {/* Current Status */}
                    <div className="space-y-4">
                      <h4 className="font-semibold text-gray-900">Current Status & Timeline</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 bg-blue-50 rounded-lg">
                          <p className="text-sm text-muted-foreground">Years Completed</p>
                          <p className="text-2xl font-bold text-blue-600">9</p>
                          <p className="text-xs text-blue-600">6 years remaining</p>
                        </div>
                        <div className="p-3 bg-green-50 rounded-lg">
                          <p className="text-sm text-muted-foreground">Interest Rate (2024-25)</p>
                          <p className="text-2xl font-bold text-green-600">8.2%</p>
                          <p className="text-xs text-green-600">Tax-free returns</p>
                        </div>
                      </div>
                    </div>

                    {/* Balance Summary */}
                    <div className="space-y-4">
                      <h4 className="font-semibold text-gray-900">Balance Summary</h4>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center p-3 bg-purple-50 rounded-lg">
                          <span className="text-sm font-medium text-purple-900">Total Contribution</span>
                          <span className="font-bold text-purple-900">₹11,50,000</span>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-orange-50 rounded-lg">
                          <span className="text-sm font-medium text-orange-900">Interest Earned</span>
                          <span className="font-bold text-orange-900">₹7,85,240</span>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                          <span className="text-sm font-medium text-green-900">Current Balance</span>
                          <span className="font-bold text-green-900">₹19,35,240</span>
                        </div>
                      </div>
                    </div>

                    {/* Maturity Projection */}
                    <div className="pt-4 border-t">
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-lg font-semibold text-gray-900">Projected Maturity Value</span>
                          <span className="text-2xl font-bold text-purple-600">₹42.8L</span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Based on ₹1.5L annual contribution and 8.2% average return
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* PPF Contribution & Benefits */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <TrendingUp className="h-5 w-5 text-green-600" />
                    <span>Contribution & Benefits</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {/* This Year's Contribution */}
                    <div className="space-y-3">
                      <h4 className="font-semibold text-gray-900">FY 2024-25 Contribution</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 bg-gray-50 rounded-lg">
                          <p className="text-sm text-muted-foreground">Contributed So Far</p>
                          <p className="text-lg font-bold text-gray-900">₹1,20,000</p>
                        </div>
                        <div className="p-3 bg-orange-50 rounded-lg">
                          <p className="text-sm text-muted-foreground">Remaining Limit</p>
                          <p className="text-lg font-bold text-orange-600">₹30,000</p>
                        </div>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div className="bg-green-500 h-2 rounded-full" style={{ width: '80%' }}></div>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        80% of annual limit utilized (₹1.5L max per year)
                      </p>
                    </div>

                    {/* Tax Benefits */}
                    <div className="space-y-3">
                      <h4 className="font-semibold text-gray-900">Tax Benefits</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center p-2 bg-green-50 rounded">
                          <span className="text-sm">Section 80C Deduction</span>
                          <span className="font-medium text-green-600">₹1,20,000</span>
                        </div>
                        <div className="flex justify-between items-center p-2 bg-blue-50 rounded">
                          <span className="text-sm">Tax Saved (30% bracket)</span>
                          <span className="font-medium text-blue-600">₹36,000</span>
                        </div>
                        <div className="flex justify-between items-center p-2 bg-purple-50 rounded">
                          <span className="text-sm">Interest & Maturity</span>
                          <span className="font-medium text-purple-600">Tax-Free</span>
                        </div>
                      </div>
                    </div>

                    {/* Available Features */}
                    <div className="space-y-3">
                      <h4 className="font-semibold text-gray-900">Available Features</h4>
                      <div className="space-y-2">
                        <div className="p-3 bg-green-50 rounded-lg border-l-4 border-green-500">
                          <p className="text-sm font-medium text-green-900">✓ Loan Available</p>
                          <p className="text-xs text-green-700">
                            Up to ₹3.87L (20% of balance) - From 3rd year onwards
                          </p>
                        </div>
                        <div className="p-3 bg-blue-50 rounded-lg border-l-4 border-blue-500">
                          <p className="text-sm font-medium text-blue-900">✓ Partial Withdrawal</p>
                          <p className="text-xs text-blue-700">
                            Up to ₹9.67L (50% of balance) - From 7th year onwards
                          </p>
                        </div>
                        <div className="p-3 bg-yellow-50 rounded-lg border-l-4 border-yellow-500">
                          <p className="text-sm font-medium text-yellow-900">⏳ Extension Option</p>
                          <p className="text-xs text-yellow-700">
                            Available after maturity - 5-year blocks without contribution
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Nominee Information */}
                    <div className="space-y-3">
                      <h4 className="font-semibold text-gray-900">Nominee Details</h4>
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <p className="text-sm text-muted-foreground">Name</p>
                            <p className="font-medium">Rajesh Kumar</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Relationship</p>
                            <p className="font-medium">Father</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* PPF Portfolio Integration & Analytics */}
              <Card className="xl:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <PiggyBank className="h-5 w-5 text-purple-600" />
                    <span>PPF in Your Investment Portfolio</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    {/* Portfolio Contribution */}
                    <div className="space-y-3">
                      <h4 className="font-semibold text-gray-900">Portfolio Weight</h4>
                      <div className="text-center">
                        <div className="text-3xl font-bold text-purple-600">14.2%</div>
                        <p className="text-sm text-muted-foreground">of total wealth</p>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div className="bg-purple-600 h-2 rounded-full" style={{ width: '14.2%' }}></div>
                      </div>
                    </div>

                    {/* Risk Profile */}
                    <div className="space-y-3">
                      <h4 className="font-semibold text-gray-900">Risk & Returns</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm">Risk Level</span>
                          <Badge variant="outline" className="text-green-600 border-green-600">Zero Risk</Badge>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm">Current Return</span>
                          <span className="text-sm font-medium text-green-600">8.2%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm">Tax Status</span>
                          <Badge variant="outline" className="text-blue-600 border-blue-600">EEE</Badge>
                        </div>
                      </div>
                    </div>

                    {/* Liquidity Status */}
                    <div className="space-y-3">
                      <h4 className="font-semibold text-gray-900">Liquidity</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm">Lock-in Period</span>
                          <span className="text-sm font-medium">15 years</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm">Loan Access</span>
                          <Badge variant="outline" className="text-green-600 border-green-600">Available</Badge>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm">Partial Withdrawal</span>
                          <Badge variant="outline" className="text-green-600 border-green-600">Available</Badge>
                        </div>
                      </div>
                    </div>

                    {/* Retirement Planning Impact */}
                    <div className="space-y-3">
                      <h4 className="font-semibold text-gray-900">Retirement Impact</h4>
                      <div className="space-y-2">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-purple-600">₹42.8L</div>
                          <p className="text-sm text-muted-foreground">At maturity (2030)</p>
                        </div>
                        <div className="text-xs text-gray-600 text-center">
                          Provides stable, tax-free retirement corpus
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Yearly Contribution History Chart Placeholder */}
                  <div className="mt-6 pt-6 border-t">
                    <h4 className="font-semibold text-gray-900 mb-4">9-Year Contribution & Growth History</h4>
                    <div className="grid grid-cols-9 gap-2">
                      {Array.from({ length: 9 }, (_, i) => (
                        <div key={i} className="text-center">
                          <div className="bg-purple-100 rounded-lg p-2 mb-2">
                            <div className="text-xs text-muted-foreground">FY {2016 + i}</div>
                            <div className="text-sm font-bold text-purple-600">₹{1.5 - (Math.random() * 0.3)}L</div>
                          </div>
                          <div className="bg-purple-600 mx-auto rounded" 
                               style={{ 
                                 width: '100%', 
                                 height: `${20 + i * 8}px` 
                               }}>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-4 mt-6 pt-4 border-t">
                    <Button variant="outline" size="sm">
                      View Passbook
                    </Button>
                    <Button variant="outline" size="sm">
                      Make Contribution
                    </Button>
                    <Button variant="outline" size="sm">
                      Apply for Loan
                    </Button>
                    <Button variant="outline" size="sm">
                      Download Statement
                    </Button>
                    <Button variant="outline" size="sm">
                      Update Nominee
                    </Button>
                  </div>
                </CardContent>
              </Card>
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
