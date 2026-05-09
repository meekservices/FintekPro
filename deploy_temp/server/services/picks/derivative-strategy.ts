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
      const nearestExpiry = chain.expiryDates[0];
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
        metrics: {
          iv,
          lotSize,
          expiry: nearestExpiry
        }
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
        expiryDate: nearestExpiry,
        rationale,
        riskLevel: strategy.risk,
        suitableFor: this.deriveSuitableFor(strategy.risk, 'derivatives'),
        timeHorizon: 'short_term',
        confidenceScore: 75,
        sectorCategory: indexSymbols.includes(selectedSymbol) ? 'Index Derivatives' : 'Stock Derivatives',
        keyMetrics: {
          strategy: strategy.name,
          outlook: strategy.outlook,
          lotSize,
          strikePrice: atmStrike,
          spotPrice,
          iv,
          expiry: nearestExpiry,
        },
      };
    } catch (error) {
      console.error("[DerivativeStrategy] Error:", error);
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
