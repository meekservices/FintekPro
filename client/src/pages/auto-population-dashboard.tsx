import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  RefreshCw,
  Shield,
  Database,
  TrendingUp,
  Wallet,
  Building,
  CreditCard,
  FileText,
  Settings,
  Briefcase,
  PiggyBank,
  Award
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { AutoPopulationProgressIndicator } from '@/components/AutoPopulationProgressIndicator';
import { useAuth } from '@/hooks/useAuth';

// Types
interface ConsentRecord {
  id: string;
  userId: string;
  dataSource: 'mutual_funds' | 'demat' | 'bank' | 'loans' | 'insurance' | 'epf' | 'nps' | 'apy';
  provider?: string;
  status: 'active' | 'revoked' | 'expired';
  consentPurpose: string;
  grantedAt: string;
  expiresAt: string;
  lastSyncedAt?: string;
  syncFrequency?: string;
}

interface WorkflowStatus {
  id: string;
  userId: string;
  status: 'in_progress' | 'completed' | 'failed';
  triggeredBy: string;
  startedAt: string;
  completedAt?: string;
  sourceStatuses: {
    source: string;
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
    recordsFetched?: number;
    error?: string;
  }[];
  summary: {
    totalSources: number;
    successfulSources: number;
    failedSources: number;
    totalRecordsFetched: number;
  };
}

const DATA_SOURCE_CONFIG = {
  mutual_funds: { icon: TrendingUp, label: 'Mutual Funds', color: 'text-blue-600' },
  demat: { icon: Wallet, label: 'Demat Holdings', color: 'text-green-600' },
  bank: { icon: Building, label: 'Bank Accounts', color: 'text-purple-600' },
  loans: { icon: CreditCard, label: 'Loan Liabilities', color: 'text-orange-600' },
  insurance: { icon: Shield, label: 'Insurance Policies', color: 'text-indigo-600' },
  epf: { icon: Briefcase, label: 'EPF/VPF Accounts', color: 'text-teal-600' },
  nps: { icon: PiggyBank, label: 'National Pension System', color: 'text-cyan-600' },
  apy: { icon: Award, label: 'Atal Pension Yojana', color: 'text-amber-600' }
};

export default function AutoPopulationDashboard() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [selectedWorkflow, setSelectedWorkflow] = useState<string | null>(null);

  // Get actual user ID from auth context
  const userId = user?.id;

  // Query: Get all consents
  const { data: consentsData, isLoading: consentsLoading } = useQuery<{ consents: ConsentRecord[] }>({
    queryKey: ['/api/auto-populate/consent/user', userId],
    enabled: !!userId
  });

  // Query: Get all workflows
  const { data: workflowsData, isLoading: workflowsLoading } = useQuery<{ workflows: WorkflowStatus[] }>({
    queryKey: ['/api/auto-populate/workflows', userId],
    enabled: !!userId
  });

  // Query: Get workflow status (for selected workflow)
  const { data: statusData } = useQuery<{ status: WorkflowStatus }>({
    queryKey: ['/api/auto-populate/status', selectedWorkflow],
    enabled: !!selectedWorkflow,
    refetchInterval: (data) => {
      // Auto-refresh every 3 seconds if workflow is in progress
      if (data?.state.data?.status.status === 'in_progress') {
        return 3000;
      }
      return false;
    }
  });

  // Query: Get portfolio summary
  const { data: summaryData, isLoading: summaryLoading } = useQuery<{
    success: boolean;
    summary: {
      totalMarketValue: number;
      totalInvestedValue: number;
      totalGainLoss: number;
      gainLossPercent: number;
      totalHoldings: number;
      assetTypeBreakdown: Record<string, { value: number; count: number }>;
      dataSourceBreakdown: Record<string, { value: number; count: number }>;
      lastSync: {
        workflowId: string;
        status: string;
        completedAt: string;
        totalRecordsFetched: number;
        successfulSources: number;
        totalDataSources: number;
        durationMs: number;
      } | null;
    };
  }>({
    queryKey: ['/api/auto-populate/summary', userId],
    enabled: !!userId
  });

  // Mutation: Initiate auto-population
  const initiateMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', `/api/auto-populate/initiate`, {
        body: { userId, triggeredBy: 'manual' }
      });
    },
    onSuccess: (data: any) => {
      toast({
        title: 'Auto-population initiated',
        description: `Workflow ${data.workflowId} started successfully`
      });
      queryClient.invalidateQueries({ queryKey: ['/api/auto-populate/workflows', userId] });
      setSelectedWorkflow(data.workflowId);
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to initiate',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  // Mutation: Refresh data
  const refreshMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', `/api/auto-populate/refresh`, {
        body: { userId }
      });
    },
    onSuccess: () => {
      toast({
        title: 'Refresh initiated',
        description: 'Your financial data is being updated'
      });
      queryClient.invalidateQueries({ queryKey: ['/api/auto-populate/workflows', userId] });
    }
  });

  // Mutation: Grant consent
  const grantConsentMutation = useMutation({
    mutationFn: async (dataSource: string) => {
      return apiRequest('POST', `/api/auto-populate/consent/grant`, {
        body: {
          userId,
          dataSource,
          consentPurpose: 'Auto-populate financial holdings',
          validityDays: 90
        }
      });
    },
    onSuccess: () => {
      toast({
        title: 'Consent granted',
        description: 'Data source access approved'
      });
      queryClient.invalidateQueries({ queryKey: ['/api/auto-populate/consent/user', userId] });
    }
  });

  // Mutation: Grant all consents (batch operation)
  const grantAllConsentsMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', `/api/auto-populate/consent/grant-all`, {
        body: { userId }
      });
    },
    onSuccess: (data: any) => {
      toast({
        title: 'All consents granted',
        description: `Successfully granted consent for ${data.totalConsents} data sources`
      });
      queryClient.invalidateQueries({ queryKey: ['/api/auto-populate/consent/user', userId] });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to grant consents',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  const consents = consentsData?.consents || [];
  const workflows = workflowsData?.workflows || [];
  const currentStatus = statusData?.status || workflows.find(w => w.id === selectedWorkflow);

  // Calculate overall progress
  const getOverallProgress = () => {
    if (!currentStatus) return 0;
    const { successfulSources, totalSources } = currentStatus.summary;
    return (successfulSources / totalSources) * 100;
  };

  // Get consent status for a data source
  const getConsentStatus = (source: string) => {
    const consent = consents.find(c => c.dataSource === source);
    if (!consent) return 'not_granted';
    if (consent.status === 'expired') return 'expired';
    if (consent.status === 'revoked') return 'revoked';
    return 'active';
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Auto-Population Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Manage your financial data sync and consents
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => grantAllConsentsMutation.mutate()}
            disabled={grantAllConsentsMutation.isPending || consents.length === 8}
            variant="secondary"
            data-testid="button-grant-all-consents"
          >
            <CheckCircle2 className="mr-2 h-4 w-4" />
            {consents.length === 8 ? 'All Consents Granted' : 'Grant All Consents'}
          </Button>
          <Button
            onClick={() => refreshMutation.mutate()}
            disabled={refreshMutation.isPending}
            variant="outline"
            data-testid="button-refresh-data"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshMutation.isPending ? 'animate-spin' : ''}`} />
            Refresh Data
          </Button>
          <Button
            onClick={() => initiateMutation.mutate()}
            disabled={initiateMutation.isPending}
            data-testid="button-initiate-sync"
          >
            <Database className="mr-2 h-4 w-4" />
            Start Auto-Population
          </Button>
        </div>
      </div>

      {/* Portfolio Summary Card */}
      {summaryData?.summary && (
        <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 border-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-6 w-6 text-blue-600" />
              Portfolio Summary
            </CardTitle>
            <CardDescription>
              Your complete portfolio overview across all data sources
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {/* Total Portfolio Value */}
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Total Portfolio Value</p>
                <p className="text-3xl font-bold text-blue-600">
                  ₹{summaryData.summary.totalMarketValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <FileText className="h-3 w-3" />
                  {summaryData.summary.totalHoldings} holdings
                </div>
              </div>

              {/* Total Invested */}
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Total Invested</p>
                <p className="text-2xl font-semibold">
                  ₹{summaryData.summary.totalInvestedValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </p>
              </div>

              {/* Gain/Loss */}
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Total Gain/Loss</p>
                <div className={`text-2xl font-semibold ${summaryData.summary.totalGainLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {summaryData.summary.totalGainLoss >= 0 ? '+' : ''}₹{summaryData.summary.totalGainLoss.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  <span className="text-sm ml-2">
                    ({summaryData.summary.gainLossPercent >= 0 ? '+' : ''}{summaryData.summary.gainLossPercent.toFixed(2)}%)
                  </span>
                </div>
              </div>

              {/* Last Sync */}
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Last Sync</p>
                {summaryData.summary.lastSync ? (
                  <>
                    <div className="flex items-center gap-2">
                      <Badge variant={summaryData.summary.lastSync.status === 'completed' ? 'default' : 'destructive'}>
                        {summaryData.summary.lastSync.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(summaryData.summary.lastSync.completedAt).toLocaleDateString('en-IN', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {summaryData.summary.lastSync.totalRecordsFetched} records from {summaryData.summary.lastSync.successfulSources}/{summaryData.summary.lastSync.totalDataSources} sources
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">No sync yet</p>
                )}
              </div>
            </div>

            {/* Asset Allocation Breakdown */}
            {Object.keys(summaryData.summary.assetTypeBreakdown).length > 0 && (
              <div className="mt-6 space-y-3">
                <h4 className="text-sm font-semibold">Asset Allocation</h4>
                <div className="grid gap-2 md:grid-cols-2">
                  {Object.entries(summaryData.summary.assetTypeBreakdown).map(([assetType, data]) => {
                    const percentage = (data.value / summaryData.summary.totalMarketValue) * 100;
                    return (
                      <div key={assetType} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="capitalize">{assetType.replace('_', ' ')}</span>
                          <span className="font-medium">
                            ₹{data.value.toLocaleString('en-IN', { maximumFractionDigits: 0 })} ({percentage.toFixed(1)}%)
                          </span>
                        </div>
                        <Progress value={percentage} className="h-2" />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Main Content */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList>
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="consents" data-testid="tab-consents">Consents</TabsTrigger>
          <TabsTrigger value="workflows" data-testid="tab-workflows">Workflows</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          {/* Current Workflow Status - Use Progress Indicator Component */}
          {selectedWorkflow && (
            <AutoPopulationProgressIndicator 
              workflowId={selectedWorkflow}
              onComplete={(status) => {
                toast({
                  title: status.status === 'completed' ? 'Auto-population completed!' : 'Auto-population failed',
                  description: status.status === 'completed' 
                    ? `Successfully fetched ${status.summary.totalRecordsFetched} records from ${status.summary.successfulSources} sources`
                    : `Failed to fetch data from ${status.summary.failedSources} sources`,
                  variant: status.status === 'completed' ? 'default' : 'destructive'
                });
                queryClient.invalidateQueries({ queryKey: ['/api/auto-populate/workflows', userId] });
              }}
            />
          )}

          {/* Data Sources Health */}
          <Card data-testid="card-data-sources">
            <CardHeader>
              <CardTitle>Data Sources</CardTitle>
              <CardDescription>Manage access to your financial data</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(DATA_SOURCE_CONFIG).map(([key, config]) => {
                  const Icon = config.icon;
                  const consentStatus = getConsentStatus(key);
                  const consent = consents.find(c => c.dataSource === key);

                  return (
                    <Card key={key} className="relative" data-testid={`card-source-${key}`}>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <Icon className={`h-6 w-6 ${config.color}`} />
                          {consentStatus === 'active' && (
                            <Badge variant="default" className="bg-green-600" data-testid={`badge-consent-active-${key}`}>
                              Active
                            </Badge>
                          )}
                          {consentStatus === 'expired' && (
                            <Badge variant="secondary" data-testid={`badge-consent-expired-${key}`}>
                              Expired
                            </Badge>
                          )}
                          {consentStatus === 'revoked' && (
                            <Badge variant="destructive" data-testid={`badge-consent-revoked-${key}`}>
                              Revoked
                            </Badge>
                          )}
                          {consentStatus === 'not_granted' && (
                            <Badge variant="outline" data-testid={`badge-consent-not-granted-${key}`}>
                              Not Granted
                            </Badge>
                          )}
                        </div>
                        <CardTitle className="text-base mt-2">{config.label}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {consent && (
                          <div className="text-sm space-y-1">
                            <p className="text-muted-foreground">
                              Last synced: {consent.lastSyncedAt ? new Date(consent.lastSyncedAt).toLocaleDateString() : 'Never'}
                            </p>
                            <p className="text-muted-foreground">
                              Expires: {new Date(consent.expiresAt).toLocaleDateString()}
                            </p>
                          </div>
                        )}
                        {consentStatus === 'not_granted' && (
                          <Button
                            size="sm"
                            className="mt-2 w-full"
                            onClick={() => grantConsentMutation.mutate(key)}
                            disabled={grantConsentMutation.isPending}
                            data-testid={`button-grant-consent-${key}`}
                          >
                            Grant Consent
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Consents Tab */}
        <TabsContent value="consents" className="space-y-4">
          <Card data-testid="card-consents-list">
            <CardHeader>
              <CardTitle>Consent Management</CardTitle>
              <CardDescription>
                View and manage your data access consents (RBI AA Compliant)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {consentsLoading ? (
                <p className="text-center text-muted-foreground">Loading consents...</p>
              ) : consents.length === 0 ? (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    No consents granted yet. Grant consent to data sources to enable auto-population.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-3">
                  {consents.map((consent) => {
                    const config = DATA_SOURCE_CONFIG[consent.dataSource];
                    const Icon = config?.icon || FileText;
                    const daysUntilExpiry = Math.ceil(
                      (new Date(consent.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                    );

                    return (
                      <div
                        key={consent.id}
                        className="flex items-center justify-between p-4 border rounded-lg"
                        data-testid={`consent-item-${consent.dataSource}`}
                      >
                        <div className="flex items-center gap-4">
                          <Icon className={`h-5 w-5 ${config?.color || 'text-gray-600'}`} />
                          <div>
                            <p className="font-medium">{config?.label || consent.dataSource}</p>
                            <p className="text-sm text-muted-foreground">
                              Granted: {new Date(consent.grantedAt).toLocaleDateString()}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {consent.status === 'active' && (
                                <span className={daysUntilExpiry < 7 ? 'text-orange-600' : ''}>
                                  Expires in {daysUntilExpiry} days
                                </span>
                              )}
                              {consent.status === 'expired' && (
                                <span className="text-destructive">Expired</span>
                              )}
                              {consent.status === 'revoked' && (
                                <span className="text-muted-foreground">Revoked</span>
                              )}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={
                              consent.status === 'active'
                                ? 'default'
                                : consent.status === 'expired'
                                ? 'secondary'
                                : 'destructive'
                            }
                            data-testid={`badge-status-${consent.dataSource}`}
                          >
                            {consent.status}
                          </Badge>
                          {consent.status === 'active' && (
                            <Button
                              variant="outline"
                              size="sm"
                              data-testid={`button-manage-${consent.dataSource}`}
                            >
                              <Settings className="h-4 w-4" />
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
        </TabsContent>

        {/* Workflows Tab */}
        <TabsContent value="workflows" className="space-y-4">
          <Card data-testid="card-workflows-history">
            <CardHeader>
              <CardTitle>Workflow History</CardTitle>
              <CardDescription>View past auto-population runs</CardDescription>
            </CardHeader>
            <CardContent>
              {workflowsLoading ? (
                <p className="text-center text-muted-foreground">Loading workflows...</p>
              ) : workflows.length === 0 ? (
                <Alert>
                  <AlertDescription>
                    No workflows yet. Start your first auto-population to see results here.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-3">
                  {workflows.map((workflow) => (
                    <div
                      key={workflow.id}
                      className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                        selectedWorkflow === workflow.id ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                      }`}
                      onClick={() => setSelectedWorkflow(workflow.id)}
                      data-testid={`workflow-item-${workflow.id}`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">Workflow {workflow.id.substring(0, 8)}</p>
                          <p className="text-sm text-muted-foreground">
                            Started: {new Date(workflow.startedAt).toLocaleString()}
                          </p>
                          {workflow.completedAt && (
                            <p className="text-sm text-muted-foreground">
                              Completed: {new Date(workflow.completedAt).toLocaleString()}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className="text-sm font-medium">
                              {workflow.summary.totalRecordsFetched} records
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {workflow.summary.successfulSources}/{workflow.summary.totalSources} sources
                            </p>
                          </div>
                          <Badge
                            variant={
                              workflow.status === 'completed'
                                ? 'default'
                                : workflow.status === 'failed'
                                ? 'destructive'
                                : 'secondary'
                            }
                            data-testid={`badge-status-${workflow.id}`}
                          >
                            {workflow.status}
                          </Badge>
                        </div>
                      </div>
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
