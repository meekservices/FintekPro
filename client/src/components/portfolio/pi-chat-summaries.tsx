import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { MessageCircle, TrendingUp, Lightbulb, RefreshCw, Bot } from 'lucide-react';

interface PiChatSummariesProps {
  portfolioId: string;
}

export function PiChatSummaries({ portfolioId }: PiChatSummariesProps) {
  const { data: summaries, isLoading, refetch } = useQuery({
    queryKey: [`/api/portfolios/${portfolioId}/pi-chat-summaries`],
    enabled: !!portfolioId,
    refetchInterval: 300000, // Refresh every 5 minutes
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Bot className="h-5 w-5 text-blue-600" />
              <CardTitle>Pi Chat - Asset Class Insights</CardTitle>
            </div>
            <Skeleton className="h-8 w-20" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-16 w-full" />
                <div className="flex space-x-2">
                  <Skeleton className="h-6 w-16" />
                  <Skeleton className="h-6 w-20" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!summaries || summaries.length === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Bot className="h-5 w-5 text-blue-600" />
              <CardTitle>Pi Chat - Asset Class Insights</CardTitle>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => refetch()}
              data-testid="refresh-pi-chat"
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Bot className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p>No asset class insights available</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getAssetClassColor = (assetClass: string) => {
    const colors: Record<string, string> = {
      equity: "bg-blue-100 text-blue-800",
      debt: "bg-green-100 text-green-800", 
      commodity: "bg-yellow-100 text-yellow-800",
      alternative: "bg-purple-100 text-purple-800",
    };
    return colors[assetClass] || "bg-muted text-foreground";
  };

  const getAssetClassIcon = (assetClass: string) => {
    switch (assetClass) {
      case 'equity':
        return '📈';
      case 'debt':
        return '🏛️';
      case 'commodity':
        return '🥇';
      case 'alternative':
        return '🏗️';
      default:
        return '💼';
    }
  };

  return (
    <Card className="h-[600px]" data-testid="pi-chat-summaries">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Bot className="h-5 w-5 text-blue-600" />
            <CardTitle className="flex items-center">
              Pi Chat - Asset Class Insights
              <Badge variant="secondary" className="ml-2 text-xs">AI Powered</Badge>
            </CardTitle>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => refetch()}
            data-testid="refresh-pi-chat"
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Refresh
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          AI-generated insights and recommendations for each asset class in your portfolio
        </p>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[450px]">
          <div className="space-y-6">
            {summaries.map((summary: any) => (
              <div 
                key={summary.id} 
                className="border rounded-lg p-4 space-y-3"
                data-testid={`pi-chat-summary-${summary.assetClass}`}
              >
                {/* Asset Class Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-lg">{getAssetClassIcon(summary.assetClass)}</span>
                    <Badge className={getAssetClassColor(summary.assetClass)}>
                      {summary.assetClass.charAt(0).toUpperCase() + summary.assetClass.slice(1)}
                    </Badge>
                    {summary.insights?.allocation && (
                      <Badge variant="outline" className="text-xs">
                        {summary.insights.allocation} of portfolio
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Updated {new Date(summary.lastAnalyzed).toLocaleDateString()}
                  </div>
                </div>

                {/* Summary Text */}
                <div className="bg-muted p-3 rounded-lg">
                  <div className="flex items-start space-x-2">
                    <MessageCircle className="h-4 w-4 text-blue-600 mt-1 flex-shrink-0" />
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {summary.summary}
                    </p>
                  </div>
                </div>

                {/* Key Insights */}
                {summary.insights && (
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    {summary.insights.totalValue && (
                      <div className="bg-blue-50 p-2 rounded">
                        <div className="font-medium text-blue-900">Total Value</div>
                        <div className="text-blue-700">₹{summary.insights.totalValue.toLocaleString()}</div>
                      </div>
                    )}
                    {summary.insights.expectedReturn && (
                      <div className="bg-green-50 p-2 rounded">
                        <div className="font-medium text-green-900">Expected Return</div>
                        <div className="text-green-700">{summary.insights.expectedReturn}</div>
                      </div>
                    )}
                    {summary.insights.riskLevel && (
                      <div className="bg-orange-50 p-2 rounded">
                        <div className="font-medium text-orange-900">Risk Level</div>
                        <div className="text-orange-700">{summary.insights.riskLevel}</div>
                      </div>
                    )}
                    {summary.insights.topSectors && (
                      <div className="bg-purple-50 p-2 rounded">
                        <div className="font-medium text-purple-900">Top Sectors</div>
                        <div className="text-purple-700">{summary.insights.topSectors.slice(0, 2).join(', ')}</div>
                      </div>
                    )}
                  </div>
                )}

                {/* AI Recommendations */}
                {summary.recommendations && summary.recommendations.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Lightbulb className="h-4 w-4 text-yellow-600" />
                      <span className="text-sm font-medium text-foreground">AI Recommendations</span>
                    </div>
                    <div className="space-y-1 pl-6">
                      {summary.recommendations.slice(0, 3).map((rec: string, index: number) => (
                        <div key={index} className="text-xs text-muted-foreground flex items-start">
                          <span className="text-yellow-500 mr-2">•</span>
                          <span>{rec}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Performance Indicator */}
                <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
                  <div className="flex items-center space-x-1">
                    <TrendingUp className="h-3 w-3" />
                    <span>AI Confidence: High</span>
                  </div>
                  <div>
                    Last analysis: {new Date(summary.lastAnalyzed).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}