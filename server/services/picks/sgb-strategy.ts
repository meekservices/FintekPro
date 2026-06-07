import { db } from "../../db";
import { sql } from "drizzle-orm";
import { BaseStrategy } from "./base-strategy";
import type { StrategyContext } from "./types";
import type { DailyPickData, PickCategory } from "../pick-of-the-day-service";

/** Shape of a raw row returned by the sgb_primary_issues query. */
interface SgbRow {
	id: string | number;
	name: string;
	issuePrice: string | number | null;
	issueStatus: string;
}

/** Shape of a raw commodity price row from the DB. */
interface GoldPriceRow {
	current_price?: string | number | null;
}

export class SGBStrategy extends BaseStrategy {
	category: PickCategory = "sgb";

	// line 10: Promise<DailyPickData | null> — required by BaseStrategy interface
	async generate(context: StrategyContext): Promise<DailyPickData | null> {
		try {
			const sgbList = await db.execute(sql`
        SELECT id, series_name as name, issue_price as "issuePrice", issue_status as "issueStatus"
        FROM sgb_primary_issues WHERE issue_status IN ('open', 'upcoming') LIMIT 5
      `);

			// Drizzle execute() returns Record<string, unknown>[] — cast via unknown to our typed row shape
			const all = (sgbList.rows ?? []) as unknown as SgbRow[];
			if (all.length === 0) return null;

			const top = all[0];
			const currentPrice = Number.parseFloat(String(top.issuePrice ?? "0"));
			const sgbInterestRate = 2.5; // RBI fixed semi-annual coupon on SGBs

			const rationale = await context.service.generateRationale({
				category: "sgb",
				name: top.name,
				currentPrice,
				targetPrice: currentPrice, // SGB appreciation tracks gold price
				stoplossPrice: currentPrice * 0.9,
				metrics: {
					issueStatus: top.issueStatus,
					issuePrice: currentPrice,
					sgbInterestRate,
					tenureYears: 8,
					sovereignGuarantee: true,
				},
			});

			return {
				category: "sgb",
				instrumentId: String(top.id),
				instrumentName: top.name,
				recoDate: context.today,
				recoPrice: currentPrice,
				targetPrice: currentPrice, // Capital appreciation = gold price movement
				stoplossPrice: currentPrice * 0.9,
				currentPrice,
				status: "live",
				expiryDate: this.getExpiryDate(2920), // 8-year SGB tenure
				rationale,
				riskLevel: "low",
				suitableFor: ["Conservative"],
				timeHorizon: this.getTimeHorizon("sgb"),
				confidenceScore: 85,
				sectorCategory: "Sovereign Gold Bond",
				keyMetrics: {
					issueStatus: top.issueStatus,
					issuePrice: currentPrice,
					sgbInterestRate,
					tenureYears: 8,
				},
			};
		} catch (error) {
			// eslint-disable-next-line no-console
			console.error("[SGBStrategy] Error:", error);
			return null;
		}
	}

	/**
	 * Scores an SGB row for pick selection.
	 * Open issues score higher since they are immediately investable.
	 *
	 * @param sgb - Raw SgbRow from DB
	 * @returns Score value (higher = preferred)
	 */
	// line 69: was `score(sgb: any)` — now uses typed SgbRow
	score(sgb: SgbRow): number {
		return sgb.issueStatus === "open" ? 90 : 70;
	}

	/**
	 * Fetches the live gold price from the commodity_prices table.
	 * The SGB's current NAV tracks gold spot price — instrumentId is not used here.
	 *
	 * @param _instrumentId - Not used; SGB price derived from gold spot
	 * @returns Gold spot price in INR, or null if unavailable
	 */
	// line 73: Promise<number | null> — required by BaseStrategy interface
	async getLivePrice(_instrumentId: string): Promise<number | null> {
		try {
			const result = await db.execute(sql`
        SELECT current_price FROM commodity_prices
        WHERE symbol = 'GOLD'
        ORDER BY last_updated DESC
        LIMIT 1
      `);
			// line 78: Drizzle returns Record<string, unknown> — cast via unknown to GoldPriceRow
			const goldRow = (result.rows?.[0] ??
				null) as unknown as GoldPriceRow | null;
			return goldRow?.current_price != null
				? Number.parseFloat(String(goldRow.current_price))
				: null;
		} catch {
			return null;
		}
	}
}
