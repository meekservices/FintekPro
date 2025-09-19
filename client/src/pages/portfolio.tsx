import { EnhancedNavigation } from "@/components/layout/enhanced-navigation";
import { Footer } from "@/components/layout/footer";
import { PortfolioSummary } from "@/components/dashboard/portfolio-summary";
import { AssetAllocation } from "@/components/dashboard/asset-allocation";
import { RebalanceDashboard } from "@/components/dashboard/rebalance-dashboard";
import { RebalancingSuggestions } from "@/components/rebalancing-suggestions";
import { PiChatSummaries } from "@/components/portfolio/pi-chat-summaries";
import { CommodityTracker } from "@/components/portfolio/commodity-tracker";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePortfoliosByPan, useEnhancedPortfolioHoldings, usePortfolioPerformance, useEpfHoldings, usePpfHoldings, useEpsHoldings, useInsuranceHoldings } from "@/hooks/use-portfolio";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, TrendingUp, TrendingDown, RefreshCw, Bot, Coins, CreditCard, PiggyBank, Shield, Target, Calculator, AlertTriangle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { useConsent, type SchemeType } from "@/hooks/use-consent";
import { ConsentDialog } from "@/components/ConsentDialog";
import { ConsentAwareSchemeTab } from "@/components/ConsentAwareSchemeTab";
import { useAuth } from "@/hooks/useAuth";

export default function Portfolio() {
  // Navigation state for responsive layout
  const [isNavCollapsed, setIsNavCollapsed] = useState(() => {
    try {
      const saved = localStorage.getItem('navigation-collapsed');
      return saved ? JSON.parse(saved) : false;
    } catch {
      return false;
    }
  });

  // Listen for navigation state changes
  useEffect(() => {
    const handleNavChange = (event: CustomEvent) => {
      setIsNavCollapsed(event.detail.isCollapsed);
    };
    
    window.addEventListener('navigation-state-changed', handleNavChange as EventListener);
    return () => window.removeEventListener('navigation-state-changed', handleNavChange as EventListener);
  }, []);

  // Get portfolios linked to user's PAN card for enhanced security
  const { data: portfolios, isLoading: portfoliosLoading, error: portfoliosError } = usePortfoliosByPan();
  const portfolioId = portfolios?.[0]?.id || "demo-portfolio-1";
  const { user } = useAuth();

  // Consent management state
  const [consentDialogOpen, setConsentDialogOpen] = useState(false);
  const [currentSchemeType, setCurrentSchemeType] = useState<SchemeType>("epf");
  const { checkConsent, grantConsent } = useConsent();

  const { data: enhancedHoldings, isLoading: holdingsLoading, refetch: refetchHoldings } = useEnhancedPortfolioHoldings(portfolioId);
  const { data: performance, isLoading: performanceLoading } = usePortfolioPerformance(portfolioId);

  // Government Scheme Holdings data - will be conditionally fetched based on consent
  const { data: epfHoldings, isLoading: epfLoading } = useEpfHoldings();
  const { data: ppfHoldings, isLoading: ppfLoading } = usePpfHoldings();
  const { data: epsHoldings, isLoading: epsLoading } = useEpsHoldings();
  
  // Insurance Holdings data from NSDL/CDSL
  const { data: insuranceHoldings, isLoading: insuranceLoading } = useInsuranceHoldings();
  
  const isLoading = portfoliosLoading || holdingsLoading || performanceLoading;
  const totalValue = performance ? parseFloat(performance.totalCurrentValue) : 1250000;

  // Handle consent request for government scheme access
  const handleRequestConsent = (schemeType: SchemeType) => {
    setCurrentSchemeType(schemeType);
    setConsentDialogOpen(true);
  };

  const handleConsentGranted = () => {
    // Refresh the government scheme data after consent is granted
    window.location.reload(); // Simple refresh for now
  };

  // Handle PAN-related errors
  if (portfoliosError && !portfoliosLoading) {
    return (
      <div className="min-h-screen bg-finance-light" data-testid="portfolio-page">
        <EnhancedNavigation />
        <main className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-16 lg:pt-0 ${isNavCollapsed ? 'ml-16 lg:ml-0' : 'ml-64 lg:ml-0'}`}>
          <div className="text-center py-16">
            <Shield className="h-16 w-16 text-orange-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">PAN Card Required</h1>
            <p className="text-gray-600 mb-4">
              Complete your KYC by adding your PAN card to access portfolio data
            </p>
            <Button className="bg-orange-500 text-white hover:bg-orange-600">
              Complete KYC
            </Button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // Handle no portfolios found
  if (!portfoliosLoading && portfolios && portfolios.length === 0) {
    return (
      <div className="min-h-screen bg-finance-light" data-testid="portfolio-page">
        <EnhancedNavigation />
        <main className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-16 lg:pt-0 ${isNavCollapsed ? 'ml-16 lg:ml-0' : 'ml-64 lg:ml-0'}`}>
          <div className="text-center py-16">
            <TrendingUp className="h-16 w-16 text-blue-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">No Portfolios Found</h1>
            <p className="text-gray-600 mb-4">
              No investment portfolios are linked to your PAN card yet
            </p>
            <Button className="bg-blue-500 text-white hover:bg-blue-600">
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Portfolio
            </Button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-finance-light" data-testid="portfolio-page">
      <EnhancedNavigation />
      
      <main className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-16 lg:pt-0 ${isNavCollapsed ? 'ml-16 lg:ml-0' : 'ml-64 lg:ml-0'}`}>
        
        {/* Page Header */}
        <div className="flex justify-between items-center mb-8" data-testid="portfolio-header">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Portfolio Management</h1>
            <p className="text-gray-600 mt-2">Track, analyze, and rebalance your investments with live market data</p>
            {portfolios && portfolios.length > 0 && (
              <div className="flex items-center mt-3 p-2 bg-green-50 border border-green-200 rounded-lg">
                <Shield className="h-4 w-4 text-green-600 mr-2" />
                <span className="text-sm text-green-700">
                  Showing portfolios linked to your verified PAN card for enhanced security
                </span>
              </div>
            )}
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
          <TabsList className="grid w-full grid-cols-8">
            <TabsTrigger value="overview">Portfolio Overview</TabsTrigger>
            <TabsTrigger value="insurance" className="flex items-center space-x-1">
              <Shield className="h-4 w-4" />
              <span>Insurance</span>
            </TabsTrigger>
            <TabsTrigger value="epf" className="flex items-center space-x-1">
              <CreditCard className="h-4 w-4" />
              <span>EPF Holdings</span>
            </TabsTrigger>
            <TabsTrigger value="ppf" className="flex items-center space-x-1">
              <PiggyBank className="h-4 w-4" />
              <span>PPF Holdings</span>
            </TabsTrigger>
            <TabsTrigger value="eps" className="flex items-center space-x-1">
              <Shield className="h-4 w-4" />
              <span>EPS Pension</span>
            </TabsTrigger>
            <TabsTrigger value="commodities" className="flex items-center space-x-1">
              <Coins className="h-4 w-4" />
              <span>Commodities</span>
            </TabsTrigger>
            <TabsTrigger value="pi-chat" className="flex items-center space-x-1">
              <Bot className="h-4 w-4" />
              <span>AI Insights</span>
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

            {/* Comprehensive Investment Summary */}
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Complete Investment Portfolio</h2>
              
              {/* Total Portfolio Value Card - PAN Verified */}
              <Card className="mb-6 bg-gradient-to-r from-green-50 to-blue-50 border-2 border-green-200">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-2">
                      <Shield className="h-4 w-4 text-green-600" />
                      <span className="text-sm text-green-700 font-medium">PAN Verified Portfolio</span>
                    </div>
                    <Badge className="bg-green-100 text-green-800 border-green-300">Secure Access</Badge>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="md:col-span-2">
                      <h3 className="text-xl font-semibold text-gray-900 mb-2 flex items-center">
                        <TrendingUp className="h-6 w-6 text-green-600 mr-2" />
                        Total Portfolio Value
                      </h3>
                      <div className="text-4xl font-bold text-green-600 mb-2">₹45,67,890</div>
                      <div className="flex items-center space-x-4">
                        <span className="text-green-600 flex items-center text-lg font-medium">
                          <TrendingUp className="h-5 w-5 mr-1" />
                          +12.8% (₹5,18,420)
                        </span>
                        <Badge className="bg-green-100 text-green-800 border-green-300">YTD Gain</Badge>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground font-medium">Investment Breakdown</p>
                      <div className="text-lg font-semibold text-gray-900">₹40,49,470</div>
                      <p className="text-xs text-gray-600">Total Invested</p>
                    </div>
                    
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground font-medium">Monthly SIP</p>
                      <div className="text-lg font-semibold text-blue-600">₹43,500</div>
                      <p className="text-xs text-gray-600">Recurring Investment</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Investment Categories Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                {/* Equity Investments */}
                <Card className="border-l-4 border-blue-500">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center text-blue-700">
                      <TrendingUp className="h-5 w-5 mr-2" />
                      Equity Investments
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-blue-600 mb-3">₹18,45,150</div>
                    <p className="text-sm text-muted-foreground mb-4">40.4% of portfolio</p>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Direct Stocks</span>
                        <span className="font-medium">₹8,45,150</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Mutual Funds</span>
                        <span className="font-medium">₹7,50,000</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">AIF Funds</span>
                        <span className="font-medium">₹2,50,000</span>
                      </div>
                      <div className="pt-2 border-t flex justify-between">
                        <span className="text-sm font-medium text-green-600">Returns</span>
                        <span className="text-sm font-bold text-green-600">+15.2%</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Government Schemes */}
                <Card className="border-l-4 border-green-500">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center text-green-700">
                      <Shield className="h-5 w-5 mr-2" />
                      Government Schemes
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600 mb-3">₹15,67,340</div>
                    <p className="text-sm text-muted-foreground mb-4">34.3% of portfolio</p>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">EPF Holdings</span>
                        <span className="font-medium">₹8,45,230</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">PPF Account</span>
                        <span className="font-medium">₹5,95,110</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">EPS Contribution</span>
                        <span className="font-medium">₹1,27,000</span>
                      </div>
                      <div className="pt-2 border-t flex justify-between">
                        <span className="text-sm font-medium text-green-600">Pension Income</span>
                        <span className="text-sm font-bold text-green-600">₹9,857/mo</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Alternative Assets */}
                <Card className="border-l-4 border-purple-500">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center text-purple-700">
                      <Coins className="h-5 w-5 mr-2" />
                      Alternative Assets
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-purple-600 mb-3">₹11,55,400</div>
                    <p className="text-sm text-muted-foreground mb-4">25.3% of portfolio</p>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Bonds & FDs</span>
                        <span className="font-medium">₹5,50,000</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Commodities</span>
                        <span className="font-medium">₹3,25,400</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Pre-IPO</span>
                        <span className="font-medium">₹2,80,000</span>
                      </div>
                      <div className="pt-2 border-t flex justify-between">
                        <span className="text-sm font-medium text-green-600">Returns</span>
                        <span className="text-sm font-bold text-green-600">+11.8%</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Asset Allocation & Performance Dashboard */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {/* Asset Allocation Visualization */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <PiggyBank className="h-5 w-5 text-blue-600" />
                      <span>Asset Allocation Analysis</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      {/* Risk Distribution */}
                      <div>
                        <h4 className="font-medium text-gray-900 mb-3">Risk Distribution</h4>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <div className="w-4 h-4 bg-green-500 rounded"></div>
                              <span className="text-sm">Low Risk (Govt Schemes)</span>
                            </div>
                            <span className="text-sm font-bold">34.3%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div className="bg-green-500 h-2 rounded-full" style={{ width: '34.3%' }}></div>
                          </div>

                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <div className="w-4 h-4 bg-blue-500 rounded"></div>
                              <span className="text-sm">Medium Risk (Equity)</span>
                            </div>
                            <span className="text-sm font-bold">40.4%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div className="bg-blue-500 h-2 rounded-full" style={{ width: '40.4%' }}></div>
                          </div>

                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <div className="w-4 h-4 bg-purple-500 rounded"></div>
                              <span className="text-sm">High Risk (Alternatives)</span>
                            </div>
                            <span className="text-sm font-bold">25.3%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div className="bg-purple-500 h-2 rounded-full" style={{ width: '25.3%' }}></div>
                          </div>
                        </div>
                      </div>

                      {/* Investment Goals Progress */}
                      <div className="pt-4 border-t">
                        <h4 className="font-medium text-gray-900 mb-3">Goal Progress</h4>
                        <div className="space-y-4">
                          <div>
                            <div className="flex justify-between text-sm mb-2">
                              <span>Retirement Goal</span>
                              <span className="font-medium">68% Complete</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-3">
                              <div className="bg-green-500 h-3 rounded-full" style={{ width: '68%' }}></div>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">₹68L of ₹1Cr target</p>
                          </div>

                          <div>
                            <div className="flex justify-between text-sm mb-2">
                              <span>Child Education</span>
                              <span className="font-medium">45% Complete</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-3">
                              <div className="bg-blue-500 h-3 rounded-full" style={{ width: '45%' }}></div>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">₹22.5L of ₹50L target</p>
                          </div>

                          <div>
                            <div className="flex justify-between text-sm mb-2">
                              <span>Emergency Fund</span>
                              <span className="font-medium">100% Complete</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-3">
                              <div className="bg-green-500 h-3 rounded-full" style={{ width: '100%' }}></div>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">₹5L target achieved ✓</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Performance Metrics */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <TrendingUp className="h-5 w-5 text-green-600" />
                      <span>Performance Dashboard</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      {/* Overall Returns */}
                      <div>
                        <h4 className="font-medium text-gray-900 mb-3">Portfolio Returns</h4>
                        <div className="grid grid-cols-3 gap-4">
                          <div className="text-center p-3 bg-green-50 rounded-lg">
                            <p className="text-2xl font-bold text-green-600">+12.8%</p>
                            <p className="text-xs text-muted-foreground">1 Year</p>
                          </div>
                          <div className="text-center p-3 bg-blue-50 rounded-lg">
                            <p className="text-2xl font-bold text-blue-600">+9.4%</p>
                            <p className="text-xs text-muted-foreground">3 Year CAGR</p>
                          </div>
                          <div className="text-center p-3 bg-purple-50 rounded-lg">
                            <p className="text-2xl font-bold text-purple-600">+11.2%</p>
                            <p className="text-xs text-muted-foreground">5 Year CAGR</p>
                          </div>
                        </div>
                      </div>

                      {/* Asset Class Performance */}
                      <div className="pt-4 border-t">
                        <h4 className="font-medium text-gray-900 mb-3">Asset Performance (YTD)</h4>
                        <div className="space-y-3">
                          <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                            <div>
                              <span className="text-sm font-medium text-blue-900">Equity Investments</span>
                              <p className="text-xs text-blue-700">₹18,45,150</p>
                            </div>
                            <span className="text-lg font-bold text-green-600">+15.2%</span>
                          </div>
                          
                          <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                            <div>
                              <span className="text-sm font-medium text-green-900">Government Schemes</span>
                              <p className="text-xs text-green-700">₹15,67,340</p>
                            </div>
                            <span className="text-lg font-bold text-green-600">+8.1%</span>
                          </div>
                          
                          <div className="flex justify-between items-center p-3 bg-purple-50 rounded-lg">
                            <div>
                              <span className="text-sm font-medium text-purple-900">Alternative Assets</span>
                              <p className="text-xs text-purple-700">₹11,55,400</p>
                            </div>
                            <span className="text-lg font-bold text-green-600">+11.8%</span>
                          </div>
                        </div>
                      </div>

                      {/* Monthly Investment Flow */}
                      <div className="pt-4 border-t">
                        <h4 className="font-medium text-gray-900 mb-3">Monthly Investment Flow</h4>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="text-center p-3 bg-blue-50 rounded-lg">
                            <p className="text-lg font-bold text-blue-600">₹25,000</p>
                            <p className="text-xs text-muted-foreground">SIP Investments</p>
                          </div>
                          <div className="text-center p-3 bg-green-50 rounded-lg">
                            <p className="text-lg font-bold text-green-600">₹18,500</p>
                            <p className="text-xs text-muted-foreground">EPF + PPF + EPS</p>
                          </div>
                        </div>
                        <div className="mt-3 text-center p-3 bg-purple-50 rounded-lg">
                          <p className="text-xl font-bold text-purple-600">₹43,500</p>
                          <p className="text-xs text-muted-foreground">Total Monthly Investment</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

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
          
          <PortfolioSummary userId={portfolios?.[0]?.userId || "demo-user-1"} />
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
              </div>
            </div>
          </TabsContent>

          <TabsContent value="insurance" className="space-y-8">
            <ConsentAwareSchemeTab 
              schemeType="insurance" 
              onRequestConsent={handleRequestConsent}
            >
              {/* PAN Verification Banner */}
              <div className="flex items-center mb-6 p-3 bg-green-50 border border-green-200 rounded-lg">
                <Shield className="h-4 w-4 text-green-600 mr-2" />
                <span className="text-sm text-green-700">
                  Insurance holdings verified with your PAN card for secure access
                </span>
              </div>
              
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                {/* Insurance Holdings Overview */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Shield className="h-5 w-5 text-blue-600" />
                      <span>Insurance Holdings Overview</span>
                    </CardTitle>
                    <CardDescription>
                      Holdings data from NSDL & CDSL depository accounts
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {insuranceLoading ? (
                      <div className="space-y-4">
                        <Skeleton className="h-24 w-full" />
                        <Skeleton className="h-32 w-full" />
                      </div>
                    ) : (
                    <div className="space-y-6">
                      {/* Summary Stats */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-blue-50 rounded-lg">
                          <div className="text-sm text-muted-foreground">Total Policies</div>
                          <div className="text-2xl font-bold text-blue-600">{insuranceHoldings?.length || 0}</div>
                        </div>
                        <div className="p-4 bg-green-50 rounded-lg">
                          <div className="text-sm text-muted-foreground">Total Coverage</div>
                          <div className="text-2xl font-bold text-green-600">
                            ₹{insuranceHoldings?.reduce((sum, policy) => sum + parseFloat(policy.sumAssured), 0).toLocaleString() || "0"}
                          </div>
                        </div>
                      </div>

                      {/* Policy Breakdown */}
                      <div className="space-y-3">
                        <h4 className="font-semibold text-gray-900">Policy Categories</h4>
                        <div className="space-y-2">
                          {insuranceHoldings && insuranceHoldings.length > 0 ? (
                            Array.from(new Set(insuranceHoldings.map(p => p.policyType))).map(policyType => {
                              const count = insuranceHoldings.filter(p => p.policyType === policyType).length;
                              return (
                                <div key={policyType} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                                  <span className="text-sm">{policyType.charAt(0).toUpperCase() + policyType.slice(1)} Insurance</span>
                                  <span className="font-medium">{count} {count === 1 ? 'policy' : 'policies'}</span>
                                </div>
                              );
                            })
                          ) : (
                            <div className="text-center text-muted-foreground py-4">
                              <p className="text-sm">No policy categories to display</p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Depository Info */}
                      <div className="space-y-3">
                        <h4 className="font-semibold text-gray-900">Depository Details</h4>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="text-center p-3 bg-purple-50 rounded-lg">
                            <p className="text-sm font-medium text-purple-600">NSDL Holdings</p>
                            <p className="text-xs text-purple-600">{insuranceHoldings?.filter(p => p.depositoryName === 'NSDL').length || 0} policies</p>
                          </div>
                          <div className="text-center p-3 bg-indigo-50 rounded-lg">
                            <p className="text-sm font-medium text-indigo-600">CDSL Holdings</p>
                            <p className="text-xs text-indigo-600">{insuranceHoldings?.filter(p => p.depositoryName === 'CDSL').length || 0} policies</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    )}
                  </CardContent>
                </Card>

                {/* Detailed Policy List */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Shield className="h-5 w-5 text-green-600" />
                      <span>Active Insurance Policies</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {insuranceLoading ? (
                      <div className="space-y-4">
                        <Skeleton className="h-24 w-full" />
                        <Skeleton className="h-24 w-full" />
                        <Skeleton className="h-24 w-full" />
                      </div>
                    ) : (
                    <div className="space-y-4">
                      {insuranceHoldings && insuranceHoldings.length > 0 ? (
                        insuranceHoldings.map((policy) => (
                          <div key={policy.id} className="border rounded-lg p-4" data-testid={`insurance-policy-${policy.id}`}>
                            <div className="flex justify-between items-start mb-3">
                              <div>
                                <h4 className="font-medium text-gray-900">{policy.policyName}</h4>
                                <p className="text-sm text-muted-foreground">Policy No: {policy.policyNumber}</p>
                                <p className="text-xs text-muted-foreground">{policy.insuranceCompany}</p>
                              </div>
                              <Badge className={(policy.policyStatus || '') === 'active' ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}>
                                {policy.policyStatus ? policy.policyStatus.charAt(0).toUpperCase() + policy.policyStatus.slice(1) : 'Unknown'}
                              </Badge>
                            </div>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <p className="text-muted-foreground">Sum Assured</p>
                                <p className="font-medium">₹{parseFloat(policy.sumAssured).toLocaleString()}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Premium</p>
                                <p className="font-medium">₹{parseFloat(policy.premiumAmount).toLocaleString()}/{policy.premiumFrequency}</p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">
                                  {policy.policyMaturityDate ? 'Maturity Date' : 'Premium Due'}
                                </p>
                                <p className="font-medium">
                                  {policy.policyMaturityDate 
                                    ? new Date(policy.policyMaturityDate).toLocaleDateString()
                                    : policy.premiumDueDate ? new Date(policy.premiumDueDate).toLocaleDateString() : 'N/A'
                                  }
                                </p>
                              </div>
                              <div>
                                <p className="text-muted-foreground">Depository</p>
                                <p className={`font-medium ${policy.depositoryName === 'NSDL' ? 'text-purple-600' : 'text-indigo-600'}`}>
                                  {policy.depositoryName}
                                </p>
                              </div>
                              {policy.fundValue && (
                                <div className="col-span-2">
                                  <p className="text-muted-foreground">Fund Value</p>
                                  <p className="font-medium text-green-600">₹{parseFloat(policy.fundValue).toLocaleString()}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          <Shield className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                          <p>No insurance policies found</p>
                          <p className="text-sm">Connect your NSDL/CDSL account to view your insurance holdings</p>
                        </div>
                      )}
                    </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Insurance Portfolio Analytics */}
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Shield className="h-5 w-5 text-orange-600" />
                    <span>Insurance Portfolio Analytics</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    {/* Coverage Adequacy */}
                    <div className="space-y-3">
                      <h4 className="font-semibold text-gray-900">Coverage Adequacy</h4>
                      <div className="text-center">
                        <div className="text-3xl font-bold text-green-600">85%</div>
                        <p className="text-sm text-muted-foreground">of recommended coverage</p>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div className="bg-green-600 h-2 rounded-full" style={{ width: '85%' }}></div>
                      </div>
                    </div>

                    {/* Annual Premium */}
                    <div className="space-y-3">
                      <h4 className="font-semibold text-gray-900">Annual Premium</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm">Total Premium</span>
                          <span className="text-sm font-medium">₹88,500</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm">% of Income</span>
                          <span className="text-sm font-medium text-green-600">8.2%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm">Next Due</span>
                          <span className="text-sm font-medium text-orange-600">15 days</span>
                        </div>
                      </div>
                    </div>

                    {/* Risk Protection */}
                    <div className="space-y-3">
                      <h4 className="font-semibold text-gray-900">Risk Protection</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm">Life Coverage</span>
                          <span className="text-sm font-medium">₹1.5Cr</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm">Health Coverage</span>
                          <span className="text-sm font-medium">₹20L</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm">Motor Coverage</span>
                          <span className="text-sm font-medium">₹15L</span>
                        </div>
                      </div>
                    </div>

                    {/* Portfolio Impact */}
                    <div className="space-y-3">
                      <h4 className="font-semibold text-gray-900">Portfolio Impact</h4>
                      <div className="space-y-2">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-blue-600">₹3.85L</div>
                          <p className="text-sm text-muted-foreground">ULIP Fund Value</p>
                        </div>
                        <div className="text-xs text-gray-600 text-center">
                          Part of investment portfolio
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-4 mt-6 pt-4 border-t">
                    <Button variant="outline" size="sm" data-testid="button-view-policies">
                      View All Policies
                    </Button>
                    <Button variant="outline" size="sm" data-testid="button-pay-premium">
                      Pay Premium
                    </Button>
                    <Button variant="outline" size="sm" data-testid="button-claim-status">
                      Claim Status
                    </Button>
                    <Button variant="outline" size="sm" data-testid="button-download-certificates">
                      Download Certificates
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </ConsentAwareSchemeTab>
          </TabsContent>

          <TabsContent value="epf" className="space-y-8">
            <ConsentAwareSchemeTab 
              schemeType="epf" 
              onRequestConsent={handleRequestConsent}
            >
              {/* PAN Verification Banner */}
              <div className="flex items-center mb-6 p-3 bg-green-50 border border-green-200 rounded-lg">
                <Shield className="h-4 w-4 text-green-600 mr-2" />
                <span className="text-sm text-green-700">
                  EPF data verified with your PAN card and UAN for secure access
                </span>
              </div>
              
              {epfLoading ? (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <Skeleton className="h-8 w-48" />
                    <Skeleton className="h-64 w-full" />
                  </div>
                  <div className="space-y-4">
                    <Skeleton className="h-8 w-48" />
                    <Skeleton className="h-64 w-full" />
                  </div>
                </div>
              ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                {epfHoldings?.map((epf) => (
                  <div key={epf.id} className="contents">
                    {/* EPF Account Overview */}
                    <Card>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle className="flex items-center space-x-2">
                            <CreditCard className="h-5 w-5 text-blue-600" />
                            <span>EPF Account Summary</span>
                          </CardTitle>
                          <Badge variant="outline" className="text-green-600 border-green-600">
                            {epf.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-6">
                          {/* Account Details */}
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-sm text-muted-foreground">Account Number</p>
                              <p className="font-medium">{epf.epfAccountNumber}</p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Employer</p>
                              <p className="font-medium">{epf.employerName}</p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Date of Joining</p>
                              <p className="font-medium">{epf.dateOfJoining ? new Date(epf.dateOfJoining).toLocaleDateString('en-IN') : 'N/A'}</p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Interest Rate</p>
                              <p className="font-medium text-green-600">{epf.interestRate}%</p>
                            </div>
                          </div>

                          {/* Balance Breakdown */}
                          <div className="space-y-4">
                            <h4 className="font-semibold text-gray-900">Balance Breakdown</h4>
                            <div className="space-y-3">
                              <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                                <span className="text-sm font-medium text-blue-900">Employee Contribution</span>
                                <span className="font-bold text-blue-900">₹{parseFloat(epf.employeeContribution || '0').toLocaleString('en-IN')}</span>
                              </div>
                              <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                                <span className="text-sm font-medium text-green-900">Employer Contribution</span>
                                <span className="font-bold text-green-900">₹{parseFloat(epf.employerContribution || '0').toLocaleString('en-IN')}</span>
                              </div>
                              <div className="flex justify-between items-center p-3 bg-purple-50 rounded-lg">
                                <span className="text-sm font-medium text-purple-900">Pension Fund (EPS)</span>
                                <span className="font-bold text-purple-900">₹{parseFloat(epf.pensionContribution || '0').toLocaleString('en-IN')}</span>
                              </div>
                              <div className="flex justify-between items-center p-3 bg-orange-50 rounded-lg">
                                <span className="text-sm font-medium text-orange-900">Interest Earned</span>
                                <span className="font-bold text-orange-900">₹{parseFloat(epf.interestEarned || '0').toLocaleString('en-IN')}</span>
                              </div>
                            </div>
                          </div>

                          {/* Total Balance */}
                          <div className="pt-4 border-t">
                            <div className="flex justify-between items-center">
                              <span className="text-lg font-semibold text-gray-900">Total EPF Balance</span>
                              <span className="text-2xl font-bold text-green-600">₹{parseFloat(epf.totalBalance || '0').toLocaleString('en-IN')}</span>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              As of {epf.lastUpdated ? new Date(epf.lastUpdated).toLocaleDateString('en-IN') : 'N/A'}
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
                                <span className="font-medium text-green-600">₹{parseFloat(epf.interestEarned || '0').toLocaleString('en-IN')}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-sm text-muted-foreground">Account Status</span>
                                <span className="font-medium text-green-600">{epf.isActive ? 'Active' : 'Inactive'}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-sm text-muted-foreground">Annual Interest Rate</span>
                                <span className="font-medium text-green-600">{epf.interestRate}%</span>
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
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                ))}
              </div>
              )}
            </ConsentAwareSchemeTab>
          </TabsContent>

          <TabsContent value="ppf" className="space-y-8">
            <ConsentAwareSchemeTab 
              schemeType="ppf" 
              onRequestConsent={handleRequestConsent}
            >
              {/* PAN Verification Banner */}
              <div className="flex items-center mb-6 p-3 bg-green-50 border border-green-200 rounded-lg">
                <Shield className="h-4 w-4 text-green-600 mr-2" />
                <span className="text-sm text-green-700">
                  PPF data verified with your PAN card and PPF account number for secure access
                </span>
              </div>
              
              {ppfLoading ? (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <Skeleton className="h-8 w-48" />
                  <Skeleton className="h-64 w-full" />
                </div>
                <div className="space-y-4">
                  <Skeleton className="h-8 w-48" />
                  <Skeleton className="h-64 w-full" />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                {ppfHoldings?.map((ppf) => (
                  <div key={ppf.id} className="contents">
                    {/* PPF Account Overview */}
                    <Card>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle className="flex items-center space-x-2">
                            <PiggyBank className="h-5 w-5 text-purple-600" />
                            <span>PPF Account Summary</span>
                          </CardTitle>
                          <Badge variant="outline" className="text-green-600 border-green-600">
                            {ppf.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-6">
                          {/* Account Details */}
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-sm text-muted-foreground">Account Number</p>
                              <p className="font-medium">{ppf.ppfAccountNumber}</p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Bank & Branch</p>
                              <p className="font-medium">{ppf.bankName} - {ppf.branchName}</p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Account Opening Date</p>
                              <p className="font-medium">{new Date(ppf.accountOpenDate).toLocaleDateString('en-IN')}</p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Maturity Date</p>
                              <p className="font-medium text-blue-600">{new Date(ppf.maturityDate).toLocaleDateString('en-IN')}</p>
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
                ))}
              </div>
              )}
            </ConsentAwareSchemeTab>
          </TabsContent>

          <TabsContent value="eps" className="space-y-8">
            <ConsentAwareSchemeTab 
              schemeType="eps" 
              onRequestConsent={handleRequestConsent}
            >
              {/* PAN Verification Banner */}
              <div className="flex items-center mb-6 p-3 bg-green-50 border border-green-200 rounded-lg">
                <Shield className="h-4 w-4 text-green-600 mr-2" />
                <span className="text-sm text-green-700">
                  EPS pension data verified with your PAN card and UAN for secure access
                </span>
              </div>
              
              {epsLoading ? (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <Skeleton className="h-8 w-48" />
                  <Skeleton className="h-64 w-full" />
                </div>
                <div className="space-y-4">
                  <Skeleton className="h-8 w-48" />
                  <Skeleton className="h-64 w-full" />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                {epsHoldings?.map((eps) => (
                  <div key={eps.id} className="contents">
                    {/* EPS Account Overview */}
                    <Card>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle className="flex items-center space-x-2">
                            <Shield className="h-5 w-5 text-blue-600" />
                            <span>EPS Pension Account</span>
                          </CardTitle>
                          <Badge variant="outline" className="text-blue-600 border-blue-600">{eps.schemeType?.toUpperCase() || 'EPS-95'}</Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-6">
                          {/* Account Details */}
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-sm text-muted-foreground">EPF Account Number</p>
                              <p className="font-medium">{eps.epfAccountNumber}</p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Pension Account</p>
                              <p className="font-medium">{eps.pensionAccountNumber}</p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Current Employer</p>
                              <p className="font-medium">{eps.currentEmployer}</p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Employer Code</p>
                              <p className="font-medium">{eps.employerCode}</p>
                            </div>
                          </div>

                    {/* Service Details */}
                    <div className="space-y-4">
                      <h4 className="font-semibold text-gray-900">Service Information</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 bg-blue-50 rounded-lg">
                          <p className="text-sm text-muted-foreground">Service Start Date</p>
                          <p className="font-bold text-blue-600">01-Jun-2015</p>
                        </div>
                        <div className="p-3 bg-green-50 rounded-lg">
                          <p className="text-sm text-muted-foreground">Total Service</p>
                          <p className="font-bold text-green-600">9 Years 8 Months</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 bg-purple-50 rounded-lg">
                          <p className="text-sm text-muted-foreground">Current Salary</p>
                          <p className="font-bold text-purple-600">₹85,000</p>
                        </div>
                        <div className="p-3 bg-orange-50 rounded-lg">
                          <p className="text-sm text-muted-foreground">Pensionable Wage</p>
                          <p className="font-bold text-orange-600">₹15,000</p>
                          <p className="text-xs text-orange-600">Max ceiling</p>
                        </div>
                      </div>
                    </div>

                    {/* Vesting Status */}
                    <div className="space-y-4">
                      <h4 className="font-semibold text-gray-900">Vesting & Eligibility Status</h4>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg border-l-4 border-green-500">
                          <div>
                            <p className="font-medium text-green-900">✓ Vested</p>
                            <p className="text-xs text-green-700">Completed 10+ years minimum service</p>
                          </div>
                          <Badge className="bg-green-100 text-green-800 border-green-300">Eligible</Badge>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-yellow-50 rounded-lg border-l-4 border-yellow-500">
                          <div>
                            <p className="font-medium text-yellow-900">⏳ Pension Eligibility</p>
                            <p className="text-xs text-yellow-700">Available from age 58 (Currently 35)</p>
                          </div>
                          <Badge variant="outline" className="text-yellow-600 border-yellow-600">23 years</Badge>
                        </div>
                      </div>
                    </div>

                    {/* Expected Retirement */}
                    <div className="pt-4 border-t">
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-lg font-semibold text-gray-900">Expected Retirement Date</span>
                          <span className="text-xl font-bold text-blue-600">01-Jun-2038</span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Based on 58 years age eligibility (32 years total service)
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* EPS Pension Calculation & Benefits */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <TrendingUp className="h-5 w-5 text-green-600" />
                    <span>Pension Calculation & Benefits</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {/* Current Contribution Status */}
                    <div className="space-y-3">
                      <h4 className="font-semibold text-gray-900">Monthly Contribution (FY 2024-25)</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 bg-blue-50 rounded-lg">
                          <p className="text-sm text-muted-foreground">Contribution Rate</p>
                          <p className="text-lg font-bold text-blue-900">8.33%</p>
                          <p className="text-xs text-blue-600">of pensionable wage</p>
                        </div>
                        <div className="p-3 bg-green-50 rounded-lg">
                          <p className="text-sm text-muted-foreground">Monthly Contribution</p>
                          <p className="text-lg font-bold text-green-900">₹1,249</p>
                          <p className="text-xs text-green-600">8.33% of ₹15,000</p>
                        </div>
                      </div>
                      <div className="p-3 bg-purple-50 rounded-lg">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-purple-900">Total Contributions Till Date</span>
                          <span className="font-bold text-purple-900">₹1,45,104</span>
                        </div>
                        <p className="text-xs text-purple-600 mt-1">9 years 8 months of contributions</p>
                      </div>
                    </div>

                    {/* Pension Formula & Calculation */}
                    <div className="space-y-3">
                      <h4 className="font-semibold text-gray-900">Pension Formula (EPS-95)</h4>
                      <div className="p-4 bg-gray-50 rounded-lg border">
                        <p className="text-sm font-medium text-center text-gray-700">
                          Pension = (Pensionable Salary × Service) ÷ 70
                        </p>
                        <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                          <div className="text-center">
                            <p className="text-muted-foreground">Average Salary</p>
                            <p className="font-bold">₹15,000</p>
                          </div>
                          <div className="text-center">
                            <p className="text-muted-foreground">Expected Service</p>
                            <p className="font-bold">32 years</p>
                          </div>
                          <div className="text-center">
                            <p className="text-muted-foreground">Factor</p>
                            <p className="font-bold">70</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Projected Pension */}
                    <div className="space-y-3">
                      <h4 className="font-semibold text-gray-900">Projected Monthly Pension</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                          <span className="text-sm font-medium text-green-900">At Current Service (9.8 years)</span>
                          <span className="font-bold text-green-900">₹2,103</span>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                          <span className="text-sm font-medium text-blue-900">At Retirement (32 years)</span>
                          <span className="font-bold text-blue-900">₹6,857</span>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-purple-50 rounded-lg">
                          <span className="text-sm font-medium text-purple-900">Annual Pension (at retirement)</span>
                          <span className="font-bold text-purple-900">₹82,286</span>
                        </div>
                      </div>
                    </div>

                    {/* Pension Benefits */}
                    <div className="space-y-3">
                      <h4 className="font-semibold text-gray-900">Additional Benefits</h4>
                      <div className="space-y-2">
                        <div className="p-3 bg-green-50 rounded-lg border-l-4 border-green-500">
                          <p className="text-sm font-medium text-green-900">✓ Lifelong Pension</p>
                          <p className="text-xs text-green-700">Monthly pension for entire lifetime</p>
                        </div>
                        <div className="p-3 bg-blue-50 rounded-lg border-l-4 border-blue-500">
                          <p className="text-sm font-medium text-blue-900">✓ Family Pension</p>
                          <p className="text-xs text-blue-700">50% pension to spouse after member's death</p>
                        </div>
                        <div className="p-3 bg-purple-50 rounded-lg border-l-4 border-purple-500">
                          <p className="text-sm font-medium text-purple-900">✓ Medical Benefits</p>
                          <p className="text-xs text-purple-700">CGHS/ESI medical coverage continuation</p>
                        </div>
                      </div>
                    </div>

                    {/* Nominee Information */}
                    <div className="space-y-3">
                      <h4 className="font-semibold text-gray-900">Nominee Details</h4>
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <p className="text-sm text-muted-foreground">Name</p>
                            <p className="font-medium">Priya Sharma</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Relationship</p>
                            <p className="font-medium">Spouse</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Share</p>
                            <p className="font-medium">100%</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* APY (Atal Pension Yojana) Integration */}
              <Card className="xl:col-span-2">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center space-x-2">
                      <Shield className="h-5 w-5 text-green-600" />
                      <span>APY - Atal Pension Yojana</span>
                    </CardTitle>
                    <Badge variant="outline" className="text-green-600 border-green-600">Enrolled</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    {/* APY Account Overview */}
                    <div className="space-y-4">
                      <h4 className="font-semibold text-gray-900">Account Details</h4>
                      <div className="space-y-3">
                        <div className="p-3 bg-green-50 rounded-lg">
                          <p className="text-sm text-muted-foreground">APY Account</p>
                          <p className="font-bold text-green-900">APY/SBI/001/789123</p>
                        </div>
                        <div className="p-3 bg-blue-50 rounded-lg">
                          <p className="text-sm text-muted-foreground">Bank Partner</p>
                          <p className="font-bold text-blue-900">State Bank of India</p>
                        </div>
                        <div className="p-3 bg-purple-50 rounded-lg">
                          <p className="text-sm text-muted-foreground">Enrollment Date</p>
                          <p className="font-bold text-purple-900">01-Sep-2018</p>
                        </div>
                        <div className="p-3 bg-orange-50 rounded-lg">
                          <p className="text-sm text-muted-foreground">Current Age</p>
                          <p className="font-bold text-orange-900">35 Years</p>
                        </div>
                      </div>
                    </div>

                    {/* Chosen Pension Plan */}
                    <div className="space-y-4">
                      <h4 className="font-semibold text-gray-900">Pension Plan</h4>
                      <div className="space-y-3">
                        <div className="text-center p-4 bg-gradient-to-br from-green-100 to-green-200 rounded-lg border-2 border-green-300">
                          <p className="text-sm text-green-700 font-medium">Guaranteed Monthly Pension</p>
                          <p className="text-3xl font-bold text-green-800">₹3,000</p>
                          <p className="text-xs text-green-600">from age 60</p>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="text-center p-2 bg-blue-50 rounded border">
                            <p className="text-xs text-muted-foreground">Annual Pension</p>
                            <p className="font-bold text-blue-900">₹36,000</p>
                          </div>
                          <div className="text-center p-2 bg-purple-50 rounded border">
                            <p className="text-xs text-muted-foreground">Maturity Age</p>
                            <p className="font-bold text-purple-900">60 Years</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Monthly Contributions */}
                    <div className="space-y-4">
                      <h4 className="font-semibold text-gray-900">Contributions (FY 2024-25)</h4>
                      <div className="space-y-3">
                        <div className="p-3 bg-blue-50 rounded-lg">
                          <p className="text-sm text-muted-foreground">Monthly Contribution</p>
                          <p className="text-lg font-bold text-blue-900">₹168</p>
                          <p className="text-xs text-blue-600">Auto-debit from salary</p>
                        </div>
                        <div className="p-3 bg-green-50 rounded-lg">
                          <p className="text-sm text-muted-foreground">Govt Co-contribution</p>
                          <p className="text-lg font-bold text-green-900">₹84</p>
                          <p className="text-xs text-green-600">50% govt support</p>
                        </div>
                        <div className="p-3 bg-purple-50 rounded-lg">
                          <p className="text-sm text-muted-foreground">Total Monthly</p>
                          <p className="text-lg font-bold text-purple-900">₹252</p>
                          <p className="text-xs text-purple-600">Your + Government</p>
                        </div>
                      </div>
                    </div>

                    {/* Contribution Progress */}
                    <div className="space-y-4">
                      <h4 className="font-semibold text-gray-900">Contribution Progress</h4>
                      <div className="space-y-3">
                        <div className="p-3 bg-gray-50 rounded-lg">
                          <p className="text-sm text-muted-foreground">Years Contributed</p>
                          <p className="text-lg font-bold text-gray-900">6.3 Years</p>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-3">
                          <div className="bg-green-500 h-3 rounded-full" style={{ width: '25.2%' }}></div>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Age 35</span>
                          <span className="font-medium">25 years to go</span>
                          <span className="text-muted-foreground">Age 60</span>
                        </div>
                        <div className="p-3 bg-orange-50 rounded-lg">
                          <p className="text-sm text-muted-foreground">Total Contributed</p>
                          <p className="text-lg font-bold text-orange-900">₹1,27,008</p>
                          <p className="text-xs text-orange-600">Your + Govt contributions</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* APY Benefits Overview */}
                  <div className="mt-6 pt-6 border-t">
                    <h4 className="font-semibold text-gray-900 mb-4">APY Benefits & Features</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-3">
                        <h5 className="font-medium text-gray-800">Pension Benefits</h5>
                        <div className="space-y-2">
                          <div className="p-3 bg-green-50 rounded-lg border-l-4 border-green-500">
                            <p className="text-sm font-medium text-green-900">✓ Guaranteed Pension</p>
                            <p className="text-xs text-green-700">₹3,000/month from age 60</p>
                          </div>
                          <div className="p-3 bg-blue-50 rounded-lg border-l-4 border-blue-500">
                            <p className="text-sm font-medium text-blue-900">✓ Spouse Pension</p>
                            <p className="text-xs text-blue-700">Same pension amount to spouse</p>
                          </div>
                          <div className="p-3 bg-purple-50 rounded-lg border-l-4 border-purple-500">
                            <p className="text-sm font-medium text-purple-900">✓ Death Benefit</p>
                            <p className="text-xs text-purple-700">Corpus return to nominee</p>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <h5 className="font-medium text-gray-800">Government Support</h5>
                        <div className="space-y-2">
                          <div className="p-3 bg-yellow-50 rounded-lg border-l-4 border-yellow-500">
                            <p className="text-sm font-medium text-yellow-900">✓ Co-contribution</p>
                            <p className="text-xs text-yellow-700">50% govt support (up to ₹1,000)</p>
                          </div>
                          <div className="p-3 bg-green-50 rounded-lg border-l-4 border-green-500">
                            <p className="text-sm font-medium text-green-900">✓ Tax Benefits</p>
                            <p className="text-xs text-green-700">80CCD(1B) deduction up to ₹50,000</p>
                          </div>
                          <div className="p-3 bg-indigo-50 rounded-lg border-l-4 border-indigo-500">
                            <p className="text-sm font-medium text-indigo-900">✓ Govt Guarantee</p>
                            <p className="text-xs text-indigo-700">Returns backed by Government of India</p>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <h5 className="font-medium text-gray-800">Account Features</h5>
                        <div className="space-y-2">
                          <div className="p-3 bg-orange-50 rounded-lg border-l-4 border-orange-500">
                            <p className="text-sm font-medium text-orange-900">✓ Auto-Debit</p>
                            <p className="text-xs text-orange-700">Monthly contributions from salary</p>
                          </div>
                          <div className="p-3 bg-teal-50 rounded-lg border-l-4 border-teal-500">
                            <p className="text-sm font-medium text-teal-900">✓ Portability</p>
                            <p className="text-xs text-teal-700">Transfer across banks/employers</p>
                          </div>
                          <div className="p-3 bg-red-50 rounded-lg border-l-4 border-red-500">
                            <p className="text-sm font-medium text-red-900">⚠ Exit Clause</p>
                            <p className="text-xs text-red-700">Penalties for early exit</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* APY vs Other Pension Plans Comparison */}
                  <div className="mt-6 pt-6 border-t">
                    <h4 className="font-semibold text-gray-900 mb-4">Your Complete Pension Portfolio</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                        <div className="flex items-center justify-between mb-2">
                          <h5 className="font-medium text-blue-900">EPS-95</h5>
                          <Badge variant="outline" className="text-blue-600 border-blue-600">Government</Badge>
                        </div>
                        <div className="space-y-2">
                          <p className="text-2xl font-bold text-blue-900">₹6,857</p>
                          <p className="text-sm text-blue-700">Monthly at age 58</p>
                          <p className="text-xs text-muted-foreground">Based on salary & service</p>
                        </div>
                      </div>

                      <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                        <div className="flex items-center justify-between mb-2">
                          <h5 className="font-medium text-green-900">APY</h5>
                          <Badge variant="outline" className="text-green-600 border-green-600">Government</Badge>
                        </div>
                        <div className="space-y-2">
                          <p className="text-2xl font-bold text-green-900">₹3,000</p>
                          <p className="text-sm text-green-700">Monthly at age 60</p>
                          <p className="text-xs text-muted-foreground">Guaranteed pension amount</p>
                        </div>
                      </div>

                      <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                        <div className="flex items-center justify-between mb-2">
                          <h5 className="font-medium text-purple-900">Combined</h5>
                          <Badge variant="outline" className="text-purple-600 border-purple-600">Total</Badge>
                        </div>
                        <div className="space-y-2">
                          <p className="text-2xl font-bold text-purple-900">₹9,857</p>
                          <p className="text-sm text-purple-700">Monthly pension income</p>
                          <p className="text-xs text-muted-foreground">EPS + APY combined</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* APY Action Buttons */}
                  <div className="flex gap-4 mt-6 pt-4 border-t">
                    <Button variant="outline" size="sm">
                      View APY Statement
                    </Button>
                    <Button variant="outline" size="sm">
                      Contribution History
                    </Button>
                    <Button variant="outline" size="sm">
                      Change Pension Amount
                    </Button>
                    <Button variant="outline" size="sm">
                      Update Bank Details
                    </Button>
                    <Button variant="outline" size="sm">
                      Download Certificate
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* EPS Portfolio Integration & Retirement Planning */}
              <Card className="xl:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Shield className="h-5 w-5 text-blue-600" />
                    <span>EPS in Your Retirement Planning</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                    {/* Retirement Income Impact */}
                    <div className="space-y-3">
                      <h4 className="font-semibold text-gray-900">Monthly Income</h4>
                      <div className="text-center">
                        <div className="text-3xl font-bold text-blue-600">₹6,857</div>
                        <p className="text-sm text-muted-foreground">at retirement</p>
                      </div>
                      <div className="text-xs text-gray-600 text-center">
                        Guaranteed lifelong pension
                      </div>
                    </div>

                    {/* Risk Profile */}
                    <div className="space-y-3">
                      <h4 className="font-semibold text-gray-900">Security Level</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm">Risk</span>
                          <Badge variant="outline" className="text-green-600 border-green-600">Government Backed</Badge>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm">Inflation Protection</span>
                          <Badge variant="outline" className="text-blue-600 border-blue-600">Periodic DA</Badge>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm">Tax Status</span>
                          <Badge variant="outline" className="text-purple-600 border-purple-600">Tax-Free</Badge>
                        </div>
                      </div>
                    </div>

                    {/* Service Progress */}
                    <div className="space-y-3">
                      <h4 className="font-semibold text-gray-900">Service Progress</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm">Completed</span>
                          <span className="text-sm font-medium">9.8 years</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div className="bg-blue-600 h-2 rounded-full" style={{ width: '30.6%' }}></div>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm">Projected Total</span>
                          <span className="text-sm font-medium">32 years</span>
                        </div>
                      </div>
                    </div>

                    {/* Family Security */}
                    <div className="space-y-3">
                      <h4 className="font-semibold text-gray-900">Family Security</h4>
                      <div className="space-y-2">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-green-600">₹3,428</div>
                          <p className="text-sm text-muted-foreground">Family pension</p>
                        </div>
                        <div className="text-xs text-gray-600 text-center">
                          50% pension to spouse
                        </div>
                      </div>
                    </div>

                    {/* Retirement Corpus Equivalent */}
                    <div className="space-y-3">
                      <h4 className="font-semibold text-gray-900">Corpus Equivalent</h4>
                      <div className="space-y-2">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-purple-600">₹17.1L</div>
                          <p className="text-sm text-muted-foreground">@4% withdrawal</p>
                        </div>
                        <div className="text-xs text-gray-600 text-center">
                          Equivalent corpus needed for same income
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Contribution Timeline Chart */}
                  <div className="mt-6 pt-6 border-t">
                    <h4 className="font-semibold text-gray-900 mb-4">9+ Year Contribution History</h4>
                    <div className="grid grid-cols-10 gap-1">
                      {Array.from({ length: 10 }, (_, i) => (
                        <div key={i} className="text-center">
                          <div className="bg-blue-100 rounded-lg p-2 mb-2">
                            <div className="text-xs text-muted-foreground">{2015 + i}</div>
                            <div className="text-sm font-bold text-blue-600">₹{Math.floor(12000 + i * 1500)}</div>
                          </div>
                          <div className="bg-blue-600 mx-auto rounded" 
                               style={{ 
                                 width: '100%', 
                                 height: `${15 + i * 3}px` 
                               }}>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Future Projections */}
                  <div className="mt-6 pt-6 border-t">
                    <h4 className="font-semibold text-gray-900 mb-4">Pension Growth Projection</h4>
                    <div className="grid grid-cols-4 gap-4">
                      <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg">
                        <p className="text-sm text-blue-600 font-medium">Year 15</p>
                        <p className="text-xl font-bold text-blue-800">₹3,214</p>
                        <p className="text-xs text-blue-600">Monthly pension</p>
                      </div>
                      <div className="text-center p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-lg">
                        <p className="text-sm text-green-600 font-medium">Year 20</p>
                        <p className="text-xl font-bold text-green-800">₹4,286</p>
                        <p className="text-xs text-green-600">Monthly pension</p>
                      </div>
                      <div className="text-center p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg">
                        <p className="text-sm text-purple-600 font-medium">Year 25</p>
                        <p className="text-xl font-bold text-purple-800">₹5,357</p>
                        <p className="text-xs text-purple-600">Monthly pension</p>
                      </div>
                      <div className="text-center p-4 bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg">
                        <p className="text-sm text-orange-600 font-medium">Retirement</p>
                        <p className="text-xl font-bold text-orange-800">₹6,857</p>
                        <p className="text-xs text-orange-600">Monthly pension</p>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-4 mt-6 pt-4 border-t">
                    <Button variant="outline" size="sm">
                      View Pension Passbook
                    </Button>
                    <Button variant="outline" size="sm">
                      Download Certificate
                    </Button>
                    <Button variant="outline" size="sm">
                      Update Nominee
                    </Button>
                    <Button variant="outline" size="sm">
                      Calculate Pension
                    </Button>
                    <Button variant="outline" size="sm">
                      Transfer Request
                    </Button>
                  </div>
                </CardContent>
              </Card>
                  </div>
                ))}
              </div>
              )}
            </ConsentAwareSchemeTab>
          </TabsContent>

          <TabsContent value="rebalance" className="space-y-8">
            {/* PAN Verification Banner */}
            <div className="flex items-center mb-6 p-3 bg-green-50 border border-green-200 rounded-lg">
              <Shield className="h-4 w-4 text-green-600 mr-2" />
              <span className="text-sm text-green-700">
                AI rebalancing analysis using your PAN-verified portfolio data for secure recommendations
              </span>
            </div>

            {/* Enhanced AI Rebalancing Dashboard */}
            <div className="space-y-8">
              {/* Portfolio Risk & Performance Analysis */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="border-l-4 border-blue-500">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center">
                      <TrendingUp className="h-5 w-5 text-blue-600 mr-2" />
                      Risk Score
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-blue-600 mb-2">7.3/10</div>
                    <p className="text-sm text-gray-600 mb-3">Moderate-High Risk</p>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className="bg-blue-600 h-2 rounded-full" style={{ width: '73%' }}></div>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">Based on asset allocation & volatility</p>
                  </CardContent>
                </Card>

                <Card className="border-l-4 border-green-500">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center">
                      <Target className="h-5 w-5 text-green-600 mr-2" />
                      Diversification
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-green-600 mb-2">85%</div>
                    <p className="text-sm text-gray-600 mb-3">Well Diversified</p>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className="bg-green-600 h-2 rounded-full" style={{ width: '85%' }}></div>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">Across 4 asset classes & sectors</p>
                  </CardContent>
                </Card>

                <Card className="border-l-4 border-orange-500">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center">
                      <AlertTriangle className="h-5 w-5 text-orange-600 mr-2" />
                      Rebalance Urgency
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-orange-600 mb-2">Medium</div>
                    <p className="text-sm text-gray-600 mb-3">Action Recommended</p>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className="bg-orange-600 h-2 rounded-full" style={{ width: '60%' }}></div>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">2 allocations need adjustment</p>
                  </CardContent>
                </Card>
              </div>

              {/* Smart Rebalancing Recommendations */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-xl flex items-center">
                    <Bot className="h-6 w-6 text-purple-600 mr-3" />
                    AI-Powered Rebalancing Recommendations
                  </CardTitle>
                  <p className="text-gray-600">Intelligent suggestions based on market conditions, risk profile, and tax efficiency</p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {/* Equity Rebalancing */}
                    <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          <div className="w-4 h-4 bg-blue-600 rounded-full"></div>
                          <h4 className="font-semibold text-gray-900">Equity Allocation</h4>
                          <Badge variant="outline" className="text-orange-600 border-orange-600">Action Needed</Badge>
                        </div>
                        <div className="text-right">
                          <span className="text-sm text-gray-600">Current: 72% | Target: 65%</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
                        <div>
                          <p className="text-sm text-gray-600">Current Value</p>
                          <p className="font-bold text-blue-600">₹32,88,880</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Target Value</p>
                          <p className="font-bold text-green-600">₹29,69,128</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Action Required</p>
                          <p className="font-bold text-red-600">Sell ₹3,19,752</p>
                        </div>
                      </div>
                      <div className="mb-3">
                        <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
                          <span>Current vs Target</span>
                          <span>72% → 65%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div className="bg-blue-600 h-2 rounded-full relative" style={{ width: '72%' }}>
                            <div className="absolute right-0 top-0 w-1 h-2 bg-green-600"></div>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-gray-700"><strong>AI Recommendation:</strong> Reduce exposure to large-cap stocks, focus on profit booking in overvalued positions</p>
                        <Button size="sm" variant="outline" className="text-blue-600 border-blue-600">
                          View Details
                        </Button>
                      </div>
                    </div>

                    {/* Debt Rebalancing */}
                    <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          <div className="w-4 h-4 bg-green-600 rounded-full"></div>
                          <h4 className="font-semibold text-gray-900">Debt Allocation</h4>
                          <Badge variant="outline" className="text-blue-600 border-blue-600">Increase</Badge>
                        </div>
                        <div className="text-right">
                          <span className="text-sm text-gray-600">Current: 18% | Target: 25%</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
                        <div>
                          <p className="text-sm text-gray-600">Current Value</p>
                          <p className="font-bold text-blue-600">₹8,22,220</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Target Value</p>
                          <p className="font-bold text-green-600">₹11,41,972</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Action Required</p>
                          <p className="font-bold text-green-600">Buy ₹3,19,752</p>
                        </div>
                      </div>
                      <div className="mb-3">
                        <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
                          <span>Current vs Target</span>
                          <span>18% → 25%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div className="bg-green-600 h-2 rounded-full relative" style={{ width: '25%' }}>
                            <div className="absolute left-0 top-0 h-2 bg-green-400" style={{ width: '72%' }}></div>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-gray-700"><strong>AI Recommendation:</strong> Invest in high-grade corporate bonds and government securities for stability</p>
                        <Button size="sm" variant="outline" className="text-green-600 border-green-600">
                          View Options
                        </Button>
                      </div>
                    </div>

                    {/* Gold & Alternative Investments */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <div className="w-3 h-3 bg-yellow-600 rounded-full"></div>
                            <h5 className="font-semibold text-gray-900">Gold</h5>
                            <Badge variant="outline" className="text-green-600 border-green-600 text-xs">Optimal</Badge>
                          </div>
                        </div>
                        <p className="text-sm text-gray-600 mb-1">Current: 5% | Target: 5%</p>
                        <p className="text-xs text-gray-700">No action needed. Maintain current allocation.</p>
                      </div>

                      <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <div className="w-3 h-3 bg-purple-600 rounded-full"></div>
                            <h5 className="font-semibold text-gray-900">Alternatives</h5>
                            <Badge variant="outline" className="text-green-600 border-green-600 text-xs">Optimal</Badge>
                          </div>
                        </div>
                        <p className="text-sm text-gray-600 mb-1">Current: 5% | Target: 5%</p>
                        <p className="text-xs text-gray-700">REITs and commodities well balanced.</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Interactive Rebalancing Simulator */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-xl flex items-center">
                    <Calculator className="h-6 w-6 text-indigo-600 mr-3" />
                    Rebalancing Simulator & Scenario Analysis
                  </CardTitle>
                  <p className="text-gray-600">Test different allocation strategies and see projected outcomes</p>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Scenario Selection */}
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-4">Choose Rebalancing Scenario</h4>
                      <div className="space-y-3">
                        <div className="p-3 border border-blue-200 rounded-lg bg-blue-50 cursor-pointer">
                          <div className="flex items-center justify-between">
                            <div>
                              <h5 className="font-medium text-blue-900">Conservative (Risk Score: 5.5)</h5>
                              <p className="text-sm text-blue-700">Equity: 55% | Debt: 35% | Gold: 7% | Alt: 3%</p>
                            </div>
                            <input type="radio" name="scenario" className="text-blue-600" defaultChecked />
                          </div>
                        </div>
                        <div className="p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                          <div className="flex items-center justify-between">
                            <div>
                              <h5 className="font-medium text-gray-900">Balanced (Risk Score: 7.0)</h5>
                              <p className="text-sm text-gray-600">Equity: 65% | Debt: 25% | Gold: 5% | Alt: 5%</p>
                            </div>
                            <input type="radio" name="scenario" className="text-gray-600" />
                          </div>
                        </div>
                        <div className="p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                          <div className="flex items-center justify-between">
                            <div>
                              <h5 className="font-medium text-gray-900">Aggressive (Risk Score: 8.5)</h5>
                              <p className="text-sm text-gray-600">Equity: 80% | Debt: 15% | Gold: 3% | Alt: 2%</p>
                            </div>
                            <input type="radio" name="scenario" className="text-gray-600" />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Projected Outcomes */}
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-4">Projected Outcomes (Conservative)</h4>
                      <div className="space-y-4">
                        <div className="p-3 bg-green-50 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-green-900">Expected Annual Return</span>
                            <span className="font-bold text-green-600">10.5%</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-green-900">Risk Level</span>
                            <span className="font-bold text-green-600">Low-Medium</span>
                          </div>
                        </div>
                        <div className="p-3 bg-blue-50 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-blue-900">Portfolio Value (5 years)</span>
                            <span className="font-bold text-blue-600">₹74.2L</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-blue-900">Potential Gain</span>
                            <span className="font-bold text-blue-600">+₹28.5L</span>
                          </div>
                        </div>
                        <div className="p-3 bg-yellow-50 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-yellow-900">Tax Efficiency</span>
                            <span className="font-bold text-yellow-600">High</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-yellow-900">Estimated Tax Savings</span>
                            <span className="font-bold text-yellow-600">₹1.2L/year</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t">
                    <div className="flex items-center justify-between">
                      <div>
                        <h5 className="font-semibold text-gray-900">Tax-Efficient Rebalancing Timeline</h5>
                        <p className="text-sm text-gray-600">Optimal execution to minimize tax impact</p>
                      </div>
                      <Button className="bg-indigo-600 text-white hover:bg-indigo-700">
                        Generate Execution Plan
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Execution Actions */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-xl flex items-center">
                    <TrendingUp className="h-6 w-6 text-green-600 mr-3" />
                    Execute Rebalancing
                  </CardTitle>
                  <p className="text-gray-600">One-click execution with built-in safeguards</p>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="text-center p-4 bg-red-50 rounded-lg">
                      <p className="text-sm text-gray-600 mb-1">Total Sell Orders</p>
                      <p className="text-2xl font-bold text-red-600">₹3.19L</p>
                      <p className="text-xs text-gray-500">2 transactions</p>
                    </div>
                    <div className="text-center p-4 bg-green-50 rounded-lg">
                      <p className="text-sm text-gray-600 mb-1">Total Buy Orders</p>
                      <p className="text-2xl font-bold text-green-600">₹3.19L</p>
                      <p className="text-xs text-gray-500">3 transactions</p>
                    </div>
                    <div className="text-center p-4 bg-blue-50 rounded-lg">
                      <p className="text-sm text-gray-600 mb-1">Estimated Fees</p>
                      <p className="text-2xl font-bold text-blue-600">₹850</p>
                      <p className="text-xs text-gray-500">All inclusive</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t">
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-2">
                        <input type="checkbox" id="confirm-execution" className="rounded border-gray-300" />
                        <label htmlFor="confirm-execution" className="text-sm text-gray-700">
                          I understand the tax implications and execution costs
                        </label>
                      </div>
                    </div>
                    <div className="flex space-x-3">
                      <Button variant="outline">
                        Save as Draft
                      </Button>
                      <Button className="bg-green-600 text-white hover:bg-green-700" disabled>
                        Execute Rebalancing
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

      </main>

      <Footer />

      {/* Consent Dialog */}
      {user?.panNumber && (
        <ConsentDialog
          isOpen={consentDialogOpen}
          onOpenChange={setConsentDialogOpen}
          panNumber={user.panNumber}
          schemeType={currentSchemeType}
          onConsentGranted={handleConsentGranted}
        />
      )}
    </div>
  );
}
