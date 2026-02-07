import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Target } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface RebalancingSuggestion {
  assetType: string;
  assetName: string;
  currentPercent: number;
  targetPercent: number;
  currentValue: number;
  targetValue: number;
  difference: number;
  differencePercent: number;
  action: 'buy' | 'sell' | 'maintain';
  priority: 'high' | 'medium' | 'low';
  recommendation: string;
}

interface RebalancingSuggestionsData {
  suggestions: RebalancingSuggestion[];
  summary: {
    totalValue: number;
    totalRebalanceAmount: number;
    rebalanceNeeded: boolean;
    highPrioritySuggestions: number;
    lastUpdated: string;
  };
}

interface RebalancingSuggestionsProps {
  portfolioId: string;
}

export function RebalancingSuggestions({ portfolioId }: RebalancingSuggestionsProps) {
  const { data: suggestions, isLoading, error } = useQuery<RebalancingSuggestionsData>({
    queryKey: [`/api/portfolios/${portfolioId}/rebalancing-suggestions`],
    refetchInterval: 60000, // Refresh every minute
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Target className="h-5 w-5 text-blue-600" />
            <span>Portfolio Rebalancing</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-muted rounded w-1/2"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !suggestions) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Target className="h-5 w-5 text-blue-600" />
            <span>Portfolio Rebalancing</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Unable to load rebalancing suggestions. Please try again later.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'default';
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'buy':
        return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'sell':
        return <TrendingDown className="h-4 w-4 text-red-600" />;
      default:
        return <CheckCircle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <Card data-testid="rebalancing-suggestions">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="flex items-center space-x-2">
              <Target className="h-5 w-5 text-blue-600" />
              <span>Portfolio Rebalancing</span>
            </CardTitle>
            {suggestions?.summary?.rebalanceNeeded && (
              <Badge variant="destructive" className="mt-2">
                Rebalancing Recommended
              </Badge>
            )}
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Portfolio Value</p>
            <p className="text-xl font-bold">
              ₹{suggestions?.summary?.totalValue?.toLocaleString() || '0'}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary Alert */}
        {suggestions?.summary?.rebalanceNeeded ? (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Your portfolio has {suggestions?.summary?.highPrioritySuggestions || 0} high-priority 
              rebalancing opportunities worth ₹{suggestions?.summary?.totalRebalanceAmount?.toLocaleString() || '0'}.
            </AlertDescription>
          </Alert>
        ) : (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              Your portfolio allocation is well balanced. Minor adjustments may still optimize returns.
            </AlertDescription>
          </Alert>
        )}

        {/* Rebalancing Suggestions */}
        <div className="space-y-4">
          <h4 className="font-semibold text-foreground">Asset Allocation Analysis</h4>
          
          {(suggestions?.suggestions || []).map((suggestion, index) => (
            <div 
              key={suggestion.assetType} 
              className="border rounded-lg p-4 space-y-3"
              data-testid={`suggestion-${suggestion.assetType}`}
            >
              <div className="flex justify-between items-start">
                <div className="flex items-center space-x-3">
                  {getActionIcon(suggestion.action)}
                  <div>
                    <h5 className="font-semibold">{suggestion.assetName}</h5>
                    <div className="flex items-center space-x-2 mt-1">
                      <Badge variant={getPriorityColor(suggestion.priority) as any}>
                        {suggestion.priority.toUpperCase()} PRIORITY
                      </Badge>
                      <span className="text-sm text-muted-foreground capitalize">
                        {suggestion.action} Action
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold">
                    {suggestion.difference > 0 ? '+' : ''}₹{Math.abs(suggestion.difference).toLocaleString()}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {suggestion.differencePercent > 0 ? '+' : ''}{suggestion.differencePercent}%
                  </p>
                </div>
              </div>

              {/* Allocation Progress */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Current: {suggestion.currentPercent}%</span>
                  <span>Target: {suggestion.targetPercent}%</span>
                </div>
                <Progress 
                  value={suggestion.currentPercent} 
                  max={Math.max(suggestion.currentPercent, suggestion.targetPercent)}
                  className="h-2"
                />
              </div>

              {/* Recommendation */}
              <p className="text-sm text-muted-foreground bg-muted p-3 rounded">
                {suggestion.recommendation}
              </p>

              {/* Action Button */}
              {suggestion.action !== 'maintain' && suggestion.priority !== 'low' && (
                <Button 
                  variant={suggestion.action === 'buy' ? 'default' : 'outline'} 
                  size="sm" 
                  className="w-full"
                  data-testid={`action-${suggestion.assetType}`}
                >
                  {suggestion.action === 'buy' ? 'Add to' : 'Reduce'} {suggestion.assetName}
                </Button>
              )}
            </div>
          ))}
        </div>

        {/* No Suggestions State */}
        {(suggestions?.suggestions || []).length === 0 && (
          <div className="text-center py-6">
            <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">Portfolio Well Balanced</h3>
            <p className="text-muted-foreground">
              Your current asset allocation aligns with recommended targets.
            </p>
          </div>
        )}

        {/* Last Updated */}
        <p className="text-xs text-muted-foreground text-center pt-4 border-t">
          Last updated: {suggestions?.summary?.lastUpdated ? new Date(suggestions.summary.lastUpdated).toLocaleTimeString() : 'Never'}
        </p>
      </CardContent>
    </Card>
  );
}