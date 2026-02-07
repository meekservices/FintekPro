import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { usePortfolioNews } from "@/hooks/use-portfolio";
import { Clock, ExternalLink, AlertTriangle, TrendingUp, PieChart } from "lucide-react";

interface PortfolioNewsProps {
  portfolioId: string;
}

export function PortfolioNews({ portfolioId }: PortfolioNewsProps) {
  const { data: news, isLoading, error } = usePortfolioNews(portfolioId);

  const formatTimeAgo = (timestamp: number) => {
    const now = Date.now();
    const diffInSeconds = Math.floor((now - timestamp * 1000) / 1000);
    
    if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    } else {
      const days = Math.floor(diffInSeconds / 86400);
      return `${days} day${days !== 1 ? 's' : ''} ago`;
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'portfolio_specific':
        return <PieChart className="h-4 w-4" />;
      case 'risk_management':
        return <AlertTriangle className="h-4 w-4" />;
      case 'sector_analysis':
        return <TrendingUp className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'portfolio_specific':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'risk_management':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      case 'sector_analysis':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'market_update':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300';
      case 'fund_analysis':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300';
      default:
        return 'bg-muted text-foreground';
    }
  };

  if (isLoading) {
    return (
      <Card data-testid="portfolio-news-loading">
        <CardHeader>
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="border-b border-border pb-4 last:border-b-0">
                <div className="flex items-start space-x-3">
                  <Skeleton className="h-4 w-4 rounded-full" />
                  <div className="flex-1">
                    <Skeleton className="h-5 w-full mb-2" />
                    <Skeleton className="h-4 w-full mb-2" />
                    <Skeleton className="h-4 w-3/4 mb-2" />
                    <div className="flex justify-between items-center">
                      <Skeleton className="h-3 w-16" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card data-testid="portfolio-news-error">
        <CardHeader>
          <CardTitle className="text-xl font-bold text-foreground">
            Portfolio News
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-red-500 mb-2">Error loading portfolio news</p>
            <p className="text-muted-foreground text-sm">Please check your connection and try again</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!news || news.length === 0) {
    return (
      <Card data-testid="portfolio-news-empty">
        <CardHeader>
          <CardTitle className="text-xl font-bold text-foreground">
            Portfolio News
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-2">No personalized news available</p>
            <p className="text-muted-foreground text-sm">Add holdings to your portfolio to see relevant news</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="portfolio-news">
      <CardHeader>
        <CardTitle className="text-xl font-bold text-foreground">
          Portfolio News
          <span className="ml-2 text-sm font-normal text-muted-foreground">
            Personalized for your holdings
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4 max-h-96 overflow-y-auto">
          {news.map((article) => (
            <div 
              key={article.id} 
              className="border-b border-border pb-4 last:border-b-0"
              data-testid={`news-item-${article.category}`}
            >
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 mt-1">
                  {getCategoryIcon(article.category)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-sm font-semibold text-foreground leading-tight">
                      {article.headline}
                    </h3>
                    <Badge 
                      className={`ml-2 text-xs ${getCategoryColor(article.category)}`}
                      data-testid={`badge-${article.category}`}
                    >
                      {article.category.replace('_', ' ')}
                    </Badge>
                  </div>
                  
                  <p className="text-sm text-muted-foreground mb-3 line-clamp-3">
                    {article.summary}
                  </p>
                  
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="flex items-center">
                      <Clock className="h-3 w-3 mr-1" />
                      {formatTimeAgo(article.datetime)}
                    </span>
                    <span>{article.source}</span>
                  </div>
                  
                  {article.url && article.url !== '#' && !article.url.startsWith('#') && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-2 p-0 h-auto font-normal text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                      onClick={() => window.open(article.url, '_blank')}
                      data-testid={`external-link-${article.category}`}
                    >
                      Read more <ExternalLink className="h-3 w-3 ml-1" />
                    </Button>
                  )}
                  
                  {article.relevanceScore && (
                    <div className="mt-2">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Relevance to your portfolio</span>
                        <span className="font-semibold">{article.relevanceScore}%</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-1.5 mt-1">
                        <div 
                          className="bg-blue-600 h-1.5 rounded-full" 
                          style={{ width: `${article.relevanceScore}%` }}
                        ></div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
        
        {news.length > 0 && (
          <div className="mt-4 pt-4 border-t border-border">
            <p className="text-xs text-muted-foreground text-center">
              News personalized based on your portfolio holdings and risk profile
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}