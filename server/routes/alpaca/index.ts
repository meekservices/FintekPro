import { Router } from 'express';
import { alpacaFundingService } from '../../services/alpaca/funding/alpacaFundingService';
import { referralService } from '../../services/social/referralService';
import { orderManager } from '../../services/alpaca/trading/orderManager';
import { alpacaMarketDataService, BarTimeframe } from '../../services/alpaca-market-data-service';
import { alpacaWsStreamingService } from '../../services/alpaca-ws-streaming-service';
import { logger } from '../../logger';

const router = Router();

// --- Trading ---

/**
 * Place a notional (fractional) buy order
 * POST /api/alpaca/trade/notional
 */
router.post('/trade/notional', async (req, res) => {
  const { symbol, notional, side } = req.body;
  const userId = (req as any).user.id;

  try {
    const order = await orderManager.placeOrder(userId, {
      symbol,
      notional: parseFloat(notional),
      side: side || 'buy',
      type: 'market',
      time_in_force: 'day'
    });
    res.json({ success: true, data: order });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// --- Market Data ---

/**
 * Get real-time quote for a symbol
 * GET /api/alpaca/market/quote/:symbol
 */
router.get('/market/quote/:symbol', async (req, res) => {
  try {
    const quote = await alpacaMarketDataService.getQuote(req.params.symbol);
    if (!quote) return res.status(404).json({ success: false, message: 'Symbol not found' });
    res.json({ success: true, data: quote });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * Get historical bars for charting
 * GET /api/alpaca/market/bars/:symbol
 */
router.get('/market/bars/:symbol', async (req, res) => {
  const { timeframe = '1Day', limit = '100', start, end } = req.query;
  try {
    const barsMap = await alpacaMarketDataService.getBars(
      req.params.symbol,
      timeframe as BarTimeframe,
      start as string,
      end as string,
      parseInt(limit as string)
    );
    const bars = barsMap.get(req.params.symbol.toUpperCase()) || [];
    res.json({ success: true, data: bars });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * Search for US stocks/ETFs
 * GET /api/alpaca/market/search
 */
router.get('/market/search', async (req, res) => {
  const { q, limit = '10' } = req.query;
  if (!q) return res.status(400).json({ success: false, message: 'Query required' });
  try {
    const results = await alpacaMarketDataService.searchSymbols(q as string, parseInt(limit as string));
    res.json({ success: true, data: results });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * Get market connectivity and feed status
 * GET /api/alpaca/market/status
 */
router.get('/market/status', async (req, res) => {
  try {
    const wsStatus = alpacaWsStreamingService.getStatus();
    const apiStatus = alpacaMarketDataService.testConnection();
    res.json({ success: true, data: { ws: wsStatus, api: apiStatus } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * Best Buy Screener — AI-ranked US stocks + ETFs (FASP-AI v1.0 compliant).
 * GET /api/alpaca/market/best-buys?riskProfile=moderate&limit=12
 */
router.get('/market/best-buys', async (req, res) => {
  const riskProfile = (req.query.riskProfile as string) || 'moderate';
  const limit = parseInt(req.query.limit as string) || 12;
  const validProfiles = ['conservative', 'moderate', 'aggressive'];
  if (!validProfiles.includes(riskProfile)) {
    return res.status(400).json({ success: false, message: `riskProfile must be one of: ${validProfiles.join(', ')}` });
  }
  try {
    const result = await alpacaMarketDataService.getBestBuys(
      riskProfile as 'conservative' | 'moderate' | 'aggressive',
      limit,
    );
    res.json({
      success: true,
      data: result,
      meta: { timestamp: new Date().toISOString(), version: '1.0', engine_version: result.modelVersion },
    });
  } catch (error: any) {
    logger.error(`[best-buys] error: ${error.message}`);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * Instruments showcase — popular US stocks + ETFs with live prices + INR conversion.
 * GET /api/alpaca/market/instruments?type=all|stocks|etfs
 */
router.get('/market/instruments', async (req, res) => {
  const type = (req.query.type as string) || 'all';
  try {
    const [stocks, etfs, fxRate] = await Promise.all([
      type !== 'etfs'   ? alpacaMarketDataService.getPopularStocks() : Promise.resolve([]),
      type !== 'stocks' ? alpacaMarketDataService.getPopularETFs()   : Promise.resolve([]),
      alpacaMarketDataService.getUsdInrRate(),
    ]);
    const marketStatus = alpacaMarketDataService.getMarketStatus();
    const enrichWithInr = (items: any[]) => items.map(i => ({
      ...i,
      priceInr: i.price ? parseFloat((i.price * fxRate).toFixed(2)) : null,
    }));
    res.json({
      success: true,
      data: { stocks: enrichWithInr(stocks), etfs: enrichWithInr(etfs), fxRate, marketStatus,
        disclaimer: 'Prices delayed up to 15 minutes. For informational purposes only.' },
      meta: { timestamp: new Date().toISOString(), version: '1.0' },
    });
  } catch (error: any) {
    logger.error(`[instruments] error: ${error.message}`);
    res.status(500).json({ success: false, message: error.message });
  }
});

// --- Funding ---

/**
 * Create a Plaid Link token
 * POST /api/alpaca/funding/plaid/link-token
 */
router.post('/funding/plaid/link-token', async (req, res) => {
  const userId = (req as any).user.id;
  try {
    const { plaidService } = await import('../../services/plaid/PlaidService');
    const linkToken = await plaidService.createLinkToken(userId);
    res.json({ success: true, linkToken });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * Exchange public token and link bank via Alpaca processor
 * POST /api/alpaca/funding/bank/link
 */
router.post('/funding/bank/link', async (req, res) => {
  const { publicToken, accountId, bankName } = req.body;
  const userId = (req as any).user.id;

  try {
    const { plaidService } = await import('../../services/plaid/PlaidService');
    
    // 1. Get processor token
    const processorToken = await plaidService.createProcessorToken(publicToken, accountId);
    
    // 2. Link with Alpaca
    const relationship = await alpacaFundingService.linkBankWithPlaid(userId, processorToken, bankName);
    
    res.json({ success: true, data: relationship });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});


/**
 * Initiate a deposit
 */
router.post('/funding/deposit', async (req, res) => {
  const { amount } = req.body;
  const userId = (req as any).user.id;

  try {
    const transfer = await alpacaFundingService.depositFunds(userId, parseFloat(amount));
    res.json({ success: true, data: transfer });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

// --- Social ---

/**
 * Get or create referral code
 */
router.get('/social/referral-code', async (req, res) => {
  const userId = (req as any).user.id;
  try {
    const code = await referralService.generateReferralCode(userId);
    res.json({ success: true, referralCode: code });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * Public profile lookup
 */
router.get('/social/profile/:code', async (req, res) => {
  try {
    const profile = await referralService.getProfileByReferralCode(req.params.code);
    res.json({ success: true, data: profile });
  } catch (error: any) {
    res.status(404).json({ success: false, message: error.message });
  }
});

export default router;

