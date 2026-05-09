import { db } from "../../db";
import { bondCatalog } from "@shared/schema";
import { and, eq, sql } from "drizzle-orm";
import { BaseStrategy } from "./base-strategy";
import { StrategyContext } from "./types";
import { DailyPickData, PickCategory } from "../pick-of-the-day-service";

export class BondStrategy extends BaseStrategy {
  category: PickCategory = 'bonds';

  async generate(context: StrategyContext): Promise<DailyPickData | null> {
    try {
      const bonds = await db
        .select()
        .from(bondCatalog)
        .where(
          and(
            sql`${bondCatalog.cleanPrice} IS NOT NULL`,
            sql`${bondCatalog.cleanPrice}::numeric > 0`,
            sql`${bondCatalog.yieldToMaturity} IS NOT NULL`
          )
        )
        .limit(50);

      if (bonds.length === 0) return null;

      const freshBonds = this.filterRecentPicks(bonds, context.recentIds, b => b.id);
      const scoredBonds = freshBonds.map(bond => ({
        bond,
        score: this.score(bond),
      })).sort((a, b) => b.score - a.score);

      const topBond = scoredBonds[0].bond;
      const currentPrice = parseFloat(topBond.cleanPrice || "0");
      const { targetPct, stoplossPct } = this.getDynamicTargetStoploss('bonds');
      const targetPrice = Math.round(currentPrice * (1 + targetPct) * 100) / 100;
      const stoplossPrice = Math.round(currentPrice * (1 - stoplossPct) * 100) / 100;

      return {
        category: 'bonds',
        instrumentId: topBond.id,
        instrumentName: topBond.issuerName || topBond.isin,
        isin: topBond.isin,
        symbol: topBond.isin,
        recoDate: context.today,
        recoPrice: currentPrice,
        targetPrice,
        stoplossPrice,
        currentPrice,
        status: 'live',
        expiryDate: this.getExpiryDate(365),
        rationale: "",
        riskLevel: 'low',
        suitableFor: this.deriveSuitableFor('low', 'bonds'),
        timeHorizon: this.getTimeHorizon('bonds'),
        confidenceScore: this.getConfidenceScore('bonds', scoredBonds[0].score, 50),
        sectorCategory: 'Fixed Income',
        keyMetrics: {
          ytm: topBond.yieldToMaturity ? parseFloat(topBond.yieldToMaturity) : null,
          coupon: topBond.couponRate ? parseFloat(topBond.couponRate) : null,
          rating: topBond.creditRating ?? undefined,
          maturity: topBond.maturityDate,
        },
      };
    } catch (error) {
      console.error("[BondStrategy] Error:", error);
      return null;
    }
  }

  score(bond: any): number {
    let score = 0;
    const ytm = bond.yieldToMaturity ? parseFloat(bond.yieldToMaturity) : 0;
    if (ytm > 10) score += 25;
    else if (ytm > 8.5) score += 20;
    else if (ytm > 7.15) score += 12;

    const rating = (bond.creditRating || '').toUpperCase();
    if (rating.includes('AAA')) score += 25;
    else if (rating.includes('AA')) score += 20;
    
    return score;
  }

  async getLivePrice(instrumentId: string): Promise<number | null> {
    const row = await db.select({ cleanPrice: bondCatalog.cleanPrice })
      .from(bondCatalog).where(eq(bondCatalog.id, instrumentId)).limit(1);
    return row[0]?.cleanPrice ? parseFloat(row[0].cleanPrice) : null;
  }
}
