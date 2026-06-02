import { BaseStrategy } from "./base-strategy";
import { StrategyContext } from "./types";
import { DailyPickData, PickCategory } from "../pick-of-the-day-service";
import { derivativesService } from "../derivatives-service";

export class DerivativeStrategy extends BaseStrategy {
  category: PickCategory = 'derivatives';

  async generate(context: StrategyContext): Promise<DailyPickData | null> {
    try {
      const { symbols, lotSizes } = await derivativesService.getAvailableSymbols();
      const indexSymbols = ['NIFTY', 'BANKNIFTY', 'FINNIFTY'];
      const stockSymbols = symbols.filter(s => !indexSymbols.includes(s));
      
      const useIndex = Math.random() > 0.4;
      const candidatePool = useIndex ? indexSymbols : stockSymbols;
      const selectedSymbol = candidatePool[Math.floor(Math.random() * candidatePool.length)];

      const chain = await derivativesService.getOptionsChain(selectedSymbol);
      const spotPrice = chain.underlyingValue;
      const lotSize = lotSizes[selectedSymbol] || 50;

      const strategies = [
        { name: 'Bull Call Spread', outlook: 'bullish', risk: 'medium' },
        { name: 'Bear Put Spread', outlook: 'bearish', risk: 'medium' },
        { name: 'Long Call', outlook: 'bullish', risk: 'high' },
        { name: 'Long Put', outlook: 'bearish', risk: 'high' },
      ];

      const strategy = strategies[Math.floor(Math.random() * strategies.length)];
      const strikeInterval = this.getStrikeInterval(selectedSymbol, spotPrice);
      const atmStrike = Math.round(spotPrice / strikeInterval) * strikeInterval;

      const atmCall = chain.options.calls.find(c => c.strikePrice === atmStrike);
      const iv = atmCall?.impliedVolatility || 20;

      const entryPrice = (atmCall?.lastPrice || 0) * lotSize;
      const targetPrice = entryPrice * 1.5;
      const stoplossPrice = entryPrice * 0.5;

      const rationale = await context.service.generateRationale({
        category: 'derivatives',
        name: `${selectedSymbol} ${strategy.name}`,
        symbol: selectedSymbol,
        strategy: strategy.name,
        outlook: strategy.outlook,
        currentPrice: spotPrice,
        targetPrice,
        stoplossPrice,
        metrics: { iv, lotSize }
      });

      return {
        category: 'derivatives',
        instrumentName: `${selectedSymbol} ${strategy.name}`,
        symbol: selectedSymbol,
        exchange: 'NSE',
        recoDate: context.today,
        recoPrice: Math.round(entryPrice * 100) / 100,
        targetPrice: Math.round(targetPrice * 100) / 100,
        stoplossPrice: Math.round(stoplossPrice * 100) / 100,
        status: 'live',
        // BUG FIX: use a forward-looking 7-day expiry, NOT the NSE weekly expiry string
        // (which is often a past date, immediately marking the pick as expired in the UI)
        expiryDate: this.getExpiryDate(7),
        rationale,
        riskLevel: strategy.risk,
        suitableFor: this.deriveSuitableFor(strategy.risk, 'derivatives'),
        timeHorizon: 'short_term',
        confidenceScore: 75,
        sectorCategory: ['NIFTY', 'BANKNIFTY', 'FINNIFTY'].includes(selectedSymbol) ? 'Index Derivatives' : 'Stock Derivatives',
        keyMetrics: {
          strategy: strategy.name,
          outlook: strategy.outlook,
          lotSize,
          strikePrice: atmStrike,
          spotPrice,
          iv,
        },
      };
    } catch (error) {
      console.error("[DerivativeStrategy] NSE API error, using curated fallback:", error);
      return this.generateFallbackPick(context);
    }
  }

  /**
   * Fallback pick when NSE options chain API is unavailable (rate-limited / blocked).
   * Uses approximate index levels for a well-known structured strategy.
   */
  private async generateFallbackPick(context: StrategyContext): Promise<DailyPickData | null> {
    try {
      // Curated approximate index levels for fallback — updated periodically
      const FALLBACK_INDEX = [
        { symbol: 'NIFTY',     spotPrice: 24500, lotSize: 25, sector: 'Index Derivatives' },
        { symbol: 'BANKNIFTY', spotPrice: 52000, lotSize: 15, sector: 'Index Derivatives' },
        { symbol: 'FINNIFTY',  spotPrice: 23000, lotSize: 40, sector: 'Index Derivatives' },
      ];

      const idx = Math.floor(Math.random() * FALLBACK_INDEX.length);
      const { symbol, spotPrice, lotSize, sector } = FALLBACK_INDEX[idx];

      const strategyOptions = [
        { name: 'Bull Call Spread', outlook: 'bullish', risk: 'medium', targetMult: 1.4, slMult: 0.6 },
        { name: 'Bear Put Spread',  outlook: 'bearish', risk: 'medium', targetMult: 1.4, slMult: 0.6 },
        { name: 'Long Straddle',    outlook: 'neutral',  risk: 'high',   targetMult: 1.8, slMult: 0.4 },
      ];
      const strat = strategyOptions[Math.floor(Math.random() * strategyOptions.length)];

      const strikeInterval = this.getStrikeInterval(symbol, spotPrice);
      const atmStrike = Math.round(spotPrice / strikeInterval) * strikeInterval;
      // Approximate ATM option premium using rough IV estimate (18%)
      const approxPremium = spotPrice * 0.0045;
      const entryPrice = Math.round(approxPremium * lotSize * 100) / 100;
      const targetPrice = Math.round(entryPrice * strat.targetMult * 100) / 100;
      const stoplossPrice = Math.round(entryPrice * strat.slMult * 100) / 100;

      const rationale = await context.service.generateRationale({
        category: 'derivatives',
        name: `${symbol} ${strat.name}`,
        symbol,
        strategy: strat.name,
        outlook: strat.outlook,
        currentPrice: spotPrice,
        targetPrice,
        stoplossPrice,
        metrics: { lotSize, strikePrice: atmStrike, approxIV: 18 },
      });

      return {
        category: 'derivatives',
        instrumentName: `${symbol} ${strat.name}`,
        symbol,
        exchange: 'NSE',
        recoDate: context.today,
        recoPrice: entryPrice,
        targetPrice,
        stoplossPrice,
        status: 'live',
        expiryDate: this.getExpiryDate(7),
        rationale,
        riskLevel: strat.risk,
        suitableFor: this.deriveSuitableFor(strat.risk, 'derivatives'),
        timeHorizon: 'short_term',
        confidenceScore: 65,
        sectorCategory: sector,
        keyMetrics: {
          strategy: strat.name,
          outlook: strat.outlook,
          lotSize,
          strikePrice: atmStrike,
          spotPrice,
          iv: 18,
          dataSource: 'fallback_curated',
        },
      };
    } catch (err) {
      console.error("[DerivativeStrategy] Fallback also failed:", err);
      return null;
    }
  }

  score(instrument: any): number {
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
