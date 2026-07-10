import { db } from "../../db";
import { instrumentMaster } from "@shared/schema";
import { and, eq, sql } from "drizzle-orm";
import { BaseStrategy } from "./base-strategy";
import { StrategyContext } from "./types";
import { DailyPickData, PickCategory } from "../pick-of-the-day-service";
import { logger } from "../../logger";


/** Detect ETF type from name for accurate sectorCategory display. */
function detectEtfType(name: string | null | undefined): string {
	if (!name) return "Index ETF";
	const lower = name.toLowerCase();
	if (lower.includes("gold") || lower.includes("silver"))
		return "Commodity ETF";
	if (lower.includes("bank") || lower.includes("banking")) return "Banking ETF";
	if (
		lower.includes("it") ||
		lower.includes("tech") ||
		lower.includes("nifty it")
	)
		return "Technology ETF";
	if (lower.includes("pharma") || lower.includes("health"))
		return "Healthcare ETF";
	if (
		lower.includes("nifty next") ||
		lower.includes("midcap") ||
		lower.includes("mid cap")
	)
		return "Midcap ETF";
	if (lower.includes("smallcap") || lower.includes("small cap"))
		return "Smallcap ETF";
	if (
		lower.includes("international") ||
		lower.includes("nasdaq") ||
		lower.includes("us ") ||
		lower.includes("global")
	)
		return "International ETF";
	if (
		lower.includes("liquid") ||
		lower.includes("overnight") ||
		lower.includes("money market")
	)
		return "Liquid ETF";
	if (
		lower.includes("nifty 50") ||
		lower.includes("sensex") ||
		lower.includes("nifty50")
	)
		return "Nifty 50 ETF";
	if (lower.includes("nifty 100") || lower.includes("nifty100"))
		return "Large Cap ETF";
	return "Index ETF";
}

/**
 * Phase 1 fix: Score ETFs using real signals instead of hardcoded 65.
 *
 * Signals:
 *  - AUM proxy (lastPrice × volume — use lastPrice > 100 as large/liquid heuristic)
 *  - ETF type preference: Nifty 50 / Large Cap = most liquid, Liquid = excluded
 *  - Expense ratio (lower = better)
 *  - 1Y / 3Y return tracking (if available from issuer data or metrics)
 */
function scoreETF(etf: any): number {
	let score = 0;

	const etfType = detectEtfType(etf.name);

	// Type scoring — prefer broad, liquid, low-cost index ETFs
	if (etfType === "Nifty 50 ETF") score += 25;
	else if (etfType === "Large Cap ETF") score += 20;
	else if (etfType === "Midcap ETF") score += 15;
	else if (etfType === "Banking ETF") score += 15;
	else if (etfType === "Technology ETF") score += 15;
	else if (etfType === "Healthcare ETF") score += 12;
	else if (etfType === "Commodity ETF") score += 12;
	else if (etfType === "International ETF") score += 10;
	else if (etfType === "Smallcap ETF") score += 10;
	else if (etfType === "Index ETF") score += 8;
	else if (etfType === "Liquid ETF") score -= 20; // not suitable as a "pick"

	// Price-based liquidity proxy: higher-priced ETFs tend to be more established
	const price = Number.parseFloat(etf.lastPrice || "0");
	if (price > 500) score += 10;
	else if (price > 100) score += 6;
	else if (price > 20) score += 3;

	// Expense ratio (lower = better)
	const expenseRatio = Number.parseFloat(etf.expenseRatio || etf.ter || "1.0");
	if (expenseRatio < 0.1) score += 15;
	else if (expenseRatio < 0.3) score += 10;
	else if (expenseRatio < 0.5) score += 6;
	else if (expenseRatio > 1.0) score -= 5;

	// Known reputable issuers
	const issuer = (etf.issuer || "").toLowerCase();
	if (
		issuer.includes("nippon") ||
		issuer.includes("sbi") ||
		issuer.includes("hdfc") ||
		issuer.includes("icici") ||
		issuer.includes("kotak") ||
		issuer.includes("axis") ||
		issuer.includes("mirae")
	)
		score += 5;

	// ── Fix 6: Premium/discount to iNAV check ──────────────────────────────────
	// iNAV (intraday NAV) tracks the real-time fair value of an ETF.
	// Recommending an ETF trading at a large premium = advisors buy above fair value.
	// Threshold: >0.5% premium → score penalty to discourage the pick.
	//            >0.3% discount → small bonus (rare buy-below-NAV opportunity).
	if (etf.inav && etf.lastPrice) {
		const inavVal = Number.parseFloat(etf.inav);
		const marketPrice = Number.parseFloat(etf.lastPrice);
		if (inavVal > 0 && marketPrice > 0) {
			const premiumPct = ((marketPrice - inavVal) / inavVal) * 100;
			if (premiumPct > 1.0) score -= 20;      // expensive premium: >1% above NAV
			else if (premiumPct > 0.5) score -= 10; // moderate premium: 0.5-1%
			else if (premiumPct < -0.3) score += 5; // buying at discount (rare opportunity)
		}
	}

	return Math.max(score, 1);
}

export class ETFStrategy extends BaseStrategy {
	category: PickCategory = "etfs";

	async generate(context: StrategyContext): Promise<DailyPickData | null> {
		try {
			const etfs = await db
				.select()
				.from(instrumentMaster)
				.where(
					and(
						eq(instrumentMaster.assetClass, "etf"),
						sql`${instrumentMaster.lastPrice} IS NOT NULL`,
						sql`${instrumentMaster.lastPrice}::numeric > 0`,
						// Phase 1 fix: exclude liquid/overnight ETFs (not suitable investment picks)
						sql`${instrumentMaster.name} NOT ILIKE '%liquid%'`,
						sql`${instrumentMaster.name} NOT ILIKE '%overnight%'`,
						// ── Fix 7: Minimum daily volume filter ────────────────────────────────
						// ETFs with < 50K daily volume are illiquid — wide bid-ask spreads.
						// Uses raw SQL column name (volume not in Drizzle schema) — NULL-safe.
						sql`(volume IS NULL OR volume::bigint >= 50000)`,
					),
				)
				.limit(50);

			if (etfs.length === 0) return null;

			// Phase 1 fix: filterRecentPicks was completely missing before
			const freshEtfs = this.filterRecentPicks(
				etfs,
				context.recentIds,
				(e) => e.id,
			);

			// Phase 1 fix: score all candidates (previously always picked etfs[0])
			const scored = freshEtfs
				.map((etf) => ({ etf, score: scoreETF(etf) }))
				.sort((a, b) => b.score - a.score);

			if (scored.length === 0) return null;

			const { etf: topEtf, score: topScore } = scored[0];
			const currentPrice = Number.parseFloat(topEtf.lastPrice || "0");
			if (currentPrice <= 0) return null;

			const etfType = detectEtfType(topEtf.name);
			const { targetPct, stoplossPct } = this.getDynamicTargetStoploss("etfs");
			const targetPrice =
				Math.round(currentPrice * (1 + targetPct) * 100) / 100;
			const stoplossPrice =
				Math.round(currentPrice * (1 - stoplossPct) * 100) / 100;

			const expenseRatio =
				(topEtf as any).expenseRatio ?? (topEtf as any).ter ?? null;

			const rationale = await context.service.generateRationale({
				category: "etfs",
				name: topEtf.name,
				currentPrice,
				targetPrice,
				stoplossPrice,
				metrics: {
					etfType,
					issuer: topEtf.issuer || undefined,
					expenseRatio: expenseRatio
						? Number.parseFloat(expenseRatio)
						: undefined,
				},
			});

			// Phase 1 fix: riskLevel based on ETF type (not hardcoded 'medium')
			const riskLevel =
				etfType === "Commodity ETF" ||
				etfType === "International ETF" ||
				etfType === "Smallcap ETF"
					? "high"
					: etfType === "Nifty 50 ETF" ||
							etfType === "Large Cap ETF" ||
							etfType === "Liquid ETF"
						? "low"
						: "medium";

			return {
				category: "etfs",
				instrumentId: topEtf.id,
				instrumentName: topEtf.name,
				symbol: topEtf.symbol || undefined,
				exchange: "NSE",
				recoDate: context.today,
				recoPrice: currentPrice,
				targetPrice,
				stoplossPrice,
				currentPrice,
				status: "live",
				expiryDate: this.getExpiryDate(180),
				rationale,
				riskLevel,
				suitableFor: this.deriveSuitableFor(riskLevel, "etfs"),
				timeHorizon: this.getTimeHorizon("etfs"),
				confidenceScore: this.getConfidenceScore("etfs", topScore, 65),
				sectorCategory: etfType, // Phase 1 fix: dynamic, not hardcoded 'Index ETF'
				keyMetrics: {
					lastPrice: currentPrice,
					issuer: topEtf.issuer || undefined,
					etfType,
					expenseRatio: expenseRatio ? Number.parseFloat(expenseRatio) : null,
				},
			};
		} catch (error) {
			logger.error("[ETFStrategy] Error:", error instanceof Error ? error : new Error(String(error)));
			return null;
		}
	}

	/** Delegates to the shared scoreETF function. */
	score(etf: any): number {
		return scoreETF(etf);
	}

	async getLivePrice(instrumentId: string): Promise<number | null> {
		const row = await db
			.select({ lastPrice: instrumentMaster.lastPrice })
			.from(instrumentMaster)
			.where(eq(instrumentMaster.id, instrumentId))
			.limit(1);
		return row[0]?.lastPrice ? Number.parseFloat(row[0].lastPrice) : null;
	}
}
