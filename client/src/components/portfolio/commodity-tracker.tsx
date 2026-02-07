import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, TrendingDown, RefreshCw, Coins } from 'lucide-react';

interface CommodityTrackerProps {
  className?: string;
}

export function CommodityTracker({ className }: CommodityTrackerProps) {
  const { data: commodities, isLoading, refetch } = useQuery({
    queryKey: ['/api/commodities/prices'],
    refetchInterval: 60000, // Refresh every minute
  });

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      precious_metals: "bg-yellow-100 text-yellow-800",
      energy: "bg-orange-100 text-orange-800",
      agricultural: "bg-green-100 text-green-800",
      industrial: "bg-blue-100 text-blue-800",
    };
    return colors[category] || "bg-muted text-foreground";
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'precious_metals':
        return '🥇';
      case 'energy':
        return '⛽';
      case 'agricultural':
        return '🌾';
      case 'industrial':
        return '🏭';
      default:
        return '📦';
    }
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Coins className="h-5 w-5 text-yellow-600" />
              <CardTitle>Commodity Prices</CardTitle>
            </div>
            <Skeleton className="h-8 w-20" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div className="flex items-center space-x-3">
                  <Skeleton className="h-8 w-8 rounded" />
                  <div className="space-y-1">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
                <div className="text-right space-y-1">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-3 w-12" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className} data-testid="commodity-tracker">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Coins className="h-5 w-5 text-yellow-600" />
            <CardTitle>Commodity Prices</CardTitle>
            <Badge variant="secondary" className="text-xs">Live</Badge>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => refetch()}
            data-testid="refresh-commodities"
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Refresh
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Real-time commodity prices for portfolio diversification
        </p>
      </CardHeader>
      <CardContent>
        {!commodities || commodities.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Coins className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p>No commodity data available</p>
          </div>
        ) : (
          <div className="space-y-3">
            {commodities.map((commodity: any) => (
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
                    ₹{commodity.price.toFixed(2)}
                  </div>
                  <div className="flex items-center space-x-1">
                    {commodity.changePercent >= 0 ? (
                      <TrendingUp className="h-3 w-3 text-green-600" />
                    ) : (
                      <TrendingDown className="h-3 w-3 text-red-600" />
                    )}
                    <span className={`text-xs font-medium ${
                      commodity.changePercent >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {commodity.changePercent >= 0 ? '+' : ''}{commodity.changePercent.toFixed(2)}%
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {commodity.changePercent >= 0 ? '+' : ''}₹{commodity.change.toFixed(2)}
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
              Last update: {commodities?.[0] ? new Date(commodities[0].lastUpdated).toLocaleTimeString() : 'N/A'}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}