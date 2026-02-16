import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Activity, BarChart3, TrendingUp, Globe, Building2, Coins, Wheat, RefreshCw, TrendingDown, Thermometer, Brain, Target } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { IBTrading } from "@/components/dashboard/ib-trading";
import { KYCWarningBanner } from "@/components/KYCWarningBanner";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";

interface StockQuote {
  symbol: string;
  price: number;
  change: number;
  percentChange: number;
  volume: number;
  high: number;
  low: number;
}

interface OrderFormData {
  exchange: 'NSE' | 'BSE' | 'MCX' | 'NCDEX';
  symbol: string;
  action: 'BUY' | 'SELL';
  quantity: number;
  orderType: 'MKT' | 'LMT' | 'STP';
  price?: number;
  stopPrice?: number;
}

export function BrokingDashboard() {
  const [selectedStock, setSelectedStock] = useState<string>("");
  const [orderForm, setOrderForm] = useState<OrderFormData>({
    exchange: 'NSE',
    symbol: '',
    action: 'BUY',
    quantity: 1,
    orderType: 'MKT'
  });

  const queryClient = useQueryClient();

  // Fetch market data from different exchanges
  const { data: nseIndices, refetch: refetchNSE } = useQuery({
    queryKey: ['/api/nse/indices'],
    refetchInterval: 30000
  });

  const { data: bseIndices, refetch: refetchBSE } = useQuery({
    queryKey: ['/api/bse/indices'],
    refetchInterval: 30000
  });

  const { data: mcxCommodities, refetch: refetchMCX } = useQuery({
    queryKey: ['/api/mcx/commodities'],
    refetchInterval: 30000
  });

  const { data: ncdexCommodities, refetch: refetchNCDEX } = useQuery({
    queryKey: ['/api/ncdex/commodities'],
    refetchInterval: 30000
  });

  // Fetch derivatives data
  const { data: mseiDerivatives, refetch: refetchMSEI } = useQuery({
    queryKey: ['/api/msei/derivatives'],
    refetchInterval: 30000
  });

  // Fetch sentiment data
  const { data: sentimentData, refetch: refetchSentiment } = useQuery({
    queryKey: ['/api/market/sentiment'],
    refetchInterval: 60000 // Refresh every minute
  });

  const { data: nseGainers } = useQuery({
    queryKey: ['/api/nse/gainers-losers?type=gainers'],
    refetchInterval: 30000
  });

  const { data: nseLosers } = useQuery({
    queryKey: ['/api/nse/gainers-losers?type=losers'],
    refetchInterval: 30000
  });

  // Stock quote query
  const { data: stockQuote, refetch: refetchQuote } = useQuery({
    queryKey: ['/api/nse/quote', selectedStock],
    enabled: !!selectedStock,
    refetchInterval: 10000
  });

  // Place order mutation
  const placeOrderMutation = useMutation({
    mutationFn: async (orderData: OrderFormData) => {
      const endpoint = `/api/${orderData.exchange.toLowerCase()}/order`;
      return await apiRequest("POST", endpoint, { body: orderData });
    },
    onSuccess: () => {
      // Reset form
      setOrderForm({
        exchange: 'NSE',
        symbol: '',
        action: 'BUY',
        quantity: 1,
        orderType: 'MKT'
      });
      // Refresh relevant data
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
    }
  });

  const handlePlaceOrder = () => {
    if (orderForm.symbol && orderForm.quantity > 0) {
      placeOrderMutation.mutate(orderForm);
    }
  };

  const handleRefreshAll = () => {
    refetchNSE();
    refetchBSE();
    refetchMCX();
    refetchNCDEX();
    refetchMSEI();
    refetchSentiment();
    if (selectedStock) refetchQuote();
  };

  const getChangeColor = (change: number) => {
    return change >= 0 ? 'text-green-600' : 'text-red-600';
  };

  const formatCurrency = (value: number, currency = '₹') => {
    return `${currency}${value?.toFixed(2) || '0.00'}`;
  };

  const getSentimentColor = (sentiment: number) => {
    if (sentiment >= 0.7) return 'bg-green-500';
    if (sentiment >= 0.4) return 'bg-green-300';
    if (sentiment >= 0.1) return 'bg-yellow-300';
    if (sentiment >= -0.1) return 'bg-muted';
    if (sentiment >= -0.4) return 'bg-red-300';
    return 'bg-red-500';
  };

  const getSentimentLabel = (sentiment: number) => {
    if (sentiment >= 0.7) return 'Very Bullish';
    if (sentiment >= 0.4) return 'Bullish';
    if (sentiment >= 0.1) return 'Slightly Bullish';
    if (sentiment >= -0.1) return 'Neutral';
    if (sentiment >= -0.4) return 'Slightly Bearish';
    return 'Very Bearish';
  };

  // Generate mock sentiment data for demonstration
  const generateSentimentData = () => {
    const sectors = [
      'Technology', 'Banking', 'Pharma', 'Auto', 'FMCG', 'Energy', 'Metals', 'Infrastructure',
      'IT Services', 'Healthcare', 'Telecom', 'Real Estate', 'Chemicals', 'Consumer Durables',
      'Oil & Gas', 'Textiles'
    ];
    
    return sectors.map(sector => ({
      sector,
      sentiment: (Math.random() - 0.5) * 2, // Range from -1 to 1
      volume: Math.floor(Math.random() * 10000) + 1000,
      change: (Math.random() - 0.5) * 10,
      marketCap: Math.floor(Math.random() * 500000) + 50000
    }));
  };

  const mockSentimentData = generateSentimentData();

  return (
    <div className="space-y-6" data-testid="broking-dashboard">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Trading & Broking</h1>
          <p className="text-muted-foreground">
            Trade stocks and commodities across NSE, BSE, MCX, NCDEX and Interactive Brokers
          </p>
        </div>
        <Button onClick={handleRefreshAll} variant="outline" data-testid="button-refresh-all">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh All
        </Button>
      </div>

      {/* KYC Warning */}
      <KYCWarningBanner />

      <Tabs defaultValue="overview" className="w-full">
        <div className="overflow-x-auto pb-2">
          <ScrollableTabsList className="inline-flex w-auto min-w-full">
            <TabsTrigger value="overview" className="flex-shrink-0">Overview</TabsTrigger>
            <TabsTrigger value="indian-trading" className="flex-shrink-0">Indian Markets</TabsTrigger>
            <TabsTrigger value="derivatives" className="flex-shrink-0">Commodities & Derivatives</TabsTrigger>
            <TabsTrigger value="sentiment" className="flex-shrink-0">Heatmap</TabsTrigger>
            <TabsTrigger value="ib-trading" className="flex-shrink-0">Global Markets</TabsTrigger>
            <TabsTrigger value="order-book" className="flex-shrink-0">Order Book</TabsTrigger>
            <TabsTrigger value="watchlist" className="flex-shrink-0">Watchlist</TabsTrigger>
          </ScrollableTabsList>
        </div>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">NSE Indices</CardTitle>
                <Building2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {(nseIndices as any)?.data?.length || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  Live indices available
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">BSE Markets</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {(bseIndices as any)?.data?.length || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  BSE indices tracking
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">MCX Commodities</CardTitle>
                <Coins className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {(mcxCommodities as any)?.data?.length || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  Commodities available
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">NCDEX Agri</CardTitle>
                <Wheat className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {(ncdexCommodities as any)?.data?.length || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  Agricultural commodities
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                  Top Gainers (NSE)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {(nseGainers as any)?.data ? (
                  <div className="space-y-2">
                    {(nseGainers as any).data.slice(0, 5).map((stock: any, index: number) => (
                      <div key={index} className="flex justify-between items-center p-2 rounded-lg bg-muted/50">
                        <div>
                          <div className="font-medium">{stock.symbol}</div>
                          <div className="text-sm text-muted-foreground">{formatCurrency(stock.ltp)}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-green-600 font-medium">+{stock.per_chng?.toFixed(2)}%</div>
                          <div className="text-sm text-green-600">+{formatCurrency(stock.chng)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4 text-muted-foreground">Loading gainers...</div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-red-600 rotate-180" />
                  Top Losers (NSE)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {(nseLosers as any)?.data ? (
                  <div className="space-y-2">
                    {(nseLosers as any).data.slice(0, 5).map((stock: any, index: number) => (
                      <div key={index} className="flex justify-between items-center p-2 rounded-lg bg-muted/50">
                        <div>
                          <div className="font-medium">{stock.symbol}</div>
                          <div className="text-sm text-muted-foreground">{formatCurrency(stock.ltp)}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-red-600 font-medium">{stock.per_chng?.toFixed(2)}%</div>
                          <div className="text-sm text-red-600">{formatCurrency(stock.chng)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4 text-muted-foreground">Loading losers...</div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="indian-trading" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Stock Quote</CardTitle>
                <CardDescription>Get real-time quotes for NSE/BSE stocks</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="stock-symbol">Stock Symbol</Label>
                  <div className="flex gap-2">
                    <Input
                      id="stock-symbol"
                      placeholder="Enter symbol (e.g., RELIANCE)"
                      value={selectedStock}
                      onChange={(e) => setSelectedStock(e.target.value.toUpperCase())}
                      data-testid="input-stock-symbol"
                    />
                    <Button onClick={() => refetchQuote()} disabled={!selectedStock} data-testid="button-get-quote">
                      Get Quote
                    </Button>
                  </div>
                </div>

                {(stockQuote as any)?.data && (
                  <div className="p-4 border rounded-lg bg-muted/50">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-sm text-muted-foreground">Symbol</div>
                        <div className="font-medium">{(stockQuote as any).data.symbol}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Price</div>
                        <div className="font-medium">{formatCurrency((stockQuote as any).data.price)}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Change</div>
                        <div className={`font-medium ${getChangeColor((stockQuote as any).data.change)}`}>
                          {(stockQuote as any).data.change >= 0 ? '+' : ''}{formatCurrency((stockQuote as any).data.change)}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Change %</div>
                        <div className={`font-medium ${getChangeColor((stockQuote as any).data.percentChange)}`}>
                          {(stockQuote as any).data.percentChange >= 0 ? '+' : ''}{(stockQuote as any).data.percentChange?.toFixed(2)}%
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Place Order</CardTitle>
                <CardDescription>Submit buy/sell orders on Indian exchanges</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="order-exchange">Exchange</Label>
                    <Select value={orderForm.exchange} onValueChange={(value: 'NSE' | 'BSE' | 'MCX' | 'NCDEX') => setOrderForm(prev => ({...prev, exchange: value}))}>
                      <SelectTrigger data-testid="select-order-exchange">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NSE">NSE</SelectItem>
                        <SelectItem value="BSE">BSE</SelectItem>
                        <SelectItem value="MCX">MCX</SelectItem>
                        <SelectItem value="NCDEX">NCDEX</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="order-symbol">Symbol</Label>
                    <Input
                      id="order-symbol"
                      placeholder="RELIANCE"
                      value={orderForm.symbol}
                      onChange={(e) => setOrderForm(prev => ({...prev, symbol: e.target.value.toUpperCase()}))}
                      data-testid="input-order-symbol"
                    />
                  </div>
                  <div>
                    <Label htmlFor="order-action">Action</Label>
                    <Select value={orderForm.action} onValueChange={(value: 'BUY' | 'SELL') => setOrderForm(prev => ({...prev, action: value}))}>
                      <SelectTrigger data-testid="select-order-action">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="BUY">Buy</SelectItem>
                        <SelectItem value="SELL">Sell</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="order-quantity">Quantity</Label>
                    <Input
                      id="order-quantity"
                      type="number"
                      value={orderForm.quantity}
                      onChange={(e) => setOrderForm(prev => ({...prev, quantity: parseInt(e.target.value) || 0}))}
                      data-testid="input-order-quantity"
                    />
                  </div>
                  <div>
                    <Label htmlFor="order-type">Order Type</Label>
                    <Select value={orderForm.orderType} onValueChange={(value: 'MKT' | 'LMT' | 'STP') => setOrderForm(prev => ({...prev, orderType: value}))}>
                      <SelectTrigger data-testid="select-order-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MKT">Market</SelectItem>
                        <SelectItem value="LMT">Limit</SelectItem>
                        <SelectItem value="STP">Stop</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {orderForm.orderType === 'LMT' && (
                    <div>
                      <Label htmlFor="order-price">Limit Price</Label>
                      <Input
                        id="order-price"
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={orderForm.price || ''}
                        onChange={(e) => setOrderForm(prev => ({...prev, price: parseFloat(e.target.value) || undefined}))}
                        data-testid="input-order-price"
                      />
                    </div>
                  )}
                </div>
                <Button 
                  className="w-full" 
                  onClick={handlePlaceOrder}
                  disabled={placeOrderMutation.isPending || !orderForm.symbol || orderForm.quantity <= 0}
                  data-testid="button-place-order"
                >
                  {placeOrderMutation.isPending ? 'Placing Order...' : `${orderForm.action} ${orderForm.quantity} ${orderForm.symbol}`}
                </Button>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                NSE Indices Live Data
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(nseIndices as any)?.data ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Index</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Change</TableHead>
                      <TableHead>Change %</TableHead>
                      <TableHead>Volume</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(nseIndices as any).data.slice(0, 10).map((index: any, i: number) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{index.symbol}</TableCell>
                        <TableCell>{formatCurrency(index.ltp)}</TableCell>
                        <TableCell className={getChangeColor(index.chng)}>
                          {index.chng >= 0 ? '+' : ''}{formatCurrency(index.chng)}
                        </TableCell>
                        <TableCell className={getChangeColor(index.per_chng)}>
                          {index.per_chng >= 0 ? '+' : ''}{index.per_chng?.toFixed(2)}%
                        </TableCell>
                        <TableCell>{index.volume?.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">Loading NSE data...</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="derivatives" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-blue-600" />
                  Futures & Options
                </CardTitle>
                <CardDescription>MSEI derivatives including futures and options</CardDescription>
              </CardHeader>
              <CardContent>
                {(mseiDerivatives as any)?.data ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Symbol</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Expiry</TableHead>
                        <TableHead>Strike</TableHead>
                        <TableHead>Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(mseiDerivatives as any).data.map((derivative: any, i: number) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium">{derivative.name}</TableCell>
                          <TableCell>
                            <Badge variant={derivative.type === 'Future' ? 'default' : 'secondary'}>
                              {derivative.type}
                            </Badge>
                          </TableCell>
                          <TableCell>{derivative.expiry}</TableCell>
                          <TableCell>{derivative.strike || '-'}</TableCell>
                          <TableCell>
                            <Button size="sm" variant="outline" data-testid={`button-trade-${derivative.symbol}`}>
                              Trade
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">Loading derivatives data...</div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Coins className="h-5 w-5 text-amber-600" />
                  MCX Commodities
                </CardTitle>
                <CardDescription>Multi Commodity Exchange live prices</CardDescription>
              </CardHeader>
              <CardContent>
                {(mcxCommodities as any)?.data ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Commodity</TableHead>
                        <TableHead>Price</TableHead>
                        <TableHead>Change</TableHead>
                        <TableHead>Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(mcxCommodities as any).data.slice(0, 8).map((commodity: any, i: number) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium">{commodity.symbol}</TableCell>
                          <TableCell>{formatCurrency(commodity.price)}</TableCell>
                          <TableCell className={getChangeColor(commodity.change)}>
                            {commodity.change >= 0 ? '+' : ''}{commodity.change?.toFixed(2)}%
                          </TableCell>
                          <TableCell>
                            <Button size="sm" variant="outline" data-testid={`button-trade-commodity-${commodity.symbol}`}>
                              Trade
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">Loading MCX data...</div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wheat className="h-5 w-5 text-green-600" />
                  NCDEX Agricultural
                </CardTitle>
                <CardDescription>Agricultural commodities from NCDEX</CardDescription>
              </CardHeader>
              <CardContent>
                {(ncdexCommodities as any)?.data ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Commodity</TableHead>
                        <TableHead>Price</TableHead>
                        <TableHead>Change</TableHead>
                        <TableHead>Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(ncdexCommodities as any).data.slice(0, 8).map((commodity: any, i: number) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium">{commodity.symbol}</TableCell>
                          <TableCell>{formatCurrency(commodity.price)}</TableCell>
                          <TableCell className={getChangeColor(commodity.change)}>
                            {commodity.change >= 0 ? '+' : ''}{commodity.change?.toFixed(2)}%
                          </TableCell>
                          <TableCell>
                            <Button size="sm" variant="outline" data-testid={`button-trade-agri-${commodity.symbol}`}>
                              Trade
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">Loading NCDEX data...</div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Order Placement</CardTitle>
                <CardDescription>Place orders for derivatives and commodities</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="instrument-type">Instrument Type</Label>
                    <Select>
                      <SelectTrigger data-testid="select-instrument-type">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="equity-future">Equity Future</SelectItem>
                        <SelectItem value="call">Call Option</SelectItem>
                        <SelectItem value="put">Put Option</SelectItem>
                        <SelectItem value="commodity">Commodity</SelectItem>
                        <SelectItem value="agri-commodity">Agricultural Commodity</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="instrument-symbol">Symbol</Label>
                    <Input
                      id="instrument-symbol"
                      placeholder="NIFTY_FUT_MAR25 / GOLD"
                      data-testid="input-instrument-symbol"
                    />
                  </div>
                  <div>
                    <Label htmlFor="instrument-expiry">Expiry</Label>
                    <Select>
                      <SelectTrigger data-testid="select-instrument-expiry">
                        <SelectValue placeholder="Select expiry" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="feb2025">Feb 2025</SelectItem>
                        <SelectItem value="mar2025">Mar 2025</SelectItem>
                        <SelectItem value="apr2025">Apr 2025</SelectItem>
                        <SelectItem value="dec2025">Dec 2025</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="instrument-strike">Strike Price (Options Only)</Label>
                    <Input
                      id="instrument-strike"
                      type="number"
                      placeholder="22500"
                      data-testid="input-instrument-strike"
                    />
                  </div>
                  <div>
                    <Label htmlFor="instrument-action">Action</Label>
                    <Select>
                      <SelectTrigger data-testid="select-instrument-action">
                        <SelectValue placeholder="Buy/Sell" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="BUY">Buy</SelectItem>
                        <SelectItem value="SELL">Sell</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="instrument-lots">Lots/Quantity</Label>
                    <Input
                      id="instrument-lots"
                      type="number"
                      defaultValue={1}
                      data-testid="input-instrument-lots"
                    />
                  </div>
                </div>
                <Button className="w-full" data-testid="button-place-instrument-order">
                  Place Order
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingDown className="h-5 w-5 text-red-600" />
                  Options Chain
                </CardTitle>
                <CardDescription>Live options chain for NIFTY and BANKNIFTY</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <Label>Underlying</Label>
                    <Select>
                      <SelectTrigger data-testid="select-options-underlying">
                        <SelectValue placeholder="Select index" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NIFTY">NIFTY</SelectItem>
                        <SelectItem value="BANKNIFTY">BANKNIFTY</SelectItem>
                        <SelectItem value="FINNIFTY">FINNIFTY</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Expiry</Label>
                    <Select>
                      <SelectTrigger data-testid="select-options-expiry">
                        <SelectValue placeholder="Select expiry" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="quarterly">Quarterly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Strike Range</Label>
                    <Select>
                      <SelectTrigger data-testid="select-options-range">
                        <SelectValue placeholder="Select range" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="atm">At the Money</SelectItem>
                        <SelectItem value="otm5">OTM ±5</SelectItem>
                        <SelectItem value="otm10">OTM ±10</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead colSpan={3} className="text-center bg-green-50 dark:bg-green-950/30">CALLS</TableHead>
                        <TableHead className="text-center">STRIKE</TableHead>
                        <TableHead colSpan={3} className="text-center bg-red-50 dark:bg-red-950/30">PUTS</TableHead>
                      </TableRow>
                      <TableRow>
                        <TableHead>OI</TableHead>
                        <TableHead>LTP</TableHead>
                        <TableHead>Vol</TableHead>
                        <TableHead className="text-center font-bold">Price</TableHead>
                        <TableHead>Vol</TableHead>
                        <TableHead>LTP</TableHead>
                        <TableHead>OI</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[22400, 22450, 22500, 22550, 22600].map((strike, i) => (
                        <TableRow key={strike} className={i === 2 ? "bg-muted/30" : ""}>
                          <TableCell>{(Math.random() * 50000).toFixed(0)}</TableCell>
                          <TableCell className="text-green-600">{(Math.random() * 200 + 50).toFixed(2)}</TableCell>
                          <TableCell>{(Math.random() * 10000).toFixed(0)}</TableCell>
                          <TableCell className="text-center font-bold">{strike}</TableCell>
                          <TableCell>{(Math.random() * 10000).toFixed(0)}</TableCell>
                          <TableCell className="text-red-600">{(Math.random() * 200 + 50).toFixed(2)}</TableCell>
                          <TableCell>{(Math.random() * 50000).toFixed(0)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingDown className="h-5 w-5 text-red-600" />
                Options Chain
              </CardTitle>
              <CardDescription>Live options chain for NIFTY and BANKNIFTY</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <Label>Underlying</Label>
                  <Select>
                    <SelectTrigger data-testid="select-options-underlying">
                      <SelectValue placeholder="Select index" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NIFTY">NIFTY</SelectItem>
                      <SelectItem value="BANKNIFTY">BANKNIFTY</SelectItem>
                      <SelectItem value="FINNIFTY">FINNIFTY</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Expiry</Label>
                  <Select>
                    <SelectTrigger data-testid="select-options-expiry">
                      <SelectValue placeholder="Select expiry" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="quarterly">Quarterly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Strike Range</Label>
                  <Select>
                    <SelectTrigger data-testid="select-options-range">
                      <SelectValue placeholder="Select range" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="atm">At the Money</SelectItem>
                      <SelectItem value="otm5">OTM ±5</SelectItem>
                      <SelectItem value="otm10">OTM ±10</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead colSpan={3} className="text-center bg-green-50 dark:bg-green-950/30">CALLS</TableHead>
                      <TableHead className="text-center">STRIKE</TableHead>
                      <TableHead colSpan={3} className="text-center bg-red-50 dark:bg-red-950/30">PUTS</TableHead>
                    </TableRow>
                    <TableRow>
                      <TableHead>OI</TableHead>
                      <TableHead>LTP</TableHead>
                      <TableHead>Vol</TableHead>
                      <TableHead className="text-center font-bold">Price</TableHead>
                      <TableHead>Vol</TableHead>
                      <TableHead>LTP</TableHead>
                      <TableHead>OI</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[22400, 22450, 22500, 22550, 22600].map((strike, i) => (
                      <TableRow key={strike} className={i === 2 ? "bg-muted/30" : ""}>
                        <TableCell>{(Math.random() * 50000).toFixed(0)}</TableCell>
                        <TableCell className="text-green-600">{(Math.random() * 200 + 50).toFixed(2)}</TableCell>
                        <TableCell>{(Math.random() * 10000).toFixed(0)}</TableCell>
                        <TableCell className="text-center font-bold">{strike}</TableCell>
                        <TableCell>{(Math.random() * 10000).toFixed(0)}</TableCell>
                        <TableCell className="text-red-600">{(Math.random() * 200 + 50).toFixed(2)}</TableCell>
                        <TableCell>{(Math.random() * 50000).toFixed(0)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sentiment" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Thermometer className="h-5 w-5 text-blue-600" />
                  Real-Time Market Sentiment Heatmap
                </CardTitle>
                <CardDescription>Live sector-wise sentiment analysis based on market movements and volume</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 gap-2 mb-6">
                  {mockSentimentData.map((item, index) => (
                    <div
                      key={index}
                      className={`p-3 rounded-lg border text-center cursor-pointer transition-all hover:scale-105 ${getSentimentColor(item.sentiment)} ${
                        item.sentiment >= 0 ? 'text-foreground' : 'text-foreground'
                      }`}
                      data-testid={`sentiment-tile-${item.sector.toLowerCase().replace(' ', '-')}`}
                    >
                      <div className="text-xs font-medium truncate mb-1">{item.sector}</div>
                      <div className="text-xs">
                        {item.change >= 0 ? '+' : ''}{item.change.toFixed(2)}%
                      </div>
                      <div className="text-xs opacity-75">
                        {getSentimentLabel(item.sentiment)}
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      <div className="w-4 h-4 bg-green-500 rounded"></div>
                      <span className="text-xs">Very Bullish</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-4 h-4 bg-green-300 rounded"></div>
                      <span className="text-xs">Bullish</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-4 h-4 bg-yellow-300 rounded"></div>
                      <span className="text-xs">Neutral</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-4 h-4 bg-red-300 rounded"></div>
                      <span className="text-xs">Bearish</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-4 h-4 bg-red-500 rounded"></div>
                      <span className="text-xs">Very Bearish</span>
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    Updated: {new Date().toLocaleTimeString()}
                  </Badge>
                </div>

                <div className="text-sm text-muted-foreground">
                  Click on any sector tile to view detailed sentiment metrics and trading opportunities.
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-5 w-5 text-purple-600" />
                  Sentiment Analytics
                </CardTitle>
                <CardDescription>AI-powered market sentiment insights</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Overall Market Sentiment</span>
                    <Badge className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200">Bullish</Badge>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div className="bg-green-600 h-2 rounded-full" style={{ width: '65%' }}></div>
                  </div>
                  <div className="text-xs text-muted-foreground">65% Bullish Sentiment</div>
                </div>

                <div className="space-y-3">
                  <div className="text-sm font-medium">Top Performing Sectors</div>
                  {mockSentimentData
                    .sort((a, b) => b.change - a.change)
                    .slice(0, 5)
                    .map((item, index) => (
                      <div key={index} className="flex items-center justify-between text-sm">
                        <span className="truncate flex-1">{item.sector}</span>
                        <span className={`font-medium ${getChangeColor(item.change)}`}>
                          {item.change >= 0 ? '+' : ''}{item.change.toFixed(2)}%
                        </span>
                      </div>
                    ))}
                </div>

                <div className="space-y-3">
                  <div className="text-sm font-medium">Sentiment Drivers</div>
                  <div className="space-y-2 text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span>Strong institutional buying in IT sector</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      <span>Positive earnings outlook for banking</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                      <span>Mixed signals from energy commodities</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                      <span>Profit booking in pharma stocks</span>
                    </div>
                  </div>
                </div>

                <Button className="w-full" size="sm" data-testid="button-detailed-analysis">
                  View Detailed Analysis
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-orange-600" />
                  Sentiment-Based Trading Signals
                </CardTitle>
                <CardDescription>AI-generated trading opportunities based on sentiment analysis</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Sector</TableHead>
                      <TableHead>Signal</TableHead>
                      <TableHead>Confidence</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mockSentimentData
                      .filter(item => Math.abs(item.sentiment) > 0.4)
                      .slice(0, 6)
                      .map((item, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium">{item.sector}</TableCell>
                          <TableCell>
                            <Badge variant={item.sentiment > 0 ? 'default' : 'destructive'}>
                              {item.sentiment > 0 ? 'BUY' : 'SELL'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="w-16 bg-muted rounded-full h-2">
                                <div 
                                  className="bg-blue-600 h-2 rounded-full" 
                                  style={{ width: `${Math.abs(item.sentiment) * 100}%` }}
                                ></div>
                              </div>
                              <span className="text-xs">{(Math.abs(item.sentiment) * 100).toFixed(0)}%</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Button size="sm" variant="outline" data-testid={`button-trade-signal-${item.sector.toLowerCase().replace(' ', '-')}`}>
                              Trade
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Volume & Sentiment Correlation</CardTitle>
                <CardDescription>Relationship between trading volume and market sentiment</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-center">
                    <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-lg">
                      <div className="text-sm text-muted-foreground">High Volume + Bullish</div>
                      <div className="text-2xl font-bold text-green-600">
                        {mockSentimentData.filter(item => item.sentiment > 0.3 && item.volume > 5000).length}
                      </div>
                      <div className="text-xs text-muted-foreground">Sectors</div>
                    </div>
                    <div className="p-3 bg-red-50 dark:bg-red-950/30 rounded-lg">
                      <div className="text-sm text-muted-foreground">High Volume + Bearish</div>
                      <div className="text-2xl font-bold text-red-600">
                        {mockSentimentData.filter(item => item.sentiment < -0.3 && item.volume > 5000).length}
                      </div>
                      <div className="text-xs text-muted-foreground">Sectors</div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-sm font-medium">Volume Leaders</div>
                    {mockSentimentData
                      .sort((a, b) => b.volume - a.volume)
                      .slice(0, 5)
                      .map((item, index) => (
                        <div key={index} className="flex items-center justify-between text-sm">
                          <span className="truncate flex-1">{item.sector}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">
                              {(item.volume / 1000).toFixed(1)}K
                            </span>
                            <div className={`w-2 h-2 rounded-full ${getSentimentColor(item.sentiment)}`}></div>
                          </div>
                        </div>
                      ))}
                  </div>

                  <div className="pt-3 border-t">
                    <div className="text-xs text-muted-foreground">
                      High volume with strong sentiment often indicates sustained price movements.
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Sentiment Timeline & Market Events</CardTitle>
              <CardDescription>Recent events impacting market sentiment across sectors</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 bg-green-50 dark:bg-green-950/30 rounded-lg">
                  <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                  <div className="flex-1">
                    <div className="text-sm font-medium">Positive Q3 Earnings Beat</div>
                    <div className="text-xs text-muted-foreground">Technology sector sentiment improved following strong quarterly results from major IT companies</div>
                    <div className="text-xs text-muted-foreground mt-1">2 hours ago</div>
                  </div>
                </div>
                
                <div className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                  <div className="flex-1">
                    <div className="text-sm font-medium">RBI Policy Decision</div>
                    <div className="text-xs text-muted-foreground">Banking sector showing mixed sentiment ahead of monetary policy announcement</div>
                    <div className="text-xs text-muted-foreground mt-1">4 hours ago</div>
                  </div>
                </div>
                
                <div className="flex items-start gap-3 p-3 bg-yellow-50 dark:bg-yellow-950/30 rounded-lg">
                  <div className="w-2 h-2 bg-yellow-500 rounded-full mt-2"></div>
                  <div className="flex-1">
                    <div className="text-sm font-medium">Global Oil Price Volatility</div>
                    <div className="text-xs text-muted-foreground">Energy sector sentiment remains cautious due to geopolitical uncertainties</div>
                    <div className="text-xs text-muted-foreground mt-1">6 hours ago</div>
                  </div>
                </div>
                
                <div className="flex items-start gap-3 p-3 bg-red-50 dark:bg-red-950/30 rounded-lg">
                  <div className="w-2 h-2 bg-red-500 rounded-full mt-2"></div>
                  <div className="flex-1">
                    <div className="text-sm font-medium">Pharma Regulatory Concerns</div>
                    <div className="text-xs text-muted-foreground">Healthcare sentiment declined following regulatory inspection reports</div>
                    <div className="text-xs text-muted-foreground mt-1">8 hours ago</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ib-trading" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Interactive Brokers - Global Markets
              </CardTitle>
              <CardDescription>
                Trade US stocks, options, and global securities through Interactive Brokers
              </CardDescription>
            </CardHeader>
            <CardContent>
              <IBTrading />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="order-book" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Order Book
              </CardTitle>
              <CardDescription>All your trading orders across exchanges</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                Order book functionality coming soon...
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="watchlist" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>My Watchlist</CardTitle>
              <CardDescription>Track your favorite stocks and commodities</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                Watchlist functionality coming soon...
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}