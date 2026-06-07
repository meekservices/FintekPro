import { db } from "../../db";
import { sql } from "drizzle-orm";
import { BaseStrategy } from "./base-strategy";
import { StrategyContext } from "./types";
import { DailyPickData, PickCategory } from "../pick-of-the-day-service";

// Reference prices for known REITs/InvITs — used as fallback when current_price is NULL/0 in DB.
// Updated periodically; actual live price fetched by refreshLivePicks() post-market.
const REIT_REFERENCE_PRICES: Record<string, number> = {
  EMBASSY:     340,
  MINDSPACE:   315,
  BROOKFIELD:  225,
  NEXUSSELECT: 125,
  INDIGRID:    155,
  IRB:          55,
  POWERGRID:   100,
  NHIT:        105,
  JIOINVIT:    250,
  ORIENTGREEN:  90,
  BHINVIT:     105,
};

export class REITInvITStrategy extends BaseStrategy {
  category: PickCategory = 'reits_invits';

  async generate(context: StrategyContext): Promise<DailyPickData | null> {
    try {
      // Fetch all active REITs and InvITs so we can rotate between them
      const reitsList = await db.execute(sql`
        SELECT id, name, symbol, isin_code as isin, sector,
               current_price::numeric as "currentPrice",
               face_value::numeric      as "faceValue",
               'REIT' as type
        FROM reits WHERE is_active = true
        UNION ALL
        SELECT id, name, symbol, isin_code as isin, sector,
               current_price::numeric as "currentPrice",
               face_value::numeric      as "faceValue",
               'InvIT' as type
        FROM invits WHERE is_active = true
        ORDER BY name
        LIMIT 20
      `);

      const all = (reitsList.rows || []) as any[];
      if (all.length === 0) return null;

      // Bug fix #1: Rotate instruments — skip those picked in the last 14 days
      const recentIds = context.recentIds || new Set<string>();
      const candidates = all.filter(r =>
        !recentIds.has(String(r.id)) && !recentIds.has(r.symbol)
      );
      // If all were recently picked, fall back to any available (cycle restarts)
      const top = candidates.length > 0 ? candidates[0] : all[0];

      // Bug fix #2: Use reference price when DB current_price is NULL or 0
      const dbPrice = parseFloat(String(top.currentPrice || "0"));
      const refPrice =
        REIT_REFERENCE_PRICES[top.symbol as string] ??
        parseFloat(String(top.faceValue || "0"));
      const currentPrice = dbPrice > 0 ? dbPrice : refPrice;

      if (currentPrice <= 0) {
        console.warn(`[REITInvITStrategy] No price available for ${top.symbol} — skipping pick`);
        return null;
      }

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
          priceSource: dbPrice > 0 ? 'db' : 'reference',
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
      const reitRow = result.rows?.[0] as any;
      return reitRow?.current_price ? parseFloat(reitRow.current_price) : null;
    } catch {
      return null;
    }
  }
}
