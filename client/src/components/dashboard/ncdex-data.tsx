import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Leaf, Wheat, TrendingUp, TrendingDown, Activity, BarChart3 } from "lucide-react";
import { AgriculturalTooltip } from "@/components/agricultural-tooltip";

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

interface NCDEXMarketStatus {
  marketState: string;
  lastUpdated: string;
  nextSession: string;
  tradingSegments: Array<{
    segment: string;
    status: string;
  }>;
}

export function NCDEXData() {
  const { data: commodities, isLoading: commoditiesLoading } = useQuery({
    queryKey: ['/api/ncdex/commodities'],
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  const { data: gainers, isLoading: gainersLoading } = useQuery({
    queryKey: ['/api/ncdex/gainers'],
    refetchInterval: 30000,
  });

  const { data: losers, isLoading: losersLoading } = useQuery({
    queryKey: ['/api/ncdex/losers'],
    refetchInterval: 30000,
  });

  const { data: marketStatus, isLoading: statusLoading } = useQuery({
    queryKey: ['/api/ncdex/market-status'],
    refetchInterval: 60000, // Refetch every minute
  });

  const formatPrice = (price: number) => `₹${price.toFixed(2)}`;
  const formatChange = (change: number) => change.toFixed(2);
  const formatPercentage = (pchange: number) => `${pchange.toFixed(2)}%`;

  if (commoditiesLoading || gainersLoading || losersLoading || statusLoading) {
    return (
      <div className="space-y-4" data-testid="ncdex-data-loading">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Leaf className="h-5 w-5 mr-2 text-green-600" />
              NCDEX Agricultural Commodities
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="animate-pulse space-y-4">
              <div className="h-4 bg-muted rounded w-3/4"></div>
              <div className="h-4 bg-muted rounded w-1/2"></div>
              <div className="h-4 bg-muted rounded w-2/3"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const commoditiesData: NCDEXCommodity[] = (commodities as any)?.data || [];
  const gainersData: NCDEXCommodity[] = (gainers as any)?.data || [];
  const losersData: NCDEXCommodity[] = (losers as any)?.data || [];
  const statusData: NCDEXMarketStatus = (marketStatus as any)?.data;

  return (
    <div className="space-y-6" data-testid="ncdex-data">
      {/* Market Status */}
      {statusData && (
        <Card data-testid="ncdex-market-status">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-lg">
              <div className="flex items-center">
                <Activity className="h-5 w-5 mr-2 text-orange-600" />
                NCDEX Market Status
              </div>
              <Badge className={statusData.marketState === 'OPEN' ? 'bg-green-600' : 'bg-red-600'}>
                {statusData.marketState}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {statusData.tradingSegments.map((segment) => (
                <div key={segment.segment} className="text-center">
                  <p className="text-sm font-medium text-foreground">{segment.segment}</p>
                  <Badge 
                    className={segment.status === 'Open' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200' : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200'}
                  >
                    {segment.status}
                  </Badge>
                </div>
              ))}
            </div>
            <div className="mt-4 text-xs text-muted-foreground">
              <p>Next Session: {statusData.nextSession}</p>
              <p>Last Updated: {new Date(statusData.lastUpdated).toLocaleTimeString()}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* NCDEX Data Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <ScrollableTabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview" className="flex items-center">
            <BarChart3 className="h-4 w-4 mr-1" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="gainers" className="flex items-center">
            <TrendingUp className="h-4 w-4 mr-1" />
            Top Gainers
          </TabsTrigger>
          <TabsTrigger value="losers" className="flex items-center">
            <TrendingDown className="h-4 w-4 mr-1" />
            Top Losers
          </TabsTrigger>
        </ScrollableTabsList>

        <TabsContent value="overview" data-testid="ncdex-overview">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Wheat className="h-5 w-5 mr-2 text-amber-600" />
                <AgriculturalTooltip searchTerm="agricultural commodity">
                  Agricultural Commodities Live Prices
                </AgriculturalTooltip>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2">Commodity</th>
                      <th className="text-left py-2">Category</th>
                      <th className="text-left py-2">Unit</th>
                      <th className="text-right py-2">LTP</th>
                      <th className="text-right py-2">Change</th>
                      <th className="text-right py-2">% Change</th>
                      <th className="text-right py-2">Volume</th>
                      <th className="text-right py-2">OI</th>
                    </tr>
                  </thead>
                  <tbody>
                    {commoditiesData.map((commodity) => (
                      <tr key={commodity.symbol} className="border-b hover:bg-muted" data-testid={`commodity-row-${commodity.symbol}`}>
                        <td className="py-2">
                          <div>
                            <p className="font-medium">{commodity.name}</p>
                            <p className="text-xs text-muted-foreground">{commodity.symbol} • {commodity.expiry}</p>
                          </div>
                        </td>
                        <td className="py-2">
                          <Badge className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 text-xs">
                            {commodity.category}
                          </Badge>
                        </td>
                        <td className="py-2 text-muted-foreground">{commodity.unit}</td>
                        <td className="py-2 text-right font-medium" data-testid={`price-${commodity.symbol}`}>
                          {formatPrice(commodity.ltp)}
                        </td>
                        <td className={`py-2 text-right ${commodity.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {commodity.change >= 0 ? '+' : ''}{formatChange(commodity.change)}
                        </td>
                        <td className={`py-2 text-right ${commodity.pchange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {commodity.pchange >= 0 ? '+' : ''}{formatPercentage(commodity.pchange)}
                        </td>
                        <td className="py-2 text-right text-muted-foreground">
                          {commodity.volume.toLocaleString()}
                        </td>
                        <td className="py-2 text-right text-muted-foreground">
                          {commodity.openInterest.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="gainers" data-testid="ncdex-gainers">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center text-green-700 dark:text-green-300">
                <TrendingUp className="h-5 w-5 mr-2" />
                Top Performing Agricultural Commodities
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {gainersData.map((commodity, index) => (
                  <div key={commodity.symbol} className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950/30 rounded-lg" data-testid={`gainer-${commodity.symbol}`}>
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                        <span className="text-sm font-bold text-green-700 dark:text-green-300">#{index + 1}</span>
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{commodity.name}</p>
                        <p className="text-sm text-muted-foreground">{commodity.category} • {commodity.unit}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-foreground">{formatPrice(commodity.ltp)}</p>
                      <p className="text-sm text-green-600">
                        +{formatChange(commodity.change)} (+{formatPercentage(commodity.pchange)})
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="losers" data-testid="ncdex-losers">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center text-red-700 dark:text-red-300">
                <TrendingDown className="h-5 w-5 mr-2" />
                Declining Agricultural Commodities
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {losersData.map((commodity, index) => (
                  <div key={commodity.symbol} className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-950/30 rounded-lg" data-testid={`loser-${commodity.symbol}`}>
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                        <span className="text-sm font-bold text-red-700 dark:text-red-300">#{index + 1}</span>
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{commodity.name}</p>
                        <p className="text-sm text-muted-foreground">{commodity.category} • {commodity.unit}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-foreground">{formatPrice(commodity.ltp)}</p>
                      <p className="text-sm text-red-600">
                        {formatChange(commodity.change)} ({formatPercentage(commodity.pchange)})
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Market Insights */}
      <Card data-testid="ncdex-insights">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Leaf className="h-5 w-5 mr-2 text-green-600" />
            NCDEX Market Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
              <p className="text-2xl font-bold text-blue-600">{commoditiesData.length}</p>
              <p className="text-sm text-muted-foreground">Active Commodities</p>
            </div>
            <div className="text-center p-4 bg-green-50 dark:bg-green-950/30 rounded-lg">
              <p className="text-2xl font-bold text-green-600">
                {commoditiesData.filter(c => c.change > 0).length}
              </p>
              <p className="text-sm text-muted-foreground">Advancing</p>
            </div>
            <div className="text-center p-4 bg-red-50 dark:bg-red-950/30 rounded-lg">
              <p className="text-2xl font-bold text-red-600">
                {commoditiesData.filter(c => c.change < 0).length}
              </p>
              <p className="text-sm text-muted-foreground">Declining</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}