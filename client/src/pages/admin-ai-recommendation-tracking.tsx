import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, Legend
} from "recharts";
import { 
  TrendingUp, TrendingDown, Target, AlertCircle, Clock, CheckCircle, XCircle,
  RefreshCw, Download, Filter, BarChart3, PieChart as PieChartIcon, Activity
} from "lucide-react";
import { format } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { AiRecommendationTracking } from "@shared/schema";

const COLORS = ['#22c55e', '#ef4444', '#f59e0b', '#6b7280', '#3b82f6', '#8b5cf6'];

interface SuccessMetrics {
  totalRecommendations: number;
  pendingRecommendations: number;
  resolvedRecommendations: number;
  hitTarget: number;
  missedTarget: number;
  stoppedOut: number;
  expired: number;
  successRate: number;
  averageReturn: number;
  averageConfidence: number;
}

interface SectorMetrics {
  sector: string;
  total: number;
  successRate: number;
  avgReturn: number;
}

interface TimeframeMetrics {
  timeframe: string;
  total: number;
  successRate: number;
  avgReturn: number;
}

interface AssetTypeMetrics {
  assetType: string;
  total: number;
  successRate: number;
  avgReturn: number;
}

interface TrendDataPoint {
  date: string;
  successRate: number;
  totalRecommendations: number;
}

export default function AdminAiRecommendationTracking() {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [assetTypeFilter, setAssetTypeFilter] = useState<string>("all");

  const { data: metrics, isLoading: metricsLoading } = useQuery<SuccessMetrics>({
    queryKey: ["/api/ai-recommendations-tracking/metrics"],
  });

  const { data: recommendations, isLoading: recommendationsLoading } = useQuery<AiRecommendationTracking[]>({
    queryKey: ["/api/ai-recommendations-tracking", statusFilter, assetTypeFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter && statusFilter !== "all") params.append("status", statusFilter);
      if (assetTypeFilter && assetTypeFilter !== "all") params.append("assetType", assetTypeFilter);
      const url = `/api/ai-recommendations-tracking${params.toString() ? `?${params.toString()}` : ""}`;
      const response = await fetch(url, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch recommendations");
      return response.json();
    },
  });

  const { data: sectorMetrics } = useQuery<SectorMetrics[]>({
    queryKey: ["/api/ai-recommendations-tracking/metrics/sector"],
  });

  const { data: timeframeMetrics } = useQuery<TimeframeMetrics[]>({
    queryKey: ["/api/ai-recommendations-tracking/metrics/timeframe"],
  });

  const { data: assetTypeMetrics } = useQuery<AssetTypeMetrics[]>({
    queryKey: ["/api/ai-recommendations-tracking/metrics/asset-type"],
  });

  const { data: trendData } = useQuery<TrendDataPoint[]>({
    queryKey: ["/api/ai-recommendations-tracking/trends"],
  });

  const { data: topPerforming } = useQuery<AiRecommendationTracking[]>({
    queryKey: ["/api/ai-recommendations-tracking/top-performing"],
  });

  const { data: worstPerforming } = useQuery<AiRecommendationTracking[]>({
    queryKey: ["/api/ai-recommendations-tracking/worst-performing"],
  });

  const checkExpiredMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/ai-recommendations-tracking/check-expired");
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Expired Check Complete",
        description: `Updated ${data.expiredCount} expired recommendations`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-recommendations-tracking"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-recommendations-tracking/metrics"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-recommendations-tracking/metrics/sector"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-recommendations-tracking/metrics/timeframe"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-recommendations-tracking/metrics/asset-type"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-recommendations-tracking/trends"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-recommendations-tracking/top-performing"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-recommendations-tracking/worst-performing"] });
    },
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; icon: any }> = {
      pending: { variant: "secondary", icon: Clock },
      hit_target: { variant: "default", icon: CheckCircle },
      missed_target: { variant: "destructive", icon: XCircle },
      stopped_out: { variant: "destructive", icon: AlertCircle },
      expired: { variant: "outline", icon: Clock },
    };
    const config = variants[status] || variants.pending;
    const Icon = config.icon;
    return (
      <Badge variant={config.variant} className="flex items-center gap-1" data-testid={`badge-status-${status}`}>
        <Icon className="h-3 w-3" />
        {(status || 'pending').replace('_', ' ').toUpperCase()}
      </Badge>
    );
  };

  const pieChartData = metrics ? [
    { name: 'Hit Target', value: metrics.hitTarget, color: '#22c55e' },
    { name: 'Missed Target', value: metrics.missedTarget, color: '#ef4444' },
    { name: 'Stopped Out', value: metrics.stoppedOut, color: '#f59e0b' },
    { name: 'Expired', value: metrics.expired, color: '#6b7280' },
    { name: 'Pending', value: metrics.pendingRecommendations, color: '#3b82f6' },
  ].filter(d => d.value > 0) : [];

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="admin-ai-recommendation-tracking-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="page-title">AI Recommendation Tracking</h1>
          <p className="text-muted-foreground">Monitor and analyze AI recommendation success rates</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => checkExpiredMutation.mutate()}
            disabled={checkExpiredMutation.isPending}
            data-testid="button-check-expired"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${checkExpiredMutation.isPending ? 'animate-spin' : ''}`} />
            Check Expired
          </Button>
        </div>
      </div>

      {metricsLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-16 bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card data-testid="card-total-recommendations">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Recommendations</p>
                  <p className="text-3xl font-bold">{metrics?.totalRecommendations ?? 0}</p>
                </div>
                <Activity className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-success-rate">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Success Rate</p>
                  <p className="text-3xl font-bold text-green-600">{metrics?.successRate ?? 0}%</p>
                </div>
                <Target className="h-8 w-8 text-green-600" />
              </div>
              <Progress value={metrics?.successRate ?? 0} className="mt-2" />
            </CardContent>
          </Card>

          <Card data-testid="card-average-return">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Average Return</p>
                  <p className={`text-3xl font-bold ${(metrics?.averageReturn ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {(metrics?.averageReturn ?? 0) >= 0 ? '+' : ''}{metrics?.averageReturn ?? 0}%
                  </p>
                </div>
                {(metrics?.averageReturn ?? 0) >= 0 ? (
                  <TrendingUp className="h-8 w-8 text-green-600" />
                ) : (
                  <TrendingDown className="h-8 w-8 text-red-600" />
                )}
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-pending">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pending</p>
                  <p className="text-3xl font-bold text-blue-600">{metrics?.pendingRecommendations ?? 0}</p>
                </div>
                <Clock className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-avg-confidence">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Avg Confidence</p>
                  <p className="text-3xl font-bold">{metrics?.averageConfidence ?? 0}%</p>
                </div>
                <BarChart3 className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList data-testid="tabs-list">
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="recommendations" data-testid="tab-recommendations">All Recommendations</TabsTrigger>
          <TabsTrigger value="performance" data-testid="tab-performance">Performance</TabsTrigger>
          <TabsTrigger value="analytics" data-testid="tab-analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card data-testid="card-success-trend">
              <CardHeader>
                <CardTitle>Success Rate Trend</CardTitle>
                <CardDescription>Daily success rate over the last 30 days</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={trendData || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tickFormatter={(v) => format(new Date(v), 'MMM d')} />
                    <YAxis unit="%" />
                    <Tooltip 
                      labelFormatter={(v) => format(new Date(v), 'MMM d, yyyy')}
                      formatter={(v: number) => [`${v}%`, 'Success Rate']}
                    />
                    <Line type="monotone" dataKey="successRate" stroke="#22c55e" strokeWidth={2} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card data-testid="card-outcome-distribution">
              <CardHeader>
                <CardTitle>Outcome Distribution</CardTitle>
                <CardDescription>Breakdown of recommendation outcomes</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={pieChartData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {pieChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card data-testid="card-top-performing">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                  Top Performing Recommendations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Symbol</TableHead>
                        <TableHead>Return</TableHead>
                        <TableHead>Type</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {topPerforming?.map((rec) => (
                        <TableRow key={rec.id} data-testid={`row-top-${rec.id}`}>
                          <TableCell className="font-medium">{rec.symbol}</TableCell>
                          <TableCell className="text-green-600 font-bold">+{rec.actualReturn}%</TableCell>
                          <TableCell>
                            <Badge variant="outline">{rec.recommendationType}</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                      {!topPerforming?.length && (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center text-muted-foreground">
                            No data available
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>

            <Card data-testid="card-worst-performing">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingDown className="h-5 w-5 text-red-600" />
                  Worst Performing Recommendations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Symbol</TableHead>
                        <TableHead>Return</TableHead>
                        <TableHead>Type</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {worstPerforming?.map((rec) => (
                        <TableRow key={rec.id} data-testid={`row-worst-${rec.id}`}>
                          <TableCell className="font-medium">{rec.symbol}</TableCell>
                          <TableCell className="text-red-600 font-bold">{rec.actualReturn}%</TableCell>
                          <TableCell>
                            <Badge variant="outline">{rec.recommendationType}</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                      {!worstPerforming?.length && (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center text-muted-foreground">
                            No data available
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="recommendations" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>All Recommendations</CardTitle>
                <div className="flex gap-2">
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[150px]" data-testid="select-status-filter">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="hit_target">Hit Target</SelectItem>
                      <SelectItem value="missed_target">Missed Target</SelectItem>
                      <SelectItem value="stopped_out">Stopped Out</SelectItem>
                      <SelectItem value="expired">Expired</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={assetTypeFilter} onValueChange={setAssetTypeFilter}>
                    <SelectTrigger className="w-[150px]" data-testid="select-asset-filter">
                      <SelectValue placeholder="Asset Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Assets</SelectItem>
                      <SelectItem value="stock">Stock</SelectItem>
                      <SelectItem value="mutual_fund">Mutual Fund</SelectItem>
                      <SelectItem value="bond">Bond</SelectItem>
                      <SelectItem value="unlisted">Unlisted</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Symbol</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Entry</TableHead>
                      <TableHead>Target</TableHead>
                      <TableHead>Current</TableHead>
                      <TableHead>Return</TableHead>
                      <TableHead>Confidence</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recommendationsLoading ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center">Loading...</TableCell>
                      </TableRow>
                    ) : recommendations?.map((rec) => (
                      <TableRow key={rec.id} data-testid={`row-recommendation-${rec.id}`}>
                        <TableCell className="font-medium">
                          <div>
                            <div>{rec.symbol}</div>
                            <div className="text-xs text-muted-foreground">{rec.assetName}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={rec.recommendationType.includes('buy') ? 'default' : 'destructive'}>
                            {rec.recommendationType}
                          </Badge>
                        </TableCell>
                        <TableCell>{rec.entryPrice}</TableCell>
                        <TableCell>{rec.targetPrice}</TableCell>
                        <TableCell>{rec.currentPrice || '-'}</TableCell>
                        <TableCell className={parseFloat(rec.actualReturn || '0') >= 0 ? 'text-green-600' : 'text-red-600'}>
                          {rec.actualReturn ? `${parseFloat(rec.actualReturn) >= 0 ? '+' : ''}${rec.actualReturn}%` : '-'}
                        </TableCell>
                        <TableCell>{rec.confidenceScore}%</TableCell>
                        <TableCell>{getStatusBadge(rec.status || 'pending')}</TableCell>
                        <TableCell className="text-xs">
                          {rec.createdAt ? format(new Date(rec.createdAt), 'MMM d, yyyy') : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                    {!recommendations?.length && !recommendationsLoading && (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center text-muted-foreground">
                          No recommendations found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card data-testid="card-sector-performance">
              <CardHeader>
                <CardTitle>Performance by Sector</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={sectorMetrics || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="sector" />
                    <YAxis unit="%" />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="successRate" fill="#22c55e" name="Success Rate %" />
                    <Bar dataKey="avgReturn" fill="#3b82f6" name="Avg Return %" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card data-testid="card-timeframe-performance">
              <CardHeader>
                <CardTitle>Performance by Timeframe</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={timeframeMetrics || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="timeframe" />
                    <YAxis unit="%" />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="successRate" fill="#22c55e" name="Success Rate %" />
                    <Bar dataKey="avgReturn" fill="#3b82f6" name="Avg Return %" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card data-testid="card-asset-type-performance">
            <CardHeader>
              <CardTitle>Performance by Asset Type</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={assetTypeMetrics || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="assetType" />
                  <YAxis yAxisId="left" unit="%" orientation="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip />
                  <Legend />
                  <Bar yAxisId="left" dataKey="successRate" fill="#22c55e" name="Success Rate %" />
                  <Bar yAxisId="left" dataKey="avgReturn" fill="#3b82f6" name="Avg Return %" />
                  <Bar yAxisId="right" dataKey="total" fill="#6b7280" name="Total Count" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card data-testid="card-hit-vs-miss">
              <CardHeader>
                <CardTitle>Hit vs Miss Ratio</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-center">
                <div className="text-center">
                  <div className="flex items-center gap-4 text-4xl font-bold">
                    <span className="text-green-600">{metrics?.hitTarget || 0}</span>
                    <span className="text-muted-foreground">:</span>
                    <span className="text-red-600">{(metrics?.missedTarget || 0) + (metrics?.stoppedOut || 0)}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">Wins : Losses</p>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-resolution-rate">
              <CardHeader>
                <CardTitle>Resolution Rate</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-center">
                <div className="text-center">
                  <div className="text-4xl font-bold">
                    {metrics && metrics.totalRecommendations > 0 
                      ? Math.round((metrics.resolvedRecommendations / metrics.totalRecommendations) * 100)
                      : 0}%
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    {metrics?.resolvedRecommendations || 0} of {metrics?.totalRecommendations || 0} resolved
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-profit-factor">
              <CardHeader>
                <CardTitle>Risk-Adjusted Performance</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-center">
                <div className="text-center">
                  <div className={`text-4xl font-bold ${(metrics?.averageReturn || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {metrics?.averageReturn || 0}%
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">Average Return per Recommendation</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card data-testid="card-detailed-breakdown">
            <CardHeader>
              <CardTitle>Detailed Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="text-center p-4 bg-green-50 dark:bg-green-950 rounded-lg">
                  <CheckCircle className="h-8 w-8 text-green-600 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-green-600">{metrics?.hitTarget || 0}</div>
                  <p className="text-sm text-muted-foreground">Hit Target</p>
                </div>
                <div className="text-center p-4 bg-red-50 dark:bg-red-950 rounded-lg">
                  <XCircle className="h-8 w-8 text-red-600 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-red-600">{metrics?.missedTarget || 0}</div>
                  <p className="text-sm text-muted-foreground">Missed Target</p>
                </div>
                <div className="text-center p-4 bg-amber-50 dark:bg-amber-950 rounded-lg">
                  <AlertCircle className="h-8 w-8 text-amber-600 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-amber-600">{metrics?.stoppedOut || 0}</div>
                  <p className="text-sm text-muted-foreground">Stopped Out</p>
                </div>
                <div className="text-center p-4 bg-muted rounded-lg">
                  <Clock className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <div className="text-2xl font-bold text-muted-foreground">{metrics?.expired || 0}</div>
                  <p className="text-sm text-muted-foreground">Expired</p>
                </div>
                <div className="text-center p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
                  <Activity className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                  <div className="text-2xl font-bold text-blue-600">{metrics?.pendingRecommendations || 0}</div>
                  <p className="text-sm text-muted-foreground">Pending</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
