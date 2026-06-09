// @ts-nocheck
import { Router, Request, Response } from "express";
import { storage } from "../storage";
import multer from "multer";
import { db } from "../db";
import { portfolios, portfolioHoldings, prospectLeads } from "@shared/schema";
import { eq, inArray, or, desc as descOrd } from "drizzle-orm";
import {
	agentProspectWizardService,
	ProspectPortfolioHolding,
	ProspectRiskProfile,
	DuplicateCheckResult,
	getListedStocksBySector,
	getAvailableBroadSectors,
	getListedStockRecommendations,
	getUnlistedStocksBySector,
	getAvailableUnlistedSectors,
	getUnlistedStockRecommendations,
	populateUnlistedBroadSectors,
	isSipRestricted,
} from "../services/agent-prospect-wizard-service";
import { schemeGovernanceService } from "../services/scheme-governance-service";
import { z } from "zod";
import { ZohoCRMService } from "../zoho/services/crm";
import { ZohoConnectionResolver } from "../zoho/connection-resolver";
import { unifiedPortfolioImportService } from "../services/unified-portfolio-import-service";
import { assertLotsNotDropped } from "../services/holding-transformer";
import { requireAuth, requireRole } from "../middleware/roleMiddleware";
import { prospectReadinessService } from "../services/prospect-readiness-service";
import { portfolioAnalyticsDataService } from "../services/portfolio-analytics-data-service";
import {
	enrichAndScoreProspect,
	bulkScoreProspects,
	getSectorBenchmarks,
	getBenchmarkForSegment,
	bustBenchmarkCache,
} from "../services/prospect-scoring-engine";
import { prospectScoreHistory } from "@shared/schema";

// Multer setup for CAS file upload
const upload = multer({
	storage: multer.memoryStorage(),
	limits: { fileSize: 15 * 1024 * 1024 },
	fileFilter: (req, file, cb) => {
		if (
			file.mimetype === "application/pdf" ||
			file.mimetype === "application/x-pdf"
		) {
			cb(null, true);
		} else {
			cb(new Error("Only PDF files are allowed"));
		}
	},
});

const router = Router();

const createProspectSchema = z.object({
	name: z.string().min(2),
	email: z
		.string()
		.email()
		.optional()
		.or(z.literal(""))
		.transform((v) => v || undefined),
	mobile: z
		.string()
		.optional()
		.transform((v) => v?.trim() || undefined),
	pan: z
		.string()
		.optional()
		.transform((v) => {
			const trimmed = v?.trim().toUpperCase();
			if (!trimmed || trimmed.length === 0) return undefined;
			if (trimmed.length !== 10) return undefined; // Invalid PAN length, treat as no PAN
			return trimmed;
		}),
	clientType: z.string().optional(),
	indicativeRiskProfile: z.string().optional(),
	notes: z.string().optional(),
});

const riskProfileSchema = z.object({
	riskTolerance: z.enum([
		"conservative",
		"moderate",
		"aggressive",
		"very_aggressive",
	]),
	investmentHorizon: z.enum([
		"3_months",
		"6_months",
		"9_months",
		"1_year",
		"short_term",
		"medium_term",
		"long_term",
	]),
	primaryGoal: z.string(),
	monthlyIncome: z.number().optional(),
	existingInvestments: z.number().optional(),
	liquidityNeeds: z.enum(["low", "medium", "high"]).optional(),
});

const portfolioHoldingSchema = z.object({
	productType: z.string(),
	productName: z.string(),
	quantity: z.number(),
	currentValue: z.number(),
	purchasePrice: z.number().optional(),
	purchaseDate: z.string().optional(),
	isin: z.string().optional(),
	category: z.string().optional(),
});

// Backend format schema for holdings persistence (uses name/assetType/productType)
const backendHoldingSchema = z.object({
	id: z.string().optional(),
	name: z.string(),
	isin: z.string().optional(),
	symbol: z.string().optional(),
	assetType: z.enum([
		"equity",
		"mutual_fund",
		"etf",
		"bond",
		"gold",
		"fd",
		"other",
	]),
	productType: z.string().optional(), // Preserves original type (pms, aif, insurance)
	quantity: z.number(),
	averageCost: z.number().optional(),
	purchasePrice: z.number().optional(),
	purchaseDate: z.string().optional(),
	currentValue: z.number(),
	currentNav: z.number().optional(),
	investedValue: z.number().optional(),
	unrealizedGain: z.number().optional(),
	unrealizedGainPercent: z.number().optional(),
	folioNumber: z.string().optional(),
	broker: z.string().optional(),
	confidenceScore: z.number().optional(),
	category: z.string().optional(),
});

// Lot schema for capital gains tracking - supports multiple date formats from CAS parser
// Note: All date fields are optional for backward compatibility, but at least one should be present for tax calculations
const holdingLotSchema = z.object({
	purchaseDate: z.string().optional(),
	transactionDate: z.union([z.string(), z.date()]).optional(),
	transactionDateStr: z.string().optional(),
	transactionType: z.string().optional(),
	units: z.coerce.number(),
	nav: z.coerce.number(),
	amount: z.coerce.number().optional(),
	stampDuty: z.coerce.number().optional(),
	stt: z.coerce.number().optional(),
	grandfatheredValue: z.coerce.number().optional(),
	isGrandfathered: z.boolean().optional(),
});

// Flexible schema that accepts both frontend (productName/productType) and backend (name/assetType) formats
const flexibleHoldingSchema = z.object({
	id: z.string().optional(),
	name: z.string().optional(),
	productName: z.string().optional(),
	isin: z.string().optional(),
	symbol: z.string().optional(),
	assetType: z
		.enum(["equity", "mutual_fund", "etf", "bond", "gold", "fd", "other"])
		.optional(),
	productType: z.string().optional(),
	quantity: z.coerce.number(),
	averageCost: z.coerce.number().optional(),
	currentValue: z.coerce.number(),
	currentNav: z.coerce.number().optional(),
	investedValue: z.coerce.number().optional(),
	unrealizedGain: z.coerce.number().optional(),
	unrealizedGainPercent: z.coerce.number().optional(),
	purchasePrice: z.coerce.number().optional(),
	purchaseDate: z.string().optional(),
	folioNumber: z.string().optional(),
	broker: z.string().optional(),
	confidenceScore: z.coerce.number().optional(),
	category: z.string().optional(),
	// Lot-level data for capital gains tracking (from CAS parsing)
	firstPurchaseDate: z.string().optional(),
	lots: z.array(holdingLotSchema).optional(),
	holdingTier: z.string().optional(),
	eligibleForTax: z.boolean().optional(),
	amc: z.string().optional(),
});

// Helper to normalize holdings to backend format
function normalizeHoldings(holdings: any[]): any[] {
	return holdings.map((h) => {
		const name = h.name || h.productName || "Unknown";
		let assetType = h.assetType;
		if (!assetType && h.productType) {
			const typeMap: Record<string, string> = {
				mutual_fund: "mutual_fund",
				equity: "equity",
				stock: "equity",
				etf: "etf",
				bond: "bond",
				gold: "gold",
				fd: "fd",
			};
			assetType = typeMap[h.productType.toLowerCase()] || "other";
		}
		return {
			...h,
			name,
			assetType: assetType || "other",
			quantity: h.quantity || 0,
			currentValue: h.currentValue || 0,
		};
	});
}

const customAllocationsSchema = z.object({
	equity: z.number().min(0).max(100).default(0),
	debt: z.number().min(0).max(100).default(0),
	hybrid: z.number().min(0).max(100).default(0),
	gold: z.number().min(0).max(100).default(0),
	silver: z.number().min(0).max(100).default(0),
	index: z.number().min(0).max(100).default(0),
	etf: z.number().min(0).max(100).default(0),
	listed_stocks: z.number().min(0).max(100).default(0),
	unlisted_stocks: z.number().min(0).max(100).default(0),
	reit: z.number().min(0).max(100).default(0),
	invit: z.number().min(0).max(100).default(0),
	bonds: z.number().min(0).max(100).default(0),
	mld: z.number().min(0).max(100).default(0),
	pms: z.number().min(0).max(100).default(0),
	aif: z.number().min(0).max(100).default(0),
	global_advisory: z.number().min(0).max(100).default(0),
	us_markets: z.number().min(0).max(100).default(0),
	europe_markets: z.number().min(0).max(100).default(0),
	asia_pacific_markets: z.number().min(0).max(100).default(0),
	emerging_markets: z.number().min(0).max(100).default(0),
	international: z.number().min(0).max(100).default(0),
});

const globalAdvisorySelectionsSchema = z
	.record(z.string(), z.array(z.string()))
	.optional();

const proposalSectionsSchema = z
	.object({
		exitLoadCalendar: z.boolean().default(true),
		capitalGainsSummary: z.boolean().default(true),
		portfolioHealthScore: z.boolean().default(true),
		expenseRatioAnalysis: z.boolean().default(true),
		dividendProjection: z.boolean().default(true),
		riskHeatmap: z.boolean().default(true),
		goalGapAnalysis: z.boolean().default(true),
		benchmarkComparison: z.boolean().default(true),
		priorityRecommendations: z.boolean().default(true),
		sipRecommendations: z.boolean().default(true),
		whatIfSimulator: z.boolean().default(true),
		executiveSummary: z.boolean().default(true),
	})
	.optional();

const generateProposalSchema = z.object({
	prospectId: z.string(),
	prospectData: z.object({
		name: z.string(),
		email: z.string().optional(),
		mobile: z.string().optional(),
		pan: z.string().optional(),
	}),
	holdings: z.array(flexibleHoldingSchema),
	riskProfile: riskProfileSchema,
	freshInvestmentAmount: z.number().min(0),
	customAllocations: customAllocationsSchema.optional(),
	selectedCategories: z.array(z.string()).optional(),
	investmentGoals: z
		.array(
			z.object({
				goalType: z.string(),
				targetAmount: z.number(),
				timelineYears: z.number(),
				monthlyContribution: z.number(),
				priority: z.string().optional(),
			}),
		)
		.optional(),
	globalAdvisorySelections: globalAdvisorySelectionsSchema,
	proposalSections: proposalSectionsSchema,
	analyticsData: z.any().optional(),
});

router.post(
	"/prospects/:id/goals",
	requireAuth,
	requireRole(["admin", "agent", "ops"]),
	async (req: Request, res: Response) => {
		try {
			const { id: prospectId } = req.params;
			const { goals } = req.body;
			const agentId = (req as any).user?.id;

			if (!goals || !Array.isArray(goals)) {
				return res
					.status(400)
					.json({ success: false, error: "Goals array is required" });
			}

			// Get prospect details
			const prospect = await agentProspectWizardService.getProspect(prospectId);
			if (!prospect) {
				return res
					.status(404)
					.json({ success: false, error: "Prospect not found" });
			}

			// Try to find matching user by email, mobile, or PAN
			const { db } = await import("../db");
			const { users, financialGoals } = await import("@shared/schema");
			const { eq, or, and, isNotNull } = await import("drizzle-orm");

			let matchedUserId: string | null = null;

			// Build conditions for matching
			const conditions = [];
			if (prospect.email) conditions.push(eq(users.email, prospect.email));
			if (prospect.mobile) conditions.push(eq(users.mobile, prospect.mobile));
			if (prospect.pan) conditions.push(eq(users.panNumber, prospect.pan));

			if (conditions.length > 0) {
				const matchedUser = await db
					.select({ id: users.id })
					.from(users)
					.where(or(...conditions))
					.limit(1);

				if (matchedUser.length > 0) {
					matchedUserId = matchedUser[0].id;
				}
			}

			// Map goal types to database categories
			const goalCategoryMap: Record<string, string> = {
				retirement: "retirement",
				child_education: "education",
				house_purchase: "home_purchase",
				wealth_creation: "wealth_building",
				emergency_fund: "emergency",
				car_purchase: "car",
				vacation: "travel",
				wedding: "wedding",
				business: "wealth_building",
				other: "custom",
			};

			// Delete existing goals for this prospect (to avoid duplicates on re-save)
			await db
				.delete(financialGoals)
				.where(eq(financialGoals.prospectId, prospectId));

			// Save goals
			const savedGoals = [];
			for (const goal of goals) {
				const validated = prospectGoalSchema.parse(goal);

				// Calculate target date from years
				const targetDate = new Date();
				targetDate.setFullYear(
					targetDate.getFullYear() + validated.timelineYears,
				);

				// Map risk profile from priority
				const riskProfileMap: Record<string, string> = {
					high: "aggressive",
					medium: "moderate",
					low: "conservative",
				};

				const savedGoal = await db
					.insert(financialGoals)
					.values({
						userId: matchedUserId,
						prospectId: matchedUserId ? null : prospectId,
						createdByAgentId: agentId,
						name: validated.goalName,
						goalType:
							validated.timelineYears <= 3
								? "short_term"
								: validated.timelineYears <= 7
									? "medium_term"
									: "long_term",
						category: goalCategoryMap[validated.goalType] || "custom",
						targetAmount: validated.targetAmount.toString(),
						currentAmount: validated.currentProgress.toString(),
						monthlyContribution: validated.monthlyContribution.toString(),
						targetDate,
						riskProfile: riskProfileMap[validated.priority] || "moderate",
						priority: validated.priority,
					})
					.returning();

				savedGoals.push(savedGoal[0]);
			}

			res.json({
				success: true,
				message: matchedUserId
					? `Saved ${savedGoals.length} goals linked to existing client account`
					: `Saved ${savedGoals.length} goals for prospect (will link when they register)`,
				matchedToUser: !!matchedUserId,
				goalIds: savedGoals.map((g) => g.id),
			});
		} catch (error: any) {
			console.error("[Save Prospect Goals] Error:", error);
			res.status(500).json({ success: false, error: error.message });
		}
	},
);

// Get prospect goals
router.get(
	"/prospects/:id/goals",
	requireAuth,
	requireRole(["admin", "agent", "ops"]),
	async (req: Request, res: Response) => {
		try {
			const { id: prospectId } = req.params;

			const { db } = await import("../db");
			const { financialGoals } = await import("@shared/schema");
			const { eq, or } = await import("drizzle-orm");

			// Get prospect to check for matched user
			const prospect = await agentProspectWizardService.getProspect(prospectId);
			if (!prospect) {
				return res
					.status(404)
					.json({ success: false, error: "Prospect not found" });
			}

			// Fetch goals by prospectId or matched userId
			const { users } = await import("@shared/schema");
			let matchedUserId: string | null = null;

			const conditions = [];
			if (prospect.email) conditions.push(eq(users.email, prospect.email));
			if (prospect.mobile) conditions.push(eq(users.mobile, prospect.mobile));
			if (prospect.pan) conditions.push(eq(users.panNumber, prospect.pan));

			if (conditions.length > 0) {
				const matchedUser = await db
					.select({ id: users.id })
					.from(users)
					.where(or(...conditions))
					.limit(1);

				if (matchedUser.length > 0) {
					matchedUserId = matchedUser[0].id;
				}
			}

			// Build query conditions
			const goalConditions = [eq(financialGoals.prospectId, prospectId)];
			if (matchedUserId) {
				goalConditions.push(eq(financialGoals.userId, matchedUserId));
			}

			const goals = await db
				.select()
				.from(financialGoals)
				.where(or(...goalConditions));

			res.json({
				success: true,
				goals: goals.map((g) => ({
					id: g.id,
					goalType: g.category,
					goalName: g.name,
					targetAmount: Number.parseFloat(g.targetAmount || "0"),
					timelineYears: Math.ceil(
						(new Date(g.targetDate!).getTime() - Date.now()) /
							(365.25 * 24 * 60 * 60 * 1000),
					),
					priority: g.priority || "medium",
					currentProgress: Number.parseFloat(g.currentAmount || "0"),
					monthlyContribution: Number.parseFloat(g.monthlyContribution || "0"),
					linkedToUser: !!g.userId,
				})),
				matchedToUser: !!matchedUserId,
			});
		} catch (error: any) {
			console.error("[Get Prospect Goals] Error:", error);
			res.status(500).json({ success: false, error: error.message });
		}
	},
);

// ── Wealth Engine + Scoring Engine endpoints ──────────────────────────────────

/**
 * POST /api/prospect-wizard/prospects/:id/compute-score
 *
 * Runs the Wealth Engine + Scoring Engine for a single prospect lead.
 * Optionally accepts { relationshipStrength: number } in the body.
 */
router.post(
	"/prospects/:id/compute-score",
	requireAuth,
	async (req: Request, res: Response) => {
		try {
			const { id } = req.params;
			const relationshipStrength = req.body?.relationshipStrength;

			const result = await enrichAndScoreProspect(id, {
				relationshipStrength:
					typeof relationshipStrength === "number"
						? relationshipStrength
						: undefined,
			});

			res.json({ success: true, prospectId: id, scoring: result });
		} catch (error: any) {
			console.error("[Compute Score] Error:", error);
			res.status(500).json({ success: false, error: error.message });
		}
	},
);

/**
 * POST /api/prospect-wizard/prospects/bulk-score
 *
 * Batch-runs the scoring engine across all (or up to `limit`) prospect leads.
 * Body: { limit?: number, relationshipStrength?: number }
 */
router.post(
	"/prospects/bulk-score",
	requireAuth,
	async (req: Request, res: Response) => {
		try {
			const limit = typeof req.body?.limit === "number" ? req.body.limit : 50;
			const relationshipStrength =
				typeof req.body?.relationshipStrength === "number"
					? req.body.relationshipStrength
					: undefined;
			const staleAfterDays =
				typeof req.body?.staleAfterDays === "number"
					? req.body.staleAfterDays
					: undefined;
			const triggeredBy: string = req.body?.triggeredBy ?? "admin_manual";

			const result = await bulkScoreProspects({
				limit,
				relationshipStrength,
				staleAfterDays,
				triggeredBy,
			});
			bustBenchmarkCache(); // sector averages changed after scoring

			res.json({ success: true, result });
		} catch (error: any) {
			console.error("[Bulk Score] Error:", error);
			res.status(500).json({ success: false, error: error.message });
		}
	},
);

/**
 * GET /api/agent-wizard/prospects/:id/score
 *
 * Returns the current saved score for a prospect (no recomputation).
 */
router.get(
	"/prospects/:id/score",
	requireAuth,
	async (req: Request, res: Response) => {
		try {
			const { id } = req.params;
			const rows = await db
				.select({
					id: prospectLeads.id,
					companyName: prospectLeads.companyName,
					industrySegment: prospectLeads.industrySegment,
					estimatedNetworth: prospectLeads.estimatedNetworth,
					investableSurplus: prospectLeads.investableSurplus,
					wealthScore: prospectLeads.wealthScore,
					activityScore: prospectLeads.activityScore,
					relationshipScore: prospectLeads.relationshipScore,
					compositeScore: prospectLeads.compositeScore,
					scoringVersion: prospectLeads.scoringVersion,
					scoredAt: prospectLeads.scoredAt,
					leadQuality: prospectLeads.leadQuality,
				})
				.from(prospectLeads)
				.where(eq(prospectLeads.id, id))
				.limit(1);

			if (!rows.length) {
				return res
					.status(404)
					.json({ success: false, error: "Prospect not found" });
			}

			const row = rows[0];
			const scored =
				row.compositeScore !== null && row.compositeScore !== undefined;

			// Fetch sector benchmark if segment is known
			let sectorBenchmark = null;
			if (row.industrySegment) {
				sectorBenchmark = await getBenchmarkForSegment(row.industrySegment);
			}

			res.json({
				success: true,
				prospectId: id,
				companyName: row.companyName,
				scored,
				scoring: scored
					? {
							estimatedNetworth: Number.parseFloat(
								String(row.estimatedNetworth || "0"),
							),
							investableSurplus: Number.parseFloat(
								String(row.investableSurplus || "0"),
							),
							wealthScore: Number.parseFloat(String(row.wealthScore || "0")),
							activityScore: Number.parseFloat(
								String(row.activityScore || "0"),
							),
							relationshipScore: Number.parseFloat(
								String(row.relationshipScore || "0"),
							),
							compositeScore: Number.parseFloat(
								String(row.compositeScore || "0"),
							),
							scoringVersion: row.scoringVersion,
							scoredAt: row.scoredAt,
							leadQuality: row.leadQuality,
						}
					: null,
				sectorBenchmark,
			});
		} catch (error: any) {
			console.error("[Get Score] Error:", error);
			res.status(500).json({ success: false, error: error.message });
		}
	},
);

/**
 * GET /api/agent-wizard/prospects/:id/score-history
 *
 * Returns the scoring audit trail for a prospect (Upgrade 7).
 */
router.get(
	"/prospects/:id/score-history",
	requireAuth,
	async (req: Request, res: Response) => {
		try {
			const { id } = req.params;
			const limit = Math.min(
				Number.parseInt(String(req.query.limit || "20")),
				100,
			);

			const history = await db
				.select()
				.from(prospectScoreHistory)
				.where(eq(prospectScoreHistory.prospectId, id))
				.orderBy(descOrd(prospectScoreHistory.createdAt))
				.limit(limit);

			res.json({
				success: true,
				prospectId: id,
				history: history.map((h) => ({
					id: h.id,
					compositeScore: Number.parseFloat(String(h.compositeScore || "0")),
					wealthScore: Number.parseFloat(String(h.wealthScore || "0")),
					activityScore: Number.parseFloat(String(h.activityScore || "0")),
					relationshipScore: Number.parseFloat(
						String(h.relationshipScore || "0"),
					),
					financialHealthScore: Number.parseFloat(
						String(h.financialHealthScore || "0"),
					),
					estimatedNetworth: Number.parseFloat(
						String(h.estimatedNetworth || "0"),
					),
					investableSurplus: Number.parseFloat(
						String(h.investableSurplus || "0"),
					),
					leadQualityBefore: h.leadQualityBefore,
					leadQualityAfter: h.leadQualityAfter,
					scoringVersion: h.scoringVersion,
					triggeredBy: h.triggeredBy,
					createdAt: h.createdAt,
				})),
			});
		} catch (error: any) {
			console.error("[Score History] Error:", error);
			res.status(500).json({ success: false, error: error.message });
		}
	},
);

export default router;
