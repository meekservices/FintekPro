import { db } from "../../db";
import { sql } from "drizzle-orm";
import { BaseStrategy } from "./base-strategy";
import { StrategyContext } from "./types";
import { DailyPickData, PickCategory } from "../pick-of-the-day-service";

export class REITInvITStrategy extends BaseStrategy {
  category: PickCategory = 'reits_invits';

  async generate(context: StrategyContext): Promise<DailyPickData | null> {
    try {
      const reitsList = await db.execute(sql`
        SELECT id, name, symbol, isin_code as isin, sector, current_price::numeric as "currentPrice", 'REIT' as type
        FROM reits WHERE is_active = true LIMIT 10
      `);
      
      const all = (reitsList.rows || []) as any[];
      if (all.length === 0) return null;

      const top = all[0];
      const currentPrice = parseFloat(String(top.currentPrice || "0"));
      const { targetPct, stoplossPct } = this.getDynamicTargetStoploss('reits_invits');

      return {
        category: 'reits_invits',
        instrumentId: String(top.id),
        instrumentName: top.name,
        isin: top.isin,
        symbol: top.symbol,
        exchange: 'NSE',
        recoDate: context.today,
        recoPrice: currentPrice,
        targetPrice: Math.round(currentPrice * (1 + targetPct) * 100) / 100,
        stoplossPrice: Math.round(currentPrice * (1 - stoplossPct) * 100) / 100,
        currentPrice,
        status: 'live',
        expiryDate: this.getExpiryDate(180),
        rationale: "",
        riskLevel: 'medium',
        suitableFor: ['Balanced'],
        timeHorizon: this.getTimeHorizon('reits_invits'),
        confidenceScore: 75,
        sectorCategory: top.type,
        keyMetrics: {
          type: top.type,
          sector: top.sector,
        },
      };
    } catch (error) {
      console.error("[REITInvITStrategy] Error:", error);
      return null;
    }
  }

  score(reit: any): number {
    return 60;
  }

  async getLivePrice(instrumentId: string): Promise<number | null> {
    try {
      const result = await db.execute(sql`
        SELECT current_price FROM reits WHERE id::text = ${instrumentId}
        UNION ALL SELECT current_price FROM invits WHERE id::text = ${instrumentId}
        LIMIT 1
      `);
      const reitRow = (result.rows?.[0] || result[0]) as any;
      return reitRow?.current_price ? parseFloat(reitRow.current_price) : null;
    } catch {
      return null;
    }
  }
}
