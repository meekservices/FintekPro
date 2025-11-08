import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Activity, 
  AlertCircle, 
  CheckCircle, 
  Clock, 
  Database, 
  Server, 
  Zap,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  ExternalLink
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ServiceHealthStatus {
  service: string;
  status: 'healthy' | 'degraded' | 'down';
  latencyMs?: number;
  lastCheck: string;
  details?: string;
}

interface SystemMetrics {
  totalRequests: number;
  errorRate: number;
  p95Latency: number;
  uptime: number;
  activeUsers: number;
  timestamp: string;
}

interface ErrorLog {
  id: string;
  timestamp: string;
  level: string;
  message: string;
  service: string;
  stackTrace?: string;
  count: number;
  aiSummary?: string;
}

export default function SystemMonitoring() {
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Service health check query (refresh every 30s)
  const { data: serviceHealth, isLoading: healthLoading, refetch: refetchHealth } = useQuery<ServiceHealthStatus[]>({
    queryKey: ['/api/admin/monitoring/service-health'],
    refetchInterval: autoRefresh ? 30000 : false,
  });

  // System metrics query (refresh every 30s)
  const { data: metrics, isLoading: metricsLoading, refetch: refetchMetrics } = useQuery<SystemMetrics>({
    queryKey: ['/api/admin/monitoring/metrics'],
    refetchInterval: autoRefresh ? 30000 : false,
  });

  // Error logs query (refresh every 10s for near real-time)
  const { data: errorLogs, isLoading: logsLoading, refetch: refetchLogs } = useQuery<{ logs: ErrorLog[]; count: number }>({
    queryKey: ['/api/admin/monitoring/error-logs'],
    refetchInterval: autoRefresh ? 10000 : false,
  });

  const handleRefreshAll = () => {
    refetchHealth();
    refetchMetrics();
    refetchLogs();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-500';
      case 'degraded': return 'text-yellow-500';
      case 'down': return 'text-red-500';
      default: return 'text-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="h-5 w-5" />;
      case 'degraded': return <AlertCircle className="h-5 w-5" />;
      case 'down': return <AlertCircle className="h-5 w-5" />;
      default: return <Clock className="h-5 w-5" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">System Monitoring & Errors</h1>
          <p className="text-gray-400 mt-1">Live observability with AI-powered diagnostics</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefreshAll}
            className="bg-gray-800 border-gray-700 text-gray-300"
            data-testid="button-refresh-monitoring"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh All
          </Button>
          <Button
            variant={autoRefresh ? "default" : "outline"}
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={cn(
              autoRefresh 
                ? "bg-green-600 hover:bg-green-700" 
                : "bg-gray-800 border-gray-700 text-gray-300"
            )}
            data-testid="button-toggle-autorefresh"
          >
            <Activity className={cn("h-4 w-4 mr-2", autoRefresh && "animate-pulse")} />
            {autoRefresh ? "Auto-Refresh ON" : "Auto-Refresh OFF"}
          </Button>
        </div>
      </div>

      {/* System Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">Total Requests</CardTitle>
          </CardHeader>
          <CardContent>
            {metricsLoading ? (
              <div className="h-8 bg-gray-700 animate-pulse rounded" />
            ) : (
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-white">
                  {metrics?.totalRequests.toLocaleString() || '0'}
                </span>
                <TrendingUp className="h-4 w-4 text-green-500" />
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-gray-800 border-gray-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">Error Rate</CardTitle>
          </CardHeader>
          <CardContent>
            {metricsLoading ? (
              <div className="h-8 bg-gray-700 animate-pulse rounded" />
            ) : (
              <div className="flex items-baseline gap-2">
                <span className={cn(
                  "text-2xl font-bold",
                  (metrics?.errorRate || 0) > 5 ? "text-red-500" : "text-green-500"
                )}>
                  {metrics?.errorRate.toFixed(2) || '0.00'}%
                </span>
                {(metrics?.errorRate || 0) > 5 ? (
                  <TrendingUp className="h-4 w-4 text-red-500" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-green-500" />
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-gray-800 border-gray-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">P95 Latency</CardTitle>
          </CardHeader>
          <CardContent>
            {metricsLoading ? (
              <div className="h-8 bg-gray-700 animate-pulse rounded" />
            ) : (
              <div className="flex items-baseline gap-2">
                <span className={cn(
                  "text-2xl font-bold",
                  (metrics?.p95Latency || 0) > 1000 ? "text-yellow-500" : "text-green-500"
                )}>
                  {metrics?.p95Latency || '0'}
                </span>
                <span className="text-sm text-gray-400">ms</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-gray-800 border-gray-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-400">System Uptime</CardTitle>
          </CardHeader>
          <CardContent>
            {metricsLoading ? (
              <div className="h-8 bg-gray-700 animate-pulse rounded" />
            ) : (
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-green-500">
                  {metrics?.uptime.toFixed(2) || '0.00'}%
                </span>
                <CheckCircle className="h-4 w-4 text-green-500" />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Service Health Status */}
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Server className="h-5 w-5" />
            Service Health Status
          </CardTitle>
          <CardDescription className="text-gray-400">
            Real-time health checks for all critical services
          </CardDescription>
        </CardHeader>
        <CardContent>
          {healthLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-16 bg-gray-700 animate-pulse rounded" />
              ))}
            </div>
          ) : serviceHealth && serviceHealth.length > 0 ? (
            <div className="space-y-3">
              {serviceHealth.map((service) => (
                <div 
                  key={service.service}
                  className="flex items-center justify-between p-4 bg-gray-900 rounded-lg border border-gray-700"
                  data-testid={`service-${service.service}`}
                >
                  <div className="flex items-center gap-4">
                    <div className={cn("flex items-center gap-2", getStatusColor(service.status))}>
                      {getStatusIcon(service.status)}
                      <span className="font-medium">{service.service}</span>
                    </div>
                    {service.latencyMs && (
                      <Badge variant="outline" className="bg-gray-800 border-gray-600 text-gray-300">
                        {service.latencyMs}ms
                      </Badge>
                    )}
                    {service.details && (
                      <span className="text-sm text-gray-400">{service.details}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-sm text-gray-400">
                    <span>Last check: {new Date(service.lastCheck).toLocaleTimeString()}</span>
                    <Badge 
                      variant={service.status === 'healthy' ? 'default' : 'destructive'}
                      className={cn(
                        service.status === 'healthy' ? 'bg-green-600' : 
                        service.status === 'degraded' ? 'bg-yellow-600' : 'bg-red-600'
                      )}
                    >
                      {service.status.toUpperCase()}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">
              <Server className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No service health data available</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Error Stream */}
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            Error Stream
            {autoRefresh && (
              <Badge variant="outline" className="ml-2 bg-green-600 border-green-500 text-white">
                <Activity className="h-3 w-3 mr-1 animate-pulse" />
                Live
              </Badge>
            )}
          </CardTitle>
          <CardDescription className="text-gray-400">
            Recent errors with AI-powered root cause analysis
          </CardDescription>
        </CardHeader>
        <CardContent>
          {logsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-24 bg-gray-700 animate-pulse rounded" />
              ))}
            </div>
          ) : errorLogs && errorLogs.logs.length > 0 ? (
            <div className="space-y-3">
              {errorLogs.logs.map((log) => (
                <div 
                  key={log.id}
                  className="p-4 bg-gray-900 rounded-lg border border-gray-700 hover:border-gray-600 transition-colors"
                  data-testid={`error-log-${log.id}`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <Badge 
                        variant="destructive" 
                        className={cn(
                          log.level === 'error' ? 'bg-red-600' : 
                          log.level === 'warn' ? 'bg-yellow-600' : 'bg-gray-600'
                        )}
                      >
                        {log.level.toUpperCase()}
                      </Badge>
                      <span className="text-sm text-gray-400">{log.service}</span>
                      <Badge variant="outline" className="bg-gray-800 border-gray-600 text-gray-300">
                        {log.count}x occurrences
                      </Badge>
                    </div>
                    <span className="text-sm text-gray-400">
                      {new Date(log.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-white font-mono text-sm mb-2">{log.message}</p>
                  {log.aiSummary && (
                    <div className="mt-3 p-3 bg-blue-900/20 border border-blue-700/50 rounded">
                      <div className="flex items-start gap-2">
                        <Zap className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-blue-300 mb-1">AI Analysis</p>
                          <p className="text-sm text-gray-300">{log.aiSummary}</p>
                        </div>
                      </div>
                    </div>
                  )}
                  {log.stackTrace && (
                    <details className="mt-3">
                      <summary className="text-sm text-gray-400 cursor-pointer hover:text-gray-300">
                        View Stack Trace
                      </summary>
                      <pre className="mt-2 p-3 bg-gray-950 rounded text-xs text-gray-400 overflow-x-auto">
                        {log.stackTrace}
                      </pre>
                    </details>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">
              <CheckCircle className="h-12 w-12 mx-auto mb-3 text-green-500 opacity-50" />
              <p>No errors detected - system running smoothly!</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
