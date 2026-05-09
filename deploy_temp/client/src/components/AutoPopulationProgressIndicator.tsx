import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  Shield,
  TrendingUp,
  Wallet,
  Building,
  CreditCard,
  FileText,
  Users,
  PiggyBank,
  Gift
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SourceStatus {
  source: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  recordsFetched?: number;
  error?: string;
}

interface WorkflowStatus {
  id: string;
  userId: string;
  status: 'in_progress' | 'completed' | 'failed';
  triggeredBy: string;
  startedAt: string;
  completedAt?: string;
  sourceStatuses: SourceStatus[];
  summary: {
    totalSources: number;
    successfulSources: number;
    failedSources: number;
    totalRecordsFetched: number;
  };
}

interface AutoPopulationProgressIndicatorProps {
  workflowId: string;
  onComplete?: (status: WorkflowStatus) => void;
  className?: string;
}

const DATA_SOURCE_CONFIG: Record<string, { icon: any; label: string; color: string }> = {
  mutual_funds: { icon: TrendingUp, label: 'Mutual Funds', color: 'text-blue-600 dark:text-blue-400' },
  demat: { icon: Wallet, label: 'Demat Holdings', color: 'text-green-600 dark:text-green-400' },
  bank: { icon: Building, label: 'Bank Accounts', color: 'text-purple-600 dark:text-purple-400' },
  loans: { icon: CreditCard, label: 'Loan Liabilities', color: 'text-orange-600 dark:text-orange-400' },
  insurance: { icon: Shield, label: 'Insurance Policies', color: 'text-indigo-600 dark:text-indigo-400' },
  epf: { icon: Users, label: 'EPF/VPF Accounts', color: 'text-cyan-600 dark:text-cyan-400' },
  nps: { icon: PiggyBank, label: 'NPS Accounts', color: 'text-pink-600 dark:text-pink-400' },
  apy: { icon: Gift, label: 'APY Benefits', color: 'text-amber-600 dark:text-amber-400' }
};

const getStatusIcon = (status: SourceStatus['status']) => {
  switch (status) {
    case 'completed':
      return <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" data-testid={`icon-completed`} />;
    case 'failed':
      return <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" data-testid={`icon-failed`} />;
    case 'in_progress':
      return <Loader2 className="h-5 w-5 text-blue-600 dark:text-blue-400 animate-spin" data-testid={`icon-in-progress`} />;
    case 'pending':
      return <Clock className="h-5 w-5 text-muted-foreground" data-testid={`icon-pending`} />;
  }
};

const getStatusBadge = (status: SourceStatus['status']) => {
  const variants: Record<SourceStatus['status'], { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    completed: { label: 'Completed', variant: 'default' },
    failed: { label: 'Failed', variant: 'destructive' },
    in_progress: { label: 'In Progress', variant: 'secondary' },
    pending: { label: 'Pending', variant: 'outline' }
  };
  
  const config = variants[status];
  return (
    <Badge variant={config.variant} data-testid={`badge-${status}`}>
      {config.label}
    </Badge>
  );
};

export function AutoPopulationProgressIndicator({
  workflowId,
  onComplete,
  className
}: AutoPopulationProgressIndicatorProps) {
  
  // Ref to track if onComplete has been called
  const onCompleteCalledRef = useRef(false);
  
  // Reset completion flag when workflowId changes
  useEffect(() => {
    onCompleteCalledRef.current = false;
  }, [workflowId]);
  
  // Query workflow status with auto-refresh
  const { data: statusData, isLoading } = useQuery<{ status: WorkflowStatus }>({
    queryKey: ['/api/auto-populate/status', workflowId],
    enabled: !!workflowId,
    refetchInterval: (data) => {
      // Auto-refresh every 2 seconds if workflow is in progress
      // Keep this strictly for polling control - no side effects
      if (data?.state.data?.status.status === 'in_progress') {
        return 2000;
      }
      return false;
    }
  });

  // Handle workflow completion - fires once when status transitions to terminal state
  useEffect(() => {
    if (!statusData?.status || !onComplete) return;
    
    const status = statusData.status;
    const isTerminal = status.status === 'completed' || status.status === 'failed';
    
    // Call onComplete exactly once when workflow reaches terminal state
    if (isTerminal && !onCompleteCalledRef.current) {
      onCompleteCalledRef.current = true;
      onComplete(status);
    }
  }, [workflowId, statusData?.status?.status, onComplete]);

  if (isLoading) {
    return (
      <Card className={cn('w-full', className)} data-testid="progress-indicator-loading">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 dark:text-blue-400" />
          <span className="ml-3 text-muted-foreground">Loading workflow status...</span>
        </CardContent>
      </Card>
    );
  }

  if (!statusData?.status) {
    return (
      <Alert variant="destructive" className={className} data-testid="progress-indicator-error">
        <AlertDescription>
          Workflow not found or status unavailable
        </AlertDescription>
      </Alert>
    );
  }

  const workflow = statusData.status;
  const { summary, sourceStatuses, status: workflowStatus } = workflow;
  
  // Calculate overall progress
  const progressPercentage = Math.round(
    (summary.successfulSources / summary.totalSources) * 100
  );

  return (
    <Card className={cn('w-full', className)} data-testid="progress-indicator-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              Auto-Population Progress
              {workflowStatus === 'in_progress' && (
                <Loader2 className="h-5 w-5 animate-spin text-blue-600 dark:text-blue-400" />
              )}
            </CardTitle>
            <CardDescription>
              Fetching your financial data from authorized sources
            </CardDescription>
          </div>
          {getStatusBadge(workflowStatus as any)}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Overall Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Overall Progress</span>
            <span className="font-medium" data-testid="text-progress-percentage">
              {summary.successfulSources} of {summary.totalSources} sources completed
            </span>
          </div>
          <Progress 
            value={progressPercentage} 
            className="h-2" 
            data-testid="progress-bar-overall"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span data-testid="text-records-fetched">{summary.totalRecordsFetched} records fetched</span>
            {summary.failedSources > 0 && (
              <span className="text-red-600 dark:text-red-400" data-testid="text-failed-count">
                {summary.failedSources} failed
              </span>
            )}
          </div>
        </div>

        {/* Data Source Status List */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">Data Sources</h4>
          <div className="space-y-2">
            {sourceStatuses.map((sourceStatus) => {
              const config = DATA_SOURCE_CONFIG[sourceStatus.source] || {
                icon: FileText,
                label: sourceStatus.source,
                color: 'text-muted-foreground'
              };
              const Icon = config.icon;

              return (
                <div
                  key={sourceStatus.source}
                  className={cn(
                    'flex items-center justify-between p-3 rounded-lg border',
                    'bg-card',
                    sourceStatus.status === 'completed' && 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950',
                    sourceStatus.status === 'failed' && 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950',
                    sourceStatus.status === 'in_progress' && 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950',
                    sourceStatus.status === 'pending' && 'border-border'
                  )}
                  data-testid={`source-status-${sourceStatus.source}`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={cn('h-5 w-5', config.color)} />
                    <div>
                      <p className="text-sm font-medium" data-testid={`text-source-label-${sourceStatus.source}`}>
                        {config.label}
                      </p>
                      {sourceStatus.recordsFetched !== undefined && sourceStatus.recordsFetched > 0 && (
                        <p className="text-xs text-muted-foreground" data-testid={`text-records-${sourceStatus.source}`}>
                          {sourceStatus.recordsFetched} records fetched
                        </p>
                      )}
                      {sourceStatus.error && (
                        <p className="text-xs text-red-600 dark:text-red-400" data-testid={`text-error-${sourceStatus.source}`}>
                          {sourceStatus.error}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(sourceStatus.status)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Completion Message */}
        {workflowStatus === 'completed' && (
          <Alert className="border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950" data-testid="alert-completed">
            <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
            <AlertDescription className="text-green-900 dark:text-green-100">
              Auto-population completed successfully! Your financial data has been synced.
            </AlertDescription>
          </Alert>
        )}

        {workflowStatus === 'failed' && (
          <Alert variant="destructive" data-testid="alert-failed">
            <XCircle className="h-4 w-4" />
            <AlertDescription>
              Auto-population failed. Please check the errors above and try again.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
