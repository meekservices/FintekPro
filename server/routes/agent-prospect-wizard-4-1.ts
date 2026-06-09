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
import * as schema from "@shared/schema";

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

router.get("/zoho/team-agents", async (req: Request, res: Response) => {
	try {
		const agentId = (req as any).user?.id;
		if (!agentId) {
			return res
				.status(401)
				.json({ success: false, message: "Authentication required" });
		}

		const connection = await ZohoConnectionResolver.resolveForAgent(agentId);
		if (!connection?.isMaster) {
			return res
				.status(403)
				.json({
					success: false,
					message: "Only master agents can access team agents",
				});
		}

		// Get master agent's info
		const { db } = await import("../db");
		const { users } = await import("@shared/schema");
		const { eq } = await import("drizzle-orm");

		const masterAgent = await db
			.select({
				id: users.id,
				firstName: users.firstName,
				lastName: users.lastName,
				email: users.email,
			})
			.from(users)
			.where(eq(users.id, agentId))
			.limit(1);

		// Return master agent only — sub-agent hierarchy lookup requires a dedicated
		// agent_hierarchy table which does not yet exist in this schema.
		const teamAgents =
			masterAgent.length > 0
				? [
						{
							id: masterAgent[0].id,
							name:
								`${masterAgent[0].firstName || ""} ${masterAgent[0].lastName || ""}`.trim() ||
								masterAgent[0].email ||
								"Me (Master)",
							email: masterAgent[0].email,
							isMaster: true,
						},
					]
				: [];

		res.json({ success: true, agents: teamAgents });
	} catch (error: any) {
		console.error("[Zoho Import] Error fetching team agents:", error);
		res.status(500).json({ success: false, message: error.message });
	}
});

// Import leads from Zoho CRM as prospects
router.post("/zoho/import/leads", async (req: Request, res: Response) => {
	try {
		const agentId = (req as any).user?.id;
		if (!agentId) {
			return res
				.status(401)
				.json({ success: false, message: "Authentication required" });
		}

		const { limit = 50, skipExisting = true, assignToAgentId } = req.body;

		const connection = await ZohoConnectionResolver.resolveForAgent(agentId);
		if (!connection) {
			return res
				.status(400)
				.json({ success: false, message: "No Zoho CRM connection available" });
		}

		// Only master agents (connection owners) can import from Zoho
		if (!connection.isMaster) {
			return res.status(403).json({
				success: false,
				message:
					"Only the master agent can import from Zoho CRM. Please contact your team admin.",
			});
		}

		// Determine target agent for prospect creation
		let targetAgentId = agentId;

		// Validate assignToAgentId if provided - must be master or their sub-agent
		if (assignToAgentId && assignToAgentId !== agentId) {
			const { db } = await import("../db");
			const { partners } = await import("@shared/schema");
			const { eq, and } = await import("drizzle-orm");

			// Check if assignToAgentId is a sub-agent of this master
			const validSubAgent = await db
				.select({ id: (partners as any).userId })
				.from(partners)
				.where(
					and(
						eq((partners as any).userId, assignToAgentId),
						eq((partners as any).masterAgentId, agentId),
					),
				)
				.limit(1);

			if (validSubAgent.length === 0) {
				return res.status(403).json({
					success: false,
					message:
						"Cannot assign to this agent. The selected agent is not part of your team.",
				});
			}
			targetAgentId = assignToAgentId;
		}

		const crmService = new ZohoCRMService(
			connection.connectionId,
			connection.zohoDataCenter,
		);
		const leads = await crmService.getLeads(limit);

		if (!leads || leads.length === 0) {
			return res.json({
				success: true,
				imported: 0,
				skipped: 0,
				message: "No leads found in Zoho CRM",
			});
		}

		let imported = 0;
		let skipped = 0;
		const importedProspects: any[] = [];

		for (const lead of leads) {
			const name =
				[lead.First_Name, lead.Last_Name].filter(Boolean).join(" ") ||
				"Unknown";
			const email = lead.Email?.toLowerCase();
			const mobile = lead.Phone || lead.Mobile;

			// Check for existing prospect with same email/phone for target agent
			if (skipExisting) {
				const existingCheck =
					await agentProspectWizardService.checkForExistingProspect(
						targetAgentId,
						undefined,
						email,
						mobile,
					);
				if (existingCheck.isDuplicate) {
					skipped++;
					continue;
				}
			}

			// Create prospect from Zoho lead under target agent
			const prospectData = {
				name,
				email,
				mobile,
				notes: `Imported from Zoho CRM (Lead ID: ${lead.id})${assignToAgentId ? ` by master agent ${agentId}` : ""}\n${lead.Description || ""}`,
			};

			const prospectId = await agentProspectWizardService.createProspect(
				targetAgentId,
				prospectData,
			);

			if (typeof prospectId === "string") {
				storage
					.createAgentNotification({
						agentId: targetAgentId,
						title: "Prospect Imported from Zoho CRM",
						body: `${prospectData.name} was imported from Zoho CRM as a new prospect.`,
						type: "prospect",
						link: `/agent-prospect-wizard?edit=${prospectId}`,
					})
					.catch(() => {});

				// Create entity mapping for two-way sync
				const { db } = await import("../db");
				const { zohoEntityMappings } = await import("@shared/schema");

				await db.insert(zohoEntityMappings).values({
					connectionId: connection.connectionId,
					fintekproEntityType: "prospect",
					fintekproEntityId: prospectId,
					zohoService: "CRM",
					zohoModule: "Leads",
					zohoRecordId: lead.id!,
					zohoRecordData: lead,
					owningAgentId: targetAgentId,
					syncDirection: "from_zoho",
					lastSyncedAt: new Date(),
					syncStatus: "synced",
				});

				imported++;
				importedProspects.push({
					prospectId,
					zohoLeadId: lead.id,
					name,
					assignedTo: targetAgentId,
				});
			}
		}

		console.log(
			`[Zoho Import] Master agent ${agentId} imported ${imported} leads for agent ${targetAgentId}, skipped ${skipped}`,
		);
		res.json({
			success: true,
			imported,
			skipped,
			total: leads.length,
			prospects: importedProspects,
			message: `Successfully imported ${imported} leads from Zoho CRM`,
		});
	} catch (error: any) {
		console.error("[Zoho Import] Error importing leads:", error);
		res.status(500).json({ success: false, message: error.message });
	}
});

// Import contacts from Zoho CRM as prospects
router.post("/zoho/import/contacts", async (req: Request, res: Response) => {
	try {
		const agentId = (req as any).user?.id;
		if (!agentId) {
			return res
				.status(401)
				.json({ success: false, message: "Authentication required" });
		}

		const { limit = 50, skipExisting = true, assignToAgentId } = req.body;

		const connection = await ZohoConnectionResolver.resolveForAgent(agentId);
		if (!connection) {
			return res
				.status(400)
				.json({ success: false, message: "No Zoho CRM connection available" });
		}

		// Only master agents (connection owners) can import from Zoho
		if (!connection.isMaster) {
			return res.status(403).json({
				success: false,
				message:
					"Only the master agent can import from Zoho CRM. Please contact your team admin.",
			});
		}

		// Determine target agent for prospect creation
		let targetAgentId = agentId;

		// Validate assignToAgentId if provided - must be master or their sub-agent
		if (assignToAgentId && assignToAgentId !== agentId) {
			const { db } = await import("../db");
			const { partners } = await import("@shared/schema");
			const { eq, and } = await import("drizzle-orm");

			// Check if assignToAgentId is a sub-agent of this master
			const validSubAgent = await db
				.select({ id: (partners as any).userId })
				.from(partners)
				.where(
					and(
						eq((partners as any).userId, assignToAgentId),
						eq((partners as any).masterAgentId, agentId),
					),
				)
				.limit(1);

			if (validSubAgent.length === 0) {
				return res.status(403).json({
					success: false,
					message:
						"Cannot assign to this agent. The selected agent is not part of your team.",
				});
			}
			targetAgentId = assignToAgentId;
		}

		const crmService = new ZohoCRMService(
			connection.connectionId,
			connection.zohoDataCenter,
		);
		const contacts = await crmService.getContacts(limit);

		if (!contacts || contacts.length === 0) {
			return res.json({
				success: true,
				imported: 0,
				skipped: 0,
				message: "No contacts found in Zoho CRM",
			});
		}

		let imported = 0;
		let skipped = 0;
		const importedProspects: any[] = [];

		for (const contact of contacts) {
			const name =
				[contact.First_Name, contact.Last_Name].filter(Boolean).join(" ") ||
				"Unknown";
			const email = contact.Email?.toLowerCase();
			const mobile = contact.Phone || contact.Mobile;

			if (skipExisting) {
				const existingCheck =
					await agentProspectWizardService.checkForExistingProspect(
						targetAgentId,
						undefined,
						email,
						mobile,
					);
				if (existingCheck.isDuplicate) {
					skipped++;
					continue;
				}
			}

			const prospectData = {
				name,
				email,
				mobile,
				notes: `Imported from Zoho CRM (Contact ID: ${contact.id})${assignToAgentId ? ` by master agent ${agentId}` : ""}\n${contact.Description || ""}`,
			};

			const prospectId = await agentProspectWizardService.createProspect(
				targetAgentId,
				prospectData,
			);

			if (typeof prospectId === "string") {
				storage
					.createAgentNotification({
						agentId: targetAgentId,
						title: "Prospect Imported from Zoho CRM",
						body: `${prospectData.name} was imported from Zoho CRM (Contact) as a new prospect.`,
						type: "prospect",
						link: `/agent-prospect-wizard?edit=${prospectId}`,
					})
					.catch(() => {});

				const { db } = await import("../db");
				const { zohoEntityMappings } = await import("@shared/schema");

				await db.insert(zohoEntityMappings).values({
					connectionId: connection.connectionId,
					fintekproEntityType: "prospect",
					fintekproEntityId: prospectId,
					zohoService: "CRM",
					zohoModule: "Contacts",
					zohoRecordId: contact.id!,
					zohoRecordData: contact,
					owningAgentId: targetAgentId,
					syncDirection: "from_zoho",
					lastSyncedAt: new Date(),
					syncStatus: "synced",
				});

				imported++;
				importedProspects.push({
					prospectId,
					zohoContactId: contact.id,
					name,
					assignedTo: targetAgentId,
				});
			}
		}

		console.log(
			`[Zoho Import] Master agent ${agentId} imported ${imported} contacts for agent ${targetAgentId}, skipped ${skipped}`,
		);
		res.json({
			success: true,
			imported,
			skipped,
			total: contacts.length,
			prospects: importedProspects,
			message: `Successfully imported ${imported} contacts from Zoho CRM`,
		});
	} catch (error: any) {
		console.error("[Zoho Import] Error importing contacts:", error);
		res.status(500).json({ success: false, message: error.message });
	}
});

// Sync prospect updates back to Zoho CRM
router.post(
	"/prospects/:id/sync-to-zoho",
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

			const connection = await ZohoConnectionResolver.resolveForAgent(agentId);
			if (!connection) {
				return res
					.status(400)
					.json({
						success: false,
						message: "No Zoho CRM connection available",
					});
			}

			const { db } = await import("../db");
			const { zohoEntityMappings } = await import("@shared/schema");
			const { eq, and } = await import("drizzle-orm");

			// Check for existing mapping
			const [existingMapping] = await db
				.select()
				.from(zohoEntityMappings)
				.where(
					and(
						eq(zohoEntityMappings.connectionId, connection.connectionId),
						eq(zohoEntityMappings.fintekproEntityType, "prospect"),
						eq(zohoEntityMappings.fintekproEntityId, req.params.id),
					),
				)
				.limit(1);

			const crmService = new ZohoCRMService(
				connection.connectionId,
				connection.zohoDataCenter,
			);

			if (existingMapping) {
				// Update existing Zoho record
				const nameParts = prospect.name?.split(" ") || ["Prospect", "Client"];
				const updateData = {
					First_Name: nameParts[0],
					Last_Name: nameParts.slice(1).join(" ") || "Client",
					Email: prospect.email || undefined,
					Phone: prospect.mobile || undefined,
					Mobile: prospect.mobile || undefined,
				};

				if (existingMapping.zohoModule === "Leads") {
					await crmService.updateLead(existingMapping.zohoRecordId, updateData);
				} else if (existingMapping.zohoModule === "Contacts") {
					await crmService.updateContact(
						existingMapping.zohoRecordId,
						updateData,
					);
				}

				await db
					.update(zohoEntityMappings)
					.set({
						zohoRecordData: {
							...((existingMapping.zohoRecordData as any) || {}),
							...updateData,
						},
						lastSyncedAt: new Date(),
						syncStatus: "synced",
						updatedAt: new Date(),
					})
					.where(eq(zohoEntityMappings.id, existingMapping.id));

				res.json({
					success: true,
					zohoRecordId: existingMapping.zohoRecordId,
					action: "updated",
				});
			} else {
				// Create new Zoho Lead
				const masterZohoAccountId =
					await ZohoConnectionResolver.getMasterAgentZohoAccountId(
						connection.connectionId,
					);

				const zohoLeadId = await crmService.syncProspectToLead({
					name: prospect.name || "Unknown",
					email: prospect.email || undefined,
					phone: prospect.mobile || undefined,
					agentId,
					prospectId: req.params.id,
					masterAgentZohoAccountId: masterZohoAccountId || undefined,
				});

				res.json({
					success: true,
					zohoRecordId: zohoLeadId,
					action: "created",
				});
			}
		} catch (error: any) {
			console.error("[Zoho Sync] Error syncing to Zoho:", error);
			res.status(500).json({ success: false, message: error.message });
		}
	},
);

// Get Zoho sync info for a prospect
router.get("/prospects/:id/zoho-info", async (req: Request, res: Response) => {
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

		const connection = await ZohoConnectionResolver.resolveForAgent(agentId);
		if (!connection) {
			return res.json({
				success: true,
				isSynced: false,
				zohoConnection: false,
			});
		}

		const { db } = await import("../db");
		const { zohoEntityMappings } = await import("@shared/schema");
		const { eq, and } = await import("drizzle-orm");

		const [mapping] = await db
			.select()
			.from(zohoEntityMappings)
			.where(
				and(
					eq(zohoEntityMappings.connectionId, connection.connectionId),
					eq(zohoEntityMappings.fintekproEntityType, "prospect"),
					eq(zohoEntityMappings.fintekproEntityId, req.params.id),
				),
			)
			.limit(1);

		res.json({
			success: true,
			isSynced: !!mapping,
			zohoConnection: true,
			zohoModule: mapping?.zohoModule || null,
			zohoRecordId: mapping?.zohoRecordId || null,
			lastSyncedAt: mapping?.lastSyncedAt || null,
			syncDirection: mapping?.syncDirection || null,
		});
	} catch (error: any) {
		console.error("[Zoho Info] Error:", error);
		res.status(500).json({ success: false, message: error.message });
	}
});

// Zoho CRM Webhook Handler - receives updates when leads/contacts change in Zoho
// Note: This endpoint is called by Zoho CRM and doesn't require auth

export default router;
