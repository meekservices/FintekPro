import { db } from "../../db";
import { sql } from "drizzle-orm";
import { logger } from "../../logger";
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

			const freshSgb = this.filterRecentPicks(
				all,
				context.recentIds,
				(s) => String(s.id),
			);
			const top = freshSgb[0];
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
			logger.error("[SGBStrategy] Error:", error instanceof Error ? error : new Error(String(error)));
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
		// Tier 1: MCX Gold spot from commodity_prices table
		let goldPrice: number | null = null;
		try {
			const result = await db.execute(sql`
        SELECT current_price, last_updated FROM commodity_prices
        WHERE symbol = 'GOLD'
        ORDER BY last_updated DESC
        LIMIT 1
      `);
			const row = (result.rows?.[0] ?? null) as unknown as { current_price?: string | number | null; last_updated?: string } | null;
			if (row?.current_price != null) {
				const priceVal = Number.parseFloat(String(row.current_price));
				// Accept DB price only if it's reasonable (gold in INR > 4000/g) and fresh (< 7 days)
				const updatedAt = row.last_updated ? new Date(row.last_updated) : null;
				const ageHours = updatedAt ? (Date.now() - updatedAt.getTime()) / 3600000 : 999;
				if (priceVal > 4000 && ageHours < 168) {
					goldPrice = priceVal;
				}
			}
		} catch { /* non-fatal */ }

		// Tier 2: Yahoo Finance GC=F (gold futures in USD) converted to INR
		if (!goldPrice) {
			try {
				const yahooFinance = (await import("yahoo-finance2")).default;
				// GC=F = COMEX Gold Futures (USD/troy oz)
				// USDINR=X = USD/INR spot rate
				const [gcQuote, usdInrQuote] = await Promise.all([
					(yahooFinance as any).quote("GC=F").catch(() => null),
					(yahooFinance as any).quote("USDINR=X").catch(() => null),
				]);
				const goldUsdOz = gcQuote?.regularMarketPrice;
				const usdInr = usdInrQuote?.regularMarketPrice ?? 83.5;
				if (goldUsdOz && Number.isFinite(goldUsdOz) && goldUsdOz > 1000) {
					// Convert: USD/troy-oz → INR/gram (1 troy oz = 31.1035 g)
					goldPrice = Math.round((goldUsdOz * usdInr / 31.1035) * 10) / 10;
					// Persist to commodity_prices for next time
					db.execute(sql`
						INSERT INTO commodity_prices (symbol, current_price, last_updated)
						VALUES ('GOLD', ${String(goldPrice)}, NOW())
						ON CONFLICT (symbol) DO UPDATE
						SET current_price = EXCLUDED.current_price, last_updated = NOW()
					`).catch(() => {});
				}
			} catch { /* Yahoo Finance unavailable */ }
		}

		// Fallback gold price benchmark (per gram, approximate MCX Gold rate in INR)
		// Typical gold price range: ₹6,000–9,000/gram. SGB is priced per gram.
		const currentPrice = goldPrice && goldPrice > 1000 ? goldPrice : 7_400;

		// SGB target: gold historically appreciates ~8% p.a. over 8 years
		const targetPrice = Math.round(currentPrice * 1.1 * 100) / 100;
		const stoplossPrice = Math.round(currentPrice * 0.92 * 100) / 100;
		const sgbInterestRate = 2.5;

		const SGB_SECONDARY_POOL = [
			{
				id: "sgb_2023_24_s4",
				name: "SGB 2023-24 Series IV",
				series: "2023-24 Series IV",
				tenureYears: 8,
			},
			{
				id: "sgb_2023_24_s3",
				name: "SGB 2023-24 Series III",
				series: "2023-24 Series III",
				tenureYears: 7,
			},
			{
				id: "sgb_2023_24_s2",
				name: "SGB 2023-24 Series II",
				series: "2023-24 Series II",
				tenureYears: 7,
			},
			{
				id: "sgb_2022_23_s4",
				name: "SGB 2022-23 Series IV",
				series: "2022-23 Series IV",
				tenureYears: 6,
			},
			{
				id: "sgb_2022_23_s3",
				name: "SGB 2022-23 Series III",
				series: "2022-23 Series III",
				tenureYears: 6,
			},
			{
				id: "sgb_2021_22_s10",
				name: "SGB 2021-22 Series X",
				series: "2021-22 Series X",
				tenureYears: 5,
			},
		];

		const freshPool = SGB_SECONDARY_POOL.filter(
			(s) => !context.recentIds.has(s.id) && !context.recentIds.has(s.name) && !context.recentIds.has(s.name.toLowerCase()),
		);
		const pool = freshPool.length > 0 ? freshPool : SGB_SECONDARY_POOL;
		const istDay = Math.floor((Date.now() + 5.5 * 3600000) / 86400000);
		const chosen = pool[istDay % pool.length];

		let rationale: string;
		try {
			rationale = await context.service.generateRationale({
				category: "sgb",
				name: chosen.name,
				currentPrice,
				targetPrice,
				stoplossPrice,
				metrics: {
					issueStatus: "secondary_market",
					series: chosen.series,
					issuePrice: currentPrice,
					sgbInterestRate,
					tenureYears: chosen.tenureYears,
					sovereignGuarantee: true,
					goldSpotPrice: currentPrice,
				},
			});
		} catch {
			rationale = `Sovereign Gold Bonds (${chosen.name}) are government securities denominated in grams of gold. They offer a fixed interest of 2.5% p.a. plus capital appreciation tied to gold prices with complete sovereign backing.`;
		}

		logger.info(`[SGBStrategy] Picked ${chosen.name} @ gold price ₹${currentPrice}/g (source: ${goldPrice ? 'live' : 'benchmark'})`);

		return {
			category: "sgb",
			instrumentId: chosen.id,
			instrumentName: chosen.name,
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
				series: chosen.series,
				issuePrice: currentPrice,
				sgbInterestRate,
				tenureYears: chosen.tenureYears,
				sovereignGuarantee: true,
				investmentType: "Sovereign Gold Bond",
				suggestedAllocation: 5,
			},
		};
	}
}
