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
import { Activity, BarChart3, TrendingUp, Globe, Building2, Coins, Wheat, RefreshCw } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { IBTrading } from "@/components/dashboard/ib-trading";

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
      return await apiRequest(endpoint, "POST", orderData);
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
    if (selectedStock) refetchQuote();
  };

  const getChangeColor = (change: number) => {
    return change >= 0 ? 'text-green-600' : 'text-red-600';
  };

  const formatCurrency = (value: number, currency = '₹') => {
    return `${currency}${value?.toFixed(2) || '0.00'}`;
  };

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

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="indian-trading">Indian Markets</TabsTrigger>
          <TabsTrigger value="commodities">Commodities</TabsTrigger>
          <TabsTrigger value="ib-trading">Global Markets</TabsTrigger>
          <TabsTrigger value="order-book">Order Book</TabsTrigger>
          <TabsTrigger value="watchlist">Watchlist</TabsTrigger>
        </TabsList>

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

                {stockQuote?.data && (
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

        <TabsContent value="commodities" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Coins className="h-5 w-5" />
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
                  <Wheat className="h-5 w-5" />
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