import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import {
  Sparkles,
  TrendingUp,
  TrendingDown,
  Star,
  Target,
  Flame,
  Shield,
  Zap,
  ShoppingCart,
  Eye,
  Heart,
  Clock,
  IndianRupee,
  Percent,
  BarChart3,
  PieChart,
  Search,
  Filter,
  RefreshCw,
  ChevronRight,
  Bookmark,
  AlertCircle,
  CheckCircle
} from "lucide-react";

interface InvestmentOpportunity {
  id: string;
  name: string;
  type: 'mutual_fund' | 'stock' | 'bond' | 'etf' | 'ipo' | 'aif' | 'pms' | 'fd' | 'sgb';
  category: string;
  issuer?: string;
  minInvestment: number;
  expectedReturn?: string;
  riskLevel: 'low' | 'medium' | 'high' | 'very_high';
  rating: number;
  matchScore: number;
  reason: string;
  highlights: string[];
  isNew?: boolean;
  isTrending?: boolean;
  closingDate?: string;
  isin?: string;
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(amount);
};

const typeConfig: Record<string, { label: string; color: string; icon: any }> = {
  mutual_fund: { label: 'Mutual Fund', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300', icon: PieChart },
  stock: { label: 'Stock', color: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300', icon: TrendingUp },
  bond: { label: 'Bond', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300', icon: Shield },
  etf: { label: 'ETF', color: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300', icon: BarChart3 },
  ipo: { label: 'IPO', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300', icon: Zap },
  aif: { label: 'AIF', color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300', icon: Target },
  pms: { label: 'PMS', color: 'bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300', icon: Star },
  fd: { label: 'FD', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300', icon: Shield },
  sgb: { label: 'Gold Bond', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300', icon: Star }
};

const riskColors: Record<string, string> = {
  low: 'bg-green-100 text-green-700',
  medium: 'bg-yellow-100 text-yellow-700',
  high: 'bg-orange-100 text-orange-700',
  very_high: 'bg-red-100 text-red-700'
};

const mockOpportunities: InvestmentOpportunity[] = [
  {
    id: '1',
    name: 'Motilal Oswal Midcap Fund',
    type: 'mutual_fund',
    category: 'Mid Cap',
    issuer: 'Motilal Oswal',
    minInvestment: 5000,
    expectedReturn: '18-22% CAGR',
    riskLevel: 'high',
    rating: 5,
    matchScore: 95,
    reason: 'Matches your growth-oriented profile with 5+ year horizon',
    highlights: ['Top quartile performer', '3-year CAGR: 28%', 'Low expense ratio'],
    isNew: true,
    isTrending: true,
    isin: 'INF247L01015'
  },
  {
    id: '2',
    name: 'HDFC Corporate Bond Fund',
    type: 'mutual_fund',
    category: 'Corporate Bond',
    issuer: 'HDFC AMC',
    minInvestment: 5000,
    expectedReturn: '7-8% p.a.',
    riskLevel: 'low',
    rating: 4,
    matchScore: 88,
    reason: 'Provides stability to balance your equity-heavy portfolio',
    highlights: ['AAA rated papers', 'YTM: 7.5%', 'Low credit risk'],
    isin: 'INF179K01BB3'
  },
  {
    id: '3',
    name: 'REC Limited Tax-Free Bond',
    type: 'bond',
    category: 'Tax-Free Bond',
    issuer: 'REC Limited',
    minInvestment: 10000,
    expectedReturn: '5.5% Tax-Free',
    riskLevel: 'low',
    rating: 4,
    matchScore: 85,
    reason: 'Tax-efficient fixed income for your 30% tax bracket',
    highlights: ['Government backed', 'Tax-free interest', '10-year maturity'],
    isTrending: true
  },
  {
    id: '4',
    name: 'Sovereign Gold Bond 2029',
    type: 'sgb',
    category: 'Gold Bond',
    issuer: 'RBI',
    minInvestment: 5000,
    expectedReturn: '2.5% + Gold appreciation',
    riskLevel: 'medium',
    rating: 5,
    matchScore: 82,
    reason: 'Portfolio hedge recommendation - gold allocation below 5%',
    highlights: ['2.5% annual interest', 'Tax-free gains at maturity', 'Sovereign guarantee'],
    isNew: true,
    closingDate: '2026-01-15'
  },
  {
    id: '5',
    name: 'Tata Elxsi',
    type: 'stock',
    category: 'IT Services',
    issuer: 'Tata Group',
    minInvestment: 8000,
    expectedReturn: '15-20% annual',
    riskLevel: 'high',
    rating: 4,
    matchScore: 78,
    reason: 'IT sector underweight in your portfolio vs benchmark',
    highlights: ['Strong EV/Automotive focus', 'High promoter holding', 'Consistent dividend']
  },
  {
    id: '6',
    name: 'Nifty 50 ETF',
    type: 'etf',
    category: 'Large Cap Index',
    issuer: 'Nippon India',
    minInvestment: 100,
    expectedReturn: '12-15% CAGR',
    riskLevel: 'medium',
    rating: 5,
    matchScore: 92,
    reason: 'Low-cost core holding for long-term wealth creation',
    highlights: ['0.05% expense ratio', 'Top 50 companies', 'High liquidity'],
    isTrending: true
  },
  {
    id: '7',
    name: 'ABC Technologies IPO',
    type: 'ipo',
    category: 'Technology',
    issuer: 'ABC Tech Pvt Ltd',
    minInvestment: 15000,
    expectedReturn: 'Listing gains expected',
    riskLevel: 'very_high',
    rating: 3,
    matchScore: 65,
    reason: 'High-risk allocation opportunity - limited exposure recommended',
    highlights: ['Book running lead: Axis Capital', 'Oversubscribed 5x', 'Strong institutional interest'],
    isNew: true,
    closingDate: '2026-01-10'
  },
  {
    id: '8',
    name: 'SBI Fixed Deposit',
    type: 'fd',
    category: 'Bank FD',
    issuer: 'SBI',
    minInvestment: 10000,
    expectedReturn: '7.1% p.a.',
    riskLevel: 'low',
    rating: 4,
    matchScore: 70,
    reason: 'Safe parking for emergency fund top-up',
    highlights: ['Senior citizen: 7.6%', 'Flexible tenures', 'DICGC insured']
  }
];

export default function FreshInvestmentDiscovery() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("for_you");
  const [typeFilter, setTypeFilter] = useState("all");
  const [riskFilter, setRiskFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [savedItems, setSavedItems] = useState<string[]>([]);

  const opportunities = mockOpportunities;

  const filteredOpportunities = useMemo(() => {
    let filtered = [...opportunities];
    
    if (activeTab === "trending") {
      filtered = filtered.filter(o => o.isTrending);
    } else if (activeTab === "new") {
      filtered = filtered.filter(o => o.isNew);
    } else if (activeTab === "closing_soon") {
      filtered = filtered.filter(o => o.closingDate);
    } else if (activeTab === "saved") {
      filtered = filtered.filter(o => savedItems.includes(o.id));
    }
    
    if (typeFilter !== "all") {
      filtered = filtered.filter(o => o.type === typeFilter);
    }
    
    if (riskFilter !== "all") {
      filtered = filtered.filter(o => o.riskLevel === riskFilter);
    }
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(o => 
        o.name.toLowerCase().includes(query) ||
        o.category.toLowerCase().includes(query) ||
        o.issuer?.toLowerCase().includes(query)
      );
    }
    
    return filtered.sort((a, b) => b.matchScore - a.matchScore);
  }, [opportunities, activeTab, typeFilter, riskFilter, searchQuery, savedItems]);

  const toggleSave = (id: string) => {
    if (savedItems.includes(id)) {
      setSavedItems(savedItems.filter(i => i !== id));
      toast({ title: "Removed from watchlist" });
    } else {
      setSavedItems([...savedItems, id]);
      toast({ title: "Added to watchlist" });
    }
  };

  const handleAddToCart = (opportunity: InvestmentOpportunity) => {
    toast({ title: "Added to Cart", description: `${opportunity.name} added to your investment cart` });
  };

  const getMatchBadge = (score: number) => {
    if (score >= 90) return { label: 'Excellent Match', color: 'bg-green-500' };
    if (score >= 80) return { label: 'Great Match', color: 'bg-blue-500' };
    if (score >= 70) return { label: 'Good Match', color: 'bg-yellow-500' };
    return { label: 'Potential Match', color: 'bg-gray-500' };
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Fresh Investment Opportunities</h1>
              <p className="text-gray-500 dark:text-gray-400">AI-curated investments personalized for your profile</p>
            </div>
          </div>
          <Button variant="outline" data-testid="button-refresh">
            <RefreshCw className="w-4 h-4 mr-2" /> Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-600 dark:text-gray-400">For You</p>
                <p className="text-2xl font-bold">{opportunities.length}</p>
              </div>
              <Sparkles className="w-8 h-8 text-purple-400" />
            </div>
            <p className="text-xs text-purple-600 mt-1">AI-curated picks</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Trending</p>
                <p className="text-2xl font-bold">{opportunities.filter(o => o.isTrending).length}</p>
              </div>
              <Flame className="w-8 h-8 text-orange-400" />
            </div>
            <p className="text-xs text-gray-500 mt-1">Popular this week</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">New Arrivals</p>
                <p className="text-2xl font-bold">{opportunities.filter(o => o.isNew).length}</p>
              </div>
              <Zap className="w-8 h-8 text-yellow-400" />
            </div>
            <p className="text-xs text-gray-500 mt-1">Added recently</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Closing Soon</p>
                <p className="text-2xl font-bold text-red-600">{opportunities.filter(o => o.closingDate).length}</p>
              </div>
              <Clock className="w-8 h-8 text-red-400" />
            </div>
            <p className="text-xs text-red-600 mt-1">Limited time</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input 
            placeholder="Search investments..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-search"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[180px]" data-testid="select-type">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Asset Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="mutual_fund">Mutual Funds</SelectItem>
            <SelectItem value="stock">Stocks</SelectItem>
            <SelectItem value="bond">Bonds</SelectItem>
            <SelectItem value="etf">ETFs</SelectItem>
            <SelectItem value="ipo">IPOs</SelectItem>
            <SelectItem value="sgb">Gold Bonds</SelectItem>
            <SelectItem value="fd">Fixed Deposits</SelectItem>
          </SelectContent>
        </Select>
        <Select value={riskFilter} onValueChange={setRiskFilter}>
          <SelectTrigger className="w-[150px]" data-testid="select-risk">
            <Shield className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Risk Level" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Risks</SelectItem>
            <SelectItem value="low">Low Risk</SelectItem>
            <SelectItem value="medium">Medium Risk</SelectItem>
            <SelectItem value="high">High Risk</SelectItem>
            <SelectItem value="very_high">Very High</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="for_you" className="flex items-center gap-2" data-testid="tab-for-you">
            <Sparkles className="w-4 h-4" /> For You
          </TabsTrigger>
          <TabsTrigger value="trending" className="flex items-center gap-2" data-testid="tab-trending">
            <Flame className="w-4 h-4" /> Trending
          </TabsTrigger>
          <TabsTrigger value="new" className="flex items-center gap-2" data-testid="tab-new">
            <Zap className="w-4 h-4" /> New
          </TabsTrigger>
          <TabsTrigger value="closing_soon" className="flex items-center gap-2" data-testid="tab-closing">
            <Clock className="w-4 h-4" /> Closing Soon
          </TabsTrigger>
          <TabsTrigger value="saved" className="flex items-center gap-2" data-testid="tab-saved">
            <Bookmark className="w-4 h-4" /> Saved
            {savedItems.length > 0 && (
              <Badge variant="secondary" className="ml-1">{savedItems.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab}>
          {filteredOpportunities.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Search className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No opportunities found</h3>
                <p className="text-gray-500 dark:text-gray-400">
                  Try adjusting your filters or search criteria
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredOpportunities.map((opportunity) => {
                const typeInfo = typeConfig[opportunity.type];
                const matchBadge = getMatchBadge(opportunity.matchScore);
                const isSaved = savedItems.includes(opportunity.id);
                
                return (
                  <Card 
                    key={opportunity.id}
                    className="hover:shadow-lg transition-shadow"
                    data-testid={`opportunity-${opportunity.id}`}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <Badge className={typeInfo.color}>
                              {typeInfo.label}
                            </Badge>
                            <Badge className={riskColors[opportunity.riskLevel]}>
                              {opportunity.riskLevel.replace('_', ' ')} risk
                            </Badge>
                            {opportunity.isNew && (
                              <Badge className="bg-green-500 text-white">New</Badge>
                            )}
                            {opportunity.isTrending && (
                              <Badge className="bg-orange-500 text-white">
                                <Flame className="w-3 h-3 mr-1" /> Hot
                              </Badge>
                            )}
                          </div>
                          <CardTitle className="text-lg">{opportunity.name}</CardTitle>
                          <CardDescription className="flex items-center gap-2 mt-1">
                            <span>{opportunity.category}</span>
                            {opportunity.issuer && (
                              <>
                                <span>•</span>
                                <span>{opportunity.issuer}</span>
                              </>
                            )}
                          </CardDescription>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => toggleSave(opportunity.id)}
                          className={isSaved ? 'text-red-500' : 'text-gray-400'}
                          data-testid={`button-save-${opportunity.id}`}
                        >
                          <Heart className={`w-5 h-5 ${isSaved ? 'fill-current' : ''}`} />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="pb-3">
                      <div className="flex items-center gap-2 mb-3">
                        <div className={`w-2 h-2 rounded-full ${matchBadge.color}`}></div>
                        <span className="text-sm font-medium">{opportunity.matchScore}% Match</span>
                        <Progress value={opportunity.matchScore} className="flex-1 h-2" />
                      </div>
                      
                      <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg mb-3">
                        <div className="flex items-start gap-2">
                          <Sparkles className="w-4 h-4 text-purple-600 mt-0.5" />
                          <p className="text-sm text-purple-700 dark:text-purple-300">{opportunity.reason}</p>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-3 mb-3">
                        <div className="text-center p-2 bg-gray-50 dark:bg-gray-800 rounded">
                          <p className="text-xs text-gray-500">Min. Investment</p>
                          <p className="font-semibold">{formatCurrency(opportunity.minInvestment)}</p>
                        </div>
                        <div className="text-center p-2 bg-gray-50 dark:bg-gray-800 rounded">
                          <p className="text-xs text-gray-500">Expected Return</p>
                          <p className="font-semibold text-green-600">{opportunity.expectedReturn || 'Varies'}</p>
                        </div>
                        <div className="text-center p-2 bg-gray-50 dark:bg-gray-800 rounded">
                          <p className="text-xs text-gray-500">Rating</p>
                          <p className="font-semibold flex items-center justify-center gap-1">
                            {opportunity.rating} <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex flex-wrap gap-1 mb-3">
                        {opportunity.highlights.map((highlight, i) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            <CheckCircle className="w-3 h-3 mr-1 text-green-500" />
                            {highlight}
                          </Badge>
                        ))}
                      </div>
                      
                      {opportunity.closingDate && (
                        <div className="flex items-center gap-2 text-sm text-red-600 mb-2">
                          <AlertCircle className="w-4 h-4" />
                          <span>Closes: {new Date(opportunity.closingDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                        </div>
                      )}
                    </CardContent>
                    <CardFooter className="border-t pt-3 flex gap-2">
                      <Button 
                        variant="outline" 
                        className="flex-1"
                        data-testid={`button-view-${opportunity.id}`}
                      >
                        <Eye className="w-4 h-4 mr-2" /> View Details
                      </Button>
                      <Button 
                        className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600"
                        onClick={() => handleAddToCart(opportunity)}
                        data-testid={`button-invest-${opportunity.id}`}
                      >
                        <ShoppingCart className="w-4 h-4 mr-2" /> Invest Now
                      </Button>
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Card className="mt-6 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border-indigo-200 dark:border-indigo-800">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Target className="w-8 h-8 text-indigo-600" />
              <div>
                <p className="font-medium text-indigo-900 dark:text-indigo-200">Not finding what you're looking for?</p>
                <p className="text-sm text-indigo-700 dark:text-indigo-300">
                  Talk to our AI advisor for personalized recommendations based on your specific goals
                </p>
              </div>
            </div>
            <Button variant="outline" className="border-indigo-300 text-indigo-700 hover:bg-indigo-100" data-testid="button-ai-advisor">
              <Sparkles className="w-4 h-4 mr-2" /> Ask AI Advisor
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
