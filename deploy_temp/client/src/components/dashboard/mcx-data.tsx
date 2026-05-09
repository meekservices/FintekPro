import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
import { TrendingUp, TrendingDown, Activity, Coins, RefreshCw } from "lucide-react";

interface MCXData {
  symbol: string;
  name: string;
  unit: string;
  expiry: string;
  ltp: number;
  change: number;
  pchange: number;
  high?: number;
  low?: number;
  volume?: number;
  openInterest?: number;
  lastUpdate?: string;
}

export function MCXData() {
  // Fetch MCX commodities
  const { data: commoditiesData, refetch: refetchCommodities, isLoading: commoditiesLoading } = useQuery({
    queryKey: ['/api/mcx/commodities'],
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  // Fetch MCX gainers
  const { data: gainersData, refetch: refetchGainers } = useQuery({
    queryKey: ['/api/mcx/gainers'],
    refetchInterval: 30000
  });

  // Fetch MCX losers
  const { data: losersData, refetch: refetchLosers } = useQuery({
    queryKey: ['/api/mcx/losers'],
    refetchInterval: 30000
  });

  // Fetch MCX market status
  const { data: statusData } = useQuery({
    queryKey: ['/api/mcx/market-status'],
    refetchInterval: 60000 // Refresh every minute
  });

  const handleRefresh = () => {
    refetchCommodities();
    refetchGainers();
    refetchLosers();
  };

  const formatNumber = (num: number) => {
    if (num >= 10000000) {
      return `${(num / 10000000).toFixed(2)}Cr`;
    } else if (num >= 100000) {
      return `${(num / 100000).toFixed(2)}L`;
    } else {
      return `${num.toFixed(2)}`;
    }
  };

  const commodities = (commoditiesData as any)?.data || [];
  const gainers = (gainersData as any)?.data || [];
  const losers = (losersData as any)?.data || [];
  const marketStatus = (statusData as any)?.data;

  return (
    <div className="space-y-6" data-testid="mcx-data">
      {/* Market Status */}
      {marketStatus && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <CardTitle className="flex items-center">
              <Activity className="h-5 w-5 mr-2 text-yellow-600" />
              MCX Market Status
            </CardTitle>
            <Badge 
              className={marketStatus.marketState === "OPEN" ? "bg-finance-green" : "bg-finance-red"}
            >
              {marketStatus.marketState}
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Next Session: {marketStatus.nextSession}
              </p>
              <div className="flex flex-wrap gap-2">
                {marketStatus.tradingSegments?.map((segment: any, i: number) => (
                  <Badge key={i} variant="outline" className="text-xs">
                    {segment.segment}: {segment.status}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main MCX Data */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center">
            <Coins className="h-5 w-5 mr-2 text-yellow-600" />
            MCX Commodities Live Data
          </CardTitle>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRefresh}
            disabled={commoditiesLoading}
            data-testid="mcx-refresh"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${commoditiesLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="commodities" className="w-full">
            <ScrollableTabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="commodities" data-testid="mcx-commodities-tab">All Commodities</TabsTrigger>
              <TabsTrigger value="gainers" data-testid="mcx-gainers-tab">Top Gainers</TabsTrigger>
              <TabsTrigger value="losers" data-testid="mcx-losers-tab">Top Losers</TabsTrigger>
            </ScrollableTabsList>

            <TabsContent value="commodities" className="space-y-4">
              <div className="grid gap-4">
                {commodities.length > 0 ? commodities.map((commodity: MCXData, i: number) => (
                  <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold text-foreground">{commodity.name}</h4>
                        <Badge variant="outline" className="text-xs">{commodity.expiry}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{commodity.unit}</p>
                      <p className="text-2xl font-bold text-foreground">
                        ₹{commodity.ltp ? commodity.ltp.toFixed(2) : 'N/A'}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className={`flex items-center ${
                        (commodity.change || 0) >= 0 ? 'text-finance-green' : 'text-finance-red'
                      }`}>
                        {(commodity.change || 0) >= 0 ? <TrendingUp className="h-4 w-4 mr-1" /> : <TrendingDown className="h-4 w-4 mr-1" />}
                        <span className="font-semibold">
                          {commodity.change ? commodity.change.toFixed(2) : '0.00'} ({commodity.pchange ? commodity.pchange.toFixed(2) : '0.00'}%)
                        </span>
                      </div>
                      <div className="text-sm text-muted-foreground space-y-1 mt-1">
                        {commodity.volume && (
                          <p>Vol: {formatNumber(commodity.volume)}</p>
                        )}
                        {commodity.openInterest && (
                          <p>OI: {formatNumber(commodity.openInterest)}</p>
                        )}
                      </div>
                    </div>
                  </div>
                )) : (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">Loading MCX commodities data...</p>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="gainers" className="space-y-4">
              <div className="grid gap-4">
                {gainers.length > 0 ? gainers.map((commodity: MCXData, i: number) => (
                  <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold text-foreground">{commodity.name}</h4>
                        <Badge variant="outline" className="text-xs">{commodity.expiry}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{commodity.unit}</p>
                      <p className="text-lg font-bold text-foreground">
                        ₹{commodity.ltp ? commodity.ltp.toFixed(2) : 'N/A'}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center text-finance-green">
                        <TrendingUp className="h-4 w-4 mr-1" />
                        <span className="font-semibold">
                          +{commodity.change ? commodity.change.toFixed(2) : '0.00'} (+{commodity.pchange ? commodity.pchange.toFixed(2) : '0.00'}%)
                        </span>
                      </div>
                      <div className="text-sm text-muted-foreground space-y-1 mt-1">
                        {commodity.volume && (
                          <p>Vol: {formatNumber(commodity.volume)}</p>
                        )}
                        {commodity.openInterest && (
                          <p>OI: {formatNumber(commodity.openInterest)}</p>
                        )}
                      </div>
                    </div>
                  </div>
                )) : (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">Loading MCX gainers data...</p>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="losers" className="space-y-4">
              <div className="grid gap-4">
                {losers.length > 0 ? losers.map((commodity: MCXData, i: number) => (
                  <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold text-foreground">{commodity.name}</h4>
                        <Badge variant="outline" className="text-xs">{commodity.expiry}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{commodity.unit}</p>
                      <p className="text-lg font-bold text-foreground">
                        ₹{commodity.ltp ? commodity.ltp.toFixed(2) : 'N/A'}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center text-finance-red">
                        <TrendingDown className="h-4 w-4 mr-1" />
                        <span className="font-semibold">
                          {commodity.change ? commodity.change.toFixed(2) : '0.00'} ({commodity.pchange ? commodity.pchange.toFixed(2) : '0.00'}%)
                        </span>
                      </div>
                      <div className="text-sm text-muted-foreground space-y-1 mt-1">
                        {commodity.volume && (
                          <p>Vol: {formatNumber(commodity.volume)}</p>
                        )}
                        {commodity.openInterest && (
                          <p>OI: {formatNumber(commodity.openInterest)}</p>
                        )}
                      </div>
                    </div>
                  </div>
                )) : (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">Loading MCX losers data...</p>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}