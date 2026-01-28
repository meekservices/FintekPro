import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  FileText, 
  Cpu, 
  RefreshCw, 
  CheckCircle2,
  Database,
  Settings2,
  Brain,
  BarChart3,
  AlertTriangle,
  Clock,
  TrendingUp,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";

interface CacheStats {
  entries: number;
  hitRate: number;
  missRate: number;
}

interface ParserConfig {
  enableLearning: boolean;
  minConfidenceThreshold: number;
}

interface ParsingMetrics {
  totalParses: number;
  successfulParses: number;
  failedParses: number;
  averageConfidence: number;
  averageParseTime: number;
  providerBreakdown: Record<string, number>;
}

interface ConfigResponse {
  success: boolean;
  config: ParserConfig;
  cache: CacheStats;
  metrics: {
    last24Hours: ParsingMetrics;
  };
}

interface ErrorEntry {
  timestamp: string;
  error: string;
  fileName?: string;
}

export default function ParserConfigPage() {
  const { toast } = useToast();
  const [confidenceThreshold, setConfidenceThreshold] = useState(50);

  const { data, isLoading, refetch } = useQuery<ConfigResponse>({
    queryKey: ['/api/admin/parser/config'],
  });

  const { data: errorsData } = useQuery<{ success: boolean; errors: ErrorEntry[]; count: number }>({
    queryKey: ['/api/admin/parser/errors'],
  });

  useEffect(() => {
    if (data?.config) {
      setConfidenceThreshold(Math.round(data.config.minConfidenceThreshold * 100));
    }
  }, [data?.config]);

  const updateConfig = useMutation({
    mutationFn: async (updates: { enableLearning?: boolean; minConfidenceThreshold?: number }) => {
      const res = await apiRequest('POST', '/api/admin/parser/config', updates);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/parser/config'] });
      toast({
        title: "Configuration Updated",
        description: "Parser settings have been saved",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const clearCache = useMutation({
    mutationFn: async (type: 'profile' | 'all') => {
      const res = await apiRequest('POST', '/api/admin/parser/cache/clear', { type });
      return res.json();
    },
    onSuccess: (_, type) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/parser/config'] });
      toast({
        title: "Cache Cleared",
        description: type === 'all' ? "All caches have been cleared" : "Profile cache has been cleared",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-6 max-w-4xl space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  const cache = data?.cache;
  const metrics = data?.metrics?.last24Hours;

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Unified PDF Parser</h1>
          <p className="text-muted-foreground">
            Configure CAS statement and portfolio PDF parsing settings
          </p>
        </div>
        <Badge variant="default" className="flex items-center gap-2">
          <Cpu className="w-4 h-4" />
          Unified Parser
        </Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <FileText className="w-8 h-8 mx-auto mb-2 text-primary" />
              <p className="text-2xl font-bold">{metrics?.totalParses ?? 0}</p>
              <p className="text-xs text-muted-foreground">Total Parses (24h)</p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-green-600" />
              <p className="text-2xl font-bold text-green-600">
                {metrics?.totalParses ? ((metrics.successfulParses / metrics.totalParses) * 100).toFixed(0) : 0}%
              </p>
              <p className="text-xs text-muted-foreground">Success Rate</p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <TrendingUp className="w-8 h-8 mx-auto mb-2 text-blue-600" />
              <p className="text-2xl font-bold text-blue-600">
                {((metrics?.averageConfidence ?? 0) * 100).toFixed(0)}%
              </p>
              <p className="text-xs text-muted-foreground">Avg Confidence</p>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <Clock className="w-8 h-8 mx-auto mb-2 text-orange-600" />
              <p className="text-2xl font-bold text-orange-600">
                {(metrics?.averageParseTime ?? 0).toFixed(1)}s
              </p>
              <p className="text-xs text-muted-foreground">Avg Parse Time</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings2 className="w-5 h-5" />
              Parser Settings
            </CardTitle>
            <CardDescription>Configure parsing behavior</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="learning">Learning Mode</Label>
                <p className="text-xs text-muted-foreground">Store successful parsing patterns for improved accuracy</p>
              </div>
              <Switch
                id="learning"
                checked={data?.config?.enableLearning ?? true}
                onCheckedChange={(checked) => {
                  updateConfig.mutate({ enableLearning: checked });
                }}
                disabled={updateConfig.isPending}
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Minimum Confidence Threshold</Label>
                <span className="text-sm font-mono bg-muted px-2 py-1 rounded">{confidenceThreshold}%</span>
              </div>
              <Slider
                value={[confidenceThreshold]}
                onValueChange={([value]) => setConfidenceThreshold(value)}
                onValueCommit={([value]) => updateConfig.mutate({ minConfidenceThreshold: value / 100 })}
                min={0}
                max={100}
                step={5}
                disabled={updateConfig.isPending}
              />
              <p className="text-xs text-muted-foreground">
                Holdings with confidence below this threshold will be flagged for manual review
              </p>
            </div>

            <div className="pt-4 border-t">
              <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                <Brain className="w-4 h-4" />
                Supported Providers
              </h4>
              <div className="flex flex-wrap gap-1">
                {['Zerodha', 'Groww', 'ICICI Direct', 'HDFC', 'Kotak', 'Upstox', 'MF Central', 'INDmoney', 'Kuvera'].map(provider => (
                  <Badge key={provider} variant="secondary" className="text-xs">
                    {provider}
                  </Badge>
                ))}
                <Badge variant="outline" className="text-xs">+8 more</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5" />
              Cache & Performance
            </CardTitle>
            <CardDescription>Profile cache statistics</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold">{cache?.entries ?? 0}</p>
                <p className="text-xs text-muted-foreground">Cached Profiles</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-green-600">{((cache?.hitRate ?? 0) * 100).toFixed(0)}%</p>
                <p className="text-xs text-muted-foreground">Hit Rate</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-orange-600">{((cache?.missRate ?? 0) * 100).toFixed(0)}%</p>
                <p className="text-xs text-muted-foreground">Miss Rate</p>
              </div>
            </div>

            <div className="space-y-2">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => clearCache.mutate('profile')}
                disabled={clearCache.isPending}
              >
                {clearCache.isPending ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-2" />
                )}
                Clear Profile Cache
              </Button>

              <Button
                variant="outline"
                className="w-full"
                onClick={() => clearCache.mutate('all')}
                disabled={clearCache.isPending}
              >
                <Database className="w-4 h-4 mr-2" />
                Clear All Caches
              </Button>

              <Button
                variant="outline"
                className="w-full"
                onClick={() => refetch()}
              >
                <BarChart3 className="w-4 h-4 mr-2" />
                Refresh Stats
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {metrics?.providerBreakdown && Object.keys(metrics.providerBreakdown).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Provider Breakdown (24h)
            </CardTitle>
            <CardDescription>Document sources detected by provider type</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(metrics.providerBreakdown).map(([provider, count]) => (
                <div key={provider} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <span className="text-sm font-medium">{provider}</span>
                  <Badge variant="secondary">{count}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {errorsData?.errors && errorsData.errors.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              Recent Parsing Errors
            </CardTitle>
            <CardDescription>Last {errorsData.count} parsing errors</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {errorsData.errors.slice(0, 5).map((error, idx) => (
                <div key={idx} className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg text-sm">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-muted-foreground">
                      {new Date(error.timestamp).toLocaleString()}
                    </span>
                    {error.fileName && (
                      <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">
                        {error.fileName}
                      </span>
                    )}
                  </div>
                  <p className="text-red-700 dark:text-red-300">{error.error}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
