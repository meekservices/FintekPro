import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
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
  RotateCcw
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { AutoPopulationProgressIndicator } from '@/components/AutoPopulationProgressIndicator';
import { ConsentPreviewDialog, RevokeConsentDialog, ConsentSettingsDrawer } from '@/components/consent';

// Types
type DataSourceType = 'mutual_funds' | 'demat' | 'bank' | 'loans' | 'insurance' | 'epf' | 'nps' | 'apy';

interface ConsentRecord {
  id: string;
  userId: string;
  dataSource: DataSourceType;
  provider?: string;
  status: 'active' | 'revoked' | 'expired';
  consentPurpose: string;
  consentText?: string;
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
  mutual_funds: { icon: TrendingUp, label: 'Mutual Funds', color: 'text-blue-600', provider: 'BSE STAR MFD API', description: 'Track all your mutual fund investments across AMCs' },
  demat: { icon: Wallet, label: 'Demat Holdings', color: 'text-green-600', provider: 'NSDL/CDSL', description: 'View your stocks, ETFs, and bonds from demat accounts' },
  bank: { icon: Building, label: 'Bank Accounts', color: 'text-purple-600', provider: 'Account Aggregator', description: 'Aggregate savings, current, and FD accounts' },
  loans: { icon: CreditCard, label: 'Loan Liabilities', color: 'text-orange-600', provider: 'CIBIL', description: 'Track home loans, personal loans, and credit cards' },
  insurance: { icon: Shield, label: 'Insurance Policies', color: 'text-indigo-600', provider: 'Turtlefin API', description: 'View life, health, and general insurance policies' },
  epf: { icon: Wallet, label: 'EPF/VPF Account', color: 'text-amber-600', provider: 'EPFO', description: 'Track your provident fund balance and contributions' },
  nps: { icon: TrendingUp, label: 'NPS Account', color: 'text-cyan-600', provider: 'NPS CRA', description: 'National Pension System investments and balance' },
  apy: { icon: Shield, label: 'APY Benefits', color: 'text-rose-600', provider: 'NSDL/APY', description: 'Atal Pension Yojana pension benefits' }
};

export default function AutoPopulationDashboard() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [selectedWorkflow, setSelectedWorkflow] = useState<string | null>(null);
  
  // Dialog states
  const [consentPreviewOpen, setConsentPreviewOpen] = useState(false);
  const [revokeDialogOpen, setRevokeDialogOpen] = useState(false);
  const [settingsDrawerOpen, setSettingsDrawerOpen] = useState(false);
  const [selectedSource, setSelectedSource] = useState<DataSourceType | null>(null);
  const [selectedConsent, setSelectedConsent] = useState<ConsentRecord | null>(null);

  // Get user ID from auth context
  const userId = user?.id || '';

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
        description: 'Data source access approved. Your data will be fetched shortly.'
      });
      setConsentPreviewOpen(false);
      setSelectedSource(null);
      queryClient.invalidateQueries({ queryKey: ['/api/auto-populate/consent/user', userId] });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to grant consent',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  // Mutation: Revoke consent
  const revokeConsentMutation = useMutation({
    mutationFn: async ({ consentId, reason }: { consentId: string; reason: string }) => {
      return apiRequest('POST', `/api/auto-populate/consent/revoke`, {
        body: { consentId, reason }
      });
    },
    onSuccess: () => {
      toast({
        title: 'Consent revoked',
        description: 'Data access has been revoked successfully.'
      });
      setRevokeDialogOpen(false);
      setSelectedConsent(null);
      setSettingsDrawerOpen(false);
      queryClient.invalidateQueries({ queryKey: ['/api/auto-populate/consent/user', userId] });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to revoke consent',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  // Mutation: Renew consent (re-grant expired consent)
  const renewConsentMutation = useMutation({
    mutationFn: async (dataSource: string) => {
      return apiRequest('POST', `/api/auto-populate/consent/grant`, {
        body: {
          userId,
          dataSource,
          consentPurpose: 'Renew consent for auto-population',
          validityDays: 90
        }
      });
    },
    onSuccess: () => {
      toast({
        title: 'Consent renewed',
        description: 'Your consent has been renewed for 90 days.'
      });
      queryClient.invalidateQueries({ queryKey: ['/api/auto-populate/consent/user', userId] });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to renew consent',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  // Mutation: Retry a single failed data source
  const retrySingleSourceMutation = useMutation({
    mutationFn: async (dataSource: string) => {
      // Server gets userId from session - more secure than client-sent
      return apiRequest('POST', `/api/auto-populate/retry-source`, {
        body: { dataSource }
      });
    },
    onSuccess: (_data, variables) => {
      const dataSource = variables;
      toast({
        title: 'Retrying data fetch',
        description: `Attempting to fetch ${DATA_SOURCE_CONFIG[dataSource as DataSourceType]?.label || dataSource} data again.`
      });
      queryClient.invalidateQueries({ queryKey: ['/api/auto-populate/workflows', userId] });
      queryClient.invalidateQueries({ queryKey: ['/api/auto-populate/status', userId] });
    },
    onError: (error: any) => {
      toast({
        title: 'Retry failed',
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
                            onClick={() => {
                              setSelectedSource(key as DataSourceType);
                              setConsentPreviewOpen(true);
                            }}
                            disabled={grantConsentMutation.isPending}
                            data-testid={`button-grant-consent-${key}`}
                          >
                            Grant Consent
                          </Button>
                        )}
                        {consentStatus === 'expired' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="mt-2 w-full"
                            onClick={() => renewConsentMutation.mutate(key)}
                            disabled={renewConsentMutation.isPending}
                            data-testid={`button-renew-consent-${key}`}
                          >
                            <RotateCcw className="mr-2 h-3 w-3" />
                            Renew Consent
                          </Button>
                        )}
                        {consentStatus === 'active' && consent && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="mt-2 w-full"
                            onClick={() => {
                              setSelectedConsent(consent);
                              setSettingsDrawerOpen(true);
                            }}
                            data-testid={`button-settings-${key}`}
                          >
                            <Settings className="mr-2 h-3 w-3" />
                            Settings
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
                          <Icon className={`h-5 w-5 ${config?.color || 'text-muted-foreground'}`} />
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
                              onClick={() => {
                                setSelectedConsent(consent);
                                setSettingsDrawerOpen(true);
                              }}
                              data-testid={`button-manage-${consent.dataSource}`}
                            >
                              <Settings className="h-4 w-4" />
                            </Button>
                          )}
                          {consent.status === 'expired' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => renewConsentMutation.mutate(consent.dataSource)}
                              disabled={renewConsentMutation.isPending}
                              data-testid={`button-renew-list-${consent.dataSource}`}
                            >
                              <RotateCcw className="mr-1 h-3 w-3" />
                              Renew
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
                    <Collapsible key={workflow.id}>
                      <CollapsibleTrigger asChild>
                        <div
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
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        {/* Source-level details with retry buttons for failed sources */}
                        {workflow.sourceStatuses && Object.keys(workflow.sourceStatuses).length > 0 && (
                          <div className="mt-2 ml-4 p-3 border-l-2 border-muted space-y-2">
                            {Object.entries(workflow.sourceStatuses).map(([source, status]: [string, any]) => {
                              const config = DATA_SOURCE_CONFIG[source as DataSourceType];
                              const Icon = config?.icon || Database;
                              const isFailed = status?.status === 'failed' || status?.error;
                              
                              return (
                                <div
                                  key={source}
                                  className="flex items-center justify-between p-2 rounded-md bg-muted/30"
                                  data-testid={`source-status-${source}`}
                                >
                                  <div className="flex items-center gap-2">
                                    <Icon className={`h-4 w-4 ${config?.color || 'text-muted-foreground'}`} />
                                    <div>
                                      <p className="text-sm font-medium">{config?.label || source}</p>
                                      {isFailed && status?.error && (
                                        <p className="text-xs text-destructive">{status.error}</p>
                                      )}
                                      {isFailed && status?.errorSuggestion && (
                                        <p className="text-xs text-muted-foreground">{status.errorSuggestion}</p>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {isFailed ? (
                                      <>
                                        <Badge variant="destructive" className="text-xs">Failed</Badge>
                                        {status?.retryable !== false && (
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              retrySingleSourceMutation.mutate(source);
                                            }}
                                            disabled={retrySingleSourceMutation.isPending}
                                            data-testid={`button-retry-${source}`}
                                          >
                                            <RotateCcw className={`h-3 w-3 mr-1 ${retrySingleSourceMutation.isPending ? 'animate-spin' : ''}`} />
                                            Retry
                                          </Button>
                                        )}
                                      </>
                                    ) : (
                                      <Badge variant="default" className="text-xs bg-green-600">
                                        {status?.recordsFetched || 0} records
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </CollapsibleContent>
                    </Collapsible>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Consent Preview Dialog */}
      {selectedSource && (
        <ConsentPreviewDialog
          open={consentPreviewOpen}
          onOpenChange={setConsentPreviewOpen}
          dataSource={selectedSource}
          sourceLabel={DATA_SOURCE_CONFIG[selectedSource]?.label || selectedSource}
          provider={DATA_SOURCE_CONFIG[selectedSource]?.provider || 'Unknown'}
          description={DATA_SOURCE_CONFIG[selectedSource]?.description || ''}
          onConfirm={() => grantConsentMutation.mutate(selectedSource)}
          isPending={grantConsentMutation.isPending}
        />
      )}

      {/* Revoke Consent Dialog */}
      {selectedConsent && (
        <RevokeConsentDialog
          open={revokeDialogOpen}
          onOpenChange={setRevokeDialogOpen}
          dataSource={selectedConsent.dataSource}
          sourceLabel={DATA_SOURCE_CONFIG[selectedConsent.dataSource]?.label || selectedConsent.dataSource}
          onConfirm={(reason) => revokeConsentMutation.mutate({ consentId: selectedConsent.id, reason })}
          isPending={revokeConsentMutation.isPending}
        />
      )}

      {/* Consent Settings Drawer */}
      {selectedConsent && (
        <ConsentSettingsDrawer
          open={settingsDrawerOpen}
          onOpenChange={setSettingsDrawerOpen}
          consent={selectedConsent}
          sourceLabel={DATA_SOURCE_CONFIG[selectedConsent.dataSource]?.label || selectedConsent.dataSource}
          sourceDescription={DATA_SOURCE_CONFIG[selectedConsent.dataSource]?.description || ''}
          onRevoke={() => {
            setSettingsDrawerOpen(false);
            setRevokeDialogOpen(true);
          }}
          onRefreshNow={() => {
            refreshMutation.mutate();
          }}
          isRefreshing={refreshMutation.isPending}
        />
      )}
    </div>
  );
}
