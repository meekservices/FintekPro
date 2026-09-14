import { db } from "../../db";
import {
	unlistedCompanies,
	companyRatios,
	companyFinancials,
} from "@shared/schema";
import { eq, asc, and, ne, or, isNull } from "drizzle-orm";
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

export class UnlistedStrategy extends BaseStrategy {
	category: PickCategory = "unlisted";

	async generate(context: StrategyContext): Promise<DailyPickData | null> {
		try {
			// Bug fix: exclude companies that have since listed on NSE/BSE.
			// `status='inactive'` or `listingStage='listed'` are set by the
			// UnlistedListingTracker when a company completes its IPO.
			const companies = await db
				.select()
				.from(unlistedCompanies)
				.where(
					and(
						eq(unlistedCompanies.status, "active"),
						// Exclude pre-IPO stage — handled by PreIpoStrategy (category='pre_ipo')
						or(
							isNull(unlistedCompanies.listingStage),
							and(
								ne(unlistedCompanies.listingStage, "listed"),
								ne(unlistedCompanies.listingStage, "pre_ipo"),
							),
						),
					),
				)
				.limit(50);

			if (companies.length === 0) return null;

			const freshCompanies = this.filterRecentPicks(
				companies,
				context.recentIds,
				(c) => c.id.toString(),
			);

			const scoredCompaniesRaw = await Promise.all(
				freshCompanies.map(async (company) => {
					const ratios = await db
						.select()
						.from(companyRatios)
						.where(eq(companyRatios.companyId, company.id))
						.orderBy(asc(companyRatios.financialYear))
						.limit(5); // ← 5-year ascending for CAGR computation

					// 5-year financials ascending — required for yearwise EV analysis
					const financials = await db
						.select()
						.from(companyFinancials)
						.where(eq(companyFinancials.companyId, company.id))
						.orderBy(asc(companyFinancials.financialYear))
						.limit(5);

					// Build EV input from multi-year data
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

					const currentPrice = parseFloat(
						company.publishedBuyPrice || company.draftBuyPrice || "0",
					);

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
						scoringBreakdown: this.scoreUnlistedWithRatios(
							company,
							ratios[ratios.length - 1], // latest ratio row for legacy fields
							financials[financials.length - 1], // latest financial row
							evResult,
						),
						evResult,
					};
				}),
			);

			const scoredCompanies = scoredCompaniesRaw.sort(
				(a, b) => b.scoringBreakdown.totalScore - a.scoringBreakdown.totalScore,
			);
			if (scoredCompanies.length === 0) return null;

			const top = scoredCompanies[0];
			const company = top.company;
			const breakdown = top.scoringBreakdown;
			const ev = top.evResult;

			const currentPrice = Number.parseFloat(
				company.publishedBuyPrice || company.draftBuyPrice || "0",
			);
			const { targetPct, stoplossPct } =
				this.getDynamicTargetStoploss("unlisted");
			const targetPrice =
				Math.round(currentPrice * (1 + targetPct) * 100) / 100;
			const stoplossPrice =
				Math.round(currentPrice * (1 - stoplossPct) * 100) / 100;

			const rationale = await context.service.generateRationale({
				category: "unlisted",
				name: company.name,
				currentPrice,
				targetPrice,
				stoplossPrice,
				metrics: {
					listingStage: company.listingStage,
					sector: company.sector,
					score: breakdown.totalScore,
					// Pass EV metrics to rationale generator for richer AI output
					fairSharePrice: ev?.fairSharePrice,
					discountToPremiumPct: ev?.discountToPremiumPct,
					revenueCAGR: ev?.revenueCAGR,
				},
			});

			return {
				category: "unlisted",
				instrumentId: company.id,
				instrumentName: company.name,
				isin: company.isin || undefined,
				recoDate: context.today,
				recoPrice: currentPrice,
				targetPrice,
				stoplossPrice,
				currentPrice,
				status: "live",
				expiryDate: this.getExpiryDate(180),
				rationale,
				riskLevel: breakdown.totalScore > 60 ? "medium" : "high",
				suitableFor: ["Aggressive"],
				timeHorizon: this.getTimeHorizon("unlisted"),
				confidenceScore: this.getConfidenceScore(
					"unlisted",
					breakdown.totalScore,
					80,
				),
				sectorCategory: company.sector || undefined,
				scoringBreakdown: breakdown,
				keyMetrics: {
					listingStage: company.listingStage || undefined,
					sector: company.sector || undefined,
					identityConfidence: company.identityConfidence || undefined,
					complianceStatus: company.complianceStatus || undefined,
					score: breakdown.totalScore,
					// Enterprise Valuation metrics
					fairSharePrice: ev?.fairSharePrice ?? undefined,
					blendedEV: ev?.blendedEV ?? undefined,
					equityValue: ev?.equityValue ?? undefined,
					discountToPremiumPct: ev?.discountToPremiumPct ?? undefined,
					revenueCAGR: ev?.revenueCAGR ?? undefined,
					ebitdaMarginAvg: ev?.ebitdaMarginAvg ?? undefined,
					yearsAnalysed: ev?.yearsAnalysed ?? undefined,
					evConfidenceScore: ev?.confidenceScore ?? undefined,
					evEngineVersion: ev?.engineVersion ?? undefined,
					evCalculationTimestamp: ev?.calculationTimestamp ?? undefined,
				},
			};
		} catch (error) {
			logger.error("[UnlistedStrategy] Error:", {}, error as Error);
			return null;
		}
	}

	score(_instrument: any): number {
		return 50;
	}

	/**
	 * Scores an unlisted company on 5 dimensions.
	 * Fundamentals dimension is now EV-aware: rewards companies trading at a
	 * significant discount to intrinsic enterprise value.
	 *
	 * @param company   - Row from unlisted_companies
	 * @param ratios    - Latest row from company_ratios (may be undefined)
	 * @param financials - Latest row from company_financials (may be undefined)
	 * @param evResult  - Output of calculateEnterpriseValue() (may be null)
	 */
	private scoreUnlistedWithRatios(
		company: any,
		ratios: any,
		financials: any,
		evResult: EVResult | null,
	): ScoreBreakdown {
		let listingStageScore = 0;
		if (company.listingStage === "unlisted") listingStageScore = 10;
		else if (company.listingStage === "pre_ipo") listingStageScore = 8;
		else listingStageScore = 5;

		let pricingScore = 0;
		if (
			company.publishedBuyPrice &&
			Number.parseFloat(company.publishedBuyPrice) > 0
		)
			pricingScore = 10;
		else if (
			company.draftBuyPrice &&
			Number.parseFloat(company.draftBuyPrice) > 0
		)
			pricingScore = 5;

		let sectorScore = 0;
		const sector = (company.sector || "").toLowerCase();
		if (sector.includes("tech") || sector.includes("fintech")) sectorScore = 12;
		else if (sector.includes("banking")) sectorScore = 8;
		else sectorScore = 5;

		let governanceScore = 0;
		if (Number.parseFloat(company.identityConfidence || "0") >= 0.9)
			governanceScore += 8;
		if (company.complianceStatus === "cleared") governanceScore += 5;

		// ── EV-aware fundamentals score ────────────────────────────────────────
		// Primary: discount to EV (most important signal for unlisted picks)
		// Fallback: single-year ROE if EV not available
		let fundamentalsScore = 0;
		if (evResult !== null) {
			const d = evResult.discountToPremiumPct; // negative = undervalued
			if (d <= -30) fundamentalsScore = 25;       // OTC ≥30% below fair value → strong buy
			else if (d <= -15) fundamentalsScore = 18;  // 15–30% below fair value
			else if (d <= -5)  fundamentalsScore = 12;  // 5–15% below fair value
			else if (d <= 10)  fundamentalsScore = 6;   // Near fair value (±10%)
			else               fundamentalsScore = 0;   // OTC >10% premium → caution

			// Bonus: consistent multi-year revenue growth
			if (evResult.revenueCAGR !== null && evResult.revenueCAGR > 20) fundamentalsScore += 5;
			else if (evResult.revenueCAGR !== null && evResult.revenueCAGR > 10) fundamentalsScore += 2;
		} else {
			// Legacy fallback when no financial data available
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
			scoringVersion: "3.0-ev",
			threshold: 40,
			riskBand: "Moderate",
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
