import { useEffect, useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  Clock,
  ArrowRight,
  X
} from 'lucide-react';
import { useLocation } from 'wouter';

interface FetchStatus {
  sessionId: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  accountsDiscovered: number;
  startedAt: string;
  completedAt?: string;
  error?: string;
}

interface FetchStatusTrackerProps {
  sessionId: string;
  onComplete?: (status: FetchStatus) => void;
  onDismiss?: () => void;
}

export function FetchStatusTracker({ sessionId, onComplete, onDismiss }: FetchStatusTrackerProps) {
  const [, setLocation] = useLocation();
  const [dismissed, setDismissed] = useState(false);
  const completedRef = useRef(false);

  const { data: statusData, isLoading } = useQuery<{ data: FetchStatus }>({
    queryKey: ['/api/aa/data/fetch', sessionId, 'status'],
    refetchInterval: (query) => {
      // Stop polling if dismissed
      if (dismissed) {
        return false;
      }
      const status = query.state.data?.data?.status;
      // Poll every 2 seconds while pending or in progress
      if (status === 'pending' || status === 'in_progress') {
        return 2000;
      }
      // Stop polling when completed or failed
      return false;
    },
    enabled: !dismissed && !!sessionId,
  });

  const status = statusData?.data;

  useEffect(() => {
    // Only call onComplete once per session
    if (status && (status.status === 'completed' || status.status === 'failed') && !completedRef.current) {
      completedRef.current = true;
      if (onComplete) {
        onComplete(status);
      }
    }
  }, [status?.status]);

  const handleDismiss = () => {
    setDismissed(true);
    if (onDismiss) {
      onDismiss();
    }
  };

  const handleViewAccounts = () => {
    setLocation('/aa-discovered-accounts');
    handleDismiss();
  };

  if (dismissed || !status) {
    return null;
  }

  const getStatusConfig = () => {
    switch (status.status) {
      case 'pending':
        return {
          icon: <Clock className="h-5 w-5 text-blue-500" />,
          label: 'Pending',
          color: 'bg-blue-500',
          progress: 25,
          message: 'Initializing data fetch...'
        };
      case 'in_progress':
        return {
          icon: <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />,
          label: 'In Progress',
          color: 'bg-blue-500',
          progress: 60,
          message: 'Fetching financial data from providers...'
        };
      case 'completed':
        return {
          icon: <CheckCircle2 className="h-5 w-5 text-green-500" />,
          label: 'Completed',
          color: 'bg-green-500',
          progress: 100,
          message: `Successfully discovered ${status.accountsDiscovered} account${status.accountsDiscovered !== 1 ? 's' : ''}!`
        };
      case 'failed':
        return {
          icon: <XCircle className="h-5 w-5 text-red-500" />,
          label: 'Failed',
          color: 'bg-red-500',
          progress: 100,
          message: status.error || 'Failed to fetch data'
        };
    }
  };

  const config = getStatusConfig();

  const borderColorMap: Record<string, string> = {
    'bg-blue-500': '#3b82f6',
    'bg-green-500': '#22c55e',
    'bg-red-500': '#ef4444',
  };

  return (
    <Card className="border-l-4" style={{ borderLeftColor: borderColorMap[config.color] || '#3b82f6' }} data-testid={`fetch-status-tracker-${sessionId}`}>
      <CardContent className="pt-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            {config.icon}
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold">Data Fetch</span>
                <Badge variant={status.status === 'completed' ? 'default' : status.status === 'failed' ? 'destructive' : 'secondary'} data-testid={`badge-status-${status.status}`}>
                  {config.label}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1">{config.message}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDismiss}
            data-testid="button-dismiss-tracker"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <Progress value={config.progress} className="mb-3" data-testid="progress-fetch" />

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Session: {sessionId.slice(0, 8)}...</span>
          {status.completedAt && (
            <span>Completed at {new Date(status.completedAt).toLocaleTimeString()}</span>
          )}
        </div>

        {status.status === 'completed' && status.accountsDiscovered > 0 && (
          <Button
            className="w-full mt-3"
            onClick={handleViewAccounts}
            data-testid="button-view-accounts"
          >
            View Discovered Accounts
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
