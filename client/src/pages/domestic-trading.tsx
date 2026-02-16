import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { 
  TrendingUp, TrendingDown, BarChart3, PieChart, 
  Zap, Shield, Clock, Bell, Settings, RefreshCw,
  ArrowUpRight, ArrowDownRight, Search, Filter,
  Eye, Star, Plus, Minus, Play, Square,
  Activity, Target, AlertCircle, CheckCircle,
  DollarSign, Percent, Calendar, Users
} from "lucide-react";

interface Stock {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap: string;
  sector: string;
  high52w: number;
  low52w: number;
  pe: number;
}

interface Position {
  symbol: string;
  name: string;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  pnl: number;
  pnlPercent: number;
  type: "EQUITY" | "FUTURES" | "OPTIONS";
  exchange: "NSE" | "BSE";
}

interface Order {
  id: string;
  symbol: string;
  type: "BUY" | "SELL";
  quantity: number;
  price: number;
  orderType: "MARKET" | "LIMIT" | "SL" | "SL-M";
  status: "PENDING" | "EXECUTED" | "CANCELLED";
  time: string;
  exchange: "NSE" | "BSE";
}

interface Watchlist {
  id: string;
  name: string;
  stocks: Stock[];
  isDefault?: boolean;
}

// Sample market data
const sampleStocks: Stock[] = [
  {
    symbol: "RELIANCE",
    name: "Reliance Industries Ltd",
    price: 2456.75,
    change: 34.50,
    changePercent: 1.42,
    volume: 2845623,
    marketCap: "₹16.6L Cr",
    sector: "Oil & Gas",
    high52w: 2856.15,
    low52w: 2220.30,
    pe: 28.45
  },
  {
    symbol: "TCS",
    name: "Tata Consultancy Services",
    price: 3678.25,
    change: -45.80,
    changePercent: -1.23,
    volume: 1234567,
    marketCap: "₹13.4L Cr",
    sector: "IT Services",
    high52w: 4259.75,
    low52w: 3056.65,
    pe: 24.67
  },
  {
    symbol: "HDFCBANK",
    name: "HDFC Bank Ltd",
    price: 1534.40,
    change: 18.90,
    changePercent: 1.25,
    volume: 3456789,
    marketCap: "₹11.7L Cr",
    sector: "Banking",
    high52w: 1725.00,
    low52w: 1363.55,
    pe: 18.92
  },
  {
    symbol: "INFY",
    name: "Infosys Ltd",
    price: 1456.30,
    change: -12.45,
    changePercent: -0.85,
    volume: 2987654,
    marketCap: "₹6.1L Cr",
    sector: "IT Services",
    high52w: 1953.90,
    low52w: 1351.65,
    pe: 26.34
  },
  {
    symbol: "ITC",
    name: "ITC Ltd",
    price: 423.15,
    change: 5.25,
    changePercent: 1.26,
    volume: 4567890,
    marketCap: "₹5.3L Cr",
    sector: "FMCG",
    high52w: 502.75,
    low52w: 385.20,
    pe: 22.18
  }
];

const samplePositions: Position[] = [
  {
    symbol: "RELIANCE",
    name: "Reliance Industries Ltd",
    quantity: 50,
    avgPrice: 2420.30,
    currentPrice: 2456.75,
    pnl: 1822.50,
    pnlPercent: 1.51,
    type: "EQUITY",
    exchange: "NSE"
  },
  {
    symbol: "HDFCBANK",
    name: "HDFC Bank Ltd",
    quantity: 100,
    avgPrice: 1545.80,
    currentPrice: 1534.40,
    pnl: -1140.00,
    pnlPercent: -0.74,
    type: "EQUITY",
    exchange: "NSE"
  },
  {
    symbol: "BANKNIFTY24DEC24900CE",
    name: "Bank Nifty 24900 CE",
    quantity: 25,
    avgPrice: 145.50,
    currentPrice: 198.25,
    pnl: 1318.75,
    pnlPercent: 36.26,
    type: "OPTIONS",
    exchange: "NSE"
  }
];

const sampleOrders: Order[] = [
  {
    id: "ORD001",
    symbol: "TCS",
    type: "BUY",
    quantity: 25,
    price: 3650.00,
    orderType: "LIMIT",
    status: "PENDING",
    time: "09:15:23",
    exchange: "NSE"
  },
  {
    id: "ORD002", 
    symbol: "INFY",
    type: "SELL",
    quantity: 50,
    price: 1460.00,
    orderType: "SL",
    status: "EXECUTED",
    time: "10:30:45",
    exchange: "NSE"
  }
];

const defaultWatchlist: Watchlist = {
  id: "default",
  name: "My Watchlist",
  stocks: sampleStocks,
  isDefault: true
};

export default function DomesticTrading() {
  const [activeTab, setActiveTab] = useState("market");
  const [selectedStock, setSelectedStock] = useState<Stock | null>(null);
  const [watchlists, setWatchlists] = useState<Watchlist[]>([defaultWatchlist]);
  const [activeWatchlist, setActiveWatchlist] = useState("default");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedExchange, setSelectedExchange] = useState("NSE");
  const [orderType, setOrderType] = useState("BUY");
  const [orderQuantity, setOrderQuantity] = useState("");
  const [orderPrice, setOrderPrice] = useState("");
  
  const { isAuthenticated, user } = useAuth();
  const { toast } = useToast();

  const filteredStocks = sampleStocks.filter(stock =>
    stock.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
    stock.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPnL = samplePositions.reduce((sum, position) => sum + position.pnl, 0);
  const totalInvested = samplePositions.reduce((sum, position) => sum + (position.quantity * position.avgPrice), 0);

  const handlePlaceOrder = () => {
    if (!isAuthenticated) {
      toast({
        title: "Login Required",
        description: "Please login to place trades.",
      });
      return;
    }

    if (!selectedStock || !orderQuantity || !orderPrice) {
      toast({
        title: "Invalid Order",
        description: "Please select a stock and enter valid quantity and price.",
        variant: "destructive"
      });
      return;
    }

    toast({
      title: "Order Placed",
      description: `${orderType} order for ${orderQuantity} shares of ${selectedStock.symbol} at ₹${orderPrice} placed successfully.`,
    });

    // Reset form
    setOrderQuantity("");
    setOrderPrice("");
  };

  const addToWatchlist = (stock: Stock) => {
    setWatchlists(prev => prev.map(wl => 
      wl.id === activeWatchlist 
        ? { ...wl, stocks: [...wl.stocks.filter(s => s.symbol !== stock.symbol), stock] }
        : wl
    ));
    
    toast({
      title: "Added to Watchlist",
      description: `${stock.symbol} has been added to your watchlist.`,
    });
  };

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Domestic Trading</h1>
          <p className="text-muted-foreground">NSE & BSE Equity, F&O, and Commodities Trading</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200">
            <div className="w-2 h-2 bg-green-500 rounded-full mr-1 animate-pulse"></div>
            Market Open
          </Badge>
          <Button variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Portfolio Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total P&L</p>
                <p className={`text-lg font-bold ${totalPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  ₹{Math.abs(totalPnL).toLocaleString()}
                </p>
              </div>
              {totalPnL >= 0 ? 
                <TrendingUp className="h-6 w-6 text-green-600" /> : 
                <TrendingDown className="h-6 w-6 text-red-600" />
              }
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Invested</p>
                <p className="text-lg font-bold">₹{totalInvested.toLocaleString()}</p>
              </div>
              <DollarSign className="h-6 w-6 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Day's P&L</p>
                <p className="text-lg font-bold text-green-600">+₹2,845</p>
              </div>
              <Activity className="h-6 w-6 text-green-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Available Cash</p>
                <p className="text-lg font-bold">₹45,230</p>
              </div>
              <Target className="h-6 w-6 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Trading Interface */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Market Data & Trading */}
        <div className="lg:col-span-2 space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <ScrollableTabsList className="grid grid-cols-4 w-full">
              <TabsTrigger value="market" data-testid="tab-market">Market</TabsTrigger>
              <TabsTrigger value="positions" data-testid="tab-positions">Positions</TabsTrigger>
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
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-2">Symbol</th>
                          <th className="text-right p-2">Price</th>
                          <th className="text-right p-2">Change</th>
                          <th className="text-right p-2">%Change</th>
                          <th className="text-right p-2">Volume</th>
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
                                <div className="text-xs text-muted-foreground">{stock.sector}</div>
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
                            <td className="text-right p-2 text-sm">{stock.volume.toLocaleString()}</td>
                            <td className="text-center p-2">
                              <div className="flex items-center justify-center gap-1">
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    addToWatchlist(stock);
                                  }}
                                  data-testid={`button-watchlist-${stock.symbol}`}
                                >
                                  <Star className="h-3 w-3" />
                                </Button>
                                <Button 
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedStock(stock);
                                    setActiveTab("trade");
                                  }}
                                  data-testid={`button-trade-${stock.symbol}`}
                                >
                                  Trade
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Positions Tab */}
            <TabsContent value="positions" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PieChart className="h-5 w-5 text-green-600" />
                    Current Positions
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
                          <th className="text-right p-2">LTP</th>
                          <th className="text-right p-2">P&L</th>
                          <th className="text-center p-2">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {samplePositions.map(position => (
                          <tr key={`${position.symbol}-${position.type}`} className="border-b">
                            <td className="p-2">
                              <div>
                                <div className="font-semibold">{position.symbol}</div>
                                <div className="text-xs text-muted-foreground">{position.type} • {position.exchange}</div>
                              </div>
                            </td>
                            <td className="text-right p-2">{position.quantity}</td>
                            <td className="text-right p-2">₹{position.avgPrice.toFixed(2)}</td>
                            <td className="text-right p-2">₹{position.currentPrice.toFixed(2)}</td>
                            <td className={`text-right p-2 ${position.pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              <div>
                                {position.pnl >= 0 ? '+' : ''}₹{position.pnl.toFixed(2)}
                              </div>
                              <div className="text-xs">
                                ({position.pnlPercent >= 0 ? '+' : ''}{position.pnlPercent.toFixed(2)}%)
                              </div>
                            </td>
                            <td className="text-center p-2">
                              <Button 
                                size="sm" 
                                variant="outline"
                                data-testid={`button-square-off-${position.symbol}`}
                              >
                                Square Off
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

            {/* Orders Tab */}
            <TabsContent value="orders" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-orange-600" />
                    Order Book
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-2">Symbol</th>
                          <th className="text-center p-2">Type</th>
                          <th className="text-right p-2">Qty</th>
                          <th className="text-right p-2">Price</th>
                          <th className="text-center p-2">Status</th>
                          <th className="text-center p-2">Time</th>
                          <th className="text-center p-2">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sampleOrders.map(order => (
                          <tr key={order.id} className="border-b">
                            <td className="p-2">
                              <div>
                                <div className="font-semibold">{order.symbol}</div>
                                <div className="text-xs text-muted-foreground">{order.exchange}</div>
                              </div>
                            </td>
                            <td className="text-center p-2">
                              <Badge 
                                variant={order.type === "BUY" ? "default" : "secondary"}
                                className={order.type === "BUY" ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200" : "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200"}
                              >
                                {order.type}
                              </Badge>
                            </td>
                            <td className="text-right p-2">{order.quantity}</td>
                            <td className="text-right p-2">₹{order.price.toFixed(2)}</td>
                            <td className="text-center p-2">
                              <Badge 
                                variant={
                                  order.status === "EXECUTED" ? "default" :
                                  order.status === "PENDING" ? "secondary" : "destructive"
                                }
                              >
                                {order.status}
                              </Badge>
                            </td>
                            <td className="text-center p-2 text-sm">{order.time}</td>
                            <td className="text-center p-2">
                              {order.status === "PENDING" && (
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  data-testid={`button-cancel-${order.id}`}
                                >
                                  Cancel
                                </Button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
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
                      My Watchlists
                    </CardTitle>
                    <Button size="sm" data-testid="button-create-watchlist">
                      <Plus className="h-4 w-4 mr-1" />
                      Create List
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {watchlists.map(watchlist => (
                    <div key={watchlist.id} className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold">{watchlist.name}</h4>
                        <Badge variant="secondary">{watchlist.stocks.length} stocks</Badge>
                      </div>
                      <div className="grid gap-2">
                        {watchlist.stocks.map(stock => (
                          <div key={stock.symbol} className="flex items-center justify-between p-2 border rounded-lg hover:bg-muted dark:hover:bg-card/50">
                            <div className="flex items-center gap-3">
                              <div>
                                <div className="font-semibold">{stock.symbol}</div>
                                <div className="text-xs text-muted-foreground">{stock.sector}</div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-semibold">₹{stock.price.toFixed(2)}</div>
                              <div className={`text-xs ${stock.changePercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {stock.changePercent >= 0 ? '+' : ''}{stock.changePercent.toFixed(2)}%
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button 
                                size="sm"
                                onClick={() => setSelectedStock(stock)}
                                data-testid={`button-view-${stock.symbol}`}
                              >
                                View
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
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
              {selectedStock ? (
                <div className="space-y-4">
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <div className="font-semibold">{selectedStock.symbol}</div>
                    <div className="text-sm text-muted-foreground">{selectedStock.name}</div>
                    <div className="text-lg font-bold">₹{selectedStock.price.toFixed(2)}</div>
                    <div className={`text-sm ${selectedStock.changePercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {selectedStock.changePercent >= 0 ? '+' : ''}{selectedStock.changePercent.toFixed(2)}%
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <Button 
                      variant={orderType === "BUY" ? "default" : "outline"}
                      onClick={() => setOrderType("BUY")}
                      className="bg-green-600 hover:bg-green-700 text-white"
                      data-testid="button-buy"
                    >
                      BUY
                    </Button>
                    <Button 
                      variant={orderType === "SELL" ? "default" : "outline"}
                      onClick={() => setOrderType("SELL")}
                      className="bg-red-600 hover:bg-red-700 text-white"
                      data-testid="button-sell"
                    >
                      SELL
                    </Button>
                  </div>
                  
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium mb-1">Quantity</label>
                      <Input 
                        type="number"
                        value={orderQuantity}
                        onChange={(e) => setOrderQuantity(e.target.value)}
                        placeholder="Enter quantity"
                        data-testid="input-quantity"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium mb-1">Price</label>
                      <Input 
                        type="number"
                        value={orderPrice}
                        onChange={(e) => setOrderPrice(e.target.value)}
                        placeholder={`Market price: ₹${selectedStock.price.toFixed(2)}`}
                        data-testid="input-price"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium mb-1">Order Type</label>
                      <Select defaultValue="LIMIT">
                        <SelectTrigger data-testid="select-order-type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="MARKET">Market</SelectItem>
                          <SelectItem value="LIMIT">Limit</SelectItem>
                          <SelectItem value="SL">Stop Loss</SelectItem>
                          <SelectItem value="SL-M">Stop Loss Market</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <Button 
                      className="w-full"
                      onClick={handlePlaceOrder}
                      data-testid="button-place-order"
                    >
                      Place Order
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Select a stock to start trading</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-blue-600" />
                Market Indices
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between p-2 border rounded-lg">
                <div>
                  <div className="font-semibold">NIFTY 50</div>
                  <div className="text-sm text-muted-foreground">NSE</div>
                </div>
                <div className="text-right">
                  <div className="font-semibold">19,674.25</div>
                  <div className="text-sm text-green-600">+0.82%</div>
                </div>
              </div>
              
              <div className="flex items-center justify-between p-2 border rounded-lg">
                <div>
                  <div className="font-semibold">SENSEX</div>
                  <div className="text-sm text-muted-foreground">BSE</div>
                </div>
                <div className="text-right">
                  <div className="font-semibold">65,995.63</div>
                  <div className="text-sm text-green-600">+0.95%</div>
                </div>
              </div>
              
              <div className="flex items-center justify-between p-2 border rounded-lg">
                <div>
                  <div className="font-semibold">BANK NIFTY</div>
                  <div className="text-sm text-muted-foreground">NSE</div>
                </div>
                <div className="text-right">
                  <div className="font-semibold">45,234.80</div>
                  <div className="text-sm text-red-600">-0.23%</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-green-600" />
                Trading Tools
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button variant="outline" className="w-full justify-start" data-testid="button-options-chain">
                <Target className="h-4 w-4 mr-2" />
                Options Chain
              </Button>
              <Button variant="outline" className="w-full justify-start" data-testid="button-market-depth">
                <BarChart3 className="h-4 w-4 mr-2" />
                Market Depth
              </Button>
              <Button variant="outline" className="w-full justify-start" data-testid="button-basket-orders">
                <Users className="h-4 w-4 mr-2" />
                Basket Orders
              </Button>
              <Button variant="outline" className="w-full justify-start" data-testid="button-alerts">
                <Bell className="h-4 w-4 mr-2" />
                Price Alerts
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}