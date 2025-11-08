import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
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
import { useToast } from '@/hooks/use-toast';
import {
  Building2,
  Landmark,
  Shield,
  TrendingUp,
  RefreshCw,
  Link2,
  Unlink,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';

interface DiscoveredAccount {
  id: number;
  userId: string;
  consentId: string;
  fipId: string;
  fipName: string;
  fiType: string;
  accountNumber: string;
  maskedAccountNumber: string;
  accountType?: string;
  accountHolderName?: string;
  balance?: string;
  balanceAsOf?: string;
  currency?: string;
  linkedToPortfolio: boolean;
  linkedAt?: string;
  discoveredAt: string;
  lastSyncedAt?: string;
}

interface GroupedAccounts {
  [fipName: string]: DiscoveredAccount[];
}

const FI_TYPE_ICONS: Record<string, any> = {
  deposit: Landmark,
  mutual_funds: TrendingUp,
  insurance_policies: Shield,
  securities: Building2,
  term_deposit: Landmark,
  recurring_deposit: Landmark,
  equities: TrendingUp,
  bonds: Building2,
  default: Building2,
};

const FI_TYPE_LABELS: Record<string, string> = {
  deposit: 'Bank Account',
  mutual_funds: 'Mutual Fund',
  insurance_policies: 'Insurance',
  securities: 'Securities',
  term_deposit: 'Term Deposit',
  recurring_deposit: 'Recurring Deposit',
  sip: 'SIP',
  equities: 'Equity',
  bonds: 'Bond',
  debentures: 'Debenture',
  etf: 'ETF',
  govt_securities: 'Govt. Security',
};

export default function AADiscoveredAccounts() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [fiTypeFilter, setFiTypeFilter] = useState<string>('all');
  const [linkFilter, setLinkFilter] = useState<string>('all');
  const [showBalances, setShowBalances] = useState(false);

  const { data: accounts, isLoading, refetch, isFetching } = useQuery<{ data: DiscoveredAccount[] }>({
    queryKey: ['/api/aa/discovered-accounts'],
  });

  const linkMutation = useMutation({
    mutationFn: async (accountId: number) => {
      return await apiRequest(`/api/aa/discovered-accounts/${accountId}/link`, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/aa/discovered-accounts'] });
      toast({
        title: 'Success',
        description: 'Account linked to portfolio successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to link account',
        variant: 'destructive',
      });
    },
  });

  const unlinkMutation = useMutation({
    mutationFn: async (accountId: number) => {
      return await apiRequest(`/api/aa/discovered-accounts/${accountId}/unlink`, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/aa/discovered-accounts'] });
      toast({
        title: 'Success',
        description: 'Account unlinked from portfolio successfully',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to unlink account',
        variant: 'destructive',
      });
    },
  });

  // Filter and group accounts
  const filteredAccounts = (accounts?.data || []).filter((account) => {
    if (fiTypeFilter !== 'all' && account.fiType !== fiTypeFilter) return false;
    if (linkFilter === 'linked' && !account.linkedToPortfolio) return false;
    if (linkFilter === 'unlinked' && account.linkedToPortfolio) return false;
    return true;
  });

  const groupedAccounts: GroupedAccounts = filteredAccounts.reduce((acc, account) => {
    const fipName = account.fipName || 'Unknown Provider';
    if (!acc[fipName]) {
      acc[fipName] = [];
    }
    acc[fipName].push(account);
    return acc;
  }, {} as GroupedAccounts);

  // Get unique FI types for filter
  const uniqueFiTypes = Array.from(new Set((accounts?.data || []).map(a => a.fiType)));

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Building2 className="h-8 w-8 text-primary" />
            Discovered Accounts
          </h1>
          <p className="text-muted-foreground mt-1">
            Financial accounts fetched via Account Aggregator
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setShowBalances(!showBalances)}
            data-testid="button-toggle-balances"
          >
            {showBalances ? (
              <>
                <EyeOff className="mr-2 h-4 w-4" />
                Hide Balances
              </>
            ) : (
              <>
                <Eye className="mr-2 h-4 w-4" />
                Show Balances
              </>
            )}
          </Button>
          <Button
            onClick={() => refetch()}
            disabled={isFetching}
            data-testid="button-refresh"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Accounts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-accounts">
              {accounts?.data.length || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Linked to Portfolio
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600" data-testid="text-linked-accounts">
              {accounts?.data.filter(a => a.linkedToPortfolio).length || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Financial Institutions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-fip-count">
              {Object.keys(groupedAccounts).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Account Types
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-fi-types-count">
              {uniqueFiTypes.length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="w-64">
              <Select value={fiTypeFilter} onValueChange={setFiTypeFilter}>
                <SelectTrigger data-testid="select-fi-type-filter">
                  <SelectValue placeholder="Filter by FI Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {uniqueFiTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {FI_TYPE_LABELS[type] || type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-64">
              <Select value={linkFilter} onValueChange={setLinkFilter}>
                <SelectTrigger data-testid="select-link-filter">
                  <SelectValue placeholder="Filter by Link Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Accounts</SelectItem>
                  <SelectItem value="linked">Linked Only</SelectItem>
                  <SelectItem value="unlinked">Unlinked Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Accounts List */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-48" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredAccounts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Building2 className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2" data-testid="text-no-accounts">
              No accounts found
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {accounts?.data.length === 0
                ? 'Create a consent and fetch data to discover your financial accounts'
                : 'No accounts match the selected filters'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedAccounts).map(([fipName, fipAccounts]) => (
            <Card key={fipName} data-testid={`card-fip-${fipName}`}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Building2 className="h-5 w-5 text-primary" />
                      {fipName}
                    </CardTitle>
                    <CardDescription>
                      {fipAccounts.length} account{fipAccounts.length !== 1 ? 's' : ''}
                    </CardDescription>
                  </div>
                  <Badge variant="outline">
                    {fipAccounts[0].fipId}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {fipAccounts.map((account) => {
                    const Icon = FI_TYPE_ICONS[account.fiType] || FI_TYPE_ICONS.default;
                    return (
                      <div
                        key={account.id}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                        data-testid={`account-${account.id}`}
                      >
                        <div className="flex items-start gap-4 flex-1">
                          <div className="p-2 rounded-lg bg-primary/10">
                            <Icon className="h-5 w-5 text-primary" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-semibold">
                                {account.accountHolderName || 'Account'}
                              </p>
                              <Badge variant="outline" className="text-xs">
                                {FI_TYPE_LABELS[account.fiType] || account.fiType}
                              </Badge>
                              {account.linkedToPortfolio && (
                                <Badge className="bg-green-500 text-xs">
                                  <CheckCircle2 className="mr-1 h-3 w-3" />
                                  Linked
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground font-mono">
                              {account.maskedAccountNumber}
                            </p>
                            {account.accountType && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {account.accountType}
                              </p>
                            )}
                            {showBalances && account.balance && (
                              <div className="mt-2 flex items-center gap-4">
                                <div>
                                  <p className="text-xs text-muted-foreground">Balance</p>
                                  <p className="text-sm font-semibold" data-testid={`balance-${account.id}`}>
                                    {account.currency || 'INR'} {parseFloat(account.balance).toLocaleString('en-IN', {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    })}
                                  </p>
                                </div>
                                {account.balanceAsOf && (
                                  <div>
                                    <p className="text-xs text-muted-foreground">As of</p>
                                    <p className="text-sm">
                                      {format(new Date(account.balanceAsOf), 'PP')}
                                    </p>
                                  </div>
                                )}
                              </div>
                            )}
                            <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                              <span>
                                Discovered: {format(new Date(account.discoveredAt), 'PP')}
                              </span>
                              {account.lastSyncedAt && (
                                <span>
                                  Last Synced: {format(new Date(account.lastSyncedAt), 'PP')}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {account.linkedToPortfolio ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => unlinkMutation.mutate(account.id)}
                              disabled={unlinkMutation.isPending}
                              data-testid={`button-unlink-${account.id}`}
                            >
                              <Unlink className="mr-2 h-4 w-4" />
                              Unlink
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              onClick={() => linkMutation.mutate(account.id)}
                              disabled={linkMutation.isPending}
                              data-testid={`button-link-${account.id}`}
                            >
                              <Link2 className="mr-2 h-4 w-4" />
                              Link to Portfolio
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Info Banner */}
      {filteredAccounts.length > 0 && (
        <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800">
          <CardContent className="pt-6">
            <div className="flex gap-3">
              <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-900 dark:text-blue-100">
                <p className="font-semibold mb-1">About Discovered Accounts</p>
                <p>
                  These accounts were discovered through your Account Aggregator consents.
                  Link accounts to your portfolio to enable automatic data synchronization,
                  portfolio valuation, and performance tracking.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
