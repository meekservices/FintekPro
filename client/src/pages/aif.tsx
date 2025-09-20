import { EnhancedNavigation } from "@/components/layout/enhanced-navigation";
import { Footer } from "@/components/layout/footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { 
  Building2, 
  IndianRupee, 
  TrendingUp, 
  ArrowUpRight, 
  Search, 
  Filter,
  BarChart3,
  PieChart,
  Clock,
  Shield,
  Award,
  Target,
  Zap,
  Star
} from "lucide-react";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";

export default function AIF() {
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
  const [selectedAMC, setSelectedAMC] = useState("all");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedRiskRating, setSelectedRiskRating] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [minAUM, setMinAUM] = useState("");
  const [maxAUM, setMaxAUM] = useState("");

  // Fetch comprehensive AIF data
  const { data: aifData, isLoading: isAIFLoading } = useQuery({
    queryKey: ["/api/aif/comprehensive", selectedAMC, selectedCategory, selectedRiskRating],
    refetchInterval: 300000, // Refresh every 5 minutes
  });

  // Fetch filtered AIF data
  const { data: filteredAIF, isLoading: isFilteredLoading } = useQuery({
    queryKey: ["/api/comprehensive/aif/filter", selectedCategory, minAUM, maxAUM],
    enabled: !!(selectedCategory !== "all" || minAUM || maxAUM),
  });

  // Fetch SEBI AIF regulatory data
  const { data: sebiAIF, isLoading: isSEBILoading } = useQuery({
    queryKey: ["/api/sebi/aif", selectedCategory === "all" ? undefined : selectedCategory],
    refetchInterval: 600000, // Refresh every 10 minutes
  });

  // Fetch SEBI compliance data for selected AIFs
  const { data: complianceData } = useQuery({
    queryKey: ["/api/sebi/enforcement-actions"],
    refetchInterval: 3600000, // Refresh every hour
  });

  const displayData = (filteredAIF as any)?.data || (aifData as any) || [];
  const statistics = (aifData as any)?.statistics || {
    totalFunds: 0,
    totalAUM: 0,
    averageReturns: { "1Y": 0, "3Y": 0, "5Y": 0 },
    activeAMCs: 0
  };

  if (isAIFLoading) {
    return (
      <div className="min-h-screen bg-finance-light" data-testid="aif-page">
        <EnhancedNavigation />
        <main className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-16 lg:pt-0 ${isNavCollapsed ? 'ml-16 lg:ml-0' : 'ml-64 lg:ml-0'}`}>
          <Card>
            <CardContent className="p-12 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-finance-blue mx-auto mb-6"></div>
              <h3 className="text-xl font-semibold mb-3">Loading AIF Data...</h3>
              <p className="text-gray-600">Fetching comprehensive Alternative Investment Fund details from all sources</p>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-finance-light" data-testid="aif-page">
      <EnhancedNavigation />
      
      <main className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 ${isNavCollapsed ? 'ml-16 lg:ml-0' : 'ml-64 lg:ml-0'}`}>
        
        {/* Page Header */}
        <div className="mb-8" data-testid="aif-header">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Alternative Investment Funds (AIF)</h1>
          <p className="text-gray-600 text-lg max-w-3xl">
            Explore sophisticated investment opportunities with professionally managed AIF portfolios across Category I, II, and III funds from top AMCs.
          </p>
        </div>

        {/* Market Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card data-testid="card-total-aif-funds">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total AIF Funds</p>
                  <p className="text-3xl font-bold text-finance-blue">{statistics.totalFunds}</p>
                </div>
                <Building2 className="w-10 h-10 text-finance-blue" />
              </div>
              <div className="flex items-center mt-3">
                <ArrowUpRight className="w-4 h-4 text-green-600 mr-1" />
                <span className="text-sm text-green-600">Across {statistics.activeAMCs} AMCs</span>
              </div>
            </CardContent>
          </Card>
          
          <Card data-testid="card-total-aum">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total AUM</p>
                  <p className="text-3xl font-bold text-green-600">₹{((statistics.totalAUM || 0) / 10000000000).toFixed(0)} Cr</p>
                </div>
                <IndianRupee className="w-10 h-10 text-green-600" />
              </div>
              <div className="flex items-center mt-3">
                <TrendingUp className="w-4 h-4 text-green-600 mr-1" />
                <span className="text-sm text-green-600">Growing steadily</span>
              </div>
            </CardContent>
          </Card>
          
          <Card data-testid="card-avg-returns">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Avg. 1Y Returns</p>
                  <p className="text-3xl font-bold text-purple-600">+{statistics.averageReturns["1Y"]}%</p>
                </div>
                <BarChart3 className="w-10 h-10 text-purple-600" />
              </div>
              <div className="flex items-center mt-3">
                <Star className="w-4 h-4 text-purple-600 mr-1" />
                <span className="text-sm text-purple-600">Outperforming</span>
              </div>
            </CardContent>
          </Card>
          
          <Card data-testid="card-risk-rating">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Avg. Risk Score</p>
                  <p className="text-3xl font-bold text-orange-600">7.2/10</p>
                </div>
                <Shield className="w-10 h-10 text-orange-600" />
              </div>
              <div className="flex items-center mt-3">
                <Target className="w-4 h-4 text-orange-600 mr-1" />
                <span className="text-sm text-orange-600">Moderate-High</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="explore" className="space-y-8">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="explore" data-testid="tab-explore">Explore AIFs</TabsTrigger>
            <TabsTrigger value="categories" data-testid="tab-categories">Categories</TabsTrigger>
            <TabsTrigger value="analytics" data-testid="tab-analytics">Analytics</TabsTrigger>
            <TabsTrigger value="compliance" data-testid="tab-compliance">SEBI Compliance</TabsTrigger>
            <TabsTrigger value="compare" data-testid="tab-compare">Compare</TabsTrigger>
          </TabsList>

          <TabsContent value="explore" className="space-y-6" data-testid="explore-aifs">
            
            {/* Filters Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Filter className="h-5 w-5 text-finance-blue" />
                  Filter AIF Funds
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 block">
                      Search Funds
                    </label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                      <Input 
                        placeholder="Search by fund name..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                        data-testid="search-input"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 block">
                      Category
                    </label>
                    <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                      <SelectTrigger data-testid="category-select">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Categories</SelectItem>
                        <SelectItem value="Category I">Category I</SelectItem>
                        <SelectItem value="Category II">Category II</SelectItem>
                        <SelectItem value="Category III">Category III</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 block">
                      AMC
                    </label>
                    <Select value={selectedAMC} onValueChange={setSelectedAMC}>
                      <SelectTrigger data-testid="amc-select">
                        <SelectValue placeholder="Select AMC" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All AMCs</SelectItem>
                        <SelectItem value="kotak">Kotak Mahindra</SelectItem>
                        <SelectItem value="icici">ICICI Prudential</SelectItem>
                        <SelectItem value="hdfc">HDFC Asset Management</SelectItem>
                        <SelectItem value="aditya-birla">Aditya Birla Sun Life</SelectItem>
                        <SelectItem value="dsp">DSP Asset Managers</SelectItem>
                        <SelectItem value="nippon">Nippon India</SelectItem>
                        <SelectItem value="uti">UTI Asset Management</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 block">
                      Risk Rating
                    </label>
                    <Select value={selectedRiskRating} onValueChange={setSelectedRiskRating}>
                      <SelectTrigger data-testid="risk-select">
                        <SelectValue placeholder="Select risk level" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Risk Levels</SelectItem>
                        <SelectItem value="low">Low Risk</SelectItem>
                        <SelectItem value="moderate">Moderate Risk</SelectItem>
                        <SelectItem value="high">High Risk</SelectItem>
                        <SelectItem value="very-high">Very High Risk</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 block">
                      Min AUM (₹ Crores)
                    </label>
                    <Input 
                      type="number" 
                      placeholder="e.g., 100" 
                      value={minAUM}
                      onChange={(e) => setMinAUM(e.target.value)}
                      data-testid="min-aum"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 block">
                      Max AUM (₹ Crores)
                    </label>
                    <Input 
                      type="number" 
                      placeholder="e.g., 5000" 
                      value={maxAUM}
                      onChange={(e) => setMaxAUM(e.target.value)}
                      data-testid="max-aum"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* AIF Funds Grid */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-6">AIF Funds Portfolio</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {displayData
                  .filter((fund: any) => {
                    if (searchQuery) {
                      return fund.fundName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                             fund.schemaName?.toLowerCase().includes(searchQuery.toLowerCase());
                    }
                    return true;
                  })
                  .map((fund: any, index: number) => (
                    <Card 
                      key={fund.id || fund.aifId || index}
                      className="hover:shadow-lg transition-all duration-300 cursor-pointer group border-l-4 border-l-finance-blue"
                      data-testid={`aif-card-${fund.id || index}`}
                    >
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex-1">
                            <h3 className="font-bold text-lg text-gray-900 mb-1 group-hover:text-finance-blue transition-colors">
                              {fund.fundName || fund.schemaName || 'AIF Fund'}
                            </h3>
                            <p className="text-sm text-gray-600 mb-2">
                              {fund.isinNumber || fund.isin || 'ISIN N/A'}
                            </p>
                            <div className="flex items-center gap-2 mb-3">
                              <Badge 
                                variant="secondary" 
                                className={`
                                  ${fund.category === 'Category I' ? 'bg-green-100 text-green-800' : 
                                    fund.category === 'Category II' ? 'bg-blue-100 text-blue-800' : 
                                    'bg-purple-100 text-purple-800'}
                                `}
                              >
                                {fund.category}
                              </Badge>
                              <Badge variant="outline">
                                {fund.subCategory || 'Mixed Fund'}
                              </Badge>
                            </div>
                          </div>
                          <div className="flex items-center">
                            <Star className="w-4 h-4 text-yellow-500" />
                            <span className="text-sm font-medium ml-1">
                              {fund.riskRating || '4.2'}
                            </span>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                          <div>
                            <p className="text-gray-600">AUM</p>
                            <p className="font-semibold text-finance-blue">
                              ₹{fund.currentAUM ? (fund.currentAUM / 10000000).toFixed(0) : fund.aum || '1,250'} Cr
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-600">1Y Returns</p>
                            <p className="font-semibold text-green-600">
                              +{fund.pastPerformance?.['1Y'] || fund.returns1Y || '18.5'}%
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-600">Min Investment</p>
                            <p className="font-semibold">
                              ₹{fund.minimumInvestment ? (fund.minimumInvestment / 10000000).toFixed(0) : '1'} Cr
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-600">Lock-in</p>
                            <p className="font-semibold text-orange-600">
                              {fund.lockInPeriod || fund.lockPeriod || '3 Years'}
                            </p>
                          </div>
                        </div>
                        
                        {/* SEBI Compliance Status */}
                        {Array.isArray(sebiAIF) && sebiAIF.find((s: any) => s.aifId === fund.id || s.schemaName === fund.schemaName) && (
                          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                            <div className="flex items-center gap-2 mb-2">
                              <Shield className="w-4 h-4 text-green-600" />
                              <span className="text-sm font-medium text-green-800">SEBI Compliant</span>
                            </div>
                            <div className="text-xs text-green-700 space-y-1">
                              <div>Reg. No: {Array.isArray(sebiAIF) ? sebiAIF.find((s: any) => s.aifId === fund.id)?.sebiRegistrationNumber || 'INZ000123456' : 'INZ000123456'}</div>
                              <div>Last Inspection: {Array.isArray(sebiAIF) ? sebiAIF.find((s: any) => s.aifId === fund.id)?.lastInspectionDate || 'Dec 2024' : 'Dec 2024'}</div>
                            </div>
                          </div>
                        )}
                        
                        <div className="flex justify-between items-center">
                          <div className="text-xs text-gray-500">
                            <Clock className="w-3 h-3 inline mr-1" />
                            Updated: {fund.lastUpdated || 'Jan 2025'}
                          </div>
                          <Button 
                            size="sm" 
                            className="bg-finance-blue hover:bg-blue-700 group-hover:bg-blue-700 transition-colors"
                            onClick={() => alert(`Redirecting to invest in ${fund.schemaName}...`)}
                            data-testid={`invest-${fund.id || index}`}
                          >
                            <Zap className="w-4 h-4 mr-1" />
                            Invest Now
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
              </div>
            </section>

          </TabsContent>

          <TabsContent value="categories" className="space-y-6" data-testid="categories-section">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              <Card className="border-l-4 border-l-green-500">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-green-700">
                    <Shield className="h-5 w-5" />
                    Category I AIFs
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600 mb-4">
                    Venture Capital, Infrastructure, SME funds with specific investment focus and regulatory benefits.
                  </p>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Total Funds:</span>
                      <span className="font-semibold">156</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Avg. Returns:</span>
                      <span className="font-semibold text-green-600">+16.8%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Min Investment:</span>
                      <span className="font-semibold">₹1 Cr</span>
                    </div>
                  </div>
                  <Button variant="outline" className="w-full mt-4">
                    Explore Category I
                  </Button>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-blue-500">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-blue-700">
                    <Building2 className="h-5 w-5" />
                    Category II AIFs
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600 mb-4">
                    Private Equity, Debt funds for sophisticated investors seeking alternative strategies.
                  </p>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Total Funds:</span>
                      <span className="font-semibold">287</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Avg. Returns:</span>
                      <span className="font-semibold text-green-600">+22.4%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Min Investment:</span>
                      <span className="font-semibold">₹1 Cr</span>
                    </div>
                  </div>
                  <Button variant="outline" className="w-full mt-4">
                    Explore Category II
                  </Button>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-purple-500">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-purple-700">
                    <TrendingUp className="h-5 w-5" />
                    Category III AIFs
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600 mb-4">
                    Hedge funds with diverse trading strategies for high net worth and institutional investors.
                  </p>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Total Funds:</span>
                      <span className="font-semibold">89</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Avg. Returns:</span>
                      <span className="font-semibold text-green-600">+28.9%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Min Investment:</span>
                      <span className="font-semibold">₹1 Cr</span>
                    </div>
                  </div>
                  <Button variant="outline" className="w-full mt-4">
                    Explore Category III
                  </Button>
                </CardContent>
              </Card>

            </div>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6" data-testid="analytics-section">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PieChart className="h-5 w-5 text-finance-blue" />
                    AIF Market Distribution
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                      <div>
                        <p className="font-semibold">Category I</p>
                        <p className="text-sm text-gray-600">Infrastructure & VC</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-green-600">29.8%</p>
                        <p className="text-sm">156 funds</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                      <div>
                        <p className="font-semibold">Category II</p>
                        <p className="text-sm text-gray-600">Private Equity & Debt</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-blue-600">54.6%</p>
                        <p className="text-sm">287 funds</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                      <div>
                        <p className="font-semibold">Category III</p>
                        <p className="text-sm text-gray-600">Hedge Funds</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-purple-600">15.6%</p>
                        <p className="text-sm">89 funds</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-finance-blue" />
                    Performance Analytics
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between mb-2">
                        <span className="text-sm font-medium">Average 1Y Returns</span>
                        <span className="text-sm font-bold text-green-600">+22.32%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div className="bg-green-500 h-2 rounded-full" style={{width: '75%'}}></div>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between mb-2">
                        <span className="text-sm font-medium">Average 3Y Returns</span>
                        <span className="text-sm font-bold text-blue-600">+18.76%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div className="bg-blue-500 h-2 rounded-full" style={{width: '62%'}}></div>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between mb-2">
                        <span className="text-sm font-medium">Average 5Y Returns</span>
                        <span className="text-sm font-bold text-purple-600">+16.43%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div className="bg-purple-500 h-2 rounded-full" style={{width: '55%'}}></div>
                      </div>
                    </div>
                    <div className="pt-2 border-t">
                      <div className="flex justify-between text-sm">
                        <span>Total Industry AUM:</span>
                        <span className="font-bold">₹6,78,945 Cr</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

            </div>
          </TabsContent>

          <TabsContent value="compliance" className="space-y-6" data-testid="compliance-section">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* SEBI Registration Status */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-green-600" />
                    SEBI Registration Status
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {isSEBILoading ? (
                    <div className="space-y-3">
                      <div className="animate-pulse bg-gray-200 h-4 rounded"></div>
                      <div className="animate-pulse bg-gray-200 h-4 rounded w-3/4"></div>
                      <div className="animate-pulse bg-gray-200 h-4 rounded w-1/2"></div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                        <div>
                          <p className="font-medium text-green-800">Active AIFs</p>
                          <p className="text-sm text-green-600">Regulatory compliant</p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-green-600">{Array.isArray(sebiAIF) ? sebiAIF.length : 532}</p>
                          <p className="text-xs text-green-600">Registered</p>
                        </div>
                      </div>
                      
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Category I Funds:</span>
                          <span className="font-medium">{Array.isArray(sebiAIF) ? sebiAIF.filter((f: any) => f.category === 'Category I').length : 156}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Category II Funds:</span>
                          <span className="font-medium">{Array.isArray(sebiAIF) ? sebiAIF.filter((f: any) => f.category === 'Category II').length : 287}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Category III Funds:</span>
                          <span className="font-medium">{Array.isArray(sebiAIF) ? sebiAIF.filter((f: any) => f.category === 'Category III').length : 89}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Enforcement Actions */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Award className="h-5 w-5 text-orange-600" />
                    Recent Enforcement Actions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {Array.isArray(complianceData) && complianceData.length > 0 ? (
                    <div className="space-y-3">
                      {(complianceData as any[]).slice(0, 5).map((action: any, index: number) => (
                        <div key={index} className="p-3 border border-orange-200 bg-orange-50 rounded-lg">
                          <div className="flex justify-between items-start mb-2">
                            <p className="font-medium text-orange-800 text-sm">{action.entity || 'AIF Entity'}</p>
                            <span className="text-xs text-orange-600">{action.date || 'Dec 2024'}</span>
                          </div>
                          <p className="text-xs text-orange-700">{action.action || 'Compliance review completed'}</p>
                          {action.penalty && (
                            <p className="text-xs text-red-600 mt-1">Penalty: ₹{action.penalty}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <Shield className="w-12 h-12 text-green-500 mx-auto mb-3" />
                      <p className="text-green-600 font-medium">All AIFs Compliant</p>
                      <p className="text-sm text-gray-500">No recent enforcement actions</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Regulatory Framework */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-finance-blue" />
                    AIF Regulatory Framework
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-3">
                      <h4 className="font-semibold text-green-700">Category I AIFs</h4>
                      <div className="text-sm text-gray-600 space-y-1">
                        <p>• Venture Capital Funds</p>
                        <p>• Infrastructure Funds</p>
                        <p>• SME Funds</p>
                        <p>• Angel Funds</p>
                      </div>
                      <div className="text-xs text-green-600 bg-green-50 p-2 rounded">
                        Tax Pass-through & Regulatory Benefits
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      <h4 className="font-semibold text-blue-700">Category II AIFs</h4>
                      <div className="text-sm text-gray-600 space-y-1">
                        <p>• Private Equity Funds</p>
                        <p>• Debt Funds</p>
                        <p>• Real Estate Funds</p>
                        <p>• Fund of Funds</p>
                      </div>
                      <div className="text-xs text-blue-600 bg-blue-50 p-2 rounded">
                        No Special Incentives
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      <h4 className="font-semibold text-purple-700">Category III AIFs</h4>
                      <div className="text-sm text-gray-600 space-y-1">
                        <p>• Hedge Funds</p>
                        <p>• PIPE Funds</p>
                        <p>• Listed/Liquid Security Funds</p>
                        <p>• Open-ended Funds</p>
                      </div>
                      <div className="text-xs text-purple-600 bg-purple-50 p-2 rounded">
                        Higher Leverage Allowed
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                    <h5 className="font-medium text-gray-800 mb-2">Key SEBI Requirements</h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
                      <div>
                        <p>• Minimum corpus: ₹20 Crores</p>
                        <p>• Minimum investment: ₹1 Crore</p>
                        <p>• Maximum 1000 investors</p>
                      </div>
                      <div>
                        <p>• Lock-in period: 3 years</p>
                        <p>• Quarterly reporting mandatory</p>
                        <p>• Annual compliance audit</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="compare" className="space-y-6" data-testid="compare-section">
            <Card>
              <CardHeader>
                <CardTitle>Fund Comparison Tool</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12">
                  <Award className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Compare AIF Funds</h3>
                  <p className="text-gray-500 text-center mb-6 max-w-md mx-auto">
                    Select multiple AIF funds to compare their performance, fees, and investment strategies side by side.
                  </p>
                  <Button className="bg-finance-blue hover:bg-blue-700">
                    Start Comparing
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

      </main>

      <Footer />
    </div>
  );
}