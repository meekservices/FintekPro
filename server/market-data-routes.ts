import { Router, type Request, type Response } from 'express';
import { realtimeMarketService } from './services/realtime-market-service';
import { newsSentimentService } from './services/news-sentiment-service';
import { logger } from './logger';

const router = Router();

// GET /api/market-data/quote/:symbol - Get real-time quote
router.get('/quote/:symbol', async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    const { forceRefresh } = req.query;

    const quote = await realtimeMarketService.getQuote(
      symbol.toUpperCase(),
      forceRefresh === 'true'
    );

    if (!quote) {
      logger.warn(`No quote available for ${symbol}, returning safe default`);
      return res.json({
        success: true,
        quote: {
          symbol,
          price: 0,
          change: 0,
          changePercent: 0,
          high: 0,
          low: 0,
          open: 0,
          previousClose: 0,
          volume: 0,
          timestamp: Date.now(),
          source: 'unavailable'
        }
      });
    }

    res.json({
      success: true,
      quote,
    });
  } catch (error) {
    logger.error('Error fetching quote', { error: String(error), symbol: req.params.symbol });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch quote',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

// POST /api/market-data/quotes/batch - Get multiple quotes
router.post('/quotes/batch', async (req: Request, res: Response) => {
  try {
    const { symbols } = req.body;

    if (!Array.isArray(symbols) || symbols.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request',
        message: 'symbols must be a non-empty array',
      });
    }

    if (symbols.length > 50) {
      return res.status(400).json({
        success: false,
        error: 'Too many symbols',
        message: 'Maximum 50 symbols per request',
      });
    }

    const quotes = await realtimeMarketService.getBatchQuotes(
      symbols.map((s: string) => s.toUpperCase())
    );

    res.json({
      success: true,
      quotes,
      count: quotes.length,
    });
  } catch (error) {
    logger.error('Error fetching batch quotes', { error: String(error) });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch batch quotes',
    });
  }
});

// GET /api/market-data/timeseries/:symbol - Get historical data
router.get('/timeseries/:symbol', async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    const { interval = 'daily' } = req.query;

    const validIntervals = ['1min', '5min', '15min', '30min', '60min', 'daily'];
    if (!validIntervals.includes(interval as string)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid interval',
        message: `Interval must be one of: ${validIntervals.join(', ')}`,
      });
    }

    const timeSeries = await realtimeMarketService.getTimeSeries(
      symbol.toUpperCase(),
      interval as any
    );

    res.json({
      success: true,
      timeSeries,
    });
  } catch (error) {
    logger.error('Error fetching time series', { error: String(error), symbol: req.params.symbol });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch time series data',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

// GET /api/market-data/news - Get financial news with sentiment
router.get('/news', async (req: Request, res: Response) => {
  try {
    const {
      query,
      category = 'business',
      limit = '20',
      fromDate,
    } = req.query;

    const articles = await newsSentimentService.getFinancialNews({
      query: query as string,
      category: category as string,
      limit: parseInt(limit as string),
      fromDate: fromDate as string,
    });

    res.json({
      success: true,
      articles,
      count: articles.length,
    });
  } catch (error) {
    logger.error('Error fetching news', { error: String(error) });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch news',
    });
  }
});

// POST /api/market-data/news/sentiment - Get aggregated sentiment analysis
router.post('/news/sentiment', async (req: Request, res: Response) => {
  try {
    const { articles } = req.body;

    if (!Array.isArray(articles) || articles.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request',
        message: 'articles must be a non-empty array',
      });
    }

    const sentiment = await newsSentimentService.getAggregatedSentiment(articles);

    res.json({
      success: true,
      sentiment,
    });
  } catch (error) {
    logger.error('Error analyzing sentiment', { error: String(error) });
    res.status(500).json({
      success: false,
      error: 'Failed to analyze sentiment',
    });
  }
});

// DELETE /api/market-data/cache - Clear cache
router.delete('/cache', async (req: Request, res: Response) => {
  try {
    const { symbol } = req.query;

    if (symbol) {
      realtimeMarketService.clearCache(symbol as string);
    } else {
      realtimeMarketService.clearCache();
    }

    newsSentimentService.clearCache();

    res.json({
      success: true,
      message: symbol ? `Cache cleared for ${symbol}` : 'All caches cleared',
    });
  } catch (error) {
    logger.error('Error clearing cache', { error: String(error) });
    res.status(500).json({
      success: false,
      error: 'Failed to clear cache',
    });
  }
});

// GET /api/market-data/cache/stats - Get cache statistics
router.get('/cache/stats', async (req: Request, res: Response) => {
  try {
    const stats = realtimeMarketService.getCacheStats();

    res.json({
      success: true,
      stats,
    });
  } catch (error) {
    logger.error('Error fetching cache stats', { error: String(error) });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch cache statistics',
    });
  }
});

export default router;
