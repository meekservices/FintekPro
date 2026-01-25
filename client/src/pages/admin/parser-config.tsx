import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  FileText, 
  Cpu, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle2,
  Zap,
  Database,
  Settings2,
  Brain,
  BarChart3,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";

interface ParserConfig {
  version: 'v1' | 'v2' | 'dual';
  enableDualRun: boolean;
  enableLearning: boolean;
  enableConfidenceScoring: boolean;
  logComparisons: boolean;
  forceV1Fallback: boolean;
  minConfidenceThreshold: number;
}

interface CacheStats {
  entries: number;
  hitRate: number;
  missRate: number;
}

interface ConfigResponse {
  success: boolean;
  config: ParserConfig;
  cache: CacheStats;
}

export default function ParserConfigPage() {
  const { toast } = useToast();
  const [pendingVersion, setPendingVersion] = useState<'v1' | 'v2' | 'dual' | null>(null);

  const { data, isLoading, refetch } = useQuery<ConfigResponse>({
    queryKey: ['/api/admin/parser/config'],
  });

  const updateConfig = useMutation({
    mutationFn: async (updates: Partial<ParserConfig>) => {
      const res = await apiRequest('POST', '/api/admin/parser/config', updates);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/parser/config'] });
      setPendingVersion(null);
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

  const setVersion = useMutation({
    mutationFn: async (version: 'v1' | 'v2' | 'dual') => {
      const res = await apiRequest('POST', '/api/admin/parser/version', { version });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/parser/config'] });
      setPendingVersion(null);
      toast({
        title: "Parser Version Updated",
        description: `Now using ${pendingVersion?.toUpperCase()} parser`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Version Change Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const toggleRollback = useMutation({
    mutationFn: async (force: boolean) => {
      const res = await apiRequest('POST', '/api/admin/parser/rollback', { force });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/parser/config'] });
      toast({
        title: data.config?.forceV1Fallback ? "Rollback Activated" : "Rollback Deactivated",
        description: data.message,
      });
    },
  });

  const clearCache = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/admin/parser/cache/clear', {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/parser/config'] });
      toast({
        title: "Cache Cleared",
        description: "Profile cache has been cleared",
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

  const config = data?.config;
  const cache = data?.cache;

  const versionOptions: { value: 'v1' | 'v2' | 'dual'; label: string; description: string; icon: typeof FileText }[] = [
    { value: 'v1', label: 'V1 (Legacy)', description: 'Original parser - stable, basic extraction', icon: FileText },
    { value: 'v2', label: 'V2 (Advanced)', description: 'Semantic understanding, confidence scoring, learning', icon: Brain },
    { value: 'dual', label: 'Dual Run', description: 'Run both parsers and compare results', icon: Zap },
  ];

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">PDF Parser Configuration</h1>
          <p className="text-muted-foreground">
            Configure the CAS statement and portfolio PDF parsing engine
          </p>
        </div>
        <Badge 
          variant={config?.version === 'v2' ? 'default' : 'secondary'}
          className="flex items-center gap-2"
        >
          <Cpu className="w-4 h-4" />
          {config?.version?.toUpperCase() || 'V1'}
        </Badge>
      </div>

      {config?.forceV1Fallback && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Rollback Active</AlertTitle>
          <AlertDescription>
            All parsing is currently forced to use V1. V2 features are disabled.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        {versionOptions.map((option) => {
          const isActive = config?.version === option.value;
          const isPending = pendingVersion === option.value;
          const Icon = option.icon;
          
          return (
            <Card 
              key={option.value}
              className={`cursor-pointer transition-all ${
                isActive 
                  ? 'border-primary ring-2 ring-primary/20' 
                  : 'hover:border-primary/50'
              }`}
              onClick={() => {
                if (!isActive && !setVersion.isPending) {
                  setPendingVersion(option.value);
                  setVersion.mutate(option.value);
                }
              }}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <Icon className={`w-8 h-8 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                  {isActive && <CheckCircle2 className="w-5 h-5 text-primary" />}
                  {isPending && <RefreshCw className="w-5 h-5 text-primary animate-spin" />}
                </div>
                <CardTitle className="text-lg">{option.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{option.description}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings2 className="w-5 h-5" />
              V2 Features
            </CardTitle>
            <CardDescription>Advanced parsing capabilities</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="learning">Learning Mode</Label>
                <p className="text-xs text-muted-foreground">Store successful parsing patterns</p>
              </div>
              <Switch
                id="learning"
                checked={config?.enableLearning ?? false}
                onCheckedChange={(checked) => updateConfig.mutate({ enableLearning: checked })}
                disabled={updateConfig.isPending}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="confidence">Confidence Scoring</Label>
                <p className="text-xs text-muted-foreground">Calculate parse reliability scores</p>
              </div>
              <Switch
                id="confidence"
                checked={config?.enableConfidenceScoring ?? false}
                onCheckedChange={(checked) => updateConfig.mutate({ enableConfidenceScoring: checked })}
                disabled={updateConfig.isPending}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="dualrun">Dual-Run Mode</Label>
                <p className="text-xs text-muted-foreground">Run V1 and V2 in parallel for comparison</p>
              </div>
              <Switch
                id="dualrun"
                checked={config?.enableDualRun ?? false}
                onCheckedChange={(checked) => updateConfig.mutate({ enableDualRun: checked })}
                disabled={updateConfig.isPending}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="logcomparisons">Log Comparisons</Label>
                <p className="text-xs text-muted-foreground">Log V1 vs V2 result differences</p>
              </div>
              <Switch
                id="logcomparisons"
                checked={config?.logComparisons ?? false}
                onCheckedChange={(checked) => updateConfig.mutate({ logComparisons: checked })}
                disabled={updateConfig.isPending}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Min Confidence Threshold</Label>
                <span className="text-sm font-mono">{((config?.minConfidenceThreshold ?? 0.5) * 100).toFixed(0)}%</span>
              </div>
              <Slider
                value={[(config?.minConfidenceThreshold ?? 0.5) * 100]}
                onValueChange={([value]) => updateConfig.mutate({ minConfidenceThreshold: value / 100 })}
                min={0}
                max={100}
                step={5}
                disabled={updateConfig.isPending}
              />
              <p className="text-xs text-muted-foreground">
                Falls back to V1 if V2 confidence is below this threshold
              </p>
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

            <Button
              variant="outline"
              className="w-full"
              onClick={() => clearCache.mutate()}
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
              onClick={() => refetch()}
            >
              <BarChart3 className="w-4 h-4 mr-2" />
              Refresh Stats
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className={config?.forceV1Fallback ? 'border-destructive' : ''}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            Emergency Rollback
          </CardTitle>
          <CardDescription>
            Force all parsing to use V1 parser regardless of configuration
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Force V1 Fallback</p>
              <p className="text-sm text-muted-foreground">
                Use this if V2 is causing issues. All parsing will use the stable V1 parser.
              </p>
            </div>
            <Button
              variant={config?.forceV1Fallback ? 'destructive' : 'outline'}
              onClick={() => toggleRollback.mutate(!config?.forceV1Fallback)}
              disabled={toggleRollback.isPending}
            >
              {toggleRollback.isPending ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : config?.forceV1Fallback ? (
                'Deactivate Rollback'
              ) : (
                'Activate Rollback'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
