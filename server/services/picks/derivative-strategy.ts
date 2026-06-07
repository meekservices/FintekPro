import { BaseStrategy } from "./base-strategy";
import { StrategyContext } from "./types";
import { DailyPickData, PickCategory } from "../pick-of-the-day-service";
import { derivativesService } from "../derivatives-service";

// ─── Types ────────────────────────────────────────────────────────────────────
type MarketOutlook = 'bullish' | 'bearish' | 'neutral';
type VolatilityRegime = 'low' | 'normal' | 'high';

interface DerivativeStrategyDef {
  name: string;
  outlook: MarketOutlook | 'any';
  /** Preferred when buying premium (low IV) vs. selling premium (high IV) */
  volPreference: 'buy' | 'sell' | 'any';
  risk: 'medium' | 'high';
  targetMult: number;
  slMult: number;
}

// Full strategy catalogue — selected based on market regime, not Math.random()
const STRATEGY_CATALOGUE: DerivativeStrategyDef[] = [
  // Low IV regime → buy premium (cheap options)
  { name: 'Bull Call Spread',  outlook: 'bullish', volPreference: 'buy',  risk: 'medium', targetMult: 1.5, slMult: 0.5 },
  { name: 'Bear Put Spread',   outlook: 'bearish', volPreference: 'buy',  risk: 'medium', targetMult: 1.5, slMult: 0.5 },
  { name: 'Long Call',         outlook: 'bullish', volPreference: 'buy',  risk: 'high',   targetMult: 2.0, slMult: 0.4 },
  { name: 'Long Put',          outlook: 'bearish', volPreference: 'buy',  risk: 'high',   targetMult: 2.0, slMult: 0.4 },
  { name: 'Long Straddle',     outlook: 'neutral', volPreference: 'buy',  risk: 'high',   targetMult: 1.8, slMult: 0.4 },
  // High IV regime → sell premium (collect theta/vega)
  { name: 'Short Strangle',    outlook: 'neutral', volPreference: 'sell', risk: 'high',   targetMult: 0.5, slMult: 2.0 },
  { name: 'Iron Condor',       outlook: 'neutral', volPreference: 'sell', risk: 'medium', targetMult: 0.4, slMult: 1.8 },
  { name: 'Bear Call Spread',  outlook: 'bearish', volPreference: 'sell', risk: 'medium', targetMult: 0.5, slMult: 2.0 },
];

/**
 * Phase 1 fix: Selects the optimal derivatives strategy based on:
 *  1. IV level → volatility regime (buy vs sell premium)
 *  2. NIFTY 20-day SMA vs spot → directional bias (bullish/bearish/neutral)
 *  3. Filters STRATEGY_CATALOGUE to matching strategies, picks first
 */
function selectStrategy(
  spotPrice: number,
  iv: number,
  recentCloses: number[]
): DerivativeStrategyDef {
  // ── Step 1: Classify IV regime ─────────────────────────────────────────────
  // India VIX: < 14 = low, 14-22 = normal, > 22 = high
  const volRegime: VolatilityRegime =
    iv > 22 ? 'high' : iv < 14 ? 'low' : 'normal';
  const volPreference: 'buy' | 'sell' = volRegime === 'high' ? 'sell' : 'buy';

  // ── Step 2: Determine directional bias from 20-day SMA ─────────────────────
  let outlook: MarketOutlook = 'neutral';
  if (recentCloses.length >= 10) {
    const smaLength = Math.min(20, recentCloses.length);
    const sma = recentCloses.slice(-smaLength).reduce((a, b) => a + b, 0) / smaLength;
    const smaDeviation = (spotPrice - sma) / sma;
    if (smaDeviation > 0.015) outlook = 'bullish';        // spot > SMA + 1.5% → bull
    else if (smaDeviation < -0.015) outlook = 'bearish';  // spot < SMA - 1.5% → bear
    // else neutral — use spread strategies
  }

  // ── Step 3: Filter catalogue and pick best match ───────────────────────────
  // Prefer: exact vol + exact outlook > exact vol + neutral > fallback Bull Call Spread
  const exact = STRATEGY_CATALOGUE.find(
    s => (s.volPreference === volPreference || s.volPreference === 'any') &&
         s.outlook === outlook
  );
  if (exact) return exact;

  // Fallback to neutral outlook with vol preference
  const neutralMatch = STRATEGY_CATALOGUE.find(
    s => (s.volPreference === volPreference || s.volPreference === 'any') &&
         s.outlook === 'neutral'
  );
  if (neutralMatch) return neutralMatch;

  // Last resort: Bull Call Spread (moderate, well-known)
  return STRATEGY_CATALOGUE[0];
}

export class DerivativeStrategy extends BaseStrategy {
  category: PickCategory = 'derivatives';

  async generate(context: StrategyContext): Promise<DailyPickData | null> {
    try {
      const { lotSizes } = await derivativesService.getAvailableSymbols();
      const indexSymbols = ['NIFTY', 'BANKNIFTY', 'FINNIFTY'];

      // Always use index derivatives in Phase 1 (more liquid, tighter spreads)
      // Stock option logic is deferred to Phase 2
      const selectedSymbol = indexSymbols[Math.floor(Math.random() * indexSymbols.length)];

      const chain = await derivativesService.getOptionsChain(selectedSymbol);
      const spotPrice = chain.underlyingValue;
      const lotSize = lotSizes[selectedSymbol] || 50;

      // ATM strike
      const strikeInterval = this.getStrikeInterval(selectedSymbol, spotPrice);
      const atmStrike = Math.round(spotPrice / strikeInterval) * strikeInterval;
      const atmCall = chain.options.calls.find(c => c.strikePrice === atmStrike);
      const iv = atmCall?.impliedVolatility || 18;

      // ── Phase 1 fix: Build recent closes array for SMA-based trend detection ──
      // Use the options chain's underlying price series if available, else single point
      const recentCloses: number[] = this.buildRecentCloses(chain, spotPrice);

      // ── Phase 1 fix: strategy selected by market regime, not Math.random() ──
      const strategy = selectStrategy(spotPrice, iv, recentCloses);

      const atmCallPrice = atmCall?.lastPrice || 0;
      const atmPutPrice = chain.options.puts?.find(p => p.strikePrice === atmStrike)?.lastPrice || 0;

      // Entry price depends on strategy type
      let premiumPerUnit: number;
      if (strategy.name === 'Long Straddle') {
        premiumPerUnit = atmCallPrice + atmPutPrice;
      } else if (strategy.name === 'Iron Condor' || strategy.name === 'Short Strangle') {
        // Receiving premium: use half ATM straddle as approximate credit
        premiumPerUnit = (atmCallPrice + atmPutPrice) * 0.4;
      } else {
        premiumPerUnit = atmCallPrice;
      }

      // Guard: if we couldn't get a valid premium, fallback
      if (premiumPerUnit <= 0) {
        return this.generateFallbackPick(context);
      }

      const entryPrice = Math.round(premiumPerUnit * lotSize * 100) / 100;
      const targetPrice = Math.round(entryPrice * strategy.targetMult * 100) / 100;
      const stoplossPrice = Math.round(entryPrice * strategy.slMult * 100) / 100;

      // Classify IV regime for display
      const ivRegimeLabel = iv > 22 ? 'High IV (sell premium)' : iv < 14 ? 'Low IV (buy premium)' : 'Normal IV';

      const rationale = await context.service.generateRationale({
        category: 'derivatives',
        name: `${selectedSymbol} ${strategy.name}`,
        symbol: selectedSymbol,
        strategy: strategy.name,
        outlook: strategy.outlook,
        currentPrice: spotPrice,
        targetPrice,
        stoplossPrice,
        metrics: {
          iv,
          ivRegime: ivRegimeLabel,
          lotSize,
          strikePrice: atmStrike,
          volPreference: strategy.volPreference,
        },
      });

      return {
        category: 'derivatives',
        instrumentName: `${selectedSymbol} ${strategy.name}`,
        symbol: selectedSymbol,
        exchange: 'NSE',
        recoDate: context.today,
        recoPrice: entryPrice,
        targetPrice,
        stoplossPrice,
        status: 'live',
        expiryDate: this.getExpiryDate(7),
        rationale,
        riskLevel: strategy.risk,
        suitableFor: this.deriveSuitableFor(strategy.risk, 'derivatives'),
        timeHorizon: 'short_term',
        confidenceScore: this.getConfidenceScore('derivatives', 60, 100),
        sectorCategory: indexSymbols.includes(selectedSymbol) ? 'Index Derivatives' : 'Stock Derivatives',
        keyMetrics: {
          strategy: strategy.name,
          outlook: strategy.outlook,
          lotSize,
          strikePrice: atmStrike,
          spotPrice,
          iv,
          ivRegime: ivRegimeLabel,
          volPreference: strategy.volPreference,
        },
      };
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("[DerivativeStrategy] NSE API error, using curated fallback:", error);
      return this.generateFallbackPick(context);
    }
  }

  /**
   * Extracts recent close prices from the options chain underlying series if available,
   * otherwise returns a single-element array with just the spot price.
   * Used to compute 20-day SMA for trend detection.
   */
  private buildRecentCloses(chain: any, spotPrice: number): number[] {
    // Some NSE chain responses include underlyingPriceSeries
    if (chain?.underlyingPriceSeries?.length > 0) {
      return (chain.underlyingPriceSeries as number[]).slice(-20);
    }
    // Fallback: just spotPrice — SMA deviation = 0, outlook = neutral
    return [spotPrice];
  }

  /**
   * Fallback pick when NSE options chain API is unavailable (rate-limited / blocked).
   * Phase 1 fix: Uses current approximate index levels and applies the same
   * regime-selection logic with a neutral/low-IV default regime.
   */
  private async generateFallbackPick(context: StrategyContext): Promise<DailyPickData | null> {
    try {
      // Phase 1 fix: Updated approximate index levels for June 2025
      const FALLBACK_INDEX = [
        { symbol: 'NIFTY',     spotPrice: 24800, lotSize: 25, sector: 'Index Derivatives' },
        { symbol: 'BANKNIFTY', spotPrice: 53000, lotSize: 15, sector: 'Index Derivatives' },
        { symbol: 'FINNIFTY',  spotPrice: 23500, lotSize: 40, sector: 'Index Derivatives' },
      ];

      const idx = Math.floor(Math.random() * FALLBACK_INDEX.length);
      const { symbol, spotPrice, lotSize, sector } = FALLBACK_INDEX[idx];

      // Phase 1 fix: Apply regime-selection even in fallback (assume IV=18, neutral outlook)
      const strategy = selectStrategy(spotPrice, 18, [spotPrice]);

      const strikeInterval = this.getStrikeInterval(symbol, spotPrice);
      const atmStrike = Math.round(spotPrice / strikeInterval) * strikeInterval;
      const approxPremium = spotPrice * 0.0045;  // ~0.45% of spot = approximate ATM premium
      const entryPrice = Math.round(approxPremium * lotSize * 100) / 100;
      const targetPrice = Math.round(entryPrice * strategy.targetMult * 100) / 100;
      const stoplossPrice = Math.round(entryPrice * strategy.slMult * 100) / 100;

      const rationale = await context.service.generateRationale({
        category: 'derivatives',
        name: `${symbol} ${strategy.name}`,
        symbol,
        strategy: strategy.name,
        outlook: strategy.outlook,
        currentPrice: spotPrice,
        targetPrice,
        stoplossPrice,
        metrics: { lotSize, strikePrice: atmStrike, approxIV: 18, dataSource: 'fallback_curated' },
      });

      return {
        category: 'derivatives',
        instrumentName: `${symbol} ${strategy.name}`,
        symbol,
        exchange: 'NSE',
        recoDate: context.today,
        recoPrice: entryPrice,
        targetPrice,
        stoplossPrice,
        status: 'live',
        expiryDate: this.getExpiryDate(7),
        rationale,
        riskLevel: strategy.risk,
        suitableFor: this.deriveSuitableFor(strategy.risk, 'derivatives'),
        timeHorizon: 'short_term',
        confidenceScore: 60,
        sectorCategory: sector,
        keyMetrics: {
          strategy: strategy.name,
          outlook: strategy.outlook,
          lotSize,
          strikePrice: atmStrike,
          spotPrice,
          iv: 18,
          dataSource: 'fallback_curated',
        },
      };
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[DerivativeStrategy] Fallback also failed:", err);
      return null;
    }
  }

  /** Derivatives are scored by IV regime alignment in selectStrategy(); not by instrument. */
  score(_instrument: any): number {
    return 70;
  }

  private getStrikeInterval(symbol: string, price: number): number {
    if (symbol === 'BANKNIFTY') return 100;
    if (symbol === 'NIFTY') return 50;
    if (price < 100) return 2.5;
    if (price < 500) return 5;
    return 10;
  }

  async getLivePrice(instrumentId: string): Promise<number | null> {
    try {
      const chain = await derivativesService.getOptionsChain(instrumentId);
      return chain.underlyingValue;
    } catch {
      return null;
    }
  }
}
