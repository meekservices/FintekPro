import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown,
  PieChart as PieChartIcon,
  BarChart3,
  Calendar,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  IndianRupee,
  Briefcase,
  Users,
  FileText,
  Landmark,
  Building2
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line
} from "recharts";

interface RevenueMetrics {
  totalRevenue: number;
  monthlyRevenue: number;
  weeklyRevenue: number;
  dailyRevenue: number;
  growthPercent: number;
  projectedMonthly: number;
}

interface CommissionBreakdown {
  category: string;
  amount: number;
  count: number;
  percentage: number;
}

interface ProductRevenue {
  product: string;
  revenue: number;
  transactions: number;
  avgValue: number;
}

interface MonthlyTrend {
  month: string;
  revenue: number;
  commissions: number;
  netRevenue: number;
}

interface RevenueAnalyticsData {
  metrics: RevenueMetrics;
  commissions: CommissionBreakdown[];
  productRevenue: ProductRevenue[];
  monthlyTrends: MonthlyTrend[];
  topPerformers: { name: string; revenue: number; growth: number }[];
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'];

function formatCurrency(amount: number): string {
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)} Cr`;
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(2)} L`;
  if (amount >= 1000) return `₹${(amount / 1000).toFixed(1)}K`;
  return `₹${amount.toFixed(0)}`;
}

function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-IN').format(num);
}

export default function RevenueAnalytics() {
  const [period, setPeriod] = useState<string>("30");
  
  const { data, isLoading, refetch, isFetching } = useQuery<RevenueAnalyticsData>({
    queryKey: ["/api/admin/revenue-analytics", period],
    queryFn: async () => {
      const response = await fetch(`/api/admin/revenue-analytics?period=${period}`, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch revenue analytics");
      return response.json();
    },
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-10 w-48" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  const metrics = data?.metrics || {
    totalRevenue: 0,
    monthlyRevenue: 0,
    weeklyRevenue: 0,
    dailyRevenue: 0,
    growthPercent: 0,
    projectedMonthly: 0
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Revenue Analytics</h1>
          <p className="text-sm text-muted-foreground">
            Commission tracking, revenue trends, and financial insights
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[140px]" data-testid="select-period">
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="365">Last year</SelectItem>
            </SelectContent>
          </Select>
          <Button 
            onClick={() => refetch()} 
            disabled={isFetching}
            variant="outline"
            data-testid="button-refresh"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <IndianRupee className="w-4 h-4 text-emerald-600" />
              Total Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-emerald-600" data-testid="text-total-revenue">
              {formatCurrency(metrics.totalRevenue)}
            </p>
            <div className="flex items-center gap-1 mt-1">
              {metrics.growthPercent >= 0 ? (
                <>
                  <ArrowUpRight className="w-4 h-4 text-emerald-600" />
                  <span className="text-sm text-emerald-600">+{metrics.growthPercent}%</span>
                </>
              ) : (
                <>
                  <ArrowDownRight className="w-4 h-4 text-red-600" />
                  <span className="text-sm text-red-600">{metrics.growthPercent}%</span>
                </>
              )}
              <span className="text-xs text-muted-foreground">vs last period</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-600" />
              This Month
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-blue-600" data-testid="text-monthly-revenue">
              {formatCurrency(metrics.monthlyRevenue)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Projected: {formatCurrency(metrics.projectedMonthly)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-purple-600" />
              This Week
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-purple-600" data-testid="text-weekly-revenue">
              {formatCurrency(metrics.weeklyRevenue)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Daily avg: {formatCurrency(metrics.weeklyRevenue / 7)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-orange-600" />
              Today
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-orange-600" data-testid="text-daily-revenue">
              {formatCurrency(metrics.dailyRevenue)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {formatNumber(data?.productRevenue?.reduce((a, b) => a + b.transactions, 0) || 0)} transactions
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Revenue Trend
            </CardTitle>
            <CardDescription>Monthly revenue with commissions and net earnings</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={data?.monthlyTrends || []}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={(v) => formatCurrency(v)} tick={{ fontSize: 12 }} />
                <Tooltip 
                  formatter={(value: number) => formatCurrency(value)}
                  labelStyle={{ color: '#333' }}
                />
                <Legend />
                <Area 
                  type="monotone" 
                  dataKey="revenue" 
                  name="Gross Revenue"
                  stroke="#3b82f6" 
                  fill="#3b82f6" 
                  fillOpacity={0.3} 
                />
                <Area 
                  type="monotone" 
                  dataKey="netRevenue" 
                  name="Net Revenue"
                  stroke="#10b981" 
                  fill="#10b981" 
                  fillOpacity={0.3} 
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChartIcon className="w-5 h-5" />
              Commission Breakdown
            </CardTitle>
            <CardDescription>Revenue by commission category</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={data?.commissions || []}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="amount"
                  nameKey="category"
                  label={({ category, percentage }) => `${category}: ${percentage}%`}
                  labelLine={false}
                >
                  {(data?.commissions || []).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="products" className="w-full">
        <TabsList>
          <TabsTrigger value="products" data-testid="tab-products">Product Revenue</TabsTrigger>
          <TabsTrigger value="performers" data-testid="tab-performers">Top Performers</TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Revenue by Product</CardTitle>
              <CardDescription>Detailed breakdown of revenue across product categories</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={data?.productRevenue || []} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis type="number" tickFormatter={(v) => formatCurrency(v)} />
                    <YAxis type="category" dataKey="product" width={120} tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    <Bar dataKey="revenue" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                
                <div className="space-y-3">
                  {(data?.productRevenue || []).map((product, index) => (
                    <div 
                      key={product.product} 
                      className="flex items-center justify-between p-3 border rounded-lg"
                      data-testid={`row-product-${index}`}
                    >
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        <div>
                          <p className="font-medium">{product.product}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatNumber(product.transactions)} transactions
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">{formatCurrency(product.revenue)}</p>
                        <p className="text-xs text-muted-foreground">
                          Avg: {formatCurrency(product.avgValue)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performers" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Top Revenue Performers</CardTitle>
              <CardDescription>Agents and partners driving the most revenue</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {(data?.topPerformers || []).map((performer, index) => (
                  <div 
                    key={performer.name} 
                    className="flex items-center justify-between p-4 border rounded-lg"
                    data-testid={`row-performer-${index}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-foreground font-bold ${
                        index === 0 ? 'bg-yellow-500' : 
                        index === 1 ? 'bg-muted-foreground' : 
                        index === 2 ? 'bg-amber-600' : 'bg-blue-500'
                      }`}>
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium">{performer.name}</p>
                        <Badge variant="outline" className={
                          performer.growth >= 0 ? 'text-emerald-600' : 'text-red-600'
                        }>
                          {performer.growth >= 0 ? '+' : ''}{performer.growth}% growth
                        </Badge>
                      </div>
                    </div>
                    <p className="text-xl font-bold">{formatCurrency(performer.revenue)}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
