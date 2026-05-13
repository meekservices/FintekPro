import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { 
  Globe, TrendingUp, TrendingDown, BarChart3, PieChart, 
  Clock, RefreshCw, ArrowUpRight, ArrowDownRight, Search,
  Zap, Shield as LucideShield, Bell, Star, Eye, Play, Square,
  Activity, Target, DollarSign, Banknote, CreditCard,
  Moon, Sun, Calendar, AlertCircle, CheckCircle,
  Building2, MapPin, Percent, Users, Settings, Wallet
} from "lucide-react";

interface GlobalStock {
  symbol: string;
  name: string;
  exchange: string;
  country: string;
  currency: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap: string;
  sector: string;
  timezone: string;
  isMarketOpen: boolean;
}

interface GlobalMutualFund {
  id: string;
  name: string;
  fundHouse: string;
  category: string;
  region: string;
  currency: string;
  nav: number;
  change: number;
  changePercent: number;
  aum: string;
  expenseRatio: number;
  rating: number;
}

interface CurrencyRate {
  from: string;
  to: string;
  rate: number;
  change: number;
  changePercent: number;
}

interface GlobalPosition {
  symbol: string;
  name: string;
  exchange: string;
  currency: string;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  pnl: number;
  pnlPercent: number;
  pnlInINR: number;
  type: "EQUITY" | "ETF" | "MUTUAL_FUND";
}

interface MarketSession {
  market: string;
  timezone: string;
  status: "OPEN" | "CLOSED" | "PRE_MARKET" | "AFTER_MARKET";
  openTime: string;
  closeTime: string;
  nextSession: string;
}

// Sample global stocks data
const globalStocks: GlobalStock[] = [
  {
    symbol: "AAPL",
    name: "Apple Inc.",
    exchange: "NASDAQ",
    country: "United States",
    currency: "USD",
    price: 189.43,
    change: 2.15,
    changePercent: 1.15,
    volume: 45623789,
    marketCap: "$2.95T",
    sector: "Technology",
    timezone: "EST",
    isMarketOpen: false
  },
  {
    symbol: "MSFT",
    name: "Microsoft Corporation",
    exchange: "NASDAQ",
    country: "United States",
    currency: "USD",
    price: 374.58,
    change: -3.42,
    changePercent: -0.91,
    volume: 23456789,
    marketCap: "$2.78T",
    sector: "Technology",
    timezone: "EST",
    isMarketOpen: false
  },
  {
    symbol: "TSLA",
    name: "Tesla, Inc.",
    exchange: "NASDAQ",
    country: "United States",
    currency: "USD",
    price: 234.86,
    change: 8.92,
    changePercent: 3.95,
    volume: 87654321,
    marketCap: "$745B",
    sector: "Automotive",
    timezone: "EST",
    isMarketOpen: false
  },
  {
    symbol: "ASML",
    name: "ASML Holding N.V.",
    exchange: "EURONEXT",
    country: "Netherlands",
    currency: "EUR",
    price: 645.80,
    change: 12.40,
    changePercent: 1.96,
    volume: 1234567,
    marketCap: "€264B",
    sector: "Technology",
    timezone: "CET",
    isMarketOpen: true
  },
  {
    symbol: "7203.T",
    name: "Toyota Motor Corporation",
    exchange: "TSE",
    country: "Japan",
    currency: "JPY",
    price: 2456.0,
    change: -45.0,
    changePercent: -1.8,
    volume: 9876543,
    marketCap: "¥36.8T",
    sector: "Automotive",
    timezone: "JST",
    isMarketOpen: true
  }
];

// Sample global mutual funds
const globalMutualFunds: GlobalMutualFund[] = [
  {
    id: "vti",
    name: "Vanguard Total Stock Market ETF",
    fundHouse: "Vanguard",
    category: "US Equity",
    region: "United States",
    currency: "USD",
    nav: 243.56,
    change: 2.34,
    changePercent: 0.97,
    aum: "$1.3T",
    expenseRatio: 0.03,
    rating: 5
  },
  {
    id: "vea",
    name: "Vanguard Developed Markets ETF",
    fundHouse: "Vanguard",
    category: "International Equity",
    region: "Global",
    currency: "USD",
    nav: 51.82,
    change: 0.45,
    changePercent: 0.88,
    aum: "$104B",
    expenseRatio: 0.05,
    rating: 4
  },
  {
    id: "eem",
    name: "iShares MSCI Emerging Markets ETF",
    fundHouse: "iShares",
    category: "Emerging Markets",
    region: "Emerging Markets",
    currency: "USD",
    nav: 38.94,
    change: -0.23,
    changePercent: -0.59,
    aum: "$25B",
    expenseRatio: 0.68,
    rating: 3
  }
];

// Currency rates
const currencyRates: CurrencyRate[] = [
  { from: "USD", to: "INR", rate: 83.25, change: 0.15, changePercent: 0.18 },
  { from: "EUR", to: "INR", rate: 90.42, change: -0.32, changePercent: -0.35 },
  { from: "GBP", to: "INR", rate: 105.68, change: 0.45, changePercent: 0.43 },
  { from: "JPY", to: "INR", rate: 0.56, change: 0.01, changePercent: 0.89 },
];

// Market sessions
const marketSessions: MarketSession[] = [
  {
    market: "Tokyo (TSE)",
    timezone: "JST (UTC+9)",
    status: "OPEN",
    openTime: "09:00",
    closeTime: "15:00",
    nextSession: "Current"
  },
  {
    market: "Hong Kong (HKEX)",
    timezone: "HKT (UTC+8)",
    status: "OPEN", 
    openTime: "09:30",
    closeTime: "16:00",
    nextSession: "Current"
  },
  {
    market: "London (LSE)",
    timezone: "GMT (UTC+0)",
    status: "CLOSED",
    openTime: "08:00",
    closeTime: "16:30",
    nextSession: "8 hours"
  },
  {
    market: "New York (NYSE)",
    timezone: "EST (UTC-5)",
    status: "CLOSED",
    openTime: "09:30",
    closeTime: "16:00",
    nextSession: "12 hours"
  }
];

// Sample global positions
const globalPositions: GlobalPosition[] = [
  {
    symbol: "AAPL",
    name: "Apple Inc.",
    exchange: "NASDAQ",
    currency: "USD",
    quantity: 10,
    avgPrice: 185.50,
    currentPrice: 189.43,
    pnl: 39.30,
    pnlPercent: 2.12,
    pnlInINR: 3270.98,
    type: "EQUITY"
  },
  {
    symbol: "VTI",
    name: "Vanguard Total Stock Market ETF",
    exchange: "NASDAQ",
    currency: "USD",
    quantity: 20,
    avgPrice: 240.25,
    currentPrice: 243.56,
    pnl: 66.20,
    pnlPercent: 1.38,
    pnlInINR: 5509.15,
    type: "ETF"
  }
];

export default function GlobalTrading() {
  const [activeTab, setActiveTab] = useState("markets");
  const [selectedMarket, setSelectedMarket] = useState("ALL");
  const [selectedCurrency, setSelectedCurrency] = useState("USD");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStock, setSelectedStock] = useState<GlobalStock | null>(null);
  const [showCurrencyConverter, setShowCurrencyConverter] = useState(false);
  const [convertAmount, setConvertAmount] = useState("");
  const [fromCurrency, setFromCurrency] = useState("USD");
  const [toCurrency, setToCurrency] = useState("INR");
  
  const { isAuthenticated, user } = useAuth();
  const { toast } = useToast();

  // Fetch real market data from US Trading API
  const { data: stocksData, isLoading: loadingStocks } = useQuery<{ success: boolean; stocks: any[]; fxRate: number }>({
    queryKey: ["/api/us-trading/market/stocks"],
  });

  const { data: etfsData, isLoading: loadingEtfs } = useQuery<{ success: boolean; etfs: any[]; fxRate: number }>({
    queryKey: ["/api/us-trading/market/etfs"],
  });

  const { data: positionsData, isLoading: loadingPositions } = useQuery<{
    positions: any[];
    totalValueUSD: number;
    totalValueINR: number;
    totalGainLossUSD: number;
    totalGainLossPercent: number;
  }>({
    queryKey: ["/api/us-trading/positions"],
  });

  const { data: eligibilityData } = useQuery<{
    eligible: boolean;
    lrsUsed: number;
    lrsLimit: number;
    lrsRemaining: number;
  }>({
    queryKey: ["/api/us-trading/eligibility"],
  });

  const { data: searchResults, isLoading: searching } = useQuery<{ success: boolean; results: any[] }>({
    queryKey: ["/api/us-trading/market/search", searchTerm],
    enabled: searchTerm.length >= 2,
  });

  const fxRate = stocksData?.fxRate || 83.5;
  const apiStocks = stocksData?.stocks || [];
  const apiEtfs = etfsData?.etfs || [];
  const apiPositions = positionsData?.positions || [];

  const markets = ["ALL", "US", "Europe", "Asia", "Emerging"];

  // Merge API data with fallback mock data
  const displayStocks = apiStocks.length > 0 ? apiStocks.map((s: any) => ({
    symbol: s.symbol,
    name: s.name,
    exchange: s.primaryExchange || "NASDAQ",
    country: "United States",
    currency: s.currency || "USD",
    price: s.price || 0,
    change: s.change || 0,
    changePercent: s.changePercent || 0,
    volume: s.volume || 0,
    marketCap: s.marketCap ? `$${(s.marketCap / 1e12).toFixed(2)}T` : "N/A",
    sector: "Technology",
    timezone: "EST",
    isMarketOpen: false
  })) : globalStocks;

  const filteredStocks = displayStocks.filter((stock: GlobalStock) => {
    const matchesSearch = stock.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         stock.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesMarket = selectedMarket === "ALL" || 
                         (selectedMarket === "US" && stock.country === "United States") ||
                         (selectedMarket === "Europe" && ["Netherlands", "Germany", "UK"].includes(stock.country)) ||
                         (selectedMarket === "Asia" && ["Japan", "Singapore", "Hong Kong"].includes(stock.country));
    return matchesSearch && matchesMarket;
  });

  const totalGlobalPnL = apiPositions.length > 0 
    ? (positionsData?.totalGainLossUSD || 0) * fxRate
    : globalPositions.reduce((sum, pos) => sum + pos.pnlInINR, 0);

  const getCurrentTimeForMarket = (timezone: string) => {
    // Simplified time calculation for demo
    const now = new Date();
    return now.toLocaleTimeString();
  };

  const handleGlobalTrade = (stock: GlobalStock) => {
    if (!isAuthenticated) {
      toast({
        title: "Login Required",
        description: "Please login to trade global stocks.",
      });
      return;
    }

    toast({
      title: "Global Trade Initiated",
      description: `Trading ${stock.symbol} on ${stock.exchange}. Currency conversion will be handled automatically.`,
    });
  };

  const convertCurrency = (amount: number, fromRate: number, toRate: number) => {
    return (amount / fromRate * toRate).toFixed(2);
  };

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Globe className="h-8 w-8 text-blue-600" />
            Global Trading
          </h1>
          <p className="text-muted-foreground">International Stock Markets • 24/5 Trading • Multi-Currency</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-xs text-muted-foreground">USD/INR</p>
            <p className="font-bold">₹{fxRate.toFixed(2)}</p>
          </div>
          <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
            <div className="w-2 h-2 bg-blue-500 rounded-full mr-1 animate-pulse"></div>
            24/5 Trading Active
          </Badge>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ["/api/us-trading/market/stocks"] });
              queryClient.invalidateQueries({ queryKey: ["/api/us-trading/market/etfs"] });
              queryClient.invalidateQueries({ queryKey: ["/api/us-trading/positions"] });
            }}
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${loadingStocks ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Global Portfolio Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Global P&L (₹)</p>
                <p className={`text-lg font-bold ${totalGlobalPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  ₹{Math.abs(totalGlobalPnL).toLocaleString()}
                </p>
              </div>
              <Globe className="h-6 w-6 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Markets Open</p>
                <p className="text-lg font-bold text-green-600">2/4</p>
              </div>
              <Clock className="h-6 w-6 text-green-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Positions</p>
                <p className="text-lg font-bold">{apiPositions.length || globalPositions.length}</p>
              </div>
              <Target className="h-6 w-6 text-purple-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">LRS Available</p>
                <p className="text-lg font-bold">${((eligibilityData?.lrsRemaining || 250000) / 1000).toFixed(0)}K</p>
              </div>
              <LucideShield className="h-6 w-6 text-blue-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Market Sessions Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-orange-600" />
            Global Market Sessions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-4 gap-4">
            {marketSessions.map(session => (
              <div key={session.market} className="p-3 border rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-semibold">{session.market}</div>
                  <Badge 
                    variant={session.status === "OPEN" ? "default" : "secondary"}
                    className={session.status === "OPEN" ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200" : ""}
                  >
                    {session.status}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground">
                  <div>{session.timezone}</div>
                  <div>{session.openTime} - {session.closeTime}</div>
                  {session.status === "CLOSED" && (
                    <div className="text-orange-600 mt-1">Next: {session.nextSession}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Main Content */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Trading Interface */}
        <div className="lg:col-span-2 space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <div className="overflow-x-auto pb-2">
              <ScrollableTabsList className="inline-flex w-auto min-w-full">
                <TabsTrigger value="markets" data-testid="tab-markets" className="flex-shrink-0">Markets</TabsTrigger>
                <TabsTrigger value="positions" data-testid="tab-positions" className="flex-shrink-0">Positions</TabsTrigger>
                <TabsTrigger value="funds" data-testid="tab-funds" className="flex-shrink-0">Global Funds</TabsTrigger>
                <TabsTrigger value="currency" data-testid="tab-currency" className="flex-shrink-0">Currency</TabsTrigger>
              </ScrollableTabsList>
            </div>

            {/* Markets Tab */}
            <TabsContent value="markets" className="space-y-4">
              <Card>
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5 text-blue-600" />
                      Global Markets
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <Select value={selectedMarket} onValueChange={setSelectedMarket}>
                        <SelectTrigger className="w-32" data-testid="select-market">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {markets.map(market => (
                            <SelectItem key={market} value={market}>{market}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="relative">
                        <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
                        <Input
                          placeholder="Search global stocks..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-10 w-64"
                          data-testid="input-search-global"
                        />
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {loadingStocks ? (
                    <div className="space-y-3">
                      {[...Array(5)].map((_, i) => (
                        <div key={i} className="flex items-center justify-between p-2">
                          <div className="flex items-center gap-4">
                            <Skeleton className="h-10 w-16" />
                            <Skeleton className="h-4 w-32" />
                          </div>
                          <Skeleton className="h-8 w-20" />
                        </div>
                      ))}
                    </div>
                  ) : (
                  <div className="overflow-x-auto">
                    {searchTerm.length >= 2 && searchResults?.results && searchResults.results.length > 0 && (
                      <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                        <p className="text-sm font-medium mb-2">Search Results ({searchResults.results.length})</p>
                        <div className="flex flex-wrap gap-2">
                          {searchResults.results.map((result: any) => (
                            <Badge 
                              key={result.symbol} 
                              variant="outline" 
                              className="cursor-pointer hover:bg-primary hover:text-primary-foreground"
                              onClick={() => handleGlobalTrade({ ...result, price: 0, change: 0, changePercent: 0, volume: 0, marketCap: '', sector: '', timezone: 'EST', isMarketOpen: false, country: 'United States', exchange: result.primaryExchange })}
                            >
                              {result.symbol} - {result.name}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-2">Symbol</th>
                          <th className="text-left p-2">Exchange</th>
                          <th className="text-right p-2">Price</th>
                          <th className="text-right p-2">Change</th>
                          <th className="text-center p-2">Market</th>
                          <th className="text-center p-2">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredStocks.map((stock: GlobalStock) => (
                          <tr 
                            key={`${stock.symbol}-${stock.exchange}`}
                            className="border-b hover:bg-muted dark:hover:bg-card/50"
                            onClick={() => setSelectedStock(stock)}
                          >
                            <td className="p-2">
                              <div>
                                <div className="font-semibold flex items-center gap-2">
                                  {stock.symbol}
                                  {stock.isMarketOpen ? (
                                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                                  ) : (
                                    <div className="w-2 h-2 bg-muted-foreground rounded-full" />
                                  )}
                                </div>
                                <div className="text-xs text-muted-foreground">{stock.name}</div>
                              </div>
                            </td>
                            <td className="p-2">
                              <div>
                                <div className="font-medium">{stock.exchange}</div>
                                <div className="text-xs text-muted-foreground">{stock.country}</div>
                              </div>
                            </td>
                            <td className="text-right p-2">
                              <div className="font-semibold">{stock.currency} {stock.price.toFixed(2)}</div>
                              <div className="text-xs text-muted-foreground">₹{(stock.price * 83.25).toFixed(2)}</div>
                            </td>
                            <td className={`text-right p-2 ${stock.changePercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              <div className="flex items-center justify-end gap-1">
                                {stock.changePercent >= 0 ? 
                                  <ArrowUpRight className="h-3 w-3" /> : 
                                  <ArrowDownRight className="h-3 w-3" />
                                }
                                {Math.abs(stock.changePercent).toFixed(2)}%
                              </div>
                            </td>
                            <td className="text-center p-2">
                              <Badge 
                                variant={stock.isMarketOpen ? "default" : "secondary"}
                                className={stock.isMarketOpen ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200" : ""}
                              >
                                {stock.isMarketOpen ? "OPEN" : "CLOSED"}
                              </Badge>
                            </td>
                            <td className="text-center p-2">
                              <Button 
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleGlobalTrade(stock);
                                }}
                                data-testid={`button-trade-${stock.symbol}`}
                              >
                                Trade
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Positions Tab */}
            <TabsContent value="positions" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PieChart className="h-5 w-5 text-green-600" />
                    Global Positions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-2">Symbol</th>
                          <th className="text-right p-2">Qty</th>
                          <th className="text-right p-2">Avg Price</th>
                          <th className="text-right p-2">Current</th>
                          <th className="text-right p-2">P&L (₹)</th>
                          <th className="text-center p-2">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {globalPositions.map(position => (
                          <tr key={`${position.symbol}-${position.exchange}`} className="border-b">
                            <td className="p-2">
                              <div>
                                <div className="font-semibold">{position.symbol}</div>
                                <div className="text-xs text-muted-foreground">{position.exchange} • {position.type}</div>
                              </div>
                            </td>
                            <td className="text-right p-2">{position.quantity}</td>
                            <td className="text-right p-2">{position.currency} {position.avgPrice.toFixed(2)}</td>
                            <td className="text-right p-2">{position.currency} {position.currentPrice.toFixed(2)}</td>
                            <td className={`text-right p-2 ${position.pnlInINR >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              <div>₹{Math.abs(position.pnlInINR).toFixed(2)}</div>
                              <div className="text-xs">({position.pnlPercent >= 0 ? '+' : ''}{position.pnlPercent.toFixed(2)}%)</div>
                            </td>
                            <td className="text-center p-2">
                              <Button 
                                size="sm" 
                                variant="outline"
                                data-testid={`button-sell-${position.symbol}`}
                              >
                                Sell
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Global Funds Tab */}
            <TabsContent value="funds" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-purple-600" />
                    Global Mutual Funds & ETFs
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-2 gap-4">
                    {globalMutualFunds.map(fund => (
                      <Card key={fund.id} className="border-2 hover:border-purple-200 dark:border-purple-800 transition-colors">
                        <CardHeader className="pb-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <CardTitle className="text-lg mb-1">{fund.name}</CardTitle>
                              <div className="text-sm text-muted-foreground">{fund.fundHouse} • {fund.region}</div>
                            </div>
                            <div className="flex items-center gap-1">
                              {[...Array(5)].map((_, i) => (
                                <Star 
                                  key={i} 
                                  className={`h-3 w-3 ${i < fund.rating ? 'text-yellow-400 fill-current' : 'text-muted-foreground'}`} 
                                />
                              ))}
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <div className="text-sm text-muted-foreground">NAV</div>
                              <div className="font-semibold">{fund.currency} {fund.nav.toFixed(2)}</div>
                            </div>
                            <div>
                              <div className="text-sm text-muted-foreground">Change</div>
                              <div className={`font-semibold ${fund.changePercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {fund.changePercent >= 0 ? '+' : ''}{fund.changePercent.toFixed(2)}%
                              </div>
                            </div>
                            <div>
                              <div className="text-sm text-muted-foreground">AUM</div>
                              <div className="font-semibold">{fund.aum}</div>
                            </div>
                            <div>
                              <div className="text-sm text-muted-foreground">Expense Ratio</div>
                              <div className="font-semibold">{fund.expenseRatio}%</div>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-1 mb-3">
                            <Badge variant="secondary">{fund.category}</Badge>
                            <Badge variant="outline">{fund.region}</Badge>
                          </div>
                          <Button className="w-full" data-testid={`button-invest-${fund.id}`}>
                            Invest Now
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Currency Tab */}
            <TabsContent value="currency" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Banknote className="h-5 w-5 text-green-600" />
                    Currency Exchange Rates
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <h4 className="font-semibold">Live Exchange Rates</h4>
                      {currencyRates.map(rate => (
                        <div key={`${rate.from}-${rate.to}`} className="flex items-center justify-between p-3 border rounded-lg">
                          <div>
                            <div className="font-semibold">{rate.from}/{rate.to}</div>
                            <div className="text-sm text-muted-foreground">1 {rate.from} = ₹{rate.rate.toFixed(2)}</div>
                          </div>
                          <div className={`text-right ${rate.changePercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            <div className="font-semibold">
                              {rate.changePercent >= 0 ? '+' : ''}{rate.changePercent.toFixed(2)}%
                            </div>
                            <div className="text-sm">
                              {rate.changePercent >= 0 ? '+' : ''}₹{rate.change.toFixed(2)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    <div className="space-y-4">
                      <h4 className="font-semibold">Currency Converter</h4>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium mb-1">Amount</label>
                          <Input 
                            type="number"
                            value={convertAmount}
                            onChange={(e) => setConvertAmount(e.target.value)}
                            placeholder="Enter amount"
                            data-testid="input-convert-amount"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-sm font-medium mb-1">From</label>
                            <Select value={fromCurrency} onValueChange={setFromCurrency}>
                              <SelectTrigger data-testid="select-from-currency">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="USD">USD</SelectItem>
                                <SelectItem value="EUR">EUR</SelectItem>
                                <SelectItem value="GBP">GBP</SelectItem>
                                <SelectItem value="JPY">JPY</SelectItem>
                                <SelectItem value="INR">INR</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-1">To</label>
                            <Select value={toCurrency} onValueChange={setToCurrency}>
                              <SelectTrigger data-testid="select-to-currency">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="INR">INR</SelectItem>
                                <SelectItem value="USD">USD</SelectItem>
                                <SelectItem value="EUR">EUR</SelectItem>
                                <SelectItem value="GBP">GBP</SelectItem>
                                <SelectItem value="JPY">JPY</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        {convertAmount && (
                          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                            <div className="text-sm text-muted-foreground">Converted Amount</div>
                            <div className="text-lg font-bold text-blue-600">
                              {toCurrency} {(Number(convertAmount) * 83.25).toFixed(2)}
                            </div>
                            <div className="text-xs text-muted-foreground">Rate: 1 {fromCurrency} = 83.25 {toCurrency}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Trading Panel & Tools */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-yellow-600" />
                Global Quick Trade
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {selectedStock ? (
                <div className="space-y-4">
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <div className="flex items-center justify-between mb-1">
                      <div className="font-semibold">{selectedStock.symbol}</div>
                      <Badge variant={selectedStock.isMarketOpen ? "default" : "secondary"}>
                        {selectedStock.isMarketOpen ? "OPEN" : "CLOSED"}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">{selectedStock.exchange}</div>
                    <div className="text-lg font-bold">{selectedStock.currency} {selectedStock.price.toFixed(2)}</div>
                    <div className="text-sm text-muted-foreground">₹{(selectedStock.price * 83.25).toFixed(2)} (INR)</div>
                    <div className={`text-sm ${selectedStock.changePercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {selectedStock.changePercent >= 0 ? '+' : ''}{selectedStock.changePercent.toFixed(2)}%
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <Button className="bg-green-600 hover:bg-green-700 text-white" data-testid="button-global-buy">
                      BUY
                    </Button>
                    <Button className="bg-red-600 hover:bg-red-700 text-white" data-testid="button-global-sell">
                      SELL
                    </Button>
                  </div>
                  
                  <div className="space-y-3">
                    <Input placeholder="Quantity" data-testid="input-global-quantity" />
                    <Input placeholder={`Price (${selectedStock.currency})`} data-testid="input-global-price" />
                    <Select>
                      <SelectTrigger data-testid="select-global-order-type">
                        <SelectValue placeholder="Order Type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MARKET">Market</SelectItem>
                        <SelectItem value="LIMIT">Limit</SelectItem>
                        <SelectItem value="STOP">Stop</SelectItem>
                      </SelectContent>
                    </Select>
                    
                    <Button className="w-full" data-testid="button-place-global-order">
                      Place Global Order
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Globe className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Select a global stock to trade</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-blue-600" />
                Global Indices
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between p-2 border rounded-lg">
                <div>
                  <div className="font-semibold">S&P 500</div>
                  <div className="text-sm text-muted-foreground">US</div>
                </div>
                <div className="text-right">
                  <div className="font-semibold">4,567.80</div>
                  <div className="text-sm text-green-600">+0.75%</div>
                </div>
              </div>
              
              <div className="flex items-center justify-between p-2 border rounded-lg">
                <div>
                  <div className="font-semibold">FTSE 100</div>
                  <div className="text-sm text-muted-foreground">UK</div>
                </div>
                <div className="text-right">
                  <div className="font-semibold">7,456.32</div>
                  <div className="text-sm text-red-600">-0.23%</div>
                </div>
              </div>
              
              <div className="flex items-center justify-between p-2 border rounded-lg">
                <div>
                  <div className="font-semibold">Nikkei 225</div>
                  <div className="text-sm text-muted-foreground">Japan</div>
                </div>
                <div className="text-right">
                  <div className="font-semibold">33,248.95</div>
                  <div className="text-sm text-green-600">+1.12%</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LucideShield className="h-5 w-5 text-green-600" />
                Global Trading Tools
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button variant="outline" className="w-full justify-start" data-testid="button-global-research">
                <BarChart3 className="h-4 w-4 mr-2" />
                Global Research
              </Button>
              <Button variant="outline" className="w-full justify-start" data-testid="button-international-news">
                <Bell className="h-4 w-4 mr-2" />
                International News
              </Button>
              <Button variant="outline" className="w-full justify-start" data-testid="button-currency-hedging">
                <LucideShield className="h-4 w-4 mr-2" />
                Currency Hedging
              </Button>
              <Button variant="outline" className="w-full justify-start" data-testid="button-adr-screening">
                <Search className="h-4 w-4 mr-2" />
                ADR Screening
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}