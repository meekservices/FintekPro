import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Activity, RefreshCw, CheckCircle2, XCircle, AlertTriangle, Zap, Clock, Server, BarChart3, TestTube } from 'lucide-react';
import { LoadingState } from '@/components/LoadingState';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';

interface ProviderHealth {
  name: string;
  isAvailable: boolean;
  isHealthy: boolean;
  successCount: number;
  failureCount: number;
  totalCalls: number;
  successRate: number;
  avgLatencyMs: number;
  lastSuccess: string | null;
  lastFailure: string | null;
  lastError: string | null;
  consecutiveFailures: number;
  rateLimitHits: number;
  registeredAt: string;
}

interface HealthResponse {
  success: boolean;
  providers: ProviderHealth[];
  fallbacksTriggered: number;
  totalRequests: number;
  primaryProvider: string;
}

interface UsageResponse {
  success: boolean;
  usage: {
    fmp: { dailyCalls: number; maxDaily: number; remaining: number };
    alphaVantage: { dailyCalls: number; maxDaily: number; minuteCalls: number; maxPerMinute: number; remaining: number };
  };
}

interface TestResponse {
  success: boolean;
  test: {
    symbol: string;
    provider: string;
    latencyMs: number;
    hasData: boolean;
    data: { companyName: string; sector: string; marketCap: number } | null;
  };
}

function formatTime(iso: string | null): string {
  if (!iso) return 'Never';
  const d = new Date(iso);
  const now = Date.now();
  const diff = now - d.getTime();
  if (diff < 60000) return `${Math.round(diff / 1000)}s ago`;
  if (diff < 3600000) return `${Math.round(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.round(diff / 3600000)}h ago`;
  return d.toLocaleDateString();
}

function StatusBadge({ isHealthy, isAvailable }: { isHealthy: boolean; isAvailable: boolean }) {
  if (!isAvailable) return <Badge variant="outline" className="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">Unavailable</Badge>;
  if (isHealthy) return <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">Healthy</Badge>;
  return <Badge variant="destructive">Unhealthy</Badge>;
}

export default function AdminDataProviders() {
  const { toast } = useToast();
  const [testSymbol, setTestSymbol] = useState('RELIANCE.NS');

  const { data: healthData, isLoading: healthLoading, refetch: refetchHealth } = useQuery<HealthResponse>({
    queryKey: ['/api/admin/data-providers/health'],
    refetchInterval: 30000,
  });

  const { data: usageData, isLoading: usageLoading, refetch: refetchUsage } = useQuery<UsageResponse>({
    queryKey: ['/api/admin/data-providers/usage'],
    refetchInterval: 30000,
  });

  const resetMutation = useMutation({
    mutationFn: async (providerName?: string) => {
      return apiRequest('POST', '/api/admin/data-providers/reset-metrics', { providerName });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/data-providers/health'] });
      toast({ title: 'Metrics Reset', description: 'Provider metrics have been reset.' });
    },
  });

  const testMutation = useMutation({
    mutationFn: async (symbol: string) => {
      const res = await fetch(`/api/admin/data-providers/test/registry?symbol=${encodeURIComponent(symbol)}`);
      return res.json() as Promise<TestResponse>;
    },
    onSuccess: (data) => {
      if (data.test?.hasData) {
        toast({ title: 'Test Passed', description: `${data.test.provider}: ${data.test.data?.companyName} (${data.test.latencyMs}ms)` });
      } else {
        toast({ title: 'No Data', description: 'No data returned from any provider', variant: 'destructive' });
      }
      refetchHealth();
    },
  });

  const providers = healthData?.providers || [];
  const fmpUsage = usageData?.usage?.fmp;
  const avUsage = usageData?.usage?.alphaVantage;

  if (healthLoading) return <LoadingState message="Loading provider health..." />;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Server className="h-6 w-6" /> Data Provider Health
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Monitor financial data provider status, fallback behavior, and API usage
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => { refetchHealth(); refetchUsage(); }}>
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={() => resetMutation.mutate(undefined)} disabled={resetMutation.isPending}>
            Reset All Metrics
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Total Requests</p>
                <p className="text-2xl font-bold">{healthData?.totalRequests || 0}</p>
              </div>
              <BarChart3 className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Fallbacks Triggered</p>
                <p className="text-2xl font-bold">{healthData?.fallbacksTriggered || 0}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Primary Provider</p>
                <p className="text-2xl font-bold">{healthData?.primaryProvider || '—'}</p>
              </div>
              <Zap className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Active Providers</p>
                <p className="text-2xl font-bold">{providers.filter(p => p.isHealthy).length}/{providers.length}</p>
              </div>
              <Activity className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {providers.map((provider) => (
          <Card key={provider.name} className={`${!provider.isHealthy ? 'border-red-300 dark:border-red-700' : 'border-green-200 dark:border-green-800'}`}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  {provider.isHealthy ? <CheckCircle2 className="h-5 w-5 text-green-500" /> : <XCircle className="h-5 w-5 text-red-500" />}
                  {provider.name}
                </CardTitle>
                <StatusBadge isHealthy={provider.isHealthy} isAvailable={provider.isAvailable} />
              </div>
              <CardDescription>
                Registered {formatTime(provider.registeredAt)}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Success</p>
                  <p className="text-lg font-semibold text-green-600 dark:text-green-400">{provider.successCount}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Failed</p>
                  <p className="text-lg font-semibold text-red-600 dark:text-red-400">{provider.failureCount}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Total</p>
                  <p className="text-lg font-semibold">{provider.totalCalls}</p>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-500 dark:text-gray-400">Success Rate</span>
                  <span className="font-medium">{provider.successRate}%</span>
                </div>
                <Progress value={provider.successRate} className="h-2" />
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-gray-400" />
                  <span className="text-gray-500 dark:text-gray-400">Avg Latency:</span>
                  <span className="font-medium">{provider.avgLatencyMs}ms</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-gray-400" />
                  <span className="text-gray-500 dark:text-gray-400">Rate Limits:</span>
                  <span className="font-medium">{provider.rateLimitHits}</span>
                </div>
              </div>

              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Last Success</span>
                  <span>{formatTime(provider.lastSuccess)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Last Failure</span>
                  <span className={provider.lastFailure ? 'text-red-500' : ''}>{formatTime(provider.lastFailure)}</span>
                </div>
                {provider.lastError && (
                  <div className="mt-1 p-2 bg-red-50 dark:bg-red-950 rounded text-red-600 dark:text-red-400 text-xs truncate" title={provider.lastError}>
                    {provider.lastError}
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-1">
                <Button variant="outline" size="sm" className="text-xs" onClick={() => resetMutation.mutate(provider.name)} disabled={resetMutation.isPending}>
                  Reset Metrics
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="h-5 w-5" /> API Usage
            </CardTitle>
            <CardDescription>Daily API call consumption per provider</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {usageLoading ? (
              <div className="text-sm text-gray-500">Loading usage data...</div>
            ) : (
              <>
                {fmpUsage && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">FMP (Financial Modeling Prep)</span>
                      <span>{fmpUsage.dailyCalls} / {fmpUsage.maxDaily}</span>
                    </div>
                    <Progress value={fmpUsage.maxDaily > 0 ? (fmpUsage.dailyCalls / fmpUsage.maxDaily) * 100 : 0} className="h-2" />
                    <p className="text-xs text-gray-500 dark:text-gray-400">{fmpUsage.remaining} calls remaining today</p>
                  </div>
                )}
                {avUsage && (
                  <div className="space-y-2 mt-4">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">Alpha Vantage</span>
                      <span>{avUsage.dailyCalls} / {avUsage.maxDaily}</span>
                    </div>
                    <Progress value={avUsage.maxDaily > 0 ? (avUsage.dailyCalls / avUsage.maxDaily) * 100 : 0} className="h-2" />
                    <p className="text-xs text-gray-500 dark:text-gray-400">{avUsage.remaining} calls remaining today | {avUsage.minuteCalls}/{avUsage.maxPerMinute} this minute</p>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TestTube className="h-5 w-5" /> Test Provider
            </CardTitle>
            <CardDescription>Test data retrieval with fallback chain</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                value={testSymbol}
                onChange={(e) => setTestSymbol(e.target.value)}
                placeholder="Symbol (e.g., RELIANCE.NS, AAPL)"
                className="flex-1"
              />
              <Button onClick={() => testMutation.mutate(testSymbol)} disabled={testMutation.isPending}>
                {testMutation.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : 'Test'}
              </Button>
            </div>
            {testMutation.data?.test && (
              <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-500">Provider</span>
                  <Badge>{testMutation.data.test.provider}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Latency</span>
                  <span>{testMutation.data.test.latencyMs}ms</span>
                </div>
                {testMutation.data.test.data && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Company</span>
                      <span className="font-medium">{testMutation.data.test.data.companyName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Sector</span>
                      <span>{testMutation.data.test.data.sector}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Market Cap</span>
                      <span>{testMutation.data.test.data.marketCap ? `$${(testMutation.data.test.data.marketCap / 1e9).toFixed(1)}B` : 'N/A'}</span>
                    </div>
                  </>
                )}
                {!testMutation.data.test.hasData && (
                  <p className="text-red-500 text-xs">No data returned from any provider</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
