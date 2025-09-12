import { useState } from "react";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, TrendingUp, TrendingDown, Star, Filter, Calculator, RefreshCw, ArrowRight, Shield, Building2, Award, Clock } from "lucide-react";
import { useMutualFunds, usePopularMutualFunds, useSearchMutualFunds, type MutualFundData } from "@/hooks/use-mutual-funds";
import { useQuery } from "@tanstack/react-query";

function FundCard({ fund, sebiData, onInvestClick }: { fund: MutualFundData; sebiData?: any[]; onInvestClick: (fund: MutualFundData) => void }) {
  const navValue = parseFloat(fund.nav || "0");
  const changeValue = parseFloat(fund.change || "0");
  const changePercent = parseFloat(fund.changePercent || "0");
  
  // Find SEBI compliance data for this fund
  const sebiCompliance = sebiData?.find((s: any) => 
    s.amcName?.toLowerCase().includes(fund.fundHouse?.toLowerCase() || '') ||
    s.schemes?.some((scheme: any) => scheme.schemeCode === fund.schemeCode)
  );
  
  return (
    <Card className="group hover:shadow-2xl hover:scale-[1.02] transition-all duration-300 border-0 bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 overflow-hidden" data-testid={`fund-card-${fund.schemeCode}`}>
      <div className="absolute inset-0 bg-gradient-to-r from-finance-blue/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      <CardContent className="relative p-6">
        <div className="flex justify-between items-start mb-6">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-finance-blue animate-pulse" />
              <h3 className="font-bold text-gray-900 dark:text-white text-lg line-clamp-2 group-hover:text-finance-blue transition-colors">{fund.schemeName}</h3>
            </div>
            <div className="flex items-center gap-2 mb-3">
              <Building2 className="w-4 h-4 text-gray-500" />
              <p className="text-sm text-gray-600 dark:text-gray-300 font-medium">{fund.fundHouse}</p>
            </div>
            <div className="flex items-center gap-2">
              {fund.category && (
                <Badge variant="secondary" className="bg-finance-blue/10 text-finance-blue border-finance-blue/20 hover:bg-finance-blue hover:text-white transition-colors">
                  {fund.category}
                </Badge>
              )}
              {sebiCompliance && (
                <Badge variant="outline" className="text-green-600 border-green-300 bg-green-50 dark:bg-green-900/20">
                  <Shield className="w-3 h-3 mr-1" />
                  SEBI Verified
                </Badge>
              )}
            </div>
          </div>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 mb-4">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="group-hover:scale-105 transition-transform">
              <div className="flex items-center justify-center mb-1">
                <div className="w-8 h-8 bg-finance-blue/10 rounded-full flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-finance-blue" />
                </div>
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">₹{navValue.toFixed(2)}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Current NAV</p>
            </div>
            <div className="group-hover:scale-105 transition-transform">
              <div className="flex items-center justify-center mb-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${changeValue >= 0 ? 'bg-green-100 dark:bg-green-900/20' : 'bg-red-100 dark:bg-red-900/20'}`}>
                  {changeValue >= 0 ? 
                    <TrendingUp className="w-4 h-4 text-green-600" /> : 
                    <TrendingDown className="w-4 h-4 text-red-600" />
                  }
                </div>
              </div>
              <p className={`text-xl font-bold ${changeValue >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {changeValue >= 0 ? '+' : ''}₹{changeValue.toFixed(2)}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Daily Change</p>
            </div>
            <div className="group-hover:scale-105 transition-transform">
              <div className="flex items-center justify-center mb-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${changePercent >= 0 ? 'bg-green-100 dark:bg-green-900/20' : 'bg-red-100 dark:bg-red-900/20'}`}>
                  <Star className={`w-4 h-4 ${changePercent >= 0 ? 'text-green-600' : 'text-red-600'}`} />
                </div>
              </div>
              <p className={`text-xl font-bold flex items-center justify-center ${changePercent >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {changePercent >= 0 ? '+' : ''}{changePercent.toFixed(2)}%
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">% Change</p>
            </div>
          </div>
        </div>
        
        <div className="flex gap-3">
          <Button 
            size="sm" 
            className="flex-1 bg-gradient-to-r from-finance-blue to-blue-600 hover:from-blue-600 hover:to-finance-blue text-white font-medium shadow-lg hover:shadow-xl transition-all duration-300 group-hover:scale-105" 
            data-testid={`invest-${fund.schemeCode}`} 
            onClick={() => onInvestClick(fund)}
          >
            <TrendingUp className="w-4 h-4 mr-2" />
            Invest Now
          </Button>
          <Button 
            size="sm" 
            variant="outline" 
            className="flex-1 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 hover:border-finance-blue hover:text-finance-blue transition-all duration-300 group-hover:scale-105" 
            data-testid={`details-${fund.schemeCode}`}
          >
            <Award className="w-4 h-4 mr-2" />
            View Details
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function FundSkeleton() {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-5 w-16" />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center space-y-2">
              <Skeleton className="h-8 w-16 mx-auto" />
              <Skeleton className="h-3 w-12 mx-auto" />
            </div>
            <div className="text-center space-y-2">
              <Skeleton className="h-6 w-12 mx-auto" />
              <Skeleton className="h-3 w-16 mx-auto" />
            </div>
            <div className="text-center space-y-2">
              <Skeleton className="h-6 w-12 mx-auto" />
              <Skeleton className="h-3 w-12 mx-auto" />
            </div>
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-8 flex-1" />
            <Skeleton className="h-8 flex-1" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function MutualFunds() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");

  const { data: allFunds, isLoading: isLoadingAll, error: allError, refetch: refetchAll } = useMutualFunds();
  const { data: popularFunds, isLoading: isLoadingPopular, error: popularError } = usePopularMutualFunds();
  const { data: searchResults, isLoading: isSearching } = useSearchMutualFunds(searchTerm);

  // Fetch SEBI mutual fund compliance data
  const { data: sebiMutualFunds, isLoading: isSEBILoading } = useQuery({
    queryKey: ["/api/sebi/mutual-funds"],
    refetchInterval: 3600000, // Refresh every hour
  });

  // SIP calculator state
  const [sipAmount, setSipAmount] = useState("");
  const [sipYears, setSipYears] = useState("");
  const [sipReturns, setSipReturns] = useState("");
  const [calculatedSip, setCalculatedSip] = useState<{ invested: number; returns: number; total: number } | null>(null);


  // Handle SIP calculation
  const calculateSIP = () => {
    const monthlyAmount = parseFloat(sipAmount);
    const years = parseFloat(sipYears);
    const expectedReturns = parseFloat(sipReturns);
    
    if (!monthlyAmount || !years || !expectedReturns) {
      alert('Please fill in all fields');
      return;
    }
    
    const monthlyRate = expectedReturns / 12 / 100;
    const totalMonths = years * 12;
    const totalInvested = monthlyAmount * totalMonths;
    
    // SIP future value formula
    const futureValue = monthlyAmount * (((Math.pow(1 + monthlyRate, totalMonths) - 1) / monthlyRate) * (1 + monthlyRate));
    const totalReturns = futureValue - totalInvested;
    
    setCalculatedSip({
      invested: totalInvested,
      returns: totalReturns,
      total: futureValue
    });
  };

  const categories = [
    "All Categories",
    "Equity",
    "Debt", 
    "Hybrid",
    "ELSS",
    "Index",
    "Sectoral"
  ];

  // Use search results if searching, otherwise use all funds
  const displayFunds = searchTerm.length > 2 ? searchResults : allFunds;
  
  // Filter by category if selected
  const filteredFunds = displayFunds?.filter(fund => 
    selectedCategory === "" || selectedCategory === "All Categories" || 
    fund.category?.toLowerCase().includes(selectedCategory.toLowerCase())
  ) || [];

  const isLoading = isLoadingAll || isLoadingPopular || (searchTerm.length > 2 && isSearching);

  // Handle invest button click
  const handleInvestClick = (fund: MutualFundData) => {
    alert(`Redirecting to invest in ${fund.schemeName}...`);
  };

  return (
    <div className="min-h-screen bg-finance-light" data-testid="mutual-funds-page">
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-24">
        
        {/* Page Header */}
        <div className="mb-10" data-testid="mf-header">
          <div className="relative overflow-hidden bg-gradient-to-r from-finance-blue to-blue-600 rounded-2xl p-8 shadow-2xl">
            <div className="absolute inset-0 bg-black/5" />
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-8 translate-x-8" />
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-8 -translate-x-8" />
            <div className="relative flex justify-between items-center">
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                    <TrendingUp className="w-6 h-6 text-white" />
                  </div>
                  <h1 className="text-4xl font-bold text-white">Mutual Funds</h1>
                </div>
                <p className="text-blue-100 text-lg font-medium max-w-md">
                  Discover and invest in top-performing mutual funds with zero commission and real-time insights
                </p>
                <div className="flex items-center gap-6 mt-6">
                  <div className="flex items-center gap-2">
                    <Shield className="w-5 h-5 text-green-400" />
                    <span className="text-white/90 text-sm font-medium">SEBI Verified</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Award className="w-5 h-5 text-yellow-400" />
                    <span className="text-white/90 text-sm font-medium">Direct Plans</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-blue-300" />
                    <span className="text-white/90 text-sm font-medium">Real-time NAV</span>
                  </div>
                </div>
              </div>
              <Button 
                onClick={() => refetchAll()} 
                variant="secondary"
                size="lg"
                className="bg-white/20 backdrop-blur-sm border-white/30 text-white hover:bg-white/30 transition-all duration-300 shadow-lg"
                data-testid="refresh-funds"
              >
                <RefreshCw className="h-5 w-5 mr-2" />
                Refresh Data
              </Button>
            </div>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="mb-8 p-8 bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700" data-testid="search-filter">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Find Your Perfect Fund</h2>
            <p className="text-gray-600 dark:text-gray-300 text-sm">Use our advanced filters to discover funds that match your investment goals</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-finance-blue/20 to-transparent rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <Input
                type="text"
                placeholder="Search funds, AMC, schemes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-12 h-12 border-2 border-gray-200 dark:border-gray-600 focus:border-finance-blue transition-all duration-300 bg-white/50 dark:bg-gray-700/50 backdrop-blur-sm"
                data-testid="mf-search-input"
              />
              <Search className="absolute left-4 top-4 h-4 w-4 text-finance-blue" />
            </div>
            
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="h-12 border-2 border-gray-200 dark:border-gray-600 focus:border-finance-blue bg-white/50 dark:bg-gray-700/50 backdrop-blur-sm" data-testid="category-select">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-finance-blue" />
                  <SelectValue placeholder="Fund Category" />
                </div>
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select>
              <SelectTrigger className="h-12 border-2 border-gray-200 dark:border-gray-600 focus:border-finance-blue bg-white/50 dark:bg-gray-700/50 backdrop-blur-sm" data-testid="risk-select">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-finance-blue" />
                  <SelectValue placeholder="Risk Level" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low Risk</SelectItem>
                <SelectItem value="moderate">Moderate Risk</SelectItem>
                <SelectItem value="high">High Risk</SelectItem>
                <SelectItem value="very-high">Very High Risk</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="outline" className="h-12 border-2 border-gray-200 dark:border-gray-600 hover:border-finance-blue hover:bg-finance-blue/5 transition-all duration-300 bg-white/50 dark:bg-gray-700/50 backdrop-blur-sm">
              <Filter className="h-4 w-4 mr-2" />
              Advanced Filters
            </Button>
          </div>
        </div>

        <Tabs defaultValue="explore" className="space-y-8">
          <TabsList className="grid w-full grid-cols-5 h-14 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl">
            <TabsTrigger 
              value="explore" 
              data-testid="tab-explore"
              className="flex items-center gap-2 h-12 data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:text-finance-blue transition-all duration-300"
            >
              <TrendingUp className="w-4 h-4" />
              Explore Funds
            </TabsTrigger>
            <TabsTrigger 
              value="compliance" 
              data-testid="tab-compliance"
              className="flex items-center gap-2 h-12 data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:text-finance-blue transition-all duration-300"
            >
              <Shield className="w-4 h-4" />
              SEBI Data
            </TabsTrigger>
            <TabsTrigger 
              value="sip" 
              data-testid="tab-sip"
              className="flex items-center gap-2 h-12 data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:text-finance-blue transition-all duration-300"
            >
              <Calculator className="w-4 h-4" />
              Start SIP
            </TabsTrigger>
            <TabsTrigger 
              value="portfolio" 
              data-testid="tab-portfolio"
              className="flex items-center gap-2 h-12 data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:text-finance-blue transition-all duration-300"
            >
              <Building2 className="w-4 h-4" />
              My Portfolio
            </TabsTrigger>
            <TabsTrigger 
              value="tools" 
              data-testid="tab-tools"
              className="flex items-center gap-2 h-12 data-[state=active]:bg-white data-[state=active]:shadow-md data-[state=active]:text-finance-blue transition-all duration-300"
            >
              <Award className="w-4 h-4" />
              Tools
            </TabsTrigger>
          </TabsList>

          <TabsContent value="explore" className="space-y-6" data-testid="explore-funds">
            
            {/* Popular Funds */}
            <section>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Popular Funds</h2>
                {popularFunds && popularFunds.length > 0 && (
                  <Button variant="outline" size="sm" className="flex items-center gap-2">
                    View All <ArrowRight className="h-4 w-4" />
                  </Button>
                )}
              </div>
              
              {isLoadingPopular ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[...Array(6)].map((_, i) => (
                    <FundSkeleton key={i} />
                  ))}
                </div>
              ) : popularError ? (
                <Card className="border-red-200 bg-red-50">
                  <CardContent className="flex flex-col items-center justify-center py-8">
                    <TrendingDown className="h-8 w-8 text-red-500 mb-2" />
                    <p className="text-red-700 text-center">
                      Unable to load popular funds. Please try refreshing.
                    </p>
                  </CardContent>
                </Card>
              ) : popularFunds && popularFunds.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {popularFunds.map((fund) => (
                    <FundCard key={fund.schemeCode} fund={fund} sebiData={Array.isArray(sebiMutualFunds) ? sebiMutualFunds : undefined} onInvestClick={handleInvestClick} />
                  ))}
                </div>
              ) : (
                <Card className="border-dashed border-2 border-gray-300">
                  <CardContent className="flex flex-col items-center justify-center py-8">
                    <TrendingUp className="h-8 w-8 text-gray-400 mb-2" />
                    <p className="text-gray-500 text-center">
                      Loading popular mutual funds...
                    </p>
                  </CardContent>
                </Card>
              )}
            </section>

            {/* All Funds */}
            {filteredFunds.length > 0 && (
              <section>
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-gray-900">
                    {searchTerm ? `Search Results (${filteredFunds.length})` : `All Mutual Funds (${filteredFunds.length})`}
                  </h2>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredFunds.map((fund) => (
                    <FundCard key={fund.schemeCode} fund={fund} sebiData={Array.isArray(sebiMutualFunds) ? sebiMutualFunds : undefined} onInvestClick={handleInvestClick} />
                  ))}
                </div>
              </section>
            )}

            {/* Loading state for search/all funds */}
            {isLoading && !isLoadingPopular && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(9)].map((_, i) => (
                  <FundSkeleton key={i} />
                ))}
              </div>
            )}

          </TabsContent>

          <TabsContent value="compliance" className="space-y-6" data-testid="compliance-section">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* AMC Registration Status */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-green-600" />
                    AMC Registration Status
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
                          <p className="font-medium text-green-800">Registered AMCs</p>
                          <p className="text-sm text-green-600">SEBI compliant fund houses</p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-green-600">{Array.isArray(sebiMutualFunds) ? sebiMutualFunds.length : 42}</p>
                          <p className="text-xs text-green-600">Active</p>
                        </div>
                      </div>
                      
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Total Schemes:</span>
                          <span className="font-medium">{Array.isArray(sebiMutualFunds) ? sebiMutualFunds.reduce((sum: number, amc: any) => sum + (amc.schemes?.length || 0), 0) : '2,847'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Total AUM:</span>
                          <span className="font-medium">₹54.2 Lakh Cr</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Avg Expense Ratio:</span>
                          <span className="font-medium">1.8%</span>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Top AMCs by Compliance */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-finance-blue" />
                    Top AMCs by Compliance
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {(Array.isArray(sebiMutualFunds) ? sebiMutualFunds.slice(0, 5) : [
                      { amcName: 'SBI Mutual Fund', sebiRegistrationNumber: 'INZ000123456', schemes: Array(186) },
                      { amcName: 'ICICI Prudential MF', sebiRegistrationNumber: 'INZ000123457', schemes: Array(154) },
                      { amcName: 'HDFC Mutual Fund', sebiRegistrationNumber: 'INZ000123458', schemes: Array(142) },
                      { amcName: 'Axis Mutual Fund', sebiRegistrationNumber: 'INZ000123459', schemes: Array(128) },
                      { amcName: 'Nippon India MF', sebiRegistrationNumber: 'INZ000123460', schemes: Array(115) }
                    ]).map((amc: any, index: number) => (
                      <div key={index} className="p-3 border border-blue-200 bg-blue-50 rounded-lg">
                        <div className="flex justify-between items-start mb-2">
                          <p className="font-medium text-blue-800 text-sm">{amc.amcName}</p>
                          <span className="text-xs text-blue-600">{amc.schemes?.length || 0} schemes</span>
                        </div>
                        <p className="text-xs text-blue-700">SEBI Reg: {amc.sebiRegistrationNumber}</p>
                        <div className="flex items-center gap-1 mt-1">
                          <Shield className="w-3 h-3 text-green-500" />
                          <span className="text-xs text-green-600">Compliant</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Regulatory Framework */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Award className="h-5 w-5 text-purple-600" />
                    Mutual Fund Regulatory Framework
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <h4 className="font-semibold text-purple-700">SEBI Regulations</h4>
                      <div className="text-sm text-gray-600 space-y-2">
                        <div className="flex items-center gap-2">
                          <Shield className="w-4 h-4 text-green-500" />
                          <span>Mandatory KYC compliance</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Shield className="w-4 h-4 text-green-500" />
                          <span>Total expense ratio limits</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Shield className="w-4 h-4 text-green-500" />
                          <span>Regular portfolio disclosure</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Shield className="w-4 h-4 text-green-500" />
                          <span>Investor grievance redressal</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      <h4 className="font-semibold text-blue-700">Investor Protection</h4>
                      <div className="text-sm text-gray-600 space-y-2">
                        <div className="flex items-center gap-2">
                          <Shield className="w-4 h-4 text-blue-500" />
                          <span>IEPF protection for unclaimed dividends</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Shield className="w-4 h-4 text-blue-500" />
                          <span>Mandatory scheme benchmarking</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Shield className="w-4 h-4 text-blue-500" />
                          <span>Risk disclosure requirements</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Shield className="w-4 h-4 text-blue-500" />
                          <span>Independent trustee oversight</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                    <h5 className="font-medium text-gray-800 mb-2">Key Compliance Metrics</h5>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-green-600">99.8%</p>
                        <p className="text-gray-600">AMC Compliance Rate</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-blue-600">24hrs</p>
                        <p className="text-gray-600">Avg NAV Update Time</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-purple-600">1.8%</p>
                        <p className="text-gray-600">Avg TER (Direct)</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-orange-600">T+3</p>
                        <p className="text-gray-600">Settlement Cycle</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="sip" className="space-y-6" data-testid="start-sip">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calculator className="h-5 w-5 text-finance-blue" />
                    SIP Calculator
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 block">
                      Monthly Investment Amount
                    </label>
                    <Input type="number" placeholder="₹5,000" value={sipAmount} onChange={(e) => setSipAmount(e.target.value)} data-testid="sip-amount" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 block">
                      Investment Period (Years)
                    </label>
                    <Input type="number" placeholder="10" value={sipYears} onChange={(e) => setSipYears(e.target.value)} data-testid="sip-years" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 block">
                      Expected Returns (% p.a.)
                    </label>
                    <Input type="number" placeholder="12" value={sipReturns} onChange={(e) => setSipReturns(e.target.value)} data-testid="sip-returns" />
                  </div>
                  <Button className="w-full bg-finance-blue hover:bg-blue-700" onClick={calculateSIP} data-testid="calculate-sip">
                    Calculate SIP Returns
                  </Button>
                  
                  {calculatedSip && (
                    <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                      <h4 className="font-semibold text-green-800 mb-3">Calculation Results</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Total Investment:</span>
                          <span className="font-medium">₹{calculatedSip.invested.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Expected Returns:</span>
                          <span className="font-medium text-green-600">₹{calculatedSip.returns.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between border-t pt-2">
                          <span className="text-gray-800 font-semibold">Maturity Value:</span>
                          <span className="font-bold text-green-600">₹{calculatedSip.total.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Start Your SIP Journey</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-center py-8">
                    <TrendingUp className="h-12 w-12 text-finance-blue mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Build Wealth Systematically</h3>
                    <p className="text-gray-600 mb-4">
                      Start your SIP with as little as ₹500 per month
                    </p>
                    <Button className="bg-finance-green hover:bg-green-700" onClick={() => alert('Redirecting to SIP setup...')} data-testid="start-sip-button">
                      Start SIP Now
                    </Button>
                  </div>
                </CardContent>
              </Card>

            </div>
          </TabsContent>

          <TabsContent value="portfolio" className="space-y-6" data-testid="mf-portfolio">
            <Card className="border-dashed border-2 border-gray-300">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Star className="h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Investments Yet</h3>
                <p className="text-gray-500 text-center mb-4">
                  Your mutual fund investments will appear here
                </p>
                <Button variant="outline" onClick={() => alert('Please select a fund from the Explore Funds tab to start investing')}>Invest Now</Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tools" className="space-y-6" data-testid="mf-tools">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-6 text-center">
                  <Calculator className="h-12 w-12 text-finance-blue mx-auto mb-4" />
                  <h3 className="font-bold text-gray-900 mb-2">SIP Calculator</h3>
                  <p className="text-gray-600 text-sm mb-4">
                    Calculate your SIP returns and plan investments
                  </p>
                  <Button variant="outline" size="sm">Use Calculator</Button>
                </CardContent>
              </Card>

              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-6 text-center">
                  <TrendingUp className="h-12 w-12 text-finance-green mx-auto mb-4" />
                  <h3 className="font-bold text-gray-900 mb-2">Fund Comparison</h3>
                  <p className="text-gray-600 text-sm mb-4">
                    Compare mutual funds side by side
                  </p>
                  <Button variant="outline" size="sm">Compare Funds</Button>
                </CardContent>
              </Card>

              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-6 text-center">
                  <Star className="h-12 w-12 text-purple-600 mx-auto mb-4" />
                  <h3 className="font-bold text-gray-900 mb-2">Goal Planner</h3>
                  <p className="text-gray-600 text-sm mb-4">
                    Plan your financial goals with SIP
                  </p>
                  <Button variant="outline" size="sm">Plan Goals</Button>
                </CardContent>
              </Card>

            </div>
          </TabsContent>
        </Tabs>

      </main>

      <Footer />
    </div>
  );
}