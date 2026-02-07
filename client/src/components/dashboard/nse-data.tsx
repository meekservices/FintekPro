import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, TrendingDown, Activity, BarChart3, RefreshCw } from "lucide-react";

interface NSEQuote {
  symbol: string;
  companyName: string;
  lastPrice: number;
  change: number;
  pChange: number;
  dayHigh: number;
  dayLow: number;
  volume: number;
}

interface NSEData {
  symbol: string;
  ltp: number;
  chng: number;
  per_chng: number;
  volume: number;
  value: number;
}

export function NSEData() {
  // Fetch NSE indices
  const { data: indicesData, refetch: refetchIndices, isLoading: indicesLoading } = useQuery({
    queryKey: ['/api/nse/indices'],
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  // Fetch NSE gainers
  const { data: gainersData, refetch: refetchGainers } = useQuery({
    queryKey: ['/api/nse/gainers-losers?type=gainers'],
    refetchInterval: 30000
  });

  // Fetch NSE losers
  const { data: losersData, refetch: refetchLosers } = useQuery({
    queryKey: ['/api/nse/gainers-losers?type=losers'],
    refetchInterval: 30000
  });

  // Fetch market status
  const { data: statusData } = useQuery({
    queryKey: ['/api/nse/market-status'],
    refetchInterval: 60000 // Refresh every minute
  });

  const handleRefresh = () => {
    refetchIndices();
    refetchGainers(); 
    refetchLosers();
  };

  const formatNumber = (num: number) => {
    if (num >= 10000000) {
      return `₹${(num / 10000000).toFixed(2)}Cr`;
    } else if (num >= 100000) {
      return `₹${(num / 100000).toFixed(2)}L`;
    } else {
      return `₹${num.toFixed(2)}`;
    }
  };

  const indices = (indicesData as any)?.data || [];
  const gainers = (gainersData as any)?.data || [];
  const losers = (losersData as any)?.data || [];
  const marketStatus = (statusData as any)?.data;

  return (
    <div className="space-y-6" data-testid="nse-data">
      {/* Market Status */}
      {marketStatus && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <CardTitle className="flex items-center">
              <Activity className="h-5 w-5 mr-2 text-finance-blue" />
              NSE Market Status
            </CardTitle>
            <Badge 
              className={
                Array.isArray(marketStatus.marketState) 
                  ? (marketStatus.marketState.some((m: any) => m.marketStatus === "Open") ? "bg-finance-green" : "bg-finance-red")
                  : (marketStatus.marketState === "OPEN" ? "bg-finance-green" : "bg-finance-red")
              }
            >
              {Array.isArray(marketStatus.marketState) 
                ? (marketStatus.marketState.some((m: any) => m.marketStatus === "Open") ? "OPEN" : "CLOSED")
                : (marketStatus.marketState || "UNKNOWN")
              }
            </Badge>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Last updated: {new Date().toLocaleTimeString()}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Main NSE Data */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center">
            <BarChart3 className="h-5 w-5 mr-2 text-finance-blue" />
            NSE Live Data
          </CardTitle>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRefresh}
            disabled={indicesLoading}
            data-testid="nse-refresh"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${indicesLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="indices" className="w-full">
            <ScrollableTabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="indices" data-testid="indices-tab">Indices</TabsTrigger>
              <TabsTrigger value="gainers" data-testid="gainers-tab">Top Gainers</TabsTrigger>
              <TabsTrigger value="losers" data-testid="losers-tab">Top Losers</TabsTrigger>
            </ScrollableTabsList>

            <TabsContent value="indices" className="space-y-4">
              <div className="grid gap-4">
                {indices.length > 0 ? indices.slice(0, 8).map((index: NSEData, i: number) => (
                  <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <h4 className="font-semibold text-foreground">{index.symbol || `Index ${i + 1}`}</h4>
                      <p className="text-2xl font-bold text-foreground">
                        {index.ltp ? index.ltp.toFixed(2) : 'N/A'}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className={`flex items-center ${
                        (index.chng || 0) >= 0 ? 'text-finance-green' : 'text-finance-red'
                      }`}>
                        {(index.chng || 0) >= 0 ? <TrendingUp className="h-4 w-4 mr-1" /> : <TrendingDown className="h-4 w-4 mr-1" />}
                        <span className="font-semibold">
                          {index.chng ? index.chng.toFixed(2) : '0.00'} ({index.per_chng ? index.per_chng.toFixed(2) : '0.00'}%)
                        </span>
                      </div>
                      {index.volume && (
                        <p className="text-sm text-muted-foreground">Vol: {formatNumber(index.volume)}</p>
                      )}
                    </div>
                  </div>
                )) : (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">Loading indices data...</p>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="gainers" className="space-y-4">
              <div className="grid gap-4">
                {gainers.length > 0 ? gainers.slice(0, 10).map((stock: NSEData, i: number) => (
                  <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <h4 className="font-semibold text-foreground">{stock.symbol}</h4>
                      <p className="text-lg font-bold text-foreground">
                        ₹{stock.ltp ? stock.ltp.toFixed(2) : 'N/A'}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center text-finance-green">
                        <TrendingUp className="h-4 w-4 mr-1" />
                        <span className="font-semibold">
                          +{stock.chng ? stock.chng.toFixed(2) : '0.00'} (+{stock.per_chng ? stock.per_chng.toFixed(2) : '0.00'}%)
                        </span>
                      </div>
                      {stock.volume && (
                        <p className="text-sm text-muted-foreground">Vol: {formatNumber(stock.volume)}</p>
                      )}
                    </div>
                  </div>
                )) : (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">Loading gainers data...</p>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="losers" className="space-y-4">
              <div className="grid gap-4">
                {losers.length > 0 ? losers.slice(0, 10).map((stock: NSEData, i: number) => (
                  <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <h4 className="font-semibold text-foreground">{stock.symbol}</h4>
                      <p className="text-lg font-bold text-foreground">
                        ₹{stock.ltp ? stock.ltp.toFixed(2) : 'N/A'}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center text-finance-red">
                        <TrendingDown className="h-4 w-4 mr-1" />
                        <span className="font-semibold">
                          {stock.chng ? stock.chng.toFixed(2) : '0.00'} ({stock.per_chng ? stock.per_chng.toFixed(2) : '0.00'}%)
                        </span>
                      </div>
                      {stock.volume && (
                        <p className="text-sm text-muted-foreground">Vol: {formatNumber(stock.volume)}</p>
                      )}
                    </div>
                  </div>
                )) : (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">Loading losers data...</p>
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