import { Router, type Request, type Response } from 'express';
import { aiPortfolioEnhancedService } from './services/ai-portfolio-enhanced';
import { realtimeMarketService } from './services/realtime-market-service';
import { newsSentimentService } from './services/news-sentiment-service';
import { logger } from './logger';
import type { PortfolioData, UserProfile } from './ai-portfolio-service';

const router = Router();

// POST /api/ai-portfolio/health-analysis - Analyze portfolio health
router.post('/health-analysis', async (req: Request, res: Response) => {
  try {
    const { portfolio, userProfile } = req.body;

    if (!portfolio || !userProfile) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        message: 'Both portfolio and userProfile are required',
      });
    }

    const healthMetrics = await aiPortfolioEnhancedService.analyzePortfolioHealth(
      portfolio as PortfolioData,
      userProfile as UserProfile
    );

    res.json({
      success: true,
      healthMetrics,
    });
  } catch (error) {
    logger.error('Portfolio health analysis error', { error: String(error) });
    res.status(500).json({
      success: false,
      error: 'Failed to analyze portfolio health',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

// GET /api/ai-portfolio/market-prediction/:symbol - Predict market movement
router.get('/market-prediction/:symbol', async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;

    const prediction = await aiPortfolioEnhancedService.predictMarketMovement(
      symbol.toUpperCase()
    );

    res.json({
      success: true,
      prediction,
    });
  } catch (error) {
    logger.error('Market prediction error', { error: String(error), symbol: req.params.symbol });
    res.status(500).json({
      success: false,
      error: 'Failed to generate market prediction',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

// POST /api/ai-portfolio/personalized-recommendations - Get personalized recommendations
router.post('/personalized-recommendations', async (req: Request, res: Response) => {
  try {
    const { portfolio, userProfile } = req.body;

    if (!portfolio || !userProfile) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        message: 'Both portfolio and userProfile are required',
      });
    }

    // Optionally fetch current market conditions
    const symbols = portfolio.holdings?.slice(0, 10).map((h: any) => h.symbol) || [];
    let marketConditions;
    
    if (symbols.length > 0) {
      try {
        const [quotes, news] = await Promise.all([
          realtimeMarketService.getBatchQuotes(symbols),
          newsSentimentService.getFinancialNews({ limit: 20 }),
        ]);
        marketConditions = { quotes, news };
      } catch (error) {
        logger.warn('Failed to fetch market conditions', { error: String(error) });
      }
    }

    const recommendations = await aiPortfolioEnhancedService.generatePersonalizedRecommendations(
      portfolio as PortfolioData,
      userProfile as UserProfile,
      marketConditions
    );

    res.json({
      success: true,
      recommendations,
      count: recommendations.length,
    });
  } catch (error) {
    logger.error('Personalized recommendations error', { error: String(error) });
    res.status(500).json({
      success: false,
      error: 'Failed to generate recommendations',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

// POST /api/ai-portfolio/portfolio-prediction - Predict portfolio performance
router.post('/portfolio-prediction', async (req: Request, res: Response) => {
  try {
    const { portfolio, timeframe = '3months' } = req.body;

    if (!portfolio) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field',
        message: 'portfolio is required',
      });
    }

    const validTimeframes = ['1month', '3months', '6months', '1year'];
    if (!validTimeframes.includes(timeframe)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid timeframe',
        message: `Timeframe must be one of: ${validTimeframes.join(', ')}`,
      });
    }

    const prediction = await aiPortfolioEnhancedService.predictPortfolioPerformance(
      portfolio as PortfolioData,
      timeframe as any
    );

    res.json({
      success: true,
      prediction,
    });
  } catch (error) {
    logger.error('Portfolio prediction error', { error: String(error) });
    res.status(500).json({
      success: false,
      error: 'Failed to predict portfolio performance',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

// POST /api/ai-portfolio/batch-predictions - Get predictions for multiple symbols
router.post('/batch-predictions', async (req: Request, res: Response) => {
  try {
    const { symbols } = req.body;

    if (!Array.isArray(symbols) || symbols.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request',
        message: 'symbols must be a non-empty array',
      });
    }

    if (symbols.length > 20) {
      return res.status(400).json({
        success: false,
        error: 'Too many symbols',
        message: 'Maximum 20 symbols per request',
      });
    }

    const predictions = await Promise.all(
      symbols.map(async (symbol: string) => {
        try {
          return await aiPortfolioEnhancedService.predictMarketMovement(symbol.toUpperCase());
        } catch (error) {
          logger.error('Batch prediction error for symbol', { symbol, error: String(error) });
          return null;
        }
      })
    );

    const validPredictions = predictions.filter(p => p !== null);

    res.json({
      success: true,
      predictions: validPredictions,
      count: validPredictions.length,
      requested: symbols.length,
    });
  } catch (error) {
    logger.error('Batch predictions error', { error: String(error) });
    res.status(500).json({
      success: false,
      error: 'Failed to generate batch predictions',
    });
  }
});

export default router;
