import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
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
  Globe, Smartphone, Users, TrendingUp, BarChart3, Activity, Download,
  Copy, FileText, MessageSquareWarning, HelpCircle, Loader2
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

function TransactionTimeline({ errors, onViewError }: { errors: ErrorEntry[]; onViewError: (error: ErrorEntry) => void }) {
  const transactionGroups = errors
    .filter(e => e.transactionId)
    .reduce((acc, error) => {
      const txId = error.transactionId!;
      if (!acc[txId]) {
        acc[txId] = [];
      }
      acc[txId].push(error);
      return acc;
    }, {} as Record<string, ErrorEntry[]>);

  const sortedTransactions = Object.entries(transactionGroups)
    .map(([txId, errs]) => ({
      transactionId: txId,
      errors: errs.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
      firstError: errs.reduce((min, e) => new Date(e.createdAt) < new Date(min.createdAt) ? e : min, errs[0]),
      lastError: errs.reduce((max, e) => new Date(e.createdAt) > new Date(max.createdAt) ? e : max, errs[0]),
      hasCritical: errs.some(e => e.severity === 'critical')
    }))
    .sort((a, b) => new Date(b.lastError.createdAt).getTime() - new Date(a.lastError.createdAt).getTime());

  if (sortedTransactions.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="text-lg font-medium">No Transaction Errors</p>
          <p className="text-sm">Errors without transaction IDs are not shown here</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Transaction Error Timeline
        </CardTitle>
        <CardDescription>
          Errors grouped by transaction ID for easier correlation
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[500px]">
          <div className="space-y-4">
            {sortedTransactions.map(({ transactionId, errors, hasCritical }) => (
              <div
                key={transactionId}
                className={`border rounded-lg p-4 ${hasCritical ? 'border-red-300 bg-red-50 dark:bg-red-950/20' : ''}`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <code className="text-sm font-mono bg-muted px-2 py-1 rounded">
                      {transactionId}
                    </code>
                    <Badge variant={hasCritical ? "destructive" : "secondary"}>
                      {errors.length} error{errors.length > 1 ? 's' : ''}
                    </Badge>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(errors[0].createdAt), { addSuffix: true })}
                  </span>
                </div>
                
                <div className="relative pl-4 border-l-2 border-border space-y-3">
                  {errors.map((error, idx) => (
                    <div key={error.id} className="relative">
                      <div className={`absolute -left-[17px] w-3 h-3 rounded-full ${SEVERITY_COLORS[error.severity] || 'bg-muted-foreground'}`} />
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{error.errorCode}</span>
                            <Badge variant="outline" className="text-xs">{error.module}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground truncate max-w-md">{error.message}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(error.createdAt), 'HH:mm:ss.SSS')}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onViewError(error)}
                          data-testid={`button-timeline-view-${error.id}`}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

function WebhookAlertingSettings() {
  const { toast } = useToast();
  const [newWebhook, setNewWebhook] = useState({
    name: '',
    provider: 'slack',
    webhookUrl: '',
    environment: 'production',
    triggerOnCritical: true,
    triggerOnSpike: true,
    cooldownMinutes: 5
  });
  const [showAddDialog, setShowAddDialog] = useState(false);

  const { data: webhooks, isLoading, refetch } = useQuery<any[]>({
    queryKey: ['/api/errors/webhooks'],
  });

  const { data: thresholds, refetch: refetchThresholds } = useQuery<any[]>({
    queryKey: ['/api/errors/thresholds'],
  });

  const { data: alertHistory } = useQuery<any[]>({
    queryKey: ['/api/errors/alerts/history'],
  });

  const createWebhookMutation = useMutation({
    mutationFn: async (data: typeof newWebhook) => {
      return apiRequest('/api/errors/webhooks', {
        method: 'POST',
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json' }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/errors/webhooks'] });
      toast({ title: "Webhook created", description: "Webhook configuration saved successfully." });
      setShowAddDialog(false);
      setNewWebhook({ name: '', provider: 'slack', webhookUrl: '', environment: 'production', triggerOnCritical: true, triggerOnSpike: true, cooldownMinutes: 5 });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create webhook.", variant: "destructive" });
    }
  });

  const testWebhookMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/errors/webhooks/${id}/test`, { method: 'POST' });
    },
    onSuccess: (data: any) => {
      toast({ 
        title: data.success ? "Test sent" : "Test failed", 
        description: data.message,
        variant: data.success ? "default" : "destructive"
      });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to test webhook.", variant: "destructive" });
    }
  });

  const deleteWebhookMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/errors/webhooks/${id}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/errors/webhooks'] });
      toast({ title: "Webhook deleted" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete webhook.", variant: "destructive" });
    }
  });

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Webhook Channels
              </span>
              <Button size="sm" onClick={() => setShowAddDialog(true)} data-testid="button-add-webhook">
                Add Webhook
              </Button>
            </CardTitle>
            <CardDescription>
              Configure Slack, Teams, or custom webhooks for alerts
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-32" />
            ) : (webhooks?.length ?? 0) === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Globe className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No webhooks configured</p>
              </div>
            ) : (
              <div className="space-y-3">
                {webhooks?.map((webhook: any) => (
                  <div key={webhook.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{webhook.name}</span>
                        <Badge variant="outline">{webhook.provider}</Badge>
                        <Badge variant={webhook.isEnabled ? "default" : "secondary"}>
                          {webhook.isEnabled ? "Active" : "Disabled"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {webhook.triggerOnCritical && "Critical"} {webhook.triggerOnSpike && "• Spikes"} • Cooldown: {webhook.cooldownMinutes}min
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => testWebhookMutation.mutate(webhook.id)}
                        disabled={testWebhookMutation.isPending}
                        data-testid={`button-test-webhook-${webhook.id}`}
                      >
                        Test
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => deleteWebhookMutation.mutate(webhook.id)}
                        data-testid={`button-delete-webhook-${webhook.id}`}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Spike Detection Settings
            </CardTitle>
            <CardDescription>
              Configure thresholds for automatic spike detection
            </CardDescription>
          </CardHeader>
          <CardContent>
            {(thresholds?.length ?? 0) === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Zap className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Default thresholds active</p>
                <p className="text-xs mt-1">10 errors in 5 minutes triggers alert</p>
              </div>
            ) : (
              <div className="space-y-2">
                {thresholds?.map((threshold: any) => (
                  <div key={threshold.id} className="flex items-center justify-between p-2 border rounded">
                    <div>
                      <span className="text-sm font-medium">
                        {threshold.module || threshold.errorCode || "Global"}
                      </span>
                      <p className="text-xs text-muted-foreground">
                        {threshold.occurrenceThreshold} errors in {threshold.windowMinutes} min
                      </p>
                    </div>
                    <Badge variant={threshold.isEnabled ? "default" : "secondary"}>
                      {threshold.isEnabled ? "Active" : "Disabled"}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Recent Alert History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(alertHistory?.length ?? 0) === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No alerts sent yet</p>
            </div>
          ) : (
            <ScrollArea className="h-[200px]">
              <div className="space-y-2">
                {alertHistory?.map((alert: any) => (
                  <div key={alert.id} className="flex items-center justify-between p-2 border rounded text-sm">
                    <div className="flex items-center gap-2">
                      <Badge variant={alert.alertType === 'critical' ? 'destructive' : 'secondary'}>
                        {alert.alertType}
                      </Badge>
                      <span>{alert.errorCode}</span>
                      <span className="text-muted-foreground">{alert.module}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={alert.deliveryStatus === 'sent' ? 'default' : 'destructive'}>
                        {alert.deliveryStatus}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {alert.triggeredAt && formatDistanceToNow(new Date(alert.triggeredAt), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Webhook</DialogTitle>
            <DialogDescription>Configure a new alerting webhook</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Name</label>
              <Input
                placeholder="e.g., Production Alerts"
                value={newWebhook.name}
                onChange={(e) => setNewWebhook({ ...newWebhook, name: e.target.value })}
                data-testid="input-webhook-name"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Provider</label>
              <Select
                value={newWebhook.provider}
                onValueChange={(v) => setNewWebhook({ ...newWebhook, provider: v })}
              >
                <SelectTrigger data-testid="select-webhook-provider">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="slack">Slack</SelectItem>
                  <SelectItem value="teams">Microsoft Teams</SelectItem>
                  <SelectItem value="discord">Discord</SelectItem>
                  <SelectItem value="generic">Generic Webhook</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Webhook URL</label>
              <Input
                placeholder="https://hooks.slack.com/..."
                value={newWebhook.webhookUrl}
                onChange={(e) => setNewWebhook({ ...newWebhook, webhookUrl: e.target.value })}
                data-testid="input-webhook-url"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Environment</label>
              <Select
                value={newWebhook.environment}
                onValueChange={(v) => setNewWebhook({ ...newWebhook, environment: v })}
              >
                <SelectTrigger data-testid="select-webhook-environment">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="production">Production Only</SelectItem>
                  <SelectItem value="development">Development Only</SelectItem>
                  <SelectItem value="all">All Environments</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Cooldown (minutes)</label>
              <Input
                type="number"
                min={1}
                max={60}
                value={newWebhook.cooldownMinutes}
                onChange={(e) => setNewWebhook({ ...newWebhook, cooldownMinutes: parseInt(e.target.value) || 5 })}
                data-testid="input-webhook-cooldown"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
            <Button
              onClick={() => createWebhookMutation.mutate(newWebhook)}
              disabled={createWebhookMutation.isPending || !newWebhook.name || !newWebhook.webhookUrl}
              data-testid="button-save-webhook"
            >
              {createWebhookMutation.isPending ? "Saving..." : "Save Webhook"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface AIInsight {
  id: string;
  category: 'performance' | 'abuse' | 'revenue' | 'engagement' | 'security';
  priority: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  suggestedAction: string;
  estimatedImpact: string;
  actionType?: 'email' | 'notification' | 'config' | 'manual';
  createdAt: string;
}

const PRIORITY_COLORS: Record<string, string> = {
  critical: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-yellow-500",
  low: "bg-blue-500"
};

const CATEGORY_ICONS: Record<string, any> = {
  performance: Zap,
  abuse: Shield,
  revenue: TrendingUp,
  engagement: Users,
  security: Shield
};

function AIInsightsPanel() {
  const { toast } = useToast();
  
  const { data: insightsData, isLoading, refetch } = useQuery<{ 
    success: boolean; 
    insights: AIInsight[]; 
    lastAnalysis: string;
    fromCache: boolean;
  }>({
    queryKey: ['/api/activity-centre/insights'],
    refetchInterval: 5 * 60 * 1000,
  });

  const { data: metricsData } = useQuery<{
    success: boolean;
    metrics: {
      errors: { total: number; critical: number; trend: string };
      users: { activeToday: number; newThisWeek: number; dormant30Days: number; incompleteKyc: number };
      revenue: { pendingOrders: number; abandonedCarts: number };
      security: { failedLogins: number; rateLimitViolations: number };
    };
  }>({
    queryKey: ['/api/activity-centre/metrics'],
    refetchInterval: 60000,
  });

  const refreshMutation = useMutation({
    mutationFn: () => apiRequest('/api/activity-centre/insights/refresh', { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/activity-centre/insights'] });
      toast({ title: "Insights refreshed", description: "AI has generated new recommendations." });
    },
    onError: () => {
      toast({ title: "Refresh failed", description: "Could not generate new insights.", variant: "destructive" });
    }
  });

  const insights = insightsData?.insights || [];
  const metrics = metricsData?.metrics;

  const getPriorityBadge = (priority: string) => {
    const variants: Record<string, "destructive" | "secondary" | "outline" | "default"> = {
      critical: "destructive",
      high: "destructive",
      medium: "secondary",
      low: "outline"
    };
    return variants[priority] || "outline";
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      performance: "text-purple-500",
      abuse: "text-red-500",
      revenue: "text-green-500",
      engagement: "text-blue-500",
      security: "text-orange-500"
    };
    return colors[category] || "text-muted-foreground";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">AI-Powered Insights</h2>
          <p className="text-sm text-muted-foreground">
            {insightsData?.lastAnalysis 
              ? `Last analyzed: ${formatDistanceToNow(new Date(insightsData.lastAnalysis))} ago`
              : "Analyzing platform activity..."}
            {insightsData?.fromCache && " (cached)"}
          </p>
        </div>
        <Button 
          onClick={() => refreshMutation.mutate()} 
          disabled={refreshMutation.isPending}
          variant="outline"
          data-testid="button-refresh-insights"
        >
          {refreshMutation.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Refresh Insights
        </Button>
      </div>

      {metrics && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Active Users Today</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.users.activeToday}</div>
              <p className="text-xs text-muted-foreground">{metrics.users.newThisWeek} new this week</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Incomplete KYC</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-500">{metrics.users.incompleteKyc}</div>
              <p className="text-xs text-muted-foreground">Potential revenue blocked</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Dormant Users (30d)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-500">{metrics.users.dormant30Days}</div>
              <p className="text-xs text-muted-foreground">Re-engagement opportunity</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pending Orders</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-500">{metrics.revenue.pendingOrders}</div>
              <p className="text-xs text-muted-foreground">Awaiting completion</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-yellow-500" />
            Actionable Recommendations
          </CardTitle>
          <CardDescription>
            AI-generated suggestions to improve performance, revenue, and engagement
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-24" />)}
            </div>
          ) : insights.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Zap className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No insights available</p>
              <p className="text-sm">Click "Refresh Insights" to generate AI recommendations</p>
            </div>
          ) : (
            <div className="space-y-4">
              {insights.map((insight) => {
                const IconComponent = CATEGORY_ICONS[insight.category] || Zap;
                return (
                  <div 
                    key={insight.id} 
                    className="p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                    data-testid={`insight-${insight.id}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg bg-muted ${getCategoryColor(insight.category)}`}>
                          <IconComponent className="h-5 w-5" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium">{insight.title}</h4>
                            <Badge variant={getPriorityBadge(insight.priority)} className="text-xs">
                              {insight.priority}
                            </Badge>
                            <Badge variant="outline" className="text-xs capitalize">
                              {insight.category}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">{insight.description}</p>
                          <div className="flex items-center gap-4 text-xs">
                            <span className="flex items-center gap-1">
                              <CheckCircle className="h-3 w-3 text-green-500" />
                              <span className="font-medium">Action:</span> {insight.suggestedAction}
                            </span>
                          </div>
                          <div className="mt-1 text-xs text-green-600 font-medium">
                            Expected Impact: {insight.estimatedImpact}
                          </div>
                        </div>
                      </div>
                      {insight.actionType === 'email' && (
                        <Button size="sm" variant="outline" className="shrink-0">
                          <MessageSquareWarning className="h-4 w-4 mr-1" />
                          Send Campaign
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

interface SupportReportData {
  success: boolean;
  errorId: string;
  textReport: string;
  jsonReport?: {
    errorId: string;
    errorCode: string;
    severity: string;
    message: string;
    module: string;
    source: string;
    replitContext: {
      replId: string | null;
      replSlug: string | null;
      replOwner: string | null;
      deploymentId: string | null;
      deploymentUrl: string | null;
      devDomain: string | null;
      projectUrl: string | null;
      environment: string;
    };
    requestContext?: object;
    stackTrace?: string;
    resolutionStatus: string;
    firstOccurrence: string;
    lastOccurrence: string;
    occurrenceCount: number;
  };
  supportActions: {
    replitSupport: string;
    replitCommunity: string;
    replitDocs: string;
    copyToClipboard: boolean;
    downloadAsFile: boolean;
  };
}

export default function ActivityCentre() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [selectedError, setSelectedError] = useState<ErrorEntry | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [resolveOpen, setResolveOpen] = useState(false);
  const [resolutionNote, setResolutionNote] = useState("");
  const [supportReportOpen, setSupportReportOpen] = useState(false);
  const [supportReportData, setSupportReportData] = useState<SupportReportData | null>(null);
  
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

  // Generate support report mutation
  const generateReportMutation = useMutation({
    mutationFn: async (errorId: string) => {
      const response = await fetch(`/api/errors/support-report/${errorId}`);
      if (!response.ok) throw new Error('Failed to generate report');
      return response.json() as Promise<SupportReportData>;
    },
    onSuccess: (data) => {
      if (data.success && data.textReport) {
        setSupportReportData(data);
        setSupportReportOpen(true);
      } else {
        toast({ title: "Error", description: "Report generation returned incomplete data.", variant: "destructive" });
      }
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to generate support report.", variant: "destructive" });
    }
  });

  const copyReportToClipboard = async () => {
    if (supportReportData?.textReport) {
      await navigator.clipboard.writeText(supportReportData.textReport);
      toast({ title: "Copied", description: "Report copied to clipboard." });
    }
  };

  const downloadReport = () => {
    if (supportReportData?.textReport && selectedError) {
      const blob = new Blob([supportReportData.textReport], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `error-report-${selectedError.errorCode}-${new Date().toISOString().split('T')[0]}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: "Downloaded", description: "Report downloaded successfully." });
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
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight" data-testid="text-page-title">Activity Centre</h1>
            <p className="text-muted-foreground">AI-powered activity insights, error monitoring & performance analytics</p>
          </div>
          <div className="flex items-center gap-2">
            <a 
              href="/api/errors/export?format=csv" 
              download
              className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2"
              data-testid="button-export-csv"
            >
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </a>
            <a 
              href="/api/errors/export?format=json" 
              download
              className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2"
              data-testid="button-export-json"
            >
              <FileText className="h-4 w-4 mr-2" />
              Export JSON
            </a>
            <Button onClick={() => refetchErrors()} variant="outline" data-testid="button-refresh">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
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
                    className="flex items-center justify-between p-3 bg-card rounded-lg border border-red-200"
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
            <TabsTrigger value="timeline" className="gap-2">
              <Activity className="h-4 w-4" />
              Transaction Timeline
            </TabsTrigger>
            <TabsTrigger value="webhooks" className="gap-2">
              <Globe className="h-4 w-4" />
              Alerting
            </TabsTrigger>
            <TabsTrigger value="ai-insights" className="gap-2">
              <Zap className="h-4 w-4" />
              AI Insights
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
                    <Button
                      variant="outline"
                      onClick={() => {
                        const params = new URLSearchParams();
                        if (filters.severity !== 'all') params.append('severity', filters.severity);
                        if (filters.status !== 'all') params.append('status', filters.status);
                        if (filters.module !== 'all') params.append('module', filters.module);
                        window.open(`/api/errors/export?${params.toString()}`, '_blank');
                      }}
                      data-testid="button-export-errors"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Export CSV
                    </Button>
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

          <TabsContent value="timeline" className="space-y-4">
            <TransactionTimeline errors={errorsData?.errors || []} onViewError={(error) => { setSelectedError(error); setDetailsOpen(true); }} />
          </TabsContent>

          <TabsContent value="webhooks" className="space-y-4">
            <WebhookAlertingSettings />
          </TabsContent>

          <TabsContent value="ai-insights" className="space-y-4">
            <AIInsightsPanel />
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
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <div className="flex gap-2 w-full sm:w-auto">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => selectedError && generateReportMutation.mutate(selectedError.id)}
                  disabled={generateReportMutation.isPending}
                  className="flex-1 sm:flex-none"
                  data-testid="button-generate-support-report"
                >
                  {generateReportMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <FileText className="h-4 w-4 mr-2" />
                  )}
                  Generate Report
                </Button>
              </div>
              <div className="flex gap-2 w-full sm:w-auto justify-end">
                <Button variant="outline" onClick={() => setDetailsOpen(false)}>Close</Button>
                {selectedError?.status !== 'resolved' && (
                  <Button onClick={() => { setDetailsOpen(false); setResolveOpen(true); }}>
                    Mark as Resolved
                  </Button>
                )}
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Support Report Dialog */}
        <Dialog open={supportReportOpen} onOpenChange={setSupportReportOpen}>
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <MessageSquareWarning className="h-5 w-5 text-blue-500" />
                Error Support Report
              </DialogTitle>
              <DialogDescription>
                Use this report when contacting Replit support or debugging the issue
              </DialogDescription>
            </DialogHeader>
            
            {supportReportData && supportReportData.textReport && (
              <div className="flex-1 overflow-hidden flex flex-col gap-4">
                {/* Deployment Context Summary */}
                {supportReportData.jsonReport?.replitContext && (
                  <div className="p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">Replit Deployment Context</p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {supportReportData.jsonReport.replitContext.replSlug && (
                        <div><span className="text-muted-foreground">Repl:</span> {supportReportData.jsonReport.replitContext.replSlug}</div>
                      )}
                      {supportReportData.jsonReport.replitContext.environment && (
                        <div><span className="text-muted-foreground">Env:</span> {supportReportData.jsonReport.replitContext.environment}</div>
                      )}
                      {supportReportData.jsonReport.replitContext.deploymentId && (
                        <div className="col-span-2"><span className="text-muted-foreground">Deployment ID:</span> {supportReportData.jsonReport.replitContext.deploymentId}</div>
                      )}
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-2 p-3 bg-muted rounded-lg">
                  <Button size="sm" onClick={copyReportToClipboard} data-testid="button-copy-report">
                    <Copy className="h-4 w-4 mr-2" />
                    Copy to Clipboard
                  </Button>
                  <Button size="sm" variant="outline" onClick={downloadReport} data-testid="button-download-report">
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                  {supportReportData.supportActions?.replitSupport && (
                    <a
                      href={supportReportData.supportActions.replitSupport}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex"
                    >
                      <Button size="sm" variant="outline" data-testid="button-replit-support">
                        <HelpCircle className="h-4 w-4 mr-2" />
                        Replit Support
                        <ExternalLink className="h-3 w-3 ml-1" />
                      </Button>
                    </a>
                  )}
                  {supportReportData.supportActions?.replitCommunity && (
                    <a
                      href={supportReportData.supportActions.replitCommunity}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex"
                    >
                      <Button size="sm" variant="outline" data-testid="button-replit-community">
                        <Users className="h-4 w-4 mr-2" />
                        Ask Community
                        <ExternalLink className="h-3 w-3 ml-1" />
                      </Button>
                    </a>
                  )}
                  {supportReportData.supportActions?.replitDocs && (
                    <a
                      href={supportReportData.supportActions.replitDocs}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex"
                    >
                      <Button size="sm" variant="outline" data-testid="button-replit-docs">
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Docs
                      </Button>
                    </a>
                  )}
                </div>

                {/* Report Content */}
                <ScrollArea className="flex-1 border rounded-lg">
                  <pre className="p-4 text-xs font-mono whitespace-pre-wrap">
                    {supportReportData.textReport}
                  </pre>
                </ScrollArea>
              </div>
            )}
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setSupportReportOpen(false)}>
                Close
              </Button>
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
  );
}
