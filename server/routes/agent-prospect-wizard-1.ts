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

router.post("/prospects", async (req: Request, res: Response) => {
	try {
		const agentId = (req as any).user?.id;
		if (!agentId) {
			return res
				.status(401)
				.json({ success: false, message: "Authentication required" });
		}

		// Use safeParse so Zod validation errors return user-friendly messages
		// instead of raw JSON ZodError strings reaching the client toast
		const parsed = createProspectSchema.safeParse(req.body);
		if (!parsed.success) {
			const firstError = parsed.error.issues[0];
			const field = firstError?.path?.join(".") || "field";
			const msg = firstError?.message || "Invalid input";
			const fieldLabel: Record<string, string> = {
				name: "Full Name",
				email: "Email Address",
				mobile: "Mobile Number",
				pan: "PAN Number",
			};
			const label = fieldLabel[field] || field;
			return res.status(400).json({
				success: false,
				message: `${label}: ${msg}`,
				code: "VALIDATION_ERROR",
			});
		}
		const data = parsed.data;
		const result = await agentProspectWizardService.createProspect(
			agentId,
			data,
		);

		// Fire notification asynchronously so it never blocks the response
		if (typeof result === "string") {
			storage
				.createAgentNotification({
					agentId,
					title: "New Prospect Added",
					body: `${data.name} has been added as a prospect.`,
					type: "prospect",
					link: `/agent-prospect-wizard?edit=${result}`,
				})
				.catch(() => {});
		}

		// Check if result is a duplicate check response
		if (typeof result === "object" && "isDuplicate" in result) {
			const duplicateResult = result as DuplicateCheckResult;
			return res.status(409).json({
				success: false,
				isDuplicate: true,
				duplicateType: duplicateResult.duplicateType,
				existingRecord: duplicateResult.existingRecord,
				message: duplicateResult.message,
				canRequestMapping: duplicateResult.canRequestMapping,
			});
		}

		// Zoho CRM sync - auto-push new prospect to Zoho as Lead
		let zohoLeadId: string | null = null;
		try {
			const connection = await ZohoConnectionResolver.resolveForAgent(agentId);
			if (connection) {
				const crmService = new ZohoCRMService(
					connection.connectionId,
					connection.zohoDataCenter,
				);
				const masterZohoAccountId =
					await ZohoConnectionResolver.getMasterAgentZohoAccountId(
						connection.connectionId,
					);

				zohoLeadId = await crmService.syncProspectToLead({
					name: data.name,
					email: data.email,
					phone: data.mobile,
					agentId,
					prospectId: result as string,
					notes: data.notes,
					masterAgentZohoAccountId: masterZohoAccountId || undefined,
				});
				// eslint-disable-next-line no-console
				console.log(
					`[Zoho CRM] Synced prospect ${result} to Zoho Lead ${zohoLeadId}`,
				);
			}
		} catch (zohoError) {
			// eslint-disable-next-line no-console
			console.warn("[Zoho CRM] Sync failed (non-blocking):", zohoError);
		}

		res.json({ success: true, prospectId: result, zohoLeadId });
	} catch (error: any) {
		// eslint-disable-next-line no-console
		console.error("[Agent Wizard] Error creating prospect:", error);
		// Prevent raw Zod JSON from reaching the client
		const message =
			error?.name === "ZodError"
				? "Please check your input and try again."
				: (error?.message ?? "Failed to create prospect.");
		res.status(400).json({ success: false, message });
	}
});

// Request client mapping (agent endpoint)
router.post("/request-mapping", async (req: Request, res: Response) => {
	try {
		const agentId = (req as any).user?.id;
		const user = (req as any).user;
		if (!agentId) {
			return res
				.status(401)
				.json({ success: false, message: "Authentication required" });
		}

		const {
			clientId,
			pan,
			email,
			mobile,
			name,
			currentAgentId,
			currentAgentName,
			reason,
		} = req.body;
		const agentName =
			[user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;

		const result = await agentProspectWizardService.requestClientMapping(
			agentId,
			agentName,
			{
				clientId,
				pan,
				email,
				mobile,
				name,
				currentAgentId,
				currentAgentName,
				reason,
			},
		);

		res.json({ success: true, ...result });
	} catch (error: any) {
  // eslint-disable-next-line no-console
		console.error("[Agent Wizard] Error requesting mapping:", error);
		res.status(400).json({ success: false, message: error.message });
	}
});

// Admin: Get pending mapping requests
router.get("/admin/mapping-requests", async (req: Request, res: Response) => {
	try {
		const user = (req as any).user;
		if (
			!user?.roles?.includes("admin") &&
			!user?.roles?.includes("superadmin")
		) {
			return res
				.status(403)
				.json({ success: false, message: "Admin access required" });
		}

		const requests =
			await agentProspectWizardService.getPendingMappingRequests();
		res.json({ success: true, requests });
	} catch (error: any) {
  // eslint-disable-next-line no-console
		console.error("[Agent Wizard] Error fetching mapping requests:", error);
		res.status(500).json({ success: false, message: error.message });
	}
});

// Admin: Approve/reject mapping request
router.post(
	"/admin/mapping-requests/:id/:action",
	async (req: Request, res: Response) => {
		try {
			const user = (req as any).user;
			if (
				!user?.roles?.includes("admin") &&
				!user?.roles?.includes("superadmin")
			) {
				return res
					.status(403)
					.json({ success: false, message: "Admin access required" });
			}

			const { id, action } = req.params;
			if (action !== "approve" && action !== "reject") {
				return res
					.status(400)
					.json({ success: false, message: "Invalid action" });
			}

			const { rejectionReason } = req.body;
			const result = await agentProspectWizardService.processMappingRequest(
				id,
				action,
				user.id,
				rejectionReason,
			);
			res.json(result);
		} catch (error: any) {
   // eslint-disable-next-line no-console
			console.error("[Agent Wizard] Error processing mapping request:", error);
			res.status(400).json({ success: false, message: error.message });
		}
	},
);

router.get("/prospects", async (req: Request, res: Response) => {
	try {
		const agentId = (req as any).user?.id;
		if (!agentId) {
			return res
				.status(401)
				.json({ success: false, message: "Authentication required" });
		}

		const prospects =
			await agentProspectWizardService.getAgentProspects(agentId);
		res.json({ success: true, prospects });
	} catch (error: any) {
  // eslint-disable-next-line no-console
		console.error("[Agent Wizard] Error fetching prospects:", error);
		res.status(500).json({ success: false, message: error.message });
	}
});

// ── Static sub-collection routes must come BEFORE /:id wildcard ──────────────

/**
 * GET /api/agent-wizard/prospects/top-ranked
 * Returns top prospects sorted by compositeScore DESC (Upgrade 6).
 * MUST be before /:id to avoid Express capturing "top-ranked" as an id param.
 */
router.get(
	"/prospects/top-ranked",
	requireAuth,
	async (req: Request, res: Response) => {
		try {
			const limit = Math.min(
				Number.parseInt(String(req.query.limit || "20")),
				100,
			);
			const { isNotNull: isNotNullStatic } = await import("drizzle-orm");

			const rows = await db
				.select({
					id: prospectLeads.id,
					cin: prospectLeads.cin,
					companyName: prospectLeads.companyName,
					city: prospectLeads.city,
					state: prospectLeads.state,
					industrySegment: prospectLeads.industrySegment,
					compositeScore: prospectLeads.compositeScore,
					wealthScore: prospectLeads.wealthScore,
					activityScore: prospectLeads.activityScore,
					relationshipScore: prospectLeads.relationshipScore,
					estimatedNetworth: prospectLeads.estimatedNetworth,
					investableSurplus: prospectLeads.investableSurplus,
					leadQuality: prospectLeads.leadQuality,
					leadScore: prospectLeads.leadScore,
					status: prospectLeads.status,
					assignedTo: prospectLeads.assignedTo,
					scoredAt: prospectLeads.scoredAt,
				})
				.from(prospectLeads)
				.where(isNotNullStatic(prospectLeads.compositeScore))
				.orderBy(descOrd(prospectLeads.compositeScore))
				.limit(limit);

			res.json({
				success: true,
				prospects: rows.map((r) => {
					const cs = Number.parseFloat(String(r.compositeScore || "0"));
					return {
						...r,
						compositeScore: cs,
						wealthScore: Number.parseFloat(String(r.wealthScore || "0")),
						activityScore: Number.parseFloat(String(r.activityScore || "0")),
						relationshipScore: Number.parseFloat(
							String(r.relationshipScore || "0"),
						),
						estimatedNetworth: Number.parseFloat(
							String(r.estimatedNetworth || "0"),
						),
						investableSurplus: Number.parseFloat(
							String(r.investableSurplus || "0"),
						),
						scoreTier:
							cs >= 80
								? "platinum"
								: cs >= 60
									? "gold"
									: cs >= 40
										? "silver"
										: "bronze",
					};
				}),
			});
		} catch (error: any) {
   // eslint-disable-next-line no-console
			console.error("[Top Ranked] Error:", error);
			res.status(500).json({ success: false, error: error.message });
		}
	},
);

/**
 * GET /api/agent-wizard/prospects/benchmarks/sector
 * Returns average scores by industry segment (Upgrade 8).
 * Placed before /:id for safety (3-segment path, but consistent ordering is good practice).
 */
router.get(
	"/prospects/benchmarks/sector",
	requireAuth,
	async (_req: Request, res: Response) => {
		try {
			const benchmarks = await getSectorBenchmarks();
			res.json({ success: true, benchmarks });
		} catch (error: any) {
   // eslint-disable-next-line no-console
			console.error("[Sector Benchmarks] Error:", error);
			res.status(500).json({ success: false, error: error.message });
		}
	},
);

// ── Per-prospect routes (/prospects/:id and sub-paths) ────────────────────────

router.get("/prospects/:id", async (req: Request, res: Response) => {
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
			return res.status(403).json({ success: false, message: "Access denied" });
		}
		res.json({ success: true, prospect });
	} catch (error: any) {
  // eslint-disable-next-line no-console
		console.error("[Agent Wizard] Error fetching prospect:", error);
		res.status(500).json({ success: false, message: error.message });
	}
});

router.put("/prospects/:id/portfolio", async (req: Request, res: Response) => {
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
			return res.status(403).json({ success: false, message: "Access denied" });
		}

		const flexibleHoldings = z
			.array(flexibleHoldingSchema)
			.parse(req.body.holdings);
		const holdings = normalizeHoldings(flexibleHoldings);
		await agentProspectWizardService.updateProspectPortfolio(
			req.params.id,
			holdings,
		);
		res.json({ success: true });
	} catch (error: any) {
  // eslint-disable-next-line no-console
		console.error("[Agent Wizard] Error updating portfolio:", error);
		res.status(400).json({ success: false, message: error.message });
	}
});

// ============ PROSPECT READINESS ENDPOINTS ============

router.get("/prospects/:id/readiness", async (req: Request, res: Response) => {
	try {
		const agentId = (req as any).user?.id;
		if (!agentId) {
			return res
				.status(401)
				.json({ success: false, message: "Authentication required" });
		}

		const readiness = await prospectReadinessService.checkReadiness(
			req.params.id,
		);
		res.json({ success: true, readiness });
	} catch (error: any) {
  // eslint-disable-next-line no-console
		console.error("[Agent Wizard] Error checking readiness:", error);
		res.status(400).json({ success: false, message: error.message });
	}
});

router.post(
	"/prospects/:id/evaluate-readiness",
	async (req: Request, res: Response) => {
		try {
			const agentId = (req as any).user?.id;
			if (!agentId) {
				return res
					.status(401)
					.json({ success: false, message: "Authentication required" });
			}

			const readiness =
				await prospectReadinessService.evaluateAndAdvanceToReady(req.params.id);
			res.json({ success: true, readiness });
		} catch (error: any) {
   // eslint-disable-next-line no-console
			console.error("[Agent Wizard] Error evaluating readiness:", error);
			res.status(400).json({ success: false, message: error.message });
		}
	},
);

export default router;
