import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowUpIcon, ArrowDownIcon, TrendingUp, TrendingDown, Minus, Newspaper, Brain, BarChart3, RefreshCw, AlertTriangle } from 'lucide-react';
import { useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';

export default function MarketIntelligence() {
  const [selectedSymbol, setSelectedSymbol] = useState('AAPL');
  const [searchSymbol, setSearchSymbol] = useState('');
  const { toast } = useToast();

  const { data: quote, isLoading: quoteLoading, isError: quoteError, error: quoteErrorData, refetch: refetchQuote } = useQuery({
    queryKey: [`/api/market-data/quote/${selectedSymbol}`],
    enabled: !!selectedSymbol,
    refetchInterval: 30000,
    retry: 1,
  });

  const { data: newsData, isLoading: newsLoading, isError: newsError, error: newsErrorData, refetch: refetchNews } = useQuery({
    queryKey: ['/api/market-data/news'],
    refetchInterval: 300000,
    retry: 1,
  });

  const { data: prediction, isLoading: predictionLoading, isError: predictionError, error: predictionErrorData, refetch: refetchPrediction } = useQuery({
    queryKey: [`/api/ai-portfolio/market-prediction/${selectedSymbol}`],
    enabled: !!selectedSymbol,
    retry: 1,
  });

  const handleSearch = () => {
    if (searchSymbol.trim()) {
      setSelectedSymbol(searchSymbol.toUpperCase());
    }
  };

  // Safe accessors with fallbacks
  const safeQuote = quote?.success ? quote : null;
  const safeNews = Array.isArray(newsData?.articles) ? newsData.articles : [];
  const safePrediction = prediction?.success ? prediction : null;

  // Helper to determine error type
  const getErrorMessage = (error: any): { title: string; message: string; isConfigError: boolean } => {
    const statusCode = error?.response?.status || error?.status;
    
    if (statusCode === 401 || statusCode === 403) {
      return {
        title: 'API Key Configuration Required',
        message: 'Market data API keys are missing or invalid. Please contact your administrator to configure the API keys.',
        isConfigError: true
      };
    }
    
    if (statusCode === 500 || statusCode === 502 || statusCode === 503) {
      return {
        title: 'Service Temporarily Unavailable',
        message: 'The market data service is experiencing issues. Please try again in a few moments.',
        isConfigError: true
      };
    }
    
    if (statusCode === 429) {
      return {
        title: 'Rate Limit Exceeded',
        message: 'Too many requests. Please wait a moment before trying again.',
        isConfigError: false
      };
    }
    
    return {
      title: 'Unable to Load Data',
      message: error?.message || 'An unexpected error occurred. Please try again.',
      isConfigError: false
    };
  };

  return (
    <div className="container mx-auto p-4 space-y-6 dark:bg-gray-900" data-testid="market-intelligence-page">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold dark:text-white" data-testid="page-title">Market Intelligence</h1>
          <p className="text-muted-foreground dark:text-gray-400" data-testid="page-description">
            Real-time market data with AI-powered insights and predictions
          </p>
        </div>
      </div>

      <div className="flex gap-2" data-testid="symbol-search-container">
        <Input
          placeholder="Enter stock symbol (e.g., AAPL, TSLA)"
          value={searchSymbol}
          onChange={(e) => setSearchSymbol(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          className="max-w-xs dark:bg-gray-800 dark:text-white"
          data-testid="input-symbol-search"
        />
        <Button onClick={handleSearch} data-testid="button-search-symbol">Search</Button>
      </div>

      <Tabs defaultValue="overview" className="w-full" data-testid="market-tabs">
        <TabsList className="grid w-full grid-cols-3 dark:bg-gray-800">
          <TabsTrigger value="overview" data-testid="tab-overview">Live Market</TabsTrigger>
          <TabsTrigger value="predictions" data-testid="tab-predictions">AI Predictions</TabsTrigger>
          <TabsTrigger value="news" data-testid="tab-news">News & Sentiment</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4" data-testid="tab-content-overview">
          {quoteError && (() => {
            const errorInfo = getErrorMessage(quoteErrorData);
            return (
              <Alert variant="destructive" data-testid="alert-quote-config-error">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>{errorInfo.title}</AlertTitle>
                <AlertDescription className="mt-2">
                  {errorInfo.message}
                  {!errorInfo.isConfigError && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => refetchQuote()}
                      className="mt-3 ml-0"
                      data-testid="button-retry-quote"
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Retry
                    </Button>
                  )}
                </AlertDescription>
              </Alert>
            );
          })()}

          <Card className="dark:bg-gray-800 dark:border-gray-700">
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-2xl dark:text-white" data-testid="text-quote-symbol">{selectedSymbol}</CardTitle>
                  <CardDescription className="dark:text-gray-400">Real-time Quote</CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refetchQuote()}
                  disabled={quoteLoading}
                  data-testid="button-refresh-quote"
                  className="dark:border-gray-600 dark:text-white"
                >
                  <RefreshCw className={`h-4 w-4 ${quoteLoading ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {quoteLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-12 w-48" />
                  <Skeleton className="h-6 w-32" />
                  <Skeleton className="h-20 w-full" />
                </div>
              ) : safeQuote?.quote ? (
                <div className="space-y-4" data-testid="quote-data">
                  <div>
                    <div className="text-4xl font-bold dark:text-white" data-testid="text-price">
                      ${safeQuote.quote.price?.toFixed(2) || 'N/A'}
                    </div>
                    {safeQuote.quote.change !== undefined && safeQuote.quote.changePercent !== undefined && (
                      <div className={`flex items-center gap-2 text-lg ${
                        (safeQuote.quote.change || 0) >= 0 ? 'text-green-600' : 'text-red-600'
                      }`} data-testid="text-price-change">
                        {(safeQuote.quote.change || 0) >= 0 ? <ArrowUpIcon className="h-5 w-5" /> : <ArrowDownIcon className="h-5 w-5" />}
                        {safeQuote.quote.change.toFixed(2)} ({safeQuote.quote.changePercent.toFixed(2)}%)
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <div className="text-sm text-muted-foreground dark:text-gray-400">Open</div>
                      <div className="font-semibold dark:text-white" data-testid="text-open">
                        {safeQuote.quote.open !== undefined ? `$${safeQuote.quote.open.toFixed(2)}` : 'N/A'}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground dark:text-gray-400">High</div>
                      <div className="font-semibold text-green-600" data-testid="text-high">
                        {safeQuote.quote.high !== undefined ? `$${safeQuote.quote.high.toFixed(2)}` : 'N/A'}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground dark:text-gray-400">Low</div>
                      <div className="font-semibold text-red-600" data-testid="text-low">
                        {safeQuote.quote.low !== undefined ? `$${safeQuote.quote.low.toFixed(2)}` : 'N/A'}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground dark:text-gray-400">Prev. Close</div>
                      <div className="font-semibold dark:text-white" data-testid="text-prev-close">
                        {safeQuote.quote.previousClose !== undefined ? `$${safeQuote.quote.previousClose.toFixed(2)}` : 'N/A'}
                      </div>
                    </div>
                  </div>

                  {safeQuote.quote.source && safeQuote.quote.timestamp && (
                    <div className="text-xs text-muted-foreground dark:text-gray-400">
                      Source: {safeQuote.quote.source} | Last updated: {new Date(safeQuote.quote.timestamp).toLocaleString()}
                    </div>
                  )}
                </div>
              ) : !quoteError ? (
                <div className="text-center py-8 text-muted-foreground" data-testid="empty-quote-state">
                  <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No quote data available for {selectedSymbol}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => refetchQuote()}
                    className="mt-3"
                    data-testid="button-load-quote"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Load Quote
                  </Button>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="predictions" className="space-y-4" data-testid="tab-content-predictions">
          {predictionError && (() => {
            const errorInfo = getErrorMessage(predictionErrorData);
            return (
              <Alert variant="destructive" data-testid="alert-prediction-config-error">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>{errorInfo.title}</AlertTitle>
                <AlertDescription className="mt-2">
                  {errorInfo.message}
                  {!errorInfo.isConfigError && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => refetchPrediction()}
                      className="mt-3 ml-0"
                      data-testid="button-retry-prediction"
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Retry
                    </Button>
                  )}
                </AlertDescription>
              </Alert>
            );
          })()}

          <Card className="dark:bg-gray-800 dark:border-gray-700">
            <CardHeader>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Brain className="h-5 w-5 dark:text-white" />
                  <CardTitle className="dark:text-white">AI Market Predictions</CardTitle>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refetchPrediction()}
                  disabled={predictionLoading}
                  data-testid="button-refresh-prediction"
                  className="dark:border-gray-600 dark:text-white"
                >
                  <RefreshCw className={`h-4 w-4 ${predictionLoading ? 'animate-spin' : ''}`} />
                </Button>
              </div>
              <CardDescription className="dark:text-gray-400">
                Machine learning-powered price predictions for {selectedSymbol}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {predictionLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-32 w-full" />
                </div>
              ) : safePrediction?.prediction ? (
                <div className="space-y-6" data-testid="prediction-data">
                  {Array.isArray(safePrediction.prediction.predictions) && safePrediction.prediction.predictions.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      {safePrediction.prediction.predictions.map((pred: any) => (
                        <Card key={pred?.timeframe || Math.random()} className="dark:bg-gray-700 dark:border-gray-600" data-testid={`prediction-card-${pred?.timeframe}`}>
                          <CardHeader className="pb-3">
                            <CardTitle className="text-sm dark:text-white">
                              {pred?.timeframe ? pred.timeframe.toUpperCase() : 'Unknown'}
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="text-2xl font-bold dark:text-white" data-testid={`text-predicted-price-${pred?.timeframe}`}>
                              {pred?.predictedPrice !== undefined ? `$${pred.predictedPrice.toFixed(2)}` : 'N/A'}
                            </div>
                            {pred?.direction && pred?.priceChangePercent !== undefined && (
                              <div className={`flex items-center gap-1 text-sm ${
                                pred.direction === 'bullish' ? 'text-green-600' : 
                                pred.direction === 'bearish' ? 'text-red-600' : 
                                'text-gray-600'
                              }`} data-testid={`text-prediction-direction-${pred.timeframe}`}>
                                {pred.direction === 'bullish' ? <TrendingUp className="h-4 w-4" /> :
                                 pred.direction === 'bearish' ? <TrendingDown className="h-4 w-4" /> :
                                 <Minus className="h-4 w-4" />}
                                {pred.priceChangePercent.toFixed(2)}%
                              </div>
                            )}
                            {pred?.confidence !== undefined && (
                              <div className="text-xs text-muted-foreground mt-2 dark:text-gray-400">
                                Confidence: {pred.confidence}%
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-muted-foreground" data-testid="empty-predictions-state">
                      <p>No prediction timeframes available</p>
                    </div>
                  )}

                  {Array.isArray(safePrediction.prediction.reasoning) && safePrediction.prediction.reasoning.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="font-semibold dark:text-white">Analysis</h3>
                      <div className="grid gap-3">
                        {safePrediction.prediction.reasoning.map((reason: string, i: number) => (
                          <div key={i} className="flex gap-2 text-sm dark:text-gray-300" data-testid={`reasoning-${i}`}>
                            <BarChart3 className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                            <span>{reason}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {Array.isArray(safePrediction.prediction.riskFactors) && safePrediction.prediction.riskFactors.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="font-semibold text-red-600 dark:text-red-400">Risk Factors</h3>
                      <div className="grid gap-2">
                        {safePrediction.prediction.riskFactors.map((risk: string, i: number) => (
                          <div key={i} className="flex gap-2 text-sm text-muted-foreground dark:text-gray-400" data-testid={`risk-${i}`}>
                            <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                            <span>{risk}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {safePrediction.prediction.recommendation && (
                    <div className="pt-4 border-t dark:border-gray-700">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold dark:text-white">Recommendation:</span>
                        <Badge 
                          variant={
                            safePrediction.prediction.recommendation === 'strong_buy' ? 'default' :
                            safePrediction.prediction.recommendation === 'buy' ? 'secondary' :
                            safePrediction.prediction.recommendation === 'hold' ? 'outline' :
                            'destructive'
                          }
                          className="text-sm"
                          data-testid="badge-recommendation"
                        >
                          {safePrediction.prediction.recommendation.replace('_', ' ').toUpperCase()}
                        </Badge>
                      </div>
                    </div>
                  )}
                </div>
              ) : !predictionError ? (
                <div className="text-center py-8 text-muted-foreground" data-testid="empty-prediction-state">
                  <Brain className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No AI predictions available for {selectedSymbol}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => refetchPrediction()}
                    className="mt-3"
                    data-testid="button-load-prediction"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Load Predictions
                  </Button>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="news" className="space-y-4" data-testid="tab-content-news">
          {newsError && (() => {
            const errorInfo = getErrorMessage(newsErrorData);
            return (
              <Alert variant="destructive" data-testid="alert-news-config-error">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>{errorInfo.title}</AlertTitle>
                <AlertDescription className="mt-2">
                  {errorInfo.message}
                  {!errorInfo.isConfigError && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => refetchNews()}
                      className="mt-3 ml-0"
                      data-testid="button-retry-news"
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Retry
                    </Button>
                  )}
                </AlertDescription>
              </Alert>
            );
          })()}

          <Card className="dark:bg-gray-800 dark:border-gray-700">
            <CardHeader>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Newspaper className="h-5 w-5 dark:text-white" />
                  <CardTitle className="dark:text-white">Market News & Sentiment</CardTitle>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refetchNews()}
                  disabled={newsLoading}
                  data-testid="button-refresh-news"
                  className="dark:border-gray-600 dark:text-white"
                >
                  <RefreshCw className={`h-4 w-4 ${newsLoading ? 'animate-spin' : ''}`} />
                </Button>
              </div>
              <CardDescription className="dark:text-gray-400">
                AI-analyzed financial news with sentiment scoring
              </CardDescription>
            </CardHeader>
            <CardContent>
              {newsLoading ? (
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="space-y-2">
                      <Skeleton className="h-6 w-full" />
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  ))}
                </div>
              ) : safeNews && safeNews.length > 0 ? (
                <div className="space-y-4" data-testid="news-list">
                  {safeNews.slice(0, 10).map((article: any) => {
                    const articleId = article?.id || Math.random();
                    return (
                      <div
                        key={articleId}
                        className="border-b dark:border-gray-700 pb-4 last:border-0"
                        data-testid={`news-article-${articleId}`}
                      >
                        <div className="flex justify-between items-start gap-4">
                          <div className="flex-1">
                            {article?.url ? (
                              <a
                                href={article.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-semibold hover:text-blue-600 dark:text-white dark:hover:text-blue-400"
                                data-testid={`link-article-${articleId}`}
                              >
                                {article?.title || 'Untitled Article'}
                              </a>
                            ) : (
                              <div className="font-semibold dark:text-white">
                                {article?.title || 'Untitled Article'}
                              </div>
                            )}
                            {article?.description && (
                              <p className="text-sm text-muted-foreground mt-1 dark:text-gray-400">
                                {article.description}
                              </p>
                            )}
                            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground dark:text-gray-500">
                              {article?.source && <span>{article.source}</span>}
                              {article?.source && article?.publishedAt && <span>•</span>}
                              {article?.publishedAt && (
                                <span>{new Date(article.publishedAt).toLocaleDateString()}</span>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            {article?.sentiment?.label && (
                              <Badge
                                variant={
                                  article.sentiment.label === 'positive' ? 'default' :
                                  article.sentiment.label === 'negative' ? 'destructive' :
                                  'secondary'
                                }
                                className="whitespace-nowrap"
                                data-testid={`badge-sentiment-${articleId}`}
                              >
                                {article.sentiment.label}
                              </Badge>
                            )}
                            {article?.marketImpact?.score !== undefined && (
                              <div className="text-xs text-muted-foreground dark:text-gray-500">
                                Impact: {article.marketImpact.score}/100
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : !newsError ? (
                <div className="text-center py-8 text-muted-foreground" data-testid="empty-news-state">
                  <Newspaper className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No news articles available at this time</p>
                  <p className="text-sm mt-1">Check back later for the latest market news</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => refetchNews()}
                    className="mt-3"
                    data-testid="button-load-news"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Load News
                  </Button>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
