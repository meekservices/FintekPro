import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { AdminLayout } from "@/components/layout/admin-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  RefreshCw, 
  Database, 
  CheckCircle2, 
  Clock, 
  TrendingUp,
  Loader2
} from "lucide-react";

interface EnrichmentStats {
  totalFunds: number;
  enrichedFunds: number;
  pendingFunds: number;
  progressPercentage: number;
}

interface SyncStatus {
  isRunning: boolean;
  lastSyncTime: string | null;
}

interface RecentlyEnrichedFund {
  schemeCode: string;
  schemeName: string;
  returns1y: number | null;
  returns3y: number | null;
  returns5y: number | null;
  lastUpdated: string;
}

interface EnrichmentStatusResponse {
  success: boolean;
  stats: EnrichmentStats;
  syncStatus: SyncStatus;
  recentlyEnriched: RecentlyEnrichedFund[];
}

export default function AdminMFEnrichment() {
  const { toast } = useToast();
  const [batchSize] = useState(20);

  const { data: statusData, isLoading, refetch } = useQuery<EnrichmentStatusResponse>({
    queryKey: ['/api/admin/mf-enrichment-status'],
    refetchInterval: 5000,
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('/api/admin/mf-enrichment-sync', {
        method: 'POST',
        body: JSON.stringify({ batchLimit: batchSize }),
        headers: { 'Content-Type': 'application/json' },
      });
    },
    onSuccess: () => {
      toast({ 
        title: "Sync Started", 
        description: `Syncing up to ${batchSize} funds. This will take a few minutes.` 
      });
      setTimeout(() => refetch(), 2000);
    },
    onError: (error: any) => {
      toast({ 
        title: "Sync Failed", 
        description: error.message || "Failed to start sync",
        variant: "destructive" 
      });
    },
  });

  const handleSync = () => {
    syncMutation.mutate();
  };

  const stats = statusData?.stats;
  const syncStatus = statusData?.syncStatus;
  const recentlyEnriched = statusData?.recentlyEnriched || [];

  const formatReturns = (value: number | null) => {
    if (value === null) return "N/A";
    return `${value.toFixed(2)}%`;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('en-IN', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">MF Returns Data Enrichment</h1>
            <p className="text-muted-foreground mt-1">
              Monitor and manage mutual fund returns data synchronization
            </p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={() => refetch()}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button 
              onClick={handleSync}
              disabled={syncMutation.isPending || syncStatus?.isRunning}
            >
              {(syncMutation.isPending || syncStatus?.isRunning) ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Database className="h-4 w-4 mr-2" />
              )}
              {syncStatus?.isRunning ? 'Syncing...' : 'Sync Now'}
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Funds</CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalFunds?.toLocaleString() || '-'}</div>
              <p className="text-xs text-muted-foreground">In database</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Enriched</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats?.enrichedFunds?.toLocaleString() || '-'}</div>
              <p className="text-xs text-muted-foreground">With returns data</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
              <Clock className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">{stats?.pendingFunds?.toLocaleString() || '-'}</div>
              <p className="text-xs text-muted-foreground">Awaiting sync</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Progress</CardTitle>
              <TrendingUp className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{stats?.progressPercentage || 0}%</div>
              <Progress value={stats?.progressPercentage || 0} className="mt-2" />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Sync Status</CardTitle>
            <CardDescription>Current synchronization status and last sync time</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Status:</span>
                {syncStatus?.isRunning ? (
                  <Badge variant="default" className="bg-blue-500">
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    Running
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-green-600 border-green-600">
                    Idle
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Last Sync:</span>
                <span className="text-sm text-muted-foreground">
                  {syncStatus?.lastSyncTime ? formatDate(syncStatus.lastSyncTime) : 'Never'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recently Enriched Funds</CardTitle>
            <CardDescription>Last 5 funds updated with returns data</CardDescription>
          </CardHeader>
          <CardContent>
            {recentlyEnriched.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Scheme Code</TableHead>
                    <TableHead>Fund Name</TableHead>
                    <TableHead className="text-right">1Y Returns</TableHead>
                    <TableHead className="text-right">3Y Returns</TableHead>
                    <TableHead className="text-right">5Y Returns</TableHead>
                    <TableHead className="text-right">Last Updated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentlyEnriched.map((fund) => (
                    <TableRow key={fund.schemeCode}>
                      <TableCell className="font-mono text-sm">{fund.schemeCode}</TableCell>
                      <TableCell className="max-w-[300px] truncate" title={fund.schemeName}>
                        {fund.schemeName}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant={fund.returns1y && fund.returns1y > 0 ? "default" : "secondary"}>
                          {formatReturns(fund.returns1y)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant={fund.returns3y && fund.returns3y > 0 ? "default" : "secondary"}>
                          {formatReturns(fund.returns3y)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant={fund.returns5y && fund.returns5y > 0 ? "default" : "secondary"}>
                          {formatReturns(fund.returns5y)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">
                        {formatDate(fund.lastUpdated)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No funds enriched yet. Click "Sync Now" to start enriching fund data.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
