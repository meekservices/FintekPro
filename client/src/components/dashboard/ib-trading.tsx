import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PlusCircle, TrendingUp, Activity, Wallet } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface IBAccount {
  id: string;
  userId: string;
  accountNumber: string;
  host: string;
  port: number;
  clientId: number;
  status: string;
  lastConnected?: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface IBOrder {
  id: string;
  userId: string;
  ibAccountId: string;
  symbol: string;
  action: string;
  quantity: number;
  orderType: string;
  price?: number;
  timeInForce: string;
  status: string;
  orderId?: number;
  createdAt: Date;
  updatedAt: Date;
}

interface IBPosition {
  id: string;
  userId: string;
  ibAccountId: string;
  symbol: string;
  position: number;
  marketPrice?: number;
  marketValue?: number;
  averageCost?: number;
  unrealizedPnL?: number;
  realizedPnL?: number;
  createdAt: Date;
  updatedAt: Date;
}

export function IBTrading() {
  const [newAccount, setNewAccount] = useState({
    accountNumber: "",
    host: "127.0.0.1",
    port: 7497,
    clientId: 1
  });
  const [newOrder, setNewOrder] = useState({
    ibAccountId: "",
    symbol: "",
    action: "BUY",
    quantity: 100,
    orderType: "MKT",
    price: 0,
    timeInForce: "DAY"
  });

  const queryClient = useQueryClient();

  // Fetch IB accounts
  const { data: accounts, isLoading: accountsLoading } = useQuery<IBAccount[]>({
    queryKey: ["/api/ib/accounts"],
    retry: false
  });

  // Fetch IB orders
  const { data: orders } = useQuery<IBOrder[]>({
    queryKey: ["/api/ib/orders"],
    retry: false
  });

  // Fetch IB positions
  const { data: positions } = useQuery<IBPosition[]>({
    queryKey: ["/api/ib/positions"],
    retry: false
  });

  // Create account mutation
  const createAccountMutation = useMutation({
    mutationFn: async (accountData: typeof newAccount) => {
      return await apiRequest("/api/ib/accounts", "POST", accountData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ib/accounts"] });
      setNewAccount({
        accountNumber: "",
        host: "127.0.0.1",
        port: 7497,
        clientId: 1
      });
    }
  });

  // Connect account mutation
  const connectAccountMutation = useMutation({
    mutationFn: async (accountId: string) => {
      return await apiRequest(`/api/ib/accounts/${accountId}/connect`, "POST");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ib/accounts"] });
    }
  });

  // Place order mutation
  const placeOrderMutation = useMutation({
    mutationFn: async (orderData: typeof newOrder) => {
      return await apiRequest("/api/ib/orders", "POST", orderData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ib/orders"] });
      setNewOrder({
        ibAccountId: "",
        symbol: "",
        action: "BUY",
        quantity: 100,
        orderType: "MKT",
        price: 0,
        timeInForce: "DAY"
      });
    }
  });

  const handleCreateAccount = () => {
    if (newAccount.accountNumber) {
      createAccountMutation.mutate(newAccount);
    }
  };

  const handlePlaceOrder = () => {
    if (newOrder.ibAccountId && newOrder.symbol) {
      placeOrderMutation.mutate(newOrder);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected': return 'bg-green-500';
      case 'disconnected': return 'bg-red-500';
      case 'pending': return 'bg-yellow-500';
      default: return 'bg-muted';
    }
  };

  if (accountsLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Loading Interactive Brokers accounts...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6" data-testid="ib-trading-dashboard">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Interactive Brokers Trading</h2>
          <p className="text-muted-foreground">
            Connect your Interactive Brokers account for advanced trading capabilities
          </p>
        </div>
      </div>

      <Tabs defaultValue="accounts" className="w-full">
        <ScrollableTabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="accounts">Accounts</TabsTrigger>
          <TabsTrigger value="orders">Orders</TabsTrigger>
          <TabsTrigger value="positions">Positions</TabsTrigger>
          <TabsTrigger value="trading">Place Order</TabsTrigger>
        </ScrollableTabsList>

        <TabsContent value="accounts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5" />
                Connected Accounts
              </CardTitle>
              <CardDescription>
                Your Interactive Brokers account connections
              </CardDescription>
            </CardHeader>
            <CardContent>
              {accounts && accounts.length > 0 ? (
                <div className="space-y-4">
                  {accounts.map((account) => (
                    <div key={account.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <div className="font-medium">{account.accountNumber}</div>
                        <div className="text-sm text-muted-foreground">
                          {account.host}:{account.port} (Client ID: {account.clientId})
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={getStatusColor(account.status)}>
                          {account.status}
                        </Badge>
                        {account.status === 'disconnected' && (
                          <Button
                            size="sm"
                            onClick={() => connectAccountMutation.mutate(account.id)}
                            disabled={connectAccountMutation.isPending}
                            data-testid={`button-connect-${account.id}`}
                          >
                            Connect
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No accounts connected yet
                </div>
              )}

              <div className="mt-6 p-4 border rounded-lg bg-muted/50">
                <h4 className="font-medium mb-4">Add New Account</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="accountNumber">Account Number</Label>
                    <Input
                      id="accountNumber"
                      value={newAccount.accountNumber}
                      onChange={(e) => setNewAccount(prev => ({...prev, accountNumber: e.target.value}))}
                      placeholder="DU123456"
                      data-testid="input-account-number"
                    />
                  </div>
                  <div>
                    <Label htmlFor="clientId">Client ID</Label>
                    <Input
                      id="clientId"
                      type="number"
                      value={newAccount.clientId}
                      onChange={(e) => setNewAccount(prev => ({...prev, clientId: parseInt(e.target.value) || 1}))}
                      data-testid="input-client-id"
                    />
                  </div>
                  <div>
                    <Label htmlFor="host">Host</Label>
                    <Input
                      id="host"
                      value={newAccount.host}
                      onChange={(e) => setNewAccount(prev => ({...prev, host: e.target.value}))}
                      data-testid="input-host"
                    />
                  </div>
                  <div>
                    <Label htmlFor="port">Port</Label>
                    <Input
                      id="port"
                      type="number"
                      value={newAccount.port}
                      onChange={(e) => setNewAccount(prev => ({...prev, port: parseInt(e.target.value) || 7497}))}
                      data-testid="input-port"
                    />
                  </div>
                </div>
                <Button 
                  className="mt-4" 
                  onClick={handleCreateAccount}
                  disabled={createAccountMutation.isPending || !newAccount.accountNumber}
                  data-testid="button-add-account"
                >
                  <PlusCircle className="h-4 w-4 mr-2" />
                  Add Account
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="orders" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Order History
              </CardTitle>
            </CardHeader>
            <CardContent>
              {orders && orders.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Symbol</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell className="font-medium">{order.symbol}</TableCell>
                        <TableCell>
                          <Badge variant={order.action === 'BUY' ? 'default' : 'destructive'}>
                            {order.action}
                          </Badge>
                        </TableCell>
                        <TableCell>{order.quantity}</TableCell>
                        <TableCell>{order.orderType}</TableCell>
                        <TableCell>{order.price ? `$${order.price}` : 'Market'}</TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(order.status)}>
                            {order.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{new Date(order.createdAt).toLocaleDateString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No orders placed yet
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="positions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Current Positions
              </CardTitle>
            </CardHeader>
            <CardContent>
              {positions && positions.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Symbol</TableHead>
                      <TableHead>Position</TableHead>
                      <TableHead>Market Price</TableHead>
                      <TableHead>Market Value</TableHead>
                      <TableHead>Avg Cost</TableHead>
                      <TableHead>Unrealized P&L</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {positions.map((position) => (
                      <TableRow key={position.id}>
                        <TableCell className="font-medium">{position.symbol}</TableCell>
                        <TableCell>{position.position}</TableCell>
                        <TableCell>{position.marketPrice ? `$${position.marketPrice}` : '-'}</TableCell>
                        <TableCell>{position.marketValue ? `$${position.marketValue}` : '-'}</TableCell>
                        <TableCell>{position.averageCost ? `$${position.averageCost}` : '-'}</TableCell>
                        <TableCell>
                          <span className={position.unrealizedPnL && position.unrealizedPnL >= 0 ? 'text-green-600' : 'text-red-600'}>
                            {position.unrealizedPnL ? `$${position.unrealizedPnL}` : '-'}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No positions held
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trading" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Place New Order</CardTitle>
              <CardDescription>
                Submit a new trading order through Interactive Brokers
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="orderAccount">Account</Label>
                  <Select value={newOrder.ibAccountId} onValueChange={(value) => setNewOrder(prev => ({...prev, ibAccountId: value}))}>
                    <SelectTrigger data-testid="select-order-account">
                      <SelectValue placeholder="Select account" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts?.filter(acc => acc.status === 'connected').map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.accountNumber}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="orderSymbol">Symbol</Label>
                  <Input
                    id="orderSymbol"
                    value={newOrder.symbol}
                    onChange={(e) => setNewOrder(prev => ({...prev, symbol: e.target.value.toUpperCase()}))}
                    placeholder="AAPL"
                    data-testid="input-order-symbol"
                  />
                </div>
                <div>
                  <Label htmlFor="orderAction">Action</Label>
                  <Select value={newOrder.action} onValueChange={(value) => setNewOrder(prev => ({...prev, action: value}))}>
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
                  <Label htmlFor="orderQuantity">Quantity</Label>
                  <Input
                    id="orderQuantity"
                    type="number"
                    value={newOrder.quantity}
                    onChange={(e) => setNewOrder(prev => ({...prev, quantity: parseInt(e.target.value) || 0}))}
                    data-testid="input-order-quantity"
                  />
                </div>
                <div>
                  <Label htmlFor="orderType">Order Type</Label>
                  <Select value={newOrder.orderType} onValueChange={(value) => setNewOrder(prev => ({...prev, orderType: value}))}>
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
                {newOrder.orderType === 'LMT' && (
                  <div>
                    <Label htmlFor="orderPrice">Limit Price</Label>
                    <Input
                      id="orderPrice"
                      type="number"
                      step="0.01"
                      value={newOrder.price}
                      onChange={(e) => setNewOrder(prev => ({...prev, price: parseFloat(e.target.value) || 0}))}
                      data-testid="input-order-price"
                    />
                  </div>
                )}
              </div>
              <Button 
                className="mt-6 w-full" 
                onClick={handlePlaceOrder}
                disabled={placeOrderMutation.isPending || !newOrder.ibAccountId || !newOrder.symbol}
                data-testid="button-place-order"
              >
                Place Order
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}