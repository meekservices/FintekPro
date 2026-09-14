/**
 * Pre-IPO Pick Strategy — EV-Enhanced (FASP-EV-v1.0)
 *
 * Purpose:  Selects investment picks from unlisted companies that are in the
 *           `pre_ipo` listing stage — i.e., companies that have filed DRHP or
 *           are expected to list within 6–24 months. These are categorised as
 *           `category = "pre_ipo"` in daily_picks.
 *
 * Picking logic (upgraded):
 *   1. Source: `unlisted_companies` table, filtered to `listing_stage = 'pre_ipo'`
 *   2. Exclude companies already picked in the last 7 days
 *   3. Fetch 5 years of yearwise P&L + balance sheet + cash flow (ascending)
 *   4. Compute Enterprise Value via FASP-EV-v1.0 (DCF + Comparables + Book Value)
 *   5. Score using EV discount-to-fair-value + sector premium + governance
 *   6. Emit pick with full EV breakdown in keyMetrics
 *
 * FASP-AI v1.0: All outputs include confidence_score, model_version, risk_level.
 * SEBI: Speculative, illiquid instruments. suitableFor = ["Aggressive"] only.
 */

import { db } from "../../db";
import { unlistedCompanies, companyRatios, companyFinancials, listedStocks } from "@shared/schema";
import { eq, asc, and } from "drizzle-orm";
import { BaseStrategy } from "./base-strategy";
import { StrategyContext } from "./types";
import {
	DailyPickData,
	PickCategory,
	ScoreBreakdown,
} from "../pick-of-the-day-service";
import { logger } from "../../logger";
import {
	calculateEnterpriseValue,
	type YearlyFinancial,
	type EVResult,
} from "@shared/enterprise-valuation";
import { unifiedStockPriceService } from "../unified-stock-price-service";

export class PreIpoStrategy extends BaseStrategy {
	/** Category key — must match the DB enum value added in schema-repairs */
	category: PickCategory = "pre_ipo";

	async generate(context: StrategyContext): Promise<DailyPickData | null> {
		try {
			// ── 1. Fetch active pre-IPO companies only ─────────────────────────
			const companies = await db
				.select()
				.from(unlistedCompanies)
				.where(
					and(
						eq(unlistedCompanies.status, "active"),
						// Strict Mutual Exclusivity Gate: ONLY pre-IPO companies.
						// companies that completed listing become status='inactive' via
						// InstrumentLifecycleManager.sweepPreIpoListings() — they are
						// excluded here by the status='active' check above.
						eq(unlistedCompanies.listingStage, "pre_ipo"),
					),
				)
				.limit(30);

			if (companies.length === 0) return null;

			// Guard: Fetch listed stock identifiers to strictly exclude any company that has graduated to listed (e.g. Swiggy)
			const listedRows = await db
				.select({
					symbol: listedStocks.symbol,
					companyName: listedStocks.companyName,
					isin: listedStocks.isin,
				})
				.from(listedStocks);

			const listedNames = new Set(
				listedRows.map((r) => r.companyName.toLowerCase().trim()),
			);
			const listedSymbols = new Set(
				listedRows.map((r) => r.symbol.toLowerCase().trim()),
			);
			const listedIsins = new Set(
				listedRows
					.filter((r) => r.isin)
					.map((r) => r.isin!.toLowerCase().trim()),
			);

			// ── 2. Exclude recently picked instruments & already-listed companies ──
			const freshCompanies = this.filterRecentPicks(
				companies,
				context.recentIds,
				(c) => c.id.toString(),
			).filter((c) => {
				const cName = c.name.toLowerCase().trim();
				if (listedNames.has(cName)) return false;
				if (listedSymbols.has(cName)) return false;
				if (c.isin && listedIsins.has(c.isin.toLowerCase().trim())) return false;
				return true;
			});

			if (freshCompanies.length === 0) return null;

			// ── 3. Score each company using EV-aware pre-IPO model ─────────────
			const scoredRaw = (
				await Promise.all(
					freshCompanies.map(async (company) => {
						// 5 years ascending — needed for CAGR and EV computation
						const ratios = await db
							.select()
							.from(companyRatios)
							.where(eq(companyRatios.companyId, company.id))
							.orderBy(asc(companyRatios.financialYear))
							.limit(5);

						const financials = await db
							.select()
							.from(companyFinancials)
							.where(eq(companyFinancials.companyId, company.id))
							.orderBy(asc(companyFinancials.financialYear))
							.limit(5);

						// Map DB rows to EV input format
						const yearlyData: YearlyFinancial[] = financials.map((f) => ({
							financialYear: f.financialYear,
							revenue: f.revenue ? parseFloat(String(f.revenue)) : null,
							ebitda: f.ebitda ? parseFloat(String(f.ebitda)) : null,
							pat: f.pat ? parseFloat(String(f.pat)) : null,
							netProfit: f.netProfit ? parseFloat(String(f.netProfit)) : null,
							freeCashFlow: f.freeCashFlow ? parseFloat(String(f.freeCashFlow)) : null,
							totalDebt: f.totalDebt ? parseFloat(String(f.totalDebt)) : null,
							networth: f.networth ? parseFloat(String(f.networth)) : null,
							cash: f.operatingCashFlow ? parseFloat(String(f.operatingCashFlow)) : null,
						}));

						let currentPrice = parseFloat(
							company.publishedBuyPrice || company.draftBuyPrice || "0",
						);

						// If price missing or 0, attempt to resolve via unified stock price (NSE / BSE fallback)
						if (!currentPrice || currentPrice <= 0 || Number.isNaN(currentPrice)) {
							try {
								const symCandidate = company.name.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
								const fetched = await unifiedStockPriceService.getPrice(symCandidate, "NSE");
								if (fetched?.price && fetched.price > 0) {
									currentPrice = fetched.price;
								}
							} catch {
								// non-fatal fallback
							}
						}

						// STRICT GUARD: Must have positive price
						if (!currentPrice || currentPrice <= 0 || Number.isNaN(currentPrice)) {
							return null;
						}

						let evResult: EVResult | null = null;
						if (yearlyData.length > 0 && currentPrice > 0) {
							evResult = calculateEnterpriseValue({
								companyName: company.name,
								sector: company.sector,
								totalSharesOutstanding: company.totalShares ?? 0,
								currentOtcPricePerShare: currentPrice,
								yearlyFinancials: yearlyData,
							});
						}

						return {
							company,
							currentPrice,
							breakdown: this.scorePreIpo(
								company,
								ratios[ratios.length - 1],
								financials[financials.length - 1],
								evResult,
							),
							evResult,
						};
					}),
				)
			).filter((item): item is NonNullable<typeof item> => item !== null && item.currentPrice > 0);

			const scored = scoredRaw.sort(
				(a, b) => b.breakdown.totalScore - a.breakdown.totalScore,
			);

			if (scored.length === 0) return null;

			const top = scored[0];
			const company = top.company;
			const breakdown = top.breakdown;
			const ev = top.evResult;
			const currentPrice = top.currentPrice;

			// Final guard against 0 price
			if (!currentPrice || currentPrice <= 0 || Number.isNaN(currentPrice)) {
				logger.warn(`[PreIpoStrategy] Rejected pick ${company.name} due to non-positive price: ${currentPrice}`);
				return null;
			}

			// Pre-IPO: wider target (listing pop potential) & tighter stoploss
			const { targetPct, stoplossPct } = this.getDynamicTargetStoploss("unlisted");
			const targetPrice = Math.round(currentPrice * (1 + targetPct) * 100) / 100;
			const stoplossPrice = Math.round(currentPrice * (1 - stoplossPct) * 100) / 100;

			// ── 5. Rationale via AI ─────────────────────────────────────────────
			const rationale = await context.service.generateRationale({
				category: "pre_ipo",
				name: company.name,
				currentPrice,
				targetPrice,
				stoplossPrice,
				metrics: {
					listingStage: "pre_ipo",
					sector: company.sector,
					score: breakdown.totalScore,
					identityConfidence: company.identityConfidence,
					// EV context for richer AI rationale
					fairSharePrice: ev?.fairSharePrice,
					discountToPremiumPct: ev?.discountToPremiumPct,
					revenueCAGR: ev?.revenueCAGR,
					yearsAnalysed: ev?.yearsAnalysed,
				},
			});

			// ── 6. Emit pick with full EV breakdown ──────────────────────────────
			return {
				category: "pre_ipo",
				instrumentId: company.id,
				instrumentName: company.name,
				isin: company.isin || undefined,
				recoDate: context.today,
				recoPrice: currentPrice,
				targetPrice,
				stoplossPrice,
				currentPrice,
				status: "live",
				// Pre-IPO investments are long-horizon; 180 day pick window
				expiryDate: this.getExpiryDate(180),
				rationale,
				riskLevel: "high", // Pre-IPO is always high-risk (SEBI requirement)
				suitableFor: ["Aggressive"],
				timeHorizon: "Long Term (1+ year)",
				confidenceScore: this.getConfidenceScore(
					"unlisted",
					breakdown.totalScore,
					80,
				),
				sectorCategory: company.sector || undefined,
				scoringBreakdown: breakdown,
				keyMetrics: {
					listingStage: "pre_ipo",
					sector: company.sector || undefined,
					identityConfidence: company.identityConfidence || undefined,
					complianceStatus: company.complianceStatus || undefined,
					score: breakdown.totalScore,
					gmpPercentage: Math.min(35, Math.max(10, Math.round(breakdown.totalScore * 0.25 * 10) / 10)),
					ipoStatus: "drhp_filed",
					expectedTimeline: "6-18 months",
					proposedExchange: "NSE / BSE",
					// SEBI disclosure flags
					isIlliquid: true,
					isSpeculative: true,
					requiresAccreditedInvestor: true,
					// Enterprise Valuation metrics (FASP-EV-v1.0)
					fairSharePrice: ev?.fairSharePrice ?? undefined,
					blendedEV: ev?.blendedEV ?? undefined,
					equityValue: ev?.equityValue ?? undefined,
					discountToPremiumPct: ev?.discountToPremiumPct ?? undefined,
					revenueCAGR: ev?.revenueCAGR ?? undefined,
					ebitdaMarginAvg: ev?.ebitdaMarginAvg ?? undefined,
					yearsAnalysed: ev?.yearsAnalysed ?? undefined,
					dcfEV: ev?.dcfEV ?? undefined,
					comparablesEV: ev?.comparablesEV ?? undefined,
					netDebt: ev?.netDebt ?? undefined,
					evConfidenceScore: ev?.confidenceScore ?? undefined,
					evEngineVersion: ev?.engineVersion ?? undefined,
					evCalculationTimestamp: ev?.calculationTimestamp ?? undefined,
					evDataGaps: ev?.dataGaps ?? undefined,
				},
			};
		} catch (error) {
			logger.error("[PreIpoStrategy] Error:", {}, error as Error);
			return null;
		}
	}

	score(_instrument: any): number {
		return 50;
	}

	/**
	 * Pre-IPO scoring model — EV-aware (FASP-EV-v1.0).
	 *
	 * Scoring dimensions:
	 *  - listingStage: fixed 15 pts (all companies here are pre_ipo)
	 *  - Pricing availability: institutional buy price signals readiness
	 *  - Sector premium: high-growth sectors command valuation premiums
	 *  - Governance: identity confidence + compliance clearance
	 *  - Fundamentals (EV-aware): OTC discount-to-fair-value is the primary signal
	 *    * >30% undervalued vs EV → 25 pts (strong buy)
	 *    * 15–30% undervalued    → 18 pts
	 *    * 5–15% undervalued     → 12 pts
	 *    * Near fair value ±5%   → 6 pts
	 *    * OTC premium           → 0 pts (avoid)
	 *    * Bonus: revenue CAGR >20% → +5 pts
	 *
	 * @param company    Row from unlisted_companies
	 * @param ratios     Latest row from company_ratios (may be undefined)
	 * @param financials Latest row from company_financials (may be undefined)
	 * @param evResult   Output of calculateEnterpriseValue() (may be null)
	 */
	private scorePreIpo(
		company: any,
		ratios: any,
		financials: any,
		evResult: EVResult | null,
	): ScoreBreakdown {
		// Pre-IPO stage premium (all companies in this strategy are pre_ipo)
		const listingStageScore = 15;

		// Pricing availability — having an institutional buy price signals readiness
		let pricingScore = 0;
		if (company.publishedBuyPrice && Number.parseFloat(company.publishedBuyPrice) > 0) {
			pricingScore = 12;
		} else if (company.draftBuyPrice && Number.parseFloat(company.draftBuyPrice) > 0) {
			pricingScore = 6;
		}

		// Sector premium — high-growth sectors command valuation premiums at listing
		let sectorScore = 0;
		const sector = (company.sector || "").toLowerCase();
		if (sector.includes("tech") || sector.includes("fintech") || sector.includes("saas")) {
			sectorScore = 15;
		} else if (
			sector.includes("consumer") ||
			sector.includes("healthcare") ||
			sector.includes("pharma") ||
			sector.includes("ecommerce") ||
			sector.includes("market infrastructure")
		) {
			sectorScore = 12;
		} else if (sector.includes("banking") || sector.includes("financial")) {
			sectorScore = 10;
		} else {
			sectorScore = 6;
		}

		// Governance quality
		let governanceScore = 0;
		if (Number.parseFloat(company.identityConfidence || "0") >= 0.9) governanceScore += 8;
		if (company.complianceStatus === "cleared") governanceScore += 5;

		// ── EV-aware fundamentals score ────────────────────────────────────────
		let fundamentalsScore = 0;
		if (evResult !== null) {
			const d = evResult.discountToPremiumPct; // negative = undervalued
			if (d <= -30)      fundamentalsScore = 25; // >30% undervalued → strong signal
			else if (d <= -15) fundamentalsScore = 18;
			else if (d <= -5)  fundamentalsScore = 12;
			else if (d <= 5)   fundamentalsScore = 6;  // near fair value
			else               fundamentalsScore = 0;  // OTC premium → caution

			// Bonus: strong multi-year revenue growth trajectory
			if (evResult.revenueCAGR !== null && evResult.revenueCAGR > 20) fundamentalsScore += 5;
			else if (evResult.revenueCAGR !== null && evResult.revenueCAGR > 10) fundamentalsScore += 2;
		} else {
			// Legacy fallback when no financial data exists
			const roe = ratios?.roe != null ? Number.parseFloat(ratios.roe) : null;
			if (roe != null && roe > 20) fundamentalsScore = 20;
			else if (roe != null && roe > 10) fundamentalsScore = 10;
		}

		const totalScore =
			listingStageScore +
			pricingScore +
			sectorScore +
			governanceScore +
			fundamentalsScore;

		return {
			listingStageScore,
			pricingScore,
			sectorScore,
			governanceScore,
			riskAdjustment: 0,
			fundamentalsScore,
			totalScore,
			scoringVersion: "2.0-preipo-ev",
			threshold: 35,
			riskBand: "Growth",
		};
	}

	async getLivePrice(instrumentId: string): Promise<number | null> {
		const row = await db
			.select({ publishedBuyPrice: unlistedCompanies.publishedBuyPrice })
			.from(unlistedCompanies)
			.where(eq(unlistedCompanies.id, instrumentId))
			.limit(1);
		return row[0]?.publishedBuyPrice
			? Number.parseFloat(row[0].publishedBuyPrice)
			: null;
	}
}
