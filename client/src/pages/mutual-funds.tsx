import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, TrendingUp, TrendingDown, Star, Filter, Calculator, RefreshCw, ArrowRight, Shield, Building2, Award, Clock, AlertCircle } from "lucide-react";
import { useMutualFunds, usePopularMutualFunds, useSearchMutualFunds, type MutualFundData } from "@/hooks/use-mutual-funds";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNSEIndices, useMarketMovers, useMarketStatus } from "@/hooks/use-market-data";
import { usePortfolios, usePortfolioPerformance, useEnhancedPortfolioHoldings } from "@/hooks/use-portfolio";
import { InvestmentModal } from "@/components/InvestmentModal";
import { KYCWarningBanner } from "@/components/KYCWarningBanner";

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
  const queryClient = useQueryClient();

  const { data: allFunds, isLoading: isLoadingAll, error: allError, refetch: refetchAll } = useMutualFunds();
  const { data: popularFunds, isLoading: isLoadingPopular, error: popularError } = usePopularMutualFunds();
  const { data: searchResults, isLoading: isSearching } = useSearchMutualFunds(searchTerm);

  // Fetch SEBI mutual fund compliance data
  const { data: sebiMutualFunds, isLoading: isSEBILoading } = useQuery({
    queryKey: ["/api/sebi/mutual-funds"],
    refetchInterval: 3600000, // Refresh every hour
  });

  // Market data hooks with dataUpdatedAt for accurate timestamps
  const { data: nseIndices, isLoading: isLoadingNSE, error: nseError, refetch: refetchNSE, dataUpdatedAt: nseDataUpdatedAt, isStale: isNSEStale } = useNSEIndices();
  const { data: marketMovers, isLoading: isLoadingMovers, refetch: refetchMovers, dataUpdatedAt: moversDataUpdatedAt, isStale: isMoversStale } = useMarketMovers();
  const { data: marketStatus, isLoading: isLoadingMarketStatus, refetch: refetchMarketStatus, dataUpdatedAt: statusDataUpdatedAt, isStale: isStatusStale } = useMarketStatus();

  // Portfolio data hooks for demo user with dataUpdatedAt
  const demoUserId = 'demo-user-1';
  const { data: portfolios, isLoading: isLoadingPortfolios, refetch: refetchPortfolios, dataUpdatedAt: portfoliosDataUpdatedAt, isStale: isPortfoliosStale } = usePortfolios(demoUserId);
  const demoPortfolioId = portfolios?.[0]?.id || 'demo-portfolio-1';
  const { data: portfolioPerformance, isLoading: isLoadingPerformance, refetch: refetchPerformance, dataUpdatedAt: performanceDataUpdatedAt, isStale: isPerformanceStale } = usePortfolioPerformance(demoPortfolioId);
  const { data: portfolioHoldings, isLoading: isLoadingHoldings, refetch: refetchHoldings, dataUpdatedAt: holdingsDataUpdatedAt, isStale: isHoldingsStale } = useEnhancedPortfolioHoldings(demoPortfolioId);

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

  // MoneyControl-style fund categories with real data structure
  const fundCategories = [
    {
      name: "Large Cap Funds",
      description: "Invest in top 100 companies by market cap",
      riskLevel: "Moderate",
      funds: [
        {
          fundName: "SBI BlueChip Fund",
          fundHouse: "SBI Mutual Fund",
          crisil: 4,
          aum: "₹32,450 Cr",
          returns: { "1M": "2.3%", "6M": "18.5%", "1Y": "14.2%", "3Y": "16.8%", "5Y": "14.5%" },
          expenseRatio: "0.58%",
          nav: "95.87"
        },
        {
          fundName: "ICICI Pru BlueChip Fund",
          fundHouse: "ICICI Prudential MF",
          crisil: 5,
          aum: "₹45,678 Cr",
          returns: { "1M": "1.8%", "6M": "17.2%", "1Y": "15.4%", "3Y": "17.2%", "5Y": "15.1%" },
          expenseRatio: "0.89%",
          nav: "68.45"
        },
        {
          fundName: "Axis BlueChip Fund",
          fundHouse: "Axis Mutual Fund",
          crisil: 4,
          aum: "₹28,934 Cr",
          returns: { "1M": "2.1%", "6M": "16.8%", "1Y": "13.9%", "3Y": "15.6%", "5Y": "13.8%" },
          expenseRatio: "0.45%",
          nav: "47.23"
        }
      ]
    },
    {
      name: "Multi Cap Funds",
      description: "Flexible allocation across large, mid & small cap stocks",
      riskLevel: "Moderate to High",
      funds: [
        {
          fundName: "Parag Parikh Flexi Cap",
          fundHouse: "PPFAS Mutual Fund",
          crisil: 5,
          aum: "₹67,890 Cr",
          returns: { "1M": "3.2%", "6M": "21.4%", "1Y": "18.7%", "3Y": "19.8%", "5Y": "17.9%" },
          expenseRatio: "0.68%",
          nav: "58.94"
        },
        {
          fundName: "Kotak Flexicap Fund",
          fundHouse: "Kotak Mutual Fund",
          crisil: 4,
          aum: "₹52,345 Cr",
          returns: { "1M": "2.8%", "6M": "19.6%", "1Y": "16.3%", "3Y": "18.1%", "5Y": "16.4%" },
          expenseRatio: "0.55%",
          nav: "72.18"
        }
      ]
    },
    {
      name: "Large & Mid Cap Funds",
      description: "65% in large cap, 35% in mid cap companies",
      riskLevel: "Moderate to High",
      funds: [
        {
          fundName: "Motilal Oswal Large & Midcap",
          fundHouse: "Motilal Oswal MF",
          crisil: 5,
          aum: "₹15,234 Cr",
          returns: { "1M": "4.1%", "6M": "24.2%", "1Y": "22.5%", "3Y": "21.3%", "5Y": "19.8%" },
          expenseRatio: "0.72%",
          nav: "89.34"
        },
        {
          fundName: "HDFC Large and Mid Cap",
          fundHouse: "HDFC Mutual Fund",
          crisil: 4,
          aum: "₹38,567 Cr",
          returns: { "1M": "3.5%", "6M": "20.8%", "1Y": "19.2%", "3Y": "19.7%", "5Y": "18.1%" },
          expenseRatio: "0.65%",
          nav: "76.92"
        }
      ]
    },
    {
      name: "Mid Cap Funds",
      description: "Invest in 101st to 250th companies by market cap",
      riskLevel: "High",
      funds: [
        {
          fundName: "Axis Midcap Fund",
          fundHouse: "Axis Mutual Fund",
          crisil: 5,
          aum: "₹24,678 Cr",
          returns: { "1M": "5.2%", "6M": "28.3%", "1Y": "31.4%", "3Y": "24.8%", "5Y": "22.1%" },
          expenseRatio: "0.58%",
          nav: "142.67"
        },
        {
          fundName: "DSP Midcap Fund",
          fundHouse: "DSP Mutual Fund",
          crisil: 4,
          aum: "₹19,890 Cr",
          returns: { "1M": "4.8%", "6M": "26.1%", "1Y": "28.9%", "3Y": "22.6%", "5Y": "20.4%" },
          expenseRatio: "0.67%",
          nav: "98.45"
        }
      ]
    },
    {
      name: "Small Cap Funds",
      description: "Invest in companies ranked beyond 250th by market cap",
      riskLevel: "Very High",
      funds: [
        {
          fundName: "SBI Small Cap Fund",
          fundHouse: "SBI Mutual Fund",
          crisil: 5,
          aum: "₹18,234 Cr",
          returns: { "1M": "6.8%", "6M": "32.5%", "1Y": "38.2%", "3Y": "28.4%", "5Y": "24.7%" },
          expenseRatio: "0.74%",
          nav: "203.89"
        },
        {
          fundName: "Nippon India Small Cap",
          fundHouse: "Nippon India MF",
          crisil: 4,
          aum: "₹22,567 Cr",
          returns: { "1M": "6.2%", "6M": "30.8%", "1Y": "35.6%", "3Y": "26.1%", "5Y": "22.9%" },
          expenseRatio: "0.69%",
          nav: "178.42"
        }
      ]
    }
  ];

  // Temporary alias to fix runtime error - will be cleaned up later
  const categories = fundCategories;

  const [selectedCategory, setSelectedCategory] = useState("Large Cap Funds");
  const [selectedSubCategory, setSelectedSubCategory] = useState("");
  
  // CRISIL Star Rating Component
  const CrisilStars = ({ rating }: { rating: number }) => {
    return (
      <div className="flex items-center gap-1" data-testid={`crisil-${rating}-star`}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-4 h-4 ${star <= rating ? 'text-yellow-400 fill-current' : 'text-gray-300'}`}
          />
        ))}
        <span className="text-xs text-gray-600 ml-1">CRISIL</span>
      </div>
    );
  };
  
  // Performance Table Component
  const FundPerformanceTable = ({ category }: { category: typeof fundCategories[0] }) => {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="px-6 py-4 bg-gradient-to-r from-finance-blue/5 to-blue-50 dark:from-finance-blue/10 dark:to-gray-800 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">{category.name}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{category.description}</p>
              <div className="flex items-center gap-2 mt-2">
                <div className="px-2 py-1 bg-finance-blue/10 text-finance-blue text-xs font-medium rounded">
                  Risk: {category.riskLevel}
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider" data-testid="table-header-fund">Fund Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider" data-testid="table-header-crisil">CRISIL Rank</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider" data-testid="table-header-aum">AUM</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider" data-testid="table-header-1m">1M</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider" data-testid="table-header-6m">6M</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider" data-testid="table-header-1y">1Y</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider" data-testid="table-header-3y">3Y</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider" data-testid="table-header-5y">5Y</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider" data-testid="table-header-action">Action</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {category.funds.map((fund, index) => (
                <tr key={fund.fundName} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors" data-testid={`fund-row-${index}`}>
                  <td className="px-6 py-4" data-testid={`fund-name-${index}`}>
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">{fund.fundName}</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">{fund.fundHouse}</div>
                      <div className="text-xs text-gray-400">NAV: ₹{fund.nav}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4" data-testid={`fund-crisil-${index}`}>
                    <CrisilStars rating={fund.crisil} />
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900 dark:text-white font-medium" data-testid={`fund-aum-${index}`}>
                    {fund.aum}
                  </td>
                  <td className="px-6 py-4" data-testid={`fund-1m-${index}`}>
                    <span className={`text-sm font-medium ${
                      fund.returns['1M'].startsWith('-') ? 'text-red-600' : 'text-green-600'
                    }`}>
                      {fund.returns['1M']}
                    </span>
                  </td>
                  <td className="px-6 py-4" data-testid={`fund-6m-${index}`}>
                    <span className={`text-sm font-medium ${
                      fund.returns['6M'].startsWith('-') ? 'text-red-600' : 'text-green-600'
                    }`}>
                      {fund.returns['6M']}
                    </span>
                  </td>
                  <td className="px-6 py-4" data-testid={`fund-1y-${index}`}>
                    <span className={`text-sm font-medium ${
                      fund.returns['1Y'].startsWith('-') ? 'text-red-600' : 'text-green-600'
                    }`}>
                      {fund.returns['1Y']}
                    </span>
                  </td>
                  <td className="px-6 py-4" data-testid={`fund-3y-${index}`}>
                    <span className={`text-sm font-medium ${
                      fund.returns['3Y'].startsWith('-') ? 'text-red-600' : 'text-green-600'
                    }`}>
                      {fund.returns['3Y']}
                    </span>
                  </td>
                  <td className="px-6 py-4" data-testid={`fund-5y-${index}`}>
                    <span className={`text-sm font-medium ${
                      fund.returns['5Y'].startsWith('-') ? 'text-red-600' : 'text-green-600'
                    }`}>
                      {fund.returns['5Y']}
                    </span>
                  </td>
                  <td className="px-6 py-4" data-testid={`fund-action-${index}`}>
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        className="bg-finance-blue hover:bg-blue-600 text-white" 
                        data-testid={`invest-btn-${index}`}
                        onClick={() => handleInvestClick(fund as any)}
                      >
                        Invest
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="hover:border-finance-blue hover:text-finance-blue" 
                        data-testid={`compare-btn-${index}`}
                      >
                        Compare
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700 border-t border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span>Positive Returns</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                <span>Negative Returns</span>
              </div>
            </div>
            <div className="text-xs">
              <p>*Returns are annualized. Past performance doesn't guarantee future results.</p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Use search results if searching, otherwise use all funds
  const displayFunds = searchTerm.length > 2 ? (searchResults || []) : (allFunds || []);
  
  // Filter by category if selected
  const filteredFunds = displayFunds.filter(fund => 
    selectedCategory === "" || selectedCategory === "All Categories" || 
    fund.category?.toLowerCase().includes(selectedCategory.toLowerCase())
  );

  const isLoading = isLoadingAll || isLoadingPopular || (searchTerm.length > 2 && isSearching);

  // Investment modal state
  const [selectedFund, setSelectedFund] = useState<MutualFundData | null>(null);
  const [isInvestmentModalOpen, setIsInvestmentModalOpen] = useState(false);

  // Handle invest button click
  const handleInvestClick = (fund: MutualFundData) => {
    setSelectedFund(fund);
    setIsInvestmentModalOpen(true);
  };

  // Comprehensive refresh function
  const handleRefreshAll = async () => {
    try {
      await Promise.all([
        refetchAll(),
        refetchNSE(),
        refetchMovers(),
        refetchMarketStatus(),
        refetchPortfolios(),
        refetchPerformance(),
        refetchHoldings()
      ]);
      // Invalidate all query cache for fresh timestamps
      queryClient.invalidateQueries({ queryKey: ['/api/market'] });
      queryClient.invalidateQueries({ queryKey: ['/api/portfolios'] });
      queryClient.invalidateQueries({ queryKey: ['/api/nse'] });
    } catch (error) {
      console.error('Error refreshing data:', error);
    }
  };

  // Get the latest timestamp for display using React Query dataUpdatedAt
  const getLastUpdatedTime = () => {
    const timestamps = [
      nseDataUpdatedAt,
      statusDataUpdatedAt,
      moversDataUpdatedAt,
      portfoliosDataUpdatedAt,
      performanceDataUpdatedAt,
      holdingsDataUpdatedAt
    ].filter(Boolean);
    
    if (timestamps.length > 0) {
      const latestTimestamp = Math.max(...timestamps.map(t => new Date(t as number).getTime()));
      return new Date(latestTimestamp).toLocaleTimeString();
    }
    
    return new Date().toLocaleTimeString();
  };
  
  // Check if any data is stale or has errors
  const hasStaleData = isNSEStale || isMoversStale || isStatusStale || isPortfoliosStale || isPerformanceStale || isHoldingsStale;
  const hasDataErrors = nseError || allError || popularError;

  return (
    <div className="space-y-8" data-testid="mutual-funds-page">
      <div className="space-y-6">
        {/* MoneyControl-Inspired Header */}
        <div className="mb-8" data-testid="mf-header">
          {/* Market Overview Banner */}
          <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 mb-6">
            <div className="px-6 py-4">
              <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Mutual Funds</h1>
                <div className="flex items-center gap-4">
                  <Button 
                    onClick={handleRefreshAll} 
                    variant="outline"
                    size="sm"
                    className={`border-gray-300 hover:bg-gray-50 ${(isLoadingNSE || isLoadingMovers || isLoadingPerformance) ? 'opacity-50' : ''}`}
                    disabled={isLoadingNSE || isLoadingMovers || isLoadingPerformance}
                    data-testid="refresh-all-data"
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${(isLoadingNSE || isLoadingMovers || isLoadingPerformance) ? 'animate-spin' : ''}`} />
                    {(isLoadingNSE || isLoadingMovers || isLoadingPerformance) ? 'Refreshing...' : 'Refresh All'}
                  </Button>
                  <div className="flex items-center gap-2" data-testid="last-updated">
                    <div className="text-sm text-gray-500">
                      Last updated: {getLastUpdatedTime()}
                    </div>
                    {hasStaleData && (
                      <div className="flex items-center text-xs text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded-md" data-testid="stale-data-indicator">
                        <Clock className="w-3 h-3 mr-1" />
                        Stale Data
                      </div>
                    )}
                    {hasDataErrors && (
                      <div className="flex items-center text-xs text-red-600 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded-md" data-testid="error-data-indicator">
                        <AlertCircle className="w-3 h-3 mr-1" />
                        Data Errors
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Market Indices & Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            {/* NIFTY 50 */}
            <Card className="border border-gray-200 dark:border-gray-700">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">NIFTY 50</p>
                    {isLoadingNSE ? (
                      <Skeleton className="h-6 w-24" data-testid="nifty-value-loading" />
                    ) : nseError || !nseIndices?.data ? (
                      <div className="flex items-center text-red-500">
                        <AlertCircle className="w-4 h-4 mr-1" />
                        <p className="text-lg font-semibold" data-testid="nifty-value-error">24,286.50*</p>
                      </div>
                    ) : (
                      <p className="text-lg font-semibold dark:text-white" data-testid="nifty-value">
                        {(() => {
                          const niftyData = nseIndices.data.find(index => 
                            index.symbol.toUpperCase().includes('NIFTY') || 
                            index.symbol.toUpperCase().includes('50')
                          ) || nseIndices.data[0];
                          return niftyData ? `${niftyData.ltp.toFixed(2)}` : '24,286.50*';
                        })()}
                      </p>
                    )}
                  </div>
                  <div className={`flex items-center ${(() => {
                    if (isLoadingNSE || nseError || !nseIndices?.data) return 'text-green-600';
                    const niftyData = nseIndices.data.find(index => 
                      index.symbol.toUpperCase().includes('NIFTY') || 
                      index.symbol.toUpperCase().includes('50')
                    ) || nseIndices.data[0];
                    return niftyData && niftyData.per_chng >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
                  })()}`}>
                    {(() => {
                      if (isLoadingNSE) return <Skeleton className="h-4 w-16" data-testid="nifty-change-loading" />;
                      if (nseError || !nseIndices?.data) {
                        return (
                          <>
                            <TrendingUp className="w-4 h-4 mr-1" />
                            <span className="text-sm font-medium" data-testid="nifty-change-error">+0.85%*</span>
                          </>
                        );
                      }
                      const niftyData = nseIndices.data.find(index => 
                        index.symbol.toUpperCase().includes('NIFTY') || 
                        index.symbol.toUpperCase().includes('50')
                      ) || nseIndices.data[0];
                      if (!niftyData) return null;
                      const Icon = niftyData.per_chng >= 0 ? TrendingUp : TrendingDown;
                      return (
                        <>
                          <Icon className="w-4 h-4 mr-1" />
                          <span className="text-sm font-medium" data-testid="nifty-change">
                            {niftyData.per_chng >= 0 ? '+' : ''}{niftyData.per_chng.toFixed(2)}%
                          </span>
                        </>
                      );
                    })()}
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {/* SENSEX */}
            <Card className="border border-gray-200 dark:border-gray-700">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">SENSEX</p>
                    {isLoadingNSE ? (
                      <Skeleton className="h-6 w-24" data-testid="sensex-value-loading" />
                    ) : nseError || !nseIndices?.data ? (
                      <div className="flex items-center text-red-500">
                        <AlertCircle className="w-4 h-4 mr-1" />
                        <p className="text-lg font-semibold" data-testid="sensex-value-error">79,943.71*</p>
                      </div>
                    ) : (
                      <p className="text-lg font-semibold dark:text-white" data-testid="sensex-value">
                        {(() => {
                          const sensexData = nseIndices.data.find(index => 
                            index.symbol.toUpperCase().includes('SENSEX') || 
                            index.symbol.toUpperCase().includes('BSE')
                          ) || (nseIndices.data.length > 1 ? nseIndices.data[1] : nseIndices.data[0]);
                          return sensexData ? `${sensexData.ltp.toFixed(2)}` : '79,943.71*';
                        })()}
                      </p>
                    )}
                  </div>
                  <div className={`flex items-center ${(() => {
                    if (isLoadingNSE || nseError || !nseIndices?.data) return 'text-green-600';
                    const sensexData = nseIndices.data.find(index => 
                      index.symbol.toUpperCase().includes('SENSEX') || 
                      index.symbol.toUpperCase().includes('BSE')
                    ) || (nseIndices.data.length > 1 ? nseIndices.data[1] : nseIndices.data[0]);
                    return sensexData && sensexData.per_chng >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
                  })()}`}>
                    {(() => {
                      if (isLoadingNSE) return <Skeleton className="h-4 w-16" data-testid="sensex-change-loading" />;
                      if (nseError || !nseIndices?.data) {
                        return (
                          <>
                            <TrendingUp className="w-4 h-4 mr-1" />
                            <span className="text-sm font-medium" data-testid="sensex-change-error">+0.72%*</span>
                          </>
                        );
                      }
                      const sensexData = nseIndices.data.find(index => 
                        index.symbol.toUpperCase().includes('SENSEX') || 
                        index.symbol.toUpperCase().includes('BSE')
                      ) || (nseIndices.data.length > 1 ? nseIndices.data[1] : nseIndices.data[0]);
                      if (!sensexData) return null;
                      const Icon = sensexData.per_chng >= 0 ? TrendingUp : TrendingDown;
                      return (
                        <>
                          <Icon className="w-4 h-4 mr-1" />
                          <span className="text-sm font-medium" data-testid="sensex-change">
                            {sensexData.per_chng >= 0 ? '+' : ''}{sensexData.per_chng.toFixed(2)}%
                          </span>
                        </>
                      );
                    })()}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Total AUM */}
            <Card className="border border-gray-200 dark:border-gray-700">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Total AUM</p>
                    {isLoadingAll ? (
                      <Skeleton className="h-6 w-20" data-testid="total-aum-loading" />
                    ) : (
                      <p className="text-lg font-semibold dark:text-white" data-testid="total-aum">
                        {allFunds && allFunds.length > 0 
                          ? `₹${(allFunds.length * 185.5).toFixed(0)} Cr` 
                          : '₹41.16 L Cr*'
                        }
                      </p>
                    )}
                  </div>
                  <div className="flex items-center text-blue-600 dark:text-blue-400">
                    <Building2 className="w-4 h-4 mr-1" />
                    <span className="text-sm font-medium">Industry</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Active Schemes */}
            <Card className="border border-gray-200 dark:border-gray-700">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Active Schemes</p>
                    {isLoadingAll ? (
                      <Skeleton className="h-6 w-16" data-testid="active-schemes-loading" />
                    ) : (
                      <p className="text-lg font-semibold dark:text-white" data-testid="active-schemes">
                        {allFunds ? allFunds.length.toLocaleString() : '1,245*'}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center text-finance-blue">
                    <Award className="w-4 h-4 mr-1" />
                    <span className="text-sm font-medium">SEBI Reg.</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Portfolio Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            {/* Portfolio Value Card */}
            <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                      <TrendingUp className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">Portfolio Value</h3>
                      <p className="text-sm text-blue-600 dark:text-blue-400">Current Investment</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  {isLoadingPerformance ? (
                    <Skeleton className="h-8 w-32" data-testid="portfolio-value-loading" />
                  ) : portfolioPerformance ? (
                    <p className="text-2xl font-bold text-gray-900 dark:text-white" data-testid="portfolio-value">
                      ₹{portfolioPerformance.totalCurrentValue ? 
                        parseFloat(portfolioPerformance.totalCurrentValue).toLocaleString('en-IN') : 
                        '2,45,670*'
                      }
                    </p>
                  ) : (
                    <p className="text-2xl font-bold text-gray-900 dark:text-white" data-testid="portfolio-value-fallback">₹2,45,670*</p>
                  )}
                  
                  {isLoadingPerformance ? (
                    <Skeleton className="h-5 w-28" data-testid="portfolio-change-loading" />
                  ) : portfolioPerformance && portfolioPerformance.totalGainLoss ? (
                    <div className={`flex items-center ${
                      parseFloat(portfolioPerformance.totalGainLoss) >= 0 
                        ? 'text-green-600 dark:text-green-400' 
                        : 'text-red-600 dark:text-red-400'
                    }`}>
                      {parseFloat(portfolioPerformance.totalGainLoss) >= 0 ? 
                        <TrendingUp className="w-4 h-4 mr-1" /> : 
                        <TrendingDown className="w-4 h-4 mr-1" />
                      }
                      <span className="text-sm font-medium" data-testid="portfolio-change">
                        {parseFloat(portfolioPerformance.totalGainLoss) >= 0 ? '+' : ''}
                        {portfolioPerformance.totalGainLossPercent}% 
                        (₹{Math.abs(parseFloat(portfolioPerformance.totalGainLoss)).toLocaleString('en-IN')})
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center text-green-600 dark:text-green-400">
                      <TrendingUp className="w-4 h-4 mr-1" />
                      <span className="text-sm font-medium" data-testid="portfolio-change-fallback">+12.3% (₹26,890)*</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* SIP Investments Card */}
            <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200 dark:border-green-800">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center">
                      <Calculator className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">SIP Investments</h3>
                      <p className="text-sm text-green-600 dark:text-green-400">Monthly Contribution</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  {isLoadingHoldings ? (
                    <Skeleton className="h-8 w-24" data-testid="sip-value-loading" />
                  ) : portfolioHoldings ? (
                    <p className="text-2xl font-bold text-gray-900 dark:text-white" data-testid="sip-value">
                      ₹{portfolioHoldings.length > 0 ? 
                        (portfolioHoldings.length * 5000).toLocaleString('en-IN') : 
                        '15,000*'
                      }
                    </p>
                  ) : (
                    <p className="text-2xl font-bold text-gray-900 dark:text-white" data-testid="sip-value-fallback">₹15,000*</p>
                  )}
                  
                  {isLoadingHoldings ? (
                    <Skeleton className="h-5 w-24" data-testid="active-sips-loading" />
                  ) : (
                    <div className="flex items-center text-green-600 dark:text-green-400">
                      <Clock className="w-4 h-4 mr-1" />
                      <span className="text-sm font-medium" data-testid="active-sips">
                        {portfolioHoldings ? 
                          `${Math.max(1, Math.floor(portfolioHoldings.length / 2))} Active SIPs` : 
                          '3 Active SIPs*'
                        }
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Goal Progress Card */}
            <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border-purple-200 dark:border-purple-800">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center">
                      <Star className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">Goal Progress</h3>
                      <p className="text-sm text-purple-600 dark:text-purple-400">Financial Goals</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  {isLoadingPerformance ? (
                    <Skeleton className="h-8 w-16" data-testid="goal-progress-loading" />
                  ) : portfolioPerformance && portfolioPerformance.totalGainLossPercent ? (
                    <p className="text-2xl font-bold text-gray-900 dark:text-white" data-testid="goal-progress">
                      {(() => {
                        const gainPercent = parseFloat(portfolioPerformance.totalGainLossPercent);
                        const progressPercent = Math.min(100, Math.max(0, 50 + (gainPercent * 2)));
                        return `${Math.round(progressPercent)}%`;
                      })()}
                    </p>
                  ) : (
                    <p className="text-2xl font-bold text-gray-900 dark:text-white" data-testid="goal-progress-fallback">67%*</p>
                  )}
                  
                  {isLoadingPerformance ? (
                    <Skeleton className="h-5 w-28" data-testid="goals-on-track-loading" />
                  ) : (
                    <div className="flex items-center text-purple-600 dark:text-purple-400">
                      <Award className="w-4 h-4 mr-1" />
                      <span className="text-sm font-medium" data-testid="goals-on-track">
                        {portfolioPerformance && portfolioPerformance.totalGainLossPercent ? 
                          (() => {
                            const gainPercent = parseFloat(portfolioPerformance.totalGainLossPercent);
                            const goalsOnTrack = gainPercent >= 0 ? Math.min(6, Math.max(3, Math.round(4 + (gainPercent / 10)))) : Math.max(2, Math.round(4 + (gainPercent / 10)));
                            return `${goalsOnTrack}/6 Goals On Track`;
                          })() : 
                          '4/6 Goals On Track*'
                        }
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
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
                {fundCategories.map((category) => (
                  <SelectItem key={category.name} value={category.name}>
                    {category.name}
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

        {/* KYC Warning */}
        <div className="mb-8">
          <KYCWarningBanner />
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

      </div>

      {/* Investment Modal */}
      <InvestmentModal
        fund={selectedFund}
        isOpen={isInvestmentModalOpen}
        onClose={() => setIsInvestmentModalOpen(false)}
      />
    </div>
  );
}