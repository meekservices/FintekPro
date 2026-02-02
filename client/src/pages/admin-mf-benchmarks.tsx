import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Loader2, RefreshCw, Database, TrendingUp, AlertCircle, CheckCircle, ArrowUpDown } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Benchmark Management</h1>
          <p className="text-muted-foreground">
            Manage market index data and mutual fund benchmark mappings for relative metrics calculation
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
            onClick={() => autoMapMutation.mutate()}
            disabled={autoMapMutation.isPending}
            variant="outline"
          >
            {autoMapMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <ArrowUpDown className="h-4 w-4 mr-2" />
            )}
            Auto-Map Funds
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
        <div className="grid grid-cols-4 gap-4">
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
              <CardTitle className="text-sm font-medium text-muted-foreground">Auto-Mapped</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{mappingsData.stats.autoMappings.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Manual Overrides</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{mappingsData.stats.manualOverrides}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">High Confidence (≥70%)</CardTitle>
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
          <TabsTrigger value="mappings">Fund Mappings</TabsTrigger>
          <TabsTrigger value="coverage">Data Coverage</TabsTrigger>
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
                      <TableHead>Description</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {benchmarkData?.indices?.map((index) => (
                      <TableRow key={index.id}>
                        <TableCell className="font-mono font-medium">{index.indexCode}</TableCell>
                        <TableCell>{index.indexName}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{index.provider}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                          {index.description}
                        </TableCell>
                        <TableCell>
                          {index.isActive ? (
                            <Badge className="bg-green-500">Active</Badge>
                          ) : (
                            <Badge variant="secondary">Inactive</Badge>
                          )}
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
            <CardHeader>
              <CardTitle>Fund → Benchmark Mappings</CardTitle>
              <CardDescription>
                Mutual fund to benchmark index mappings with confidence scores
              </CardDescription>
            </CardHeader>
            <CardContent>
              {mappingsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : mappingsData?.mappings?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Database className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No mappings found. Click "Auto-Map Funds" to create mappings.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ISIN</TableHead>
                      <TableHead>Scheme Code</TableHead>
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
                        <TableCell className="font-mono text-sm">{mapping.mfSchemeCode || "—"}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{mapping.indexCode}</Badge>
                        </TableCell>
                        <TableCell>{getConfidenceBadge(mapping.confidenceScore)}</TableCell>
                        <TableCell>
                          <Badge variant={mapping.isOverridden ? "default" : "secondary"}>
                            {mapping.isOverridden ? "Manual" : mapping.source}
                          </Badge>
                        </TableCell>
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

        <TabsContent value="coverage" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Data Coverage</CardTitle>
              <CardDescription>Historical data availability for each benchmark index</CardDescription>
            </CardHeader>
            <CardContent>
              {benchmarksLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <div className="space-y-4">
                  {benchmarkData?.coverage?.map((cov) => {
                    const hasData = cov.dataPoints > 0;
                    const yearsOfData = cov.dataPoints / 252;
                    const progress = Math.min((yearsOfData / 5) * 100, 100);

                    return (
                      <div key={cov.indexCode} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{cov.indexName}</span>
                            <Badge variant="outline" className="font-mono">{cov.indexCode}</Badge>
                          </div>
                          <div className="flex items-center gap-4 text-sm">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger>
                                  <span className="text-muted-foreground">
                                    {cov.dataPoints.toLocaleString()} points
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>~{yearsOfData.toFixed(1)} years of daily data</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            {hasData ? (
                              <span className="text-muted-foreground">
                                {formatDate(cov.earliestDate)} → {formatDate(cov.latestDate)}
                              </span>
                            ) : (
                              <span className="text-destructive">No data</span>
                            )}
                            {hasData ? (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            ) : (
                              <AlertCircle className="h-4 w-4 text-destructive" />
                            )}
                          </div>
                        </div>
                        <Progress value={progress} className="h-2" />
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {mappingsData?.stats?.byIndexCode && (
            <Card>
              <CardHeader>
                <CardTitle>Mappings by Benchmark</CardTitle>
                <CardDescription>Distribution of fund mappings across benchmark indices</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {Object.entries(mappingsData.stats.byIndexCode).map(([indexCode, count]) => (
                    <div key={indexCode} className="p-3 border rounded-lg">
                      <div className="font-mono text-sm text-muted-foreground">{indexCode}</div>
                      <div className="text-xl font-bold">{count}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
