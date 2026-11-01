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

			const { targetPct, stoplossPct } = this.getDynamicTargetStoploss("sgb");
			const targetPrice = Math.round(currentPrice * (1 + targetPct) * 100) / 100;
			const stoplossPrice = Math.round(currentPrice * (1 - stoplossPct) * 100) / 100;

			const rationale = await context.service.generateRationale({
				category: "sgb",
				name: top.name,
				currentPrice,
				targetPrice,
				stoplossPrice,
				metrics: {
					issueStatus: top.issueStatus,
					issuePrice: currentPrice,
					sgbInterestRate,
					tenureYears: 8,
					sovereignGuarantee: true,
					targetAppreciationPct: Math.round(targetPct * 100),
				},
			});

			return {
				category: "sgb",
				instrumentId: String(top.id),
				instrumentName: top.name,
				recoDate: context.today,
				recoPrice: currentPrice,
				targetPrice,
				stoplossPrice,
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
	 * Fetches the live gold price.
	 * Tier 0: GPE authoritative benchmarks (reads golden_prices internally).
	 * Tier 1: Direct golden_prices query (SSOT fallback — no commodity_prices).
	 * Tier 2: Yahoo Finance GC=F conversion.
	 *
	 * @param _instrumentId - Not used; SGB price derived from gold spot
	 * @returns Gold spot price in INR, or null if unavailable
	 */
	// line 73: Promise<number | null> — required by BaseStrategy interface
	async getLivePrice(_instrumentId: string): Promise<number | null> {
		// Tier 0: Authoritative Gold benchmark from Golden Pricing Engine
		try {
			const { goldenPricingEngine } = await import("../golden-pricing/GoldenPricingEngine");
			const bench = await goldenPricingEngine.getAuthoritativeCommodityBenchmarks();
			if (bench?.gold?.mcxPriceInr && bench.gold.mcxPriceInr > 40000) {
				return Math.round((bench.gold.mcxPriceInr / 10) * 10) / 10;
			}
		} catch { /* proceed to DB */ }

		// Tier 1: Direct golden_prices query (SSOT — no commodity_prices)
		try {
			const { goldenPrices } = await import("../../../shared/schema");
			const { desc, or, eq, and } = await import("drizzle-orm");
			const gpRows = await db.select({ price: goldenPrices.price })
				.from(goldenPrices)
				.where(and(
					or(
						eq(goldenPrices.symbol, "MCX_GOLD"),
						eq(goldenPrices.symbol, "COMEX_GOLD"),
					),
					eq(goldenPrices.assetClass, "commodity"),
				))
				.orderBy(desc(goldenPrices.priceDate))
				.limit(1);
			if (gpRows.length > 0 && gpRows[0].price) {
				const goldPriceRaw = Number.parseFloat(gpRows[0].price);
				if (goldPriceRaw > 40000) return Math.round((goldPriceRaw / 10) * 10) / 10;
			}
		} catch { /* non-fatal */ }

		return null;
	}

	/**
	 * Builds a synthetic SGB pick when no active SGB tranches exist in the DB.
	 * Uses gold spot price from commodity_prices, or a benchmark price if unavailable.
	 * The synthetic pick represents the SGB series concept with current gold NAV pricing.
	 */
	private async buildSyntheticSgbPick(
		context: StrategyContext,
	): Promise<DailyPickData | null> {
		let goldPrice: number | null = null;

		// Tier 0: Authoritative Gold benchmark from Golden Pricing Engine (MCX & COMEX)
		try {
			const { goldenPricingEngine } = await import("../golden-pricing/GoldenPricingEngine");
			const bench = await goldenPricingEngine.getAuthoritativeCommodityBenchmarks();
			if (bench?.gold?.mcxPriceInr && bench.gold.mcxPriceInr > 40000) {
				goldPrice = Math.round((bench.gold.mcxPriceInr / 10) * 10) / 10;
			}
		} catch { /* proceed to DB / Yahoo */ }

		// Tier 1: Direct golden_prices query as SSOT fallback (replaces commodity_prices)
		if (!goldPrice) {
			try {
				const { goldenPrices } = await import("../../../shared/schema");
				const { desc, or, eq, and } = await import("drizzle-orm");
				const gpRows = await db.select({ price: goldenPrices.price, priceDate: goldenPrices.priceDate })
					.from(goldenPrices)
					.where(and(
						or(
							eq(goldenPrices.symbol, "MCX_GOLD"),
							eq(goldenPrices.symbol, "COMEX_GOLD"),
						),
						eq(goldenPrices.assetClass, "commodity"),
					))
					.orderBy(desc(goldenPrices.priceDate))
					.limit(1);
				if (gpRows.length > 0 && gpRows[0].price) {
					const priceVal = Number.parseFloat(gpRows[0].price);
					// Accept DB price only if reasonable (gold in INR > 40000/10g) and within 7 days
					const priceDate = gpRows[0].priceDate ? new Date(gpRows[0].priceDate) : null;
					const ageHours = priceDate ? (Date.now() - priceDate.getTime()) / 3600000 : 999;
					if (priceVal > 40000 && ageHours < 168) {
						goldPrice = Math.round((priceVal / 10) * 10) / 10;
					}
				}
			} catch { /* non-fatal */ }
		}

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
					// Persist to golden_prices (SSOT) for next lookup — no commodity_prices writes
					const today = new Date().toISOString().split("T")[0];
					db.execute(sql`
						INSERT INTO golden_prices (isin, symbol, asset_class, price, price_date, source, confidence_score, created_at, updated_at)
						VALUES ('COMEX_GOLD_USD', 'COMEX_GOLD', 'commodity', ${String(goldPrice)}, ${today}, 'yahoo_finance', 60, NOW(), NOW())
						ON CONFLICT (isin, price_date) DO UPDATE
						SET price = EXCLUDED.price, updated_at = NOW(), confidence_score = EXCLUDED.confidence_score
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
