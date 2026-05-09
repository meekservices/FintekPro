import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { 
  TrendingUp, TrendingDown, BarChart3, PieChart, 
  Zap, Clock, RefreshCw,
  ArrowUpRight, ArrowDownRight, Search,
  Eye, Star, Plus,
  Activity, Target, AlertCircle, Loader2,
  DollarSign, ShoppingCart, XCircle, CheckCircle
} from "lucide-react";

interface MarketStock {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume?: number;
  marketCap?: string;
  sector?: string;
  high52w?: number;
  low52w?: number;
  pe?: number;
}

interface ApiOrder {
  id: number;
  orderId: string;
  productName: string;
  productType: string;
  orderType: string;
  amount: number;
  quantity?: number;
  status: string;
  createdAt: string;
  executionStatus?: string;
  executionPrice?: number;
}

export default function DomesticTrading() {
  const [activeTab, setActiveTab] = useState("market");
  const [selectedStock, setSelectedStock] = useState<MarketStock | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedExchange, setSelectedExchange] = useState("NSE");
  const [orderType, setOrderType] = useState("BUY");
  const [orderPriceType, setOrderPriceType] = useState<"MARKET" | "LIMIT">("MARKET");
  const [orderQuantity, setOrderQuantity] = useState("");
  const [orderPrice, setOrderPrice] = useState("");
  
  const { isAuthenticated, user } = useAuth();
  const { toast } = useToast();

  const { data: marketMovers, isLoading: marketLoading, refetch: refetchMarket } = useQuery({
    queryKey: ['/api/market/movers'],
    queryFn: async () => {
      const response = await fetch('/api/market/movers');
      if (!response.ok) throw new Error('Failed to fetch market data');
      return response.json();
    },
    refetchInterval: 60000,
  });

  const { data: marketStatus } = useQuery({
    queryKey: ['/api/market/status'],
    queryFn: async () => {
      const response = await fetch('/api/market/status');
      if (!response.ok) throw new Error('Failed');
      return response.json();
    },
    refetchInterval: 300000,
  });

  const { data: indicesData } = useQuery({
    queryKey: ['/api/market/indices'],
    queryFn: async () => {
      const response = await fetch('/api/market/indices');
      if (!response.ok) throw new Error('Failed');
      return response.json();
    },
    refetchInterval: 60000,
  });

  const { data: ordersData, isLoading: ordersLoading } = useQuery({
    queryKey: ['/api/orders'],
    queryFn: async () => {
      const response = await fetch('/api/orders?productType=equity&limit=20', { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch orders');
      return response.json();
    },
    enabled: !!isAuthenticated,
  });

  const { data: orderStats } = useQuery({
    queryKey: ['/api/orders/stats'],
    enabled: !!isAuthenticated,
  });

  const placeOrderMutation = useMutation({
    mutationFn: async (orderData: {
      productName: string;
      orderType: string;
      amount: number;
      quantity: number;
    }) => {
      return await apiRequest('/api/orders', {
        method: 'POST',
        body: JSON.stringify({
          productType: 'equity',
          productName: orderData.productName,
          orderType: orderData.orderType === 'BUY' ? 'buy' : 'sell',
          amount: orderData.amount,
          quantity: orderData.quantity,
          currency: 'INR',
          metadata: {
            exchange: selectedExchange,
            priceType: orderPriceType,
            symbol: selectedStock?.symbol,
          }
        })
      });
    },
    onSuccess: (data) => {
      toast({
        title: "Order Placed Successfully",
        description: `${orderType} order for ${orderQuantity} shares placed. Order ID: ${data.order?.orderId || 'Processing'}`,
      });
      setOrderQuantity("");
      setOrderPrice("");
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      queryClient.invalidateQueries({ queryKey: ['/api/orders/stats'] });
    },
    onError: (error) => {
      toast({
        title: "Order Failed",
        description: error instanceof Error ? error.message : "Failed to place order. Please try again.",
        variant: "destructive"
      });
    }
  });

  const cancelOrderMutation = useMutation({
    mutationFn: async (orderId: string) => {
      return await apiRequest(`/api/orders/${orderId}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason: 'User cancelled' })
      });
    },
    onSuccess: () => {
      toast({ title: "Order Cancelled", description: "Order has been cancelled successfully." });
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      queryClient.invalidateQueries({ queryKey: ['/api/orders/stats'] });
    },
    onError: (error) => {
      toast({
        title: "Cancel Failed",
        description: error instanceof Error ? error.message : "Failed to cancel order.",
        variant: "destructive"
      });
    }
  });

  const allStocks: MarketStock[] = (() => {
    if (!marketMovers) return [];
    const stocks: MarketStock[] = [];
    const gainers = marketMovers.gainers || marketMovers.data?.gainers || [];
    const losers = marketMovers.losers || marketMovers.data?.losers || [];
    const active = marketMovers.mostActive || marketMovers.data?.mostActive || [];
    
    const seen = new Set<string>();
    [...gainers, ...losers, ...active].forEach((s: any) => {
      const symbol = s.symbol || s.ticker || '';
      if (symbol && !seen.has(symbol)) {
        seen.add(symbol);
        stocks.push({
          symbol,
          name: s.name || s.companyName || symbol,
          price: parseFloat(s.price || s.lastPrice || s.close || '0'),
          change: parseFloat(s.change || s.priceChange || '0'),
          changePercent: parseFloat(s.changePercent || s.percentChange || s.changesPercentage || '0'),
          volume: parseInt(s.volume || '0'),
          sector: s.sector || '',
        });
      }
    });
    return stocks;
  })();

  const filteredStocks = allStocks.filter(stock =>
    stock.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
    stock.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const orders: ApiOrder[] = ordersData?.orders || [];
  const stats = (orderStats as any)?.stats || {};

  const handlePlaceOrder = () => {
    if (!isAuthenticated) {
      toast({ title: "Login Required", description: "Please login to place trades." });
      return;
    }

    if (!selectedStock || !orderQuantity) {
      toast({ title: "Invalid Order", description: "Please select a stock and enter quantity.", variant: "destructive" });
      return;
    }

    const qty = parseInt(orderQuantity);
    const price = orderPriceType === 'MARKET' ? selectedStock.price : parseFloat(orderPrice);
    
    if (isNaN(qty) || qty <= 0) {
      toast({ title: "Invalid Quantity", description: "Please enter a valid quantity.", variant: "destructive" });
      return;
    }

    if (orderPriceType === 'LIMIT' && (isNaN(price) || price <= 0)) {
      toast({ title: "Invalid Price", description: "Please enter a valid limit price.", variant: "destructive" });
      return;
    }

    placeOrderMutation.mutate({
      productName: `${selectedStock.symbol} - ${selectedStock.name}`,
      orderType: orderType,
      amount: price * qty,
      quantity: qty,
    });
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'completed': case 'executed': return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200';
      case 'pending': case 'processing': return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200';
      case 'cancelled': case 'failed': case 'rejected': return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200';
      default: return 'bg-gray-100 dark:bg-gray-900/30 text-gray-800 dark:text-gray-200';
    }
  };

  const isMarketOpen = marketStatus?.isOpen || marketStatus?.status === 'open';

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Domestic Trading</h1>
          <p className="text-muted-foreground">NSE & BSE Equity, F&O, and Commodities Trading</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className={isMarketOpen 
            ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200" 
            : "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200"
          }>
            <div className={`w-2 h-2 rounded-full mr-1 ${isMarketOpen ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
            {isMarketOpen ? 'Market Open' : 'Market Closed'}
          </Badge>
          <Button variant="outline" size="sm" onClick={() => refetchMarket()}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Market Indices Bar */}
      {indicesData && (
        <div className="flex gap-4 overflow-x-auto pb-2">
          {(Array.isArray(indicesData) ? indicesData : indicesData.indices || []).slice(0, 4).map((index: any) => (
            <Card key={index.symbol || index.name} className="min-w-[200px] flex-shrink-0">
              <CardContent className="p-3">
                <p className="text-xs text-muted-foreground truncate">{index.name || index.symbol}</p>
                <p className="text-lg font-bold">
                  {parseFloat(index.price || index.value || '0').toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </p>
                <p className={`text-xs ${parseFloat(index.change || '0') >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {parseFloat(index.change || '0') >= 0 ? '+' : ''}{parseFloat(index.change || '0').toFixed(2)} 
                  ({parseFloat(index.changePercent || index.changesPercentage || '0').toFixed(2)}%)
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Portfolio Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Orders</p>
                <p className="text-lg font-bold">{stats.totalOrders || 0}</p>
              </div>
              <ShoppingCart className="h-6 w-6 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Invested</p>
                <p className="text-lg font-bold">
                  {stats.totalAmount ? `₹${parseFloat(stats.totalAmount).toLocaleString('en-IN')}` : '₹0'}
                </p>
              </div>
              <DollarSign className="h-6 w-6 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Completed</p>
                <p className="text-lg font-bold text-green-600">{stats.completedOrders || 0}</p>
              </div>
              <Activity className="h-6 w-6 text-green-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-lg font-bold text-yellow-600">{stats.pendingOrders || 0}</p>
              </div>
              <Target className="h-6 w-6 text-yellow-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Trading Interface */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Market Data & Trading */}
        <div className="lg:col-span-2 space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <ScrollableTabsList className="grid grid-cols-3 w-full">
              <TabsTrigger value="market" data-testid="tab-market">Market</TabsTrigger>
              <TabsTrigger value="orders" data-testid="tab-orders">Orders</TabsTrigger>
              <TabsTrigger value="watchlist" data-testid="tab-watchlist">Watchlist</TabsTrigger>
            </ScrollableTabsList>

            {/* Market Tab */}
            <TabsContent value="market" className="space-y-4">
              <Card>
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5 text-blue-600" />
                      Market Overview
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <Select value={selectedExchange} onValueChange={setSelectedExchange}>
                        <SelectTrigger className="w-24" data-testid="select-exchange">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="NSE">NSE</SelectItem>
                          <SelectItem value="BSE">BSE</SelectItem>
                        </SelectContent>
                      </Select>
                      <div className="relative">
                        <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
                        <Input
                          placeholder="Search stocks..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-10 w-64"
                          data-testid="input-search-stocks"
                        />
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {marketLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                      <span className="ml-3 text-muted-foreground">Loading market data...</span>
                    </div>
                  ) : filteredStocks.length === 0 ? (
                    <div className="text-center py-12">
                      <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                      <p className="text-muted-foreground">
                        {searchTerm ? 'No stocks match your search' : 'Market data will appear when available'}
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left p-2">Symbol</th>
                            <th className="text-right p-2">Price</th>
                            <th className="text-right p-2">Change</th>
                            <th className="text-right p-2">%Change</th>
                            <th className="text-right p-2 hidden md:table-cell">Volume</th>
                            <th className="text-center p-2">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredStocks.map(stock => (
                            <tr 
                              key={stock.symbol} 
                              className="border-b hover:bg-muted dark:hover:bg-card/50 cursor-pointer"
                              onClick={() => setSelectedStock(stock)}
                            >
                              <td className="p-2">
                                <div>
                                  <div className="font-semibold">{stock.symbol}</div>
                                  <div className="text-xs text-muted-foreground truncate max-w-[150px]">{stock.name}</div>
                                </div>
                              </td>
                              <td className="text-right p-2 font-semibold">₹{stock.price.toFixed(2)}</td>
                              <td className={`text-right p-2 ${stock.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {stock.change >= 0 ? '+' : ''}₹{stock.change.toFixed(2)}
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
                              <td className="text-right p-2 text-sm hidden md:table-cell">
                                {stock.volume ? stock.volume.toLocaleString() : '-'}
                              </td>
                              <td className="text-center p-2">
                                <Button 
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedStock(stock);
                                    setOrderPrice(stock.price.toFixed(2));
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

            {/* Orders Tab */}
            <TabsContent value="orders" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-orange-600" />
                    Order Book
                  </CardTitle>
                  <CardDescription>Your real-time order history and status</CardDescription>
                </CardHeader>
                <CardContent>
                  {!isAuthenticated ? (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>Please login to view your orders</AlertDescription>
                    </Alert>
                  ) : ordersLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      <span className="ml-2 text-muted-foreground">Loading orders...</span>
                    </div>
                  ) : orders.length === 0 ? (
                    <div className="text-center py-12">
                      <ShoppingCart className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                      <p className="font-medium">No Orders Yet</p>
                      <p className="text-sm text-muted-foreground mt-1">Place your first trade to get started</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left p-2">Product</th>
                            <th className="text-center p-2">Type</th>
                            <th className="text-right p-2">Qty</th>
                            <th className="text-right p-2">Amount</th>
                            <th className="text-center p-2">Status</th>
                            <th className="text-center p-2">Date</th>
                            <th className="text-center p-2">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {orders.map((order: ApiOrder) => (
                            <tr key={order.orderId || order.id} className="border-b">
                              <td className="p-2">
                                <div>
                                  <div className="font-semibold text-sm">{order.productName}</div>
                                  <div className="text-xs text-muted-foreground">{order.orderId}</div>
                                </div>
                              </td>
                              <td className="text-center p-2">
                                <Badge 
                                  variant="secondary"
                                  className={order.orderType === 'buy' 
                                    ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200" 
                                    : "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200"
                                  }
                                >
                                  {order.orderType?.toUpperCase()}
                                </Badge>
                              </td>
                              <td className="text-right p-2">{order.quantity || '-'}</td>
                              <td className="text-right p-2 font-medium">
                                ₹{parseFloat(String(order.amount || 0)).toLocaleString('en-IN')}
                              </td>
                              <td className="text-center p-2">
                                <Badge variant="secondary" className={getStatusColor(order.status)}>
                                  {order.status}
                                </Badge>
                              </td>
                              <td className="text-center p-2 text-sm text-muted-foreground">
                                {new Date(order.createdAt).toLocaleDateString('en-IN')}
                              </td>
                              <td className="text-center p-2">
                                {(order.status === 'pending' || order.status === 'processing') && (
                                  <Button 
                                    size="sm" 
                                    variant="outline"
                                    disabled={cancelOrderMutation.isPending}
                                    onClick={() => cancelOrderMutation.mutate(order.orderId)}
                                    data-testid={`button-cancel-${order.orderId}`}
                                  >
                                    {cancelOrderMutation.isPending ? (
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                      <XCircle className="h-3 w-3" />
                                    )}
                                  </Button>
                                )}
                                {order.status === 'completed' && (
                                  <CheckCircle className="h-4 w-4 text-green-500 mx-auto" />
                                )}
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

            {/* Watchlist Tab */}
            <TabsContent value="watchlist" className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Eye className="h-5 w-5 text-purple-600" />
                      My Watchlist
                    </CardTitle>
                    <Button size="sm" variant="outline" data-testid="button-create-watchlist">
                      <Plus className="h-4 w-4 mr-1" />
                      Add Stock
                    </Button>
                  </div>
                  <CardDescription>Track your favorite stocks from market movers</CardDescription>
                </CardHeader>
                <CardContent>
                  {allStocks.length === 0 ? (
                    <div className="text-center py-12">
                      <Star className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                      <p className="font-medium">No Market Data</p>
                      <p className="text-sm text-muted-foreground mt-1">Market movers will appear here when data is available</p>
                    </div>
                  ) : (
                    <div className="grid gap-2">
                      {allStocks.slice(0, 10).map(stock => (
                        <div 
                          key={stock.symbol} 
                          className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted dark:hover:bg-card/50 cursor-pointer transition-colors"
                          onClick={() => setSelectedStock(stock)}
                        >
                          <div>
                            <div className="font-semibold">{stock.symbol}</div>
                            <div className="text-xs text-muted-foreground truncate max-w-[200px]">{stock.name}</div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold">₹{stock.price.toFixed(2)}</div>
                            <div className={`text-xs flex items-center justify-end gap-1 ${stock.changePercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {stock.changePercent >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                              {stock.changePercent >= 0 ? '+' : ''}{stock.changePercent.toFixed(2)}%
                            </div>
                          </div>
                          <Button 
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedStock(stock);
                              setOrderPrice(stock.price.toFixed(2));
                            }}
                            data-testid={`button-view-${stock.symbol}`}
                          >
                            Trade
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Trading Panel */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-yellow-600" />
                Quick Trade
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!isAuthenticated ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>Please login to place trades</AlertDescription>
                </Alert>
              ) : selectedStock ? (
                <div className="space-y-4">
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <div className="font-semibold">{selectedStock.symbol}</div>
                    <div className="text-sm text-muted-foreground truncate">{selectedStock.name}</div>
                    <div className="text-lg font-bold mt-1">₹{selectedStock.price.toFixed(2)}</div>
                    <div className={`text-sm ${selectedStock.changePercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {selectedStock.changePercent >= 0 ? '+' : ''}{selectedStock.changePercent.toFixed(2)}%
                      <span className="ml-2 text-xs text-muted-foreground">
                        ({selectedStock.change >= 0 ? '+' : ''}₹{selectedStock.change.toFixed(2)})
                      </span>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <Button 
                      variant={orderType === "BUY" ? "default" : "outline"}
                      className={orderType === "BUY" ? "bg-green-600 hover:bg-green-700" : ""}
                      onClick={() => setOrderType("BUY")}
                    >
                      BUY
                    </Button>
                    <Button 
                      variant={orderType === "SELL" ? "default" : "outline"}
                      className={orderType === "SELL" ? "bg-red-600 hover:bg-red-700" : ""}
                      onClick={() => setOrderType("SELL")}
                    >
                      SELL
                    </Button>
                  </div>

                  <Select value={orderPriceType} onValueChange={(v) => setOrderPriceType(v as "MARKET" | "LIMIT")}>
                    <SelectTrigger>
                      <SelectValue placeholder="Order Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MARKET">Market Order</SelectItem>
                      <SelectItem value="LIMIT">Limit Order</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  <div>
                    <label className="text-sm font-medium mb-1 block">Quantity</label>
                    <Input
                      type="number"
                      min="1"
                      placeholder="Enter quantity"
                      value={orderQuantity}
                      onChange={(e) => setOrderQuantity(e.target.value)}
                      data-testid="input-order-quantity"
                    />
                  </div>
                  
                  {orderPriceType === 'LIMIT' && (
                    <div>
                      <label className="text-sm font-medium mb-1 block">Limit Price (₹)</label>
                      <Input
                        type="number"
                        min="0.01"
                        step="0.05"
                        placeholder="Enter price"
                        value={orderPrice}
                        onChange={(e) => setOrderPrice(e.target.value)}
                        data-testid="input-order-price"
                      />
                    </div>
                  )}
                  
                  {orderQuantity && (
                    <>
                      <Separator />
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Price</span>
                          <span>₹{(orderPriceType === 'MARKET' ? selectedStock.price : parseFloat(orderPrice || '0')).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Quantity</span>
                          <span>{orderQuantity}</span>
                        </div>
                        <Separator />
                        <div className="flex justify-between font-semibold">
                          <span>Estimated Total</span>
                          <span>₹{((orderPriceType === 'MARKET' ? selectedStock.price : parseFloat(orderPrice || '0')) * parseInt(orderQuantity || '0')).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                        </div>
                      </div>
                    </>
                  )}
                  
                  <Button 
                    className={`w-full ${orderType === 'BUY' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}
                    disabled={placeOrderMutation.isPending || !orderQuantity}
                    onClick={handlePlaceOrder}
                    data-testid="button-place-order"
                  >
                    {placeOrderMutation.isPending ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Placing Order...</>
                    ) : (
                      `${orderType} ${selectedStock.symbol}`
                    )}
                  </Button>
                </div>
              ) : (
                <div className="text-center py-8">
                  <PieChart className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground">Select a stock from the market to start trading</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Market Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Market Info
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Exchange</span>
                <span className="font-medium">{selectedExchange}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status</span>
                <Badge variant="secondary" className={isMarketOpen ? 'text-green-600' : 'text-red-600'}>
                  {isMarketOpen ? 'Open' : 'Closed'}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Stocks Loaded</span>
                <span className="font-medium">{allStocks.length}</span>
              </div>
              {isAuthenticated && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Your Orders</span>
                  <span className="font-medium">{orders.length}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}