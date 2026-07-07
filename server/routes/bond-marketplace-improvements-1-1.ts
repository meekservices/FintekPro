// @ts-nocheck
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
router.get("/enhanced-catalog", async (req: Request, res: Response) => {
	try {
		const {
			type = "all",
			creditRating,
			minYield,
			maxYield,
			minMaturityYears,
			maxMaturityYears,
			taxCategory,
			minInvestment,
			sortBy = "yield",
			sortOrder = "desc",
			limit = "50",
			offset = "0",
		} = req.query;

		const bonds: any[] = [];
		const now = new Date();

		// Fetch government securities with filters
		if (type === "all" || type === "government") {
			const govBonds = await db
				.select()
				.from(schema.governmentSecurities)
				.where(eq(schema.governmentSecurities.tradingStatus, "active"))
				.limit(Number.parseInt(limit as string));

			bonds.push(
				...govBonds.map((b) => {
					const maturityDate = b.maturityDate ? new Date(b.maturityDate) : null;
					const yearsToMaturity = maturityDate
						? Math.max(
								0,
								(maturityDate.getTime() - now.getTime()) /
									(365.25 * 24 * 60 * 60 * 1000),
							)
						: null;

					return {
						id: b.id,
						isin: b.isin,
						bondName: b.securityName,
						issuerName: "Government of India",
						instrumentType: b.securityType || "gsec",
						displayType: "Government Security",
						couponRate: b.couponRate,
						yieldToMaturity: b.yieldToMaturity,
						maturityDate: b.maturityDate,
						yearsToMaturity: yearsToMaturity
							? Math.round(yearsToMaturity * 10) / 10
							: null,
						creditRating: "SOV",
						ratingAgency: "CRISIL/ICRA",
						minInvestment: b.minimumInvestment || 10000,
						faceValue: b.faceValue || 100,
						taxCategory: "taxable",
						isTaxFree: false,
						isListed: true,
						exchange: "RBI",
						lastUpdated: b.lastUpdated,
						source: "government_securities",
					};
				}),
			);
		}

		// Fetch corporate bonds with filters
		if (type === "all" || type === "corporate") {
			const corpBonds = await db
				.select()
				.from(schema.bondCatalog)
				.where(eq(schema.bondCatalog.tradingStatus, "active"))
				.limit(Number.parseInt(limit as string));

			bonds.push(
				...corpBonds.map((b) => {
					const maturityDate = b.maturityDate ? new Date(b.maturityDate) : null;
					const yearsToMaturity = maturityDate
						? Math.max(
								0,
								(maturityDate.getTime() - now.getTime()) /
									(365.25 * 24 * 60 * 60 * 1000),
							)
						: null;

					return {
						id: b.id,
						isin: b.isin,
						bondName: b.bondName || b.issuer,
						issuerName: b.issuer,
						instrumentType: b.bondType || "corporate_bond",
						displayType:
							b.bondType === "ncd"
								? "NCD"
								: b.bondType === "infrastructure"
									? "Infrastructure Bond"
									: "Corporate Bond",
						couponRate: b.couponRate,
						yieldToMaturity: b.yieldToMaturity,
						maturityDate: b.maturityDate,
						yearsToMaturity: yearsToMaturity
							? Math.round(yearsToMaturity * 10) / 10
							: null,
						creditRating: b.creditRating,
						ratingAgency: "CRISIL/ICRA",
						minInvestment: b.minimumLotSize || b.minimumInvestment || 10000,
						faceValue: b.faceValue || 1000,
						taxCategory: b.bondType === "tax_free" ? "tax_free" : "taxable",
						isTaxFree: b.bondType === "tax_free",
						isListed: b.tradingStatus === "active",
						exchange: "NSE/BSE",
						lastUpdated: b.lastUpdated,
						lastPrice: b.currentPrice,
						source: "corporate_bonds",
					};
				}),
			);
		}

		// Fetch published bonds from admin-managed bond catalog
		const catalogBonds = await db
			.select()
			.from(schema.bondCatalog)
			.where(eq(schema.bondCatalog.status, "published"))
			.limit(Number.parseInt(limit as string));

		bonds.push(
			...catalogBonds.map((b) => {
				const maturityDate = b.maturityDate ? new Date(b.maturityDate) : null;
				const yearsToMaturity = maturityDate
					? Math.max(
							0,
							(maturityDate.getTime() - now.getTime()) /
								(365.25 * 24 * 60 * 60 * 1000),
						)
					: null;

				const instrumentTypeMap: Record<string, string> = {
					gsec: "Government Security",
					sgb: "Sovereign Gold Bond",
					treasury_bill: "Treasury Bill",
					state_development_loan: "State Development Loan",
					corporate_bond: "Corporate Bond",
					ncd: "NCD",
					infrastructure_bond: "Infrastructure Bond",
					tax_free_bond: "Tax Free Bond",
					psu_bond: "PSU Bond",
					perpetual_bond: "Perpetual Bond",
					zero_coupon_bond: "Zero Coupon Bond",
					floating_rate_bond: "Floating Rate Bond",
				};

				return {
					id: b.id,
					isin: b.isin,
					bondName: b.bondName,
					issuerName: b.issuerName || "Unknown Issuer",
					instrumentType: b.instrumentType || "corporate_bond",
					displayType:
						instrumentTypeMap[b.instrumentType || "corporate_bond"] || "Bond",
					couponRate: b.couponRate,
					yieldToMaturity: b.yieldToMaturity,
					netYieldToMaturity: b.netYieldToMaturity,
					maturityDate: b.maturityDate,
					yearsToMaturity: yearsToMaturity
						? Math.round(yearsToMaturity * 10) / 10
						: null,
					creditRating: b.creditRating,
					ratingAgency: b.ratingAgency || "CRISIL/ICRA",
					minInvestment: b.minimumInvestment
						? Number.parseInt(b.minimumInvestment)
						: 10000,
					faceValue: b.faceValue ? Number.parseInt(b.faceValue) : 1000,
					taxCategory:
						b.instrumentType === "tax_free_bond" ? "tax_free" : "taxable",
					isTaxFree: b.instrumentType === "tax_free_bond",
					isListed: b.isListed,
					exchange: b.exchange || "NSE/BSE",
					lastUpdated: b.updatedAt,
					cleanPrice: b.cleanPrice,
					kycTierRequired: b.kycTierRequired,
					source: "bond_catalog",
					publishedAt: b.publishedAt,
				};
			}),
		);

		// Apply client-side filters
		let filteredBonds = bonds;

		// Credit rating filter
		if (creditRating && creditRating !== "all") {
			const ratings = (creditRating as string).split(",");
			filteredBonds = filteredBonds.filter((b) => {
				if (!b.creditRating) return false;
				return ratings.some((r) => b.creditRating.includes(r));
			});
		}

		// Yield filter
		if (minYield) {
			const min = Number.parseFloat(minYield as string);
			filteredBonds = filteredBonds.filter(
				(b) => Number.parseFloat(b.yieldToMaturity || "0") >= min,
			);
		}
		if (maxYield) {
			const max = Number.parseFloat(maxYield as string);
			filteredBonds = filteredBonds.filter(
				(b) => Number.parseFloat(b.yieldToMaturity || "0") <= max,
			);
		}

		// Maturity years filter
		if (minMaturityYears) {
			const min = Number.parseFloat(minMaturityYears as string);
			filteredBonds = filteredBonds.filter(
				(b) => (b.yearsToMaturity || 0) >= min,
			);
		}
		if (maxMaturityYears) {
			const max = Number.parseFloat(maxMaturityYears as string);
			filteredBonds = filteredBonds.filter(
				(b) => (b.yearsToMaturity || Number.POSITIVE_INFINITY) <= max,
			);
		}

		// Tax category filter
		if (taxCategory && taxCategory !== "all") {
			filteredBonds = filteredBonds.filter(
				(b) => b.taxCategory === taxCategory,
			);
		}

		// Min investment filter
		if (minInvestment) {
			const min = Number.parseFloat(minInvestment as string);
			filteredBonds = filteredBonds.filter(
				(b) => (b.minInvestment || 0) <= min,
			);
		}

		// Sort
		filteredBonds.sort((a, b) => {
			let aVal, bVal;
			switch (sortBy) {
				case "yield":
					aVal = Number.parseFloat(a.yieldToMaturity || "0");
					bVal = Number.parseFloat(b.yieldToMaturity || "0");
					break;
				case "maturity":
					aVal = a.yearsToMaturity || 0;
					bVal = b.yearsToMaturity || 0;
					break;
				case "rating":
					aVal = a.creditRating || "ZZZ";
					bVal = b.creditRating || "ZZZ";
					break;
				case "minInvestment":
					aVal = a.minInvestment || 0;
					bVal = b.minInvestment || 0;
					break;
				default:
					aVal = Number.parseFloat(a.yieldToMaturity || "0");
					bVal = Number.parseFloat(b.yieldToMaturity || "0");
			}
			return sortOrder === "asc"
				? aVal > bVal
					? 1
					: -1
				: aVal < bVal
					? 1
					: -1;
		});

		// Pagination
		const offsetNum = Number.parseInt(offset as string);
		const limitNum = Number.parseInt(limit as string);
		const paginatedBonds = filteredBonds.slice(offsetNum, offsetNum + limitNum);

		return apiResponse.success(res, {
			bonds: paginatedBonds,
			total: filteredBonds.length,
			filters: {
				creditRatings: [
					"SOV",
					"AAA",
					"AA+",
					"AA",
					"AA-",
					"A+",
					"A",
					"A-",
					"BBB+",
					"BBB",
				],
				taxCategories: ["all", "taxable", "tax_free"],
				maturityRanges: [
					{ label: "0-1 Year", min: 0, max: 1 },
					{ label: "1-3 Years", min: 1, max: 3 },
					{ label: "3-5 Years", min: 3, max: 5 },
					{ label: "5-10 Years", min: 5, max: 10 },
					{ label: "10+ Years", min: 10, max: null },
				],
			},
			pagination: {
				offset: offsetNum,
				limit: limitNum,
				hasMore: offsetNum + limitNum < filteredBonds.length,
			},
		});
	} catch (error: any) {
		console.error("Error in enhanced catalog:", error);
		return apiResponse.serverError(res, "Failed to fetch bond catalog");
	}
});

/**
 * GET /api/bonds/maturity-ladder
 * Group bonds by maturity buckets for planning
 */
router.get("/maturity-ladder", async (req: Request, res: Response) => {
	try {
		const now = new Date();

		// Fetch all bonds
		const [govBonds, corpBonds] = await Promise.all([
			db
				.select()
				.from(schema.governmentSecurities)
				.where(eq(schema.governmentSecurities.tradingStatus, "active")),
			db
				.select()
				.from(schema.bondCatalog)
				.where(eq(schema.bondCatalog.tradingStatus, "active")),
		]);

		const allBonds = [
			...govBonds.map((b) => ({
				isin: b.isin,
				bondName: b.securityName,
				instrumentType: "government",
				couponRate: b.couponRate,
				yieldToMaturity: b.yieldToMaturity,
				maturityDate: b.maturityDate,
				creditRating: "SOV",
			})),
			...corpBonds.map((b) => ({
				isin: b.isin,
				bondName: b.bondName || b.issuer,
				instrumentType: "corporate",
				couponRate: b.couponRate,
				yieldToMaturity: b.yieldToMaturity,
				maturityDate: b.maturityDate,
				creditRating: b.creditRating,
			})),
		];

		// Group by maturity buckets
		const buckets = [
			{ label: "0-6 Months", minMonths: 0, maxMonths: 6, bonds: [] as any[] },
			{ label: "6-12 Months", minMonths: 6, maxMonths: 12, bonds: [] as any[] },
			{ label: "1-2 Years", minMonths: 12, maxMonths: 24, bonds: [] as any[] },
			{ label: "2-3 Years", minMonths: 24, maxMonths: 36, bonds: [] as any[] },
			{ label: "3-5 Years", minMonths: 36, maxMonths: 60, bonds: [] as any[] },
			{ label: "5-7 Years", minMonths: 60, maxMonths: 84, bonds: [] as any[] },
			{
				label: "7-10 Years",
				minMonths: 84,
				maxMonths: 120,
				bonds: [] as any[],
			},
			{
				label: "10+ Years",
				minMonths: 120,
				maxMonths: Number.POSITIVE_INFINITY,
				bonds: [] as any[],
			},
		];

		allBonds.forEach((bond) => {
			if (!bond.maturityDate) return;

			const maturityDate = new Date(bond.maturityDate);
			const monthsToMaturity =
				(maturityDate.getTime() - now.getTime()) /
				(30.44 * 24 * 60 * 60 * 1000);

			if (monthsToMaturity < 0) return; // Skip matured bonds

			const bucket = buckets.find(
				(b) =>
					monthsToMaturity >= b.minMonths && monthsToMaturity < b.maxMonths,
			);
			if (bucket) {
				bucket.bonds.push({
					...bond,
					monthsToMaturity: Math.round(monthsToMaturity),
				});
			}
		});

		// Calculate bucket statistics
		const ladderData = buckets.map((bucket) => {
			const yields = bucket.bonds
				.map((b) => Number.parseFloat(b.yieldToMaturity || "0"))
				.filter((y) => y > 0);
			return {
				label: bucket.label,
				bondCount: bucket.bonds.length,
				avgYield:
					yields.length > 0
						? Math.round(
								(yields.reduce((a, b) => a + b, 0) / yields.length) * 100,
							) / 100
						: null,
				minYield: yields.length > 0 ? Math.min(...yields) : null,
				maxYield: yields.length > 0 ? Math.max(...yields) : null,
				bonds: bucket.bonds.slice(0, 5), // Return top 5 per bucket
			};
		});

		return apiResponse.success(res, { ladder: ladderData });
	} catch (error: any) {
		console.error("Error in maturity ladder:", error);
		return apiResponse.serverError(res, "Failed to generate maturity ladder");
	}
});

/**
 * POST /api/bonds/compare
 * Compare multiple bonds side-by-side
 */
router.post("/compare", async (req: Request, res: Response) => {
	try {
		const { isins } = req.body;

		if (
			!isins ||
			!Array.isArray(isins) ||
			isins.length < 2 ||
			isins.length > 4
		) {
			return apiResponse.badRequest(
				res,
				"Please provide 2-4 bond ISINs for comparison",
			);
		}

		const bonds: any[] = [];

		for (const isin of isins) {
			// Try government securities first
			const [govBond] = await db
				.select()
				.from(schema.governmentSecurities)
				.where(eq(schema.governmentSecurities.isin, isin));

			if (govBond) {
				bonds.push({
					isin: govBond.isin,
					bondName: govBond.securityName,
					issuerName: "Government of India",
					instrumentType: "government",
					couponRate: govBond.couponRate,
					yieldToMaturity: govBond.yieldToMaturity,
					maturityDate: govBond.maturityDate,
					creditRating: "SOV",
					minInvestment: govBond.minimumInvestment || "10000",
					faceValue: govBond.faceValue || "100",
					taxCategory: "taxable",
					riskLevel: "Very Low",
					liquidityRating: "High",
				});
				continue;
			}

			// Try corporate bonds
			const [corpBond] = await db
				.select()
				.from(schema.bondCatalog)
				.where(eq(schema.bondCatalog.isin, isin));

			if (corpBond) {
				const riskLevel = getRiskLevel(corpBond.creditRating || "");
				bonds.push({
					isin: corpBond.isin,
					bondName: corpBond.bondName || corpBond.issuer,
					issuerName: corpBond.issuer,
					instrumentType: corpBond.bondType || "corporate",
					couponRate: corpBond.couponRate,
					yieldToMaturity: corpBond.yieldToMaturity,
					maturityDate: corpBond.maturityDate,
					creditRating: corpBond.creditRating,
					minInvestment: corpBond.minimumLotSize || 10000,
					faceValue: corpBond.faceValue || "1000",
					taxCategory:
						corpBond.bondType === "tax_free" ? "tax_free" : "taxable",
					riskLevel,
					liquidityRating:
						corpBond.tradingStatus === "active" ? "Medium" : "Low",
				});
			}
		}

		// Generate comparison metrics
		const comparison = {
			bonds,
			metrics: {
				highestYield: bonds.reduce(
					(max, b) =>
						Number.parseFloat(b.yieldToMaturity || "0") >
						Number.parseFloat(max.yieldToMaturity || "0")
							? b
							: max,
					bonds[0],
				)?.isin,
				lowestRisk: bonds.reduce(
					(min, b) =>
						getRiskScore(b.creditRating) < getRiskScore(min.creditRating)
							? b
							: min,
					bonds[0],
				)?.isin,
				shortestMaturity: bonds.reduce(
					(min, b) =>
						new Date(b.maturityDate || "2099-12-31") <
						new Date(min.maturityDate || "2099-12-31")
							? b
							: min,
					bonds[0],
				)?.isin,
				lowestMinInvestment: bonds.reduce(
					(min, b) =>
						(b.minInvestment || Number.POSITIVE_INFINITY) <
						(min.minInvestment || Number.POSITIVE_INFINITY)
							? b
							: min,
					bonds[0],
				)?.isin,
			},
		};

		return apiResponse.success(res, comparison);
	} catch (error: any) {
		console.error("Error in bond comparison:", error);
		return apiResponse.serverError(res, "Failed to compare bonds");
	}
});

// =====================================================
// TASK 2: Investor Eligibility Visibility
// =====================================================

/**
 * GET /api/bonds/eligibility/:isin
 * Check user eligibility for a specific bond
 */
router.get(
	"/eligibility/:isin",
	requireAuth,
	async (req: Request, res: Response) => {
		try {
			const { isin } = req.params;
			const userId = (req.user as any)?.id;

			if (!userId) {
				return apiResponse.unauthorized(res, "Authentication required");
			}

			// Get user's KYC profile from users table
			const [userProfile] = await db
				.select()
				.from(schema.users)
				.where(eq(schema.users.id, userId));

			// Get bond details
			let bond: any = null;
			let bondType = "unknown";
			let isListed = true;
			let minInvestment = 10000;

			const [govBond] = await db
				.select()
				.from(schema.governmentSecurities)
				.where(eq(schema.governmentSecurities.isin, isin));

			if (govBond) {
				bond = govBond;
				bondType = govBond.securityType || "gsec";
				minInvestment = Number.parseInt(govBond.minimumInvestment || "10000");
			} else {
				const [corpBond] = await db
					.select()
					.from(schema.bondCatalog)
					.where(eq(schema.bondCatalog.isin, isin));

				if (corpBond) {
					bond = corpBond;
					bondType = corpBond.bondType || "corporate";
					isListed = corpBond.tradingStatus === "active";
					minInvestment = corpBond.minimumLotSize || 10000;
				}
			}

			if (!bond) {
				return apiResponse.notFound(res, "Bond not found");
			}

			// Determine required tier
			const requiredTier = determineRegulatoryTier(
				bondType,
				minInvestment,
				isListed,
			);
			const tierCheck = await checkTierEligibility(userId, requiredTier);

			// Get user's current tier
			const userTier = (userProfile as any)?.kycTier || "none";
			const tierOrder = [
				"none",
				"basic",
				"tier_1",
				"tier_2",
				"tier_3",
				"enhanced",
				"accredited",
			];
			const requiredTierStr = String(requiredTier);

			return apiResponse.success(res, {
				isin,
				bondName: bond.securityName || bond.bondName || bond.issuer,
				bondType,
				isListed,
				eligibility: {
					isEligible: tierCheck.eligible,
					missingRequirements: tierCheck.missingRequirements,
					userTier,
					requiredTier: requiredTierStr,
					upgradeRequired:
						tierOrder.indexOf(userTier) < tierOrder.indexOf(requiredTierStr),
					upgradePath: tierCheck.eligible
						? null
						: getUpgradePath(userTier, requiredTierStr),
				},
				requirements: {
					minInvestment,
					kycDocumentsRequired: getKycDocumentsForTier(requiredTierStr),
					riskDisclosuresRequired: !isListed || requiredTierStr === "tier_3",
				},
			});
		} catch (error: any) {
			console.error("Error checking eligibility:", error);
			return apiResponse.serverError(res, "Failed to check eligibility");
		}
	},
);

/**
 * GET /api/bonds/my-eligibility-summary
 * Get summary of what bonds user can access
 */

export default router;
