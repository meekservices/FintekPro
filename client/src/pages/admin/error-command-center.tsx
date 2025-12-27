import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AdminLayout } from "@/components/layout/admin-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  AlertTriangle, AlertCircle, CheckCircle, Clock, Search, Filter, RefreshCw, 
  Eye, ExternalLink, ChevronRight, Bug, Shield, Zap, Server, Database, 
  Globe, Smartphone, Users, TrendingUp, BarChart3, Activity
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format, formatDistanceToNow } from "date-fns";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from "recharts";

interface ErrorEntry {
  id: string;
  errorCode: string;
  severity: string;
  source: string;
  module: string;
  message: string;
  stackTrace?: string;
  clientId?: string;
  agentId?: string;
  panMasked?: string;
  transactionId?: string;
  sentryEventId?: string;
  status: string;
  occurrenceCount: number;
  firstOccurrence: string;
  lastOccurrence: string;
  createdAt: string;
  resolvedBy?: string;
  resolutionNote?: string;
}

interface ErrorMetrics {
  totalErrors: number;
  bySeverity: Record<string, number>;
  byModule: Record<string, number>;
  byStatus: Record<string, number>;
  topErrorCodes: Array<{ errorCode: string; count: number }>;
  recentTrend: Array<{ date: string; count: number }>;
  clientImpactScore: number;
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: "bg-red-500",
  error: "bg-orange-500",
  warning: "bg-yellow-500",
  info: "bg-blue-500"
};

const SEVERITY_BADGES: Record<string, string> = {
  critical: "destructive",
  error: "destructive",
  warning: "secondary",
  info: "outline"
};

const STATUS_BADGES: Record<string, string> = {
  open: "destructive",
  acknowledged: "secondary",
  in_progress: "secondary",
  resolved: "outline",
  ignored: "outline"
};

const CHART_COLORS = ['#ef4444', '#f97316', '#eab308', '#3b82f6', '#22c55e', '#8b5cf6'];

export default function ErrorCommandCenter() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [selectedError, setSelectedError] = useState<ErrorEntry | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [resolveOpen, setResolveOpen] = useState(false);
  const [resolutionNote, setResolutionNote] = useState("");
  
  const [filters, setFilters] = useState({
    severity: "all",
    status: "all",
    module: "all",
    search: "",
  });

  const buildErrorsQueryString = () => {
    const params = new URLSearchParams();
    if (filters.severity !== 'all') params.append('severity', filters.severity);
    if (filters.status !== 'all') params.append('status', filters.status);
    if (filters.module !== 'all') params.append('module', filters.module);
    if (filters.search) params.append('search', filters.search);
    const queryString = params.toString();
    return queryString ? `/api/errors?${queryString}` : '/api/errors';
  };

  const { data: errorsData, isLoading: errorsLoading, refetch: refetchErrors } = useQuery<{ errors: ErrorEntry[]; total: number }>({
    queryKey: ['/api/errors', filters.severity, filters.status, filters.module, filters.search],
    queryFn: async () => {
      const response = await fetch(buildErrorsQueryString());
      if (!response.ok) throw new Error('Failed to fetch errors');
      return response.json();
    },
    refetchInterval: 30000,
  });

  const { data: metrics, isLoading: metricsLoading } = useQuery<ErrorMetrics>({
    queryKey: ['/api/errors/metrics'],
    refetchInterval: 60000,
  });

  const { data: criticalErrors } = useQuery<ErrorEntry[]>({
    queryKey: ['/api/errors/critical'],
    refetchInterval: 15000,
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, resolutionNote }: { id: string; status: string; resolutionNote?: string }) => {
      return apiRequest(`/api/errors/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status, resolutionNote }),
        headers: { 'Content-Type': 'application/json' }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/errors'] });
      queryClient.invalidateQueries({ queryKey: ['/api/errors/metrics'] });
      queryClient.invalidateQueries({ queryKey: ['/api/errors/critical'] });
      toast({ title: "Status updated", description: "Error status has been updated successfully." });
      setResolveOpen(false);
      setResolutionNote("");
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update status.", variant: "destructive" });
    }
  });

  const handleStatusChange = (error: ErrorEntry, newStatus: string) => {
    if (newStatus === 'resolved') {
      setSelectedError(error);
      setResolveOpen(true);
    } else {
      updateStatusMutation.mutate({ id: error.id, status: newStatus });
    }
  };

  const handleResolve = () => {
    if (selectedError) {
      updateStatusMutation.mutate({ 
        id: selectedError.id, 
        status: 'resolved', 
        resolutionNote 
      });
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'error': return <AlertCircle className="h-4 w-4 text-orange-500" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default: return <AlertCircle className="h-4 w-4 text-blue-500" />;
    }
  };

  const moduleChartData = metrics?.byModule 
    ? Object.entries(metrics.byModule).map(([name, value]) => ({ name, value }))
    : [];

  const severityChartData = metrics?.bySeverity
    ? Object.entries(metrics.bySeverity).map(([name, value]) => ({ name, value }))
    : [];

  return (
    <AdminLayout>
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight" data-testid="text-page-title">Error Command Center</h1>
            <p className="text-muted-foreground">Real-time error monitoring and resolution dashboard</p>
          </div>
          <Button onClick={() => refetchErrors()} variant="outline" data-testid="button-refresh">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        {(criticalErrors?.length ?? 0) > 0 && (
          <Card className="border-red-500 bg-red-50 dark:bg-red-950/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-red-600 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Critical Errors Requiring Attention
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {criticalErrors?.slice(0, 3).map(error => (
                  <div 
                    key={error.id} 
                    className="flex items-center justify-between p-3 bg-white dark:bg-gray-900 rounded-lg border border-red-200"
                  >
                    <div className="flex items-center gap-3">
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                      <div>
                        <p className="font-medium text-sm">{error.errorCode}</p>
                        <p className="text-xs text-muted-foreground truncate max-w-md">{error.message}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="destructive">{error.occurrenceCount}x</Badge>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => { setSelectedError(error); setDetailsOpen(true); }}
                        data-testid={`button-view-${error.id}`}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <ScrollableTabsList>
            <TabsTrigger value="dashboard" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="errors" className="gap-2">
              <Bug className="h-4 w-4" />
              Error Log
            </TabsTrigger>
            <TabsTrigger value="analytics" className="gap-2">
              <TrendingUp className="h-4 w-4" />
              Analytics
            </TabsTrigger>
          </ScrollableTabsList>

          <TabsContent value="dashboard" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Errors</CardTitle>
                  <Bug className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  {metricsLoading ? (
                    <Skeleton className="h-8 w-24" />
                  ) : (
                    <div className="text-2xl font-bold">{metrics?.totalErrors || 0}</div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Critical</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                </CardHeader>
                <CardContent>
                  {metricsLoading ? (
                    <Skeleton className="h-8 w-24" />
                  ) : (
                    <div className="text-2xl font-bold text-red-500">
                      {metrics?.bySeverity?.critical || 0}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Open Issues</CardTitle>
                  <Clock className="h-4 w-4 text-orange-500" />
                </CardHeader>
                <CardContent>
                  {metricsLoading ? (
                    <Skeleton className="h-8 w-24" />
                  ) : (
                    <div className="text-2xl font-bold text-orange-500">
                      {metrics?.byStatus?.open || 0}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Client Impact</CardTitle>
                  <Users className="h-4 w-4 text-purple-500" />
                </CardHeader>
                <CardContent>
                  {metricsLoading ? (
                    <Skeleton className="h-8 w-24" />
                  ) : (
                    <div className="text-2xl font-bold text-purple-500">
                      {metrics?.clientImpactScore || 0}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">Unique clients affected</p>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Errors by Module</CardTitle>
                  <CardDescription>Distribution across application modules</CardDescription>
                </CardHeader>
                <CardContent className="h-[300px]">
                  {metricsLoading ? (
                    <Skeleton className="h-full w-full" />
                  ) : moduleChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={moduleChartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="value" fill="#3b82f6" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      No data available
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Errors by Severity</CardTitle>
                  <CardDescription>Severity level distribution</CardDescription>
                </CardHeader>
                <CardContent className="h-[300px]">
                  {metricsLoading ? (
                    <Skeleton className="h-full w-full" />
                  ) : severityChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={severityChartData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        >
                          {severityChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      No data available
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Top Recurring Errors</CardTitle>
                <CardDescription>Most frequent error codes in the system</CardDescription>
              </CardHeader>
              <CardContent>
                {metricsLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3, 4, 5].map(i => (
                      <Skeleton key={i} className="h-10 w-full" />
                    ))}
                  </div>
                ) : (metrics?.topErrorCodes?.length ?? 0) > 0 ? (
                  <div className="space-y-2">
                    {metrics?.topErrorCodes?.map((item, index) => (
                      <div 
                        key={item.errorCode} 
                        className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-lg font-bold text-muted-foreground">#{index + 1}</span>
                          <span className="font-mono text-sm">{item.errorCode}</span>
                        </div>
                        <Badge variant="secondary">{item.count} occurrences</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No recurring errors found
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="errors" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <CardTitle>Error Log</CardTitle>
                    <CardDescription>
                      {errorsData?.total || 0} errors found
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <div className="relative">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search errors..."
                        className="pl-8 w-[200px]"
                        value={filters.search}
                        onChange={(e) => setFilters(f => ({ ...f, search: e.target.value }))}
                        data-testid="input-search"
                      />
                    </div>
                    <Select 
                      value={filters.severity} 
                      onValueChange={(v) => setFilters(f => ({ ...f, severity: v }))}
                    >
                      <SelectTrigger className="w-[130px]" data-testid="select-severity">
                        <SelectValue placeholder="Severity" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Severity</SelectItem>
                        <SelectItem value="critical">Critical</SelectItem>
                        <SelectItem value="error">Error</SelectItem>
                        <SelectItem value="warning">Warning</SelectItem>
                        <SelectItem value="info">Info</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select 
                      value={filters.status} 
                      onValueChange={(v) => setFilters(f => ({ ...f, status: v }))}
                    >
                      <SelectTrigger className="w-[130px]" data-testid="select-status">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="acknowledged">Acknowledged</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="resolved">Resolved</SelectItem>
                        <SelectItem value="ignored">Ignored</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {errorsLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3, 4, 5].map(i => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                ) : (errorsData?.errors?.length ?? 0) > 0 ? (
                  <ScrollArea className="h-[500px]">
                    <div className="space-y-2">
                      {errorsData?.errors?.map(error => (
                        <div 
                          key={error.id}
                          className="flex items-start justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                          data-testid={`error-row-${error.id}`}
                        >
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            {getSeverityIcon(error.severity)}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono text-sm font-medium">{error.errorCode}</span>
                                <Badge variant={SEVERITY_BADGES[error.severity] as any} className="text-xs">
                                  {error.severity}
                                </Badge>
                                <Badge variant={STATUS_BADGES[error.status] as any} className="text-xs">
                                  {error.status}
                                </Badge>
                                <Badge variant="outline" className="text-xs">{error.module}</Badge>
                              </div>
                              <p className="text-sm text-muted-foreground mt-1 truncate">{error.message}</p>
                              <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                                <span>Source: {error.source}</span>
                                <span>{error.occurrenceCount}x</span>
                                <span>Last: {formatDistanceToNow(new Date(error.lastOccurrence), { addSuffix: true })}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 ml-4">
                            <Select 
                              value={error.status}
                              onValueChange={(v) => handleStatusChange(error, v)}
                            >
                              <SelectTrigger className="w-[120px] h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="open">Open</SelectItem>
                                <SelectItem value="acknowledged">Acknowledge</SelectItem>
                                <SelectItem value="in_progress">In Progress</SelectItem>
                                <SelectItem value="resolved">Resolve</SelectItem>
                                <SelectItem value="ignored">Ignore</SelectItem>
                              </SelectContent>
                            </Select>
                            <Button 
                              size="sm" 
                              variant="ghost"
                              onClick={() => { setSelectedError(error); setDetailsOpen(true); }}
                              data-testid={`button-details-${error.id}`}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {error.sentryEventId && (
                              <Button size="sm" variant="ghost" asChild>
                                <a 
                                  href={`https://sentry.io/issues/?query=${error.sentryEventId}`} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                >
                                  <ExternalLink className="h-4 w-4" />
                                </a>
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
                    <p className="text-lg font-medium">No errors found</p>
                    <p className="text-sm">Your application is running smoothly</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Error Trends</CardTitle>
                <CardDescription>Errors over the last 7 days</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px]">
                {metricsLoading ? (
                  <Skeleton className="h-full w-full" />
                ) : (metrics?.recentTrend?.length ?? 0) > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={metrics?.recentTrend}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="count" fill="#6366f1" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    No trend data available
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Error Details</DialogTitle>
              <DialogDescription>
                {selectedError?.errorCode}
              </DialogDescription>
            </DialogHeader>
            {selectedError && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Severity</label>
                    <div className="flex items-center gap-2 mt-1">
                      {getSeverityIcon(selectedError.severity)}
                      <Badge variant={SEVERITY_BADGES[selectedError.severity] as any}>
                        {selectedError.severity}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Status</label>
                    <div className="mt-1">
                      <Badge variant={STATUS_BADGES[selectedError.status] as any}>
                        {selectedError.status}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Module</label>
                    <p className="mt-1 font-mono text-sm">{selectedError.module}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Source</label>
                    <p className="mt-1 font-mono text-sm">{selectedError.source}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Occurrences</label>
                    <p className="mt-1 font-mono text-sm">{selectedError.occurrenceCount}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">First Seen</label>
                    <p className="mt-1 text-sm">{format(new Date(selectedError.firstOccurrence), 'PPpp')}</p>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-muted-foreground">Message</label>
                  <p className="mt-1 p-3 bg-muted rounded-lg text-sm">{selectedError.message}</p>
                </div>

                {selectedError.stackTrace && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Stack Trace</label>
                    <pre className="mt-1 p-3 bg-muted rounded-lg text-xs overflow-x-auto max-h-48">
                      {selectedError.stackTrace}
                    </pre>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  {selectedError.clientId && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Client ID</label>
                      <p className="mt-1 font-mono text-sm">{selectedError.clientId}</p>
                    </div>
                  )}
                  {selectedError.transactionId && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Transaction ID</label>
                      <p className="mt-1 font-mono text-sm">{selectedError.transactionId}</p>
                    </div>
                  )}
                  {selectedError.panMasked && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">PAN (Masked)</label>
                      <p className="mt-1 font-mono text-sm">{selectedError.panMasked}</p>
                    </div>
                  )}
                  {selectedError.sentryEventId && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Sentry Event ID</label>
                      <p className="mt-1 font-mono text-sm">{selectedError.sentryEventId}</p>
                    </div>
                  )}
                </div>

                {selectedError.resolutionNote && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Resolution Note</label>
                    <p className="mt-1 p-3 bg-green-50 dark:bg-green-950/20 rounded-lg text-sm">
                      {selectedError.resolutionNote}
                    </p>
                  </div>
                )}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setDetailsOpen(false)}>Close</Button>
              {selectedError?.status !== 'resolved' && (
                <Button onClick={() => { setDetailsOpen(false); setResolveOpen(true); }}>
                  Mark as Resolved
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={resolveOpen} onOpenChange={setResolveOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Resolve Error</DialogTitle>
              <DialogDescription>
                Add a resolution note for this error
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Error</label>
                <p className="text-sm text-muted-foreground">{selectedError?.errorCode}</p>
              </div>
              <div>
                <label className="text-sm font-medium">Resolution Note</label>
                <Textarea
                  placeholder="Describe how this error was resolved..."
                  value={resolutionNote}
                  onChange={(e) => setResolutionNote(e.target.value)}
                  rows={4}
                  className="mt-1"
                  data-testid="input-resolution-note"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setResolveOpen(false); setResolutionNote(""); }}>
                Cancel
              </Button>
              <Button 
                onClick={handleResolve}
                disabled={updateStatusMutation.isPending}
                data-testid="button-confirm-resolve"
              >
                {updateStatusMutation.isPending ? "Resolving..." : "Resolve"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
