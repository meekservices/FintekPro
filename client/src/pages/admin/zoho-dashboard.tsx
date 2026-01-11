import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Link } from 'wouter';
import { Activity, Database, Webhook, TrendingUp, AlertCircle, CheckCircle } from 'lucide-react';

interface ZohoConnection {
  id: string;
  connectionName: string;
  isActive: boolean;
  enabledServices?: string[];
  zohoDataCenter: string;
}

interface SyncStat {
  count: string | number;
  status: string;
}

interface RateLimit {
  percentUsed: number;
  availableTokens: number;
}

interface SyncLog {
  id: string;
  zohoService: string;
  operation: string;
  entityType: string;
  status: string;
  recordsProcessed?: number;
  durationMs?: number;
  createdAt: string;
}

interface StatsResponse {
  syncStats?: SyncStat[];
  webhookStats?: SyncStat[];
}

interface RateLimitsResponse {
  rateLimits?: RateLimit[];
}

interface SyncLogsResponse {
  logs?: SyncLog[];
}

export default function ZohoDashboardPage() {
  const { data: connections, isLoading: loadingConnections } = useQuery<ZohoConnection[]>({
    queryKey: ['/api/zoho/connections']
  });

  const { data: rateLimits } = useQuery<RateLimitsResponse>({
    queryKey: ['/api/zoho/admin/rate-limits']
  });

  const { data: stats } = useQuery<StatsResponse>({
    queryKey: ['/api/zoho/admin/stats?days=7']
  });

  const { data: recentLogs } = useQuery<SyncLogsResponse>({
    queryKey: ['/api/zoho/admin/sync-logs?limit=5']
  });

  const activeConnections = connections?.filter(c => c.isActive) || [];
  const totalSyncs = stats?.syncStats?.reduce((sum, s) => sum + Number(s.count), 0) || 0;
  const successfulSyncs = stats?.syncStats
    ?.filter(s => s.status === 'success')
    .reduce((sum, s) => sum + Number(s.count), 0) || 0;
  const successRate = totalSyncs > 0 ? ((successfulSyncs / totalSyncs) * 100).toFixed(1) : '0';

  const getConnectionHealth = () => {
    if (activeConnections.length === 0) return { status: 'No Connections', color: 'gray' };
    const limits = rateLimits?.rateLimits || [];
    if (limits.length === 0) return { status: 'Unknown', color: 'gray' };
    
    const avgTokens = limits.reduce((sum, r) => sum + (r.percentUsed || 0), 0) / limits.length;
    
    if (avgTokens > 90) return { status: 'Critical', color: 'red' };
    if (avgTokens > 70) return { status: 'Warning', color: 'yellow' };
    return { status: 'Healthy', color: 'green' };
  };

  const connectionHealth = getConnectionHealth();

  if (loadingConnections) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-muted-foreground">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Zoho Integration Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Monitor and manage Zoho One integrations across CRM, Books, Desk, and WorkDrive
        </p>
      </div>

      {/* Health Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card data-testid="card-connection-health">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Connection Health</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{connectionHealth.status}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {activeConnections.length} active connection{activeConnections.length !== 1 ? 's' : ''}
            </p>
            <Badge 
              variant={
                connectionHealth.color === 'green' ? 'default' : 
                connectionHealth.color === 'yellow' ? 'secondary' : 
                'destructive'
              }
              className="mt-2"
            >
              {connectionHealth.color === 'green' && <CheckCircle className="w-3 h-3 mr-1" />}
              {connectionHealth.color !== 'green' && <AlertCircle className="w-3 h-3 mr-1" />}
              {connectionHealth.status}
            </Badge>
          </CardContent>
        </Card>

        <Card data-testid="card-total-syncs">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Syncs (7d)</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalSyncs.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {successfulSyncs.toLocaleString()} successful
            </p>
            <div className="text-xs text-green-600 mt-2">
              {successRate}% success rate
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-webhook-events">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Webhook Events (7d)</CardTitle>
            <Webhook className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.webhookStats?.reduce((sum, s) => sum + Number(s.count), 0) || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Real-time updates received
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-api-usage">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">API Rate Limit</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {rateLimits?.rateLimits && rateLimits.rateLimits.length > 0 && rateLimits.rateLimits[0].percentUsed != null
                ? `${rateLimits.rateLimits[0].percentUsed.toFixed(1)}%`
                : '0%'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {rateLimits?.rateLimits && rateLimits.rateLimits.length > 0 && rateLimits.rateLimits[0].availableTokens != null
                ? `${Math.floor(rateLimits.rateLimits[0].availableTokens).toLocaleString()} / 50,000 credits`
                : '50,000 / 50,000 credits'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Active Connections */}
      <Card>
        <CardHeader>
          <CardTitle>Active Connections</CardTitle>
          <CardDescription>
            Zoho services currently connected to FintekPro
          </CardDescription>
        </CardHeader>
        <CardContent>
          {activeConnections.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">No active Zoho connections</p>
              <Link href="/admin/zoho-connections">
                <Button data-testid="button-setup-connection">Setup New Connection</Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {activeConnections.map((conn) => (
                <div key={conn.id} className="flex items-center justify-between p-4 border rounded-lg" data-testid={`connection-${conn.id}`}>
                  <div className="flex-1">
                    <h3 className="font-medium">{conn.connectionName}</h3>
                    <div className="flex gap-2 mt-2">
                      {conn.enabledServices?.map((service) => (
                        <Badge key={service} variant="outline">{service}</Badge>
                      ))}
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant={conn.isActive ? 'default' : 'secondary'}>
                      {conn.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                    <div className="text-xs text-muted-foreground mt-1">
                      Data Center: {conn.zohoDataCenter}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Recent Sync Activity</CardTitle>
              <CardDescription>Latest synchronization operations</CardDescription>
            </div>
            <Link href="/admin/zoho-logs">
              <Button variant="outline" size="sm" data-testid="button-view-all-logs">
                View All Logs
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {!recentLogs?.logs || recentLogs.logs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No sync activity yet
            </div>
          ) : (
            <div className="space-y-3">
              {recentLogs.logs.map((log) => (
                <div key={log.id} className="flex items-center justify-between py-2 border-b last:border-0" data-testid={`log-${log.id}`}>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{log.zohoService || 'Unknown'}</Badge>
                      <span className="text-sm font-medium">{log.operation || 'N/A'}</span>
                      <span className="text-sm text-muted-foreground">{log.entityType || 'N/A'}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {log.recordsProcessed || 0} records • {log.durationMs || 0}ms
                    </div>
                  </div>
                  <div>
                    <Badge variant={log.status === 'success' ? 'default' : 'destructive'}>
                      {log.status}
                    </Badge>
                    <div className="text-xs text-muted-foreground mt-1">
                      {new Date(log.createdAt).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-3">
        <Link href="/admin/zoho-connections">
          <Card className="cursor-pointer hover:bg-accent transition-colors" data-testid="card-manage-connections">
            <CardHeader>
              <CardTitle className="text-base">Manage Connections</CardTitle>
              <CardDescription>Configure Zoho OAuth and services</CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/admin/zoho-logs">
          <Card className="cursor-pointer hover:bg-accent transition-colors" data-testid="card-sync-logs">
            <CardHeader>
              <CardTitle className="text-base">View Sync Logs</CardTitle>
              <CardDescription>Filter and export sync history</CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/admin/zoho-webhooks">
          <Card className="cursor-pointer hover:bg-accent transition-colors" data-testid="card-webhook-events">
            <CardHeader>
              <CardTitle className="text-base">Webhook Events</CardTitle>
              <CardDescription>Monitor incoming webhooks</CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </div>
    </div>
  );
}
