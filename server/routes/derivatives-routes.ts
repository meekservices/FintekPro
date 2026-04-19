import { Router, Request, Response } from 'express';
import { derivativesService } from '../services/derivatives-service';

// Interface for StrategyLeg imported from service or redefined here if needed
interface StrategyLeg {
  type: 'call' | 'put' | 'stock' | 'future';
  action: 'buy' | 'sell';
  strikePrice?: number;
  quantity: number;
  premium?: number;
  expiryDate?: string;
}

const router = Router();

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

// ── Indian (NSE) derivatives ──────────────────────────────────────────────────

router.get('/symbols', async (_req: Request, res: Response): Promise<void> => {
  try {
    const data = await derivativesService.getAvailableSymbols();
    res.json(data);
  } catch (error: unknown) {
    console.error('[Derivatives] Error fetching symbols:', errorMessage(error));
    res.status(500).json({ error: 'Failed to fetch symbols' });
  }
});

router.get('/expiry/:symbol', async (req: Request<{ symbol: string }>, res: Response): Promise<void> => {
  try {
    const { symbol } = req.params;
    const expiries = await derivativesService.getExpiryDates(symbol.toUpperCase());
    res.json({ symbol: symbol.toUpperCase(), expiryDates: expiries });
  } catch (error: unknown) {
    console.error('[Derivatives] Error fetching expiry dates:', errorMessage(error));
    res.status(500).json({ error: 'Failed to fetch expiry dates' });
  }
});

router.get('/options-chain/:symbol', async (req: Request<{ symbol: string }, any, any, { expiry?: string }>, res: Response): Promise<void> => {
  try {
    const { symbol } = req.params;
    const { expiry } = req.query;
    const chain = await derivativesService.getOptionsChain(
      symbol.toUpperCase(),
      expiry,
    );
    res.json(chain);
  } catch (error: unknown) {
    console.error('[Derivatives] Error fetching options chain:', errorMessage(error));
    res.status(500).json({ error: 'Failed to fetch options chain' });
  }
});

router.get('/futures/:symbol', async (req: Request<{ symbol: string }>, res: Response): Promise<void> => {
  try {
    const { symbol } = req.params;
    const futures = await derivativesService.getFuturesData(symbol.toUpperCase());
    res.json({ symbol: symbol.toUpperCase(), futures });
  } catch (error: unknown) {
    console.error('[Derivatives] Error fetching futures data:', errorMessage(error));
    res.status(500).json({ error: 'Failed to fetch futures data' });
  }
});

/**
 * GET /api/derivatives/nse/spot/:symbol
 * Real-time NSE spot price — Python/yfinance Tier, then hardcoded reference.
 * Works for indices (NIFTY, BANKNIFTY) and equities (RELIANCE, TCS …).
 */
router.get('/nse/spot/:symbol', async (req: Request<{ symbol: string }>, res: Response): Promise<void> => {
  try {
    const symbol = req.params.symbol.toUpperCase();
    const price  = await derivativesService.getSpotPrice(symbol);
    res.json({ symbol, price, timestamp: new Date().toISOString() });
  } catch (error: unknown) {
    console.error('[Derivatives] Error fetching NSE spot price:', errorMessage(error));
    res.status(500).json({ error: 'Failed to fetch spot price' });
  }
});

/**
 * GET /api/derivatives/nse/oi-analysis/:symbol
 * Open Interest analysis: max-pain strike, PCR, top OI call/put strikes.
 * Data source: NSE option chain → synthetic fallback.
 */
router.get('/nse/oi-analysis/:symbol', async (req: Request<{ symbol: string }>, res: Response): Promise<void> => {
  try {
    const symbol   = req.params.symbol.toUpperCase();
    const analysis = await derivativesService.getOIAnalysis(symbol);
    res.json(analysis);
  } catch (error: unknown) {
    console.error('[Derivatives] Error computing OI analysis:', errorMessage(error));
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
router.get('/global/futures', async (_req: Request, res: Response): Promise<void> => {
  try {
    const data = await derivativesService.getGlobalFutures();
    res.json(data);
  } catch (error: unknown) {
    console.error('[Derivatives] Error fetching global futures:', errorMessage(error));
    res.status(500).json({ error: 'Failed to fetch global futures' });
  }
});

// ── Analytics ─────────────────────────────────────────────────────────────────

router.post('/greeks', async (req: Request<any, any, {
  spotPrice?: number;
  strikePrice?: number;
  daysToExpiry?: number;
  volatility?: number;
  riskFreeRate?: number;
  optionType?: 'call' | 'put';
}>, res: Response): Promise<void> => {
  try {
    const { spotPrice, strikePrice, daysToExpiry, volatility, riskFreeRate, optionType } = req.body;

    if (spotPrice === undefined || strikePrice === undefined || daysToExpiry === undefined || volatility === undefined) {
      res.status(400).json({ error: 'Missing required parameters' });
      return;
    }
    const greeks = derivativesService.calculateGreeks(
      spotPrice, strikePrice, daysToExpiry, volatility / 100, riskFreeRate || 0.065, optionType || 'call',
    );
    res.json(greeks);
  } catch (error: unknown) {
    console.error('[Derivatives] Error calculating Greeks:', errorMessage(error));
    res.status(500).json({ error: 'Failed to calculate Greeks' });
  }
});

router.post('/strategy-payoff', async (req: Request<any, any, {
  legs?: StrategyLeg[];
  spotPrice?: number;
  priceRange?: number | { min: number; max: number };
}>, res: Response): Promise<void> => {
  try {
    const { legs, spotPrice, priceRange } = req.body;
    if (!legs || !spotPrice) {
      res.status(400).json({ error: 'Missing required parameters' });
      return;
    }

    // Convert numeric priceRange (%) to object format if necessary
    const range = typeof priceRange === 'number' 
      ? { min: spotPrice * (1 - priceRange/100), max: spotPrice * (1 + priceRange/100) }
      : priceRange;

    const payoff = derivativesService.calculateStrategyPayoff(legs, spotPrice, range);
    res.json(payoff);
  } catch (error: unknown) {
    console.error('[Derivatives] Error calculating strategy payoff:', errorMessage(error));
    res.status(500).json({ error: 'Failed to calculate strategy payoff' });
  }
});

router.post('/margin', async (req: Request<any, any, {
  symbol?: string;
  legs?: StrategyLeg[];
}>, res: Response): Promise<void> => {
  try {
    const { symbol, legs } = req.body;
    if (!symbol || !legs) {
      res.status(400).json({ error: 'Missing required parameters' });
      return;
    }
    const margin = derivativesService.getMarginRequirement(symbol.toUpperCase(), legs);
    res.json(margin);
  } catch (error: unknown) {
    console.error('[Derivatives] Error calculating margin:', errorMessage(error));
    res.status(500).json({ error: 'Failed to calculate margin' });
  }
});

router.get('/strategies', async (_req: Request, res: Response): Promise<void> => {
  try {
    const strategies = derivativesService.getPopularStrategies();
    res.json({ strategies });
  } catch (error: unknown) {
    console.error('[Derivatives] Error fetching strategies:', errorMessage(error));
    res.status(500).json({ error: 'Failed to fetch strategies' });
  }
});

router.get('/expiry-calendar', async (_req: Request, res: Response): Promise<void> => {
  try {
    const calendar = derivativesService.getExpiryCalendar();
    res.json({ calendar });
  } catch (error: unknown) {
    console.error('[Derivatives] Error fetching expiry calendar:', errorMessage(error));
    res.status(500).json({ error: 'Failed to fetch expiry calendar' });
  }
});

router.get('/positions', async (_req: Request, res: Response): Promise<void> => {
  try {
    // Return empty positions as fallback
    res.json({ success: true, positions: [] });
  } catch (error: unknown) {
    console.error('[Derivatives] Error fetching positions:', errorMessage(error));
    res.status(500).json({ error: 'Failed to fetch derivatives positions' });
  }
});

export default router;
