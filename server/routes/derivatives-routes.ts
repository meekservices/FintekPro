import { Router } from 'express';
import { derivativesService } from '../services/derivatives-service';

const router = Router();

// ── Indian (NSE) derivatives ──────────────────────────────────────────────────

router.get('/symbols', async (req, res) => {
  try {
    const data = await derivativesService.getAvailableSymbols();
    res.json(data);
  } catch (error) {
    console.error('[Derivatives] Error fetching symbols:', error);
    res.status(500).json({ error: 'Failed to fetch symbols' });
  }
});

router.get('/expiry/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const expiries = await derivativesService.getExpiryDates(symbol.toUpperCase());
    res.json({ symbol: symbol.toUpperCase(), expiryDates: expiries });
  } catch (error) {
    console.error('[Derivatives] Error fetching expiry dates:', error);
    res.status(500).json({ error: 'Failed to fetch expiry dates' });
  }
});

router.get('/options-chain/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const { expiry } = req.query;
    const chain = await derivativesService.getOptionsChain(
      symbol.toUpperCase(),
      expiry as string | undefined,
    );
    res.json(chain);
  } catch (error) {
    console.error('[Derivatives] Error fetching options chain:', error);
    res.status(500).json({ error: 'Failed to fetch options chain' });
  }
});

router.get('/futures/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const futures = await derivativesService.getFuturesData(symbol.toUpperCase());
    res.json({ symbol: symbol.toUpperCase(), futures });
  } catch (error) {
    console.error('[Derivatives] Error fetching futures data:', error);
    res.status(500).json({ error: 'Failed to fetch futures data' });
  }
});

/**
 * GET /api/derivatives/nse/spot/:symbol
 * Real-time NSE spot price — Python/yfinance Tier, then hardcoded reference.
 * Works for indices (NIFTY, BANKNIFTY) and equities (RELIANCE, TCS …).
 */
router.get('/nse/spot/:symbol', async (req, res) => {
  try {
    const symbol = req.params.symbol.toUpperCase();
    const price  = await derivativesService.getSpotPrice(symbol);
    res.json({ symbol, price, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('[Derivatives] Error fetching NSE spot price:', error);
    res.status(500).json({ error: 'Failed to fetch spot price' });
  }
});

/**
 * GET /api/derivatives/nse/oi-analysis/:symbol
 * Open Interest analysis: max-pain strike, PCR, top OI call/put strikes.
 * Data source: NSE option chain → synthetic fallback.
 */
router.get('/nse/oi-analysis/:symbol', async (req, res) => {
  try {
    const symbol   = req.params.symbol.toUpperCase();
    const analysis = await derivativesService.getOIAnalysis(symbol);
    res.json(analysis);
  } catch (error) {
    console.error('[Derivatives] Error computing OI analysis:', error);
    res.status(500).json({ error: 'Failed to compute OI analysis' });
  }
});

// ── Global derivatives ────────────────────────────────────────────────────────

/**
 * GET /api/derivatives/global/futures
 * ~30 global futures quotes across equity indices, commodities, bonds,
 * FX, and agricultural markets.
 * Source tier: FMP → Python/yfinance.
 */
router.get('/global/futures', async (req, res) => {
  try {
    const data = await derivativesService.getGlobalFutures();
    res.json(data);
  } catch (error) {
    console.error('[Derivatives] Error fetching global futures:', error);
    res.status(500).json({ error: 'Failed to fetch global futures' });
  }
});

// ── Analytics (unchanged) ─────────────────────────────────────────────────────

router.post('/greeks', async (req, res) => {
  try {
    const { spotPrice, strikePrice, daysToExpiry, volatility, riskFreeRate, optionType } = req.body;
    if (!spotPrice || !strikePrice || daysToExpiry === undefined || !volatility) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    const greeks = derivativesService.calculateGreeks(
      spotPrice, strikePrice, daysToExpiry, volatility / 100, riskFreeRate || 0.065, optionType || 'call',
    );
    res.json(greeks);
  } catch (error) {
    console.error('[Derivatives] Error calculating Greeks:', error);
    res.status(500).json({ error: 'Failed to calculate Greeks' });
  }
});

router.post('/strategy-payoff', async (req, res) => {
  try {
    const { legs, spotPrice, priceRange } = req.body;
    if (!legs || !spotPrice) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    const payoff = derivativesService.calculateStrategyPayoff(legs, spotPrice, priceRange);
    res.json(payoff);
  } catch (error) {
    console.error('[Derivatives] Error calculating strategy payoff:', error);
    res.status(500).json({ error: 'Failed to calculate strategy payoff' });
  }
});

router.post('/margin', async (req, res) => {
  try {
    const { symbol, legs } = req.body;
    if (!symbol || !legs) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    const margin = derivativesService.getMarginRequirement(symbol.toUpperCase(), legs);
    res.json(margin);
  } catch (error) {
    console.error('[Derivatives] Error calculating margin:', error);
    res.status(500).json({ error: 'Failed to calculate margin' });
  }
});

router.get('/strategies', async (req, res) => {
  try {
    const strategies = derivativesService.getPopularStrategies();
    res.json({ strategies });
  } catch (error) {
    console.error('[Derivatives] Error fetching strategies:', error);
    res.status(500).json({ error: 'Failed to fetch strategies' });
  }
});

router.get('/expiry-calendar', async (req, res) => {
  try {
    const calendar = derivativesService.getExpiryCalendar();
    res.json({ calendar });
  } catch (error) {
    console.error('[Derivatives] Error fetching expiry calendar:', error);
    res.status(500).json({ error: 'Failed to fetch expiry calendar' });
  }
});

export default router;
