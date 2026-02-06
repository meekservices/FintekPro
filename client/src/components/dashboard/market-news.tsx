import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useMarketNews } from "@/hooks/use-market-data";
import { Clock, ExternalLink } from "lucide-react";

interface NewsItem {
  category: string;
  datetime: number;
  headline: string;
  id: number;
  image: string;
  related: string;
  source: string;
  summary: string;
  url: string;
}

export function MarketNews() {
  const { data: news, isLoading, error } = useMarketNews();

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

  if (isLoading) {
    return (
      <Card data-testid="market-news-loading">
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="border-b border-gray-200 pb-4 last:border-b-0">
                <Skeleton className="h-5 w-full mb-2" />
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-3/4 mb-2" />
                <div className="flex justify-between items-center">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-3 w-20" />
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
      <Card data-testid="market-news-error">
        <CardHeader>
          <CardTitle className="text-xl font-bold text-gray-900">Market News</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-red-500 mb-2">Error loading news</p>
            <p className="text-gray-500 text-sm">Please check your connection and try again</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Take first 3 news items
  const displayNews = (Array.isArray(news) ? news : (news as any)?.items || []).slice(0, 3);

  return (
    <Card data-testid="market-news">
      <CardHeader>
        <CardTitle className="text-xl font-bold text-gray-900" data-testid="news-title">
          Market News
        </CardTitle>
      </CardHeader>
      <CardContent>
        {displayNews.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500">No news available</p>
          </div>
        ) : (
          <div className="space-y-4" data-testid="news-list">
            {displayNews.map((item: NewsItem, index: number) => (
              <div 
                key={`news-item-${item.id || index}`} 
                className="border-b border-gray-200 pb-4 last:border-b-0 group cursor-pointer"
                onClick={() => window.open(item.url, '_blank')}
                data-testid={`news-item-${item.id || index}`}
              >
                <h4 className="font-semibold text-gray-900 mb-2 line-clamp-2 group-hover:text-finance-blue transition-colors" data-testid={`news-headline-${item.id}`}>
                  {item.headline}
                </h4>
                <p className="text-sm text-gray-600 mb-2 line-clamp-2" data-testid={`news-summary-${item.id}`}>
                  {item.summary}
                </p>
                <div className="flex justify-between items-center">
                  <div className="flex items-center text-xs text-gray-500">
                    <Clock className="h-3 w-3 mr-1" />
                    <span data-testid={`news-time-${item.id}`}>
                      {formatTimeAgo(item.datetime)}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-finance-blue font-medium" data-testid={`news-source-${item.id}`}>
                      {item.source}
                    </span>
                    <ExternalLink className="h-3 w-3 text-gray-400 group-hover:text-finance-blue transition-colors" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <Button 
          variant="link" 
          className="w-full mt-4 text-finance-blue font-medium hover:underline"
          data-testid="read-more-news"
        >
          Read More News →
        </Button>
      </CardContent>
    </Card>
  );
}
