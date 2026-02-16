import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Building2, TrendingUp, TrendingDown, Shield, RefreshCw, Search, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { LoadingState } from '@/components/LoadingState';
import { queryClient, apiRequest } from '@/lib/queryClient';

interface ClientIntelligence {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  companyName?: string;
  panNumber?: string;
  annualRevenue?: string;
  netProfit?: string;
  investableSurplus?: string;
  probe42Score?: number;
  riskCategory: string;
  investmentPotential: string;
  lastUpdated?: string;
  synced: boolean;
}

export default function ClientIntelligence() {
  const { toast } = useToast();
  const [selectedTab, setSelectedTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const { data: intelligenceData, isLoading } = useQuery<ClientIntelligence[]>({
    queryKey: ['/api/admin/marketing/intelligence']
  });

  const syncIntelligenceMutation = useMutation({
    mutationFn: async (userId: string) => {
      return apiRequest(`/api/admin/marketing/intelligence/${userId}/sync`, 'POST');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/marketing/intelligence'] });
      toast({ title: 'Client intelligence synced successfully' });
    },
    onError: () => {
      toast({
        title: 'Failed to sync intelligence',
        variant: 'destructive'
      });
    }
  });

  const syncAllIntelligenceMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('/api/admin/marketing/intelligence/sync-all', 'POST');
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/marketing/intelligence'] });
      toast({ title: `Synced ${data.count || 0} client intelligence records` });
    },
    onError: () => {
      toast({
        title: 'Failed to sync all intelligence',
        variant: 'destructive'
      });
    }
  });

  if (isLoading) {
    return <LoadingState variant="list" />;
  }

  const filteredData = intelligenceData?.filter(intel => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      intel.userName.toLowerCase().includes(query) ||
      intel.userEmail.toLowerCase().includes(query) ||
      (intel.companyName && intel.companyName.toLowerCase().includes(query))
    );
  });

  const filterByTab = (data: ClientIntelligence[] | undefined) => {
    if (!data) return [];
    if (selectedTab === 'all') return data;
    if (selectedTab === 'high') return data.filter(i => i.investmentPotential === 'high');
    if (selectedTab === 'medium') return data.filter(i => i.investmentPotential === 'medium');
    if (selectedTab === 'low') return data.filter(i => i.investmentPotential === 'low');
    return data;
  };

  const displayData = filterByTab(filteredData);

  // Calculate stats
  const stats = {
    total: intelligenceData?.length || 0,
    high: intelligenceData?.filter(i => i.investmentPotential === 'high').length || 0,
    medium: intelligenceData?.filter(i => i.investmentPotential === 'medium').length || 0,
    low: intelligenceData?.filter(i => i.investmentPotential === 'low').length || 0,
    synced: intelligenceData?.filter(i => i.synced).length || 0,
    avgScore: intelligenceData && intelligenceData.length > 0
      ? (intelligenceData.reduce((sum, i) => sum + (i.probe42Score || 0), 0) / intelligenceData.length).toFixed(1)
      : '0',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Client Intelligence</h1>
          <p className="text-muted-foreground">
            Financial health analysis of verified clients from Probe42
          </p>
        </div>
        <Button
          onClick={() => syncAllIntelligenceMutation.mutate()}
          disabled={syncAllIntelligenceMutation.isPending}
          data-testid="button-sync-all"
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          {syncAllIntelligenceMutation.isPending ? 'Syncing...' : 'Sync All Clients'}
        </Button>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Clients</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-clients">
              {stats.total}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.synced} synced with Probe42
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">High Potential</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600" data-testid="text-high-potential">
              {stats.high}
            </div>
            <p className="text-xs text-muted-foreground">
              High investment capacity
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Medium Potential</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600" data-testid="text-medium-potential">
              {stats.medium}
            </div>
            <p className="text-xs text-muted-foreground">
              Moderate investment capacity
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Avg Probe42 Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-avg-probe42-score">
              {stats.avgScore}/5
            </div>
            <p className="text-xs text-muted-foreground">
              Financial health indicator
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Search Bar */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, or company..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search"
          />
        </div>
      </div>

      {/* Client List with Tabs */}
      <Card>
        <CardHeader>
          <CardTitle>Client Portfolio Intelligence</CardTitle>
          <CardDescription>
            Financial data enriched from Probe42 API
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={selectedTab} onValueChange={setSelectedTab}>
            <TabsList>
              <TabsTrigger value="all" data-testid="tab-all">
                All Clients ({stats.total})
              </TabsTrigger>
              <TabsTrigger value="high" data-testid="tab-high">
                High ({stats.high})
              </TabsTrigger>
              <TabsTrigger value="medium" data-testid="tab-medium">
                Medium ({stats.medium})
              </TabsTrigger>
              <TabsTrigger value="low" data-testid="tab-low">
                Low ({stats.low})
              </TabsTrigger>
            </TabsList>

            <TabsContent value={selectedTab} className="mt-6">
              {displayData.length === 0 ? (
                <div className="text-center py-12">
                  <Building2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">
                    {searchQuery ? 'No clients match your search' : 'No client intelligence data available'}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {displayData.map((intel) => (
                    <div
                      key={intel.id}
                      className="border rounded-lg p-4 hover:bg-accent transition-colors"
                      data-testid={`client-${intel.id}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-3">
                            <div className={`p-2 rounded-full ${
                              intel.investmentPotential === 'high' ? 'bg-green-100 dark:bg-green-900/30' :
                              intel.investmentPotential === 'medium' ? 'bg-yellow-100 dark:bg-yellow-900/30' :
                              'bg-muted'
                            }`}>
                              {intel.probe42Score && intel.probe42Score >= 4 ? (
                                <TrendingUp className="h-5 w-5 text-green-600" />
                              ) : intel.probe42Score && intel.probe42Score <= 2 ? (
                                <TrendingDown className="h-5 w-5 text-red-600" />
                              ) : (
                                <Shield className="h-5 w-5 text-yellow-600" />
                              )}
                            </div>
                            <div>
                              <h3 className="font-semibold" data-testid={`text-client-name-${intel.id}`}>
                                {intel.userName}
                              </h3>
                              <p className="text-sm text-muted-foreground">
                                {intel.userEmail}
                              </p>
                              {intel.companyName && (
                                <p className="text-sm text-muted-foreground">
                                  {intel.companyName}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                            <div>
                              <p className="text-xs text-muted-foreground">Probe42 Score</p>
                              <p className="font-semibold">
                                {intel.probe42Score ? `${intel.probe42Score}/5` : 'N/A'}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Investment Potential</p>
                              <Badge variant={
                                intel.investmentPotential === 'high' ? 'default' :
                                intel.investmentPotential === 'medium' ? 'secondary' :
                                'outline'
                              }>
                                {intel.investmentPotential}
                              </Badge>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Risk Category</p>
                              <Badge variant="outline">{intel.riskCategory}</Badge>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Annual Revenue</p>
                              <p className="font-semibold">
                                {intel.annualRevenue 
                                  ? `₹${(parseFloat(intel.annualRevenue) / 10000000).toFixed(2)}Cr`
                                  : 'N/A'
                                }
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Investable Surplus</p>
                              <p className="font-semibold text-green-600">
                                {intel.investableSurplus
                                  ? `₹${(parseFloat(intel.investableSurplus) / 100000).toFixed(2)}L`
                                  : 'N/A'
                                }
                              </p>
                            </div>
                          </div>

                          {!intel.synced && (
                            <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                              <AlertCircle className="h-4 w-4" />
                              <span>Not synced with Probe42 yet</span>
                            </div>
                          )}
                        </div>

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => syncIntelligenceMutation.mutate(intel.userId)}
                          disabled={syncIntelligenceMutation.isPending}
                          data-testid={`button-sync-${intel.id}`}
                        >
                          <RefreshCw className="mr-2 h-4 w-4" />
                          Sync
                        </Button>
                      </div>

                      {intel.lastUpdated && (
                        <p className="text-xs text-muted-foreground mt-3">
                          Last updated: {new Date(intel.lastUpdated).toLocaleString()}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
