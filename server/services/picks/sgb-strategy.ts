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

			// ── Fallback: use gold spot price when no SGB tranches are open ────────
			if (all.length === 0) {
				return this.buildSyntheticSgbPick(context);
			}

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
					suggestedAllocation: 5,
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

	/**
	 * Builds a synthetic SGB pick when no active SGB tranches exist in the DB.
	 * Uses gold spot price from commodity_prices, or a benchmark price if unavailable.
	 * The synthetic pick represents the SGB series concept with current gold NAV pricing.
	 */
	private async buildSyntheticSgbPick(
		context: StrategyContext,
	): Promise<DailyPickData | null> {
		// Try fetching gold price from commodity_prices table
		let goldPrice: number | null = null;
		try {
			const result = await db.execute(sql`
        SELECT current_price FROM commodity_prices
        WHERE symbol = 'GOLD'
        ORDER BY last_updated DESC
        LIMIT 1
      `);
			const row = (result.rows?.[0] ?? null) as unknown as GoldPriceRow | null;
			if (row?.current_price != null) {
				goldPrice = Number.parseFloat(String(row.current_price));
			}
		} catch {
			/* non-fatal */
		}

		// Fallback gold price benchmark (per gram, approximate MCX Gold rate in INR)
		// Typical gold price range: ₹6,000–9,000/gram. SGB is priced per gram.
		const currentPrice = goldPrice && goldPrice > 1000 ? goldPrice : 7_400;

		// SGB target: gold historically appreciates ~8% p.a. over 8 years
		const targetPrice = Math.round(currentPrice * 1.1 * 100) / 100;
		const stoplossPrice = Math.round(currentPrice * 0.92 * 100) / 100;
		const sgbInterestRate = 2.5;

		const name = "Sovereign Gold Bond (Secondary Market)";

		let rationale: string;
		try {
			rationale = await context.service.generateRationale({
				category: "sgb",
				name,
				currentPrice,
				targetPrice,
				stoplossPrice,
				metrics: {
					issueStatus: "secondary_market",
					issuePrice: currentPrice,
					sgbInterestRate,
					tenureYears: 8,
					sovereignGuarantee: true,
					goldSpotPrice: currentPrice,
				},
			});
		} catch {
			rationale = `Sovereign Gold Bonds (SGBs) are government securities denominated in grams of gold. They offer a fixed interest of 2.5% p.a. plus capital appreciation tied to gold prices. Ideal for long-term wealth preservation with sovereign safety.`;
		}

		console.log(
			`[SGBStrategy] No active SGB tranches found. Using synthetic SGB pick at gold price ₹${currentPrice}/g`,
		);

		return {
			category: "sgb",
			instrumentId: "synth_sgb_secondary",
			instrumentName: name,
			recoDate: context.today,
			recoPrice: currentPrice,
			targetPrice,
			stoplossPrice,
			currentPrice,
			status: "live",
			expiryDate: this.getExpiryDate(365), // 1-year horizon for secondary market
			rationale,
			riskLevel: "low",
			suitableFor: ["Conservative"],
			timeHorizon: this.getTimeHorizon("sgb"),
			confidenceScore: 82,
			sectorCategory: "Sovereign Gold Bond",
			keyMetrics: {
				issueStatus: "secondary_market",
				issuePrice: currentPrice,
				sgbInterestRate,
				tenureYears: 8,
				sovereignGuarantee: true,
				investmentType: "Sovereign Gold Bond",
				suggestedAllocation: 5,
			},
		};
	}
}
