import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Loader2, RefreshCw, Database, TrendingUp, AlertCircle, CheckCircle, ArrowUpDown, FileText, AlertTriangle, History } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface MarketIndex {
  id: string;
  indexCode: string;
  indexName: string;
  provider: string;
  description: string;
  isActive: boolean;
}

interface IndexCoverage {
  indexCode: string;
  indexName: string;
  dataPoints: number;
  earliestDate: string | null;
  latestDate: string | null;
}

interface BenchmarkMapping {
  id: string;
  mfIsin: string;
  mfSchemeCode: string | null;
  indexCode: string;
  confidenceScore: string;
  source: string;
  mappingReason: string | null;
  isOverridden: boolean;
  createdAt: string;
}

interface MappingStats {
  totalMappings: number;
  autoMappings: number;
  manualOverrides: number;
  highConfidence: number;
  byIndexCode: Record<string, number>;
}

interface AmfiStats {
  total: number;
  normalized: number;
  failed: number;
  ambiguous: number;
  byIndex: Record<string, number>;
}

interface AmfiConflict {
  isin: string;
  schemeName: string | null;
  amfiBenchmark: string | null;
  amfiNormalized: string | null;
  currentMapping: string | null;
  currentSource: string | null;
  currentConfidence: string | null;
}

interface BenchmarkHistoryItem {
  mfIsin: string;
  oldIndexCode: string | null;
  newIndexCode: string | null;
  changeSource: string | null;
  changedAt: string | null;
}

export default function AdminMfBenchmarks() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("indices");

  const { data: benchmarkData, isLoading: benchmarksLoading } = useQuery<{
    success: boolean;
    indices: MarketIndex[];
    coverage: IndexCoverage[];
  }>({
    queryKey: ["/api/admin/benchmarks"],
  });

  const { data: mappingsData, isLoading: mappingsLoading } = useQuery<{
    success: boolean;
    mappings: BenchmarkMapping[];
    stats: MappingStats;
  }>({
    queryKey: ["/api/admin/mf-benchmark-mappings"],
  });

  const { data: amfiStatsData, isLoading: amfiStatsLoading } = useQuery<{
    success: boolean;
  } & AmfiStats>({
    queryKey: ["/api/admin/amfi-benchmark/stats"],
  });

  const { data: conflictsData, isLoading: conflictsLoading, refetch: refetchConflicts } = useQuery<{
    success: boolean;
    conflicts: AmfiConflict[];
    count: number;
  }>({
    queryKey: ["/api/admin/amfi-benchmark/conflicts"],
  });

  const { data: historyData, isLoading: historyLoading } = useQuery<{
    success: boolean;
    history: BenchmarkHistoryItem[];
    count: number;
  }>({
    queryKey: ["/api/admin/amfi-benchmark/history"],
  });

  const syncBenchmarksMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("/api/admin/benchmarks/sync", { method: "POST" });
    },
    onSuccess: () => {
      toast({ title: "Benchmark sync started", description: "Index data is being fetched in the background." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/benchmarks"] });
    },
    onError: (error: any) => {
      toast({ title: "Sync failed", description: error.message, variant: "destructive" });
    },
  });

  const autoMapMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("/api/admin/mf-benchmark-mappings/auto-map", { method: "POST", body: JSON.stringify({ limit: 500 }) });
    },
    onSuccess: (data: any) => {
      toast({ title: "Auto-mapping complete", description: data.message });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/mf-benchmark-mappings"] });
    },
    onError: (error: any) => {
      toast({ title: "Auto-mapping failed", description: error.message, variant: "destructive" });
    },
  });

  const recomputeMetricsMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("/api/admin/mf-relative-metrics/recompute", { method: "POST", body: JSON.stringify({ batchSize: 50 }) });
    },
    onSuccess: () => {
      toast({ title: "Metrics recomputation started", description: "Alpha, Beta, and other metrics are being calculated." });
    },
    onError: (error: any) => {
      toast({ title: "Recompute failed", description: error.message, variant: "destructive" });
    },
  });

  const syncAmfiMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("/api/admin/amfi-benchmark/sync", { method: "POST" });
    },
    onSuccess: (data: any) => {
      toast({ title: "AMFI sync complete", description: data.message });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/amfi-benchmark/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/amfi-benchmark/conflicts"] });
    },
    onError: (error: any) => {
      toast({ title: "AMFI sync failed", description: error.message, variant: "destructive" });
    },
  });

  const autoMapAmfiMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("/api/admin/amfi-benchmark/auto-map", { method: "POST" });
    },
    onSuccess: (data: any) => {
      toast({ title: "AMFI auto-map complete", description: data.message });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/mf-benchmark-mappings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/amfi-benchmark/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/amfi-benchmark/conflicts"] });
    },
    onError: (error: any) => {
      toast({ title: "AMFI auto-map failed", description: error.message, variant: "destructive" });
    },
  });

  const resolveConflictMutation = useMutation({
    mutationFn: async ({ isin, resolution, manualIndexCode }: { isin: string; resolution: string; manualIndexCode?: string }) => {
      return apiRequest("/api/admin/amfi-benchmark/resolve-conflict", { 
        method: "POST", 
        body: JSON.stringify({ isin, resolution, manualIndexCode }) 
      });
    },
    onSuccess: () => {
      toast({ title: "Conflict resolved", description: "Benchmark mapping updated successfully." });
      refetchConflicts();
      queryClient.invalidateQueries({ queryKey: ["/api/admin/mf-benchmark-mappings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/amfi-benchmark/history"] });
    },
    onError: (error: any) => {
      toast({ title: "Resolution failed", description: error.message, variant: "destructive" });
    },
  });

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString();
  };

  const getConfidenceBadge = (score: string) => {
    const numScore = parseFloat(score);
    if (numScore >= 0.85) return <Badge className="bg-green-500">High ({(numScore * 100).toFixed(0)}%)</Badge>;
    if (numScore >= 0.70) return <Badge className="bg-yellow-500">Medium ({(numScore * 100).toFixed(0)}%)</Badge>;
    return <Badge variant="destructive">Low ({(numScore * 100).toFixed(0)}%)</Badge>;
  };

  const getSourceBadge = (source: string | null) => {
    if (source === 'amfi') return <Badge className="bg-blue-500">AMFI</Badge>;
    if (source === 'manual') return <Badge className="bg-purple-500">Manual</Badge>;
    return <Badge variant="secondary">{source || 'Auto'}</Badge>;
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Benchmark Management</h1>
          <p className="text-muted-foreground">
            Manage market index data, AMFI benchmarks, and mutual fund mappings for relative metrics
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => syncBenchmarksMutation.mutate()}
            disabled={syncBenchmarksMutation.isPending}
            variant="outline"
          >
            {syncBenchmarksMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Sync Index Data
          </Button>
          <Button
            onClick={() => recomputeMetricsMutation.mutate()}
            disabled={recomputeMetricsMutation.isPending}
          >
            {recomputeMetricsMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <TrendingUp className="h-4 w-4 mr-2" />
            )}
            Recompute Metrics
          </Button>
        </div>
      </div>

      {mappingsData?.stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Mappings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{mappingsData.stats.totalMappings.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">AMFI Normalized</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{amfiStatsData?.normalized?.toLocaleString() || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Auto-Mapped</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{mappingsData.stats.autoMappings.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Conflicts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{conflictsData?.count || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">High Confidence</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{mappingsData.stats.highConfidence.toLocaleString()}</div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="indices">Market Indices</TabsTrigger>
          <TabsTrigger value="amfi">AMFI Data</TabsTrigger>
          <TabsTrigger value="conflicts">
            Conflicts {conflictsData?.count ? <Badge variant="destructive" className="ml-1">{conflictsData.count}</Badge> : null}
          </TabsTrigger>
          <TabsTrigger value="mappings">Fund Mappings</TabsTrigger>
          <TabsTrigger value="history">Change History</TabsTrigger>
        </TabsList>

        <TabsContent value="indices" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Market Indices</CardTitle>
              <CardDescription>Benchmark indices used for relative metrics calculation</CardDescription>
            </CardHeader>
            <CardContent>
              {benchmarksLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Index Code</TableHead>
                      <TableHead>Index Name</TableHead>
                      <TableHead>Provider</TableHead>
                      <TableHead>Data Points</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {benchmarkData?.indices?.map((index) => {
                      const coverage = benchmarkData.coverage?.find(c => c.indexCode === index.indexCode);
                      return (
                        <TableRow key={index.id}>
                          <TableCell className="font-mono font-medium">{index.indexCode}</TableCell>
                          <TableCell>{index.indexName}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{index.provider}</Badge>
                          </TableCell>
                          <TableCell>
                            {coverage?.dataPoints?.toLocaleString() || 0} points
                          </TableCell>
                          <TableCell>
                            {index.isActive ? (
                              <Badge className="bg-green-500">Active</Badge>
                            ) : (
                              <Badge variant="secondary">Inactive</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="amfi" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>AMFI Benchmark Data</CardTitle>
                <CardDescription>Raw benchmark data from AMFI scheme master with normalization status</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => syncAmfiMutation.mutate()}
                  disabled={syncAmfiMutation.isPending}
                  variant="outline"
                >
                  {syncAmfiMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <FileText className="h-4 w-4 mr-2" />
                  )}
                  Sync AMFI Data
                </Button>
                <Button
                  onClick={() => autoMapAmfiMutation.mutate()}
                  disabled={autoMapAmfiMutation.isPending}
                >
                  {autoMapAmfiMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <ArrowUpDown className="h-4 w-4 mr-2" />
                  )}
                  Apply AMFI Mappings
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {amfiStatsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="grid grid-cols-4 gap-4">
                    <div className="p-4 border rounded-lg text-center">
                      <div className="text-3xl font-bold">{amfiStatsData?.total?.toLocaleString() || 0}</div>
                      <div className="text-sm text-muted-foreground">Total Schemes</div>
                    </div>
                    <div className="p-4 border rounded-lg text-center bg-green-50 dark:bg-green-900/20">
                      <div className="text-3xl font-bold text-green-600">{amfiStatsData?.normalized?.toLocaleString() || 0}</div>
                      <div className="text-sm text-muted-foreground">Normalized (95% conf)</div>
                    </div>
                    <div className="p-4 border rounded-lg text-center bg-red-50 dark:bg-red-900/20">
                      <div className="text-3xl font-bold text-red-600">{amfiStatsData?.failed?.toLocaleString() || 0}</div>
                      <div className="text-sm text-muted-foreground">Failed to Normalize</div>
                    </div>
                    <div className="p-4 border rounded-lg text-center bg-yellow-50 dark:bg-yellow-900/20">
                      <div className="text-3xl font-bold text-yellow-600">{amfiStatsData?.ambiguous?.toLocaleString() || 0}</div>
                      <div className="text-sm text-muted-foreground">Ambiguous</div>
                    </div>
                  </div>

                  {amfiStatsData?.byIndex && Object.keys(amfiStatsData.byIndex).length > 0 && (
                    <div>
                      <h4 className="font-medium mb-3">Normalized Benchmarks Distribution</h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                        {Object.entries(amfiStatsData.byIndex)
                          .sort((a, b) => b[1] - a[1])
                          .map(([indexCode, count]) => (
                            <div key={indexCode} className="p-3 border rounded-lg">
                              <div className="font-mono text-sm text-muted-foreground">{indexCode}</div>
                              <div className="text-lg font-bold">{count}</div>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  <div className="text-sm text-muted-foreground">
                    <p>AMFI benchmark data is parsed from the scheme master file and normalized to canonical index codes.</p>
                    <p>Schemes with normalized benchmarks receive a 95% confidence score for mapping.</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="conflicts" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
                <CardTitle>Benchmark Conflicts</CardTitle>
              </div>
              <CardDescription>
                Funds where AMFI benchmark differs from current category-based mapping. Resolve to improve accuracy.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {conflictsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : conflictsData?.conflicts?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
                  <p>No conflicts found. All AMFI benchmarks match current mappings.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ISIN</TableHead>
                      <TableHead>Scheme Name</TableHead>
                      <TableHead>AMFI Benchmark</TableHead>
                      <TableHead>Current Mapping</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {conflictsData?.conflicts?.map((conflict) => (
                      <TableRow key={conflict.isin}>
                        <TableCell className="font-mono text-sm">{conflict.isin}</TableCell>
                        <TableCell className="max-w-xs truncate" title={conflict.schemeName || ''}>
                          {conflict.schemeName || '—'}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <Badge className="bg-blue-500">{conflict.amfiNormalized}</Badge>
                            <div className="text-xs text-muted-foreground truncate max-w-xs" title={conflict.amfiBenchmark || ''}>
                              {conflict.amfiBenchmark}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <Badge variant="outline">{conflict.currentMapping}</Badge>
                            <div className="text-xs text-muted-foreground">
                              {getSourceBadge(conflict.currentSource)} {conflict.currentConfidence ? `(${(parseFloat(conflict.currentConfidence) * 100).toFixed(0)}%)` : ''}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => resolveConflictMutation.mutate({ isin: conflict.isin, resolution: 'accept_amfi' })}
                              disabled={resolveConflictMutation.isPending}
                            >
                              Accept AMFI
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => resolveConflictMutation.mutate({ isin: conflict.isin, resolution: 'keep_current' })}
                              disabled={resolveConflictMutation.isPending}
                            >
                              Keep Current
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mappings" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Fund Benchmark Mappings</CardTitle>
                <CardDescription>
                  Mutual fund to benchmark index mappings with confidence scores
                </CardDescription>
              </div>
              <Button
                onClick={() => autoMapMutation.mutate()}
                disabled={autoMapMutation.isPending}
                variant="outline"
              >
                {autoMapMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <ArrowUpDown className="h-4 w-4 mr-2" />
                )}
                Category Auto-Map
              </Button>
            </CardHeader>
            <CardContent>
              {mappingsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : mappingsData?.mappings?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Database className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No mappings found. Click "Apply AMFI Mappings" or "Category Auto-Map" to create mappings.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ISIN</TableHead>
                      <TableHead>Benchmark</TableHead>
                      <TableHead>Confidence</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Reason</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mappingsData?.mappings?.slice(0, 50).map((mapping) => (
                      <TableRow key={mapping.id}>
                        <TableCell className="font-mono text-sm">{mapping.mfIsin}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{mapping.indexCode}</Badge>
                        </TableCell>
                        <TableCell>{getConfidenceBadge(mapping.confidenceScore)}</TableCell>
                        <TableCell>{getSourceBadge(mapping.source)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                          {mapping.mappingReason || "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <History className="h-5 w-5" />
                <CardTitle>Benchmark Change History</CardTitle>
              </div>
              <CardDescription>
                Track changes when benchmarks are updated or overridden
              </CardDescription>
            </CardHeader>
            <CardContent>
              {historyLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : historyData?.history?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No benchmark changes recorded yet.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ISIN</TableHead>
                      <TableHead>Old Benchmark</TableHead>
                      <TableHead>New Benchmark</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Changed At</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historyData?.history?.map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-mono text-sm">{item.mfIsin}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-red-50">{item.oldIndexCode || '—'}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-green-50">{item.newIndexCode || '—'}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{item.changeSource || '—'}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(item.changedAt)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
