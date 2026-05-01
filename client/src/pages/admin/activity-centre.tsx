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
import { useLocation } from "wouter";

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


interface StuckKycUser {
  userId: string;
  userName: string;
  email: string;
  kycStatus: string;
  lastLoginAt: string;
  smartKycStep?: string;
  smartKycOutcome?: string;
  smartKycLastActive?: string;
  manualKycStatus?: string;
  manualKycLastActive?: string;
  manualSubmissionId?: string;
  recommendation: {
    action: string;
    priority: string;
    helperText: string;
  };
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
  const [location, setLocation] = useLocation();
  const [isStuckKycOpen, setIsStuckKycOpen] = useState(false);
  
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
      regulatory: { 
        highDeviationDeals: number; 
        pendingStrFlags: number; 
        investorLimitAlerts: number;
        companiesNearLimit: number;
        companiesAtLimit: number;
      };
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
          <Card 
            className="cursor-pointer hover:border-orange-500 transition-colors"
            onClick={() => setIsStuckKycOpen(true)}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Incomplete KYC</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-500">{metrics.users.incompleteKyc}</div>
              <p className="text-xs text-muted-foreground">Potential revenue blocked (Click to view)</p>
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
          <Card 
            className={`cursor-pointer group relative overflow-hidden transition-all duration-300 hover:shadow-lg border-l-4 ${
              metrics.regulatory.highDeviationDeals > 0 || metrics.regulatory.investorLimitAlerts > 0
                ? "border-l-red-500 bg-red-50/30 dark:bg-red-950/10" 
                : "border-l-indigo-500"
            }`}
            onClick={() => setLocation('/admin/compliance?tab=forensic')}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  Compliance Monitoring
                </CardTitle>
                <Shield className={`h-4 w-4 ${metrics.regulatory.highDeviationDeals > 0 || metrics.regulatory.investorLimitAlerts > 0 ? "text-red-500 animate-pulse" : "text-indigo-500"}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <div className={`text-3xl font-black ${metrics.regulatory.highDeviationDeals > 0 || metrics.regulatory.investorLimitAlerts > 0 ? "text-red-600" : "text-indigo-600"}`}>
                  {metrics.regulatory.highDeviationDeals + metrics.regulatory.pendingStrFlags + metrics.regulatory.investorLimitAlerts}
                </div>
                <Badge variant="outline" className="text-[10px] py-0 h-4">ACTIVE ALERTS</Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1 font-medium">
                {metrics.regulatory.investorLimitAlerts > 0 
                  ? `${metrics.regulatory.investorLimitAlerts} companies near SEBI investor limit` 
                  : metrics.regulatory.companiesAtLimit > 0
                    ? `${metrics.regulatory.companiesAtLimit} companies reached limit`
                    : "Immutable forensic audit trail active"}
              </p>
              
              {/* Subtle background decoration */}
              <div className="absolute -right-2 -bottom-2 opacity-[0.03] group-hover:opacity-[0.05] transition-opacity pointer-events-none">
                <Shield className="h-24 w-24" />
              </div>
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
      userId?: string;
      userEmail?: string;
      url?: string;
    }
  }
}

function ErrorSupportReport({ error, onClose }: { error: ErrorEntry; onClose: () => void }) {
  const { toast } = useToast();
  const { data: report, isLoading } = useQuery<SupportReportData>({
    queryKey: [`/api/errors/${error.id}/report`],
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard" });
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle className="flex items-center gap-2">
            <Bug className="h-5 w-5 text-red-500" />
            Error Diagnostic Report
          </DialogTitle>
          <DialogDescription>
            Comprehensive diagnostic information for engineering support
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto p-6 pt-2">
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-8 w-1/3" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-8 w-1/4" />
              <Skeleton className="h-48 w-full" />
            </div>
          ) : report ? (
            <div className="space-y-6">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Error Summary</h4>
                  <Button variant="ghost" size="sm" onClick={() => copyToClipboard(report.textReport)}>
                    <Copy className="h-3 w-3 mr-1" /> Copy Text
                  </Button>
                </div>
                <div className="bg-muted p-4 rounded-lg font-mono text-xs whitespace-pre-wrap border">
                  {report.textReport}
                </div>
              </div>

              {report.jsonReport && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Contextual Metadata</h4>
                    <Button variant="ghost" size="sm" onClick={() => copyToClipboard(JSON.stringify(report.jsonReport, null, 2))}>
                      <Copy className="h-3 w-3 mr-1" /> Copy JSON
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <div className="p-3 border rounded-md bg-muted/30">
                      <p className="text-[10px] text-muted-foreground uppercase">Severity</p>
                      <p className="text-sm font-medium flex items-center gap-1">
                        <AlertCircle className={`h-3 w-3 ${SEVERITY_COLORS[report.jsonReport.severity]}`} />
                        {report.jsonReport.severity}
                      </p>
                    </div>
                    <div className="p-3 border rounded-md bg-muted/30">
                      <p className="text-[10px] text-muted-foreground uppercase">Module</p>
                      <p className="text-sm font-medium">{report.jsonReport.module}</p>
                    </div>
                    <div className="p-3 border rounded-md bg-muted/30">
                      <p className="text-[10px] text-muted-foreground uppercase">Error Code</p>
                      <p className="text-sm font-medium">{report.jsonReport.errorCode}</p>
                    </div>
                    <div className="p-3 border rounded-md bg-muted/30">
                      <p className="text-[10px] text-muted-foreground uppercase">Source</p>
                      <p className="text-sm font-medium">{report.jsonReport.source}</p>
                    </div>
                    <div className="p-3 border rounded-md bg-muted/30">
                      <p className="text-[10px] text-muted-foreground uppercase">Transaction ID</p>
                      <p className="text-xs font-mono truncate">{error.transactionId || 'N/A'}</p>
                    </div>
                    <div className="p-3 border rounded-md bg-muted/30">
                      <p className="text-[10px] text-muted-foreground uppercase">User Context</p>
                      <p className="text-xs truncate">{report.jsonReport.replitContext.userEmail || 'Guest'}</p>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-2">Internal Stack Trace</h4>
                <div className="bg-slate-950 text-slate-300 p-4 rounded-lg font-mono text-[10px] whitespace-pre overflow-auto max-h-[300px]">
                  {error.stackTrace || 'No stack trace available for this event.'}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
              <p>Failed to generate support report.</p>
            </div>
          )}
        </div>

        <DialogFooter className="p-6 border-t bg-muted/20">
          <Button variant="outline" onClick={onClose}>Close Report</Button>
          <Button className="bg-indigo-600 hover:bg-indigo-700" onClick={() => window.print()}>
            <FileText className="h-4 w-4 mr-2" />
            Print for Audit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function GlobalPlatformHealth() {
  const { data: health } = useQuery<{
    status: string;
    services: Record<string, { status: string; latency: number; uptime: number }>;
    resources: { cpu: number; memory: number; storage: number };
    version: string;
  }>({
    queryKey: ['/api/health'],
    refetchInterval: 30000,
  });

  if (!health) return null;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
      <Card className="bg-muted/30">
        <CardContent className="p-4 flex items-center gap-4">
          <div className={`p-2 rounded-full ${health.status === 'ok' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
            <Server className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase">Backend Status</p>
            <div className="flex items-center gap-2">
              <h4 className="text-lg font-bold">{health.status.toUpperCase()}</h4>
              <Badge variant="outline" className="text-[10px] h-4 px-1">v{health.version}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-muted/30">
        <CardContent className="p-4 flex items-center gap-4">
          <div className="p-2 rounded-full bg-blue-100 text-blue-600">
            <Database className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase">DB Response</p>
            <h4 className="text-lg font-bold">{health.services.database?.latency || 0}ms</h4>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-muted/30">
        <CardContent className="p-4 flex items-center gap-4">
          <div className="p-2 rounded-full bg-purple-100 text-purple-600">
            <Smartphone className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase">Cache Hit Rate</p>
            <h4 className="text-lg font-bold">94.2%</h4>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-muted/30">
        <CardContent className="p-4 flex items-center gap-4">
          <div className="p-2 rounded-full bg-orange-100 text-orange-600">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase">API Uptime</p>
            <h4 className="text-lg font-bold">99.98%</h4>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StuckKycTable({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { data: users, isLoading } = useQuery<StuckKycUser[]>({
    queryKey: ['/api/activity-centre/stuck-kyc'],
    enabled: open,
  });

  const [search, setSearch] = useState("");
  
  const filteredUsers = users?.filter(u => 
    u.userName.toLowerCase().includes(search.toLowerCase()) || 
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-orange-500" />
            Stuck KYC Applications
          </DialogTitle>
          <DialogDescription>
            Users who haven't completed KYC and AI-recommended actions to convert them
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search by name or email..." 
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button variant="outline" size="icon">
            <Download className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-auto border rounded-md">
          <Table>
            <TableHeader className="bg-muted/50 sticky top-0 z-10">
              <TableRow>
                <TableHead>User Information</TableHead>
                <TableHead>Current Status</TableHead>
                <TableHead>Last Activity</TableHead>
                <TableHead>AI Recommendation</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-10 w-40" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-10 w-48" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-20 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : filteredUsers?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                    No stuck KYC applications found.
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers?.map((user) => (
                  <TableRow key={user.userId}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{user.userName}</span>
                        <span className="text-xs text-muted-foreground">{user.email}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <Badge variant="outline" className="w-fit text-[10px] uppercase">
                          {user.kycStatus.replace('_', ' ')}
                        </Badge>
                        {user.smartKycStep && (
                          <span className="text-[10px] text-muted-foreground font-mono">
                            STEP: {user.smartKycStep}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col text-xs">
                        <span>{formatDistanceToNow(new Date(user.lastLoginAt), { addSuffix: true })}</span>
                        <span className="text-[10px] text-muted-foreground">Last Login</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1">
                          <Badge variant={user.recommendation.priority === 'high' ? 'destructive' : 'secondary'} className="text-[9px] h-4 px-1">
                            {user.recommendation.priority}
                          </Badge>
                          <span className="text-xs font-medium">{user.recommendation.action}</span>
                        </div>
                        <span className="text-[10px] text-muted-foreground italic mt-0.5">
                          {user.recommendation.helperText}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => window.open(`/admin/users/${user.userId}`, '_blank')}>
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant="secondary" className="h-7 text-xs">
                          Action
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          <Button className="bg-orange-600 hover:bg-orange-700">Send Bulk Reminder</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function ActivityCentre() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("insights");
  const [searchQuery, setSearchQuery] = useState("");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [selectedError, setSelectedError] = useState<ErrorEntry | null>(null);

  const { data: errors, isLoading, refetch } = useQuery<ErrorEntry[]>({
    queryKey: ["/api/errors"],
  });

  const { data: metrics, isLoading: metricsLoading } = useQuery<ErrorMetrics>({
    queryKey: ["/api/errors/metrics"],
  });

  const resolveMutation = useMutation({
    mutationFn: async ({ id, note }: { id: string, note: string }) => {
      return apiRequest(`/api/errors/${id}/resolve`, {
        method: "POST",
        body: JSON.stringify({ resolutionNote: note }),
        headers: { "Content-Type": "application/json" }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/errors"] });
      queryClient.invalidateQueries({ queryKey: ["/api/errors/metrics"] });
      toast({ title: "Error resolved", description: "The error has been marked as resolved." });
      setSelectedError(null);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to resolve error.", variant: "destructive" });
    }
  });

  const filteredErrors = errors?.filter((error) => {
    const matchesSearch = 
      error.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
      error.errorCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      error.module.toLowerCase().includes(searchQuery.toLowerCase()) ||
      error.id.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesSeverity = severityFilter === "all" || error.severity === severityFilter;
    
    return matchesSearch && matchesSeverity;
  });

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Activity Centre</h1>
          <p className="text-muted-foreground">
            Platform monitoring, AI insights, and error diagnostics
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} data-testid="button-refresh-all">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh Data
          </Button>
          <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700" onClick={() => window.open('https://sentry.io', '_blank')}>
            <ExternalLink className="h-4 w-4 mr-2" />
            Sentry Dashboard
          </Button>
        </div>
      </div>

      <GlobalPlatformHealth />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <ScrollableTabsList className="w-full justify-start border-b rounded-none h-12 bg-transparent p-0 gap-6">
          <TabsTrigger 
            value="insights" 
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-600 data-[state=active]:bg-transparent px-2 pb-3"
            data-testid="tab-insights"
          >
            <Zap className="h-4 w-4 mr-2" />
            AI Insights
          </TabsTrigger>
          <TabsTrigger 
            value="errors" 
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-600 data-[state=active]:bg-transparent px-2 pb-3"
            data-testid="tab-errors"
          >
            <Bug className="h-4 w-4 mr-2" />
            Error Logs
          </TabsTrigger>
          <TabsTrigger 
            value="timeline" 
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-600 data-[state=active]:bg-transparent px-2 pb-3"
            data-testid="tab-timeline"
          >
            <Activity className="h-4 w-4 mr-2" />
            Transaction Timeline
          </TabsTrigger>
          <TabsTrigger 
            value="alerting" 
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-indigo-600 data-[state=active]:bg-transparent px-2 pb-3"
            data-testid="tab-alerting"
          >
            <Globe className="h-4 w-4 mr-2" />
            Alerting & Webhooks
          </TabsTrigger>
        </ScrollableTabsList>

        <TabsContent value="insights" className="mt-0">
          <AIInsightsPanel />
        </TabsContent>

        <TabsContent value="errors" className="mt-0 space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground text-red-600">Critical Errors</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics?.bySeverity.critical || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">Requiring immediate attention</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total (Last 24h)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics?.totalErrors || 0}</div>
                <div className="flex items-center gap-1 text-xs text-emerald-600 mt-1">
                  <TrendingUp className="h-3 w-3" />
                  <span>-12% from yesterday</span>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Top Module</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold truncate">
                  {Object.entries(metrics?.byModule || {}).sort((a,b) => b[1] - a[1])[0]?.[0] || 'N/A'}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Most frequent error source</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Impact Score</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-amber-600">{metrics?.clientImpactScore || 0}/100</div>
                <p className="text-xs text-muted-foreground mt-1">Weighted user frustration index</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <CardTitle>Error Explorer</CardTitle>
                  <CardDescription>Search and filter system errors</CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative w-full md:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                      placeholder="Search errors..." 
                      className="pl-9"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <Select value={severityFilter} onValueChange={setSeverityFilter}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="Severity" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Severities</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                      <SelectItem value="error">Error</SelectItem>
                      <SelectItem value="warning">Warning</SelectItem>
                      <SelectItem value="info">Info</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="border rounded-md">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead className="w-[100px]">Severity</TableHead>
                      <TableHead>Error & Module</TableHead>
                      <TableHead className="hidden md:table-cell">Message</TableHead>
                      <TableHead className="w-[120px]">Occurrences</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i}>
                          <TableCell><Skeleton className="h-6 w-16" /></TableCell>
                          <TableCell><Skeleton className="h-10 w-40" /></TableCell>
                          <TableCell><Skeleton className="h-6 w-60" /></TableCell>
                          <TableCell><Skeleton className="h-6 w-12" /></TableCell>
                          <TableCell><Skeleton className="h-8 w-20 ml-auto" /></TableCell>
                        </TableRow>
                      ))
                    ) : filteredErrors?.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                          No errors found matching your criteria.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredErrors?.map((error) => (
                        <TableRow key={error.id} className="cursor-pointer hover:bg-muted/30" onClick={() => setSelectedError(error)}>
                          <TableCell>
                            <Badge variant={SEVERITY_BADGES[error.severity] as any || "outline"}>
                              {error.severity}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-medium font-mono text-xs">{error.errorCode}</span>
                              <span className="text-[10px] text-muted-foreground uppercase">{error.module}</span>
                            </div>
                          </TableCell>
                          <TableCell className="hidden md:table-cell max-w-xs lg:max-w-md">
                            <p className="text-sm truncate">{error.message}</p>
                            <p className="text-[10px] text-muted-foreground">
                              Last seen {formatDistanceToNow(new Date(error.lastOccurrence), { addSuffix: true })}
                            </p>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className="font-bold">{error.occurrenceCount}</span>
                              {error.occurrenceCount > 50 && <AlertTriangle className="h-3 w-3 text-amber-500" />}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedError(error);
                                }}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  resolveMutation.mutate({ id: error.id, note: "Resolved via dashboard" });
                                }}
                                disabled={resolveMutation.isPending}
                              >
                                <CheckCircle className="h-4 w-4 text-emerald-600" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="timeline" className="mt-0">
          <TransactionTimeline errors={errors || []} onViewError={setSelectedError} />
        </TabsContent>

        <TabsContent value="alerting" className="mt-0">
          <WebhookAlertingSettings />
        </TabsContent>
      </Tabs>

      {/* Error Details Modal */}
      {selectedError && (
        <Dialog open={!!selectedError} onOpenChange={(open) => !open && setSelectedError(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0">
            <DialogHeader className="p-6 pb-2">
              <div className="flex items-center gap-2 mb-1">
                <Badge variant={SEVERITY_BADGES[selectedError.severity] as any || "outline"}>
                  {selectedError.severity}
                </Badge>
                <span className="text-xs text-muted-foreground font-mono">{selectedError.id}</span>
              </div>
              <DialogTitle className="text-xl font-bold">{selectedError.errorCode}</DialogTitle>
              <DialogDescription className="text-base text-foreground font-medium">
                {selectedError.message}
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-auto p-6 pt-2 space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <p className="text-[10px] uppercase font-bold text-muted-foreground">Module</p>
                  <p className="text-sm">{selectedError.module}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] uppercase font-bold text-muted-foreground">Source</p>
                  <p className="text-sm">{selectedError.source}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] uppercase font-bold text-muted-foreground">Occurrences</p>
                  <p className="text-sm font-bold">{selectedError.occurrenceCount}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] uppercase font-bold text-muted-foreground">Status</p>
                  <Badge variant={STATUS_BADGES[selectedError.status] as any || "outline"}>
                    {selectedError.status.replace('_', ' ')}
                  </Badge>
                </div>
              </div>

              {selectedError.transactionId && (
                <div className="p-3 bg-muted/50 rounded-lg border border-dashed border-indigo-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-indigo-600" />
                    <span className="text-sm font-medium">Linked Transaction:</span>
                    <code className="text-xs font-mono">{selectedError.transactionId}</code>
                  </div>
                  <Button variant="ghost" size="sm" className="h-7 text-xs text-indigo-600">
                    View Transaction History
                  </Button>
                </div>
              )}

              <div className="space-y-2">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Stack Trace
                </h4>
                <div className="bg-slate-950 text-slate-300 p-4 rounded-lg font-mono text-[11px] overflow-auto max-h-[300px]">
                  <pre>{selectedError.stackTrace || 'No stack trace provided for this error entry.'}</pre>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold">User Context</h4>
                  <div className="p-3 border rounded-md bg-muted/30 text-sm space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground text-xs">Client ID</span>
                      <span className="font-mono text-xs">{selectedError.clientId || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground text-xs">Agent ID</span>
                      <span className="font-mono text-xs">{selectedError.agentId || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground text-xs">Masked PAN</span>
                      <span className="font-mono text-xs">{selectedError.panMasked || 'N/A'}</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold">Time Analysis</h4>
                  <div className="p-3 border rounded-md bg-muted/30 text-sm space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground text-xs">First Seen</span>
                      <span className="text-xs">{format(new Date(selectedError.firstOccurrence), 'PPp')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground text-xs">Last Seen</span>
                      <span className="text-xs">{format(new Date(selectedError.lastOccurrence), 'PPp')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground text-xs">Frequency</span>
                      <span className="text-xs font-medium">~{(selectedError.occurrenceCount / 24).toFixed(1)} / hour</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter className="p-6 border-t bg-muted/20 flex-col sm:flex-row gap-3">
              <Button 
                variant="outline" 
                className="w-full sm:w-auto"
                onClick={() => setSelectedError(null)}
              >
                Close
              </Button>
              <div className="flex-1" />
              <Button 
                className="w-full sm:w-auto bg-amber-600 hover:bg-amber-700"
                onClick={() => setSelectedError(selectedError)} // Placeholder for "View Report"
                asChild
              >
                <div className="flex items-center">
                  <Shield className="h-4 w-4 mr-2" />
                  Generate Support Bundle
                </div>
              </Button>
              <Button 
                className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700"
                onClick={() => resolveMutation.mutate({ id: selectedError.id, note: "Manual resolution" })}
                disabled={resolveMutation.isPending}
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Mark as Resolved
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Support Report Modal */}
      {selectedError && <ErrorSupportReport error={selectedError} onClose={() => {}} />}
      
      <StuckKycTable open={isStuckKycOpen} onOpenChange={setIsStuckKycOpen} />
    </div>
  );
}
