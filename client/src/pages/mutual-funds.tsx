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
import { Search, TrendingUp, TrendingDown, Star, Filter, Calculator, RefreshCw, ArrowRight } from "lucide-react";
import { useMutualFunds, usePopularMutualFunds, useSearchMutualFunds, type MutualFundData } from "@/hooks/use-mutual-funds";

function FundCard({ fund }: { fund: MutualFundData }) {
  const navValue = parseFloat(fund.nav || "0");
  const changeValue = parseFloat(fund.change || "0");
  const changePercent = parseFloat(fund.changePercent || "0");
  
  return (
    <Card className="hover:shadow-lg transition-all duration-300 border-l-4 border-l-finance-blue" data-testid={`fund-card-${fund.schemeCode}`}>
      <CardContent className="p-6">
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900 mb-1 line-clamp-2">{fund.schemeName}</h3>
            <p className="text-sm text-gray-600">{fund.fundHouse}</p>
            {fund.category && (
              <Badge variant="secondary" className="mt-2">{fund.category}</Badge>
            )}
          </div>
        </div>
        
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold text-gray-900">₹{navValue.toFixed(2)}</p>
            <p className="text-xs text-gray-500">Current NAV</p>
          </div>
          <div>
            <p className={`text-xl font-semibold ${changeValue >= 0 ? 'text-finance-green' : 'text-finance-red'}`}>
              {changeValue >= 0 ? '+' : ''}₹{changeValue.toFixed(2)}
            </p>
            <p className="text-xs text-gray-500">Daily Change</p>
          </div>
          <div>
            <p className={`text-xl font-semibold flex items-center justify-center ${changePercent >= 0 ? 'text-finance-green' : 'text-finance-red'}`}>
              {changePercent >= 0 ? <TrendingUp className="h-4 w-4 mr-1" /> : <TrendingDown className="h-4 w-4 mr-1" />}
              {changePercent >= 0 ? '+' : ''}{changePercent.toFixed(2)}%
            </p>
            <p className="text-xs text-gray-500">% Change</p>
          </div>
        </div>
        
        <div className="mt-4 pt-4 border-t border-gray-100 flex gap-2">
          <Button size="sm" className="flex-1 bg-finance-blue hover:bg-blue-700" data-testid={`invest-${fund.schemeCode}`}>
            Invest Now
          </Button>
          <Button size="sm" variant="outline" className="flex-1" data-testid={`details-${fund.schemeCode}`}>
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

  return (
    <div className="min-h-screen bg-finance-light" data-testid="mutual-funds-page">
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-24">
        
        {/* Page Header */}
        <div className="mb-8" data-testid="mf-header">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-4">Mutual Funds</h1>
              <p className="text-gray-600 text-lg">
                Invest in direct mutual funds with zero commission
              </p>
            </div>
            <Button 
              onClick={() => refetchAll()} 
              variant="outline" 
              size="sm" 
              className="flex items-center gap-2"
              data-testid="refresh-funds"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh Data
            </Button>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="mb-8 p-6 bg-white rounded-xl border border-gray-200" data-testid="search-filter">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Input
                type="text"
                placeholder="Search mutual funds..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                data-testid="mf-search-input"
              />
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            </div>
            
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger data-testid="category-select">
                <SelectValue placeholder="Category" />
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
              <SelectTrigger data-testid="risk-select">
                <SelectValue placeholder="Risk Level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low Risk</SelectItem>
                <SelectItem value="moderate">Moderate Risk</SelectItem>
                <SelectItem value="high">High Risk</SelectItem>
                <SelectItem value="very-high">Very High Risk</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="outline" className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              More Filters
            </Button>
          </div>
        </div>

        <Tabs defaultValue="explore" className="space-y-8">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="explore" data-testid="tab-explore">Explore Funds</TabsTrigger>
            <TabsTrigger value="sip" data-testid="tab-sip">Start SIP</TabsTrigger>
            <TabsTrigger value="portfolio" data-testid="tab-portfolio">My Portfolio</TabsTrigger>
            <TabsTrigger value="tools" data-testid="tab-tools">Tools</TabsTrigger>
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
                    <FundCard key={fund.schemeCode} fund={fund} />
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
                    <FundCard key={fund.schemeCode} fund={fund} />
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
                    <Input type="number" placeholder="₹5,000" data-testid="sip-amount" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 block">
                      Investment Period (Years)
                    </label>
                    <Input type="number" placeholder="10" data-testid="sip-years" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-2 block">
                      Expected Returns (% p.a.)
                    </label>
                    <Input type="number" placeholder="12" data-testid="sip-returns" />
                  </div>
                  <Button className="w-full bg-finance-blue hover:bg-blue-700" data-testid="calculate-sip">
                    Calculate SIP Returns
                  </Button>
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
                    <Button className="bg-finance-green hover:bg-green-700" data-testid="start-sip-button">
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
                <Button variant="outline">Invest Now</Button>
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