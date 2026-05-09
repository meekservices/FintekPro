import { db } from "../../db";
import { listedStocks, goldenPrices } from "@shared/schema";
import { and, eq, sql, gte, asc } from "drizzle-orm";
import { BaseStrategy } from "./base-strategy";
import { StrategyContext } from "./types";
import { DailyPickData, PickCategory } from "../pick-of-the-day-service";
import { getEnrichedStockSnapshots, EnrichedStockSnapshot } from '../screener/enriched-stock-data';
import { FinancialMetricsCalculator } from "../financial-metrics-calculator";

const financialMetricsCalculator = new FinancialMetricsCalculator();

export class StockStrategy extends BaseStrategy {
  category: PickCategory = 'listed_stocks';

  async generate(context: StrategyContext): Promise<DailyPickData | null> {
    try {
      const stocks = await db
        .select()
        .from(listedStocks)
        .where(
          and(
            eq(listedStocks.isPublished, true),
            sql`${listedStocks.currentPrice} IS NOT NULL`,
            sql`CAST(${listedStocks.currentPrice} AS DECIMAL) > 50`
          )
        )
        .limit(100);

      if (stocks.length === 0) return null;

      const freshStocks = this.filterRecentPicks(stocks, context.recentIds, s => s.id);
      const stockSymbols = freshStocks.map(s => s.symbol).filter(Boolean) as string[];
      
      let enrichedSnapshots: Map<string, EnrichedStockSnapshot> = new Map();
      try {
        enrichedSnapshots = await getEnrichedStockSnapshots(stockSymbols);
      } catch (err) {
        console.warn("[StockStrategy] Failed to fetch enriched snapshots:", err);
      }

      const scoredStocksRaw = await Promise.all(
        freshStocks.map(async stock => {
          const enriched = stock.symbol ? enrichedSnapshots.get(stock.symbol.toUpperCase()) || null : null;
          return {
            stock,
            enriched,
            score: await this.score(stock, enriched),
          };
        })
      );
      const scoredStocks = scoredStocksRaw.sort((a, b) => b.score - a.score);

      if (scoredStocks.length === 0) return null;

      const topStock = scoredStocks[0].stock;
      const topEnriched = scoredStocks[0].enriched;
      const currentPrice = parseFloat(topStock.currentPrice || "0");
      const volatility = topStock.volatility ? parseFloat(topStock.volatility) : undefined;
      const { targetPct, stoplossPct } = this.getDynamicTargetStoploss('listed_stocks', volatility);
      const targetPrice = Math.round(currentPrice * (1 + targetPct) * 100) / 100;
      const stoplossPrice = Math.round(currentPrice * (1 - stoplossPct) * 100) / 100;

      let directRsi: number | null = null;
      let directRoic: number | null = null;
      
      if (!topEnriched?.fundamentals?.roic && topStock.roce) {
        directRoic = parseFloat(topStock.roce);
      }

      if (!topEnriched?.technicals?.rsi && (topStock.isin || topStock.symbol)) {
        directRsi = await this.fetchRsiFromGoldenPrices(topStock);
      }

      const rationale = await context.service.generateRationale({
        category: 'listed_stocks',
        name: topStock.companyName || topStock.symbol,
        symbol: topStock.symbol,
        currentPrice,
        targetPrice,
        stoplossPrice,
        metrics: {
          pe: topStock.peRatio || undefined,
          roic: topEnriched?.fundamentals?.roic ?? directRoic ?? undefined,
          rsi: topEnriched?.technicals?.rsi ?? directRsi ?? undefined,
          returns1y: topStock.returns1Y || undefined
        }
      });

      const exchange = topStock.nseCode ? 'NSE' : (topStock.bseCode ? 'BSE' : 'NSE');
      
      return {
        category: 'listed_stocks',
        instrumentId: topStock.id,
        instrumentName: topStock.companyName || topStock.symbol,
        isin: topStock.isin || undefined,
        symbol: topStock.symbol,
        exchange,
        recoDate: context.today,
        recoPrice: currentPrice,
        targetPrice,
        stoplossPrice,
        currentPrice,
        status: 'live',
        expiryDate: this.getExpiryDate(this.DEFAULT_VALIDITY_DAYS),
        rationale, 
        riskLevel: this.getRiskLevel(topStock.volatility ? parseFloat(topStock.volatility) : 20),
        suitableFor: this.deriveSuitableFor(this.getRiskLevel(topStock.volatility ? parseFloat(topStock.volatility) : 20), 'listed_stocks'),
        timeHorizon: this.getTimeHorizon('listed_stocks'),
        confidenceScore: this.getConfidenceScore('listed_stocks', scoredStocks[0].score, 70),
        sectorCategory: topStock.sector || undefined,
        keyMetrics: {
          cmp: currentPrice,
          pe: topStock.peRatio ? parseFloat(topStock.peRatio) : undefined,
          returns1y: topStock.returns1Y ? parseFloat(topStock.returns1Y) : undefined,
          returns3y: topStock.returns3Y ? parseFloat(topStock.returns3Y) : undefined,
          volatility: topStock.volatility ? parseFloat(topStock.volatility) : undefined,
          sector: topStock.sector || undefined,
          marketCap: topStock.marketCap || undefined,
          analystRating: topStock.analystRating || undefined,
          roic: topEnriched?.fundamentals?.roic ?? directRoic ?? null,
          rsi: topEnriched?.technicals?.rsi ?? directRsi ?? null,
        },
      };
    } catch (error) {
      console.error("[StockStrategy] Error:", error);
      return null;
    }
  }

  async score(stock: any, enriched?: EnrichedStockSnapshot | null): Promise<number> {
    let score = 0;
    
    const analystRating = stock.analystRating?.toLowerCase() || '';
    if (analystRating.includes('strong buy')) score += 25;
    else if (analystRating.includes('buy')) score += 20;
    
    const returns1Y = stock.returns1Y ? parseFloat(stock.returns1Y) : 0;
    if (returns1Y > 30) score += 20;
    else if (returns1Y > 15) score += 15;
    
    const pe = stock.peRatio ? parseFloat(stock.peRatio) : 0;
    if (pe > 0 && pe < 15) score += 15;
    else if (pe >= 15 && pe < 25) score += 10;
    
    if (stock.marketCap === 'Large Cap') score += 10;
    else if (stock.marketCap === 'Mid Cap') score += 8;
    
    const advancedMetrics = await this.calculateAdvancedMetrics(stock);
    if (advancedMetrics.piotroskiFScore && advancedMetrics.piotroskiFScore >= 8) score += 15;
    if (advancedMetrics.roic && advancedMetrics.roic > 20) score += 10;

    if (enriched) {
      if (enriched.fundamentals?.roe && enriched.fundamentals.roe > 15) score += 8;
      if (enriched.growth?.epsGrowth && enriched.growth.epsGrowth > 20) score += 8;
    }
    
    return Math.max(0, score);
  }

  private async calculateAdvancedMetrics(stock: any): Promise<any> {
    try {
      return {}; 
    } catch {
      return {};
    }
  }

  private async fetchRsiFromGoldenPrices(stock: any): Promise<number | null> {
    try {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 35);
      const priceRows = await db
        .select({ price: goldenPrices.price, priceDate: goldenPrices.priceDate })
        .from(goldenPrices)
        .where(
          and(
            stock.isin ? eq(goldenPrices.isin, stock.isin) : eq(goldenPrices.symbol, stock.symbol!),
            gte(goldenPrices.priceDate, cutoff.toISOString().split('T')[0])
          )
        )
        .orderBy(asc(goldenPrices.priceDate))
        .limit(40);

      if (priceRows.length >= 15) {
        const closes = priceRows.map(r => parseFloat(r.price));
        let gains = 0, losses = 0;
        for (let i = closes.length - 14; i < closes.length; i++) {
          const diff = closes[i] - closes[i - 1];
          if (diff > 0) gains += diff;
          else losses += Math.abs(diff);
        }
        const avgGain = gains / 14;
        const avgLoss = losses / 14;
        return avgLoss === 0 ? 100 : Math.round((100 - (100 / (1 + avgGain / avgLoss))) * 100) / 100;
      }
      return null;
    } catch {
      return null;
    }
  }

  async getLivePrice(instrumentId: string): Promise<number | null> {
    const row = await db.select({ currentPrice: listedStocks.currentPrice })
      .from(listedStocks).where(eq(listedStocks.id, instrumentId)).limit(1);
    return row[0]?.currentPrice ? parseFloat(row[0].currentPrice) : null;
  }
}
