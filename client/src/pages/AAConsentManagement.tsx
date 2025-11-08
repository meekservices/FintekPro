import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { ConsentRequestModal } from '@/components/aa/ConsentRequestModal';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import {
  Shield,
  Plus,
  CheckCircle2,
  Clock,
  XCircle,
  PlayCircle,
  PauseCircle,
  Calendar,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';

interface Consent {
  id: number;
  userId: string;
  consentId: string;
  consentHandle: string;
  consentStatus: string;
  purpose: string;
  fiTypes: string[];
  dataRangeFrom: string;
  dataRangeTo: string;
  consentExpiry: string;
  frequency: {
    unit: string;
    value: number;
  };
  redirectUrl?: string;
  approvedAt?: string;
  activatedAt?: string;
  lastDataFetchAt?: string;
  createdAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  requested: 'bg-blue-500',
  pending: 'bg-yellow-500',
  approved: 'bg-green-500',
  active: 'bg-green-600',
  paused: 'bg-orange-500',
  revoked: 'bg-red-500',
  expired: 'bg-gray-500',
  rejected: 'bg-red-600',
};

const STATUS_LABELS: Record<string, string> = {
  requested: 'Requested',
  pending: 'Pending Approval',
  approved: 'Approved',
  active: 'Active',
  paused: 'Paused',
  revoked: 'Revoked',
  expired: 'Expired',
  rejected: 'Rejected',
};

const FI_TYPE_LABELS: Record<string, string> = {
  deposit: 'Bank Accounts',
  mutual_funds: 'Mutual Funds',
  insurance_policies: 'Insurance',
  securities: 'Securities',
  term_deposit: 'Term Deposits',
  recurring_deposit: 'RD',
  sip: 'SIP',
  equities: 'Equities',
  bonds: 'Bonds',
  debentures: 'Debentures',
  etf: 'ETFs',
  govt_securities: 'Govt. Securities',
  cp: 'CP',
  idr: 'IDR',
  cis: 'CIS',
  aif: 'AIF',
};

const PURPOSE_LABELS: Record<string, string> = {
  portfolio_sync: 'Portfolio Sync',
  wealth_management: 'Wealth Management',
  loan_application: 'Loan Application',
  tax_filing: 'Tax Filing',
  insurance_planning: 'Insurance Planning',
};

export default function AAConsentManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [actionConsent, setActionConsent] = useState<{ id: string; action: string } | null>(null);

  const { data: consents, isLoading } = useQuery<{ data: Consent[] }>({
    queryKey: ['/api/aa/consents', statusFilter !== 'all' ? statusFilter : undefined],
  });

  const revokeMutation = useMutation({
    mutationFn: async (consentId: string) => {
      return await apiRequest(`/api/aa/consent/${consentId}/revoke`, {
        method: 'POST',
        body: JSON.stringify({ reason: 'User requested revocation' }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/aa/consents'] });
      toast({
        title: 'Success',
        description: 'Consent revoked successfully',
      });
      setActionConsent(null);
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to revoke consent',
        variant: 'destructive',
      });
    },
  });

  const pauseMutation = useMutation({
    mutationFn: async (consentId: string) => {
      return await apiRequest(`/api/aa/consent/${consentId}/pause`, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/aa/consents'] });
      toast({
        title: 'Success',
        description: 'Consent paused successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to pause consent',
        variant: 'destructive',
      });
    },
  });

  const resumeMutation = useMutation({
    mutationFn: async (consentId: string) => {
      return await apiRequest(`/api/aa/consent/${consentId}/resume`, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/aa/consents'] });
      toast({
        title: 'Success',
        description: 'Consent resumed successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to resume consent',
        variant: 'destructive',
      });
    },
  });

  const fetchDataMutation = useMutation({
    mutationFn: async (consentId: string) => {
      return await apiRequest('/api/aa/data/fetch', {
        method: 'POST',
        body: JSON.stringify({ consentId }),
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/aa/discovered-accounts'] });
      toast({
        title: 'Data Fetch Initiated',
        description: `Fetching financial data. Session ID: ${data.sessionId || 'N/A'}`,
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to fetch data',
        variant: 'destructive',
      });
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (consentId: string) => {
      return await apiRequest(`/api/aa/consent/${consentId}/approve`, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/aa/consents'] });
      toast({
        title: 'Success',
        description: 'Consent approved and activated successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to approve consent',
        variant: 'destructive',
      });
    },
  });

  const filteredConsents = consents?.data || [];

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Shield className="h-8 w-8 text-primary" />
            Account Aggregator Consents
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage your financial data access consents
          </p>
        </div>
        <Button onClick={() => setIsModalOpen(true)} data-testid="button-create-consent">
          <Plus className="mr-2 h-4 w-4" />
          New Consent
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="w-64">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger data-testid="select-status-filter">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Consents</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="paused">Paused</SelectItem>
                  <SelectItem value="revoked">Revoked</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Consents List */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-32 mt-2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredConsents.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Shield className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2" data-testid="text-no-consents">No consents found</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Create a new consent to start fetching your financial data
            </p>
            <Button onClick={() => setIsModalOpen(true)} data-testid="button-create-first-consent">
              <Plus className="mr-2 h-4 w-4" />
              Create Your First Consent
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredConsents.map((consent) => (
            <Card key={consent.id} data-testid={`card-consent-${consent.consentId}`}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2">
                      {PURPOSE_LABELS[consent.purpose] || consent.purpose}
                      <Badge
                        className={STATUS_COLORS[consent.consentStatus]}
                        data-testid={`badge-status-${consent.consentId}`}
                      >
                        {STATUS_LABELS[consent.consentStatus] || consent.consentStatus}
                      </Badge>
                    </CardTitle>
                    <CardDescription>
                      Consent ID: {consent.consentHandle}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    {consent.consentStatus === 'pending' && (
                      <>
                        {consent.redirectUrl && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => window.open(consent.redirectUrl, '_blank')}
                            data-testid={`button-redirect-${consent.consentId}`}
                          >
                            <ExternalLink className="mr-2 h-4 w-4" />
                            Approve with AA
                          </Button>
                        )}
                        <Button
                          size="sm"
                          onClick={() => approveMutation.mutate(consent.consentId)}
                          disabled={approveMutation.isPending}
                          data-testid={`button-approve-${consent.consentId}`}
                        >
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                          Approve (Dev)
                        </Button>
                      </>
                    )}
                    {consent.consentStatus === 'active' && (
                      <>
                        <Button
                          size="sm"
                          onClick={() => fetchDataMutation.mutate(consent.consentId)}
                          disabled={fetchDataMutation.isPending}
                          data-testid={`button-fetch-${consent.consentId}`}
                        >
                          <RefreshCw className="mr-2 h-4 w-4" />
                          Fetch Data
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => pauseMutation.mutate(consent.consentId)}
                          disabled={pauseMutation.isPending}
                          data-testid={`button-pause-${consent.consentId}`}
                        >
                          <PauseCircle className="mr-2 h-4 w-4" />
                          Pause
                        </Button>
                      </>
                    )}
                    {consent.consentStatus === 'paused' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => resumeMutation.mutate(consent.consentId)}
                        disabled={resumeMutation.isPending}
                        data-testid={`button-resume-${consent.consentId}`}
                      >
                        <PlayCircle className="mr-2 h-4 w-4" />
                        Resume
                      </Button>
                    )}
                    {['active', 'paused', 'approved'].includes(consent.consentStatus) && (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => setActionConsent({ id: consent.consentId, action: 'revoke' })}
                        data-testid={`button-revoke-${consent.consentId}`}
                      >
                        <XCircle className="mr-2 h-4 w-4" />
                        Revoke
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">FI Types</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {consent.fiTypes.map((type) => (
                        <Badge key={type} variant="outline" className="text-xs">
                          {FI_TYPE_LABELS[type] || type}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Data Range</p>
                    <p className="font-medium" data-testid={`text-data-range-${consent.consentId}`}>
                      {format(new Date(consent.dataRangeFrom), 'PP')} - {format(new Date(consent.dataRangeTo), 'PP')}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Frequency</p>
                    <p className="font-medium">
                      Every {consent.frequency.value} {consent.frequency.unit}(s)
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Expires On</p>
                    <p className="font-medium flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(consent.consentExpiry), 'PP')}
                    </p>
                  </div>
                </div>

                {(consent.approvedAt || consent.activatedAt || consent.lastDataFetchAt) && (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm mt-4 pt-4 border-t">
                    {consent.approvedAt && (
                      <div>
                        <p className="text-muted-foreground">Approved At</p>
                        <p className="font-medium flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3 text-green-500" />
                          {format(new Date(consent.approvedAt), 'PPp')}
                        </p>
                      </div>
                    )}
                    {consent.activatedAt && (
                      <div>
                        <p className="text-muted-foreground">Activated At</p>
                        <p className="font-medium flex items-center gap-1">
                          <PlayCircle className="h-3 w-3 text-green-500" />
                          {format(new Date(consent.activatedAt), 'PPp')}
                        </p>
                      </div>
                    )}
                    {consent.lastDataFetchAt && (
                      <div>
                        <p className="text-muted-foreground">Last Data Fetch</p>
                        <p className="font-medium flex items-center gap-1">
                          <RefreshCw className="h-3 w-3 text-blue-500" />
                          {format(new Date(consent.lastDataFetchAt), 'PPp')}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Consent Request Modal */}
      <ConsentRequestModal open={isModalOpen} onOpenChange={setIsModalOpen} />

      {/* Revoke Confirmation Dialog */}
      <AlertDialog
        open={actionConsent?.action === 'revoke'}
        onOpenChange={(open) => !open && setActionConsent(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke Consent?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently revoke the consent and stop all data fetching.
              You'll need to create a new consent to resume data access.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-revoke">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => actionConsent && revokeMutation.mutate(actionConsent.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-revoke"
            >
              Revoke
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
