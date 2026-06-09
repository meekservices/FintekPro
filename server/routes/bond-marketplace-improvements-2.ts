/**
 * Bond Marketplace Improvements API Routes
 * Implements: Enhanced Filtering, Eligibility Visibility, Risk Disclosures,
 * Data Freshness, Net Yield Display, Watchlist/Alerts, Suitability Scoring, Admin Audit
 */

import { Router, Request, Response } from "express";
import { db } from "../db";
import {
	eq,
	and,
	or,
	desc,
	asc,
	gte,
	lte,
	sql,
	isNotNull,
	like,
	between,
} from "drizzle-orm";
import * as schema from "@shared/schema";
import { apiResponse } from "../utils/responses";
import { requireAuth, requireAdmin } from "../middleware/roleMiddleware";
import { bondFeeCalibrationService } from "../services/bond-fee-calibration-service";
import {
	determineRegulatoryTier,
	checkTierEligibility,
} from "../bond-kyc-gate";

const router = Router();

// =====================================================
// TASK 1: Enhanced Filtering & Search
// =====================================================

/**
 * GET /api/bonds/enhanced-catalog
 * Browse bonds with advanced filtering (credit rating, maturity, tax benefits)
 */
router.get("/watchlist", requireAuth, async (req: Request, res: Response) => {
	try {
		const userId = (req.user as any)?.id;

		const watchlistItems = await db
			.select()
			.from(schema.bondWatchlist)
			.where(eq(schema.bondWatchlist.userId, userId))
			.orderBy(desc(schema.bondWatchlist.addedAt));

		// Enrich with current data
		const enrichedItems = await Promise.all(
			watchlistItems.map(async (item) => {
				let currentData: any = {};

				if (!item.isin) return { ...item, ...currentData };

				const [govBond] = await db
					.select()
					.from(schema.governmentSecurities)
					.where(eq(schema.governmentSecurities.isin, item.isin));

				if (govBond) {
					currentData = {
						currentYield: govBond.yieldToMaturity,
						lastUpdated: govBond.lastUpdated,
					};
				} else {
					const [corpBond] = await db
						.select()
						.from(schema.corporateBonds)
						.where(eq(schema.corporateBonds.isin, item.isin));

					if (corpBond) {
						currentData = {
							currentYield: corpBond.yieldToMaturity,
							currentPrice: corpBond.lastTradedPrice || corpBond.currentPrice,
							lastUpdated: corpBond.lastUpdated,
						};
					}
				}

				return {
					...item,
					...currentData,
					yieldChange:
						currentData.currentYield && item.targetBuyYield
							? Number.parseFloat(currentData.currentYield) -
								Number.parseFloat(String(item.targetBuyYield))
							: null,
				};
			}),
		);

		return apiResponse.success(res, enrichedItems);
	} catch (error: any) {
		console.error("Error fetching watchlist:", error);
		return apiResponse.serverError(res, "Failed to fetch watchlist");
	}
});

/**
 * POST /api/bonds/watchlist
 * Add bond to watchlist
 */
router.post("/watchlist", requireAuth, async (req: Request, res: Response) => {
	try {
		const userId = (req.user as any)?.id;
		const {
			isin,
			alertOnYieldChange = true,
			yieldChangeThreshold = 0.25,
		} = req.body;

		if (!isin) {
			return apiResponse.badRequest(res, "ISIN is required");
		}

		// Check if already in watchlist
		const [existing] = await db
			.select()
			.from(schema.bondWatchlist)
			.where(
				and(
					eq(schema.bondWatchlist.userId, userId),
					eq(schema.bondWatchlist.isin, isin),
				),
			);

		if (existing) {
			return apiResponse.badRequest(res, "Bond already in watchlist");
		}

		// Get bond details
		let bondName = isin;
		let instrumentType = "unknown";
		let issuer = "Unknown";
		let targetBuyYield: string | null = null;

		const [govBond] = await db
			.select()
			.from(schema.governmentSecurities)
			.where(eq(schema.governmentSecurities.isin, isin));

		if (govBond) {
			bondName = govBond.securityName || isin;
			instrumentType = "government";
			issuer = govBond.issuer || "Government of India";
			targetBuyYield = govBond.yieldToMaturity || null;
		} else {
			const [corpBond] = await db
				.select()
				.from(schema.corporateBonds)
				.where(eq(schema.corporateBonds.isin, isin));

			if (corpBond) {
				bondName = corpBond.bondName || isin;
				instrumentType = corpBond.bondType || "corporate";
				issuer = corpBond.issuer || "Unknown";
				targetBuyYield = corpBond.yieldToMaturity || null;
			}
		}

		const [watchlistItem] = await db
			.insert(schema.bondWatchlist)
			.values({
				userId,
				isin,
				bondName,
				bondType: instrumentType,
				issuer,
				alertOnYieldChange,
				yieldAlertThreshold: String(yieldChangeThreshold),
				targetBuyYield,
			})
			.returning();

		res.status(201);
		return apiResponse.success(res, watchlistItem);
	} catch (error: any) {
		console.error("Error adding to watchlist:", error);
		return apiResponse.serverError(res, "Failed to add to watchlist");
	}
});

/**
 * DELETE /api/bonds/watchlist/:isin
 * Remove bond from watchlist
 */
router.delete(
	"/watchlist/:isin",
	requireAuth,
	async (req: Request, res: Response) => {
		try {
			const userId = (req.user as any)?.id;
			const { isin } = req.params;

			await db
				.delete(schema.bondWatchlist)
				.where(
					and(
						eq(schema.bondWatchlist.userId, userId),
						eq(schema.bondWatchlist.isin, isin),
					),
				);

			return apiResponse.success(res, { message: "Removed from watchlist" });
		} catch (error: any) {
			console.error("Error removing from watchlist:", error);
			return apiResponse.serverError(res, "Failed to remove from watchlist");
		}
	},
);

/**
 * GET /api/bonds/alerts
 * Get user's bond alerts
 */
router.get("/alerts", requireAuth, async (req: Request, res: Response) => {
	try {
		const userId = (req.user as any)?.id;
		const { status = "unread" } = req.query;

		const alerts = await db
			.select()
			.from(schema.bondAlerts)
			.where(
				and(
					eq(schema.bondAlerts.userId, userId),
					status !== "all"
						? eq(schema.bondAlerts.status, status as string)
						: sql`1=1`,
				),
			)
			.orderBy(desc(schema.bondAlerts.createdAt))
			.limit(50);

		return apiResponse.success(res, alerts);
	} catch (error: any) {
		console.error("Error fetching alerts:", error);
		return apiResponse.serverError(res, "Failed to fetch alerts");
	}
});

/**
 * PATCH /api/bonds/alerts/:id/read
 * Mark alert as read
 */
router.patch(
	"/alerts/:id/read",
	requireAuth,
	async (req: Request, res: Response) => {
		try {
			const userId = (req.user as any)?.id;
			const { id } = req.params;

			await db
				.update(schema.bondAlerts)
				.set({ status: "read", readAt: new Date() })
				.where(
					and(
						eq(schema.bondAlerts.id, id),
						eq(schema.bondAlerts.userId, userId),
					),
				);

			return apiResponse.success(res, { message: "Alert marked as read" });
		} catch (error: any) {
			console.error("Error marking alert as read:", error);
			return apiResponse.serverError(res, "Failed to mark alert as read");
		}
	},
);

// =====================================================
// TASK 7: Suitability Scoring
// =====================================================

/**
 * GET /api/bonds/suitability/:isin
 * Calculate suitability score for a bond based on user profile
 */
router.get(
	"/suitability/:isin",
	requireAuth,
	async (req: Request, res: Response) => {
		try {
			const userId = (req.user as any)?.id;
			const { isin } = req.params;

			// Get user's risk profile
			const [riskProfile] = await db
				.select()
				.from(schema.riskProfiles)
				.where(eq(schema.riskProfiles.userId, userId));

			if (!riskProfile) {
				return apiResponse.success(res, {
					isin,
					hasSuitabilityScore: false,
					message:
						"Complete risk profiling to get personalized recommendations",
					profileUrl: "/risk-profile",
				});
			}

			// Get bond details
			let bond: any = null;
			let instrumentType = "corporate_bond";
			let bondYield = 0;
			let maturityDate: Date | null = null;
			let creditRating = "";
			let isListed = true;
			let bondName = "";

			const [govBond] = await db
				.select()
				.from(schema.governmentSecurities)
				.where(eq(schema.governmentSecurities.isin, isin));

			if (govBond) {
				bond = govBond;
				instrumentType = "government";
				bondYield = Number.parseFloat(govBond.yieldToMaturity || "0");
				maturityDate = govBond.maturityDate
					? new Date(govBond.maturityDate)
					: null;
				creditRating = "SOV";
				bondName = govBond.securityName || isin;
			} else {
				const [corpBond] = await db
					.select()
					.from(schema.corporateBonds)
					.where(eq(schema.corporateBonds.isin, isin));

				if (corpBond) {
					bond = corpBond;
					instrumentType = corpBond.bondType || "corporate";
					bondYield = Number.parseFloat(corpBond.yieldToMaturity || "0");
					maturityDate = corpBond.maturityDate
						? new Date(corpBond.maturityDate)
						: null;
					creditRating = corpBond.creditRating || "";
					isListed = corpBond.tradingStatus === "active";
					bondName = corpBond.bondName || corpBond.issuer || isin;
				}
			}

			if (!bond) {
				return apiResponse.notFound(res, "Bond not found");
			}

			// Calculate suitability scores
			const scores = calculateSuitabilityScores(riskProfile, {
				instrumentType,
				yield: bondYield,
				maturityDate,
				creditRating,
				isListed,
			});

			return apiResponse.success(res, {
				isin,
				bondName,
				instrumentType,
				hasSuitabilityScore: true,
				scores,
				overallScore: scores.overall,
				suitabilityCategory: getSuitabilityCategory(scores.overall),
				recommendation: getSuitabilityRecommendation(scores),
				warnings: scores.warnings,
			});
		} catch (error: any) {
			console.error("Error calculating suitability:", error);
			return apiResponse.serverError(res, "Failed to calculate suitability");
		}
	},
);

/**
 * GET /api/bonds/suitable-for-me
 * Get bonds sorted by suitability for user
 */
router.get(
	"/suitable-for-me",
	requireAuth,
	async (req: Request, res: Response) => {
		try {
			const userId = (req.user as any)?.id;
			const { limit = "10" } = req.query;

			// Get user's risk profile
			const [riskProfile] = await db
				.select()
				.from(schema.riskProfiles)
				.where(eq(schema.riskProfiles.userId, userId));

			if (!riskProfile) {
				return apiResponse.success(res, {
					hasSuitableRecommendations: false,
					message:
						"Complete risk profiling to get personalized recommendations",
					profileUrl: "/risk-profile",
				});
			}

			// Fetch bonds
			const [govBonds, corpBonds] = await Promise.all([
				db
					.select()
					.from(schema.governmentSecurities)
					.where(eq(schema.governmentSecurities.tradingStatus, "active"))
					.limit(50),
				db
					.select()
					.from(schema.corporateBonds)
					.where(eq(schema.corporateBonds.tradingStatus, "active"))
					.limit(50),
			]);

			// Score all bonds
			const scoredBonds: any[] = [];

			govBonds.forEach((bond) => {
				const scores = calculateSuitabilityScores(riskProfile, {
					instrumentType: "government",
					yield: Number.parseFloat(bond.yieldToMaturity || "0"),
					maturityDate: bond.maturityDate ? new Date(bond.maturityDate) : null,
					creditRating: "SOV",
					isListed: true,
				});

				scoredBonds.push({
					isin: bond.isin,
					bondName: bond.securityName,
					instrumentType: "government",
					yield: bond.yieldToMaturity,
					maturityDate: bond.maturityDate,
					creditRating: "SOV",
					suitabilityScore: scores.overall,
					suitabilityCategory: getSuitabilityCategory(scores.overall),
				});
			});

			corpBonds.forEach((bond) => {
				const scores = calculateSuitabilityScores(riskProfile, {
					instrumentType: bond.bondType || "corporate",
					yield: Number.parseFloat(bond.yieldToMaturity || "0"),
					maturityDate: bond.maturityDate ? new Date(bond.maturityDate) : null,
					creditRating: bond.creditRating || "",
					isListed: bond.tradingStatus === "active",
				});

				scoredBonds.push({
					isin: bond.isin,
					bondName: bond.bondName || bond.issuer,
					instrumentType: bond.bondType || "corporate",
					yield: bond.yieldToMaturity,
					maturityDate: bond.maturityDate,
					creditRating: bond.creditRating,
					suitabilityScore: scores.overall,
					suitabilityCategory: getSuitabilityCategory(scores.overall),
				});
			});

			// Sort by suitability score
			scoredBonds.sort((a, b) => b.suitabilityScore - a.suitabilityScore);

			return apiResponse.success(res, {
				hasSuitableRecommendations: true,
				recommendations: scoredBonds.slice(0, Number.parseInt(limit as string)),
				riskProfileSummary: {
					riskCategory: riskProfile.riskTolerance,
					investmentHorizon: riskProfile.investmentHorizon,
				},
			});
		} catch (error: any) {
			console.error("Error getting suitable bonds:", error);
			return apiResponse.serverError(res, "Failed to get suitable bonds");
		}
	},
);

// =====================================================
// TASK 8: Admin Audit Dashboard
// =====================================================

/**
 * GET /api/admin/bonds/fee-override-audit
 * Get fee override audit trail
 */
router.get(
	"/admin/fee-override-audit",
	requireAdmin,
	async (req: Request, res: Response) => {
		try {
			const {
				startDate,
				endDate,
				action,
				isin,
				limit = "50",
				offset = "0",
			} = req.query;

			const conditions = [];

			if (startDate) {
				conditions.push(
					gte(
						schema.bondFeeOverrideAudit.performedAt,
						new Date(startDate as string),
					),
				);
			}
			if (endDate) {
				conditions.push(
					lte(
						schema.bondFeeOverrideAudit.performedAt,
						new Date(endDate as string),
					),
				);
			}
			if (action) {
				conditions.push(
					eq(schema.bondFeeOverrideAudit.action, action as string),
				);
			}
			if (isin) {
				conditions.push(eq(schema.bondFeeOverrideAudit.isin, isin as string));
			}

			const auditRecords = await db
				.select()
				.from(schema.bondFeeOverrideAudit)
				.where(conditions.length > 0 ? and(...conditions) : sql`1=1`)
				.orderBy(desc(schema.bondFeeOverrideAudit.performedAt))
				.limit(Number.parseInt(limit as string))
				.offset(Number.parseInt(offset as string));

			// Get total count
			const [countResult] = await db
				.select({ count: sql<number>`count(*)::int` })
				.from(schema.bondFeeOverrideAudit)
				.where(conditions.length > 0 ? and(...conditions) : sql`1=1`);

			return apiResponse.success(res, {
				records: auditRecords,
				total: countResult?.count || 0,
				pagination: {
					limit: Number.parseInt(limit as string),
					offset: Number.parseInt(offset as string),
				},
			});
		} catch (error: any) {
			console.error("Error fetching audit records:", error);
			return apiResponse.serverError(res, "Failed to fetch audit records");
		}
	},
);

/**
 * GET /api/admin/bonds/compliance-summary
 * Get compliance summary for reporting
 */
router.get(
	"/admin/compliance-summary",
	requireAdmin,
	async (_req: Request, res: Response) => {
		try {
			const now = new Date();
			const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

			// Get override statistics
			const [overrideStats] = await db
				.select({
					totalOverrides: sql<number>`count(*)::int`,
					pendingApproval: sql<number>`count(*) filter (where approved_at is null)::int`,
				})
				.from(schema.bondFeeOverrides);

			// Get attestation statistics
			const [attestationStats] = await db
				.select({
					totalAttestations: sql<number>`count(*)::int`,
					last30Days: sql<number>`count(*) filter (where attested_at >= ${last30Days})::int`,
				})
				.from(schema.bondRiskDisclosureAttestations);

			// Get audit activity
			const [auditStats] = await db
				.select({
					totalActions: sql<number>`count(*)::int`,
					creates: sql<number>`count(*) filter (where action = 'created')::int`,
					modifications: sql<number>`count(*) filter (where action = 'modified')::int`,
					approvals: sql<number>`count(*) filter (where action = 'approved')::int`,
					violations: sql<number>`count(*) filter (where regulatory_violations is not null and regulatory_violations != '[]'::jsonb)::int`,
				})
				.from(schema.bondFeeOverrideAudit);

			return apiResponse.success(res, {
				feeOverrides: {
					total: overrideStats?.totalOverrides || 0,
					pendingApproval: overrideStats?.pendingApproval || 0,
				},
				riskAttestations: {
					total: attestationStats?.totalAttestations || 0,
					last30Days: attestationStats?.last30Days || 0,
				},
				auditActivity: {
					total: auditStats?.totalActions || 0,
					breakdown: {
						creates: auditStats?.creates || 0,
						modifications: auditStats?.modifications || 0,
						approvals: auditStats?.approvals || 0,
					},
					violationsRecorded: auditStats?.violations || 0,
				},
				generatedAt: now.toISOString(),
			});
		} catch (error: any) {
			console.error("Error getting compliance summary:", error);
			return apiResponse.serverError(res, "Failed to get compliance summary");
		}
	},
);

// =====================================================
// Helper Functions
// =====================================================

function getRiskLevel(rating: string): string {
	if (!rating) return "Unknown";
	if (rating === "SOV" || rating.startsWith("AAA")) return "Very Low";
	if (rating.startsWith("AA")) return "Low";
	if (rating.startsWith("A")) return "Moderate";
	if (rating.startsWith("BBB")) return "Medium";
	if (rating.startsWith("BB")) return "High";
	return "Very High";
}

function getRiskScore(rating: string): number {
	if (!rating) return 100;
	if (rating === "SOV") return 0;
	if (rating.startsWith("AAA")) return 5;
	if (rating === "AA+") return 10;
	if (rating === "AA") return 15;
	if (rating === "AA-") return 20;
	if (rating === "A+") return 30;
	if (rating === "A") return 35;
	if (rating === "A-") return 40;
	if (rating.startsWith("BBB")) return 50;
	if (rating.startsWith("BB")) return 70;
	return 90;
}

function getUpgradePath(currentTier: string, requiredTier: string): any {
	const paths: Record<string, any> = {
		none_to_basic: {
			steps: ["Complete basic KYC", "Verify PAN"],
			estimatedTime: "10 minutes",
		},
		basic_to_tier_1: {
			steps: ["Add address proof", "Bank verification"],
			estimatedTime: "15 minutes",
		},
		tier_1_to_tier_2: {
			steps: ["Income verification", "Risk assessment"],
			estimatedTime: "20 minutes",
		},
		tier_2_to_tier_3: {
			steps: ["Net worth declaration", "Enhanced due diligence"],
			estimatedTime: "1-2 days",
		},
		tier_3_to_accredited: {
			steps: ["Accredited investor verification", "SEBI compliance check"],
			estimatedTime: "3-5 days",
		},
	};

	return (
		paths[`${currentTier}_to_${requiredTier}`] || {
			steps: ["Contact support for upgrade"],
			estimatedTime: "Varies",
		}
	);
}

function getKycDocumentsForTier(tier: string): string[] {
	const docs: Record<string, string[]> = {
		basic: ["PAN Card"],
		tier_1: ["PAN Card", "Address Proof", "Bank Statement"],
		tier_2: ["PAN Card", "Address Proof", "Bank Statement", "Income Proof"],
		tier_3: [
			"PAN Card",
			"Address Proof",
			"Bank Statement",
			"Income Proof",
			"Net Worth Certificate",
		],
		accredited: [
			"PAN Card",
			"Address Proof",
			"Bank Statement",
			"Income Proof",
			"Net Worth Certificate",
			"CA Certificate",
		],
	};
	return docs[tier] || docs.basic;
}

function getTierDisplayName(tier: string): string {
	const names: Record<string, string> = {
		none: "Not Verified",
		basic: "Basic KYC",
		tier_1: "Standard",
		tier_2: "Enhanced",
		tier_3: "Premium",
		enhanced: "Enhanced",
		accredited: "SEBI Accredited",
	};
	return names[tier] || tier;
}

function getNextTier(currentTier: string): any {
	const order = ["none", "basic", "tier_1", "tier_2", "tier_3", "accredited"];
	const currentIndex = order.indexOf(currentTier);
	if (currentIndex < 0 || currentIndex >= order.length - 1) return null;

	const nextTier = order[currentIndex + 1];
	return { tier: nextTier, displayName: getTierDisplayName(nextTier) };
}

function getSEBIDisclosures(
	instrumentType: string,
	transactionValue: number,
	isListed: boolean,
): any {
	const baseDisclosures = [
		{
			category: "market_risk",
			title: "Market Risk",
			description:
				"Bond prices can fluctuate based on market conditions, interest rates, and economic factors.",
			requiresExplicitAck: true,
		},
		{
			category: "interest_rate_risk",
			title: "Interest Rate Risk",
			description: "Rising interest rates may cause bond prices to decline.",
			requiresExplicitAck: true,
		},
		{
			category: "credit_risk",
			title: "Credit Risk",
			description: "The issuer may default on interest or principal payments.",
			requiresExplicitAck: true,
		},
	];

	const additionalDisclosures = [];

	if (!isListed) {
		additionalDisclosures.push(
			{
				category: "liquidity_risk",
				title: "Liquidity Risk",
				description:
					"Unlisted bonds may be difficult to sell. You may not be able to exit your position quickly.",
				requiresExplicitAck: true,
			},
			{
				category: "valuation_risk",
				title: "Valuation Risk",
				description:
					"Fair value of unlisted securities may be difficult to determine.",
				requiresExplicitAck: true,
			},
		);
	}

	if (transactionValue > 5000000) {
		additionalDisclosures.push({
			category: "concentration_risk",
			title: "Concentration Risk",
			description:
				"Large investments in a single instrument increase portfolio concentration risk.",
			requiresExplicitAck: true,
		});
	}

	if (instrumentType === "corporate" || instrumentType === "ncd") {
		additionalDisclosures.push({
			category: "default_risk",
			title: "Default Risk",
			description:
				"Corporate issuers may face financial difficulties leading to default.",
			requiresExplicitAck: true,
		});
	}

	return {
		disclosures: [...baseDisclosures, ...additionalDisclosures],
		requiredCount:
			baseDisclosures.length +
			additionalDisclosures.filter((d) => d.requiresExplicitAck).length,
	};
}

function calculateSuitabilityScores(riskProfile: any, bondDetails: any): any {
	const warnings: string[] = [];

	// Risk alignment (0-100)
	const riskScore = getRiskScore(bondDetails.creditRating);
	const userRiskTolerance = getRiskToleranceScore(riskProfile.riskCategory);
	const riskAlignment = Math.max(
		0,
		100 - Math.abs(riskScore - userRiskTolerance),
	);

	// Horizon alignment (0-100)
	let horizonAlignment = 50;
	if (bondDetails.maturityDate) {
		const yearsToMaturity =
			(bondDetails.maturityDate.getTime() - Date.now()) /
			(365.25 * 24 * 60 * 60 * 1000);
		const userHorizon = getHorizonYears(riskProfile.investmentTimeHorizon);
		horizonAlignment = Math.max(
			0,
			100 - Math.abs(yearsToMaturity - userHorizon) * 10,
		);

		if (yearsToMaturity > userHorizon * 1.5) {
			warnings.push("Bond maturity exceeds your investment horizon");
		}
	}

	// Liquidity score (0-100)
	const liquidityScore = bondDetails.isListed ? 80 : 30;
	if (!bondDetails.isListed && riskProfile.liquidityNeeds === "high") {
		warnings.push("Unlisted bond may not meet your liquidity needs");
	}

	// Yield expectation score (0-100)
	const yieldExpectation = riskProfile.expectedReturns || 7;
	const yieldAlignment =
		bondDetails.yield >= yieldExpectation
			? 100
			: (bondDetails.yield / yieldExpectation) * 100;

	// Tax efficiency (0-100)
	const taxScore =
		bondDetails.instrumentType === "tax_free"
			? 100
			: bondDetails.instrumentType === "government"
				? 70
				: 50;

	const overall =
		Math.round(
			(riskAlignment * 0.3 +
				horizonAlignment * 0.25 +
				liquidityScore * 0.15 +
				yieldAlignment * 0.2 +
				taxScore * 0.1) *
				10,
		) / 10;

	return {
		riskAlignment,
		horizonAlignment,
		liquidityScore,
		yieldExpectation: Math.round(yieldAlignment),
		taxEfficiency: taxScore,
		overall,
		warnings,
	};
}

function getRiskToleranceScore(riskCategory: string): number {
	const scores: Record<string, number> = {
		conservative: 20,
		moderately_conservative: 35,
		moderate: 50,
		moderately_aggressive: 65,
		aggressive: 80,
	};
	return scores[riskCategory] || 50;
}

function getHorizonYears(horizon: string): number {
	const years: Record<string, number> = {
		short: 1,
		medium_short: 2,
		medium: 3,
		medium_long: 5,
		long: 10,
	};
	return years[horizon] || 3;
}

function getSuitabilityCategory(score: number): string {
	if (score >= 80) return "highly_suitable";
	if (score >= 60) return "suitable";
	if (score >= 40) return "neutral";
	if (score >= 20) return "less_suitable";
	return "not_suitable";
}

function getSuitabilityRecommendation(scores: any): string {
	if (scores.overall >= 80)
		return "This bond aligns well with your investment profile.";
	if (scores.overall >= 60)
		return "This bond is generally suitable for your profile.";
	if (scores.overall >= 40)
		return "This bond has mixed alignment with your goals. Review carefully.";
	if (scores.overall >= 20)
		return "This bond may not be ideal for your risk profile.";
	return "This bond is not recommended based on your profile.";
}

export default router;
