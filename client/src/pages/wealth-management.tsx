import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Target, 
  TrendingUp, 
  Shield,
  Calculator,
  PieChart,
  CreditCard,
  BarChart3,
  Users,
  Building2,
  Home,
  GraduationCap,
  Heart,
  Calendar,
  IndianRupee,
  Briefcase,
  Zap,
  CheckCircle,
  Lightbulb,
  Clock,
  FileText,
  Star
} from "lucide-react";
import { GoalPlanning } from "@/components/wealth/goal-planning";
import { ObligationMapping } from "@/components/wealth/obligation-mapping";
import { RetirementPlanning } from "@/components/wealth/retirement-planning";
import { RiskAssessment } from "@/components/wealth/risk-assessment";
import { InvestmentRecommendations } from "@/components/wealth/investment-recommendations";
import { Proposals } from "@/components/wealth/proposals";

interface FinancialAnalysis {
  monthlyIncome: number;
  annualIncome: number;
  monthlyObligations: number;
  availableForInvestment: number;
  currentInvestments: number;
  additionalCapacity: number;
  obligationRatio: number;
  totalPortfolioValue: number;
  totalReturns: number;
  returnPercentage: number;
  creditScore?: number;
}

interface PortfolioHolding {
  id: string;
  portfolioId: string;
  symbol: string;
  quantity: string;
  avgPrice: string;
  currency: string;
  assetType: string;
  assetClass: string | null;
  sector: string | null;
  marketCap: string | null;
  beta: string | null;
  dividendYield: string | null;
  peRatio: string | null;
  updatedAt: string;
}

function ReturnForecast({ holdings }: { holdings: PortfolioHolding[] }) {
  const { data: returnData, isLoading } = useQuery({
    queryKey: ['/api/returns/portfolio', holdings.map(h => h.id).join(',')],
    queryFn: async () => {
      const assets = holdings.map(h => ({
        assetId: h.id,
        assetType: (h.assetType.toLowerCase().includes('fund') ? 'mutual_fund' : 
                   h.assetType.toLowerCase().includes('bond') ? 'bond' : 
                   h.assetType.toLowerCase().includes('gold') ? 'gold' : 'equity') as any,
        assetName: h.symbol,
        currentValue: (parseFloat(h.quantity) || 0) * (parseFloat(h.avgPrice) || 0), // Use avgPrice as current for mock
        investedAmount: (parseFloat(h.quantity) || 0) * (parseFloat(h.avgPrice) || 0),
        inceptionDate: h.updatedAt || new Date().toISOString(),
      }));

      if (assets.length === 0) return null;

      const res = await fetch('/api/returns/portfolio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assets }),
      });
      if (!res.ok) throw new Error('Failed to fetch return forecast');
      return res.json();
    },
    enabled: holdings.length > 0,
  });

  if (isLoading) return <div className="p-8 text-center"><Skeleton className="h-64 w-full" /></div>;
  if (!returnData || !returnData.success) return <div className="p-8 text-center text-muted-foreground border rounded-lg bg-card">No return data available. Add holdings to see forecasting.</div>;

  const { portfolio, assets } = returnData.data;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-950/20 dark:to-blue-950/20 border-indigo-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-indigo-800 dark:text-indigo-300">Portfolio CAGR</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-indigo-700 dark:text-indigo-400">{portfolio.cagr.toFixed(2)}%</div>
            <p className="text-xs text-indigo-600 mt-1">Weighted average annual growth</p>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20 border-emerald-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-emerald-800 dark:text-emerald-300">Expected 1Y Gain</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-emerald-700 dark:text-emerald-400">₹{((portfolio.currentValue * portfolio.cagr) / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</div>
            <p className="text-xs text-emerald-600 mt-1">Projected absolute gain</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 border-amber-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-amber-800 dark:text-amber-300">Portfolio Volatility</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-amber-700 dark:text-amber-400">{portfolio.volatility.toFixed(1)}%</div>
            <p className="text-xs text-amber-600 mt-1">Estimated risk profile</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Asset-Wise Return Metrics
          </CardTitle>
          <CardDescription>Detailed forecasting and risk analysis per asset</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {assets.map((asset: any) => (
              <div key={asset.id} className="p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h4 className="font-bold text-lg">{asset.name}</h4>
                    <Badge variant="outline" className="mt-1">{asset.type.replace('_', ' ')}</Badge>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Portfolio Weight</p>
                    <p className="font-semibold">{asset.weight.toFixed(1)}%</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t">
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase">Annualized Return</p>
                    <p className="font-bold text-green-600">{(asset.metrics?.annualizedReturn || 0).toFixed(2)}%</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase">Absolute Return</p>
                    <p className="font-bold">{(asset.metrics?.absoluteReturn || 0).toFixed(2)}%</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase">Holding Period</p>
                    <p className="font-bold">{(asset.metrics?.holdingPeriodYears || 0).toFixed(2)} Yrs</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase">Risk Rating</p>
                    <Badge variant="secondary" className="mt-1">
                      {asset.weight > 40 ? 'High' : asset.weight > 20 ? 'Medium' : 'Low'}
                    </Badge>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function PremiumInvestments() {
  const [location] = useLocation();
  const { user } = useAuth();
  
  // Get tab from URL query parameter
  const searchParams = new URLSearchParams(location.split('?')[1] || '');
  const tabFromUrl = searchParams.get('tab') || 'dashboard';
  
  const [activeTab, setActiveTab] = useState(tabFromUrl);

  // Update active tab when URL changes
  useEffect(() => {
    const params = new URLSearchParams(location.split('?')[1] || '');
    const tab = params.get('tab') || 'dashboard';
    setActiveTab(tab);
  }, [location]);

  // Fetch user portfolios
  const { data: portfolios } = useQuery({
    queryKey: ['/api/portfolios', user?.id],
    enabled: !!user?.id,
  });
  const portfolioId = (portfolios && Array.isArray(portfolios) && portfolios.length > 0) ? portfolios[0]?.id : '';

  // Fetch portfolio holdings automatically
  const { data: holdings, isLoading: holdingsLoading } = useQuery<PortfolioHolding[]>({
    queryKey: ['/api/portfolios', portfolioId, 'holdings'],
    enabled: !!portfolioId,
  });

  // Fetch real-time financial analysis data
  const { data: financialAnalysis, isLoading, error } = useQuery<FinancialAnalysis>({
    queryKey: ['/api/wealth-management/analysis'],
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-muted p-6">
        <div className="max-w-7xl mx-auto space-y-8">
          <div className="text-center space-y-2">
            <Skeleton className="h-12 w-96 mx-auto" />
            <Skeleton className="h-6 w-full max-w-2xl mx-auto" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !financialAnalysis) {
    return (
      <div className="min-h-screen bg-muted p-6">
        <div className="max-w-7xl mx-auto space-y-8">
          <div className="text-center space-y-2">
            <h1 className="text-4xl font-bold text-foreground">FintekPro Premium Investments</h1>
            <p className="text-xl text-muted-foreground">Elite investment opportunities for sophisticated investors</p>
          </div>
          <Alert className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950/30">
            <AlertDescription className="text-center">
              <p className="font-medium mb-2">Complete Your Profile to Access Wealth Management</p>
              <p className="text-sm text-muted-foreground">
                Please complete your financial profile and KYC verification to unlock personalized investment recommendations and wealth management features.
              </p>
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-foreground">FintekPro Premium Investments</h1>
          <p className="text-xl text-muted-foreground">
            Access REITs, InvITs, PMS & AIF with your {formatCurrency(financialAnalysis.additionalCapacity)} monthly surplus - Elite investment opportunities for sophisticated investors
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <ScrollableTabsList className="grid w-full grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1">
            <TabsTrigger value="dashboard" data-testid="tab-dashboard">
              <BarChart3 className="w-4 h-4 mr-2" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="recommendations" data-testid="tab-recommendations">
              <Lightbulb className="w-4 h-4 mr-2" />
              AI Insights
            </TabsTrigger>
            <TabsTrigger value="goals" data-testid="tab-goals">
              <Target className="w-4 h-4 mr-2" />
              Goal Planning
            </TabsTrigger>
            <TabsTrigger value="returns" data-testid="tab-returns">
              <TrendingUp className="w-4 h-4 mr-2" />
              Return Forecast
            </TabsTrigger>
            <TabsTrigger value="retirement" data-testid="tab-retirement">
              <Shield className="w-4 h-4 mr-2" />
              Retirement
            </TabsTrigger>
            <TabsTrigger value="obligations" data-testid="tab-obligations">
              <CreditCard className="w-4 h-4 mr-2" />
              Credit Obligations
            </TabsTrigger>
          </ScrollableTabsList>

          {/* Investment Opportunity Dashboard */}
          <TabsContent value="dashboard" className="space-y-6">
            
            {/* Investment Capacity Analysis */}
            <Card data-testid="card-investment-capacity" className="bg-gradient-to-r from-green-50 dark:from-green-950/30 to-emerald-50 dark:to-emerald-950/30 border-green-200 dark:border-green-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-green-800 dark:text-green-200">
                  <TrendingUp className="w-6 h-6 text-green-600" />
                  🚀 Your Investment Opportunity
                </CardTitle>
                <CardDescription className="text-green-700 dark:text-green-300">
                  Based on CIBIL analysis, you have significant untapped investment potential
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="text-center p-4 bg-card rounded-lg border border-green-200 dark:border-green-800">
                    <div className="text-3xl font-bold text-green-600 mb-2">{formatCurrency(financialAnalysis.additionalCapacity)}</div>
                    <p className="text-sm font-medium text-green-800 dark:text-green-200">Available for New Investments</p>
                    <p className="text-xs text-green-600 mt-1">Monthly surplus after obligations</p>
                  </div>
                  
                  <div className="text-center p-4 bg-card rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="text-3xl font-bold text-blue-600 mb-2">{financialAnalysis.obligationRatio}%</div>
                    <p className="text-sm font-medium text-blue-800 dark:text-blue-200">Obligation Ratio</p>
                    <p className="text-xs text-blue-600 mt-1">Healthy debt-to-income ratio</p>
                  </div>
                  
                  <div className="text-center p-4 bg-card rounded-lg border border-purple-200 dark:border-purple-800">
                    <div className="text-3xl font-bold text-purple-600 mb-2">{financialAnalysis.creditScore}</div>
                    <p className="text-sm font-medium text-purple-800 dark:text-purple-200">Credit Score</p>
                    <p className="text-xs text-purple-600 mt-1">Excellent for investment loans</p>
                  </div>
                </div>
                
                <div className="mt-6 text-center">
                  <Button 
                    size="lg"
                    className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-foreground"
                    onClick={() => setActiveTab("recommendations")}
                    data-testid="button-start-investing"
                  >
                    <IndianRupee className="w-5 h-5 mr-2" />
                    Start Investing Your Surplus ₹72,000/month
                  </Button>
                </div>
              </CardContent>
            </Card>
            

            {/* Current Portfolio Performance */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card data-testid="card-total-portfolio-value">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Current Portfolio</p>
                      <p className="text-2xl font-bold">{formatCurrency(financialAnalysis.totalPortfolioValue)}</p>
                      <p className="text-xs text-green-600">+{financialAnalysis.returnPercentage}% returns</p>
                    </div>
                    <TrendingUp className="w-8 h-8 text-green-500" />
                  </div>
                </CardContent>
              </Card>

              <Card data-testid="card-monthly-income" className="border-blue-200 dark:border-blue-800">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Monthly Income</p>
                      <p className="text-2xl font-bold text-blue-600">{formatCurrency(financialAnalysis.monthlyIncome)}</p>
                      <p className="text-xs text-blue-600">Verified income</p>
                    </div>
                    <Briefcase className="w-8 h-8 text-blue-500" />
                  </div>
                </CardContent>
              </Card>

              <Card data-testid="card-monthly-obligations" className="border-red-200 dark:border-red-800">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Monthly Obligations</p>
                      <p className="text-2xl font-bold text-red-600">{formatCurrency(financialAnalysis.monthlyObligations)}</p>
                      <p className="text-xs text-red-600">From CIBIL report</p>
                    </div>
                    <CreditCard className="w-8 h-8 text-red-500" />
                  </div>
                </CardContent>
              </Card>

              <Card data-testid="card-investment-surplus" className="border-green-200 dark:border-green-800">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Investment Surplus</p>
                      <p className="text-2xl font-bold text-green-600">{formatCurrency(financialAnalysis.availableForInvestment)}</p>
                      <p className="text-xs text-green-600">Available monthly</p>
                    </div>
                    <IndianRupee className="w-8 h-8 text-green-500" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Portfolio Holdings - Auto-fetched */}
            <Card data-testid="card-portfolio-holdings">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-indigo-600" />
                  Your Holdings
                </CardTitle>
                <CardDescription>
                  Real-time view of your investment portfolio
                </CardDescription>
              </CardHeader>
              <CardContent>
                {holdingsLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-24" />
                          <Skeleton className="h-3 w-16" />
                        </div>
                        <div className="text-right space-y-2">
                          <Skeleton className="h-4 w-20" />
                          <Skeleton className="h-3 w-12" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : holdings && holdings.length > 0 ? (
                  <div className="space-y-3 max-h-[400px] overflow-y-auto">
                    {holdings.map((holding) => {
                      const quantity = parseFloat(holding.quantity) || 0;
                      const avgPrice = parseFloat(holding.avgPrice) || 0;
                      const investedValue = quantity * avgPrice;
                      
                      return (
                        <div 
                          key={holding.id} 
                          className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted transition-colors"
                          data-testid={`holding-${holding.symbol}`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 flex items-center justify-center text-foreground font-semibold text-sm">
                              {holding.symbol.slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-semibold text-foreground">{holding.symbol}</p>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">
                                  {holding.assetType}
                                </Badge>
                                <Badge variant="secondary" className={`text-xs ${
                                  holding.sector === "Mutual Fund" || (holding as any).dataSource === "AA" || (holding as any).dataSource === "CAS"
                                    ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                                    : (holding as any).dataSource === "NSDL" || (holding as any).dataSource === "CDSL"
                                    ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                                    : "bg-muted text-muted-foreground"
                                }`}>
                                  {(holding as any).dataSource || "Manual"}
                                </Badge>
                                {holding.sector && (
                                  <span className="text-xs text-muted-foreground">{holding.sector}</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-foreground">{formatCurrency(investedValue)}</p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span>{quantity.toFixed(2)} units</span>
                              <span>@</span>
                              <span>{formatCurrency(avgPrice)}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                      <BarChart3 className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground mb-2">No Holdings Yet</h3>
                    <p className="text-muted-foreground mb-4">
                      Start building your investment portfolio today
                    </p>
                    <Button 
                      onClick={() => setActiveTab("recommendations")}
                      className="bg-gradient-to-r from-indigo-600 to-purple-600"
                      data-testid="button-start-investing-holdings"
                    >
                      <TrendingUp className="w-4 h-4 mr-2" />
                      Explore Investment Options
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Credit & Obligations Overview */}
            <Card data-testid="card-credit-obligations">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-blue-600" />
                  Credit Obligations Overview
                </CardTitle>
                <CardDescription>Real-time CIBIL data integration for comprehensive obligation tracking</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="p-4 bg-gradient-to-r from-blue-50 dark:from-blue-950/30 to-indigo-50 dark:to-indigo-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="flex items-center gap-3 mb-3">
                      <CreditCard className="w-6 h-6 text-blue-600" />
                      <div>
                        <p className="font-semibold text-blue-900 dark:text-blue-100">Credit Cards</p>
                        <p className="text-sm text-blue-700 dark:text-blue-300">Active accounts & utilization</p>
                      </div>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setActiveTab("obligations")}
                      data-testid="button-view-credit-cards"
                      className="w-full border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:bg-blue-900/30"
                    >
                      View Details
                    </Button>
                  </div>
                  
                  <div className="p-4 bg-gradient-to-r from-green-50 dark:from-green-950/30 to-emerald-50 dark:to-emerald-950/30 rounded-lg border border-green-200 dark:border-green-800">
                    <div className="flex items-center gap-3 mb-3">
                      <Building2 className="w-6 h-6 text-green-600" />
                      <div>
                        <p className="font-semibold text-green-900 dark:text-green-100">Loans & EMIs</p>
                        <p className="text-sm text-green-700 dark:text-green-300">Active loans from CIBIL</p>
                      </div>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setActiveTab("obligations")}
                      data-testid="button-view-loans"
                      className="w-full border-green-300 dark:border-green-700 text-green-700 dark:text-green-300 hover:bg-green-100 dark:bg-green-900/30"
                    >
                      Sync CIBIL Data
                    </Button>
                  </div>
                  
                  <div className="p-4 bg-gradient-to-r from-purple-50 dark:from-purple-950/30 to-violet-50 dark:to-violet-950/30 rounded-lg border border-purple-200 dark:border-purple-800">
                    <div className="flex items-center gap-3 mb-3">
                      <Shield className="w-6 h-6 text-purple-600" />
                      <div>
                        <p className="font-semibold text-purple-900 dark:text-purple-100">Credit Health</p>
                        <p className="text-sm text-purple-700 dark:text-purple-300">Score & payment history</p>
                      </div>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setActiveTab("obligations")}
                      data-testid="button-view-credit-health"
                      className="w-full border-purple-300 dark:border-purple-700 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:bg-purple-900/30"
                    >
                      Check Score
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {/* InvestSmart Actions */}
            <Card data-testid="card-wealth-actions">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-yellow-600" />
                  Smart Wealth Actions
                </CardTitle>
                <CardDescription>AI-powered recommendations based on your CIBIL obligations</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Button 
                    variant="default" 
                    className="h-20 flex flex-col gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                    onClick={() => setActiveTab("recommendations")}
                    data-testid="button-smart-recommendations"
                  >
                    <Lightbulb className="w-6 h-6" />
                    <span className="text-sm">Smart Recommendations</span>
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    className="h-20 flex flex-col gap-2"
                    onClick={() => setActiveTab("goals")}
                    data-testid="button-plan-goals"
                  >
                    <Target className="w-6 h-6" />
                    <span className="text-sm">Financial Goals</span>
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    className="h-20 flex flex-col gap-2"
                    onClick={() => setActiveTab("risk")}
                    data-testid="button-assess-risk"
                  >
                    <PieChart className="w-6 h-6" />
                    <span className="text-sm">Risk Assessment</span>
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* CIBIL-Based Financial Health */}
            <Card data-testid="card-cibil-financial-health">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-blue-600" />
                  CIBIL-Based Financial Health
                </CardTitle>
                <CardDescription>Real-time credit health analysis from your CIBIL report</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="text-center">
                    <div className="text-4xl font-bold text-blue-600 mb-2">785</div>
                    <Badge variant="default" className="text-sm bg-blue-600">Very Good Credit Score</Badge>
                    <p className="text-sm text-muted-foreground mt-2">Based on latest CIBIL report</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <h4 className="font-medium">Credit Strengths</h4>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 p-2 bg-green-50 dark:bg-green-950/30 rounded">
                          <CheckCircle className="w-4 h-4 text-green-600" />
                          <span className="text-sm">Excellent payment history (100%)</span>
                        </div>
                        <div className="flex items-center gap-2 p-2 bg-green-50 dark:bg-green-950/30 rounded">
                          <CheckCircle className="w-4 h-4 text-green-600" />
                          <span className="text-sm">Low credit utilization (28%)</span>
                        </div>
                        <div className="flex items-center gap-2 p-2 bg-green-50 dark:bg-green-950/30 rounded">
                          <CheckCircle className="w-4 h-4 text-green-600" />
                          <span className="text-sm">Diverse credit mix</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h4 className="font-medium">Obligation Insights</h4>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 p-2 bg-blue-50 dark:bg-blue-950/30 rounded">
                          <CreditCard className="w-4 h-4 text-blue-600" />
                          <span className="text-sm">₹2.4L total monthly obligations</span>
                        </div>
                        <div className="flex items-center gap-2 p-2 bg-blue-50 dark:bg-blue-950/30 rounded">
                          <Calendar className="w-4 h-4 text-blue-600" />
                          <span className="text-sm">5 active credit accounts</span>
                        </div>
                        <div className="flex items-center gap-2 p-2 bg-blue-50 dark:bg-blue-950/30 rounded">
                          <TrendingUp className="w-4 h-4 text-blue-600" />
                          <span className="text-sm">Obligation ratio: 35% of income</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-center">
                    <Button 
                      onClick={() => setActiveTab("obligations")}
                      data-testid="button-view-full-obligations"
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      <CreditCard className="w-4 h-4 mr-2" />
                      View Complete Obligation Analysis
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Investment Opportunities to Accelerate Goals */}
            <Card data-testid="card-investment-opportunities">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="w-5 h-5 text-purple-600" />
                  🏆 Accelerate Your Goals with Smart Investments
                </CardTitle>
                <CardDescription>
                  With ₹72,000 monthly surplus, you can significantly boost your goal achievement timeline
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="p-4 bg-gradient-to-br from-blue-50 dark:from-blue-950/30 to-blue-100 dark:to-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2 bg-blue-600 text-white rounded-lg">
                        <Home className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-bold text-blue-900 dark:text-blue-100">Home Purchase Goal</p>
                        <p className="text-sm text-blue-700 dark:text-blue-300">₹50L target by 2028</p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="bg-card p-3 rounded border">
                        <p className="text-sm text-muted-foreground">Current Progress: 17%</p>
                        <div className="w-full bg-muted rounded-full h-2 mt-1">
                          <div className="bg-blue-600 h-2 rounded-full" style={{ width: '17%' }}></div>
                        </div>
                      </div>
                      <div className="bg-green-100 dark:bg-green-900/30 p-3 rounded border border-green-200 dark:border-green-800">
                        <p className="text-sm font-medium text-green-800 dark:text-green-200">With additional ₹30K SIP:</p>
                        <p className="text-lg font-bold text-green-900 dark:text-green-100">Achieve goal 2 years earlier!</p>
                        <p className="text-xs text-green-600">Projected completion: 2026</p>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-gradient-to-br from-green-50 dark:from-green-950/30 to-green-100 dark:to-green-900/30 rounded-lg border border-green-200 dark:border-green-800">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2 bg-green-600 text-white rounded-lg">
                        <GraduationCap className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-bold text-green-900 dark:text-green-100">Child Education</p>
                        <p className="text-sm text-green-700 dark:text-green-300">₹25L target by 2035</p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="bg-card p-3 rounded border">
                        <p className="text-sm text-muted-foreground">Current Progress: 13%</p>
                        <div className="w-full bg-muted rounded-full h-2 mt-1">
                          <div className="bg-green-600 h-2 rounded-full" style={{ width: '13%' }}></div>
                        </div>
                      </div>
                      <div className="bg-blue-100 dark:bg-blue-900/30 p-3 rounded border border-blue-200 dark:border-blue-800">
                        <p className="text-sm font-medium text-blue-800 dark:text-blue-200">With additional ₹20K SIP:</p>
                        <p className="text-lg font-bold text-blue-900 dark:text-blue-100">Ensure full coverage!</p>
                        <p className="text-xs text-blue-600">Zero education loan needed</p>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-gradient-to-br from-purple-50 dark:from-purple-950/30 to-purple-100 dark:to-purple-900/30 rounded-lg border border-purple-200 dark:border-purple-800">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2 bg-purple-600 text-white rounded-lg">
                        <Shield className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-bold text-purple-900 dark:text-purple-100">Retirement Fund</p>
                        <p className="text-sm text-purple-700 dark:text-purple-300">₹1.2Cr target by 2055</p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="bg-card p-3 rounded border">
                        <p className="text-sm text-muted-foreground">Current Progress: 4%</p>
                        <div className="w-full bg-muted rounded-full h-2 mt-1">
                          <div className="bg-purple-600 h-2 rounded-full" style={{ width: '4%' }}></div>
                        </div>
                      </div>
                      <div className="bg-orange-100 dark:bg-orange-900/30 p-3 rounded border border-orange-200 dark:border-orange-800">
                        <p className="text-sm font-medium text-orange-800 dark:text-orange-200">With additional ₹22K SIP:</p>
                        <p className="text-lg font-bold text-orange-900 dark:text-orange-100">Retire comfortably!</p>
                        <p className="text-xs text-orange-600">Maintain current lifestyle</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 p-6 bg-gradient-to-r from-emerald-600 to-green-600 rounded-lg text-foreground">
                  <div className="text-center space-y-4">
                    <h3 className="text-xl font-bold">💰 Start Your Wealth Acceleration Today!</h3>
                    <p className="text-emerald-100">Your excellent credit profile and surplus income make this the perfect time to invest</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                      <Button 
                        size="lg"
                        variant="secondary"
                        onClick={() => setActiveTab("goals")}
                        data-testid="button-set-investment-goals"
                        className="bg-card text-green-700 dark:text-green-300 hover:bg-muted"
                      >
                        <Target className="w-4 h-4 mr-2" />
                        Set Investment Goals
                      </Button>
                      <Button 
                        size="lg"
                        variant="secondary"
                        onClick={() => setActiveTab("recommendations")}
                        data-testid="button-get-recommendations"
                        className="bg-card text-green-700 dark:text-green-300 hover:bg-muted"
                      >
                        <Lightbulb className="w-4 h-4 mr-2" />
                        Get AI Recommendations
                      </Button>
                      <Button 
                        size="lg"
                        variant="secondary"
                        onClick={() => setActiveTab("risk")}
                        data-testid="button-assess-risk-profile"
                        className="bg-card text-green-700 dark:text-green-300 hover:bg-muted"
                      >
                        <PieChart className="w-4 h-4 mr-2" />
                        Assess Risk Profile
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Premium Investment Opportunities */}
            <Card data-testid="card-premium-investments" className="bg-gradient-to-r from-amber-50 dark:from-amber-950/30 to-orange-50 dark:to-orange-950/30 border-amber-200 dark:border-amber-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
                  <Star className="w-6 h-6 text-amber-600" />
                  🏆 Premium Investment Opportunities
                </CardTitle>
                <CardDescription className="text-amber-700 dark:text-amber-300">
                  Sophisticated investment products tailored for your ₹72,000 monthly surplus capacity
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                  
                  {/* REITs & InvITs */}
                  <Card data-testid="card-reits-invits" className="border-2 border-blue-200 dark:border-blue-800 hover:border-blue-300 dark:border-blue-700 transition-colors">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Building2 className="w-6 h-6 text-blue-600" />
                        <div>
                          <h4 className="font-semibold text-blue-900 dark:text-blue-100">REITs & InvITs</h4>
                          <p className="text-xs text-blue-600">Real Estate & Infrastructure</p>
                        </div>
                      </div>
                      <div className="space-y-2 mb-4">
                        <Badge variant="secondary" className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 text-xs">1-Year LTCG (New)</Badge>
                        <Badge variant="secondary" className="bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 text-xs">₹1.25L Tax Exemption</Badge>
                        <div className="text-sm font-medium text-blue-900 dark:text-blue-100">Expected Yield: 7-9%</div>
                        <div className="text-xs text-blue-600">Minimum: ₹10,000-₹25,000</div>
                      </div>
                      <div className="text-xs text-muted-foreground mb-3">
                        <p>✓ Embassy Office Parks REIT: 7.2%</p>
                        <p>✓ Mindspace Business Parks: 6.8%</p>
                        <p>✓ PowerGrid InvIT: 7.5%</p>
                      </div>
                      <Button size="sm" className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                        Invest ₹{(financialAnalysis.additionalCapacity * 0.15).toLocaleString('en-IN')}/month
                      </Button>
                    </CardContent>
                  </Card>

                  {/* Portfolio Management Services */}
                  <Card data-testid="card-pms" className="border-2 border-purple-200 dark:border-purple-800 hover:border-purple-300 dark:border-purple-700 transition-colors">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <PieChart className="w-6 h-6 text-purple-600" />
                        <div>
                          <h4 className="font-semibold text-purple-900 dark:text-purple-100">PMS</h4>
                          <p className="text-xs text-purple-600">Portfolio Management</p>
                        </div>
                      </div>
                      <div className="space-y-2 mb-4">
                        <Badge variant="secondary" className="bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200 text-xs">Min: ₹50L</Badge>
                        <Badge variant="secondary" className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 text-xs">Professional Management</Badge>
                        <div className="text-sm font-medium text-purple-900 dark:text-purple-100">Expected Returns: 12-18%</div>
                        <div className="text-xs text-purple-600">Fee: 2-3% + Performance</div>
                      </div>
                      <div className="text-xs text-muted-foreground mb-3">
                        <p>✓ ICICI Prudential PMS: 15.2%</p>
                        <p>✓ HDFC Portfolio Management: 14.8%</p>
                        <p>✓ Kotak Mahindra PMS: 16.1%</p>
                      </div>
                      <div className="text-xs text-green-600 mb-2">
                        With ₹72K/month: Reach ₹50L in {Math.ceil(5000000 / financialAnalysis.additionalCapacity)} months
                      </div>
                      <Button size="sm" variant="outline" className="w-full border-purple-300 dark:border-purple-700 text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:bg-purple-950/30">
                        Track Progress to ₹50L
                      </Button>
                    </CardContent>
                  </Card>

                  {/* Alternative Investment Funds */}
                  <Card data-testid="card-aif" className="border-2 border-indigo-200 dark:border-indigo-800 hover:border-indigo-300 dark:border-indigo-700 transition-colors">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <TrendingUp className="w-6 h-6 text-indigo-600" />
                        <div>
                          <h4 className="font-semibold text-indigo-900 dark:text-indigo-100">AIF</h4>
                          <p className="text-xs text-indigo-600">Alternative Investment Funds</p>
                        </div>
                      </div>
                      <div className="space-y-2 mb-4">
                        <Badge variant="secondary" className="bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-200 text-xs">Min: ₹1Cr</Badge>
                        <Badge variant="secondary" className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 text-xs">High Return Potential</Badge>
                        <div className="text-sm font-medium text-indigo-900 dark:text-indigo-100">Expected Returns: 15-25%</div>
                        <div className="text-xs text-indigo-600">Category I/II/III</div>
                      </div>
                      <div className="text-xs text-muted-foreground mb-3">
                        <p>✓ PE/VC Funds (Cat I): 18-22%</p>
                        <p>✓ Debt Funds (Cat II): 12-16%</p>
                        <p>✓ Hedge Funds (Cat III): 15-25%</p>
                      </div>
                      <div className="text-xs text-green-600 mb-2">
                        With ₹72K/month: Reach ₹1Cr in {Math.ceil(10000000 / financialAnalysis.additionalCapacity)} months
                      </div>
                      <Button size="sm" variant="outline" className="w-full border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:bg-indigo-950/30">
                        Track Progress to ₹1Cr
                      </Button>
                    </CardContent>
                  </Card>

                  {/* High-Yield Bonds & Debentures */}
                  <Card data-testid="card-bonds" className="border-2 border-green-200 dark:border-green-800 hover:border-green-300 dark:border-green-700 transition-colors">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <FileText className="w-6 h-6 text-green-600" />
                        <div>
                          <h4 className="font-semibold text-green-900 dark:text-green-100">Premium Bonds</h4>
                          <p className="text-xs text-green-600">High-Yield Fixed Income</p>
                        </div>
                      </div>
                      <div className="space-y-2 mb-4">
                        <Badge variant="secondary" className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 text-xs">Fixed Returns</Badge>
                        <Badge variant="secondary" className="bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 text-xs">Lower Risk</Badge>
                        <div className="text-sm font-medium text-green-900 dark:text-green-100">Yields: 8-12%</div>
                        <div className="text-xs text-green-600">Minimum: ₹10,000</div>
                      </div>
                      <div className="text-xs text-muted-foreground mb-3">
                        <p>✓ Corporate Bonds: 9-11%</p>
                        <p>✓ Tax-Free Bonds: 5.5-6.5%</p>
                        <p>✓ NCDs: 8-12%</p>
                      </div>
                      <Button size="sm" className="w-full bg-green-600 hover:bg-green-700 text-white">
                        Invest ₹{(financialAnalysis.additionalCapacity * 0.25).toLocaleString('en-IN')}/month
                      </Button>
                    </CardContent>
                  </Card>
                </div>

                {/* Allocation Strategy */}
                <div className="bg-card rounded-lg p-6 border border-amber-200 dark:border-amber-800">
                  <h4 className="font-semibold text-amber-900 dark:text-amber-100 mb-4 flex items-center gap-2">
                    <Calculator className="w-5 h-5" />
                    Optimal Allocation for ₹72,000 Monthly Surplus
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <h5 className="font-medium text-foreground">Immediate Allocation (Available Now)</h5>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center p-2 bg-blue-50 dark:bg-blue-950/30 rounded">
                          <span className="text-sm">REITs & InvITs (15%)</span>
                          <span className="font-medium text-blue-600">₹{(financialAnalysis.additionalCapacity * 0.15).toLocaleString('en-IN')}</span>
                        </div>
                        <div className="flex justify-between items-center p-2 bg-green-50 dark:bg-green-950/30 rounded">
                          <span className="text-sm">Premium Bonds (25%)</span>
                          <span className="font-medium text-green-600">₹{(financialAnalysis.additionalCapacity * 0.25).toLocaleString('en-IN')}</span>
                        </div>
                        <div className="flex justify-between items-center p-2 bg-muted rounded">
                          <span className="text-sm">Liquid/Emergency (20%)</span>
                          <span className="font-medium text-muted-foreground">₹{(financialAnalysis.additionalCapacity * 0.20).toLocaleString('en-IN')}</span>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <h5 className="font-medium text-foreground">Future Goals (Accumulation Strategy)</h5>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center p-2 bg-purple-50 dark:bg-purple-950/30 rounded">
                          <span className="text-sm">PMS Target (₹50L)</span>
                          <span className="font-medium text-purple-600">{Math.ceil(5000000 / financialAnalysis.additionalCapacity)} months</span>
                        </div>
                        <div className="flex justify-between items-center p-2 bg-indigo-50 dark:bg-indigo-950/30 rounded">
                          <span className="text-sm">AIF Target (₹1Cr)</span>
                          <span className="font-medium text-indigo-600">{Math.ceil(10000000 / financialAnalysis.additionalCapacity)} months</span>
                        </div>
                        <div className="flex justify-between items-center p-2 bg-amber-50 dark:bg-amber-950/30 rounded">
                          <span className="text-sm">Total Annual Investment</span>
                          <span className="font-medium text-amber-600">₹{(financialAnalysis.additionalCapacity * 12).toLocaleString('en-IN')}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-6 text-center">
                    <Button 
                      size="lg"
                      className="bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-foreground"
                      onClick={() => setActiveTab("recommendations")}
                      data-testid="button-start-premium-investing"
                    >
                      <Star className="w-5 h-5 mr-2" />
                      Start Premium Investment Journey
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Urgent Investment Call-to-Action */}
            <Card data-testid="card-investment-urgency" className="bg-gradient-to-r from-red-50 dark:from-red-950/30 to-orange-50 dark:to-orange-950/30 border-red-200 dark:border-red-800">
              <CardContent className="p-6">
                <div className="text-center space-y-4">
                  <div className="flex items-center justify-center gap-2 mb-4">
                    <Clock className="w-6 h-6 text-red-600" />
                    <h3 className="text-2xl font-bold text-red-800 dark:text-red-200">⚡ Time is Money!</h3>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 bg-card rounded-lg border border-red-200 dark:border-red-800">
                      <h4 className="font-bold text-red-800 dark:text-red-200 mb-2">Delaying 1 Year</h4>
                      <div className="text-2xl font-bold text-red-600">-₹18 Lakhs</div>
                      <p className="text-sm text-red-600">Lost compound growth</p>
                    </div>
                    
                    <div className="p-4 bg-card rounded-lg border border-orange-200 dark:border-orange-800">
                      <h4 className="font-bold text-orange-800 dark:text-orange-200 mb-2">Delaying 3 Years</h4>
                      <div className="text-2xl font-bold text-orange-600">-₹65 Lakhs</div>
                      <p className="text-sm text-orange-600">Massive opportunity loss</p>
                    </div>
                    
                    <div className="p-4 bg-card rounded-lg border border-green-200 dark:border-green-800">
                      <h4 className="font-bold text-green-800 dark:text-green-200 mb-2">Starting Today</h4>
                      <div className="text-2xl font-bold text-green-600">+₹2.4 Cr</div>
                      <p className="text-sm text-green-600">Extra wealth in 10 years</p>
                    </div>
                  </div>
                  
                  <div className="mt-6 p-4 bg-gradient-to-r from-emerald-600 to-green-600 text-foreground rounded-lg">
                    <p className="text-lg font-bold mb-2">🎯 Your CIBIL Profile is Perfect for Wealth Building!</p>
                    <p className="text-emerald-100 mb-4">
                      With 785 credit score and only 35% obligation ratio, you're in the top 5% of investors. 
                      Start your ₹72,000 monthly SIP today and secure your financial future.
                    </p>
                    <Button 
                      size="lg"
                      variant="secondary"
                      className="bg-card text-green-700 dark:text-green-300 hover:bg-muted font-bold"
                      onClick={() => setActiveTab("recommendations")}
                      data-testid="button-start-investing-now"
                    >
                      🚀 Start My Investment Journey Now
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Investment Recommendations Preview */}
            <InvestmentRecommendations portfolioId={portfolioId} />
          </TabsContent>

          {/* Investment Recommendations Tab */}
          <TabsContent value="recommendations">
            <InvestmentRecommendations portfolioId={portfolioId} />
          </TabsContent>

          {/* Return Forecast Tab */}
          <TabsContent value="returns" className="space-y-6">
            <ReturnForecast holdings={holdings || []} />
          </TabsContent>

          {/* Goal Planning Tab */}
          <TabsContent value="goals">
            <GoalPlanning />
          </TabsContent>

          {/* Obligation Mapping Tab */}
          <TabsContent value="obligations">
            <ObligationMapping />
          </TabsContent>

          {/* Retirement Planning Tab */}
          <TabsContent value="retirement">
            <RetirementPlanning />
          </TabsContent>

        </Tabs>
      </div>
    </div>
  );
}