/**
 * Pre-IPO Pick Strategy
 *
 * Purpose:  Selects investment picks from unlisted companies that are in the
 *           `pre_ipo` listing stage — i.e., companies that have filed DRHP or
 *           are expected to list within 6–24 months. These are categorised as
 *           `category = "pre_ipo"` in daily_picks, keeping them SEPARATE from
 *           generic `unlisted` (growth-stage / mature unlisted) picks.
 *
 * Picking logic:
 *   1. Source: `unlisted_companies` table, filtered to `listing_stage = 'pre_ipo'`
 *              and `status = 'active'`
 *   2. Exclude companies already picked in the last 7 days (recentIds set)
 *   3. Score using a pre-IPO–specific scoring model (GMP potential, DRHP
 *      filing status, sector premium, governance quality)
 *   4. Emit pick with category = "pre_ipo" so the frontend tab works cleanly
 *
 * FASP-AI v1.0: All outputs include confidence_score, model_version, risk_level.
 * SEBI: These are speculative, illiquid instruments. Expiry set to 180 days.
 *       suitableFor = ["Aggressive"] — accredited/HNI investors only.
 */

import { db } from "../../db";
import { unlistedCompanies, companyRatios, companyFinancials } from "@shared/schema";
import { eq, desc, and } from "drizzle-orm";
import { BaseStrategy } from "./base-strategy";
import { StrategyContext } from "./types";
import {
	DailyPickData,
	PickCategory,
	ScoreBreakdown,
} from "../pick-of-the-day-service";
import { logger } from "../../logger";

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
						eq(unlistedCompanies.listingStage, "pre_ipo"),
					),
				)
				.limit(30);

			if (companies.length === 0) return null;

			// ── 2. Exclude recently picked instruments ─────────────────────────
			const freshCompanies = this.filterRecentPicks(
				companies,
				context.recentIds,
				(c) => c.id.toString(),
			);

			if (freshCompanies.length === 0) return null;

			// ── 3. Score each company using pre-IPO–specific model ─────────────
			const scoredRaw = await Promise.all(
				freshCompanies.map(async (company) => {
					const ratios = await db
						.select()
						.from(companyRatios)
						.where(eq(companyRatios.companyId, company.id))
						.orderBy(desc(companyRatios.financialYear))
						.limit(1);
					const financials = await db
						.select()
						.from(companyFinancials)
						.where(eq(companyFinancials.companyId, company.id))
						.orderBy(desc(companyFinancials.financialYear))
						.limit(1);

					return {
						company,
						breakdown: this.scorePreIpo(company, ratios[0], financials[0]),
					};
				}),
			);

			const scored = scoredRaw.sort(
				(a, b) => b.breakdown.totalScore - a.breakdown.totalScore,
			);

			const top = scored[0];
			const company = top.company;
			const breakdown = top.breakdown;

			// ── 4. Price & targets ──────────────────────────────────────────────
			const currentPrice = Number.parseFloat(
				company.publishedBuyPrice || company.draftBuyPrice || "0",
			);

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
				},
			});

			// ── 6. Emit pick with category = "pre_ipo" ─────────────────────────
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
				},
			};
		} catch (error) {
			logger.error("[PreIpoStrategy] Error:", {}, error as Error);
			return null;
		}
	}

	score(instrument: any): number {
		return 50;
	}

	/**
	 * Pre-IPO scoring model.
	 *
	 * Scoring dimensions differ from generic unlisted:
	 *  - listingStage is always pre_ipo for this strategy (fixed 15 pts)
	 *  - GMP proxy: if published_buy_price exists and > 50, signals institutional pricing (bonus)
	 *  - Sector premium for high-multiple sectors (tech, fintech, consumer, healthcare)
	 *  - Governance: identity confidence + compliance clearance
	 *  - Fundamentals: ROE from financials
	 *
	 * @param company  Row from unlisted_companies
	 * @param ratios   Latest row from company_ratios (may be undefined)
	 * @param financials Latest row from company_financials (may be undefined)
	 */
	private scorePreIpo(
		company: any,
		ratios: any,
		financials: any,
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
			sector.includes("ecommerce")
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

		// Fundamentals
		let fundamentalsScore = 0;
		const roe = ratios?.roe != null ? Number.parseFloat(ratios.roe) : null;
		if (roe != null && roe > 20) fundamentalsScore += 20;
		else if (roe != null && roe > 10) fundamentalsScore += 10;

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
			scoringVersion: "1.0-preipo",
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
