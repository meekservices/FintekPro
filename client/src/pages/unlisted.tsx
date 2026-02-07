import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
import { Gem, TrendingUp, Calendar, IndianRupee, Building2, Calculator, Star, Eye, Lock, Store, ShoppingCart, Search, Sparkles, AlertTriangle, CheckCircle, Target, ArrowUpRight, Database } from "lucide-react";
import { ClientTransactionHistory } from "@/components/store/ClientTransactionHistory";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import { LoadingState } from "@/components/LoadingState";
import { EmptyState } from "@/components/EmptyState";
import { CartBadge } from "@/components/UnlistedCart";

// Unlisted Securities Categories Component
function UnlistedCategoriesSection() {
  const [selectedCategory, setSelectedCategory] = useState("all");

  const unlistedCategories = [
    {
      id: "pre-ipo",
      name: "Pre-IPO Shares",
      description: "Exclusive access to companies before they go public",
      icon: "TrendingUp",
      color: "blue",
      yieldRange: "15-40% p.a.",
      minInvestment: "₹1,00,000",
      count: 45,
      riskLevel: "High",
      companies: ["Flipkart", "OYO", "Paytm Mall", "Swiggy"]
    },
    {
      id: "startup-equity",
      name: "Startup Equity",
      description: "Early-stage startup investments with high growth potential",
      icon: "Building2", 
      color: "green",
      yieldRange: "20-100% p.a.",
      minInvestment: "₹2,50,000",
      count: 32,
      riskLevel: "Very High",
      companies: ["Zerodha", "Razorpay", "CRED", "Meesho"]
    },
    {
      id: "unicorn-stakes",
      name: "Unicorn Stakes",
      description: "Secondary market trading in unicorn company shares",
      icon: "Star",
      color: "purple",
      yieldRange: "10-30% p.a.",
      minInvestment: "₹5,00,000",
      count: 18,
      riskLevel: "High",
      companies: ["Byju's", "Dream11", "Unacademy", "Vedantu"]
    },
    {
      id: "esop-buybacks",
      name: "ESOP Buybacks",
      description: "Employee stock option buyback opportunities",
      icon: "Gem",
      color: "yellow",
      yieldRange: "5-25% p.a.",
      minInvestment: "₹50,000",
      count: 67,
      riskLevel: "Medium",
      companies: ["Flipkart", "Zomato", "PolicyBazaar", "Freshworks"]
    }
  ];

  const getIcon = (iconName: string) => {
    const icons = { TrendingUp, Building2, Star, Gem };
    return icons[iconName as keyof typeof icons] || Gem;
  };

  return (
    <section>
      <h2 className="text-2xl font-bold text-foreground mb-6">Unlisted Securities Categories</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {unlistedCategories.map((category) => {
          const IconComponent = getIcon(category.icon);
          return (
            <Card key={category.id} className="hover:shadow-md transition-shadow cursor-pointer" data-testid={`${category.id}-unlisted`}>
              <CardContent className="p-6">
                <div className={`w-12 h-12 bg-${category.color}-100 rounded-lg flex items-center justify-center mb-4`}>
                  <IconComponent className={`h-6 w-6 text-${category.color === 'blue' ? 'finance-blue' : category.color === 'green' ? 'finance-green' : category.color}-600`} />
                </div>
                <h3 className="font-bold text-foreground mb-2">{category.name}</h3>
                <p className="text-muted-foreground text-sm mb-4">
                  {category.description}
                </p>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span>Expected Return:</span>
                    <span className="font-semibold text-finance-green">{category.yieldRange}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Min Investment:</span>
                    <span className="font-semibold">{category.minInvestment}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Available:</span>
                    <span className="font-semibold text-finance-blue">{category.count} opportunities</span>
                  </div>
                  <Badge variant="outline" className="w-full justify-center mt-2">
                    {category.riskLevel} Risk
                  </Badge>
                </div>
                <div className="mt-4">
                  <p className="text-xs text-muted-foreground mb-2">Featured Companies:</p>
                  <div className="flex flex-wrap gap-1">
                    {category.companies.slice(0, 3).map((company, idx) => (
                      <Badge key={idx} variant="secondary" className="text-xs">{company}</Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}

// Marketplace Section - Shows published sell listings
function MarketplaceSection() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");

  const { data: listings, isLoading } = useQuery<any[]>({
    queryKey: ['/api/unlisted/listings/published'],
    queryFn: async () => {
      const response = await fetch('/api/unlisted/listings/published');
      if (!response.ok) throw new Error('Failed to fetch listings');
      const result = await response.json();
      // API returns { data: { listings: [...], pagination: {...} } }
      return result.data?.listings || [];
    },
  });

  const filteredListings = listings?.filter(listing => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return listing.companyName?.toLowerCase().includes(query) ||
           listing.company?.name?.toLowerCase().includes(query);
  }) || [];

  if (isLoading) {
    return <LoadingState />;
  }

  if (!listings || listings.length === 0) {
    return (
      <EmptyState
        icon={Store}
        title="No Listings Available"
        description="There are currently no published sell listings in the marketplace. Check back later for new opportunities."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search listings..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-marketplace-search"
          />
        </div>
        <Link href="/unlisted/cart">
          <Button variant="outline" className="relative" data-testid="button-view-cart">
            <ShoppingCart className="h-4 w-4 mr-2" />
            Cart
            <CartBadge />
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredListings.map((listing) => (
          <Card key={listing.id} className="hover:shadow-md transition-shadow" data-testid={`listing-card-${listing.id}`}>
            <CardContent className="p-4">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h4 className="font-semibold text-lg">{listing.companyName || listing.company?.name}</h4>
                  <p className="text-sm text-muted-foreground">{listing.company?.sector || 'Technology'}</p>
                </div>
                <Badge variant={listing.orderType === 'sell' ? 'destructive' : 'default'}>
                  {listing.orderType === 'sell' ? 'For Sale' : 'Buy Request'}
                </Badge>
              </div>
              
              <div className="space-y-2 text-sm mb-4">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Price per share:</span>
                  <span className="font-semibold text-green-600">
                    ₹{parseFloat(listing.pricePerShare || 0).toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Quantity:</span>
                  <span className="font-medium">{listing.quantity?.toLocaleString('en-IN')} shares</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Value:</span>
                  <span className="font-semibold">
                    ₹{(parseFloat(listing.pricePerShare || 0) * (listing.quantity || 0)).toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  className="flex-1"
                  onClick={() => setLocation(`/unlisted/company/${listing.companyId}`)}
                  data-testid={`button-view-listing-${listing.id}`}
                >
                  <Eye className="w-4 h-4 mr-1" />
                  View Details
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredListings.length === 0 && searchQuery && (
        <div className="text-center py-8 text-muted-foreground">
          No listings found matching "{searchQuery}"
        </div>
      )}
    </div>
  );
}

// AI Picks Section - AI-powered recommendations for unlisted stocks
function AIPicksSection() {
  const [, setLocation] = useLocation();
  const [riskProfile, setRiskProfile] = useState<string>("moderate");
  const [investmentGoal, setInvestmentGoal] = useState<string>("growth");

  const buildQueryString = () => {
    const params = new URLSearchParams();
    if (riskProfile) params.append('riskProfile', riskProfile);
    if (investmentGoal) params.append('investmentGoal', investmentGoal);
    return params.toString();
  };

  const { data, isLoading, refetch } = useQuery<any>({
    queryKey: ['/api/unlisted/ai-recommendations', riskProfile, investmentGoal],
    queryFn: async () => {
      const queryString = buildQueryString();
      const response = await fetch(`/api/unlisted/ai-recommendations?${queryString}`);
      if (!response.ok) throw new Error('Failed to fetch recommendations');
      const result = await response.json();
      return result.data || result;
    },
  });

  const getSignalColor = (signal: string) => {
    switch (signal) {
      case 'buy': return 'bg-green-100 text-green-800';
      case 'hold': return 'bg-yellow-100 text-yellow-800';
      case 'avoid': return 'bg-red-100 text-red-800';
      default: return 'bg-muted text-foreground';
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'low': return 'text-green-600';
      case 'moderate': return 'text-yellow-600';
      case 'high': return 'text-orange-600';
      case 'very_high': return 'text-red-600';
      default: return 'text-muted-foreground';
    }
  };

  return (
    <div className="space-y-6">
      <Card data-testid="card-ai-unlisted-filters">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-500" />
            AI-Powered Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Get personalized pre-IPO and unlisted stock recommendations based on your investment profile.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Risk Profile</label>
              <Select value={riskProfile} onValueChange={setRiskProfile}>
                <SelectTrigger data-testid="select-unlisted-risk-profile">
                  <SelectValue placeholder="Select risk profile" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="conservative">Conservative</SelectItem>
                  <SelectItem value="moderate">Moderate</SelectItem>
                  <SelectItem value="aggressive">Aggressive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Investment Goal</label>
              <Select value={investmentGoal} onValueChange={setInvestmentGoal}>
                <SelectTrigger data-testid="select-unlisted-investment-goal">
                  <SelectValue placeholder="Select goal" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="growth">Growth</SelectItem>
                  <SelectItem value="income">Income</SelectItem>
                  <SelectItem value="balanced">Balanced</SelectItem>
                  <SelectItem value="capital_preservation">Capital Preservation</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button onClick={() => refetch()} className="w-full" data-testid="button-get-unlisted-recommendations">
                <Sparkles className="w-4 h-4 mr-2" />
                Get Recommendations
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {data?.summary && (
        <Card className="bg-gradient-to-r from-purple-50 to-blue-50" data-testid="card-ai-unlisted-summary">
          <CardContent className="py-4">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-purple-600">{data.summary.totalRecommendations}</div>
                <div className="text-xs text-muted-foreground">Recommendations</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">{data.summary.buySignals}</div>
                <div className="text-xs text-muted-foreground">Buy Signals</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-yellow-600">{data.summary.holdSignals}</div>
                <div className="text-xs text-muted-foreground">Hold</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-red-600">{data.summary.avoidSignals}</div>
                <div className="text-xs text-muted-foreground">Avoid</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-600">{data.summary.avgConfidence}%</div>
                <div className="text-xs text-muted-foreground">Avg Confidence</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <LoadingState />
      ) : !data?.recommendations || data.recommendations.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="No Recommendations Available"
          description="There are currently no unlisted companies available for AI recommendations. Check back later."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.recommendations.map((rec: any, index: number) => (
            <Card key={rec.companyId || index} className="hover:shadow-md transition-shadow" data-testid={`ai-unlisted-rec-${index}`}>
              <CardContent className="p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h4 className="font-semibold text-lg">{rec.name}</h4>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>{rec.sector || 'Technology'}</span>
                      <span>•</span>
                      <span className="capitalize">{rec.listingStage?.replace('_', ' ') || 'Unlisted'}</span>
                    </div>
                  </div>
                  <Badge className={getSignalColor(rec.aiSignal)}>
                    {rec.aiSignal === 'buy' && <CheckCircle className="w-3 h-3 mr-1" />}
                    {rec.aiSignal === 'avoid' && <AlertTriangle className="w-3 h-3 mr-1" />}
                    {rec.aiSignal?.toUpperCase()}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Price:</span>
                    <span className="font-medium">₹{parseFloat(rec.currentPrice || 0).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Target:</span>
                    <span className="font-medium text-green-600">₹{parseFloat(rec.aiTargetPrice || 0).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Upside:</span>
                    <span className="font-medium text-green-600">{rec.potentialUpside}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Confidence:</span>
                    <span className="font-medium">{rec.aiConfidence}%</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 mb-3">
                  <Target className="w-4 h-4 text-blue-500" />
                  <span className="text-sm">Suitability: {rec.suitabilityScore}/100</span>
                  <div className="flex-1 bg-muted rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full"
                      style={{ width: `${rec.suitabilityScore}%` }}
                    />
                  </div>
                </div>

                <div className="mb-3">
                  <p className="text-sm text-muted-foreground italic">{rec.aiRationale}</p>
                </div>

                {rec.keyStrengths && rec.keyStrengths.length > 0 && (
                  <div className="mb-2">
                    <div className="text-xs font-medium text-green-700 mb-1">Strengths:</div>
                    <div className="flex flex-wrap gap-1">
                      {rec.keyStrengths.slice(0, 2).map((s: string, i: number) => (
                        <Badge key={i} variant="outline" className="text-xs bg-green-50">{s}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {rec.keyRisks && rec.keyRisks.length > 0 && (
                  <div className="mb-3">
                    <div className="text-xs font-medium text-orange-700 mb-1">Risks:</div>
                    <div className="flex flex-wrap gap-1">
                      {rec.keyRisks.slice(0, 2).map((r: string, i: number) => (
                        <Badge key={i} variant="outline" className="text-xs bg-orange-50">{r}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between pt-2 border-t">
                  <div className={`text-xs font-medium ${getRiskColor(rec.riskLevel)}`}>
                    {rec.riskLevel?.replace('_', ' ').toUpperCase()} RISK
                  </div>
                  <Button
                    size="sm"
                    onClick={() => setLocation(`/unlisted/company/${rec.companyId}`)}
                    data-testid={`button-view-unlisted-${rec.companyId}`}
                  >
                    View Details
                    <ArrowUpRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {data?.summary?.disclaimer && (
        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="py-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-800">{data.summary.disclaimer}</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Main Unlisted Securities Page
export default function Unlisted() {
  const [, setLocation] = useLocation();
  
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
  const [selectedTab, setSelectedTab] = useState("explore");

  return (
    <div className="min-h-screen bg-finance-light" data-testid="unlisted-page">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8" data-testid="unlisted-header">
          <div className="flex items-center gap-3 mb-4">
            <Gem className="w-8 h-8 text-finance-blue" />
            <div>
              <h1 className="text-3xl font-bold text-foreground">Unlisted Securities</h1>
              <p className="text-muted-foreground">Exclusive access to pre-IPO and unlisted equity investments</p>
            </div>
          </div>
        </div>

        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
          <ScrollableTabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="explore" data-testid="tab-explore">Explore</TabsTrigger>
            <TabsTrigger value="marketplace" data-testid="tab-marketplace">
              <Store className="w-4 h-4 mr-1" />
              Marketplace
            </TabsTrigger>
            <TabsTrigger value="ai-picks" data-testid="tab-ai-picks">
              <Sparkles className="w-4 h-4 mr-1" />
              AI Picks
            </TabsTrigger>
            <TabsTrigger value="portfolio" data-testid="tab-portfolio">My Investments</TabsTrigger>
            <TabsTrigger value="watchlist" data-testid="tab-watchlist">Watchlist</TabsTrigger>
            <TabsTrigger value="education" data-testid="tab-education">Learn</TabsTrigger>
            <TabsTrigger value="history" data-testid="tab-history">
              <Database className="h-4 w-4 mr-2" />
              History
            </TabsTrigger>
          </ScrollableTabsList>

          <TabsContent value="marketplace" className="space-y-6" data-testid="marketplace-unlisted">
            <MarketplaceSection />
          </TabsContent>

          <TabsContent value="ai-picks" className="space-y-6" data-testid="ai-picks-unlisted">
            <AIPicksSection />
          </TabsContent>

          <TabsContent value="explore" className="space-y-6" data-testid="explore-unlisted">
            <UnlistedCategoriesSection />
            
            {/* Featured Opportunities */}
            <Card data-testid="card-featured-opportunities">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Star className="w-5 h-5 text-yellow-500" />
                  Featured Opportunities
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[
                    {
                      name: "Flipkart Pre-IPO",
                      sector: "E-commerce",
                      valuation: "₹3.7L Cr",
                      minInvestment: "₹2,00,000",
                      expectedReturn: "25-35%",
                      timeFrame: "12-18 months",
                      badge: "Hot Deal"
                    },
                    {
                      name: "Zerodha Secondary",
                      sector: "Fintech",
                      valuation: "₹58,000 Cr",
                      minInvestment: "₹5,00,000",
                      expectedReturn: "15-25%",
                      timeFrame: "6-12 months",
                      badge: "Limited Slots"
                    },
                    {
                      name: "OYO ESOP Buyback",
                      sector: "Hospitality",
                      valuation: "₹45,000 Cr",
                      minInvestment: "₹1,00,000",
                      expectedReturn: "10-20%",
                      timeFrame: "3-6 months",
                      badge: "New"
                    }
                  ].map((opportunity, index) => (
                    <Card key={index} className="border-l-4 border-l-finance-blue">
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-semibold">{opportunity.name}</h4>
                          <Badge variant="secondary">{opportunity.badge}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">{opportunity.sector}</p>
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span>Valuation:</span>
                            <span className="font-medium">{opportunity.valuation}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Min Investment:</span>
                            <span className="font-medium">{opportunity.minInvestment}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Expected Return:</span>
                            <span className="font-medium text-green-600">{opportunity.expectedReturn}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Time Frame:</span>
                            <span className="font-medium">{opportunity.timeFrame}</span>
                          </div>
                        </div>
                        <div className="flex gap-2 mt-4">
                          <Button size="sm" className="flex-1">
                            <Eye className="w-4 h-4 mr-1" />
                            View Details
                          </Button>
                          <Button size="sm" variant="outline">
                            <Lock className="w-4 h-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Investment Calculator */}
            <Card data-testid="card-unlisted-calculator">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="w-5 h-5 text-finance-blue" />
                  Unlisted Investment Calculator
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Investment Amount</label>
                    <Input placeholder="₹1,00,000" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Expected Return (%)</label>
                    <Input placeholder="25" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Time Period (Years)</label>
                    <Input placeholder="2" />
                  </div>
                </div>
                <Button className="mt-4">Calculate Returns</Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="portfolio" className="space-y-6" data-testid="unlisted-portfolio">
            <Card>
              <CardHeader>
                <CardTitle>My Unlisted Investments</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Start investing in unlisted securities to track your portfolio here.</p>
                <Button className="mt-4" onClick={() => setLocation('/unlisted/browse')} data-testid="button-explore-opportunities">
                  Explore Opportunities
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="watchlist" className="space-y-6" data-testid="unlisted-watchlist">
            <Card>
              <CardHeader>
                <CardTitle>My Watchlist</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">Add unlisted securities to your watchlist to get updates on pricing and availability.</p>
                <Button className="mt-4" onClick={() => setLocation('/unlisted/browse')} data-testid="button-browse-securities">
                  Browse Securities
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="education" className="space-y-6" data-testid="unlisted-education">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Understanding Unlisted Securities</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground mb-4">
                    Learn about the risks and opportunities in unlisted securities investing.
                  </p>
                  <Button variant="outline">Read Guide</Button>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Pre-IPO Investment Strategy</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground mb-4">
                    Discover how to evaluate pre-IPO opportunities and build a diversified portfolio.
                  </p>
                  <Button variant="outline">Learn More</Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="history" className="space-y-6" data-testid="unlisted-history">
            <ClientTransactionHistory category="unlisted" />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}