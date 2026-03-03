import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useMemo } from "react";
import { 
  Wheat, 
  TrendingUp, 
  TrendingDown, 
  BarChart3, 
  PieChart, 
  Activity,
  Leaf,
  Target,
  Calendar,
  Filter,
  RefreshCw
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Legend,
  AreaChart,
  Area
} from "recharts";

interface NCDEXCommodity {
  symbol: string;
  name: string;
  unit: string;
  expiry: string;
  category: string;
  ltp: number;
  change: number;
  pchange: number;
  high: number;
  low: number;
  volume: number;
  openInterest: number;
  lastUpdate?: string;
}

export function AgriculturalInsights() {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedTimeframe, setSelectedTimeframe] = useState<string>("1month");

  const { data: commodities, isLoading: commoditiesLoading, refetch } = useQuery({
    queryKey: ['/api/ncdex/commodities'],
    refetchInterval: 30000,
  });

  const { data: gainers } = useQuery({
    queryKey: ['/api/ncdex/gainers'],
    refetchInterval: 30000,
  });

  const { data: losers } = useQuery({
    queryKey: ['/api/ncdex/losers'],
    refetchInterval: 30000,
  });

  const commoditiesData: NCDEXCommodity[] = (commodities as any)?.data || [];
  const gainersData: NCDEXCommodity[] = (gainers as any)?.data || [];
  const losersData: NCDEXCommodity[] = (losers as any)?.data || [];

  // Filter data based on selected category
  const filteredCommodities = useMemo(() => {
    if (selectedCategory === "all") return commoditiesData;
    return commoditiesData.filter(commodity => 
      commodity.category.toLowerCase() === selectedCategory.toLowerCase()
    );
  }, [commoditiesData, selectedCategory]);

  // Get unique categories
  const categories = useMemo(() => {
    const cats = Array.from(new Set(commoditiesData.map(c => c.category)));
    return ["all", ...cats];
  }, [commoditiesData]);

  // Generate historical price data (simulated for demonstration)
  const generateHistoricalData = (commodity: NCDEXCommodity) => {
    const data = [];
    const currentPrice = commodity.ltp;
    
    for (let i = 30; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      
      // Simulate price fluctuation
      const volatility = 0.05; // 5% volatility
      const randomFactor = 1 + (Math.random() - 0.5) * volatility;
      const price = currentPrice * randomFactor;
      
      data.push({
        date: date.toLocaleDateString(),
        price: price.toFixed(2),
        volume: Math.floor(Math.random() * 50000) + 10000,
        commodity: commodity.name
      });
    }
    return data;
  };

  // Calculate market metrics
  const marketMetrics = useMemo(() => {
    if (filteredCommodities.length === 0) return null;

    const totalVolume = filteredCommodities.reduce((sum, c) => sum + c.volume, 0);
    const totalValue = filteredCommodities.reduce((sum, c) => sum + (c.ltp * c.volume), 0);
    const avgPrice = filteredCommodities.reduce((sum, c) => sum + c.ltp, 0) / filteredCommodities.length;
    const advancing = filteredCommodities.filter(c => c.change > 0).length;
    const declining = filteredCommodities.filter(c => c.change < 0).length;
    
    // Top performer
    const topGainer = filteredCommodities.reduce((max, c) => 
      c.pchange > max.pchange ? c : max, filteredCommodities[0]);
    
    // Worst performer
    const topLoser = filteredCommodities.reduce((min, c) => 
      c.pchange < min.pchange ? c : min, filteredCommodities[0]);

    return {
      totalVolume,
      totalValue,
      avgPrice,
      advancing,
      declining,
      topGainer,
      topLoser,
      marketSentiment: advancing > declining ? "Bullish" : "Bearish",
      totalCommodities: filteredCommodities.length
    };
  }, [filteredCommodities]);

  // Category performance data
  const categoryPerformance = useMemo(() => {
    const categoryStats: Record<string, {
      name: string;
      commodities: NCDEXCommodity[];
      totalVolume: number;
      avgChange: number;
    }> = {};
    
    commoditiesData.forEach(commodity => {
      if (!categoryStats[commodity.category]) {
        categoryStats[commodity.category] = {
          name: commodity.category,
          commodities: [],
          totalVolume: 0,
          avgChange: 0
        };
      }
      categoryStats[commodity.category].commodities.push(commodity);
      categoryStats[commodity.category].totalVolume += commodity.volume;
    });

    return Object.values(categoryStats).map((cat) => ({
      name: cat.name,
      value: cat.totalVolume,
      commodities: cat.commodities.length,
      avgChange: cat.commodities.reduce((sum: number, c: NCDEXCommodity) => sum + c.pchange, 0) / cat.commodities.length
    }));
  }, [commoditiesData]);

  // Colors for charts
  const COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

  if (commoditiesLoading) {
    return (
      <div className="space-y-4" data-testid="agricultural-insights-loading">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-2/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="h-32 bg-muted rounded"></div>
            <div className="h-32 bg-muted rounded"></div>
            <div className="h-32 bg-muted rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="agricultural-insights">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
            <Wheat className="h-6 w-6 text-green-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-foreground">Agricultural Market Insights</h2>
            <p className="text-muted-foreground">Comprehensive NCDEX commodity analysis and trends</p>
          </div>
        </div>
        <Button 
          variant="outline" 
          onClick={() => refetch()}
          className="flex items-center space-x-2"
          data-testid="refresh-insights"
        >
          <RefreshCw className="h-4 w-4" />
          <span>Refresh</span>
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Filter className="h-5 w-5 mr-2" />
            Market Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="flex flex-col space-y-2">
              <label className="text-sm font-medium">Category</label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category === "all" ? "All Categories" : category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col space-y-2">
              <label className="text-sm font-medium">Timeframe</label>
              <Select value={selectedTimeframe} onValueChange={setSelectedTimeframe}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select timeframe" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1day">1 Day</SelectItem>
                  <SelectItem value="1week">1 Week</SelectItem>
                  <SelectItem value="1month">1 Month</SelectItem>
                  <SelectItem value="3months">3 Months</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Market Overview Cards */}
      {marketMetrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Market Sentiment</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                <Badge className={marketMetrics.marketSentiment === 'Bullish' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200' : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200'}>
                  {marketMetrics.marketSentiment}
                </Badge>
                <div className="text-sm text-muted-foreground">
                  {marketMetrics.advancing}↑ {marketMetrics.declining}↓
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Volume</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {(marketMetrics.totalVolume / 1000).toFixed(1)}K
              </div>
              <p className="text-sm text-muted-foreground">MT traded</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Avg Price</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ₹{marketMetrics.avgPrice.toFixed(0)}
              </div>
              <p className="text-sm text-muted-foreground">per unit</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Active Commodities</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {marketMetrics.totalCommodities}
              </div>
              <p className="text-sm text-muted-foreground">in {selectedCategory === "all" ? "all categories" : selectedCategory}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Analytics Tabs */}
      <Tabs defaultValue="performance" className="w-full">
        <ScrollableTabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="performance" className="flex items-center">
            <BarChart3 className="h-4 w-4 mr-1" />
            Performance
          </TabsTrigger>
          <TabsTrigger value="categories" className="flex items-center">
            <PieChart className="h-4 w-4 mr-1" />
            Categories
          </TabsTrigger>
          <TabsTrigger value="trends" className="flex items-center">
            <Activity className="h-4 w-4 mr-1" />
            Trends
          </TabsTrigger>
          <TabsTrigger value="seasonal" className="flex items-center">
            <Calendar className="h-4 w-4 mr-1" />
            Seasonal
          </TabsTrigger>
        </ScrollableTabsList>

        <TabsContent value="performance" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Price Performance Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Price Performance Comparison</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={filteredCommodities.slice(0, 6)}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="symbol" 
                        tick={{ fontSize: 12 }}
                        interval={0}
                        angle={-45}
                        textAnchor="end"
                        height={60}
                      />
                      <YAxis />
                      <Tooltip 
                        formatter={(value: any, name: string) => [
                          name === 'ltp' ? `₹${value}` : `${value}%`,
                          name === 'ltp' ? 'Price' : '% Change'
                        ]}
                        labelFormatter={(label) => `Symbol: ${label}`}
                      />
                      <Bar dataKey="ltp" fill="#10B981" name="ltp" />
                      <Bar dataKey="pchange" fill="#3B82F6" name="pchange" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Volume Analysis */}
            <Card>
              <CardHeader>
                <CardTitle>Volume Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={filteredCommodities.slice(0, 6)}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="symbol" 
                        tick={{ fontSize: 12 }}
                        interval={0}
                        angle={-45}
                        textAnchor="end"
                        height={60}
                      />
                      <YAxis />
                      <Tooltip 
                        formatter={(value: any) => [value.toLocaleString(), 'Volume']}
                        labelFormatter={(label) => `Symbol: ${label}`}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="volume" 
                        stroke="#F59E0B" 
                        fill="#FEF3C7" 
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Top Performers */}
          {marketMetrics && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="border-l-4 border-l-green-500">
                <CardHeader>
                  <CardTitle className="flex items-center text-green-700 dark:text-green-300">
                    <TrendingUp className="h-5 w-5 mr-2" />
                    Best Performer
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="font-semibold">{marketMetrics.topGainer.name}</h3>
                      <p className="text-sm text-muted-foreground">{marketMetrics.topGainer.category}</p>
                      <p className="text-2xl font-bold">₹{marketMetrics.topGainer.ltp.toFixed(2)}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-green-600">
                        +{marketMetrics.topGainer.pchange.toFixed(2)}%
                      </div>
                      <div className="text-sm text-muted-foreground">
                        +₹{marketMetrics.topGainer.change.toFixed(2)}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-l-4 border-l-red-500">
                <CardHeader>
                  <CardTitle className="flex items-center text-red-700 dark:text-red-300">
                    <TrendingDown className="h-5 w-5 mr-2" />
                    Worst Performer
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="font-semibold">{marketMetrics.topLoser.name}</h3>
                      <p className="text-sm text-muted-foreground">{marketMetrics.topLoser.category}</p>
                      <p className="text-2xl font-bold">₹{marketMetrics.topLoser.ltp.toFixed(2)}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-red-600">
                        {marketMetrics.topLoser.pchange.toFixed(2)}%
                      </div>
                      <div className="text-sm text-muted-foreground">
                        ₹{marketMetrics.topLoser.change.toFixed(2)}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="categories" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Category Distribution Pie Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Volume Distribution by Category</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPieChart>
                      <Pie
                        data={categoryPerformance}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }: { name: string; percent: number }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {categoryPerformance.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: any) => [value.toLocaleString(), 'Volume']} />
                      <Legend />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Category Performance */}
            <Card>
              <CardHeader>
                <CardTitle>Category Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {categoryPerformance.map((category, index) => (
                    <div key={category.name} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div 
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        ></div>
                        <div>
                          <p className="font-medium">{category.name}</p>
                          <p className="text-sm text-muted-foreground">{category.commodities} commodities</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{(category.value / 1000).toFixed(1)}K MT</p>
                        <p className={`text-sm ${category.avgChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {category.avgChange >= 0 ? '+' : ''}{category.avgChange.toFixed(2)}%
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Price Trend Analysis - Top Commodities</CardTitle>
              <p className="text-sm text-muted-foreground">Historical price movements over the last 30 days</p>
            </CardHeader>
            <CardContent>
              <div className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={filteredCommodities.slice(0, 3).flatMap(commodity => 
                    generateHistoricalData(commodity)
                  )}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis />
                    <Tooltip 
                      formatter={(value: any) => [`₹${value}`, 'Price']}
                      labelFormatter={(label) => `Date: ${label}`}
                    />
                    <Legend />
                    {filteredCommodities.slice(0, 3).map((commodity, index) => (
                      <Line
                        key={commodity.symbol}
                        type="monotone"
                        dataKey="price"
                        stroke={COLORS[index]}
                        strokeWidth={2}
                        dot={false}
                        data={generateHistoricalData(commodity)}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="seasonal" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Calendar className="h-5 w-5 mr-2" />
                Seasonal Market Patterns
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold mb-3">Peak Season Commodities</h4>
                  <div className="space-y-3">
                    {filteredCommodities.filter(c => c.category === 'Spices').slice(0, 3).map((commodity) => (
                      <div key={commodity.symbol} className="p-3 bg-yellow-50 dark:bg-yellow-950/30 rounded-lg border-l-4 border-yellow-400">
                        <div className="flex justify-between">
                          <div>
                            <p className="font-medium">{commodity.name}</p>
                            <p className="text-sm text-muted-foreground">Peak season: Oct - Dec</p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold">₹{commodity.ltp.toFixed(2)}</p>
                            <p className={`text-sm ${commodity.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {commodity.change >= 0 ? '+' : ''}{commodity.pchange.toFixed(2)}%
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div>
                  <h4 className="font-semibold mb-3">Off-Season Opportunities</h4>
                  <div className="space-y-3">
                    {filteredCommodities.filter(c => c.category === 'Grains').slice(0, 3).map((commodity) => (
                      <div key={commodity.symbol} className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border-l-4 border-blue-400">
                        <div className="flex justify-between">
                          <div>
                            <p className="font-medium">{commodity.name}</p>
                            <p className="text-sm text-muted-foreground">Harvest season: Apr - May</p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold">₹{commodity.ltp.toFixed(2)}</p>
                            <p className={`text-sm ${commodity.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {commodity.change >= 0 ? '+' : ''}{commodity.pchange.toFixed(2)}%
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Market Calendar */}
              <div className="mt-6">
                <h4 className="font-semibold mb-3">Agricultural Market Calendar</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-lg text-center">
                    <p className="font-medium text-green-700 dark:text-green-300">Q1 (Jan-Mar)</p>
                    <p className="text-sm text-muted-foreground">Rabi harvest</p>
                    <p className="text-xs text-muted-foreground">Wheat, Mustard</p>
                  </div>
                  <div className="p-3 bg-yellow-50 dark:bg-yellow-950/30 rounded-lg text-center">
                    <p className="font-medium text-yellow-700 dark:text-yellow-300">Q2 (Apr-Jun)</p>
                    <p className="text-sm text-muted-foreground">Summer crops</p>
                    <p className="text-xs text-muted-foreground">Pulses, Cotton</p>
                  </div>
                  <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg text-center">
                    <p className="font-medium text-blue-700 dark:text-blue-300">Q3 (Jul-Sep)</p>
                    <p className="text-sm text-muted-foreground">Monsoon sowing</p>
                    <p className="text-xs text-muted-foreground">Rice, Sugarcane</p>
                  </div>
                  <div className="p-3 bg-orange-50 dark:bg-orange-950/30 rounded-lg text-center">
                    <p className="font-medium text-orange-700 dark:text-orange-300">Q4 (Oct-Dec)</p>
                    <p className="text-sm text-muted-foreground">Kharif harvest</p>
                    <p className="text-xs text-muted-foreground">Spices, Oilseeds</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}