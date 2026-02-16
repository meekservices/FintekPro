import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, IndianRupee, TrendingUp, TrendingDown, Activity, BarChart3, Calculator } from "lucide-react";

interface MSEIEquity {
  symbol: string;
  name: string;
  segment: string;
  sector: string;
  ltp: number;
  change: number;
  pchange: number;
  high: number;
  low: number;
  volume: number;
  value: number;
  lastUpdate: string;
}

interface MSEICurrency {
  symbol: string;
  name: string;
  segment: string;
  rate: number;
  change: number;
  pchange: number;
  high: number;
  low: number;
  volume: number;
  lastUpdate: string;
}

interface MSEIDerivative {
  symbol: string;
  name: string;
  segment: string;
  type: string;
  expiry: string;
  strike?: number;
  ltp: number;
  change: number;
  pchange: number;
  high: number;
  low: number;
  volume: number;
  openInterest: number;
  lastUpdate: string;
}

interface MSEIMarketStatus {
  marketState: string;
  lastUpdated: string;
  nextSession: string;
  tradingSegments: Array<{
    segment: string;
    status: string;
  }>;
}

export function MSEIData() {
  const { data: equities, isLoading: equitiesLoading } = useQuery({
    queryKey: ['/api/msei/equities'],
    refetchInterval: 30000,
  });

  const { data: currencies, isLoading: currenciesLoading } = useQuery({
    queryKey: ['/api/msei/currencies'],
    refetchInterval: 30000,
  });

  const { data: derivatives, isLoading: derivativesLoading } = useQuery({
    queryKey: ['/api/msei/derivatives'],
    refetchInterval: 30000,
  });

  const { data: gainers, isLoading: gainersLoading } = useQuery({
    queryKey: ['/api/msei/gainers'],
    refetchInterval: 30000,
  });

  const { data: losers, isLoading: losersLoading } = useQuery({
    queryKey: ['/api/msei/losers'],
    refetchInterval: 30000,
  });

  const { data: marketStatus, isLoading: statusLoading } = useQuery({
    queryKey: ['/api/msei/market-status'],
    refetchInterval: 60000,
  });

  const formatPrice = (price: number) => `₹${price.toFixed(2)}`;
  const formatRate = (rate: number) => rate.toFixed(4);
  const formatChange = (change: number) => change.toFixed(2);
  const formatPercentage = (pchange: number) => `${pchange.toFixed(2)}%`;

  if (equitiesLoading || currenciesLoading || derivativesLoading || gainersLoading || losersLoading || statusLoading) {
    return (
      <div className="space-y-4" data-testid="msei-data-loading">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Building2 className="h-5 w-5 mr-2 text-blue-600" />
              MSEI Metropolitan Stock Exchange
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

  const equitiesData: MSEIEquity[] = (equities as any)?.data || [];
  const currenciesData: MSEICurrency[] = (currencies as any)?.data || [];
  const derivativesData: MSEIDerivative[] = (derivatives as any)?.data || [];
  const gainersData: MSEIEquity[] = (gainers as any)?.data || [];
  const losersData: MSEIEquity[] = (losers as any)?.data || [];
  const statusData: MSEIMarketStatus = (marketStatus as any)?.data;

  return (
    <div className="space-y-6" data-testid="msei-data">
      {/* Market Status */}
      {statusData && (
        <Card data-testid="msei-market-status">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-lg">
              <div className="flex items-center">
                <Activity className="h-5 w-5 mr-2 text-blue-600" />
                MSEI Market Status
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
                    className={
                      segment.status === 'Open' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200' : 
                      segment.status === 'Suspended' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200' : 
                      'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200'
                    }
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

      {/* MSEI Data Tabs */}
      <Tabs defaultValue="equities" className="w-full">
        <ScrollableTabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="equities" className="flex items-center">
            <Building2 className="h-4 w-4 mr-1" />
            Equities
          </TabsTrigger>
          <TabsTrigger value="currencies" className="flex items-center">
            <IndianRupee className="h-4 w-4 mr-1" />
            Currencies
          </TabsTrigger>
          <TabsTrigger value="derivatives" className="flex items-center">
            <Calculator className="h-4 w-4 mr-1" />
            Derivatives
          </TabsTrigger>
          <TabsTrigger value="gainers" className="flex items-center">
            <TrendingUp className="h-4 w-4 mr-1" />
            Gainers
          </TabsTrigger>
          <TabsTrigger value="losers" className="flex items-center">
            <TrendingDown className="h-4 w-4 mr-1" />
            Losers
          </TabsTrigger>
        </ScrollableTabsList>

        <TabsContent value="equities" data-testid="msei-equities">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Building2 className="h-5 w-5 mr-2 text-blue-600" />
                MSEI Equity Securities
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2">Company</th>
                      <th className="text-left py-2">Sector</th>
                      <th className="text-right py-2">LTP</th>
                      <th className="text-right py-2">Change</th>
                      <th className="text-right py-2">% Change</th>
                      <th className="text-right py-2">High</th>
                      <th className="text-right py-2">Low</th>
                      <th className="text-right py-2">Volume</th>
                    </tr>
                  </thead>
                  <tbody>
                    {equitiesData.map((equity) => (
                      <tr key={equity.symbol} className="border-b hover:bg-muted" data-testid={`equity-row-${equity.symbol}`}>
                        <td className="py-2">
                          <div>
                            <p className="font-medium">{equity.name}</p>
                            <p className="text-xs text-muted-foreground">{equity.symbol}</p>
                          </div>
                        </td>
                        <td className="py-2">
                          <Badge className="bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 text-xs">
                            {equity.sector}
                          </Badge>
                        </td>
                        <td className="py-2 text-right font-medium" data-testid={`price-${equity.symbol}`}>
                          {formatPrice(equity.ltp)}
                        </td>
                        <td className={`py-2 text-right ${equity.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {equity.change >= 0 ? '+' : ''}{formatChange(equity.change)}
                        </td>
                        <td className={`py-2 text-right ${equity.pchange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {equity.pchange >= 0 ? '+' : ''}{formatPercentage(equity.pchange)}
                        </td>
                        <td className="py-2 text-right text-muted-foreground">
                          {formatPrice(equity.high)}
                        </td>
                        <td className="py-2 text-right text-muted-foreground">
                          {formatPrice(equity.low)}
                        </td>
                        <td className="py-2 text-right text-muted-foreground">
                          {equity.volume.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="currencies" data-testid="msei-currencies">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <IndianRupee className="h-5 w-5 mr-2 text-green-600" />
                MSEI Currency Trading
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {currenciesData.map((currency) => (
                  <div key={currency.symbol} className="p-4 border rounded-lg" data-testid={`currency-${currency.symbol}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h4 className="font-semibold text-foreground">{currency.name}</h4>
                        <p className="text-sm text-muted-foreground">{currency.symbol}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold">{formatRate(currency.rate)}</p>
                        <p className={`text-sm ${currency.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {currency.change >= 0 ? '+' : ''}{formatChange(currency.change)} ({currency.pchange >= 0 ? '+' : ''}{formatPercentage(currency.pchange)})
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 flex justify-between text-sm text-muted-foreground">
                      <span>High: {formatRate(currency.high)}</span>
                      <span>Low: {formatRate(currency.low)}</span>
                      <span>Volume: {currency.volume.toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="derivatives" data-testid="msei-derivatives">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Calculator className="h-5 w-5 mr-2 text-purple-600" />
                MSEI Derivatives Trading
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2">Instrument</th>
                      <th className="text-left py-2">Type</th>
                      <th className="text-left py-2">Expiry</th>
                      <th className="text-right py-2">Strike</th>
                      <th className="text-right py-2">LTP</th>
                      <th className="text-right py-2">Change</th>
                      <th className="text-right py-2">Volume</th>
                      <th className="text-right py-2">OI</th>
                    </tr>
                  </thead>
                  <tbody>
                    {derivativesData.map((derivative) => (
                      <tr key={derivative.symbol} className="border-b hover:bg-muted" data-testid={`derivative-row-${derivative.symbol}`}>
                        <td className="py-2">
                          <div>
                            <p className="font-medium">{derivative.name}</p>
                            <p className="text-xs text-muted-foreground">{derivative.symbol}</p>
                          </div>
                        </td>
                        <td className="py-2">
                          <Badge className={derivative.type === 'Future' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200' : 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200'}>
                            {derivative.type}
                          </Badge>
                        </td>
                        <td className="py-2 text-muted-foreground">{derivative.expiry}</td>
                        <td className="py-2 text-right text-muted-foreground">
                          {derivative.strike ? derivative.strike.toLocaleString() : '-'}
                        </td>
                        <td className="py-2 text-right font-medium">
                          {formatPrice(derivative.ltp)}
                        </td>
                        <td className={`py-2 text-right ${derivative.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {derivative.change >= 0 ? '+' : ''}{formatChange(derivative.change)}
                        </td>
                        <td className="py-2 text-right text-muted-foreground">
                          {derivative.volume.toLocaleString()}
                        </td>
                        <td className="py-2 text-right text-muted-foreground">
                          {derivative.openInterest.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="gainers" data-testid="msei-gainers">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center text-green-700 dark:text-green-300">
                <TrendingUp className="h-5 w-5 mr-2" />
                Top Performing MSEI Stocks
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {gainersData.map((stock, index) => (
                  <div key={stock.symbol} className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950/30 rounded-lg" data-testid={`gainer-${stock.symbol}`}>
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                        <span className="text-sm font-bold text-green-700 dark:text-green-300">#{index + 1}</span>
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{stock.name}</p>
                        <p className="text-sm text-muted-foreground">{stock.sector} • {stock.symbol}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-foreground">{formatPrice(stock.ltp)}</p>
                      <p className="text-sm text-green-600">
                        +{formatChange(stock.change)} (+{formatPercentage(stock.pchange)})
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="losers" data-testid="msei-losers">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center text-red-700 dark:text-red-300">
                <TrendingDown className="h-5 w-5 mr-2" />
                Declining MSEI Stocks
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {losersData.map((stock, index) => (
                  <div key={stock.symbol} className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-950/30 rounded-lg" data-testid={`loser-${stock.symbol}`}>
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                        <span className="text-sm font-bold text-red-700 dark:text-red-300">#{index + 1}</span>
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{stock.name}</p>
                        <p className="text-sm text-muted-foreground">{stock.sector} • {stock.symbol}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-foreground">{formatPrice(stock.ltp)}</p>
                      <p className="text-sm text-red-600">
                        {formatChange(stock.change)} ({formatPercentage(stock.pchange)})
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
      <Card data-testid="msei-insights">
        <CardHeader>
          <CardTitle className="flex items-center">
            <BarChart3 className="h-5 w-5 mr-2 text-blue-600" />
            MSEI Market Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
              <p className="text-2xl font-bold text-blue-600">{equitiesData.length}</p>
              <p className="text-sm text-muted-foreground">Listed Equities</p>
            </div>
            <div className="text-center p-4 bg-green-50 dark:bg-green-950/30 rounded-lg">
              <p className="text-2xl font-bold text-green-600">{currenciesData.length}</p>
              <p className="text-sm text-muted-foreground">Currency Pairs</p>
            </div>
            <div className="text-center p-4 bg-purple-50 dark:bg-purple-950/30 rounded-lg">
              <p className="text-2xl font-bold text-purple-600">{derivativesData.length}</p>
              <p className="text-sm text-muted-foreground">Derivatives</p>
            </div>
            <div className="text-center p-4 bg-orange-50 dark:bg-orange-950/30 rounded-lg">
              <p className="text-2xl font-bold text-orange-600">
                {equitiesData.filter(e => e.change > 0).length}
              </p>
              <p className="text-sm text-muted-foreground">Advancing</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}