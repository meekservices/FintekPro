import { db } from "../../db";
import { globalInstruments } from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import { BaseStrategy } from "./base-strategy";
import { StrategyContext } from "./types";
import { DailyPickData, PickCategory } from "../pick-of-the-day-service";

export class GlobalStockStrategy extends BaseStrategy {
  category: PickCategory = 'global_stocks';

  async generate(context: StrategyContext): Promise<DailyPickData | null> {
    try {
      const stocks = await db.select().from(globalInstruments).limit(50);
      if (stocks.length === 0) return null;

      const freshStocks = this.filterRecentPicks(stocks, context.recentIds, s => s.id);
      const topStock = freshStocks[0];
      const currentPrice = parseFloat(String(topStock.lastPrice || "0"));
      const { targetPct, stoplossPct } = this.getDynamicTargetStoploss('global_stocks');

      return {
        category: 'global_stocks',
        instrumentId: topStock.id,
        instrumentName: topStock.name,
        symbol: topStock.symbol,
        exchange: topStock.exchange || 'Unknown',
        recoDate: context.today,
        recoPrice: currentPrice,
        targetPrice: Math.round(currentPrice * (1 + targetPct) * 100) / 100,
        stoplossPrice: Math.round(currentPrice * (1 - stoplossPct) * 100) / 100,
        currentPrice,
        status: 'live',
        expiryDate: this.getExpiryDate(90),
        rationale: "",
        riskLevel: 'high',
        suitableFor: ['Aggressive'],
        timeHorizon: this.getTimeHorizon('global_stocks'),
        confidenceScore: 70,
        sectorCategory: topStock.sector || 'Global Equities',
        keyMetrics: {
          currency: topStock.currency,
          market: topStock.market,
          lastPrice: currentPrice,
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
    const row = await db.select({ lastPrice: globalInstruments.lastPrice })
      .from(globalInstruments).where(eq(globalInstruments.id, parseInt(instrumentId))).limit(1);
    return row[0]?.lastPrice ? parseFloat(row[0].lastPrice) : null;
  }
}
    return 60;
  }
}
