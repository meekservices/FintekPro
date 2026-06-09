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

router.get(
	"/prospects/:id/readiness-history",
	async (req: Request, res: Response) => {
		try {
			const agentId = (req as any).user?.id;
			if (!agentId) {
				return res
					.status(401)
					.json({ success: false, message: "Authentication required" });
			}

			const history = prospectReadinessService.getTransitionHistory(
				req.params.id,
			);
			res.json({ success: true, history });
		} catch (error: any) {
			console.error("[Agent Wizard] Error getting readiness history:", error);
			res.status(400).json({ success: false, message: error.message });
		}
	},
);

router.post(
	"/prospects/:id/tax-profile",
	async (req: Request, res: Response) => {
		try {
			const agentId = (req as any).user?.id;
			if (!agentId) {
				return res
					.status(401)
					.json({ success: false, message: "Authentication required" });
			}

			const { taxSlabCategory, residencyStatus, hasHuf, hasOtherIncome } =
				req.body;

			if (!taxSlabCategory || !residencyStatus) {
				return res.status(400).json({
					success: false,
					message: "Tax slab category and residency status are required",
				});
			}

			const readiness =
				await agentProspectWizardService.updateProspectTaxProfile(
					req.params.id,
					{
						taxSlabCategory,
						residencyStatus,
						hasHuf: !!hasHuf,
						hasOtherIncome: !!hasOtherIncome,
					},
				);

			res.json({ success: true, readiness });
		} catch (error: any) {
			console.error("[Agent Wizard] Error updating tax profile:", error);
			res.status(400).json({ success: false, message: error.message });
		}
	},
);

// POST endpoint to save imported holdings for prospects (used by portfolio import panel)
router.post(
	"/prospects/:id/portfolio/save",
	async (req: Request, res: Response) => {
		try {
			const agentId = (req as any).user?.id;
			if (!agentId) {
				return res
					.status(401)
					.json({ success: false, message: "Authentication required" });
			}

			const prospect = await agentProspectWizardService.getProspect(
				req.params.id,
			);
			if (!prospect) {
				return res
					.status(404)
					.json({ success: false, message: "Prospect not found" });
			}
			if (prospect.agentId !== agentId) {
				return res
					.status(403)
					.json({ success: false, message: "Access denied" });
			}

			const { holdings, source, replaceExisting } = req.body;

			if (!holdings || !Array.isArray(holdings)) {
				return res
					.status(400)
					.json({ success: false, message: "Holdings array required" });
			}

			// Normalize and validate holdings
			const flexibleHoldings = z.array(flexibleHoldingSchema).parse(holdings);
			const normalizedHoldings = normalizeHoldings(flexibleHoldings);

			// Get existing holdings if not replacing
			let finalHoldings = normalizedHoldings;
			if (!replaceExisting && prospect.currentPortfolio) {
				const existingHoldings = Array.isArray(prospect.currentPortfolio)
					? prospect.currentPortfolio
					: [];
				finalHoldings = [...existingHoldings, ...normalizedHoldings];
			}

			// Update prospect portfolio
			await agentProspectWizardService.updateProspectPortfolio(
				req.params.id,
				finalHoldings,
			);
			if (finalHoldings.length > 0) {
				await prospectReadinessService.advanceOnHoldingsImport(req.params.id);
			}

			console.log(
				`[Agent Wizard] Saved ${normalizedHoldings.length} imported holdings for prospect ${req.params.id} from source: ${source || "unknown"}`,
			);

			res.json({
				success: true,
				savedCount: normalizedHoldings.length,
				totalCount: finalHoldings.length,
			});
		} catch (error: any) {
			console.error("[Agent Wizard] Error saving imported holdings:", error);
			res.status(400).json({ success: false, message: error.message });
		}
	},
);

router.put(
	"/prospects/:id/risk-profile",
	async (req: Request, res: Response) => {
		try {
			const agentId = (req as any).user?.id;
			if (!agentId) {
				return res
					.status(401)
					.json({ success: false, message: "Authentication required" });
			}

			const prospect = await agentProspectWizardService.getProspect(
				req.params.id,
			);
			if (!prospect || prospect.agentId !== agentId) {
				return res
					.status(403)
					.json({ success: false, message: "Access denied" });
			}

			const riskProfile = riskProfileSchema.parse(req.body);
			await agentProspectWizardService.updateProspectRiskProfile(
				req.params.id,
				riskProfile as any,
			);
			res.json({ success: true });
		} catch (error: any) {
			console.error("[Agent Wizard] Error updating risk profile:", error);
			res.status(400).json({ success: false, message: error.message });
		}
	},
);

router.post("/analyze-portfolio", async (req: Request, res: Response) => {
	try {
		const agentId = (req as any).user?.id;
		if (!agentId) {
			return res
				.status(401)
				.json({ success: false, message: "Authentication required" });
		}

		const { holdings, riskProfile } = req.body;
		const flexibleHoldings = z.array(flexibleHoldingSchema).parse(holdings);
		const normalizedHoldings = normalizeHoldings(flexibleHoldings);
		const parsedRiskProfile = riskProfileSchema.parse(riskProfile);

		const analysis = agentProspectWizardService.analyzePortfolio(
			normalizedHoldings,
			parsedRiskProfile as any,
		);
		res.json({ success: true, analysis });
	} catch (error: any) {
		console.error("[Agent Wizard] Error analyzing portfolio:", error);
		res.status(400).json({ success: false, message: error.message });
	}
});

router.post("/rebalancing-suggestions", async (req: Request, res: Response) => {
	try {
		const agentId = (req as any).user?.id;
		if (!agentId) {
			return res
				.status(401)
				.json({ success: false, message: "Authentication required" });
		}

		const {
			holdings,
			riskProfile,
			analysis,
			customAllocations,
			selectedCategories,
		} = req.body;
		const flexibleHoldings = z.array(flexibleHoldingSchema).parse(holdings);
		const normalizedHoldings = normalizeHoldings(flexibleHoldings);
		const parsedRiskProfile = riskProfileSchema.parse(riskProfile);
		const parsedAllocations = customAllocations
			? customAllocationsSchema.parse(customAllocations)
			: undefined;

		const result =
			await agentProspectWizardService.generateRebalancingRecommendations(
				normalizedHoldings,
				parsedRiskProfile as any,
				analysis,
				parsedAllocations,
				0,
				selectedCategories,
			);

		// Handle both old array format and new object format
		const suggestions = Array.isArray(result) ? result : result.recommendations;
		const now = new Date();
		const fyYear =
			now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
		const currentFY = `FY ${fyYear}-${(fyYear + 1).toString().slice(-2)}`;
		const zeroTaxSummary = {
			totalSTCG: 0,
			totalLTCG: 0,
			stcgTax: 0,
			ltcgTax: 0,
			cess: 0,
			totalTaxLiability: 0,
			totalExitLoad: 0,
			netRebalancingCost: 0,
			taxLossHarvestingOpportunity: 0,
			grandfatheringBenefitTotal: 0,
			holdings: [],
			alerts: [],
			currentFY,
			disclosure:
				"No sell or switch trades are required for this rebalancing plan. Capital gains tax and exit load cost is ₹0.",
		};
		const taxSummary = Array.isArray(result)
			? zeroTaxSummary
			: result.taxSummary ?? zeroTaxSummary;

		res.json({ success: true, suggestions, taxSummary });
	} catch (error: any) {
		console.error("[Agent Wizard] Error generating rebalancing:", error);
		res.status(400).json({ success: false, message: error.message });
	}
});

router.post(
	"/fresh-investment-suggestions",
	async (req: Request, res: Response) => {
		try {
			const agentId = (req as any).user?.id;
			if (!agentId) {
				return res
					.status(401)
					.json({ success: false, message: "Authentication required" });
			}

			const {
				riskProfile,
				investmentAmount,
				existingHoldings,
				customAllocations,
				selectedCategories,
			} = req.body;
			const parsedRiskProfile = riskProfileSchema.parse(riskProfile);
			const parsedHoldings = existingHoldings
				? normalizeHoldings(
						z.array(flexibleHoldingSchema).parse(existingHoldings),
					)
				: [];
			const parsedAllocations = customAllocations
				? customAllocationsSchema.parse(customAllocations)
				: undefined;

			const suggestions =
				await agentProspectWizardService.generateFreshInvestmentSuggestions(
					parsedRiskProfile as any,
					investmentAmount || 0,
					parsedHoldings,
					parsedAllocations,
					selectedCategories,
				);
			res.json({ success: true, suggestions });
		} catch (error: any) {
			console.error(
				"[Agent Wizard] Error generating fresh investments:",
				error,
			);
			res.status(400).json({ success: false, message: error.message });
		}
	},
);

router.post("/generate-proposal", async (req: Request, res: Response) => {
	try {
		const agentId = (req as any).user?.id;
		if (!agentId) {
			return res
				.status(401)
				.json({ success: false, message: "Authentication required" });
		}

		const data = generateProposalSchema.parse(req.body);

		// Gate proposal generation with readiness check
		// Allow if holdings are present in the request body (wizard flow) even if DB status hasn't advanced
		const hasHoldingsInRequest =
			Array.isArray(data.holdings) && data.holdings.length > 0;
		if (data.prospectId && !hasHoldingsInRequest) {
			const readinessCheck = await prospectReadinessService.canGenerateProposal(
				data.prospectId,
			);
			if (!readinessCheck.allowed) {
				return res.status(400).json({
					success: false,
					code: "PROSPECT_NOT_READY",
					message: readinessCheck.reason,
					missingSteps: readinessCheck.missingSteps,
				});
			}
		}

		const normalizedHoldings = normalizeHoldings(data.holdings);

		const proposal = await agentProspectWizardService.createCombinedProposal(
			agentId,
			data.prospectId,
			data.prospectData,
			normalizedHoldings,
			data.riskProfile as any,
			data.freshInvestmentAmount,
			data.customAllocations,
			data.selectedCategories,
			data.globalAdvisorySelections,
			data.proposalSections,
			data.analyticsData,
			data.investmentGoals,
		);

		res.json({ success: true, proposal });
	} catch (error: any) {
		console.error("[Agent Wizard] Error generating proposal:", error);
		res.status(400).json({ success: false, message: error.message });
	}
});

router.post("/proposals/:id/share", async (req: Request, res: Response) => {
	try {
		const agentId = (req as any).user?.id;
		if (!agentId) {
			return res
				.status(401)
				.json({ success: false, message: "Authentication required" });
		}

		const { channel } = req.body;
		if (!["email", "whatsapp", "sms"].includes(channel)) {
			return res
				.status(400)
				.json({ success: false, message: "Invalid channel" });
		}

		const result = await agentProspectWizardService.shareProposal(
			req.params.id,
			channel,
			agentId,
		);
		res.json({ success: true, ...result });
	} catch (error: any) {
		console.error("[Agent Wizard] Error sharing proposal:", error);
		res.status(400).json({ success: false, message: error.message });
	}
});

// EPIC 4: Proposal Version Timeline
router.get("/proposal-versions/:id", async (req: Request, res: Response) => {
	try {
		const agentId = (req as any).user?.id;
		if (!agentId) {
			return res
				.status(401)
				.json({ success: false, message: "Authentication required" });
		}

		const { db } = await import("../db");
		const { prospectProposals } = await import("@shared/schema");
		const { desc, sql } = await import("drizzle-orm");

		const proposalId = req.params.id;
		const versions = await db
			.select({
				id: prospectProposals.id,
				proposalVersion: prospectProposals.proposalVersion,
				parentProposalId: prospectProposals.parentProposalId,
				isLatestVersion: prospectProposals.isLatestVersion,
				lockedAt: prospectProposals.lockedAt,
				createdAt: prospectProposals.createdAt,
				status: prospectProposals.status,
				proposalTitle: prospectProposals.proposalTitle,
				totalInvestmentAmount: prospectProposals.totalInvestmentAmount,
				projectedReturns: prospectProposals.projectedReturns,
				agentName: prospectProposals.agentName,
			})
			.from(prospectProposals)
			.where(
				sql`${prospectProposals.agentId} = ${agentId} AND (
        ${prospectProposals.id} = ${proposalId} OR 
        ${prospectProposals.parentProposalId} = ${proposalId} OR
        ${prospectProposals.id} IN (
          SELECT ${prospectProposals.parentProposalId} FROM ${prospectProposals} 
          WHERE ${prospectProposals.id} = ${proposalId}
        )
      )`,
			)
			.orderBy(desc(prospectProposals.proposalVersion));

		res.json(versions);
	} catch (error: any) {
		console.error("[Agent Wizard] Error fetching proposal versions:", error);
		res.status(500).json({ success: false, message: error.message });
	}
});

// EPIC 6: Advisor Override - Apply override to recommendation
router.post(
	"/proposals/:id/override-recommendation",
	async (req: Request, res: Response) => {
		try {
			const agentId = (req as any).user?.id;
			if (!agentId) {
				return res
					.status(401)
					.json({ success: false, message: "Authentication required" });
			}

			const { db } = await import("../db");
			const { prospectProposals } = await import("@shared/schema");
			const { eq, and } = await import("drizzle-orm");

			const {
				recommendationId,
				productName,
				originalAction,
				originalAmount,
				newAction,
				newAmount,
				overrideReason,
				overrideCategory,
				overriddenBy,
			} = req.body;

			if (!overrideReason?.trim()) {
				return res
					.status(400)
					.json({ success: false, message: "Override reason is required" });
			}

			const [proposal] = await db
				.select()
				.from(prospectProposals)
				.where(
					and(
						eq(prospectProposals.id, req.params.id),
						eq(prospectProposals.agentId, agentId),
					),
				)
				.limit(1);

			if (!proposal) {
				return res
					.status(404)
					.json({ success: false, message: "Proposal not found" });
			}

			if (proposal.lockedAt) {
				return res
					.status(400)
					.json({ success: false, message: "Cannot modify locked proposal" });
			}

			const recommendations = (proposal.recommendations as any[]) || [];
			const updatedRecs = recommendations.map((rec) => {
				if (rec.productName === productName || rec.id === recommendationId) {
					return {
						...rec,
						action: newAction || rec.action,
						changeAmount: newAmount ?? rec.changeAmount,
						suggestedAmount: newAmount ?? rec.suggestedAmount,
						isOverridden: true,
						override: {
							originalAction,
							originalAmount,
							newAction,
							newAmount,
							overrideReason,
							overrideCategory,
							overriddenBy,
							overriddenAt: new Date().toISOString(),
						},
					};
				}
				return rec;
			});

			await db
				.update(prospectProposals)
				.set({ recommendations: updatedRecs, updatedAt: new Date() })
				.where(eq(prospectProposals.id, req.params.id));

			const updatedRec = updatedRecs.find(
				(r) => r.productName === productName || r.id === recommendationId,
			);
			res.json({ success: true, recommendation: updatedRec });
		} catch (error: any) {
			console.error("[Agent Wizard] Error applying override:", error);
			res.status(500).json({ success: false, message: error.message });
		}
	},
);

// EPIC 6: Advisor Override - Revert override

export default router;
