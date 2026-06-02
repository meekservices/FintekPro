import { db } from "../../db";
import { sql } from "drizzle-orm";
import { BaseStrategy } from "./base-strategy";
import { StrategyContext } from "./types";
import { DailyPickData, PickCategory, calculateSuggestedAllocation } from "../pick-of-the-day-service";

/** Curated global stock fallback used when the globalInstruments table is empty */
const GLOBAL_FALLBACK_POOL = [
  { name: 'Apple Inc.',         symbol: 'AAPL',  exchange: 'NASDAQ', market: 'us',     lastPrice: 205, sector: 'Technology',     currency: 'USD' },
  { name: 'Microsoft Corp.',    symbol: 'MSFT',  exchange: 'NASDAQ', market: 'us',     lastPrice: 415, sector: 'Technology',     currency: 'USD' },
  { name: 'Alphabet Inc.',      symbol: 'GOOGL', exchange: 'NASDAQ', market: 'us',     lastPrice: 175, sector: 'Communication',  currency: 'USD' },
  { name: 'Amazon.com Inc.',    symbol: 'AMZN',  exchange: 'NASDAQ', market: 'us',     lastPrice: 192, sector: 'Consumer',       currency: 'USD' },
  { name: 'NVIDIA Corp.',       symbol: 'NVDA',  exchange: 'NASDAQ', market: 'us',     lastPrice: 125, sector: 'Semiconductors', currency: 'USD' },
  { name: 'Meta Platforms',     symbol: 'META',  exchange: 'NASDAQ', market: 'us',     lastPrice: 550, sector: 'Communication',  currency: 'USD' },
  { name: 'Tesla Inc.',         symbol: 'TSLA',  exchange: 'NASDAQ', market: 'us',     lastPrice: 250, sector: 'Auto/EV',        currency: 'USD' },
  { name: 'ASML Holding',       symbol: 'ASML',  exchange: 'AMS',    market: 'europe', lastPrice: 720, sector: 'Semiconductors', currency: 'EUR' },
  { name: 'LVMH',               symbol: 'MC',    exchange: 'EPA',    market: 'europe', lastPrice: 620, sector: 'Luxury',         currency: 'EUR' },
  { name: 'Taiwan Semicon.',    symbol: 'TSM',   exchange: 'NYSE',   market: 'us',     lastPrice: 185, sector: 'Semiconductors', currency: 'USD' },
];

export class GlobalStockStrategy extends BaseStrategy {
  category: PickCategory = 'global_stocks';

  async generate(context: StrategyContext): Promise<DailyPickData | null> {
    try {
      // Prefer live DB data; only instruments with a non-zero lastPrice qualify
      const dbStocks = await db.execute(sql`
        SELECT id, name, symbol, exchange, market, sector, currency, last_price as "lastPrice"
        FROM global_instruments
        WHERE last_price IS NOT NULL AND last_price::numeric > 0
        ORDER BY RANDOM()
        LIMIT 20
      `);
      const rows = (dbStocks.rows || []) as any[];

      // If DB has data, use it; otherwise fall back to curated pool
      const candidates = rows.length > 0 ? rows : GLOBAL_FALLBACK_POOL;
      const freshCandidates = candidates.filter(s =>
        !context.recentIds.has(String(s.id || s.symbol))
      );
      const pool = freshCandidates.length > 0 ? freshCandidates : candidates;
      const topStock = pool[Math.floor(Math.random() * Math.min(pool.length, 5))];

      const currentPrice = parseFloat(String(topStock.lastPrice || "0"));
      if (!currentPrice || currentPrice <= 0) return null;

      const { targetPct, stoplossPct } = this.getDynamicTargetStoploss('global_stocks');
      const targetPrice = Math.round(currentPrice * (1 + targetPct) * 100) / 100;
      const stoplossPrice = Math.round(currentPrice * (1 - stoplossPct) * 100) / 100;

      const rationale = await context.service.generateRationale({
        category: 'global_stocks',
        name: topStock.name,
        symbol: topStock.symbol,
        currentPrice,
        targetPrice,
        stoplossPrice,
        metrics: { sector: topStock.sector, exchange: topStock.exchange, currency: topStock.currency || 'USD' },
      });

      const suggestedAllocation = calculateSuggestedAllocation(
        'global_stocks', 'high', 70, { marketCap: 'Large Cap' }
      );

      return {
        category: 'global_stocks',
        instrumentId: String(topStock.id || topStock.symbol),
        instrumentName: topStock.name,
        symbol: topStock.symbol,
        exchange: topStock.exchange || 'NASDAQ',
        market: topStock.market || 'us',
        recoDate: context.today,
        recoPrice: currentPrice,
        targetPrice,
        stoplossPrice,
        currentPrice,
        status: 'live',
        expiryDate: this.getExpiryDate(90),
        rationale,
        riskLevel: 'high',
        suitableFor: ['Aggressive'],
        timeHorizon: this.getTimeHorizon('global_stocks'),
        confidenceScore: rows.length > 0 ? 75 : 65,
        sectorCategory: topStock.sector || 'Global Equities',
        keyMetrics: {
          currency: topStock.currency || 'USD',
          market: topStock.market || 'us',
          lastPrice: currentPrice,
          suggestedAllocation,
          dataSource: rows.length > 0 ? 'live_db' : 'fallback_curated',
        },
      };
    } catch (error) {
      console.error("[GlobalStockStrategy] Error:", error);
      return null;
    }
  }

  score(instrument: any): number {
    return 60;
  }

  async getLivePrice(instrumentId: string): Promise<number | null> {
    try {
      const result = await db.execute(sql`
        SELECT last_price FROM global_instruments
        WHERE id = ${instrumentId} OR symbol = ${instrumentId}
        LIMIT 1
      `);
      const row = ((result.rows || []) as any[])[0];
      return row?.last_price ? parseFloat(row.last_price) : null;
    } catch {
      return null;
    }
  }
}
