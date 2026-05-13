import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Activity, 
  Database, 
  Server, 
  Clock, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  RefreshCw,
  Mail,
  Phone,
  CreditCard,
  Brain,
  Shield as LucideShield,
  Zap,
  MemoryStick,
  Timer,
  Bell
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";

interface ServiceHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'down' | 'unknown';
  responseTime?: number;
  lastCheck: string;
  message?: string;
  details?: Record<string, any>;
}

interface BackgroundJobHealth {
  name: string;
  status: 'running' | 'stopped' | 'error';
  lastRun?: string;
  nextRun?: string;
  successRate?: number;
  message?: string;
}

interface SystemMetrics {
  uptime: number;
  memoryUsage: {
    used: number;
    total: number;
    percentage: number;
  };
  cpuUsage?: number;
  activeConnections: number;
  requestsPerMinute?: number;
}

interface HealthAlert {
  id: string;
  severity: 'info' | 'warning' | 'critical';
  service: string;
  message: string;
  timestamp: string;
  acknowledged: boolean;
}

interface SystemHealthReport {
  overallStatus: 'healthy' | 'degraded' | 'critical';
  timestamp: string;
  services: ServiceHealth[];
  backgroundJobs: BackgroundJobHealth[];
  metrics: SystemMetrics;
  alerts: HealthAlert[];
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function formatBytes(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function getStatusColor(status: string) {
  switch (status) {
    case 'healthy':
    case 'running':
      return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300';
    case 'degraded':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300';
    case 'down':
    case 'stopped':
    case 'error':
    case 'critical':
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
    default:
      return 'bg-muted text-foreground';
  }
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'healthy':
    case 'running':
      return <CheckCircle className="w-4 h-4 text-emerald-600" />;
    case 'degraded':
      return <AlertTriangle className="w-4 h-4 text-amber-600" />;
    case 'down':
    case 'stopped':
    case 'error':
    case 'critical':
      return <XCircle className="w-4 h-4 text-red-600" />;
    default:
      return <Activity className="w-4 h-4 text-muted-foreground" />;
  }
}

function getServiceIcon(name: string) {
  if (name.toLowerCase().includes('database')) return <Database className="w-5 h-5" />;
  if (name.toLowerCase().includes('email')) return <Mail className="w-5 h-5" />;
  if (name.toLowerCase().includes('sms') || name.toLowerCase().includes('twilio')) return <Phone className="w-5 h-5" />;
  if (name.toLowerCase().includes('payment')) return <CreditCard className="w-5 h-5" />;
  if (name.toLowerCase().includes('ai')) return <Brain className="w-5 h-5" />;
  if (name.toLowerCase().includes('kyc') || name.toLowerCase().includes('verification')) return <LucideShield className="w-5 h-5" />;
  return <Server className="w-5 h-5" />;
}

export default function SystemHealthMonitor() {
  const { data: healthData, isLoading, refetch, isFetching } = useQuery<SystemHealthReport>({
    queryKey: ["/api/admin/system-health"],
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  const overallStatusColor = {
    healthy: 'bg-gradient-to-r from-emerald-500 to-green-600',
    degraded: 'bg-gradient-to-r from-amber-500 to-orange-600',
    critical: 'bg-gradient-to-r from-red-500 to-rose-600'
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">System Health Monitor</h1>
          <p className="text-sm text-muted-foreground">
            Real-time monitoring of APIs, databases, and background jobs
          </p>
        </div>
        <Button 
          onClick={() => refetch()} 
          disabled={isFetching}
          variant="outline"
          data-testid="button-refresh-health"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className={`${overallStatusColor[healthData?.overallStatus || 'healthy']} text-foreground`}>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Overall Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold capitalize">{healthData?.overallStatus || 'Unknown'}</p>
            <p className="text-sm opacity-80">
              Last check: {healthData?.timestamp ? formatDistanceToNow(new Date(healthData.timestamp), { addSuffix: true }) : 'N/A'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Timer className="w-5 h-5 text-blue-600" />
              Uptime
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-blue-600">
              {healthData?.metrics ? formatUptime(healthData.metrics.uptime) : '0m'}
            </p>
            <p className="text-sm text-muted-foreground">Since last restart</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <MemoryStick className="w-5 h-5 text-purple-600" />
              Memory Usage
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-purple-600">
              {healthData?.metrics?.memoryUsage?.percentage || 0}%
            </p>
            <Progress 
              value={healthData?.metrics?.memoryUsage?.percentage || 0} 
              className="mt-2"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {healthData?.metrics?.memoryUsage ? `${formatBytes(healthData.metrics.memoryUsage.used)} / ${formatBytes(healthData.metrics.memoryUsage.total)}` : 'N/A'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Bell className="w-5 h-5 text-orange-600" />
              Active Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-orange-600">
              {healthData?.alerts?.filter(a => !a.acknowledged).length || 0}
            </p>
            <p className="text-sm text-muted-foreground">
              {healthData?.alerts?.filter(a => a.severity === 'critical').length || 0} critical
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="services" className="w-full">
        <TabsList>
          <TabsTrigger value="services" data-testid="tab-services">Services</TabsTrigger>
          <TabsTrigger value="jobs" data-testid="tab-jobs">Background Jobs</TabsTrigger>
          <TabsTrigger value="alerts" data-testid="tab-alerts">Alerts</TabsTrigger>
        </TabsList>

        <TabsContent value="services" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Service Health</CardTitle>
              <CardDescription>Status of all connected services and APIs</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {healthData?.services?.map((service) => (
                  <div 
                    key={service.name} 
                    className="p-4 border rounded-lg bg-card space-y-3"
                    data-testid={`card-service-${service.name.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getServiceIcon(service.name)}
                        <span className="font-medium text-sm">{service.name}</span>
                      </div>
                      <Badge className={getStatusColor(service.status)}>
                        {getStatusIcon(service.status)}
                        <span className="ml-1 capitalize">{service.status}</span>
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{service.message}</p>
                    {service.responseTime !== undefined && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Zap className="w-3 h-3" />
                        <span>{service.responseTime}ms latency</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="jobs" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Background Jobs</CardTitle>
              <CardDescription>Scheduled tasks and cron jobs status</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {healthData?.backgroundJobs?.map((job) => (
                  <div 
                    key={job.name} 
                    className="flex items-center justify-between p-4 border rounded-lg"
                    data-testid={`row-job-${job.name.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(job.status)}
                        <span className="font-medium">{job.name}</span>
                      </div>
                      <Badge className={getStatusColor(job.status)}>
                        {job.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-6 text-sm text-muted-foreground">
                      {job.successRate !== undefined && (
                        <span className="flex items-center gap-1">
                          <CheckCircle className="w-4 h-4 text-emerald-600" />
                          {job.successRate}% success
                        </span>
                      )}
                      {job.lastRun && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          Last: {formatDistanceToNow(new Date(job.lastRun), { addSuffix: true })}
                        </span>
                      )}
                      {job.nextRun && (
                        <span className="flex items-center gap-1">
                          <Timer className="w-4 h-4" />
                          Next: {formatDistanceToNow(new Date(job.nextRun), { addSuffix: true })}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Health Alerts</CardTitle>
              <CardDescription>System warnings and issues requiring attention</CardDescription>
            </CardHeader>
            <CardContent>
              {(!healthData?.alerts || healthData.alerts.length === 0) ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="w-12 h-12 mx-auto mb-3 text-emerald-600" />
                  <p className="font-medium">All Systems Operational</p>
                  <p className="text-sm">No active alerts at this time</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {healthData.alerts.map((alert) => (
                    <div 
                      key={alert.id}
                      className={`p-4 border rounded-lg ${
                        alert.severity === 'critical' ? 'border-red-300 bg-red-50 dark:bg-red-950' :
                        alert.severity === 'warning' ? 'border-amber-300 bg-amber-50 dark:bg-amber-950' :
                        'border-blue-300 bg-blue-50 dark:bg-blue-950'
                      }`}
                      data-testid={`alert-${alert.id}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {alert.severity === 'critical' ? 
                            <XCircle className="w-5 h-5 text-red-600" /> :
                            alert.severity === 'warning' ?
                            <AlertTriangle className="w-5 h-5 text-amber-600" /> :
                            <Activity className="w-5 h-5 text-blue-600" />
                          }
                          <span className="font-medium">{alert.service}</span>
                          <Badge className={
                            alert.severity === 'critical' ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200' :
                            alert.severity === 'warning' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200' :
                            'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200'
                          }>
                            {alert.severity}
                          </Badge>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(alert.timestamp), { addSuffix: true })}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">{alert.message}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
