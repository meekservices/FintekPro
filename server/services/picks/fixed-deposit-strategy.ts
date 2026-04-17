import { db } from "../../db";
import { instrumentMaster } from "@shared/schema";
import { and, eq, or, sql } from "drizzle-orm";
import { BaseStrategy } from "./base-strategy";
import { StrategyContext } from "./types";
import { DailyPickData, PickCategory } from "../pick-of-the-day-service";

export class FixedDepositStrategy extends BaseStrategy {
  category: PickCategory = 'fixed_deposits';

  async generate(context: StrategyContext): Promise<DailyPickData | null> {
    try {
      const fds = await db
        .select()
        .from(instrumentMaster)
        .where(
          or(
            eq(instrumentMaster.category, 'FD'),
            eq(instrumentMaster.assetClass, 'fixed_deposit')
          )
        )
        .limit(20);

      if (fds.length === 0) return null;

      const topFD = fds[0];

      return {
        category: 'fixed_deposits',
        instrumentId: topFD.id,
        instrumentName: topFD.name,
        recoDate: context.today,
        recoPrice: 0,
        targetPrice: 0,
        stoplossPrice: 0,
        currentPrice: 0,
        status: 'live',
        expiryDate: this.getExpiryDate(365),
        rationale: "",
        riskLevel: 'low',
        suitableFor: ['Conservative'],
        timeHorizon: this.getTimeHorizon('fixed_deposits'),
        confidenceScore: 95,
        sectorCategory: 'Fixed Income',
        keyMetrics: {
          issuer: topFD.issuer,
          category: topFD.category,
        },
      };
    } catch (error) {
      console.error("[FixedDepositStrategy] Error:", error);
      return null;
    }
  }

  score(fd: any): number {
    return 80;
  }

  async getLivePrice(instrumentId: string): Promise<number | null> {
    const row = await db.select({ lastPrice: instrumentMaster.lastPrice })
      .from(instrumentMaster).where(eq(instrumentMaster.id, instrumentId)).limit(1);
    return row[0]?.lastPrice ? parseFloat(row[0].lastPrice) : 0;
  }
}
