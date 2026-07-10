import { db } from "../../db";
import { bondCatalog } from "@shared/schema";
import { and, sql } from "drizzle-orm";
import { logger } from "../../logger";
import { BaseStrategy } from "./base-strategy";
import { StrategyContext } from "./types";
import { DailyPickData, PickCategory } from "../pick-of-the-day-service";

// ── Fix H: G-Sec 10Y benchmark yield — FBIL primary, RBI secondary ─────────────
// Primary:  FBIL daily benchmark page (fbil.org.in) — the authoritative India rate
// Secondary: RBI press-release feed (rbi.org.in) for yield data
// Fallback:  7.1% (repo 6.5% + ~60bps term premium, updated July 2026)
let _gSecYieldCache: { value: number | null; ts: number } = { value: null, ts: 0 };
const GSEC_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Attempts to parse the 10Y G-Sec yield from FBIL's benchmark page.
 * FBIL publishes "FBIL-ZCYC" (zero coupon yield curve) — we extract the 10Y point.
 */
async function fetchFBILYield(): Promise<number | null> {
	try {
		const url = "https://fbil.org.in/api/benchmarks/FBIL-ZCYC";
		const res = await fetch(url, {
			headers: { "Accept": "application/json", "User-Agent": "FintekPro/3.0 Research-Tool" },
			signal: AbortSignal.timeout(6000),
		});
		if (!res.ok) return null;
		const json = await res.json() as any;
		// FBIL ZCYC response: { data: [{ tenor: "10Y", rate: "7.12", ... }] }
		const tenors: any[] = json?.data ?? json?.rates ?? [];
		const ten = tenors.find((t: any) => String(t.tenor ?? t.maturity ?? "").includes("10"));
		const rate = ten ? Number.parseFloat(ten.rate ?? ten.yield ?? ten.value) : NaN;
		return rate > 4 && rate < 16 ? Math.round(rate * 100) / 100 : null;
	} catch {
		return null;
	}
}

/**
 * Returns the current India 10Y G-Sec yield in percent.
 * Triggers a background refresh daily. Non-fatal — defaults to 7.1% on failure.
 */
function getGSec10YYield(): number {
	if (
		_gSecYieldCache.value !== null &&
		Date.now() - _gSecYieldCache.ts < GSEC_CACHE_TTL_MS
	) {
		return _gSecYieldCache.value;
	}
	// Background refresh — non-blocking
	void (async () => {
		try {
			// Primary: FBIL benchmark API
			let yield10Y = await fetchFBILYield();

			// Secondary: Yahoo Finance (IN10Y.NS — India 10Y Government Bond)
			if (yield10Y === null) {
				const url = "https://query1.finance.yahoo.com/v8/finance/chart/IN10Y.NS?range=1d&interval=1d";
				const res = await fetch(url, {
					headers: { "User-Agent": "Mozilla/5.0" },
					signal: AbortSignal.timeout(5000),
				});
				if (res.ok) {
					const json = await res.json() as any;
					const closes: number[] =
						json?.chart?.result?.[0]?.indicators?.adjclose?.[0]?.adjclose ?? [];
					const last = closes.findLast((c: number) => c != null);
					if (last && last > 4 && last < 16) {
						yield10Y = Math.round(last * 100) / 100;
					}
				}
			}

			if (yield10Y !== null) {
				_gSecYieldCache = { value: yield10Y, ts: Date.now() };
				logger.info(`[BondStrategy] G-Sec 10Y refreshed (FBIL/Yahoo): ${yield10Y}%`);
			}
		} catch {
			// Non-fatal — cache retains previous value or defaults below
		}
	})();
	return _gSecYieldCache.value ?? 7.1; // fallback: RBI repo 6.5% + ~60bps term premium
}


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

			// ── Fix 8: Issuer concentration gate ──────────────────────────────────────────
			// Fetch last 7 days of bond picks, extract issuer names.
			// Penalise any candidate that shares an issuer with a recent pick.
			// Non-fatal: if DB fails, proceed without concentration check.
			const recentBondIssuers = new Set<string>();
			try {
				const { dailyPicks } = await import("@shared/schema");
				const { gte, eq } = await import("drizzle-orm");
				const sevenDaysAgo = new Date();
				sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
				const recentBondPicks = await db
					.select({ keyMetrics: dailyPicks.keyMetrics })
					.from(dailyPicks)
					.where(
						and(
							eq(dailyPicks.category, "bonds"),
							gte(dailyPicks.recoDate, sevenDaysAgo.toISOString().split("T")[0]),
						),
					);
				for (const p of recentBondPicks) {
					const km = p.keyMetrics as Record<string, any> | null;
					if (km?.issuerName) recentBondIssuers.add(String(km.issuerName).toLowerCase());
					if (km?.issuerType) recentBondIssuers.add(String(km.issuerType).toLowerCase());
				}
			} catch {
				// Non-fatal — proceed without issuer dedup
			}

			const scoredBonds = freshBonds
				.map((bond) => {
					let s = this.score(bond);
					// Fix 8: penalise if issuer was recently recommended
					const issuerLower = (bond.issuerName || "").toLowerCase();
					const issuerType = this.detectIssuerType(bond.issuerName);
					if (
						(issuerLower && recentBondIssuers.has(issuerLower)) ||
						(issuerType !== "corporate" && recentBondIssuers.has(issuerType))
					) {
						s -= 20; // issuer concentration penalty
					}
					return { bond, score: s };
				})
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
			logger.error("[BondStrategy] Error:", error instanceof Error ? error : new Error(String(error)));
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

		// Duration preference (2-5 yr optimal)
		const yrs = durationYears(bond.maturityDate);
		if (yrs !== null) {
			if (yrs >= 2 && yrs <= 5) score += 8;
			else if (yrs > 5 && yrs <= 10) score += 4;
			else if (yrs > 10) score -= 5; // long-duration interest rate risk
		}

		// ── Fix 3: G-Sec spread signal ───────────────────────────────────────────
		// Penalise yield traps (inadequate spread for credit risk).
		// Reward bonds with generous risk-adjusted compensation over the benchmark.
		if (ytm > 0) {
			score += this.gSecSpreadScore(rating, ytm);
		}

		return score;
	}

	/**
	 * G-Sec minimum spread requirements by credit tier.
	 * Below minimum = yield trap (too much credit risk for too little compensation).
	 * Above double the minimum = generous spread (quality pick signal).
	 *
	 * @param rating  Credit rating string from bondCatalog
	 * @param ytm     Bond YTM in percent
	 * @returns Score delta (positive for generous spread, negative for yield trap)
	 */
	private gSecSpreadScore(rating: string, ytm: number): number {
		const gsec = getGSec10YYield();
		const spread = ytm - gsec; // in percentage points

		// Minimum spread requirements by credit tier (in bps, expressed as %)
		const ratingUpper = rating.toUpperCase();
		let minSpread: number;
		if (ratingUpper.includes("AAA") || ratingUpper.includes("SOV")) {
			minSpread = 0.40; // 40 bps
		} else if (ratingUpper.startsWith("AA")) {
			minSpread = 1.00; // 100 bps
		} else {
			minSpread = 1.80; // 180 bps for A and below
		}

		if (spread < 0) return -20;               // YTM below G-Sec — never recommend
		if (spread < minSpread) return -10;        // Yield trap: inadequate compensation
		if (spread >= minSpread * 2) return +12;   // Generous spread: quality pick
		if (spread >= minSpread) return +5;        // Adequate spread
		return 0;
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
		const { eq, desc } = await import("drizzle-orm");
		const { goldenPrices } = await import("@shared/schema");

		// Tier 1: cleanPrice from bondCatalog (updated by enrichment scheduler)
		const row = await db
			.select({ cleanPrice: bondCatalog.cleanPrice, isin: bondCatalog.isin })
			.from(bondCatalog)
			.where(eq(bondCatalog.id, instrumentId))
			.limit(1);

		const cleanPrice = row[0]?.cleanPrice;
		if (cleanPrice && Number.parseFloat(cleanPrice) > 0) {
			return Number.parseFloat(cleanPrice);
		}

		// Tier 2: goldenPrices by ISIN — exchange-cleared closing prices
		const isin = row[0]?.isin;
		if (isin) {
			const gpRow = await db
				.select({ price: goldenPrices.price })
				.from(goldenPrices)
				.where(eq(goldenPrices.isin, isin))
				.orderBy(desc(goldenPrices.priceDate))
				.limit(1);
			if (gpRow[0]?.price && Number.parseFloat(gpRow[0].price) > 0) {
				return Number.parseFloat(gpRow[0].price);
			}
		}

		return null;
	}
}
