import { db } from "../../db";
import { sql } from "drizzle-orm";
import { BaseStrategy } from "./base-strategy";
import { StrategyContext } from "./types";
import { DailyPickData, PickCategory } from "../pick-of-the-day-service";

export class SGBStrategy extends BaseStrategy {
  category: PickCategory = 'sgb';

  async generate(context: StrategyContext): Promise<DailyPickData | null> {
    try {
      const sgbList = await db.execute(sql`
        SELECT id, issue_name as name, issue_price as "issuePrice", issue_status as "issueStatus"
        FROM sgb_primary_issues WHERE issue_status IN ('open', 'upcoming') LIMIT 5
      `);
      
      const all = (sgbList.rows || []) as any[];
      if (all.length === 0) return null;

      const top = all[0];
      const currentPrice = parseFloat(String(top.issuePrice || "0"));

      return {
        category: 'sgb',
        instrumentId: String(top.id),
        instrumentName: top.name,
        recoDate: context.today,
        recoPrice: currentPrice,
        targetPrice: currentPrice, // Price appreciation tied to gold
        stoplossPrice: currentPrice * 0.9,
        currentPrice,
        status: 'live',
        expiryDate: this.getExpiryDate(2920), // 8 years
        rationale: "",
        riskLevel: 'low',
        suitableFor: ['Conservative'],
        timeHorizon: this.getTimeHorizon('sgb'),
        confidenceScore: 85,
        sectorCategory: 'Sovereign Gold Bond',
        keyMetrics: {
          issueStatus: top.issueStatus,
          issuePrice: currentPrice,
        },
      };
    } catch (error) {
      console.error("[SGBStrategy] Error:", error);
      return null;
    }
  }

  score(sgb: any): number {
    return sgb.issueStatus === 'open' ? 90 : 70;
  }

  async getLivePrice(instrumentId: string): Promise<number | null> {
    try {
      const result = await db.execute(sql`
        SELECT current_price FROM commodity_prices WHERE symbol = 'GOLD' ORDER BY last_updated DESC LIMIT 1
      `);
      const goldRow = (result.rows?.[0] || result[0]) as any;
      return goldRow?.current_price ? parseFloat(goldRow.current_price) : null;
    } catch {
      return null;
    }
  }
}
