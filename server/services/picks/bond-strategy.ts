import { db } from "../../db";
import { bondCatalog } from "@shared/schema";
import { and, sql } from "drizzle-orm";
import { BaseStrategy } from "./base-strategy";
import { StrategyContext } from "./types";
import { DailyPickData, PickCategory } from "../pick-of-the-day-service";

/**
 * Maps a credit rating string to a risk level.
 * AAA / Sovereign / G-Sec → low
 * AA+/AA/AA- → medium
 * A+ and below → high
 */
function ratingToRiskLevel(rating: string | null | undefined): string {
	if (!rating) return "medium";
	const r = rating.toUpperCase().trim();
	if (
		r.includes("AAA") ||
		r.includes("SOV") ||
		r.includes("G-SEC") ||
		r.includes("GSEC")
	)
		return "low";
	if (r.startsWith("AA")) return "medium";
	return "high"; // A+, A, BBB, etc.
}

/**
 * Returns duration bucket in years from maturity date string.
 * Used for scoring preference: 2-5 years (sweet spot), avoid < 6 months.
 */
function durationYears(maturityDate: string | null | undefined): number | null {
	if (!maturityDate) return null;
	try {
		const maturity = new Date(maturityDate);
		const now = new Date();
		return (
			(maturity.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 365.25)
		);
	} catch {
		return null;
	}
}

export class BondStrategy extends BaseStrategy {
	category: PickCategory = "bonds";

	async generate(context: StrategyContext): Promise<DailyPickData | null> {
		try {
			const sixMonthsFromNow = new Date();
			sixMonthsFromNow.setMonth(sixMonthsFromNow.getMonth() + 6);

			const bonds = await db
				.select()
				.from(bondCatalog)
				.where(
					and(
						sql`${bondCatalog.cleanPrice} IS NOT NULL`,
						sql`${bondCatalog.cleanPrice}::numeric > 0`,
						sql`${bondCatalog.yieldToMaturity} IS NOT NULL`,
						// Phase 1 fix: exclude bonds maturing within 6 months
						sql`(${bondCatalog.maturityDate} IS NULL OR ${bondCatalog.maturityDate} > ${sixMonthsFromNow.toISOString().split("T")[0]}::date)`,
					),
				)
				.limit(50);

			if (bonds.length === 0) return null;

			const freshBonds = this.filterRecentPicks(
				bonds,
				context.recentIds,
				(b) => b.id,
			);
			const scoredBonds = freshBonds
				.map((bond) => ({
					bond,
					score: this.score(bond),
				}))
				.sort((a, b) => b.score - a.score);

			if (scoredBonds.length === 0) return null;

			const topBond = scoredBonds[0].bond;
			const currentPrice = Number.parseFloat(topBond.cleanPrice || "0");
			const ytm = topBond.yieldToMaturity
				? Number.parseFloat(topBond.yieldToMaturity)
				: null;
			const coupon = topBond.couponRate
				? Number.parseFloat(topBond.couponRate)
				: null;
			const rating = topBond.creditRating ?? undefined;
			const maturityYears = durationYears(topBond.maturityDate);

			// Phase 1 fix: derive target/stoploss correctly for bonds.
			// Instead of ±% price move, represent the YTM-based return.
			// Hold-to-maturity return = YTM. Capital appreciation target is small (±2% for bonds).
			const { targetPct, stoplossPct } = this.getDynamicTargetStoploss("bonds");
			const targetPrice =
				Math.round(currentPrice * (1 + targetPct) * 100) / 100;
			const stoplossPrice =
				Math.round(currentPrice * (1 - stoplossPct) * 100) / 100;

			const riskLevel = ratingToRiskLevel(rating);

			// Phase 1 fix: generate AI rationale (was empty string before)
			const rationale = await context.service.generateRationale({
				category: "bonds",
				name: topBond.issuerName || topBond.isin,
				currentPrice,
				targetPrice,
				stoplossPrice,
				metrics: {
					ytm,
					coupon,
					rating,
					maturityYears: maturityYears
						? Math.round(maturityYears * 10) / 10
						: undefined,
					issuerType: this.detectIssuerType(topBond.issuerName),
				},
			});

			return {
				category: "bonds",
				instrumentId: topBond.id,
				instrumentName: topBond.issuerName || topBond.isin,
				isin: topBond.isin,
				symbol: topBond.isin,
				recoDate: context.today,
				recoPrice: currentPrice,
				targetPrice,
				stoplossPrice,
				currentPrice,
				status: "live",
				expiryDate: this.getExpiryDate(365),
				rationale,
				riskLevel, // Phase 1 fix: derived from credit rating, not hardcoded 'low'
				suitableFor: this.deriveSuitableFor(riskLevel, "bonds"),
				timeHorizon: this.getTimeHorizon("bonds"),
				confidenceScore: this.getConfidenceScore(
					"bonds",
					scoredBonds[0].score,
					60,
				),
				sectorCategory: "Fixed Income",
				keyMetrics: {
					ytm,
					coupon,
					rating,
					maturity: topBond.maturityDate,
					maturityYears: maturityYears
						? Math.round(maturityYears * 10) / 10
						: null,
					issuerType: this.detectIssuerType(topBond.issuerName),
				},
			};
		} catch (error) {
			// eslint-disable-next-line no-console
			console.error("[BondStrategy] Error:", error);
			return null;
		}
	}

	/**
	 * Bond scoring:
	 * - YTM (primary signal): higher = better, calibrated to RBI policy rate environment
	 * - Credit rating: AAA=25, AA=20 (don't sacrifice quality for yield)
	 * - Issuer type: PSU/Sovereign safe-haven premium
	 * - Duration preference: 2-5 yr sweet spot (+5), avoid > 10 yr duration risk
	 */
	score(bond: any): number {
		let score = 0;

		// YTM score — calibrated to ~7% RBI repo environment
		const ytm = bond.yieldToMaturity
			? Number.parseFloat(bond.yieldToMaturity)
			: 0;
		if (ytm > 10) score += 25;
		else if (ytm > 8.5) score += 20;
		else if (ytm > 7.15) score += 12;
		else if (ytm > 6.5) score += 6;

		// Credit rating score
		const rating = (bond.creditRating || "").toUpperCase();
		if (rating.includes("AAA") || rating.includes("SOV")) score += 25;
		else if (rating.includes("AA")) score += 20;
		else if (rating.includes("A+") || rating.includes("A ")) score += 10;

		// Phase 1 fix: issuer type premium
		const issuerType = this.detectIssuerType(bond.issuerName);
		if (issuerType === "sovereign" || issuerType === "psu") score += 10;
		else if (issuerType === "nbfc") score += 5;

		// Phase 1 fix: duration preference (2-5 yr optimal)
		const yrs = durationYears(bond.maturityDate);
		if (yrs !== null) {
			if (yrs >= 2 && yrs <= 5) score += 8;
			else if (yrs > 5 && yrs <= 10) score += 4;
			else if (yrs > 10) score -= 5; // long-duration interest rate risk
		}

		return score;
	}

	/** Classify issuer type from name for scoring and display. */
	private detectIssuerType(
		name: string | null | undefined,
	): "sovereign" | "psu" | "nbfc" | "corporate" {
		if (!name) return "corporate";
		const lower = name.toLowerCase();
		if (
			lower.includes("government") ||
			lower.includes("g-sec") ||
			lower.includes("rbi") ||
			lower.includes("india bond")
		)
			return "sovereign";
		if (
			lower.includes("nhai") ||
			lower.includes("ntpc") ||
			lower.includes("power finance") ||
			lower.includes("rec ") ||
			lower.includes("nabard") ||
			lower.includes("irfc") ||
			lower.includes("hudco") ||
			lower.includes("pfc") ||
			lower.includes("bharat") ||
			lower.includes("nhpc") ||
			lower.includes("iifcl")
		)
			return "psu";
		if (
			lower.includes("nbfc") ||
			lower.includes("finance") ||
			lower.includes("capital") ||
			lower.includes("housing")
		)
			return "nbfc";
		return "corporate";
	}

	async getLivePrice(instrumentId: string): Promise<number | null> {
		const { eq } = await import("drizzle-orm");
		const row = await db
			.select({ cleanPrice: bondCatalog.cleanPrice })
			.from(bondCatalog)
			.where(eq(bondCatalog.id, instrumentId))
			.limit(1);
		return row[0]?.cleanPrice ? Number.parseFloat(row[0].cleanPrice) : null;
	}
}
