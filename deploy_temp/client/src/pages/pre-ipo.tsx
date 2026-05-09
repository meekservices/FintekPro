import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ActionButtonWithNudge } from "@/components/kyc/kyc-gap-nudge";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  TrendingUp, 
  TrendingDown, 
  Building, 
  Calendar, 
  Target,
  IndianRupee,
  AlertTriangle,
  PieChart,
  BarChart3,
  Info,
  Star,
  ArrowRight,
  Building2
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";

export default function PreIPOPage() {
  const [selectedTab, setSelectedTab] = useState("overview");
  const [investmentAmount, setInvestmentAmount] = useState("");
  const [selectedCompany, setSelectedCompany] = useState<any>(null);

  // Fetch Pre-IPO data
  const { data: companies, isLoading: companiesLoading } = useQuery<any>({
    queryKey: ["/api/pre-ipo/companies"],
    refetchInterval: 30000
  });

  const { data: myInvestments, isLoading: investmentsLoading } = useQuery<any>({
    queryKey: ["/api/pre-ipo/my-investments"],
    refetchInterval: 30000
  });

  const { data: marketStats } = useQuery<any>({
    queryKey: ["/api/pre-ipo/market-stats"],
    refetchInterval: 60000
  });

  const { data: marketInsights } = useQuery<any>({
    queryKey: ["/api/pre-ipo/market-insights"],
    refetchInterval: 300000
  });

  const { data: upcomingIPOs } = useQuery<any>({
    queryKey: ["/api/pre-ipo/upcoming"],
    refetchInterval: 60000
  });

  const { data: currentIPOs } = useQuery<any>({
    queryKey: ["/api/pre-ipo/current"],
    refetchInterval: 30000
  });

  const { data: recentListings } = useQuery<any>({
    queryKey: ["/api/pre-ipo/recent-listings"],
    refetchInterval: 60000
  });

  const handleInvestment = async (companyId: string) => {
    try {
      const response = await fetch("/api/pre-ipo/invest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          investmentAmount: parseInt(investmentAmount),
          portfolioId: "default"
        })
      });
      
      if (response.ok) {
        window.location.reload();
      }
    } catch (error) {
      console.error("Investment error:", error);
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case "low": return "text-green-600 bg-green-50 dark:bg-green-950/30";
      case "medium": return "text-yellow-600 bg-yellow-50 dark:bg-yellow-950/30";
      case "high": return "text-red-600 bg-red-50 dark:bg-red-950/30";
      default: return "text-muted-foreground bg-muted";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "confirmed": return "text-green-600 bg-green-50 dark:bg-green-950/30";
      case "pending": return "text-yellow-600 bg-yellow-50 dark:bg-yellow-950/30";
      case "rejected": return "text-red-600 bg-red-50 dark:bg-red-950/30";
      default: return "text-muted-foreground bg-muted";
    }
  };

  if (companiesLoading || investmentsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading Pre-IPO data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="pre-ipo-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground" data-testid="page-title">Pre-IPO Investments</h1>
          <p className="text-muted-foreground mt-2">Invest in promising companies before they go public</p>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline" className="text-green-600" data-testid="market-status">
            <TrendingUp className="w-4 h-4 mr-1" />
            Market Strong
          </Badge>
          <Badge variant="outline" className="text-blue-600">
            {companies?.data?.length || 0} Companies Available
          </Badge>
        </div>
      </div>

      {/* Market Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card data-testid="market-overview-upcoming">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Upcoming IPOs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {marketStats?.data?.totalUpcomingIPOs || 15}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Companies preparing</p>
          </CardContent>
        </Card>

        <Card data-testid="market-overview-current">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Applications</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {marketStats?.data?.totalCurrentIPOs || 2}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Open for subscription</p>
          </CardContent>
        </Card>

        <Card data-testid="market-overview-amount">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Raised</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {marketStats?.data?.totalAmountRaised || "₹45,680 Cr"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">This fiscal year</p>
          </CardContent>
        </Card>

        <Card data-testid="market-overview-gains">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg Listing Gains</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {marketStats?.data?.averageListingGains || "14.8%"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Historical average</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
        <ScrollableTabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="companies" data-testid="tab-companies">Companies</TabsTrigger>
          <TabsTrigger value="portfolio" data-testid="tab-portfolio">My Portfolio</TabsTrigger>
          <TabsTrigger value="upcoming" data-testid="tab-upcoming">Upcoming</TabsTrigger>
          <TabsTrigger value="current" data-testid="tab-current">Current</TabsTrigger>
          <TabsTrigger value="insights" data-testid="tab-insights">Insights</TabsTrigger>
        </ScrollableTabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* My Investments Summary */}
            <Card data-testid="investments-summary">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChart className="w-5 h-5" />
                  My Pre-IPO Portfolio
                </CardTitle>
              </CardHeader>
              <CardContent>
                {myInvestments?.data?.length > 0 ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Total Investment</p>
                        <p className="text-xl font-semibold">
                          ₹{myInvestments.summary?.totalInvestment?.toLocaleString() || "0"}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Current Value</p>
                        <p className="text-xl font-semibold text-green-600">
                          ₹{myInvestments.summary?.totalCurrentValue?.toLocaleString() || "0"}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Unrealized Gains</p>
                        <p className="text-lg font-semibold text-blue-600">
                          ₹{myInvestments.summary?.totalUnrealizedGains?.toLocaleString() || "0"}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Average ROI</p>
                        <p className="text-lg font-semibold text-purple-600">
                          {myInvestments.summary?.averageROI?.toFixed(1) || "0.0"}%
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No Pre-IPO investments yet</p>
                    <Button 
                      className="mt-4" 
                      onClick={() => setSelectedTab("companies")}
                      data-testid="button-browse-companies"
                    >
                      Browse Companies
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Market Trends */}
            <Card data-testid="market-trends">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  Market Trends
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {marketStats?.data?.monthlyTrend?.slice(-3).map((trend: any, index: number) => (
                    <div key={index} className="flex justify-between items-center">
                      <div>
                        <p className="font-medium">{trend.month} 2025</p>
                        <p className="text-sm text-muted-foreground">{trend.ipos} IPOs</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{trend.amount}</p>
                        <p className="text-sm text-muted-foreground">Amount raised</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Activity */}
          <Card data-testid="recent-activity">
            <CardHeader>
              <CardTitle>Recent Listings Performance</CardTitle>
              <CardDescription>How recent IPOs performed after listing</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentListings?.data?.slice(0, 3).map((listing: any) => (
                  <div key={listing.id} className="flex justify-between items-center p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">{listing.companyName}</p>
                      <p className="text-sm text-muted-foreground">{listing.category} • Listed {listing.listingDate}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">₹{listing.currentPrice}</p>
                      <Badge 
                        variant={listing.currentGains > 0 ? "default" : "destructive"}
                        className={listing.currentGains > 0 ? "bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300" : ""}
                      >
                        {listing.currentGains > 0 ? "+" : ""}{listing.currentGains}%
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Companies Tab */}
        <TabsContent value="companies" className="space-y-6">
          <div className="grid gap-6">
            {companies?.data?.map((company: any) => (
              <Card key={company.id} className="hover:shadow-lg transition-shadow" data-testid={`company-card-${company.id}`}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-xl">{company.companyName}</CardTitle>
                      <CardDescription className="mt-2">{company.description}</CardDescription>
                      <div className="flex gap-2 mt-3">
                        <Badge variant="outline">{company.sector}</Badge>
                        <Badge variant="outline">{company.industry}</Badge>
                        <Badge className={getRiskColor(company.riskRating)}>
                          {company.riskRating} risk
                        </Badge>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Expected Returns</p>
                      <p className="text-2xl font-bold text-green-600">{company.expectedReturns}%</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Valuation</p>
                      <p className="font-semibold">₹{(company.currentValuation / 10000000).toFixed(0)} Cr</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Revenue Growth</p>
                      <p className="font-semibold text-green-600">{company.revenueGrowthRate}%</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Expected IPO</p>
                      <p className="font-semibold">{company.expectedIpoDate}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Min Investment</p>
                      <p className="font-semibold">₹{company.minimumInvestment.toLocaleString()}</p>
                    </div>
                  </div>

                  <div className="flex justify-between items-center">
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" data-testid={`button-details-${company.id}`}>
                        <Info className="w-4 h-4 mr-1" />
                        Details
                      </Button>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button 
                            size="sm" 
                            disabled={!company.isAvailableForInvestment}
                            onClick={() => setSelectedCompany(company)}
                            data-testid={`button-invest-${company.id}`}
                          >
                            <IndianRupee className="w-4 h-4 mr-1" />
                            Invest Now
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Invest in {company.companyName}</DialogTitle>
                            <DialogDescription>
                              Enter your investment amount (minimum ₹{company.minimumInvestment.toLocaleString()})
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div>
                              <Label htmlFor="investment-amount">Investment Amount (₹)</Label>
                              <Input
                                id="investment-amount"
                                type="number"
                                placeholder={company.minimumInvestment.toString()}
                                value={investmentAmount}
                                onChange={(e) => setInvestmentAmount(e.target.value)}
                                min={company.minimumInvestment}
                                data-testid="input-investment-amount"
                              />
                            </div>
                            <Alert>
                              <AlertTriangle className="h-4 w-4" />
                              <AlertDescription>
                                Pre-IPO investments are high-risk and illiquid until the company goes public.
                                Please invest only what you can afford to lose.
                              </AlertDescription>
                            </Alert>
                            <ActionButtonWithNudge
                              productCode="UNLISTED_SECURITIES"
                              onProceed={() => handleInvestment(company.id)}
                              className="w-full"
                              disabled={!investmentAmount || parseInt(investmentAmount) < company.minimumInvestment}
                              data-testid="button-confirm-investment"
                            >
                              Confirm Investment
                            </ActionButtonWithNudge>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {company.availableSlots}/{company.totalInvestmentSlots} slots available
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* My Portfolio Tab */}
        <TabsContent value="portfolio" className="space-y-6">
          {myInvestments?.data?.length > 0 ? (
            <div className="space-y-4">
              {myInvestments.data.map((investment: any) => (
                <Card key={investment.id} data-testid={`investment-card-${investment.id}`}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle>{investment.companyName}</CardTitle>
                        <CardDescription>{investment.sector}</CardDescription>
                      </div>
                      <Badge className={getStatusColor(investment.status)}>
                        {investment.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Investment</p>
                        <p className="font-semibold">₹{investment.investmentAmount.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Current Value</p>
                        <p className="font-semibold">₹{investment.currentValuation.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Unrealized Gains</p>
                        <p className={`font-semibold ${investment.unrealizedGains >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          ₹{investment.unrealizedGains.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">ROI</p>
                        <p className={`font-semibold ${investment.roi >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {investment.roi.toFixed(1)}%
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Expected Listing</p>
                        <p className="font-semibold">{investment.expectedListingDate}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="text-center py-12">
                <Building2 className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Investments Yet</h3>
                <p className="text-muted-foreground mb-4">Start building your Pre-IPO portfolio</p>
                <Button onClick={() => setSelectedTab("companies")} data-testid="button-start-investing">
                  Start Investing
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Upcoming IPOs Tab */}
        <TabsContent value="upcoming" className="space-y-6">
          <div className="grid gap-4">
            {upcomingIPOs?.data?.map((ipo: any) => (
              <Card key={ipo.id} data-testid={`upcoming-ipo-${ipo.id}`}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle>{ipo.companyName}</CardTitle>
                      <CardDescription>{ipo.aboutCompany}</CardDescription>
                    </div>
                    <Badge variant="outline">{ipo.exchange}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Issue Size</p>
                      <p className="font-semibold">{ipo.issueSize}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Price Range</p>
                      <p className="font-semibold">{ipo.priceRange}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">GMP</p>
                      <p className="font-semibold text-green-600">+₹{ipo.gmp} ({ipo.gmpPercentage}%)</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Open Date</p>
                      <p className="font-semibold">{ipo.openDate}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Current IPOs Tab */}
        <TabsContent value="current" className="space-y-6">
          <div className="grid gap-4">
            {currentIPOs?.data?.map((ipo: any) => (
              <Card key={ipo.id} data-testid={`current-ipo-${ipo.id}`}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle>{ipo.companyName}</CardTitle>
                      <CardDescription>{ipo.category} • {ipo.exchange}</CardDescription>
                    </div>
                    <Badge className="bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-300">
                      {ipo.dayRemaining} day{ipo.dayRemaining !== 1 ? 's' : ''} left
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Issue Size</p>
                        <p className="font-semibold">{ipo.issueSize}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Price Range</p>
                        <p className="font-semibold">{ipo.priceRange}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">GMP</p>
                        <p className="font-semibold text-green-600">+₹{ipo.gmp} ({ipo.gmpPercentage}%)</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Subscription</p>
                        <p className="font-semibold">{ipo.subscriptionStatus}</p>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Retail: {ipo.retailSubscription}</span>
                        <span>HNI: {ipo.hniSubscription}</span>
                        <span>Institutional: {ipo.institutionalSubscription}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Market Insights Tab */}
        <TabsContent value="insights" className="space-y-6">
          <div className="grid gap-6">
            {marketInsights?.data?.map((insight: any, index: number) => (
              <Card key={index} data-testid={`market-insight-${insight.sector.toLowerCase()}`}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Target className="w-5 h-5" />
                        {insight.sector} Sector
                      </CardTitle>
                      <CardDescription>Market analysis and investment outlook</CardDescription>
                    </div>
                    <Badge 
                      className={insight.marketSentiment === 'bullish' ? 'bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300' : 'bg-yellow-50 dark:bg-yellow-950/30 text-yellow-700 dark:text-yellow-300'}
                    >
                      {insight.marketSentiment}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Avg Valuation</p>
                        <p className="font-semibold">₹{(insight.averageValuation / 10000000).toFixed(0)} Cr</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Success Rate</p>
                        <p className="font-semibold text-green-600">{insight.successRate}%</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Avg IPO Gains</p>
                        <p className="font-semibold text-blue-600">{insight.averageIpoGains}%</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Upcoming IPOs</p>
                        <p className="font-semibold">{insight.upcomingIpos}</p>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-semibold mb-2">AI Analysis</h4>
                      <p className="text-muted-foreground text-sm">{insight.aiAnalysis}</p>
                    </div>

                    <div>
                      <h4 className="font-semibold mb-2">Key Trends</h4>
                      <div className="flex flex-wrap gap-2">
                        {insight.keyTrends.map((trend: string, i: number) => (
                          <Badge key={i} variant="outline">{trend}</Badge>
                        ))}
                      </div>
                    </div>

                    <div className="flex justify-between items-center pt-2">
                      <Badge 
                        className={insight.investmentRecommendation === 'buy' ? 'bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300' : 'bg-yellow-50 dark:bg-yellow-950/30 text-yellow-700 dark:text-yellow-300'}
                      >
                        Recommendation: {insight.investmentRecommendation}
                      </Badge>
                      <div className="flex items-center gap-1">
                        <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                        <span className="text-sm font-medium">{insight.confidenceScore}/10</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}