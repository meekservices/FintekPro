import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

interface LoadingStateProps {
  variant?: 'card' | 'list' | 'table' | 'form' | 'stats' | 'chart' | 'dashboard' | 'portfolio' | 'market-movers' | 'agent-dashboard' | 'partner-dashboard' | 'section-table' | 'section-chart' | 'section-stats-row';
  count?: number;
  className?: string;
  message?: string;
}

export function LoadingState({ variant = 'card', count = 1, className = '', message }: LoadingStateProps) {
  const items = Array.from({ length: count }, (_, i) => i);

  if (variant === 'card') {
    return (
      <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 ${className}`}>
        {message && (
          <div className="col-span-full mb-4 text-sm text-muted-foreground animate-pulse">
            {message}
          </div>
        )}
        {items.map((i) => (
          <Card key={i} data-testid={`loading-card-${i}`}>
            <CardHeader>
              <Skeleton className="h-6 w-3/4 mb-2" />
              <Skeleton className="h-4 w-1/2" />
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-10 w-full mt-4" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (variant === 'list') {
    return (
      <div className={`space-y-4 ${className}`}>
        {items.map((i) => (
          <div key={i} className="flex items-center space-x-4 p-4 border rounded-lg" data-testid={`loading-list-${i}`}>
            <Skeleton className="h-12 w-12 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <Skeleton className="h-8 w-20" />
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'table') {
    return (
      <div className={`space-y-3 ${className}`}>
        <div className="border rounded-lg overflow-hidden">
          <div className="bg-muted p-4">
            <div className="grid grid-cols-4 gap-4">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
            </div>
          </div>
          {items.map((i) => (
            <div key={i} className="border-t p-4" data-testid={`loading-table-row-${i}`}>
              <div className="grid grid-cols-4 gap-4">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (variant === 'form') {
    return (
      <div className={`space-y-6 ${className}`}>
        {items.map((i) => (
          <div key={i} className="space-y-2" data-testid={`loading-form-field-${i}`}>
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
        <Skeleton className="h-10 w-32 mt-6" />
      </div>
    );
  }

  if (variant === 'stats') {
    return (
      <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 ${className}`}>
        {items.map((i) => (
          <Card key={i} data-testid={`loading-stat-${i}`}>
            <CardContent className="pt-6">
              <div className="space-y-3">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-8 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (variant === 'chart') {
    const chartHeights = [45, 72, 58, 35, 68, 42, 55, 78, 48, 62, 38, 70];
    return (
      <Card className={className} data-testid="loading-chart">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-32" />
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-end justify-between gap-2 pt-4">
            {chartHeights.map((height, i) => (
              <Skeleton 
                key={i} 
                className="flex-1 rounded-t"
                style={{ height: `${height}%` }}
              />
            ))}
          </div>
          <div className="flex justify-between mt-4">
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-3 w-12" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (variant === 'dashboard') {
    const dashboardHeights = [55, 72, 38, 65, 45, 78, 52, 68];
    return (
      <div className={`space-y-6 ${className}`} data-testid="loading-dashboard">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-8 w-32" />
                  </div>
                  <Skeleton className="h-12 w-12 rounded-full" />
                </div>
                <Skeleton className="h-3 w-20 mt-3" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-40" />
            </CardHeader>
            <CardContent>
              <div className="h-48 flex items-end justify-between gap-2">
                {dashboardHeights.map((height, i) => (
                  <Skeleton 
                    key={i} 
                    className="flex-1 rounded-t"
                    style={{ height: `${height}%` }}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-40" />
            </CardHeader>
            <CardContent className="space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-10 w-10 rounded" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                  <Skeleton className="h-6 w-16" />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (variant === 'portfolio') {
    return (
      <div className={`space-y-6 ${className}`} data-testid="loading-portfolio">
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="space-y-3">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-10 w-48" />
                <div className="flex gap-4">
                  <Skeleton className="h-6 w-24" />
                  <Skeleton className="h-6 w-24" />
                </div>
              </div>
              <Skeleton className="h-32 w-32 rounded-full" />
            </div>
          </CardContent>
        </Card>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6 space-y-3">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-32" />
                <Skeleton className="h-3 w-20" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 p-3 border rounded-lg">
                  <Skeleton className="h-10 w-10 rounded" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <div className="text-right space-y-2">
                    <Skeleton className="h-5 w-24" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (variant === 'market-movers') {
    return (
      <Card className={className} data-testid="loading-market-movers">
        <CardHeader>
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-8 w-24" />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded" />
                <div className="space-y-1">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </div>
              <div className="text-right space-y-1">
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-4 w-16" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (variant === 'agent-dashboard') {
    return (
      <div className={`space-y-6 min-h-[600px] ${className}`} data-testid="loading-agent-dashboard">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="bg-card/50 border-border">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-20 bg-muted" />
                    <Skeleton className="h-8 w-28 bg-muted" />
                  </div>
                  <Skeleton className="h-10 w-10 rounded-lg bg-muted" />
                </div>
                <Skeleton className="h-3 w-16 mt-3 bg-muted" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2 bg-card/50 border-border">
            <CardHeader>
              <Skeleton className="h-6 w-32 bg-muted" />
            </CardHeader>
            <CardContent>
              <div className="h-64 flex items-end justify-between gap-2">
                {[45, 72, 58, 35, 68, 42, 55, 78].map((height, i) => (
                  <Skeleton key={i} className="flex-1 rounded-t bg-muted" style={{ height: `${height}%` }} />
                ))}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-card/50 border-border">
            <CardHeader>
              <Skeleton className="h-6 w-28 bg-muted" />
            </CardHeader>
            <CardContent className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-8 w-8 rounded-full bg-muted" />
                  <div className="flex-1 space-y-1">
                    <Skeleton className="h-4 w-24 bg-muted" />
                    <Skeleton className="h-3 w-16 bg-muted" />
                  </div>
                  <Skeleton className="h-5 w-12 bg-muted" />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
        <Card className="bg-card/50 border-border">
          <CardHeader>
            <Skeleton className="h-6 w-40 bg-muted" />
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 p-3 border border-border rounded-lg">
                  <Skeleton className="h-10 w-10 rounded bg-muted" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-32 bg-muted" />
                    <Skeleton className="h-3 w-20 bg-muted" />
                  </div>
                  <Skeleton className="h-8 w-20 bg-muted" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (variant === 'partner-dashboard') {
    return (
      <div className={`space-y-6 min-h-[600px] ${className}`} data-testid="loading-partner-dashboard">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="bg-indigo-800/30 border-indigo-700">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-24 bg-indigo-700" />
                    <Skeleton className="h-8 w-32 bg-indigo-700" />
                  </div>
                  <Skeleton className="h-12 w-12 rounded-lg bg-indigo-700" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="bg-indigo-800/30 border-indigo-700">
            <CardHeader>
              <Skeleton className="h-6 w-36 bg-indigo-700" />
            </CardHeader>
            <CardContent>
              <div className="h-48 flex items-end justify-between gap-2">
                {[55, 72, 38, 65, 45, 78, 52, 68].map((height, i) => (
                  <Skeleton key={i} className="flex-1 rounded-t bg-indigo-700" style={{ height: `${height}%` }} />
                ))}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-indigo-800/30 border-indigo-700">
            <CardHeader>
              <Skeleton className="h-6 w-32 bg-indigo-700" />
            </CardHeader>
            <CardContent className="space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-10 w-10 rounded bg-indigo-700" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-28 bg-indigo-700" />
                    <Skeleton className="h-3 w-20 bg-indigo-700" />
                  </div>
                  <Skeleton className="h-6 w-16 bg-indigo-700" />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (variant === 'section-stats-row') {
    return (
      <div className={`grid grid-cols-2 md:grid-cols-4 gap-4 ${className}`} data-testid="loading-section-stats-row">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="pt-5 pb-5">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-7 w-28" />
                  <Skeleton className="h-3 w-16" />
                </div>
                <Skeleton className="h-10 w-10 rounded-lg" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (variant === 'section-chart') {
    const barHeights = [42, 65, 50, 78, 38, 55, 70, 45, 60, 35, 72, 48];
    return (
      <Card className={className} data-testid="loading-section-chart">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-8 w-24 rounded-md" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-56 flex items-end justify-between gap-1.5 pb-2">
            {barHeights.map((height, i) => (
              <Skeleton
                key={i}
                className="flex-1 rounded-t"
                style={{ height: `${height}%` }}
              />
            ))}
          </div>
          <div className="flex justify-between mt-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-3 w-10" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (variant === 'section-table') {
    return (
      <Card className={className} data-testid="loading-section-table">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-8 w-28 rounded-md" />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="border-t">
            <div className="grid grid-cols-5 gap-4 px-4 py-3 bg-muted/50">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-3 w-full" />
              ))}
            </div>
            {Array.from({ length: count > 1 ? count : 6 }).map((_, i) => (
              <div key={i} className="grid grid-cols-5 gap-4 px-4 py-3 border-t">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-4/5" />
                <Skeleton className="h-4 w-3/5" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return null;
}
