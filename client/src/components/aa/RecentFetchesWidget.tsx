import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  Clock,
  ExternalLink,
  RefreshCw
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { useLocation } from 'wouter';

interface FetchLog {
  id: number;
  sessionId: string;
  userId: string;
  consentId: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  accountsDiscovered: number;
  initiatedAt: string;
  completedAt?: string;
  error?: string;
}

export function RecentFetchesWidget() {
  const [, navigate] = useLocation();
  
  const { data: fetchHistory, isLoading, refetch, isFetching, error, isError } = useQuery<{ data: FetchLog[] }>({
    queryKey: ['/api/aa/data/fetch/history'],
    refetchInterval: 10000, // Refresh every 10 seconds for real-time updates
    retry: 2,
  });

  const logs = fetchHistory?.data || [];
  const recentLogs = logs.slice(0, 5); // Show only latest 5

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'pending':
        return {
          icon: <Clock className="h-4 w-4" />,
          label: 'Pending',
          variant: 'secondary' as const,
          color: 'text-blue-500'
        };
      case 'in_progress':
        return {
          icon: <Loader2 className="h-4 w-4 animate-spin" />,
          label: 'In Progress',
          variant: 'secondary' as const,
          color: 'text-blue-500'
        };
      case 'completed':
        return {
          icon: <CheckCircle2 className="h-4 w-4" />,
          label: 'Completed',
          variant: 'default' as const,
          color: 'text-green-500'
        };
      case 'failed':
        return {
          icon: <XCircle className="h-4 w-4" />,
          label: 'Failed',
          variant: 'destructive' as const,
          color: 'text-red-500'
        };
      default:
        return {
          icon: <Clock className="h-4 w-4" />,
          label: status,
          variant: 'secondary' as const,
          color: 'text-gray-500'
        };
    }
  };

  if (isLoading) {
    return (
      <Card data-testid="card-recent-fetches-loading">
        <CardHeader>
          <CardTitle className="text-base">Recent Data Fetches</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card data-testid="card-recent-fetches-error">
        <CardHeader>
          <CardTitle className="text-base">Recent Data Fetches</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <XCircle className="h-12 w-12 text-red-500 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground mb-3">Failed to load fetch history</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              data-testid="button-retry-fetch"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
              {isFetching ? 'Retrying...' : 'Retry'}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (recentLogs.length === 0) {
    return (
      <Card data-testid="card-recent-fetches-empty">
        <CardHeader>
          <CardTitle className="text-base">Recent Data Fetches</CardTitle>
          <CardDescription>Track your AA data fetch history</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <RefreshCw className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No data fetches yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Create a consent and fetch data to see your history here
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="card-recent-fetches">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Recent Data Fetches</CardTitle>
            <CardDescription>Latest AA fetch sessions</CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            data-testid="button-refresh-fetches"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {recentLogs.map((log) => {
            const config = getStatusConfig(log.status);
            return (
              <div
                key={log.id}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                data-testid={`fetch-log-${log.sessionId}`}
              >
                <div className="flex items-center gap-3 flex-1">
                  <div className={config.color}>
                    {config.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-xs text-muted-foreground truncate">
                        {log.sessionId.slice(0, 12)}...
                      </span>
                      <Badge variant={config.variant} className="text-xs">
                        {config.label}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span title={format(new Date(log.initiatedAt), 'PPpp')}>
                        {formatDistanceToNow(new Date(log.initiatedAt), { addSuffix: true })}
                      </span>
                      {log.status === 'completed' && (
                        <span className="text-green-600 font-medium">
                          {log.accountsDiscovered} account{log.accountsDiscovered !== 1 ? 's' : ''}
                        </span>
                      )}
                      {log.status === 'failed' && log.error && (
                        <span className="text-red-600 text-xs truncate max-w-[200px]" title={log.error}>
                          {log.error}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                {log.status === 'completed' && log.accountsDiscovered > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate('/aa-accounts')}
                    data-testid={`button-view-accounts-${log.sessionId}`}
                  >
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                )}
              </div>
            );
          })}
        </div>
        
        {logs.length > 5 && (
          <Button
            variant="outline"
            size="sm"
            className="w-full mt-3"
            onClick={() => navigate('/aa-consents')}
            data-testid="button-view-all-fetches"
          >
            View All Fetches ({logs.length})
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
