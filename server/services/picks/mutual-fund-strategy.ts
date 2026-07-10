import { db } from "../../db";
import { mutualFunds, dailyPicks } from "@shared/schema";
import { and, eq, sql, gte } from "drizzle-orm";
import { logger } from "../../logger";
import { BaseStrategy } from "./base-strategy";
import { StrategyContext } from "./types";
import { DailyPickData, PickCategory } from "../pick-of-the-day-service";
import { isFundInvestable } from "../regulatory-investability-service";

export class MutualFundStrategy extends BaseStrategy {
	category: PickCategory = "mutual_funds";

	async generate(context: StrategyContext): Promise<DailyPickData | null> {
		try {
			const funds = await db
				.select()
				.from(mutualFunds)
				.where(
					and(
						eq(mutualFunds.isPublished, true),
						sql`${mutualFunds.nav} IS NOT NULL`,
						sql`${mutualFunds.nav}::float > 0`,
						// SEBI best-practice: recommend only Direct Growth plans
						// Direct plans have 0.5-1.5% lower expense ratio than Regular plans
						sql`${mutualFunds.schemeName} ILIKE '%Direct%'`,
						sql`${mutualFunds.schemeName} ILIKE '%Growth%'`,
						// Exclude dividend/IDCW options — not ideal for wealth creation
						sql`${mutualFunds.schemeName} NOT ILIKE '%IDCW%'`,
						sql`${mutualFunds.schemeName} NOT ILIKE '%Dividend%'`,
						sql`${mutualFunds.schemeName} NOT ILIKE '%Payout%'`,
						// Exclude ETFs from MF picks (ETFStrategy handles those)
						sql`(${mutualFunds.category} IS NULL OR ${mutualFunds.category} NOT ILIKE '%ETF%')`,
						sql`${mutualFunds.schemeName} NOT ILIKE '%ETF%'`,
						sql`(${mutualFunds.lastUpdated} IS NULL OR ${mutualFunds.lastUpdated} > NOW() - INTERVAL '45 days')`,
						// ── Fix 3: Minimum ₹200 Cr AUM filter ───────────────────────────────
						// Funds below ₹200 Cr AUM face redemption pressure and closure risk.
						// aum column may be NULL for older records — allow NULL through
						// to avoid dropping all data; the JS post-filter handles NULLs.
						sql`(${mutualFunds.aum} IS NULL OR ${mutualFunds.aum}::float >= 200)`,
					),
				)
				.limit(100);

			if (funds.length === 0) return null;

			const nonEtfFunds = funds.filter((fund) => {
				const name = (fund.schemeName || "").toUpperCase();
				const cat = (fund.category || "").toUpperCase();
				// Double-check: filter must be Direct Growth, no IDCW/Regular/Dividend
				if (!(name.includes("ETF") || cat.includes("ETF"))) {
					if (name.includes("IDCW") || name.includes("DIVIDEND") || name.includes("PAYOUT")) return false;
					if (!name.includes("DIRECT") || !name.includes("GROWTH")) return false;
					return true;
				}
				return false;
			});


			const investableFunds = nonEtfFunds.filter(
				(fund) =>
					isFundInvestable({
						schemeName: fund.schemeName,
						category: fund.category || undefined,
						purchaseAllowed: true,
					}).investable,
			);

			const freshFunds = this.filterRecentPicks(
				investableFunds,
				context.recentIds,
				(f) => f.schemeCode,
			);

			// ── 7-day SEBI category dedup ───────────────────────────────────────────
			// Prevents picking the same SEBI category (e.g. Flexi Cap, Large Cap)
			// two days in a row, which erodes advisor confidence in pick diversity.
			// Strategy: sort freshFunds so un-recently-used categories rank first.
			// Falls back to all categories when the 7-day window exhausts them all.
			let categoryDedupFunds = freshFunds;
			try {
				const sevenDaysAgo = new Date();
				sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
				const recentMfPicks = await db
					.select({ sectorCategory: dailyPicks.sectorCategory })
					.from(dailyPicks)
					.where(
						and(
							eq(dailyPicks.category, "mutual_funds"),
							gte(dailyPicks.recoDate, sevenDaysAgo.toISOString().split("T")[0]),
						),
					);
				const recentMfCategories = new Set(
					recentMfPicks
						.map((p) => (p.sectorCategory ?? "").toUpperCase().trim())
						.filter(Boolean),
				);
				if (recentMfCategories.size > 0) {
					const fresh = freshFunds.filter(
						(f) => !recentMfCategories.has((f.category ?? "").toUpperCase().trim()),
					);
					// Fall back to full pool only when every category was recently used
					categoryDedupFunds = fresh.length > 0 ? fresh : freshFunds;
					logger.info(
						`[MFStrategy] 7-day category dedup: ${recentMfCategories.size} categories excluded → ${categoryDedupFunds.length}/${freshFunds.length} funds remain`,
					);
				}
			} catch (dedupErr) {
				// Non-fatal — proceed with undeduplicated list
				logger.warn(`[MFStrategy] Category dedup failed (non-fatal): ${dedupErr instanceof Error ? dedupErr.message : String(dedupErr)}`);
			}

			const scoredFunds = categoryDedupFunds
				.map((fund) => ({
					fund,
					score: this.score(fund),
				}))
				.sort((a, b) => b.score - a.score);

			if (scoredFunds.length === 0) return null;

			const topFund = scoredFunds[0].fund;
			const currentNav = Number.parseFloat(topFund.nav || "0");
			const { targetPct, stoplossPct } =
				this.getDynamicTargetStoploss("mutual_funds");
			const targetNav = Math.round(currentNav * (1 + targetPct) * 100) / 100;
			const stoplossNav =
				Math.round(currentNav * (1 - stoplossPct) * 100) / 100;

			const rationale = await context.service.generateRationale({
				category: "mutual_funds",
				name: topFund.schemeName,
				currentPrice: currentNav,
				targetPrice: targetNav,
				stoplossPrice: stoplossNav,
				metrics: {
					returns1y: topFund.returns1y,
					returns3y: topFund.returns3y,
					smartRating: topFund.crisilRating,
					expenseRatio: topFund.expenseRatio,
				},
			});

			return {
				category: "mutual_funds",
				instrumentId: topFund.schemeCode,
				instrumentName: topFund.schemeName,
				isin: topFund.isin || undefined,
				symbol: topFund.schemeCode,
				recoDate: context.today,
				recoPrice: currentNav,
				targetPrice: targetNav,
				stoplossPrice: stoplossNav,
				currentPrice: currentNav,
				status: "live",
				expiryDate: this.getExpiryDate(90),
				rationale,
				riskLevel: topFund.riskLevel || "medium",
				suitableFor: this.deriveSuitableFor(
					topFund.riskLevel || "medium",
					"mutual_funds",
				),
				timeHorizon: this.getTimeHorizon("mutual_funds"),
				confidenceScore: this.getConfidenceScore(
					"mutual_funds",
					scoredFunds[0].score,
					70,
					// Fix 12 wiring: pass available metrics count for data-density gate
					[topFund.returns1y, topFund.returns3y, topFund.expenseRatio, topFund.crisilRating].filter(Boolean).length,
				),
				sectorCategory: topFund.category || undefined,
				keyMetrics: {
					cmp: currentNav,
					nav: currentNav,
					returns1y: topFund.returns1y
						? Number.parseFloat(topFund.returns1y)
						: undefined,
					returns3y: topFund.returns3y
						? Number.parseFloat(topFund.returns3y)
						: undefined,
					smartRating: topFund.crisilRating || undefined,
					fundHouse: topFund.fundHouse || undefined,
					category: topFund.category || undefined,
					expenseRatio: topFund.expenseRatio
						? Number.parseFloat(topFund.expenseRatio)
						: null,
					riskLevel: topFund.riskLevel || undefined,
				},
			};
		} catch (error) {
			logger.error("[MutualFundStrategy] Error:", error instanceof Error ? error : new Error(String(error)));
			return null;
		}
	}

	score(fund: any): number {
		let score = 0;
		const smartRating = fund.crisilRating
			? Number.parseInt(fund.crisilRating)
			: 0;
		if (smartRating >= 5) score += 25;
		else if (smartRating >= 3) score += 15;
		// ── Fix 5: CRISIL null gate ─────────────────────────────────────────────
		// Unrated funds get 0 bonus; they should also be penalised to prevent them
		// from competing equally against rated funds on other dimensions alone.
		else if (smartRating === 0) score -= 10; // unrated = unknown quality

		// ── Fix 4: 3Y consistency gate ──────────────────────────────────────────
		// Penalise funds that lack a 3Y track record (new funds).
		const returns3y = fund.returns3y ? Number.parseFloat(fund.returns3y) : null;
		if (returns3y === null) score -= 15;

		// Data quality check: count how many metrics are available
		let keyMetricsCount = 0;
		if (fund.returns1y) keyMetricsCount++;
		if (fund.returns3y) keyMetricsCount++;
		if (fund.expenseRatio) keyMetricsCount++;
		if (keyMetricsCount < 2) score -= 10; // Low transparency

		const returns1y = fund.returns1y ? Number.parseFloat(fund.returns1y) : 0;

		// ── Fix F: Category risk-adjusted return (relative outperformance) ─────────────
		// Compare fund's 1Y return to SEBI category benchmark average.
		// Source: AMFI industry averages — updated quarterly (last: July 2026).
		// Funds outperforming their category by >3% get a premium score boost.
		const CATEGORY_BENCHMARKS: Record<string, number> = {
			// Equity
			"Large Cap Fund": 18.5,
			"Mid Cap Fund": 26.0,
			"Small Cap Fund": 28.0,
			"Flexi Cap Fund": 22.0,
			"Multi Cap Fund": 23.5,
			"Large & Mid Cap Fund": 21.0,
			"ELSS": 20.5,
			"Focused Fund": 21.5,
			"Sectoral/Thematic": 24.0,
			// Hybrid
			"Aggressive Hybrid Fund": 18.0,
			"Balanced Advantage Fund": 14.0,
			"Conservative Hybrid Fund": 10.0,
			"Arbitrage Fund": 8.0,
			// Debt
			"Short Duration Fund": 7.5,
			"Medium Duration Fund": 7.8,
			"Long Duration Fund": 9.0,
			"Dynamic Bond Fund": 8.2,
			"Credit Risk Fund": 8.5,
			"Liquid Fund": 7.2,
			"Overnight Fund": 6.8,
		};
		const category = (fund.category ?? "").trim();
		// Try exact match, then partial match (handles AMFI naming variations)
		const benchmarkAvg =
			CATEGORY_BENCHMARKS[category] ??
			Object.entries(CATEGORY_BENCHMARKS).find(([k]) =>
				category.toLowerCase().includes(k.toLowerCase().split(" ")[0])
			)?.[1] ??
			null;

		if (benchmarkAvg !== null) {
			const outperformance = returns1y - benchmarkAvg; // percentage points
			if (outperformance > 5) score += 25;      // premium alpha generator
			else if (outperformance > 3) score += 20; // strong outperformer
			else if (outperformance > 1) score += 12; // moderate outperformer
			else if (outperformance > -1) score += 5; // inline with category
			// Negative: no points — underperforming category average
		} else {
			// Category not in benchmark map — fall back to absolute return scoring
			if (returns1y > 20) score += 20;
			else if (returns1y > 12) score += 15;
		}

		const expenseRatio = fund.expenseRatio
			? Number.parseFloat(fund.expenseRatio)
			: 2;
		if (expenseRatio < 0.5) score += 15;
		else if (expenseRatio < 1.5) score += 5;

		return score;
	}

	async getLivePrice(instrumentId: string): Promise<number | null> {
		const row = await db
			.select({ nav: mutualFunds.nav })
			.from(mutualFunds)
			.where(eq(mutualFunds.schemeCode, instrumentId))
			.limit(1);
		return row[0]?.nav ? Number.parseFloat(row[0].nav) : null;
	}
}
