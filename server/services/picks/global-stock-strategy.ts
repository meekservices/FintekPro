import { db } from "../../db";
import { sql } from "drizzle-orm";
import { BaseStrategy } from "./base-strategy";
import { StrategyContext } from "./types";
import { DailyPickData, PickCategory, calculateSuggestedAllocation } from "../pick-of-the-day-service";

/**
 * Curated global stock pool with SECTOR tags for rotation.
 * Prices are approximate reference values — overridden by live DB data when available.
 * Updated: June 2025 approximate levels.
 */
const GLOBAL_FALLBACK_POOL = [
  { name: 'Apple Inc.',          symbol: 'AAPL',  exchange: 'NASDAQ', market: 'us',     lastPrice: 210, sector: 'Technology',     currency: 'USD', peRatio: 30, returns1Y: 12 },
  { name: 'Microsoft Corp.',     symbol: 'MSFT',  exchange: 'NASDAQ', market: 'us',     lastPrice: 425, sector: 'Technology',     currency: 'USD', peRatio: 35, returns1Y: 18 },
  { name: 'Alphabet Inc.',       symbol: 'GOOGL', exchange: 'NASDAQ', market: 'us',     lastPrice: 180, sector: 'Communication',  currency: 'USD', peRatio: 22, returns1Y: 30 },
  { name: 'Amazon.com Inc.',     symbol: 'AMZN',  exchange: 'NASDAQ', market: 'us',     lastPrice: 200, sector: 'Consumer',       currency: 'USD', peRatio: 40, returns1Y: 25 },
  { name: 'NVIDIA Corp.',        symbol: 'NVDA',  exchange: 'NASDAQ', market: 'us',     lastPrice: 135, sector: 'Semiconductors', currency: 'USD', peRatio: 45, returns1Y: 180 },
  { name: 'Meta Platforms',      symbol: 'META',  exchange: 'NASDAQ', market: 'us',     lastPrice: 560, sector: 'Communication',  currency: 'USD', peRatio: 25, returns1Y: 55 },
  { name: 'Tesla Inc.',          symbol: 'TSLA',  exchange: 'NASDAQ', market: 'us',     lastPrice: 250, sector: 'Auto/EV',        currency: 'USD', peRatio: 60, returns1Y: -15 },
  { name: 'ASML Holding',        symbol: 'ASML',  exchange: 'AMS',    market: 'europe', lastPrice: 720, sector: 'Semiconductors', currency: 'EUR', peRatio: 40, returns1Y: 10 },
  { name: 'LVMH',                symbol: 'MC',    exchange: 'EPA',    market: 'europe', lastPrice: 620, sector: 'Luxury',         currency: 'EUR', peRatio: 20, returns1Y: -5 },
  { name: 'Taiwan Semicon.',     symbol: 'TSM',   exchange: 'NYSE',   market: 'us',     lastPrice: 190, sector: 'Semiconductors', currency: 'USD', peRatio: 22, returns1Y: 80 },
];

/**
 * Phase 1 fix: Real scoring for global stocks (previously hardcoded 60).
 *
 * Signals:
 *  - 1Y return momentum (primary for global picks — trend following works globally)
 *  - P/E ratio (value screen)
 *  - Analyst consensus / known quality
 *  - Sector preference aligned with current global cycle
 */
function scoreGlobalStock(stock: any): number {
  let score = 0;

  // Momentum: 1Y return — strong momentum is the #1 global signal
  const returns1Y = parseFloat(stock.returns1Y ?? stock.returns_1y ?? stock.returns1y ?? '0');
  if (returns1Y > 50) score += 30;
  else if (returns1Y > 25) score += 22;
  else if (returns1Y > 10) score += 15;
  else if (returns1Y < -10) score -= 10;  // avoid falling knives

  // Valuation: P/E ratio
  const pe = parseFloat(stock.peRatio ?? stock.pe_ratio ?? stock.pe ?? '0');
  if (pe > 0 && pe < 20) score += 15;
  else if (pe >= 20 && pe < 35) score += 10;
  else if (pe >= 35 && pe < 50) score += 5;
  else if (pe > 60) score -= 5;   // overvalued territory

  // Sector cycle preference (AI/Semiconductor supercycle + defensive)
  const sector = (stock.sector || '').toLowerCase();
  if (sector.includes('semiconductor')) score += 15;
  else if (sector.includes('technology') || sector.includes('tech')) score += 12;
  else if (sector.includes('communication')) score += 10;
  else if (sector.includes('healthcare') || sector.includes('pharma')) score += 8;
  else if (sector.includes('consumer')) score += 6;
  else if (sector.includes('luxury')) score += 5;

  // Market preference: US markets have deeper liquidity for Indian investors
  if (stock.market === 'us') score += 5;

  // Market cap proxy: higher price generally = more established (for global large caps)
  const price = parseFloat(String(stock.lastPrice ?? stock.last_price ?? '0'));
  if (price > 300) score += 5;
  else if (price > 100) score += 3;

  return Math.max(score, 1);
}

export class GlobalStockStrategy extends BaseStrategy {
  category: PickCategory = 'global_stocks';

  async generate(context: StrategyContext): Promise<DailyPickData | null> {
    try {
      // Phase 1 fix: ORDER BY meaningful signals (momentum + market cap), not RANDOM()
      const dbStocks = await db.execute(sql`
        SELECT id, name, symbol, exchange, market, sector, currency,
               last_price        as "lastPrice",
               pe_ratio          as "peRatio",
               returns_1y        as "returns1Y",
               market_cap        as "marketCap",
               analyst_rating    as "analystRating"
        FROM global_instruments
        WHERE last_price IS NOT NULL AND last_price::numeric > 0
        ORDER BY
          COALESCE(returns_1y::numeric, 0) DESC,
          COALESCE(market_cap::numeric, 0) DESC
        LIMIT 20
      `);
      const rows = (dbStocks.rows || []) as any[];

      // If DB has data, use it; otherwise fall back to curated pool
      const candidates = rows.length > 0 ? rows : GLOBAL_FALLBACK_POOL;

      // Phase 1 fix: filter recently-picked IDs
      const freshCandidates = candidates.filter(s =>
        !context.recentIds.has(String(s.id || s.symbol))
      );
      const pool = freshCandidates.length > 0 ? freshCandidates : candidates;

      // Phase 1 fix: score all candidates, pick top scorer (not random)
      const scored = pool
        .map(s => ({ s, score: scoreGlobalStock(s) }))
        .sort((a, b) => b.score - a.score);

      const topStock = scored[0].s;
      const topScore = scored[0].score;

      const currentPrice = parseFloat(String(topStock.lastPrice ?? topStock.last_price ?? "0"));
      if (!currentPrice || currentPrice <= 0) return null;

      const { targetPct, stoplossPct } = this.getDynamicTargetStoploss('global_stocks');
      const targetPrice = Math.round(currentPrice * (1 + targetPct) * 100) / 100;
      const stoplossPrice = Math.round(currentPrice * (1 - stoplossPct) * 100) / 100;

      const returns1Y = parseFloat(topStock.returns1Y ?? topStock.returns_1y ?? '0');
      const pe = parseFloat(topStock.peRatio ?? topStock.pe_ratio ?? '0');

      const rationale = await context.service.generateRationale({
        category: 'global_stocks',
        name: topStock.name,
        symbol: topStock.symbol,
        currentPrice,
        targetPrice,
        stoplossPrice,
        metrics: {
          sector: topStock.sector,
          exchange: topStock.exchange,
          currency: topStock.currency || 'USD',
          returns1Y: returns1Y > 0 ? returns1Y : undefined,
          pe: pe > 0 ? pe : undefined,
          market: topStock.market || 'us',
        },
      });

      // Phase 1 fix: riskLevel derived from volatility/PE, not hardcoded 'high'
      const riskLevel =
        (pe > 50 || returns1Y > 80) ? 'high'      // momentum/overvalued names
        : (pe < 25 && returns1Y >= 0) ? 'medium'   // value + stable
        : 'high';                                   // default global = high (FX risk)

      const suggestedAllocation = calculateSuggestedAllocation(
        'global_stocks', riskLevel, this.getConfidenceScore('global_stocks', topScore, 80),
        { marketCap: 'Large Cap' }
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
        riskLevel,
        suitableFor: this.deriveSuitableFor(riskLevel, 'global_stocks'),
        timeHorizon: this.getTimeHorizon('global_stocks'),
        confidenceScore: this.getConfidenceScore('global_stocks', topScore, 80),
        sectorCategory: topStock.sector || 'Global Equities',
        keyMetrics: {
          currency: topStock.currency || 'USD',
          market: topStock.market || 'us',
          lastPrice: currentPrice,
          returns1Y: returns1Y > 0 ? returns1Y : undefined,
          pe: pe > 0 ? pe : undefined,
          suggestedAllocation,
          dataSource: rows.length > 0 ? 'live_db' : 'fallback_curated',
        },
      };
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("[GlobalStockStrategy] Error:", error);
      return null;
    }
  }

  /** Delegates to the shared scoreGlobalStock function. */
  score(instrument: any): number {
    return scoreGlobalStock(instrument);
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
