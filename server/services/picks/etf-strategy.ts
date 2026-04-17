import { db } from "../../db";
import { instrumentMaster } from "@shared/schema";
import { and, eq, sql } from "drizzle-orm";
import { BaseStrategy } from "./base-strategy";
import { StrategyContext } from "./types";
import { DailyPickData, PickCategory } from "../pick-of-the-day-service";

export class ETFStrategy extends BaseStrategy {
  category: PickCategory = 'etfs';

  async generate(context: StrategyContext): Promise<DailyPickData | null> {
    try {
      const etfs = await db
        .select()
        .from(instrumentMaster)
        .where(
          and(
            eq(instrumentMaster.assetClass, 'etf'),
            sql`${instrumentMaster.lastPrice} IS NOT NULL`
          )
        )
        .limit(50);

      if (etfs.length === 0) return null;

      const topEtf = etfs[0];
      const currentPrice = parseFloat(topEtf.lastPrice || "0");
      const { targetPct, stoplossPct } = this.getDynamicTargetStoploss('etfs');
      const targetPrice = Math.round(currentPrice * (1 + targetPct) * 100) / 100;
      const stoplossPrice = Math.round(currentPrice * (1 - stoplossPct) * 100) / 100;

      const rationale = await context.service.generateRationale({
        category: 'etfs',
        name: topEtf.name,
        currentPrice,
        targetPrice,
        stoplossPrice,
        metrics: {
          issuer: topEtf.issuer || undefined,
          assetClass: 'ETF'
        }
      });

      return {
        category: 'etfs',
        instrumentId: topEtf.id,
        instrumentName: topEtf.name,
        symbol: topEtf.symbol || undefined,
        exchange: 'NSE',
        recoDate: context.today,
        recoPrice: currentPrice,
        targetPrice,
        stoplossPrice,
        currentPrice,
        status: 'live',
        expiryDate: this.getExpiryDate(180),
        rationale,
        riskLevel: 'medium',
        suitableFor: ['Balanced'],
        timeHorizon: this.getTimeHorizon('etfs'),
        confidenceScore: 75,
        sectorCategory: 'Index ETF',
        keyMetrics: {
          lastPrice: currentPrice,
          issuer: topEtf.issuer || undefined,
        },
      };
    } catch (error) {
      console.error("[ETFStrategy] Error:", error);
      return null;
    }
  }

  score(etf: any): number {
    return 65;
  }

  async getLivePrice(instrumentId: string): Promise<number | null> {
    const row = await db.select({ lastPrice: instrumentMaster.lastPrice })
      .from(instrumentMaster).where(eq(instrumentMaster.id, instrumentId)).limit(1);
    return row[0]?.lastPrice ? parseFloat(row[0].lastPrice) : null;
  }
}
