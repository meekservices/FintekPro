import { useEffect, ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Clock, Database, Sparkles } from "lucide-react";
import { AnalyticsSection } from "@/hooks/use-section-analytics";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface SectionAnalyticsLoaderProps {
  section: AnalyticsSection;
  title: string;
  icon?: ReactNode;
  isEnabled: boolean;
  isLoaded: boolean;
  isLoading: boolean;
  error: string | null;
  metadata?: {
    version?: number;
    computedAt?: string;
    dataSource?: 'historical' | 'estimated';
    assumptions?: string[];
  };
  onLoad: () => void;
  children: ReactNode;
}

export function SectionAnalyticsLoader({
  section,
  title,
  icon,
  isEnabled,
  isLoaded,
  isLoading,
  error,
  metadata,
  onLoad,
  children
}: SectionAnalyticsLoaderProps) {
  useEffect(() => {
    if (isEnabled && !isLoaded && !isLoading && !error) {
      onLoad();
    }
  }, [isEnabled, isLoaded, isLoading, error, onLoad]);

  if (!isEnabled) {
    return null;
  }

  if (isLoading) {
    return (
      <Card className="border-dashed border-muted-foreground/30">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            {icon}
            <CardTitle className="text-lg">{title}</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-20 w-full" />
            <div className="flex gap-2">
              <Skeleton className="h-8 w-24" />
              <Skeleton className="h-8 w-24" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive/50 bg-destructive/5">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <CardTitle className="text-lg">{title}</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Failed to load analytics: {error}
          </p>
          <button
            onClick={onLoad}
            className="mt-2 text-sm text-primary hover:underline"
          >
            Retry
          </button>
        </CardContent>
      </Card>
    );
  }

  if (!isLoaded) {
    return null;
  }

  return (
    <div className="relative">
      {metadata && (
        <div className="absolute top-2 right-2 flex items-center gap-1.5 z-10">
          <TooltipProvider>
            {metadata.dataSource && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge 
                    variant="outline" 
                    className={`text-[10px] px-1.5 py-0 ${
                      metadata.dataSource === 'historical' 
                        ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400' 
                        : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400'
                    }`}
                  >
                    {metadata.dataSource === 'historical' ? (
                      <Database className="h-2.5 w-2.5 mr-0.5" />
                    ) : (
                      <Sparkles className="h-2.5 w-2.5 mr-0.5" />
                    )}
                    {metadata.dataSource === 'historical' ? 'Real Data' : 'Estimated'}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent side="left">
                  <p className="text-xs">
                    {metadata.dataSource === 'historical' 
                      ? 'Calculated from actual historical NAV data' 
                      : 'Estimated based on category averages'}
                  </p>
                </TooltipContent>
              </Tooltip>
            )}
            {metadata.version && metadata.version > 1 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                    v{metadata.version}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent side="left">
                  <p className="text-xs">Analytics version {metadata.version}</p>
                </TooltipContent>
              </Tooltip>
            )}
            {metadata.computedAt && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">
                    <Clock className="h-2.5 w-2.5 mr-0.5" />
                    {new Date(metadata.computedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent side="left">
                  <div className="space-y-1">
                    <p className="text-xs font-medium">
                      Computed: {new Date(metadata.computedAt).toLocaleString()}
                    </p>
                    {metadata.assumptions && metadata.assumptions.length > 0 && (
                      <div className="text-xs text-muted-foreground">
                        <p className="font-medium">Assumptions:</p>
                        <ul className="list-disc list-inside">
                          {metadata.assumptions.map((a, i) => (
                            <li key={i}>{a}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </TooltipContent>
              </Tooltip>
            )}
          </TooltipProvider>
        </div>
      )}
      {children}
    </div>
  );
}

export function AnalyticsSectionSkeleton({ title, icon }: { title: string; icon?: ReactNode }) {
  return (
    <Card className="border-dashed border-muted-foreground/30">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          {icon}
          <CardTitle className="text-lg">{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-20 w-full" />
        </div>
      </CardContent>
    </Card>
  );
}
