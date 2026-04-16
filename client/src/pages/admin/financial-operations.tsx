import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Search, DollarSign, ShoppingCart, TrendingUp, RefreshCw, Eye, XCircle } from "lucide-react";

type DashboardStats = {
  totalOrders: number;
  pendingOrders: number;
  completedOrders: number;
  totalRevenue: string;
  todayRevenue: string;
  ordersByStatus: { status: string; count: number }[];
  ordersByProductType: { productType: string; count: number; revenue: string }[];
  recentOrders: any[];
};

type Order = {
  id: string;
  orderNumber: string;
  userId: string;
  productType: string;
  status: string;
  paymentStatus: string;
  executionStatus: string;
  amount: string;
  paymentGateway: string;
  createdAt: string;
};

type Transaction = {
  id: string;
  amount: string;
  status?: string;
  state?: string;
  createdAt: string;
  userId: string;
};

type Refund = {
  id: string;
  orderId: string;
  amount: string;
  reason: string;
  status: string;
  initiatedBy: string;
  createdAt: string;
};

// Refund form schema
const refundFormSchema = z.object({
  amount: z.string().min(1, "Amount is required").refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0, {
    message: "Amount must be a positive number"
  }),
  reason: z.string().min(10, "Reason must be at least 10 characters"),
});

export default function FinancialOperations() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [statusFilter, setStatusFilter] = useState("all");
  const [productTypeFilter, setProductTypeFilter] = useState("all");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  
  // Order details dialog
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [orderDetailsOpen, setOrderDetailsOpen] = useState(false);
  
  // Refund dialog
  const [refundDialogOpen, setRefundDialogOpen] = useState(false);
  const [refundOrder, setRefundOrder] = useState<Order | null>(null);
  
  const { toast } = useToast();

  // Refund form
  const refundForm = useForm<z.infer<typeof refundFormSchema>>({
    resolver: zodResolver(refundFormSchema),
    defaultValues: {
      amount: "",
      reason: "",
    },
  });

  // Fetch dashboard stats
  const { data: dashboardResponse } = useQuery<{ success: boolean; data: DashboardStats }>({
    queryKey: ["/api/admin/financial/dashboard"],
    enabled: activeTab === "dashboard",
  });
  const dashboard = dashboardResponse?.data;

  // Fetch orders
  const ordersParams = new URLSearchParams();
  if (statusFilter !== "all") ordersParams.set("status", statusFilter);
  if (productTypeFilter !== "all") ordersParams.set("productType", productTypeFilter);
  if (paymentStatusFilter !== "all") ordersParams.set("paymentStatus", paymentStatusFilter);
  if (searchQuery) ordersParams.set("search", searchQuery);
  const ordersQueryStr = ordersParams.toString();
  const { data: ordersResponse } = useQuery<{ success: boolean; data: Order[]; pagination: { total: number } }>({
    queryKey: ["/api/admin/financial/orders", statusFilter, productTypeFilter, paymentStatusFilter, searchQuery],
    queryFn: async () => {
      const url = `/api/admin/financial/orders${ordersQueryStr ? `?${ordersQueryStr}` : ""}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error(`Failed to fetch orders: ${res.status}`);
      return res.json();
    },
    enabled: activeTab === "orders",
  });

  // Fetch Cashfree transactions
  const cashfreeQueryStr = statusFilter !== "all" ? `?status=${statusFilter}` : "";
  const { data: cashfreeResponse } = useQuery<{ success: boolean; data: Transaction[] }>({
    queryKey: ["/api/admin/financial/cashfree-transactions", statusFilter],
    queryFn: async () => {
      const res = await fetch(`/api/admin/financial/cashfree-transactions${cashfreeQueryStr}`, { credentials: "include" });
      if (!res.ok) throw new Error(`Failed to fetch cashfree transactions: ${res.status}`);
      return res.json();
    },
    enabled: activeTab === "transactions",
  });

  // Fetch PhonePe transactions
  const phonePeQueryStr = statusFilter !== "all" ? `?state=${statusFilter}` : "";
  const { data: phonePeResponse } = useQuery<{ success: boolean; data: Transaction[] }>({
    queryKey: ["/api/admin/financial/phonepe-transactions", statusFilter],
    queryFn: async () => {
      const res = await fetch(`/api/admin/financial/phonepe-transactions${phonePeQueryStr}`, { credentials: "include" });
      if (!res.ok) throw new Error(`Failed to fetch PhonePe transactions: ${res.status}`);
      return res.json();
    },
    enabled: activeTab === "transactions",
  });

  // Fetch payment reconciliation
  const { data: reconciliationResponse } = useQuery<{ success: boolean; data: any }>({
    queryKey: ["/api/admin/financial/payment-reconciliation"],
    enabled: activeTab === "reconciliation",
  });

  // Fetch revenue analytics
  const { data: revenueResponse } = useQuery<{ success: boolean; data: any }>({
    queryKey: ["/api/admin/financial/revenue-analytics"],
    enabled: activeTab === "revenue",
  });

  // Fetch refunds
  const refundsQueryStr = statusFilter !== "all" ? `?status=${statusFilter}` : "";
  const { data: refundsResponse } = useQuery<{ success: boolean; data: Refund[] }>({
    queryKey: ["/api/admin/financial/refunds", statusFilter],
    queryFn: async () => {
      const res = await fetch(`/api/admin/financial/refunds${refundsQueryStr}`, { credentials: "include" });
      if (!res.ok) throw new Error(`Failed to fetch refunds: ${res.status}`);
      return res.json();
    },
    enabled: activeTab === "refunds",
  });

  // View order details mutation
  const viewOrderDetailsMutation = useMutation({
    mutationFn: async (orderId: string) => {
      return await apiRequest(`/api/admin/financial/orders/${orderId}`);
    },
    onSuccess: (data) => {
      setSelectedOrder(data.data);
      setOrderDetailsOpen(true);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to load order details",
        variant: "destructive",
      });
    },
  });

  // Initiate refund mutation
  const initiateRefundMutation = useMutation({
    mutationFn: async ({ orderId, amount, reason }: any) => {
      return await apiRequest("/api/admin/financial/refunds/initiate", {
        method: "POST",
        body: JSON.stringify({ orderId, amount, reason }),
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Refund initiated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/financial/refunds"] });
      setRefundDialogOpen(false);
      setRefundOrder(null);
      refundForm.reset();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to initiate refund",
        variant: "destructive",
      });
    },
  });

  const onSubmitRefund = (values: z.infer<typeof refundFormSchema>) => {
    if (refundOrder) {
      initiateRefundMutation.mutate({
        orderId: refundOrder.id,
        amount: values.amount,
        reason: values.reason,
      });
    }
  };

  const orders = ordersResponse?.data || [];
  const cashfreeTransactions = cashfreeResponse?.data || [];
  const phonePeTransactions = phonePeResponse?.data || [];
  const reconciliation = reconciliationResponse?.data;
  const revenue = revenueResponse?.data;
  const refunds = refundsResponse?.data || [];

  const formatCurrency = (amount: string | number | undefined | null) => {
    if (amount === undefined || amount === null) return '₹0.00';
    return `₹${parseFloat(amount.toString()).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-IN');
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      pending: "outline",
      processing: "secondary",
      completed: "default",
      failed: "destructive",
      SUCCESS: "default",
      COMPLETED: "default",
      FAILED: "destructive",
      PENDING: "outline",
    };
    return <Badge variant={variants[status] || "outline"}>{status}</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold" data-testid="heading-financial-operations">Financial Operations</h1>
        <p className="text-muted-foreground">Manage orders, payments, revenue, and refunds</p>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} data-testid="tabs-financial">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="dashboard" data-testid="tab-dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="orders" data-testid="tab-orders">Orders</TabsTrigger>
          <TabsTrigger value="transactions" data-testid="tab-transactions">Transactions</TabsTrigger>
          <TabsTrigger value="reconciliation" data-testid="tab-reconciliation">Reconciliation</TabsTrigger>
          <TabsTrigger value="revenue" data-testid="tab-revenue">Revenue Analytics</TabsTrigger>
          <TabsTrigger value="refunds" data-testid="tab-refunds">Refunds</TabsTrigger>
        </TabsList>

        {/* Dashboard Tab */}
        <TabsContent value="dashboard" className="space-y-6">
          {dashboard && (
            <>
              {/* Stats Cards */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
                    <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold" data-testid="text-total-orders">{dashboard.totalOrders}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Pending Orders</CardTitle>
                    <RefreshCw className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold" data-testid="text-pending-orders">{dashboard.pendingOrders}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold" data-testid="text-total-revenue">{formatCurrency(dashboard.totalRevenue)}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Today's Revenue</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold" data-testid="text-today-revenue">{formatCurrency(dashboard.todayRevenue)}</div>
                  </CardContent>
                </Card>
              </div>

              {/* Orders by Status */}
              <Card>
                <CardHeader>
                  <CardTitle>Orders by Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-4">
                    {dashboard.ordersByStatus.map((item) => (
                      <div 
                        key={item.status} 
                        className="flex items-center justify-between p-4 border rounded-lg"
                        data-testid={`text-orders-status-${item.status}`}
                      >
                        <span className="capitalize">{item.status}</span>
                        <Badge variant="outline">{item.count}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Orders by Product Type */}
              <Card>
                <CardHeader>
                  <CardTitle>Revenue by Product Type</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {dashboard.ordersByProductType.map((item) => (
                      <div 
                        key={item.productType} 
                        className="flex items-center justify-between p-4 border rounded-lg"
                        data-testid={`text-orders-product-${item.productType}`}
                      >
                        <div>
                          <p className="font-medium capitalize">{item.productType}</p>
                          <p className="text-sm text-muted-foreground">{item.count} orders</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold">{formatCurrency(item.revenue)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Recent Orders */}
              <Card>
                <CardHeader>
                  <CardTitle>Recent Orders</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Order #</TableHead>
                        <TableHead>Product Type</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Payment</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dashboard.recentOrders.map((order) => (
                        <TableRow key={order.id}>
                          <TableCell className="font-medium">{order.orderNumber}</TableCell>
                          <TableCell className="capitalize">{order.productType}</TableCell>
                          <TableCell>{formatCurrency(order.amount)}</TableCell>
                          <TableCell>{getStatusBadge(order.status)}</TableCell>
                          <TableCell>{getStatusBadge(order.paymentStatus)}</TableCell>
                          <TableCell>{formatDate(order.createdAt)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* Orders Tab */}
        <TabsContent value="orders" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle>Filters</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-4">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by order number or user ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                    data-testid="input-search-orders"
                  />
                </div>

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger data-testid="select-status-filter">
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="processing">Processing</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={productTypeFilter} onValueChange={setProductTypeFilter}>
                  <SelectTrigger data-testid="select-product-filter">
                    <SelectValue placeholder="All Products" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Products</SelectItem>
                    <SelectItem value="stock">Stocks</SelectItem>
                    <SelectItem value="mutual_fund">Mutual Funds</SelectItem>
                    <SelectItem value="bond">Bonds</SelectItem>
                    <SelectItem value="ipo">IPOs</SelectItem>
                    <SelectItem value="aif">AIFs</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={paymentStatusFilter} onValueChange={setPaymentStatusFilter}>
                  <SelectTrigger data-testid="select-payment-filter">
                    <SelectValue placeholder="Payment Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Payments</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                    <SelectItem value="refunded">Refunded</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Orders Table */}
          <Card>
            <CardHeader>
              <CardTitle>Orders ({ordersResponse?.pagination?.total || 0})</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order #</TableHead>
                    <TableHead>User ID</TableHead>
                    <TableHead>Product Type</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>Gateway</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-muted-foreground">
                        No orders found
                      </TableCell>
                    </TableRow>
                  ) : (
                    orders.map((order) => (
                      <TableRow key={order.id} data-testid={`row-order-${order.id}`}>
                        <TableCell className="font-medium">{order.orderNumber}</TableCell>
                        <TableCell>{order.userId}</TableCell>
                        <TableCell className="capitalize">{order.productType}</TableCell>
                        <TableCell>{formatCurrency(order.amount)}</TableCell>
                        <TableCell>{getStatusBadge(order.status)}</TableCell>
                        <TableCell>{getStatusBadge(order.paymentStatus)}</TableCell>
                        <TableCell className="capitalize">{order.paymentGateway || '-'}</TableCell>
                        <TableCell>{formatDate(order.createdAt)}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => viewOrderDetailsMutation.mutate(order.id)}
                              data-testid={`button-view-${order.id}`}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {order.paymentStatus === 'completed' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setRefundOrder(order);
                                  refundForm.reset({
                                    amount: order.amount,
                                    reason: "",
                                  });
                                  setRefundDialogOpen(true);
                                }}
                                data-testid={`button-refund-${order.id}`}
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Transactions Tab */}
        <TabsContent value="transactions" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Cashfree Transactions */}
            <Card>
              <CardHeader>
                <CardTitle>Cashfree Transactions</CardTitle>
                <CardDescription>{cashfreeTransactions.length} transactions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 max-h-[500px] overflow-y-auto">
                  {cashfreeTransactions.map((txn) => (
                    <div 
                      key={txn.id} 
                      className="flex items-center justify-between p-4 border rounded-lg"
                      data-testid={`card-transaction-cashfree-${txn.id}`}
                    >
                      <div>
                        <p className="font-medium">{formatCurrency(txn.amount)}</p>
                        <p className="text-sm text-muted-foreground">{formatDate(txn.createdAt)}</p>
                      </div>
                      {getStatusBadge(txn.status || 'PENDING')}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* PhonePe Transactions */}
            <Card>
              <CardHeader>
                <CardTitle>PhonePe Transactions</CardTitle>
                <CardDescription>{phonePeTransactions.length} transactions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 max-h-[500px] overflow-y-auto">
                  {phonePeTransactions.map((txn) => (
                    <div 
                      key={txn.id} 
                      className="flex items-center justify-between p-4 border rounded-lg"
                      data-testid={`card-transaction-phonepe-${txn.id}`}
                    >
                      <div>
                        <p className="font-medium">{formatCurrency(txn.amount)}</p>
                        <p className="text-sm text-muted-foreground">{formatDate(txn.createdAt)}</p>
                      </div>
                      {getStatusBadge(txn.state || 'PENDING')}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Reconciliation Tab */}
        <TabsContent value="reconciliation" className="space-y-4">
          {reconciliation && (
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle>Cashfree Total</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-cashfree-total">{formatCurrency(reconciliation.cashfreeTotal)}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>PhonePe Total</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-phonepe-total">{formatCurrency(reconciliation.phonePeTotal)}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Total Collected</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-total-collected">{formatCurrency(reconciliation.totalCollected)}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Successful Payments</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600" data-testid="text-successful-payments">{reconciliation.successfulPayments}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Failed Payments</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600" data-testid="text-failed-payments">{reconciliation.failedPayments}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Pending Payments</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-yellow-600" data-testid="text-pending-payments">{reconciliation.pendingPayments}</div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* Revenue Analytics Tab */}
        <TabsContent value="revenue" className="space-y-4">
          {revenue && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Total Revenue</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold" data-testid="text-revenue-total">{formatCurrency(revenue.totalRevenue)}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Revenue by Product Type</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {revenue.revenueByProductType?.map((item: any) => (
                      <div 
                        key={item.productType} 
                        className="flex items-center justify-between p-4 border rounded-lg"
                        data-testid={`text-revenue-product-${item.productType}`}
                      >
                        <div>
                          <p className="font-medium capitalize">{item.productType}</p>
                          <p className="text-sm text-muted-foreground">{item.orders} orders</p>
                        </div>
                        <p className="font-bold">{formatCurrency(item.revenue)}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Revenue by Payment Gateway</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {revenue.revenueByGateway?.map((item: any) => (
                      <div 
                        key={item.gateway} 
                        className="flex items-center justify-between p-4 border rounded-lg"
                        data-testid={`text-revenue-gateway-${item.gateway || 'unknown'}`}
                      >
                        <div>
                          <p className="font-medium capitalize">{item.gateway || 'Unknown'}</p>
                          <p className="text-sm text-muted-foreground">{item.transactions} transactions</p>
                        </div>
                        <p className="font-bold">{formatCurrency(item.revenue)}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* Refunds Tab */}
        <TabsContent value="refunds" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Refunds</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order ID</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Initiated By</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {refunds.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        No refunds found
                      </TableCell>
                    </TableRow>
                  ) : (
                    refunds.map((refund) => (
                      <TableRow key={refund.id} data-testid={`row-refund-${refund.id}`}>
                        <TableCell className="font-medium">{refund.orderId}</TableCell>
                        <TableCell>{formatCurrency(refund.amount)}</TableCell>
                        <TableCell>{refund.reason}</TableCell>
                        <TableCell>{getStatusBadge(refund.status)}</TableCell>
                        <TableCell>{refund.initiatedBy}</TableCell>
                        <TableCell>{formatDate(refund.createdAt)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Order Details Dialog */}
      <Dialog open={orderDetailsOpen} onOpenChange={setOrderDetailsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Order Details</DialogTitle>
            <DialogDescription>
              Complete information about the order
            </DialogDescription>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Order Number</Label>
                  <p className="font-medium">{selectedOrder.orderNumber}</p>
                </div>
                <div>
                  <Label>User ID</Label>
                  <p className="font-medium">{selectedOrder.userId}</p>
                </div>
                <div>
                  <Label>Product Type</Label>
                  <p className="font-medium capitalize">{selectedOrder.productType}</p>
                </div>
                <div>
                  <Label>Total Amount</Label>
                  <p className="font-medium">{formatCurrency(selectedOrder.amount)}</p>
                </div>
                <div>
                  <Label>Status</Label>
                  <div>{getStatusBadge(selectedOrder.status)}</div>
                </div>
                <div>
                  <Label>Payment Status</Label>
                  <div>{getStatusBadge(selectedOrder.paymentStatus)}</div>
                </div>
                <div>
                  <Label>Payment Gateway</Label>
                  <p className="font-medium capitalize">{selectedOrder.paymentGateway || 'N/A'}</p>
                </div>
                <div>
                  <Label>Created At</Label>
                  <p className="font-medium">{formatDate(selectedOrder.createdAt)}</p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Refund Dialog */}
      <Dialog open={refundDialogOpen} onOpenChange={setRefundDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Initiate Refund</DialogTitle>
            <DialogDescription>
              Process a refund for order {refundOrder?.orderNumber}
            </DialogDescription>
          </DialogHeader>
          <Form {...refundForm}>
            <form onSubmit={refundForm.handleSubmit(onSubmitRefund)} className="space-y-4">
              <FormField
                control={refundForm.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Refund Amount</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="Enter refund amount"
                        data-testid="input-refund-amount"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={refundForm.control}
                name="reason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reason</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Enter refund reason (minimum 10 characters)"
                        data-testid="textarea-refund-reason"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setRefundDialogOpen(false)} 
                  data-testid="button-cancel-refund"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={initiateRefundMutation.isPending}
                  data-testid="button-submit-refund"
                >
                  {initiateRefundMutation.isPending ? "Processing..." : "Initiate Refund"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
