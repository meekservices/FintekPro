import { useQuery } from '@tanstack/react-query';
import { type CommodityPrice } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, TrendingDown, RefreshCw, Coins } from 'lucide-react';

type CommodityCategory = 'precious_metals' | 'energy' | 'agricultural' | 'industrial';

type CommodityTrackerProps = {
  className?: string;
};

export function CommodityTracker({ className }: CommodityTrackerProps) {
  const { data: commodities, isLoading, refetch } = useQuery<CommodityPrice[]>({
    queryKey: ['/api/commodities/prices'],
    refetchInterval: 60000, // Refresh every minute
  });

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'precious_metals': return '✨';
      case 'energy': return '⚡';
      case 'agricultural': return '🌾';
      case 'industrial': return '🏭';
      default: return '📦';
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'precious_metals': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'energy': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      case 'agricultural': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'industrial': return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
      default: return 'bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-400';
    }
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Coins className="h-5 w-5 text-primary" />
            Commodity Markets
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-16 ml-auto" />
                  <Skeleton className="h-3 w-12 ml-auto" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div>
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Coins className="h-5 w-5 text-primary" />
            Commodity Markets
          </CardTitle>
          <p className="text-sm text-muted-foreground">Real-time global commodity benchmarks</p>
        </div>
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => refetch()}
          title="Refresh prices"
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        {!commodities || commodities.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No commodity data available
          </div>
        ) : (
          <div className="space-y-3">
            {commodities.map((commodity) => (
              <div 
                key={commodity.id} 
                className="flex items-center justify-between p-3 bg-muted rounded-lg hover:bg-muted transition-colors"
                data-testid={`commodity-${commodity.symbol}`}
              >
                <div className="flex items-center space-x-3">
                  <div className="text-2xl">
                    {getCategoryIcon(commodity.category)}
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-medium text-foreground">{commodity.name}</span>
                      <Badge className={getCategoryColor(commodity.category)} variant="secondary">
                        {commodity.category.replace('_', ' ')}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {commodity.symbol} • {commodity.priceUnit}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-foreground">
                    ₹{Number(commodity.price).toFixed(2)}
                  </div>
                  <div className="flex items-center space-x-1">
                    {Number(commodity.changePercent) >= 0 ? (
                      <TrendingUp className="h-3 w-3 text-green-600" />
                    ) : (
                      <TrendingDown className="h-3 w-3 text-red-600" />
                    )}
                    <span className={`text-xs font-medium ${
                      Number(commodity.changePercent) >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {Number(commodity.changePercent) >= 0 ? '+' : ''}{Number(commodity.changePercent).toFixed(2)}%
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {Number(commodity.changePercent) >= 0 ? '+' : ''}₹{Number(commodity.change).toFixed(2)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="mt-4 pt-4 border-t">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Prices updated every minute</span>
            <span>
              Last update: {commodities?.[0]?.lastUpdated ? new Date(commodities[0].lastUpdated).toLocaleTimeString() : 'N/A'}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}