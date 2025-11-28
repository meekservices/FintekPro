import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link as RouterLink } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, Users, Activity, TrendingUp, MessageSquare, Settings, Search, Filter, Shield, FileText, Building2, Plus, Edit3, Trash2, Server, Brain, Zap, Lock, Receipt, CheckCircle, Calendar, Download, Loader2, IndianRupee, Clock, Eye, Edit, Send, UserPlus, MoreVertical, ShieldCheck, ShieldAlert, Bot, Monitor, BarChart, Globe, Mail, Target, TrendingDown, Share2, Megaphone, MousePointer, Users2, BarChart3, PieChart, LineChart, Phone, ChevronLeft, ChevronRight, Menu, MessageCircle, Smartphone, Link, UserCheck, Building, Network, ArrowRightLeft, Handshake, Lightbulb, TestTube, AlertCircle, Info, Database, RefreshCw } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { RiskProfileViewer } from "@/components/risk-profiling/risk-profile-viewer";
import { RiskAssessmentForm } from "@/components/risk-profiling/risk-assessment-form";
import { CapitalGainsReportViewer } from "@/components/reports/capital-gains-report-viewer";
import { TransactionReportViewer } from "@/components/reports/transaction-report-viewer";
import CkycManagement from "./admin/ckyc-management";
import SupplierDashboard from "./admin/supplier-dashboard";


// Enhanced API Status Panel Component
function ApiStatusPanel() {
  const { data: apiStatus = {}, isLoading, error, refetch } = useQuery({
    queryKey: ['/api/public/api-status'],
    refetchInterval: 10000,
  });

  const { data: apiKeys = {}, refetch: refetchApiKeys } = useQuery({
    queryKey: ['/api/admin/api-keys'],
    enabled: true
  });

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedApiKey, setSelectedApiKey] = useState<string>('');
  const [keyValue, setKeyValue] = useState('');
  const { toast } = useToast();

  const updateApiKeyMutation = useMutation({
    mutationFn: async ({ keyName, keyValue }: { keyName: string; keyValue: string }) => {
      return await apiRequest('POST', '/api/admin/api-keys', {
        body: JSON.stringify({ keyName, keyValue }),
        headers: { 'Content-Type': 'application/json' }
      });
    },
    onSuccess: () => {
      toast({
        title: "API Key Updated",
        description: "The API key has been updated successfully",
      });
      setEditDialogOpen(false);
      setKeyValue('');
      refetchApiKeys();
      refetch();
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update API key",
        variant: "destructive"
      });
    }
  });

  const handleEditApiKey = (keyName: string) => {
    setSelectedApiKey(keyName);
    setKeyValue('');
    setEditDialogOpen(true);
  };

  const handleSaveApiKey = () => {
    if (!selectedApiKey || !keyValue.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter a valid API key",
        variant: "destructive"
      });
      return;
    }
    updateApiKeyMutation.mutate({ keyName: selectedApiKey, keyValue: keyValue.trim() });
  };

  const getOverallStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'bg-gradient-to-r from-emerald-500 to-green-600 text-white';
      case 'partial':
        return 'bg-gradient-to-r from-blue-500 to-cyan-600 text-white';
      case 'degraded':
        return 'bg-gradient-to-r from-amber-500 to-orange-600 text-white';
      case 'critical':
      case 'error':
        return 'bg-gradient-to-r from-red-500 to-rose-600 text-white';
      default:
        return 'bg-gradient-to-r from-gray-500 to-slate-600 text-white';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'configured':
      case 'available':
        return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400';
      case 'degraded':
        return 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400';
      case 'not_configured':
        return 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400';
      case 'error':
        return 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400';
      default:
        return 'bg-gray-50 text-gray-700 dark:bg-gray-950 dark:text-gray-400';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'configured':
      case 'available':
        return <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />;
      case 'degraded':
        return <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />;
      case 'not_configured':
        return <Settings className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
      case 'error':
        return <ShieldAlert className="w-4 h-4 text-red-600 dark:text-red-400" />;
      default:
        return <Monitor className="w-4 h-4 text-gray-600 dark:text-gray-400" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-900';
      case 'high':
        return 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-400 dark:border-orange-900';
      case 'medium':
        return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-900';
      case 'low':
        return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-900';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-950 dark:text-gray-400 dark:border-gray-900';
    }
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / (24 * 60 * 60));
    const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60));
    const minutes = Math.floor((seconds % (60 * 60)) / 60);
    
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const formatMemory = (bytes: number) => {
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-3 text-muted-foreground">Checking API status...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <ShieldAlert className="w-5 h-5" />
            API Status Monitor - Error
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-destructive">
            <AlertTriangle className="w-8 h-8 mx-auto mb-2" />
            Failed to fetch API status
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overall Status Header */}
      <Card className={`border-0 ${getOverallStatusColor((apiStatus as any)?.overall)}`}>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-3 text-white">
              <Monitor className="w-6 h-6" />
              System Status: {((apiStatus as any)?.overall || 'unknown').toUpperCase()}
            </CardTitle>
            <div className="text-sm text-white/80">
              Last updated: {(apiStatus as any)?.timestamp ? new Date((apiStatus as any).timestamp).toLocaleTimeString() : 'Unknown'}
            </div>
          </div>
          <div className="text-sm text-white/90">
            Comprehensive monitoring of all integrated APIs and system components
          </div>
        </CardHeader>
      </Card>

      {/* Individual API Services Status Grid */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Monitor className="w-6 h-6 text-primary" />
            Individual API Services Monitor ({Object.keys((apiStatus as any)?.apis || {}).length})
          </CardTitle>
          <CardDescription>
            Real-time individual status monitoring with detailed health metrics for each integrated service
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          {/* API Status Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="p-4 bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-950/50 dark:to-green-950/50 rounded-lg border border-emerald-200 dark:border-emerald-900">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-sm font-medium text-emerald-900 dark:text-emerald-100">Healthy</span>
                </div>
                <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  {Object.values((apiStatus as any)?.apis || {}).filter((api: any) => 
                    api.status === 'healthy' || api.status === 'configured' || api.status === 'available'
                  ).length}
                </span>
              </div>
            </div>

            <div className="p-4 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/50 dark:to-orange-950/50 rounded-lg border border-amber-200 dark:border-amber-900">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span className="text-sm font-medium text-amber-900 dark:text-amber-100">Degraded</span>
                </div>
                <span className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                  {Object.values((apiStatus as any)?.apis || {}).filter((api: any) => api.status === 'degraded').length}
                </span>
              </div>
            </div>

            <div className="p-4 bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/50 dark:to-cyan-950/50 rounded-lg border border-blue-200 dark:border-blue-900">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Settings className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span className="text-sm font-medium text-blue-900 dark:text-blue-100">Not Configured</span>
                </div>
                <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {Object.values((apiStatus as any)?.apis || {}).filter((api: any) => api.status === 'not_configured').length}
                </span>
              </div>
            </div>

            <div className="p-4 bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950/50 dark:to-rose-950/50 rounded-lg border border-red-200 dark:border-red-900">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-red-600 dark:text-red-400" />
                  <span className="text-sm font-medium text-red-900 dark:text-red-100">Error</span>
                </div>
                <span className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {Object.values((apiStatus as any)?.apis || {}).filter((api: any) => api.status === 'error').length}
                </span>
              </div>
            </div>
          </div>

          {/* API List */}
          <div className="space-y-3">
            {Object.entries((apiStatus as any)?.apis || {}).map(([apiName, apiData]: [string, any]) => (
              <Card key={apiName} className="border-border/50 hover:border-primary/50 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      {getStatusIcon(apiData.status)}
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-foreground">{apiName}</span>
                          <Badge className={getStatusColor(apiData.status)}>
                            {apiData.status}
                          </Badge>
                        </div>
                        {apiData.message && (
                          <p className="text-sm text-muted-foreground mt-1">{apiData.message}</p>
                        )}
                      </div>
                    </div>
                    {apiData.status === 'not_configured' && (
                      <Button 
                        size="sm"
                        variant="outline"
                        onClick={() => handleEditApiKey(apiName)}
                        data-testid={`button-configure-${apiName}`}
                      >
                        <Settings className="w-4 h-4 mr-2" />
                        Configure
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* System Metrics */}
          {(apiStatus as any)?.metrics && (
            <Card className="mt-6 bg-gradient-to-br from-blue-50/50 to-indigo-50/50 dark:from-blue-950/20 dark:to-indigo-950/20 border-blue-200/50 dark:border-blue-900/50">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Server className="w-5 h-5 text-primary" />
                  System Metrics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-3 bg-background/50 rounded-lg">
                    <div className="text-sm text-muted-foreground">Uptime</div>
                    <div className="text-lg font-semibold text-foreground mt-1">
                      {formatUptime((apiStatus as any).metrics.uptime)}
                    </div>
                  </div>
                  <div className="p-3 bg-background/50 rounded-lg">
                    <div className="text-sm text-muted-foreground">Memory Usage</div>
                    <div className="text-lg font-semibold text-foreground mt-1">
                      {formatMemory((apiStatus as any).metrics.memoryUsage.heapUsed)} / {formatMemory((apiStatus as any).metrics.memoryUsage.heapTotal)}
                    </div>
                  </div>
                  <div className="p-3 bg-background/50 rounded-lg">
                    <div className="text-sm text-muted-foreground">Node Version</div>
                    <div className="text-lg font-semibold text-foreground mt-1">
                      {(apiStatus as any).metrics.nodeVersion}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Alerts Section */}
          {(apiStatus as any)?.alerts && (apiStatus as any).alerts.length > 0 && (
            <Card className="mt-6 border-amber-200 dark:border-amber-900">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2 text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="w-5 h-5" />
                  Active Alerts ({(apiStatus as any).alerts.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {(apiStatus as any).alerts.map((alert: any, index: number) => (
                    <div 
                      key={index} 
                      className={`p-3 rounded-lg border ${getSeverityColor(alert.severity)}`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-medium">{alert.service}</div>
                          <div className="text-sm mt-1">{alert.message}</div>
                        </div>
                        <Badge variant="outline" className={getSeverityColor(alert.severity)}>
                          {alert.severity}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>

      {/* Edit API Key Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configure API Key: {selectedApiKey}</DialogTitle>
            <DialogDescription>
              Enter the API key to configure this service
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="api-key">API Key</Label>
              <Input
                id="api-key"
                type="password"
                value={keyValue}
                onChange={(e) => setKeyValue(e.target.value)}
                placeholder="Enter API key"
                data-testid="input-api-key"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveApiKey} disabled={updateApiKeyMutation.isPending}>
              {updateApiKeyMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// AI Business Intelligence Dashboard Component
function AIBusinessIntelligenceDashboard() {
  const { toast } = useToast();
  const [selectedInsight, setSelectedInsight] = useState<string | null>(null);
  
  // Fetch all AI-powered insights
  const { data: allInsights = [], isLoading: insightsLoading, refetch: refetchInsights } = useQuery<any[]>({
    queryKey: ['/api/admin/business-intelligence/insights'],
    refetchInterval: false, // Don't auto-refresh to save API costs
  });
  
  // Fetch business metrics
  const { data: businessMetrics, isLoading: metricsLoading } = useQuery<any>({
    queryKey: ['/api/admin/business-intelligence/metrics'],
  });

  const generateInsights = useMutation({
    mutationFn: async () => {
      return await apiRequest('GET', '/api/admin/business-intelligence/insights');
    },
    onSuccess: () => {
      toast({
        title: "AI Insights Generated",
        description: "Business intelligence insights have been generated successfully",
      });
      refetchInsights();
    },
    onError: (error: any) => {
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate AI insights",
        variant: "destructive"
      });
    }
  });

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'profitability':
        return <IndianRupee className="w-5 h-5" />;
      case 'service_quality':
        return <Target className="w-5 h-5" />;
      case 'market_reputation':
        return <Globe className="w-5 h-5" />;
      case 'marketing':
        return <Megaphone className="w-5 h-5" />;
      case 'operations':
        return <Settings className="w-5 h-5" />;
      default:
        return <Lightbulb className="w-5 h-5" />;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'profitability':
        return 'from-emerald-500 to-green-600';
      case 'service_quality':
        return 'from-blue-500 to-cyan-600';
      case 'market_reputation':
        return 'from-purple-500 to-pink-600';
      case 'marketing':
        return 'from-orange-500 to-red-600';
      case 'operations':
        return 'from-indigo-500 to-purple-600';
      default:
        return 'from-gray-500 to-slate-600';
    }
  };

  const getPriorityBadge = (priority: string) => {
    const variants: Record<string, string> = {
      critical: 'destructive',
      high: 'default',
      medium: 'secondary',
      low: 'outline'
    };
    return variants[priority] || 'outline';
  };

  const getTrendIcon = (trend?: 'up' | 'down' | 'stable') => {
    if (trend === 'up') return <TrendingUp className="w-4 h-4 text-green-600" />;
    if (trend === 'down') return <TrendingDown className="w-4 h-4 text-red-600" />;
    return <TrendingUp className="w-4 h-4 text-gray-400" />;
  };

  return (
    <div className="space-y-6">
      {/* Header Section with Generate Button */}
      <Card className="bg-gradient-to-r from-purple-600 to-pink-600 text-white border-0">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Brain className="w-8 h-8" />
                <h2 className="text-2xl font-bold">AI Business Intelligence</h2>
              </div>
              <p className="text-purple-100">
                AI-powered insights to optimize profitability, service quality, marketing, and operations
              </p>
            </div>
            <Button 
              onClick={() => generateInsights.mutate()} 
              disabled={generateInsights.isPending || insightsLoading}
              variant="secondary"
              size="lg"
              className="bg-white text-purple-600 hover:bg-purple-50"
              data-testid="button-generate-insights"
            >
              {generateInsights.isPending ? (
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              ) : (
                <Zap className="w-5 h-5 mr-2" />
              )}
              Generate Insights
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Business Metrics Overview */}
      {businessMetrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Revenue</p>
                  <p className="text-2xl font-bold">₹{businessMetrics.totalRevenue?.toLocaleString() || 0}</p>
                </div>
                <IndianRupee className="w-8 h-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active Users</p>
                  <p className="text-2xl font-bold">{businessMetrics.activeUsers || 0}/{businessMetrics.totalUsers || 0}</p>
                </div>
                <Users className="w-8 h-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Satisfaction Score</p>
                  <p className="text-2xl font-bold">{businessMetrics.customerSatisfaction?.toFixed(1) || 0}/5.0</p>
                </div>
                <Target className="w-8 h-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Profit Margin</p>
                  <p className="text-2xl font-bold">{((businessMetrics.profitMargin || 0) * 100).toFixed(1)}%</p>
                </div>
                <TrendingUp className="w-8 h-8 text-emerald-600" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* AI Insights Grid */}
      {insightsLoading ? (
        <Card>
          <CardContent className="p-12 flex flex-col items-center justify-center">
            <Loader2 className="w-12 h-12 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Generating AI insights...</p>
          </CardContent>
        </Card>
      ) : allInsights.length === 0 ? (
        <Card>
          <CardContent className="p-12 flex flex-col items-center justify-center">
            <Brain className="w-16 h-16 text-muted-foreground/30 mb-4" />
            <p className="text-lg font-semibold text-muted-foreground mb-2">No AI insights generated yet</p>
            <p className="text-sm text-muted-foreground mb-4">Click "Generate Insights" to analyze your business data</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {allInsights.map((insight: any) => (
            <Card key={insight.id} className="overflow-hidden" data-testid={`insight-card-${insight.category}`}>
              <div className={`h-2 bg-gradient-to-r ${getCategoryColor(insight.category)}`} />
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg bg-gradient-to-br ${getCategoryColor(insight.category)} text-white`}>
                      {getCategoryIcon(insight.category)}
                    </div>
                    <div>
                      <CardTitle className="text-lg">{insight.title}</CardTitle>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant={getPriorityBadge(insight.priority) as any}>
                          {insight.priority}
                        </Badge>
                        <span className="text-xs text-muted-foreground capitalize">
                          {insight.category.replace('_', ' ')}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">{insight.summary}</p>
                
                {/* Key Metrics */}
                {insight.metrics && insight.metrics.length > 0 && (
                  <div className="grid grid-cols-2 gap-3">
                    {insight.metrics.slice(0, 4).map((metric: any, idx: number) => (
                      <div key={idx} className="p-3 bg-muted rounded-lg">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-xs text-muted-foreground">{metric.label}</p>
                          {getTrendIcon(metric.trend)}
                        </div>
                        <p className="text-sm font-bold">{metric.value}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Recommendations */}
                <div className="space-y-2">
                  <p className="text-sm font-semibold">Top Recommendations:</p>
                  <ul className="space-y-1.5">
                    {insight.recommendations?.slice(0, 3).map((rec: string, idx: number) => (
                      <li key={idx} className="text-xs text-muted-foreground flex items-start gap-2">
                        <CheckCircle className="w-3 h-3 text-green-600 mt-0.5 flex-shrink-0" />
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Action Items */}
                {insight.actionItems && insight.actionItems.length > 0 && (
                  <div className="pt-3 border-t">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full"
                      onClick={() => setSelectedInsight(insight.id)}
                      data-testid={`button-view-details-${insight.category}`}
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      View Full Analysis
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Detailed Insight Dialog */}
      <Dialog open={!!selectedInsight} onOpenChange={(open) => !open && setSelectedInsight(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          {selectedInsight && allInsights.find((i: any) => i.id === selectedInsight) && (
            <div>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {getCategoryIcon(allInsights.find((i: any) => i.id === selectedInsight).category)}
                  {allInsights.find((i: any) => i.id === selectedInsight).title}
                </DialogTitle>
                <DialogDescription>
                  Detailed AI analysis and actionable recommendations
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-6 mt-6">
                {/* Detailed Analysis */}
                <div>
                  <h3 className="font-semibold mb-2">Detailed Analysis</h3>
                  <p className="text-sm text-muted-foreground">
                    {allInsights.find((i: any) => i.id === selectedInsight).detailedAnalysis}
                  </p>
                </div>

                {/* All Recommendations */}
                <div>
                  <h3 className="font-semibold mb-2">All Recommendations</h3>
                  <ul className="space-y-2">
                    {allInsights.find((i: any) => i.id === selectedInsight).recommendations?.map((rec: string, idx: number) => (
                      <li key={idx} className="text-sm flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Action Items */}
                <div>
                  <h3 className="font-semibold mb-2">Action Items</h3>
                  <div className="space-y-3">
                    {allInsights.find((i: any) => i.id === selectedInsight).actionItems?.map((item: any, idx: number) => (
                      <Card key={idx}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-2">
                            <h4 className="font-medium text-sm">{item.action}</h4>
                            <Badge variant="outline" className="text-xs">{item.timeframe}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mb-1">
                            <strong>Estimated Impact:</strong> {item.estimatedImpact}
                          </p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function AdminPanel() {
  const [selectedTab, setSelectedTab] = useState("overview");
  const { toast } = useToast();

  // Queries
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['/api/admin/stats'],
  });

  const { data: usersData, isLoading: usersLoading } = useQuery<any>({
    queryKey: ['/api/admin/users'],
  });
  const users = Array.isArray(usersData) ? usersData : (usersData?.users || []);

  const { data: relationshipsRaw, isLoading: relationshipsLoading } = useQuery<any>({
    queryKey: ['/api/admin/client-agent-relationships'],
  });
  const relationshipsData = Array.isArray(relationshipsRaw) ? relationshipsRaw : (relationshipsRaw?.relationships || []);

  const { data: relationshipsStats = {}, isLoading: statsLoadingRel } = useQuery<any>({
    queryKey: ['/api/admin/client-agent-relationships/stats'],
  });

  const { data: activitiesData, isLoading: activitiesLoading } = useQuery<any>({
    queryKey: ['/api/admin/activities'],
  });
  const activities = Array.isArray(activitiesData) ? activitiesData : (activitiesData?.activities || []);

  const { data: insights = {}, isLoading: insightsLoading } = useQuery<any>({
    queryKey: ['/api/admin/insights'],
  });

  const { data: agentsData, isLoading: agentsLoading } = useQuery<any>({
    queryKey: ['/api/admin/agents'],
  });
  
  // Ensure agents is always an array, handling cases where API returns an object
  const agents = Array.isArray(agentsData) ? agentsData : (agentsData?.agents || []);

  const { data: proposalsData, isLoading: proposalsLoading } = useQuery<any>({
    queryKey: ['/api/admin/proposals'],
  });
  const proposals = Array.isArray(proposalsData) ? proposalsData : (proposalsData?.proposals || []);

  const { data: complianceEventsData, isLoading: complianceEventsLoading } = useQuery<any>({
    queryKey: ['/api/admin/compliance/events'],
  });
  const complianceEvents = Array.isArray(complianceEventsData) ? complianceEventsData : (complianceEventsData?.events || []);

  const { data: complianceAlertsData, isLoading: complianceAlertsLoading } = useQuery<any>({
    queryKey: ['/api/admin/compliance/alerts'],
  });
  const complianceAlerts = Array.isArray(complianceAlertsData) ? complianceAlertsData : (complianceAlertsData?.alerts || []);

  const { data: systemErrorsData, isLoading: systemErrorsLoading } = useQuery<any>({
    queryKey: ['/api/admin/system-errors'],
  });
  const systemErrors = Array.isArray(systemErrorsData) ? systemErrorsData : (systemErrorsData?.errors || []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-blue-950 dark:to-indigo-950">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 dark:from-blue-900 dark:via-indigo-900 dark:to-purple-900 text-white">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold mb-2" data-testid="text-admin-title">Admin Panel</h1>
              <p className="text-blue-100 dark:text-blue-200">System administration and monitoring dashboard</p>
            </div>
            <div className="flex items-center gap-4">
              <Button variant="secondary" size="sm" data-testid="button-refresh">
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
              <Button variant="secondary" size="sm" data-testid="button-settings">
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-6">
          {/* Tabs Navigation */}
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-2 overflow-x-auto">
            <ScrollableTabsList className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 xl:grid-cols-15 gap-2 bg-transparent h-auto min-w-max">
              <TabsTrigger 
                value="overview" 
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg py-2.5"
                data-testid="tab-overview"
              >
                <BarChart3 className="w-4 h-4 mr-2" />
                Overview
              </TabsTrigger>
              <TabsTrigger 
                value="users" 
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg py-2.5"
                data-testid="tab-users"
              >
                <Users className="w-4 h-4 mr-2" />
                Users
              </TabsTrigger>
              <TabsTrigger 
                value="api-status" 
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg py-2.5"
                data-testid="tab-api-status"
              >
                <Monitor className="w-4 h-4 mr-2" />
                API Status
              </TabsTrigger>
              <TabsTrigger 
                value="ckyc" 
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg py-2.5"
                data-testid="tab-ckyc"
              >
                <Shield className="w-4 h-4 mr-2" />
                CKYC
              </TabsTrigger>
              <TabsTrigger 
                value="client-agent-relationships" 
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg py-2.5"
                data-testid="tab-client-agent"
              >
                <Network className="w-4 h-4 mr-2" />
                Relationships
              </TabsTrigger>
              <TabsTrigger 
                value="supplier-dashboard" 
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg py-2.5"
                data-testid="tab-suppliers"
              >
                <Building2 className="w-4 h-4 mr-2" />
                Suppliers
              </TabsTrigger>
              <TabsTrigger 
                value="reports" 
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg py-2.5"
                data-testid="tab-reports"
              >
                <FileText className="w-4 h-4 mr-2" />
                Reports
              </TabsTrigger>
              <TabsTrigger 
                value="system" 
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg py-2.5"
                data-testid="tab-system"
              >
                <Server className="w-4 h-4 mr-2" />
                System
              </TabsTrigger>
              <TabsTrigger 
                value="activities" 
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg py-2.5"
                data-testid="tab-activities"
              >
                <Activity className="w-4 h-4 mr-2" />
                Activities
              </TabsTrigger>
              <TabsTrigger 
                value="insights" 
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg py-2.5"
                data-testid="tab-insights"
              >
                <Lightbulb className="w-4 h-4 mr-2" />
                Insights
              </TabsTrigger>
              <TabsTrigger 
                value="agents" 
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg py-2.5"
                data-testid="tab-agents"
              >
                <Users2 className="w-4 h-4 mr-2" />
                Agents
              </TabsTrigger>
              <TabsTrigger 
                value="proposals" 
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg py-2.5"
                data-testid="tab-proposals"
              >
                <FileText className="w-4 h-4 mr-2" />
                Proposals
              </TabsTrigger>
              <TabsTrigger 
                value="compliance" 
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg py-2.5"
                data-testid="tab-compliance"
              >
                <ShieldCheck className="w-4 h-4 mr-2" />
                Compliance
              </TabsTrigger>
              <TabsTrigger 
                value="ai-analysis" 
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg py-2.5"
                data-testid="tab-ai-analysis"
              >
                <Brain className="w-4 h-4 mr-2" />
                AI Analysis
              </TabsTrigger>
              <TabsTrigger 
                value="errors" 
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg py-2.5"
                data-testid="tab-errors"
              >
                <AlertCircle className="w-4 h-4 mr-2" />
                Errors
              </TabsTrigger>
            </ScrollableTabsList>
          </div>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6" data-testid="overview-content">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="bg-gradient-to-br from-blue-500 to-indigo-600 border-0 text-white">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-blue-100 text-sm font-medium">Total Users</p>
                      <p className="text-3xl font-bold mt-2">
                        {statsLoading ? "..." : (stats as any)?.totalUsers || 0}
                      </p>
                    </div>
                    <Users className="w-12 h-12 text-blue-200" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-emerald-500 to-green-600 border-0 text-white">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-emerald-100 text-sm font-medium">Active Users</p>
                      <p className="text-3xl font-bold mt-2">
                        {statsLoading ? "..." : (stats as any)?.activeUsers || 0}
                      </p>
                    </div>
                    <Activity className="w-12 h-12 text-emerald-200" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-purple-500 to-pink-600 border-0 text-white">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-purple-100 text-sm font-medium">Total Revenue</p>
                      <p className="text-3xl font-bold mt-2">
                        {statsLoading ? "..." : `₹${((stats as any)?.totalRevenue || 0).toLocaleString()}`}
                      </p>
                    </div>
                    <TrendingUp className="w-12 h-12 text-purple-200" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-orange-500 to-red-600 border-0 text-white">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-orange-100 text-sm font-medium">Pending Tasks</p>
                      <p className="text-3xl font-bold mt-2">
                        {statsLoading ? "..." : (stats as any)?.pendingTasks || 0}
                      </p>
                    </div>
                    <AlertTriangle className="w-12 h-12 text-orange-200" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-primary" />
                  Recent Activity
                </CardTitle>
                <CardDescription>Latest system events and user activities</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="w-2 h-2 rounded-full bg-primary"></div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">Activity {i}</p>
                        <p className="text-xs text-muted-foreground">Lorem ipsum dolor sit amet</p>
                      </div>
                      <span className="text-xs text-muted-foreground">{i}m ago</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users" className="space-y-6" data-testid="users-content">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="w-5 h-5 text-primary" />
                      User Management
                    </CardTitle>
                    <CardDescription>Manage and monitor user accounts</CardDescription>
                  </div>
                  <Button data-testid="button-add-user">
                    <UserPlus className="w-4 h-4 mr-2" />
                    Add User
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {usersLoading ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8">
                          <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
                        </TableCell>
                      </TableRow>
                    ) : users.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          No users found
                        </TableCell>
                      </TableRow>
                    ) : (
                      users.map((user: any, index: number) => (
                        <TableRow key={user.id} data-testid={`user-row-${index}`}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-semibold">
                                {user.firstName?.[0] || 'U'}
                              </div>
                              <div>
                                <div className="font-medium">{user.firstName} {user.lastName}</div>
                                <div className="text-sm text-muted-foreground">ID: {user.id}</div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>{user.email || user.mobile}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{user.roles?.[0] || 'User'}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className={user.isActive ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400'}>
                              {user.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button variant="ghost" size="sm" data-testid={`button-view-user-${index}`}>
                                <Eye className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="sm" data-testid={`button-edit-user-${index}`}>
                                <Edit className="w-4 h-4" />
                              </Button>
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

          {/* API Status Tab */}
          <TabsContent value="api-status" className="space-y-6" data-testid="api-status-content">
            <ApiStatusPanel />
          </TabsContent>

          {/* CKYC Tab */}
          <TabsContent value="ckyc" className="space-y-6" data-testid="ckyc-content">
            <CkycManagement />
          </TabsContent>

          {/* Client-Agent Relationships Tab */}
          <TabsContent value="client-agent-relationships" className="space-y-6" data-testid="client-agent-relationships-content">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-3xl font-bold">EUIN/ARN Integration</h2>
                <p className="text-muted-foreground mt-1">Manage client-agent relationships for automated API integration</p>
              </div>
              <Button className="bg-gradient-to-r from-purple-500 to-violet-600 text-white hover:from-purple-600 hover:to-violet-700" data-testid="button-add-relationship">
                <Network className="w-4 h-4 mr-2" />
                Add Relationship
              </Button>
            </div>

            {/* Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border-green-200 dark:border-green-900/50">
                <CardContent className="p-6">
                  <div className="flex items-center space-x-4">
                    <div className="p-3 bg-emerald-500 rounded-xl">
                      <UserCheck className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Active Relationships</p>
                      <p className="text-2xl font-bold text-emerald-900 dark:text-emerald-100">
                        {statsLoadingRel ? "..." : (relationshipsStats.activeRelationships || 0)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30 border-blue-200 dark:border-blue-900/50">
                <CardContent className="p-6">
                  <div className="flex items-center space-x-4">
                    <div className="p-3 bg-blue-500 rounded-xl">
                      <Building className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-blue-700 dark:text-blue-400">Unique Agents</p>
                      <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                        {statsLoadingRel ? "..." : (relationshipsStats.uniqueAgents || 0)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-950/30 dark:to-violet-950/30 border-purple-200 dark:border-purple-900/50">
                <CardContent className="p-6">
                  <div className="flex items-center space-x-4">
                    <div className="p-3 bg-purple-500 rounded-xl">
                      <Zap className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-purple-700 dark:text-purple-400">Auto-Populated APIs</p>
                      <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                        {statsLoadingRel ? "..." : (relationshipsStats.autoPopulatedApis || 0)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Client-Agent Relationships Table */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Network className="w-5 h-5 text-primary" />
                  Relationships
                </CardTitle>
                <CardDescription>Client-Agent relationship configurations</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-4 flex gap-4">
                  <Input
                    placeholder="Search relationships..."
                    className="max-w-sm"
                    data-testid="input-search-relationships"
                  />
                  <Select defaultValue="all">
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Client</TableHead>
                      <TableHead>Agent</TableHead>
                      <TableHead>EUIN Number</TableHead>
                      <TableHead>ARN Code</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Auto-Populate</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {relationshipsLoading ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8">
                          <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
                        </TableCell>
                      </TableRow>
                    ) : relationshipsData.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                          No relationships found
                        </TableCell>
                      </TableRow>
                    ) : (
                      relationshipsData.map((relationship: any, index: number) => (
                        <TableRow key={relationship.id} data-testid={`relationship-row-${index + 1}`}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{relationship.clientFirstName} {relationship.clientLastName}</div>
                              <div className="text-sm text-muted-foreground">{relationship.clientEmail}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">{relationship.agentFirstName} {relationship.agentLastName}</div>
                              <div className="text-sm text-muted-foreground">{relationship.agentEmail}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <code className="text-xs bg-muted px-2 py-1 rounded">
                              {relationship.euinNumber}
                            </code>
                          </TableCell>
                          <TableCell>
                            <code className="text-xs bg-muted px-2 py-1 rounded">
                              {relationship.arnCode || 'N/A'}
                            </code>
                          </TableCell>
                          <TableCell>
                            <Badge variant={relationship.relationshipType === 'primary' ? 'default' : 'secondary'}>
                              {relationship.relationshipType}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex space-x-2">
                              <Badge className={relationship.autoPopulateEuin ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' : 'bg-muted'}>
                                EUIN: {relationship.autoPopulateEuin ? 'On' : 'Off'}
                              </Badge>
                              <Badge className={relationship.autoPopulateArn ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' : 'bg-muted'}>
                                ARN: {relationship.autoPopulateArn ? 'On' : 'Off'}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={relationship.isActive ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400'}>
                              {relationship.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex space-x-2">
                              <Button variant="outline" size="sm" data-testid={`button-edit-relationship-${index + 1}`}>
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button variant="outline" size="sm" data-testid={`button-delete-relationship-${index + 1}`}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
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

          {/* Supplier Dashboard Tab */}
          <TabsContent value="supplier-dashboard" className="space-y-6" data-testid="supplier-dashboard-content">
            <SupplierDashboard />
          </TabsContent>

          {/* Reports Tab */}
          <TabsContent value="reports" className="space-y-6" data-testid="reports-content">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary" />
                  Reports & Analytics
                </CardTitle>
                <CardDescription>Generate and view system reports</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Button variant="outline" className="h-24 flex-col gap-2" data-testid="button-capital-gains-report">
                    <Receipt className="w-6 h-6" />
                    <span>Capital Gains Report</span>
                  </Button>
                  <Button variant="outline" className="h-24 flex-col gap-2" data-testid="button-transaction-report">
                    <BarChart className="w-6 h-6" />
                    <span>Transaction Report</span>
                  </Button>
                  <Button variant="outline" className="h-24 flex-col gap-2" data-testid="button-user-activity">
                    <Activity className="w-6 h-6" />
                    <span>User Activity</span>
                  </Button>
                  <Button variant="outline" className="h-24 flex-col gap-2" data-testid="button-system-logs">
                    <FileText className="w-6 h-6" />
                    <span>System Logs</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* System Tab */}
          <TabsContent value="system" className="space-y-6" data-testid="system-content">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Server className="w-5 h-5 text-primary" />
                  System Configuration
                </CardTitle>
                <CardDescription>Manage system settings and configurations</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold">Database Settings</h3>
                        <p className="text-sm text-muted-foreground">Configure database connections</p>
                      </div>
                      <Settings className="w-5 h-5 text-muted-foreground" />
                    </div>
                  </div>
                  <div className="p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold">Email Configuration</h3>
                        <p className="text-sm text-muted-foreground">Configure email service</p>
                      </div>
                      <Mail className="w-5 h-5 text-muted-foreground" />
                    </div>
                  </div>
                  <div className="p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold">Security Settings</h3>
                        <p className="text-sm text-muted-foreground">Manage security and authentication</p>
                      </div>
                      <Lock className="w-5 h-5 text-muted-foreground" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Activities Tab */}
          <TabsContent value="activities" className="space-y-6" data-testid="activities-content">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-primary" />
                  System Activities
                </CardTitle>
                <CardDescription>Monitor user actions and system events</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-4 flex gap-4">
                  <Input
                    placeholder="Search activities..."
                    className="max-w-sm"
                    data-testid="input-search-activities"
                  />
                  <Select defaultValue="all">
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Filter by type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="user">User Action</SelectItem>
                      <SelectItem value="system">System Event</SelectItem>
                      <SelectItem value="admin">Admin Action</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Details</TableHead>
                      <TableHead>IP Address</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activitiesLoading ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8">
                          <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
                        </TableCell>
                      </TableRow>
                    ) : activities.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          No activities found
                        </TableCell>
                      </TableRow>
                    ) : (
                      activities.map((activity: any, index: number) => (
                        <TableRow key={activity.id} data-testid={`activity-row-${index}`}>
                          <TableCell>{activity.timestamp ? format(new Date(activity.timestamp), 'PPp') : 'N/A'}</TableCell>
                          <TableCell>{activity.userName || 'System'}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{activity.action}</Badge>
                          </TableCell>
                          <TableCell className="max-w-xs truncate">{activity.details}</TableCell>
                          <TableCell>
                            <code className="text-xs bg-muted px-2 py-1 rounded">{activity.ipAddress}</code>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Insights Tab */}
          <TabsContent value="insights" className="space-y-6" data-testid="insights-content">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-blue-200 dark:border-blue-900/50">
                <CardContent className="p-6">
                  <div className="flex items-center space-x-4">
                    <div className="p-3 bg-blue-500 rounded-xl">
                      <TrendingUp className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-blue-700 dark:text-blue-400">Revenue Growth</p>
                      <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                        {insightsLoading ? "..." : `${(insights as any)?.revenueGrowth || 0}%`}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-950/30 dark:to-green-950/30 border-emerald-200 dark:border-emerald-900/50">
                <CardContent className="p-6">
                  <div className="flex items-center space-x-4">
                    <div className="p-3 bg-emerald-500 rounded-xl">
                      <Users className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">User Growth</p>
                      <p className="text-2xl font-bold text-emerald-900 dark:text-emerald-100">
                        {insightsLoading ? "..." : `${(insights as any)?.userGrowth || 0}%`}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30 border-purple-200 dark:border-purple-900/50">
                <CardContent className="p-6">
                  <div className="flex items-center space-x-4">
                    <div className="p-3 bg-purple-500 rounded-xl">
                      <Target className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-purple-700 dark:text-purple-400">Conversion Rate</p>
                      <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                        {insightsLoading ? "..." : `${(insights as any)?.conversionRate || 0}%`}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lightbulb className="w-5 h-5 text-primary" />
                  Business Intelligence
                </CardTitle>
                <CardDescription>Key insights and analytics</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <h3 className="font-semibold mb-2">Top Performing Products</h3>
                    <p className="text-sm text-muted-foreground">
                      {insightsLoading ? "Loading..." : (insights as any)?.topProducts || "No data available"}
                    </p>
                  </div>
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <h3 className="font-semibold mb-2">Peak Activity Hours</h3>
                    <p className="text-sm text-muted-foreground">
                      {insightsLoading ? "Loading..." : (insights as any)?.peakHours || "No data available"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Agents Tab */}
          <TabsContent value="agents" className="space-y-6" data-testid="agents-content">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Users2 className="w-5 h-5 text-primary" />
                      Agent Management
                    </CardTitle>
                    <CardDescription>Manage financial advisors and agents</CardDescription>
                  </div>
                  <Button data-testid="button-add-agent">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Agent
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Agent Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>EUIN</TableHead>
                      <TableHead>ARN Code</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {agentsLoading ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8">
                          <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
                        </TableCell>
                      </TableRow>
                    ) : agents.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          No agents found
                        </TableCell>
                      </TableRow>
                    ) : (
                      agents.map((agent: any, index: number) => (
                        <TableRow key={agent.id} data-testid={`agent-row-${index}`}>
                          <TableCell className="font-medium">{agent.name}</TableCell>
                          <TableCell>{agent.email}</TableCell>
                          <TableCell>
                            <code className="text-xs bg-muted px-2 py-1 rounded">{agent.euinNumber}</code>
                          </TableCell>
                          <TableCell>
                            <code className="text-xs bg-muted px-2 py-1 rounded">{agent.arnCode || 'N/A'}</code>
                          </TableCell>
                          <TableCell>
                            <Badge className={agent.isActive ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' : 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400'}>
                              {agent.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button variant="ghost" size="sm" data-testid={`button-edit-agent-${index}`}>
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="sm" data-testid={`button-delete-agent-${index}`}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
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

          {/* Proposals Tab */}
          <TabsContent value="proposals" className="space-y-6" data-testid="proposals-content">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="w-5 h-5 text-primary" />
                      Investment Proposals
                    </CardTitle>
                    <CardDescription>Manage investment proposals and recommendations</CardDescription>
                  </div>
                  <Button data-testid="button-create-proposal">
                    <Plus className="w-4 h-4 mr-2" />
                    Create Proposal
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Proposal ID</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {proposalsLoading ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8">
                          <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
                        </TableCell>
                      </TableRow>
                    ) : proposals.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          No proposals found
                        </TableCell>
                      </TableRow>
                    ) : (
                      proposals.map((proposal: any, index: number) => (
                        <TableRow key={proposal.id} data-testid={`proposal-row-${index}`}>
                          <TableCell>
                            <code className="text-xs bg-muted px-2 py-1 rounded">{proposal.proposalId}</code>
                          </TableCell>
                          <TableCell>{proposal.clientName}</TableCell>
                          <TableCell>{proposal.proposalType}</TableCell>
                          <TableCell>₹{proposal.amount?.toLocaleString()}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{proposal.status}</Badge>
                          </TableCell>
                          <TableCell>{proposal.createdAt ? format(new Date(proposal.createdAt), 'PP') : 'N/A'}</TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button variant="ghost" size="sm" data-testid={`button-view-proposal-${index}`}>
                                <Eye className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="sm" data-testid={`button-edit-proposal-${index}`}>
                                <Edit className="w-4 h-4" />
                              </Button>
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

          {/* Compliance Tab */}
          <TabsContent value="compliance" className="space-y-6" data-testid="compliance-content">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border-amber-200 dark:border-amber-900/50">
                <CardContent className="p-6">
                  <div className="flex items-center space-x-4">
                    <div className="p-3 bg-amber-500 rounded-xl">
                      <AlertTriangle className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-amber-700 dark:text-amber-400">Active Alerts</p>
                      <p className="text-2xl font-bold text-amber-900 dark:text-amber-100">
                        {complianceAlertsLoading ? "..." : complianceAlerts.length}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30 border-blue-200 dark:border-blue-900/50">
                <CardContent className="p-6">
                  <div className="flex items-center space-x-4">
                    <div className="p-3 bg-blue-500 rounded-xl">
                      <ShieldCheck className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-blue-700 dark:text-blue-400">Compliance Events</p>
                      <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                        {complianceEventsLoading ? "..." : complianceEvents.length}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-primary" />
                  Compliance Alerts
                </CardTitle>
                <CardDescription>Monitor and manage compliance violations</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Alert Type</TableHead>
                      <TableHead>Severity</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {complianceAlertsLoading ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8">
                          <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
                        </TableCell>
                      </TableRow>
                    ) : complianceAlerts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          No compliance alerts
                        </TableCell>
                      </TableRow>
                    ) : (
                      complianceAlerts.map((alert: any, index: number) => (
                        <TableRow key={alert.id} data-testid={`alert-row-${index}`}>
                          <TableCell>{alert.type}</TableCell>
                          <TableCell>
                            <Badge variant={alert.severity === 'high' ? 'destructive' : 'outline'}>
                              {alert.severity}
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-xs truncate">{alert.description}</TableCell>
                          <TableCell>{alert.timestamp ? format(new Date(alert.timestamp), 'PPp') : 'N/A'}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{alert.status}</Badge>
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm" data-testid={`button-resolve-alert-${index}`}>
                              <CheckCircle className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* AI Analysis Tab */}
          <TabsContent value="ai-analysis" className="space-y-6" data-testid="ai-analysis-content">
            <AIBusinessIntelligenceDashboard />
          </TabsContent>

          {/* System Errors Tab */}
          <TabsContent value="errors" className="space-y-6" data-testid="errors-content">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-destructive" />
                  System Error Monitor
                </CardTitle>
                <CardDescription>Debug and track system errors (Super Admin Only)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-4 flex gap-4">
                  <Input
                    placeholder="Search errors..."
                    className="max-w-sm"
                    data-testid="input-search-errors"
                  />
                  <Select defaultValue="all">
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Filter by severity" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Severities</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                      <SelectItem value="error">Error</SelectItem>
                      <SelectItem value="warning">Warning</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>Error Type</TableHead>
                      <TableHead>Message</TableHead>
                      <TableHead>Stack Trace</TableHead>
                      <TableHead>Severity</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {systemErrorsLoading ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8">
                          <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
                        </TableCell>
                      </TableRow>
                    ) : systemErrors.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          No system errors found
                        </TableCell>
                      </TableRow>
                    ) : (
                      systemErrors.map((error: any, index: number) => (
                        <TableRow key={error.id} data-testid={`error-row-${index}`}>
                          <TableCell>{error.timestamp ? format(new Date(error.timestamp), 'PPp') : 'N/A'}</TableCell>
                          <TableCell>
                            <code className="text-xs bg-muted px-2 py-1 rounded">{error.type}</code>
                          </TableCell>
                          <TableCell className="max-w-xs truncate">{error.message}</TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm" data-testid={`button-view-stack-${index}`}>
                              <Eye className="w-4 h-4" />
                            </Button>
                          </TableCell>
                          <TableCell>
                            <Badge variant={error.severity === 'critical' ? 'destructive' : 'outline'}>
                              {error.severity}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm" data-testid={`button-debug-error-${index}`}>
                              <Settings className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
