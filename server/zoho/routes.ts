import { Router, Request, Response, NextFunction } from "express";
import { createHmac, timingSafeEqual } from "crypto";
import { ZohoOAuthService } from "./oauth";
import { ZohoCRMService } from "./services/crm";
import { ZohoCampaignsService } from "./services/campaigns";
import { ZohoMeetingService } from "./services/meeting";
import { ZohoSignService } from "./services/sign";
import { db } from "../db";
import {
	zohoConnections,
	zohoEntityMappings,
	zohoSyncLogs,
	zohoWebhookEvents,
} from "@shared/schema";
import { eq, desc, and, gte, lte, sql } from "drizzle-orm";
import { zohoRateLimiter } from "./rate-limiter";
import { requireAdmin } from "../middleware/auth";

const router = Router();

// Require admin auth for all Zoho routes except:
//  /callback  — OAuth redirect from Zoho (no session available at that point)
//  /webhooks/* — Protected by HMAC signature validation instead
router.use((req: Request, res: Response, next: NextFunction) => {
	if (req.path === "/callback" || req.path.startsWith("/webhooks/")) {
		return next();
	}
	return requireAdmin(req as any, res, next);
});

/**
 * Helper function to get connection details including ZSOID
 */
async function getConnectionWithZsoid(
	connectionId: string,
): Promise<{ connection: any; zsoid: string | null }> {
	const [connection] = await db
		.select()
		.from(zohoConnections)
		.where(eq(zohoConnections.id, connectionId))
		.limit(1);

	return {
		connection,
		zsoid: connection?.zohoOrgId || null,
	};
}

/**
 * Extended Request interface for raw body access
 * The express.json() middleware is configured with 'verify' to store raw body
 */
interface WebhookRequest extends Request {
	rawBody?: Buffer;
}

/**
 * Zoho Webhook Signature Validation Middleware
 * Validates HMAC-SHA256 signature from Zoho webhook payloads
 *
 * Zoho sends signatures in 'x-zoho-webhook-signature' header
 * The signature is computed as HMAC-SHA256(rawPayload, webhook_secret)
 *
 * NOTE: Requires express.json() configured with verify option to capture raw body:
 *   app.use(express.json({ verify: (req, res, buf) => { req.rawBody = buf; } }))
 */
function validateZohoWebhookSignature(
	req: WebhookRequest,
	res: Response,
	next: NextFunction,
): void {
	const webhookSecret = process.env.ZOHO_WEBHOOK_SECRET;

	if (!webhookSecret) {
		console.warn(
			"[Zoho Webhook] ZOHO_WEBHOOK_SECRET not configured - skipping signature validation in development",
		);
		if (process.env.NODE_ENV === "production") {
			res.status(500).json({
				message: "Webhook secret not configured",
				code: "WEBHOOK_CONFIG_ERROR",
			});
			return;
		}
		next();
		return;
	}

	const signature = req.headers["x-zoho-webhook-signature"] as string;

	if (!signature) {
		console.warn("[Zoho Webhook] Missing signature header");
		res.status(401).json({
			message: "Missing webhook signature",
			code: "MISSING_SIGNATURE",
		});
		return;
	}

	try {
		let rawBody: string;
		if (req.rawBody) {
			rawBody = req.rawBody.toString("utf8");
		} else {
			rawBody = JSON.stringify(req.body);
			console.warn(
				"[Zoho Webhook] Raw body not available, using JSON.stringify - signature may not match exactly",
			);
		}

		const expectedSignature = createHmac("sha256", webhookSecret)
			.update(rawBody, "utf8")
			.digest("base64");

		const signatureBuffer = Buffer.from(signature, "base64");
		const expectedBuffer = Buffer.from(expectedSignature, "base64");

		if (signatureBuffer.length !== expectedBuffer.length) {
			console.warn("[Zoho Webhook] Signature length mismatch");
			res.status(401).json({
				message: "Invalid webhook signature",
				code: "SIGNATURE_MISMATCH",
			});
			return;
		}

		if (!timingSafeEqual(signatureBuffer, expectedBuffer)) {
			console.warn("[Zoho Webhook] Signature verification failed");
			res.status(401).json({
				message: "Invalid webhook signature",
				code: "SIGNATURE_INVALID",
			});
			return;
		}

		console.info("[Zoho Webhook] Signature verified successfully");
		next();
	} catch (error: any) {
		console.error("[Zoho Webhook] Signature validation error:", error.message);
		res.status(401).json({
			message: "Webhook signature validation failed",
			code: "VALIDATION_ERROR",
		});
		return;
	}
}

/**
 * GET /api/zoho/auth/url
 * Get Zoho OAuth authorization URL
 */
router.get("/auth/url", async (req, res) => {
	try {
		const { services, dataCenter = "com" } = req.query;

		if (!services) {
			return res
				.status(400)
				.json({ message: "Services parameter is required" });
		}

		const servicesList = (services as string).split(",");

		// Define scopes based on requested services
		const scopeMap: Record<string, string[]> = {
			CRM: ["ZohoCRM.modules.ALL", "ZohoCRM.settings.ALL"],
			Books: ["ZohoBooks.fullaccess.all"],
			Desk: ["Desk.tickets.ALL", "Desk.contacts.ALL", "Desk.basic.READ"],
			WorkDrive: ["WorkDrive.files.ALL", "WorkDrive.folders.ALL"],
			People: ["ZohoPeople.employee.ALL"],
			Campaigns: ["ZohoCampaigns.campaign.ALL", "ZohoCampaigns.contact.ALL"],
			Analytics: ["ZohoAnalytics.fullaccess.all"],
			Projects: ["ZohoProjects.portals.ALL"],
		};

		const scopes: string[] = [];
		servicesList.forEach((service) => {
			if (scopeMap[service]) {
				scopes.push(...scopeMap[service]);
			}
		});

		const oauthService = new ZohoOAuthService(dataCenter as string);
		const state = Buffer.from(
			JSON.stringify({ services: servicesList, dataCenter }),
		).toString("base64");
		const authUrl = oauthService.getAuthorizationUrl(scopes, state);

		res.json({ authUrl, state });
	} catch (error: any) {
		console.error("Zoho auth URL generation error:", error);
		res.status(500).json({ message: error.message });
	}
});

/**
 * GET /api/zoho/callback
 * OAuth callback endpoint
 */
router.get("/callback", async (req, res) => {
	try {
		const { code, state } = req.query;

		if (!code || !state) {
			return res
				.status(400)
				.json({ message: "Missing authorization code or state" });
		}

		// Decode state to get services and dataCenter
		const stateData = JSON.parse(
			Buffer.from(state as string, "base64").toString(),
		);
		const { services, dataCenter = "com" } = stateData;

		const oauthService = new ZohoOAuthService(dataCenter);
		const tokenResponse = await oauthService.getTokensFromCode(code as string);

		// Get current user ID from session
		const userId = (req.user as any)?.id;
		if (!userId) {
			return res.status(401).json({ message: "User not authenticated" });
		}

		// Save connection
		const connectionName = `Zoho ${services.join(", ")} - ${new Date().toISOString().split("T")[0]}`;
		const connectionId = await oauthService.saveConnection(
			tokenResponse,
			userId,
			connectionName,
			services,
		);

		// Redirect to admin portal with success message
		res.redirect(`/admin/integrations/zoho?connected=${connectionId}`);
	} catch (error: any) {
		console.error("Zoho OAuth callback error:", error);
		res.redirect(
			`/admin/integrations/zoho?error=${encodeURIComponent(error.message)}`,
		);
	}
});

/**
 * GET /api/zoho/connections
 * Get all Zoho connections
 */
router.get("/connections", async (req, res) => {
	try {
		const connections = await db
			.select()
			.from(zohoConnections)
			.orderBy(desc(zohoConnections.createdAt));

		res.json(connections);
	} catch (error: any) {
		console.error("Get Zoho connections error:", error);
		res.status(500).json({ message: error.message });
	}
});

/**
 * GET /api/zoho/connections/:id
 * Get specific connection details
 */
router.get("/connections/:id", async (req, res) => {
	try {
		const { id } = req.params;

		const [connection] = await db
			.select()
			.from(zohoConnections)
			.where(eq(zohoConnections.id, id))
			.limit(1);

		if (!connection) {
			return res.status(404).json({ message: "Connection not found" });
		}

		// Don't expose sensitive tokens
		const safeConnection = {
			...connection,
			accessToken: "***",
			refreshToken: "***",
		};

		res.json(safeConnection);
	} catch (error: any) {
		console.error("Get Zoho connection error:", error);
		res.status(500).json({ message: error.message });
	}
});

/**
 * DELETE /api/zoho/connections/:id
 * Delete/revoke a connection
 */
router.delete("/connections/:id", async (req, res) => {
	try {
		const { id } = req.params;

		const [connection] = await db
			.select()
			.from(zohoConnections)
			.where(eq(zohoConnections.id, id))
			.limit(1);

		if (!connection) {
			return res.status(404).json({ message: "Connection not found" });
		}

		// Revoke token at Zoho (decrypt token first)
		const oauthService = new ZohoOAuthService(
			connection.zohoDataCenter || "com",
		);
		try {
			const { encryptionService } = await import("../encryption-service");
			const decryptedToken = encryptionService.decrypt(connection.accessToken);
			if (decryptedToken) {
				await oauthService.revokeToken(decryptedToken);
			}
		} catch (error) {
			console.warn("Token revocation failed, continuing with deletion:", error);
		}

		// Delete from database
		await db.delete(zohoConnections).where(eq(zohoConnections.id, id));

		res.json({ message: "Connection deleted successfully" });
	} catch (error: any) {
		console.error("Delete Zoho connection error:", error);
		res.status(500).json({ message: error.message });
	}
});

/**
 * POST /api/zoho/crm/sync/partner/:partnerId
 * Sync a partner to Zoho CRM
 */
router.post("/crm/sync/partner/:partnerId", async (req, res) => {
	try {
		const { partnerId } = req.params;
		const { connectionId } = req.body;

		if (!connectionId) {
			return res.status(400).json({ message: "Connection ID is required" });
		}

		const crmService = await ZohoCRMService.create(connectionId);
		const zohoAccountId = await crmService.syncPartnerToAccount(partnerId);

		res.json({
			message: "Partner synced successfully",
			zohoAccountId,
		});
	} catch (error: any) {
		console.error("Sync partner error:", error);
		res.status(500).json({ message: error.message });
	}
});

/**
 * POST /api/zoho/crm/sync/user/:userId
 * Sync a user to Zoho CRM
 */
router.post("/crm/sync/user/:userId", async (req, res) => {
	try {
		const { userId } = req.params;
		const { connectionId } = req.body;

		if (!connectionId) {
			return res.status(400).json({ message: "Connection ID is required" });
		}

		const crmService = await ZohoCRMService.create(connectionId);
		const zohoContactId = await crmService.syncUserToContact(userId);

		res.json({
			message: "User synced successfully",
			zohoContactId,
		});
	} catch (error: any) {
		console.error("Sync user error:", error);
		res.status(500).json({ message: error.message });
	}
});

/**
 * POST /api/zoho/crm/sync/bulk/partners
 * Bulk sync partners to Zoho CRM
 */
router.post("/crm/sync/bulk/partners", async (req, res) => {
	try {
		const { connectionId, partnerIds } = req.body;

		if (!connectionId || !partnerIds || !Array.isArray(partnerIds)) {
			return res
				.status(400)
				.json({ message: "Connection ID and partner IDs array are required" });
		}

		const crmService = await ZohoCRMService.create(connectionId);
		await crmService.bulkSyncPartnersToAccounts(partnerIds);

		res.json({ message: "Bulk sync initiated successfully" });
	} catch (error: any) {
		console.error("Bulk sync partners error:", error);
		res.status(500).json({ message: error.message });
	}
});

/**
 * GET /api/zoho/mappings
 * Get entity mappings
 */
router.get("/mappings", async (req, res) => {
	try {
		const { connectionId, entityType } = req.query;

		let query = db.select().from(zohoEntityMappings);

		if (connectionId) {
			query = query.where(
				eq(zohoEntityMappings.connectionId, connectionId as string),
			) as any;
		}

		const mappings = await query;

		// Filter by entity type if provided
		const filteredMappings = entityType
			? mappings.filter((m) => m.fintekproEntityType === entityType)
			: mappings;

		res.json(filteredMappings);
	} catch (error: any) {
		console.error("Get mappings error:", error);
		res.status(500).json({ message: error.message });
	}
});

/**
 * GET /api/zoho/sync-logs
 * Get sync logs
 */
router.get("/sync-logs", async (req, res) => {
	try {
		const { connectionId, limit = 100 } = req.query;

		let query = db
			.select()
			.from(zohoSyncLogs)
			.orderBy(desc(zohoSyncLogs.createdAt))
			.limit(Number.parseInt(limit as string));

		if (connectionId) {
			query = query.where(
				eq(zohoSyncLogs.connectionId, connectionId as string),
			) as any;
		}

		const logs = await query;

		res.json(logs);
	} catch (error: any) {
		console.error("Get sync logs error:", error);
		res.status(500).json({ message: error.message });
	}
});

/**
 * POST /api/zoho/webhooks/crm
 * Webhook receiver for Zoho CRM events
 * Protected by HMAC-SHA256 signature validation
 */
router.post("/webhooks/crm", validateZohoWebhookSignature, async (req, res) => {
	try {
		const payload = req.body;

		await db.insert(zohoWebhookEvents).values({
			zohoService: "CRM",
			zohoModule: payload.module || "unknown",
			eventType: payload.event_type || "update",
			webhookPayload: payload,
			status: "received",
		});

		res.status(200).json({ message: "Webhook received" });
	} catch (error: any) {
		console.error("CRM webhook error:", error);
		res.status(500).json({ message: error.message });
	}
});

/**
 * POST /api/zoho/webhooks/books
 * Webhook receiver for Zoho Books events
 * Protected by HMAC-SHA256 signature validation
 */
router.post(
	"/webhooks/books",
	validateZohoWebhookSignature,
	async (req, res) => {
		try {
			const payload = req.body;

			await db.insert(zohoWebhookEvents).values({
				zohoService: "Books",
				zohoModule: payload.module || "unknown",
				eventType: payload.event_type || "update",
				webhookPayload: payload,
				status: "received",
			});

			res.status(200).json({ message: "Webhook received" });
		} catch (error: any) {
			console.error("Books webhook error:", error);
			res.status(500).json({ message: error.message });
		}
	},
);

/**
 * POST /api/zoho/webhooks/desk
 * Webhook receiver for Zoho Desk events
 * Protected by HMAC-SHA256 signature validation
 */
router.post(
	"/webhooks/desk",
	validateZohoWebhookSignature,
	async (req, res) => {
		try {
			const payload = req.body;

			await db.insert(zohoWebhookEvents).values({
				zohoService: "Desk",
				zohoModule: payload.module || "unknown",
				eventType: payload.event_type || "update",
				webhookPayload: payload,
				status: "received",
			});

			res.status(200).json({ message: "Webhook received" });
		} catch (error: any) {
			console.error("Desk webhook error:", error);
			res.status(500).json({ message: error.message });
		}
	},
);

/**
 * POST /api/zoho/webhooks/meeting
 * Webhook receiver for Zoho Meeting events
 * Events: meeting.created, meeting.started, meeting.ended, recording.ready
 * Protected by HMAC-SHA256 signature validation
 */
router.post(
	"/webhooks/meeting",
	validateZohoWebhookSignature,
	async (req, res) => {
		try {
			const payload = req.body;

			console.info(
				"[Zoho Meeting Webhook] Received event:",
				payload.event_type || "unknown",
			);

			await db.insert(zohoWebhookEvents).values({
				zohoService: "Meeting",
				zohoModule: "meetings",
				eventType: payload.event_type || payload.action || "unknown",
				webhookPayload: payload,
				status: "received",
			});

			// Process meeting events
			if (payload.event_type === "meeting.ended") {
				// Log meeting completion for audit
				console.info("[Zoho Meeting] Meeting ended:", payload.meeting_key);
			} else if (payload.event_type === "recording.ready") {
				// Recording is available
				console.info("[Zoho Meeting] Recording ready:", payload.recording_url);
			}

			res.status(200).json({ message: "Meeting webhook received" });
		} catch (error: any) {
			console.error("Meeting webhook error:", error);
			res.status(500).json({ message: error.message });
		}
	},
);

/**
 * POST /api/zoho/webhooks/sign
 * Webhook receiver for Zoho Sign events
 * Events: document.signed, document.viewed, document.completed, document.declined
 * Protected by HMAC-SHA256 signature validation
 */
router.post(
	"/webhooks/sign",
	validateZohoWebhookSignature,
	async (req, res) => {
		try {
			const payload = req.body;

			console.info(
				"[Zoho Sign Webhook] Received event:",
				payload.action_type || payload.event_type || "unknown",
			);

			await db.insert(zohoWebhookEvents).values({
				zohoService: "Sign",
				zohoModule: "documents",
				eventType: payload.action_type || payload.event_type || "unknown",
				webhookPayload: payload,
				status: "received",
			});

			// Process sign events
			const actionType = payload.action_type || payload.event_type;
			if (
				actionType === "document.completed" ||
				actionType === "DocumentCompleted"
			) {
				// All signatures collected
				console.info(
					"[Zoho Sign] Document completed:",
					payload.requests?.request_id,
				);
				// TODO: Update related KYC or agreement status
			} else if (
				actionType === "document.declined" ||
				actionType === "DocumentDeclined"
			) {
				// Document was declined
				console.info(
					"[Zoho Sign] Document declined:",
					payload.requests?.request_id,
				);
			} else if (
				actionType === "document.signed" ||
				actionType === "RecipientCompleted"
			) {
				// A recipient has signed
				console.info(
					"[Zoho Sign] Recipient signed:",
					payload.requests?.request_id,
				);
			}

			res.status(200).json({ message: "Sign webhook received" });
		} catch (error: any) {
			console.error("Sign webhook error:", error);
			res.status(500).json({ message: error.message });
		}
	},
);

/**
 * POST /api/zoho/crm/commission-deal
 * Create a commission deal in Zoho CRM
 */
router.post("/crm/commission-deal", async (req, res) => {
	try {
		const { connectionId, commissionId } = req.body;

		if (!connectionId || !commissionId) {
			return res
				.status(400)
				.json({ message: "Connection ID and commission ID are required" });
		}

		const crmService = await ZohoCRMService.create(connectionId);
		const zohoDealId = await crmService.createCommissionDeal(commissionId);

		res.json({
			message: "Commission deal created successfully",
			zohoDealId,
		});
	} catch (error: any) {
		console.error("Create commission deal error:", error);
		res.status(500).json({ message: error.message });
	}
});

/**
 * PATCH /api/zoho/crm/commission-deal/:commissionId
 * Update commission deal stage
 */
router.patch("/crm/commission-deal/:commissionId", async (req, res) => {
	try {
		const { commissionId } = req.params;
		const { connectionId, status } = req.body;

		if (!connectionId || !status) {
			return res
				.status(400)
				.json({ message: "Connection ID and status are required" });
		}

		const crmService = await ZohoCRMService.create(connectionId);
		await crmService.updateCommissionDealStage(commissionId, status);

		res.json({ message: "Commission deal stage updated successfully" });
	} catch (error: any) {
		console.error("Update commission deal error:", error);
		res.status(500).json({ message: error.message });
	}
});

/**
 * GET /api/zoho/crm/partner/:partnerId/deals
 * Get all deals for a partner
 */
router.get("/crm/partner/:partnerId/deals", async (req, res) => {
	try {
		const { partnerId } = req.params;
		const { connectionId } = req.query;

		if (!connectionId) {
			return res.status(400).json({ message: "Connection ID is required" });
		}

		const crmService = await ZohoCRMService.create(connectionId as string);
		const deals = await crmService.getPartnerDeals(partnerId);

		res.json(deals);
	} catch (error: any) {
		console.error("Get partner deals error:", error);
		res.status(500).json({ message: error.message });
	}
});

// ============================================================================
// ZOHO CRM IMPORT ROUTES - Import from Zoho to FintekPro
// ============================================================================

/**
 * GET /api/zoho/crm/import/preview
 * Preview what would be imported from Zoho CRM
 * Works in both dev and production - no actual import happens
 */
router.get("/crm/import/preview", async (req, res) => {
	try {
		const { connectionId } = req.query;

		if (!connectionId) {
			return res.status(400).json({ message: "Connection ID is required" });
		}

		const crmService = await ZohoCRMService.create(connectionId as string);
		const preview = await crmService.getImportPreview();

		res.json({
			...preview,
			environment: process.env.NODE_ENV,
			canImport: process.env.NODE_ENV === "production",
			message:
				process.env.NODE_ENV !== "production"
					? "Import is disabled in development. Deploy to production to enable full import."
					: "Ready to import. This will create prospects in FintekPro.",
		});
	} catch (error: any) {
		console.error("[Zoho Import] Preview error:", error);
		res.status(500).json({ message: error.message });
	}
});

/**
 * POST /api/zoho/crm/import/contacts
 * Import contacts from Zoho CRM as prospects
 * PRODUCTION ONLY - will run dry in development
 */
router.post("/crm/import/contacts", async (req, res) => {
	try {
		const { connectionId, agentId, skipDuplicates = true } = req.body;

		if (!connectionId) {
			return res.status(400).json({ message: "Connection ID is required" });
		}
		if (!agentId) {
			return res
				.status(400)
				.json({ message: "Agent ID is required for attribution" });
		}

		const isProduction = process.env.NODE_ENV === "production";
		console.log(
			`[Zoho Import] Starting contacts import ${isProduction ? "(PRODUCTION)" : "(DRY RUN)"}`,
		);

		const crmService = await ZohoCRMService.create(connectionId as string);
		const result = await crmService.importContactsAsProspects({
			agentId,
			skipDuplicates,
		});

		res.json({
			...result,
			environment: process.env.NODE_ENV,
			wasActualImport: isProduction,
			message: isProduction
				? `Successfully imported ${result.imported} contacts as prospects`
				: `DRY RUN: Would have imported ${result.imported} contacts (not saved in development)`,
		});
	} catch (error: any) {
		console.error("[Zoho Import] Contacts import error:", error);
		res.status(500).json({ message: error.message });
	}
});

/**
 * POST /api/zoho/crm/import/leads
 * Import leads from Zoho CRM as prospects
 * PRODUCTION ONLY - will run dry in development
 */
router.post("/crm/import/leads", async (req, res) => {
	try {
		const { connectionId, agentId, skipDuplicates = true } = req.body;

		if (!connectionId) {
			return res.status(400).json({ message: "Connection ID is required" });
		}
		if (!agentId) {
			return res
				.status(400)
				.json({ message: "Agent ID is required for attribution" });
		}

		const isProduction = process.env.NODE_ENV === "production";
		console.log(
			`[Zoho Import] Starting leads import ${isProduction ? "(PRODUCTION)" : "(DRY RUN)"}`,
		);

		const crmService = await ZohoCRMService.create(connectionId as string);
		const result = await crmService.importLeadsAsProspects({
			agentId,
			skipDuplicates,
		});

		res.json({
			...result,
			environment: process.env.NODE_ENV,
			wasActualImport: isProduction,
			message: isProduction
				? `Successfully imported ${result.imported} leads as prospects`
				: `DRY RUN: Would have imported ${result.imported} leads (not saved in development)`,
		});
	} catch (error: any) {
		console.error("[Zoho Import] Leads import error:", error);
		res.status(500).json({ message: error.message });
	}
});

/**
 * GET /api/zoho/crm/import/status
 * Get current sync status between Zoho and FintekPro
 */
router.get("/crm/import/status", async (req, res) => {
	try {
		const { connectionId } = req.query;

		if (!connectionId) {
			return res.status(400).json({ message: "Connection ID is required" });
		}

		const crmService = await ZohoCRMService.create(connectionId as string);
		const status = await crmService.getSyncStatus();

		res.json({
			...status,
			environment: process.env.NODE_ENV,
			importEnabled: process.env.NODE_ENV === "production",
		});
	} catch (error: any) {
		console.error("[Zoho Import] Status error:", error);
		res.status(500).json({ message: error.message });
	}
});

// ============================================================================
// ADMIN ROUTES - For Admin Portal UI
// ============================================================================

/**
 * GET /api/zoho/admin/sync-logs
 * Get sync logs with filtering and pagination
 */
router.get("/admin/sync-logs", async (req, res) => {
	try {
		const {
			connectionId,
			service,
			status,
			startDate,
			endDate,
			limit = "50",
			offset = "0",
		} = req.query;

		const conditions = [];

		if (connectionId) {
			conditions.push(eq(zohoSyncLogs.connectionId, connectionId as string));
		}
		if (service) {
			conditions.push(eq(zohoSyncLogs.zohoService, service as string));
		}
		if (status) {
			conditions.push(eq(zohoSyncLogs.status, status as "success" | "failure"));
		}
		if (startDate) {
			conditions.push(
				gte(zohoSyncLogs.createdAt, new Date(startDate as string)),
			);
		}
		if (endDate) {
			conditions.push(lte(zohoSyncLogs.createdAt, new Date(endDate as string)));
		}

		const logs = await db
			.select()
			.from(zohoSyncLogs)
			.where(conditions.length > 0 ? and(...conditions) : undefined)
			.orderBy(desc(zohoSyncLogs.createdAt))
			.limit(Number.parseInt(limit as string))
			.offset(Number.parseInt(offset as string));

		// Get total count
		const countResult = await db
			.select({ count: sql<number>`count(*)` })
			.from(zohoSyncLogs)
			.where(conditions.length > 0 ? and(...conditions) : undefined);

		const total = Number(countResult[0]?.count || 0);

		res.json({
			logs,
			pagination: {
				total,
				limit: Number.parseInt(limit as string),
				offset: Number.parseInt(offset as string),
				hasMore: total > Number.parseInt(offset as string) + logs.length,
			},
		});
	} catch (error: any) {
		console.error("Get sync logs error:", error);
		res.status(500).json({ message: error.message });
	}
});

/**
 * GET /api/zoho/admin/webhook-events
 * Get webhook events with filtering
 */
router.get("/admin/webhook-events", async (req, res) => {
	try {
		const {
			connectionId,
			service,
			status,
			limit = "50",
			offset = "0",
		} = req.query;

		const conditions = [];

		if (connectionId) {
			conditions.push(
				eq(zohoWebhookEvents.connectionId, connectionId as string),
			);
		}
		if (service) {
			conditions.push(eq(zohoWebhookEvents.zohoService, service as string));
		}
		if (status) {
			conditions.push(
				eq(zohoWebhookEvents.status, status as "success" | "failure"),
			);
		}

		const events = await db
			.select()
			.from(zohoWebhookEvents)
			.where(conditions.length > 0 ? and(...conditions) : undefined)
			.orderBy(desc(zohoWebhookEvents.createdAt))
			.limit(Number.parseInt(limit as string))
			.offset(Number.parseInt(offset as string));

		const countResult = await db
			.select({ count: sql<number>`count(*)` })
			.from(zohoWebhookEvents)
			.where(conditions.length > 0 ? and(...conditions) : undefined);

		const total = Number(countResult[0]?.count || 0);

		res.json({
			events,
			pagination: {
				total,
				limit: Number.parseInt(limit as string),
				offset: Number.parseInt(offset as string),
				hasMore: total > Number.parseInt(offset as string) + events.length,
			},
		});
	} catch (error: any) {
		console.error("Get webhook events error:", error);
		res.status(500).json({ message: error.message });
	}
});

/**
 * GET /api/zoho/admin/stats
 * Get aggregated statistics
 */
router.get("/admin/stats", async (req, res) => {
	try {
		const { connectionId, days = "7" } = req.query;

		const startDate = new Date();
		startDate.setDate(startDate.getDate() - Number.parseInt(days as string));

		const conditions = [gte(zohoSyncLogs.createdAt, startDate)];
		if (connectionId) {
			conditions.push(eq(zohoSyncLogs.connectionId, connectionId as string));
		}

		// Get sync stats
		const syncStats = await db
			.select({
				service: zohoSyncLogs.zohoService,
				status: zohoSyncLogs.status,
				count: sql<number>`count(*)`,
				totalRecords: sql<number>`sum(${zohoSyncLogs.recordsProcessed})`,
				avgDuration: sql<number>`avg(${zohoSyncLogs.durationMs})`,
			})
			.from(zohoSyncLogs)
			.where(and(...conditions))
			.groupBy(zohoSyncLogs.zohoService, zohoSyncLogs.status);

		// Get webhook stats
		const webhookConditions = [gte(zohoWebhookEvents.createdAt, startDate)];
		if (connectionId) {
			webhookConditions.push(
				eq(zohoWebhookEvents.connectionId, connectionId as string),
			);
		}

		const webhookStats = await db
			.select({
				service: zohoWebhookEvents.zohoService,
				status: zohoWebhookEvents.status,
				count: sql<number>`count(*)`,
			})
			.from(zohoWebhookEvents)
			.where(and(...webhookConditions))
			.groupBy(zohoWebhookEvents.zohoService, zohoWebhookEvents.status);

		res.json({
			syncStats,
			webhookStats,
			period: {
				days: Number.parseInt(days as string),
				startDate,
				endDate: new Date(),
			},
		});
	} catch (error: any) {
		console.error("Get stats error:", error);
		res.status(500).json({ message: error.message });
	}
});

/**
 * GET /api/zoho/admin/rate-limits
 * Get current rate limit status for all connections
 */
router.get("/admin/rate-limits", async (req, res) => {
	try {
		const connections = await db.select().from(zohoConnections);

		const rateLimits = connections.map((conn) => ({
			connectionId: conn.id,
			connectionName: conn.connectionName,
			availableTokens: zohoRateLimiter.getAvailableTokens(conn.id),
			maxTokens: 50000, // Base limit
			percentUsed:
				((50000 - zohoRateLimiter.getAvailableTokens(conn.id)) / 50000) * 100,
		}));

		res.json({ rateLimits });
	} catch (error: any) {
		console.error("Get rate limits error:", error);
		res.status(500).json({ message: error.message });
	}
});

/**
 * GET /api/zoho/admin/webhook-config
 * Get webhook configuration URLs for setting up in Zoho
 * These are the URLs you need to configure in each Zoho service's webhook settings
 */
router.get("/admin/webhook-config", async (req, res) => {
	try {
		// Use request host for accurate URL generation across all environments
		const protocol = req.headers["x-forwarded-proto"] || "https";
		const host = req.headers.host || "fintekpro.com";

		// For production, always use the main domain for webhooks (not subdomains)
		const productionHost = host.includes("fintekpro.com")
			? "fintekpro.com"
			: host;
		const baseUrl = `${protocol}://${productionHost}`;

		const webhookSecret = process.env.ZOHO_WEBHOOK_SECRET;
		const secretConfigured = !!webhookSecret;

		const webhooks = [
			{
				service: "Zoho CRM",
				url: `${baseUrl}/api/zoho/webhooks/crm`,
				events: [
					"Lead.create",
					"Lead.update",
					"Contact.create",
					"Contact.update",
					"Deal.create",
					"Deal.update",
				],
				setupPath: "Settings > Automation > Actions > Webhooks",
				status: "active",
			},
			{
				service: "Zoho Books",
				url: `${baseUrl}/api/zoho/webhooks/books`,
				events: [
					"invoice.created",
					"invoice.paid",
					"payment.received",
					"expense.created",
				],
				setupPath: "Settings > Automation > Webhooks",
				status: "active",
			},
			{
				service: "Zoho Meeting",
				url: `${baseUrl}/api/zoho/webhooks/meeting`,
				events: [
					"meeting.created",
					"meeting.started",
					"meeting.ended",
					"recording.ready",
				],
				setupPath: "Settings > Integrations > Webhooks",
				status: "active",
			},
			{
				service: "Zoho Sign",
				url: `${baseUrl}/api/zoho/webhooks/sign`,
				events: [
					"DocumentCompleted",
					"DocumentDeclined",
					"RecipientCompleted",
					"DocumentViewed",
				],
				setupPath: "Settings > Developer Space > Webhooks",
				status: "active",
			},
		];

		// Get recent webhook stats
		const recentEvents = await db
			.select({
				service: zohoWebhookEvents.zohoService,
				count: sql<number>`count(*)`,
				lastEvent: sql<Date>`max(${zohoWebhookEvents.createdAt})`,
			})
			.from(zohoWebhookEvents)
			.where(
				gte(
					zohoWebhookEvents.createdAt,
					new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
				),
			)
			.groupBy(zohoWebhookEvents.zohoService);

		res.json({
			webhooks,
			secretConfigured,
			secretHint: secretConfigured
				? "Configured"
				: "Set ZOHO_WEBHOOK_SECRET in environment",
			recentActivity: recentEvents,
			instructions: {
				step1: "Copy the webhook URL for the service you want to configure",
				step2: "Go to the Zoho service admin panel",
				step3: "Navigate to the setup path shown above",
				step4: "Create a new webhook with the URL",
				step5: "Select the events you want to receive",
				step6: "Set the secret key (must match ZOHO_WEBHOOK_SECRET)",
				step7: "Save and test the webhook",
			},
		});
	} catch (error: any) {
		console.error("Get webhook config error:", error);
		res.status(500).json({ message: error.message });
	}
});

// ==================== ZOHO CAMPAIGNS ROUTES ====================

/**
 * GET /api/zoho/campaigns/lists
 * Get all mailing lists
 */
router.get("/campaigns/lists", async (req, res) => {
	try {
		const { connectionId } = req.query;
		if (!connectionId) {
			return res.status(400).json({ message: "connectionId required" });
		}

		const service = new ZohoCampaignsService(connectionId as string, "in");
		const lists = await service.getMailingLists();
		res.json({ lists });
	} catch (error: any) {
		console.error("Get campaigns lists error:", error);
		res.status(500).json({ message: error.message });
	}
});

/**
 * POST /api/zoho/campaigns/lists
 * Create a new mailing list
 */
router.post("/campaigns/lists", async (req, res) => {
	try {
		const {
			connectionId,
			listname,
			list_description,
			signup_form,
			double_optin,
		} = req.body;
		if (!connectionId || !listname) {
			return res
				.status(400)
				.json({ message: "connectionId and listname required" });
		}

		const service = new ZohoCampaignsService(connectionId, "in");
		const listKey = await service.createMailingList({
			listname,
			list_description,
			signup_form,
			double_optin,
		});
		res.json({ listKey, message: "Mailing list created successfully" });
	} catch (error: any) {
		console.error("Create campaigns list error:", error);
		res.status(500).json({ message: error.message });
	}
});

/**
 * POST /api/zoho/campaigns/lists/:listKey/contacts
 * Add contacts to a mailing list
 */
router.post("/campaigns/lists/:listKey/contacts", async (req, res) => {
	try {
		const { listKey } = req.params;
		const { connectionId, contacts } = req.body;
		if (!connectionId || !contacts || !Array.isArray(contacts)) {
			return res
				.status(400)
				.json({ message: "connectionId and contacts array required" });
		}

		const service = new ZohoCampaignsService(connectionId, "in");
		const result = await service.addContactsToList(listKey, contacts);
		res.json({ ...result, message: "Contacts added to list" });
	} catch (error: any) {
		console.error("Add contacts to list error:", error);
		res.status(500).json({ message: error.message });
	}
});

/**
 * GET /api/zoho/campaigns/campaigns
 * Get all campaigns
 */
router.get("/campaigns/campaigns", async (req, res) => {
	try {
		const { connectionId, status } = req.query;
		if (!connectionId) {
			return res.status(400).json({ message: "connectionId required" });
		}

		const service = new ZohoCampaignsService(connectionId as string, "in");
		const campaigns = await service.getCampaigns(status as any);
		res.json({ campaigns });
	} catch (error: any) {
		console.error("Get campaigns error:", error);
		res.status(500).json({ message: error.message });
	}
});

/**
 * POST /api/zoho/campaigns/send-festival
 * Send festival greeting campaign
 */
router.post("/campaigns/send-festival", async (req, res) => {
	try {
		const {
			connectionId,
			festivalName,
			subject,
			htmlContent,
			fromEmail,
			fromName,
			listKeys,
			scheduleTime,
		} = req.body;
		if (
			!connectionId ||
			!festivalName ||
			!subject ||
			!htmlContent ||
			!fromEmail ||
			!fromName ||
			!listKeys
		) {
			return res.status(400).json({ message: "Missing required fields" });
		}

		const service = new ZohoCampaignsService(connectionId, "in");
		const result = await service.createFestivalCampaign({
			festivalName,
			subject,
			htmlContent,
			fromEmail,
			fromName,
			listKeys,
			scheduleTime: scheduleTime ? new Date(scheduleTime) : undefined,
		});
		res.json({ ...result, message: "Festival campaign created" });
	} catch (error: any) {
		console.error("Send festival campaign error:", error);
		res.status(500).json({ message: error.message });
	}
});

/**
 * GET /api/zoho/campaigns/:campaignKey/stats
 * Get campaign statistics
 */
router.get("/campaigns/:campaignKey/stats", async (req, res) => {
	try {
		const { campaignKey } = req.params;
		const { connectionId } = req.query;
		if (!connectionId) {
			return res.status(400).json({ message: "connectionId required" });
		}

		const service = new ZohoCampaignsService(connectionId as string, "in");
		const stats = await service.getCampaignStats(campaignKey);
		res.json({ stats });
	} catch (error: any) {
		console.error("Get campaign stats error:", error);
		res.status(500).json({ message: error.message });
	}
});

// ==================== ZOHO MEETING ROUTES ====================

/**
 * GET /api/zoho/meeting/meetings
 * Get all meetings
 */
router.get("/meeting/meetings", async (req, res) => {
	try {
		const { connectionId, status, fromDate, toDate } = req.query;
		if (!connectionId) {
			return res.status(400).json({ message: "connectionId required" });
		}

		const { connection, zsoid } = await getConnectionWithZsoid(
			connectionId as string,
		);
		if (!connection) {
			return res.status(404).json({ message: "Connection not found" });
		}
		if (!zsoid) {
			return res
				.status(400)
				.json({ message: "ZSOID not configured for this connection" });
		}

		const service = new ZohoMeetingService(connectionId as string, "in", zsoid);
		const meetings = await service.getMeetings({
			status: status as any,
			fromDate: fromDate ? new Date(fromDate as string) : undefined,
			toDate: toDate ? new Date(toDate as string) : undefined,
		});
		res.json({ meetings });
	} catch (error: any) {
		console.error("Get meetings error:", error);
		res.status(500).json({ message: error.message });
	}
});

/**
 * POST /api/zoho/meeting/meetings
 * Create a new meeting
 */
router.post("/meeting/meetings", async (req, res) => {
	try {
		const {
			connectionId,
			topic,
			agenda,
			startTime,
			duration,
			timezone,
			participants,
		} = req.body;
		if (!connectionId || !topic || !startTime || !duration) {
			return res
				.status(400)
				.json({
					message: "connectionId, topic, startTime, and duration required",
				});
		}

		const { connection, zsoid } = await getConnectionWithZsoid(connectionId);
		if (!connection) {
			return res.status(404).json({ message: "Connection not found" });
		}
		if (!zsoid) {
			return res
				.status(400)
				.json({ message: "ZSOID not configured for this connection" });
		}

		const service = new ZohoMeetingService(connectionId, "in", zsoid);
		const meeting = await service.createMeeting({
			topic,
			agenda,
			startTime: new Date(startTime),
			duration,
			timezone,
			participants,
		});
		res.json({ meeting, message: "Meeting created successfully" });
	} catch (error: any) {
		console.error("Create meeting error:", error);
		res.status(500).json({ message: error.message });
	}
});

/**
 * POST /api/zoho/meeting/client-meeting
 * Create a client meeting with FintekPro integration
 */
router.post("/meeting/client-meeting", async (req, res) => {
	try {
		const {
			connectionId,
			clientName,
			clientEmail,
			agentName,
			purpose,
			startTime,
			duration,
		} = req.body;
		if (
			!connectionId ||
			!clientName ||
			!clientEmail ||
			!agentName ||
			!purpose ||
			!startTime
		) {
			return res.status(400).json({ message: "Missing required fields" });
		}

		const { connection, zsoid } = await getConnectionWithZsoid(connectionId);
		if (!connection) {
			return res.status(404).json({ message: "Connection not found" });
		}
		if (!zsoid) {
			return res
				.status(400)
				.json({ message: "ZSOID not configured for this connection" });
		}

		const service = new ZohoMeetingService(connectionId, "in", zsoid);
		const result = await service.createClientMeeting({
			clientName,
			clientEmail,
			agentName,
			purpose,
			startTime: new Date(startTime),
			duration,
		});
		res.json({ ...result, message: "Client meeting scheduled" });
	} catch (error: any) {
		console.error("Create client meeting error:", error);
		res.status(500).json({ message: error.message });
	}
});

/**
 * GET /api/zoho/meeting/webinars
 * Get all webinars
 */
router.get("/meeting/webinars", async (req, res) => {
	try {
		const { connectionId, status } = req.query;
		if (!connectionId) {
			return res.status(400).json({ message: "connectionId required" });
		}

		const { connection, zsoid } = await getConnectionWithZsoid(
			connectionId as string,
		);
		if (!connection) {
			return res.status(404).json({ message: "Connection not found" });
		}
		if (!zsoid) {
			return res
				.status(400)
				.json({ message: "ZSOID not configured for this connection" });
		}

		const service = new ZohoMeetingService(connectionId as string, "in", zsoid);
		const webinars = await service.getWebinars({ status: status as any });
		res.json({ webinars });
	} catch (error: any) {
		console.error("Get webinars error:", error);
		res.status(500).json({ message: error.message });
	}
});

/**
 * POST /api/zoho/meeting/webinars
 * Create a new webinar
 */
router.post("/meeting/webinars", async (req, res) => {
	try {
		const {
			connectionId,
			topic,
			description,
			startTime,
			duration,
			maxAttendees,
		} = req.body;
		if (!connectionId || !topic || !startTime || !duration) {
			return res
				.status(400)
				.json({
					message: "connectionId, topic, startTime, and duration required",
				});
		}

		const { connection, zsoid } = await getConnectionWithZsoid(connectionId);
		if (!connection) {
			return res.status(404).json({ message: "Connection not found" });
		}
		if (!zsoid) {
			return res
				.status(400)
				.json({ message: "ZSOID not configured for this connection" });
		}

		const service = new ZohoMeetingService(connectionId, "in", zsoid);
		const result = await service.createInvestorWebinar({
			topic,
			description: description || "",
			startTime: new Date(startTime),
			duration,
			maxAttendees,
		});
		res.json({ ...result, message: "Webinar created successfully" });
	} catch (error: any) {
		console.error("Create webinar error:", error);
		res.status(500).json({ message: error.message });
	}
});

/**
 * POST /api/zoho/meeting/webinars/:webinarKey/register
 * Register clients for a webinar
 */
router.post("/meeting/webinars/:webinarKey/register", async (req, res) => {
	try {
		const { webinarKey } = req.params;
		const { connectionId, clients } = req.body;
		if (!connectionId || !clients || !Array.isArray(clients)) {
			return res
				.status(400)
				.json({ message: "connectionId and clients array required" });
		}

		const { connection, zsoid } = await getConnectionWithZsoid(connectionId);
		if (!connection) {
			return res.status(404).json({ message: "Connection not found" });
		}
		if (!zsoid) {
			return res
				.status(400)
				.json({ message: "ZSOID not configured for this connection" });
		}

		const service = new ZohoMeetingService(connectionId, "in", zsoid);
		const result = await service.bulkRegisterClients(webinarKey, clients);
		res.json({ ...result, message: "Clients registered for webinar" });
	} catch (error: any) {
		console.error("Register for webinar error:", error);
		res.status(500).json({ message: error.message });
	}
});

// ==================== ZOHO SIGN ROUTES ====================

/**
 * GET /api/zoho/sign/documents
 * Get all sign documents
 */
router.get("/sign/documents", async (req, res) => {
	try {
		const { connectionId, status, page, limit } = req.query;
		if (!connectionId) {
			return res.status(400).json({ message: "connectionId required" });
		}

		const service = new ZohoSignService(connectionId as string, "in");
		const documents = await service.getDocuments({
			status: status as any,
			page: page ? Number.parseInt(page as string) : undefined,
			limit: limit ? Number.parseInt(limit as string) : undefined,
		});
		res.json({ documents });
	} catch (error: any) {
		console.error("Get sign documents error:", error);
		res.status(500).json({ message: error.message });
	}
});

/**
 * GET /api/zoho/sign/documents/:requestId
 * Get document details
 */
router.get("/sign/documents/:requestId", async (req, res) => {
	try {
		const { requestId } = req.params;
		const { connectionId } = req.query;
		if (!connectionId) {
			return res.status(400).json({ message: "connectionId required" });
		}

		const service = new ZohoSignService(connectionId as string, "in");
		const document = await service.getDocumentDetails(requestId);
		res.json({ document });
	} catch (error: any) {
		console.error("Get sign document details error:", error);
		res.status(500).json({ message: error.message });
	}
});

/**
 * GET /api/zoho/sign/documents/:requestId/status
 * Get signature status
 */
router.get("/sign/documents/:requestId/status", async (req, res) => {
	try {
		const { requestId } = req.params;
		const { connectionId } = req.query;
		if (!connectionId) {
			return res.status(400).json({ message: "connectionId required" });
		}

		const service = new ZohoSignService(connectionId as string, "in");
		const status = await service.getSignatureStatus(requestId);
		res.json({ status });
	} catch (error: any) {
		console.error("Get signature status error:", error);
		res.status(500).json({ message: error.message });
	}
});

/**
 * POST /api/zoho/sign/kyc-document
 * Create KYC sign request
 */
router.post("/sign/kyc-document", async (req, res) => {
	try {
		const {
			connectionId,
			clientName,
			clientEmail,
			documentType,
			documentContent,
			agentEmail,
			agentName,
		} = req.body;
		if (
			!connectionId ||
			!clientName ||
			!clientEmail ||
			!documentType ||
			!documentContent
		) {
			return res.status(400).json({ message: "Missing required fields" });
		}

		const service = new ZohoSignService(connectionId, "in");
		const result = await service.createKYCSignRequest({
			clientName,
			clientEmail,
			documentType,
			documentContent: Buffer.from(documentContent, "base64"),
			agentEmail,
			agentName,
		});
		res.json({ ...result, message: "KYC document sent for signature" });
	} catch (error: any) {
		console.error("Create KYC sign request error:", error);
		res.status(500).json({ message: error.message });
	}
});

/**
 * POST /api/zoho/sign/investment-agreement
 * Create investment agreement sign request
 */
router.post("/sign/investment-agreement", async (req, res) => {
	try {
		const {
			connectionId,
			clientName,
			clientEmail,
			investmentType,
			investmentAmount,
			documentContent,
		} = req.body;
		if (
			!connectionId ||
			!clientName ||
			!clientEmail ||
			!investmentType ||
			!investmentAmount ||
			!documentContent
		) {
			return res.status(400).json({ message: "Missing required fields" });
		}

		const service = new ZohoSignService(connectionId, "in");
		const result = await service.createInvestmentAgreement({
			clientName,
			clientEmail,
			investmentType,
			investmentAmount,
			documentContent: Buffer.from(documentContent, "base64"),
		});
		res.json({ ...result, message: "Investment agreement sent for signature" });
	} catch (error: any) {
		console.error("Create investment agreement error:", error);
		res.status(500).json({ message: error.message });
	}
});

/**
 * GET /api/zoho/sign/templates
 * Get all sign templates
 */
router.get("/sign/templates", async (req, res) => {
	try {
		const { connectionId } = req.query;
		if (!connectionId) {
			return res.status(400).json({ message: "connectionId required" });
		}

		const service = new ZohoSignService(connectionId as string, "in");
		const templates = await service.getTemplates();
		res.json({ templates });
	} catch (error: any) {
		console.error("Get sign templates error:", error);
		res.status(500).json({ message: error.message });
	}
});

/**
 * POST /api/zoho/sign/documents/:requestId/remind
 * Send reminder to signer
 */
router.post("/sign/documents/:requestId/remind", async (req, res) => {
	try {
		const { requestId } = req.params;
		const { connectionId, actionId } = req.body;
		if (!connectionId || !actionId) {
			return res
				.status(400)
				.json({ message: "connectionId and actionId required" });
		}

		const service = new ZohoSignService(connectionId, "in");
		const success = await service.remindRecipient(requestId, actionId);
		res.json({
			success,
			message: success ? "Reminder sent" : "Failed to send reminder",
		});
	} catch (error: any) {
		console.error("Send reminder error:", error);
		res.status(500).json({ message: error.message });
	}
});

/**
 * GET /api/zoho/sign/documents/:requestId/download
 * Download signed document
 */
router.get("/sign/documents/:requestId/download", async (req, res) => {
	try {
		const { requestId } = req.params;
		const { connectionId } = req.query;
		if (!connectionId) {
			return res.status(400).json({ message: "connectionId required" });
		}

		const service = new ZohoSignService(connectionId as string, "in");
		const pdfBuffer = await service.downloadSignedDocument(requestId);

		res.setHeader("Content-Type", "application/pdf");
		res.setHeader(
			"Content-Disposition",
			`attachment; filename="signed_document_${requestId}.pdf"`,
		);
		res.send(pdfBuffer);
	} catch (error: any) {
		console.error("Download signed document error:", error);
		res.status(500).json({ message: error.message });
	}
});

// ==================== ZOHO BIDIRECTIONAL SYNC ROUTES ====================

/**
 * POST /api/zoho/admin/sync/full
 * Trigger a full bidirectional sync (production only)
 */
router.post("/admin/sync/full", async (req, res) => {
	try {
		if (process.env.NODE_ENV !== "production") {
			return res.json({
				message:
					"Full sync is disabled in development. Only the production database syncs with Zoho.",
				environment: process.env.NODE_ENV,
				syncExecuted: false,
			});
		}

		const { ZohoSyncOrchestrator } = await import(
			"./services/sync-orchestrator"
		);
		const orchestrator = await ZohoSyncOrchestrator.create();
		if (!orchestrator) {
			return res
				.status(503)
				.json({ message: "No active Zoho connection configured" });
		}
		const report = await orchestrator.runFullSync();

		res.json({
			message: "Full sync completed",
			environment: "production",
			syncExecuted: true,
			report,
		});
	} catch (error: any) {
		console.error("[Zoho Sync] Full sync error:", error);
		res.status(500).json({ message: error.message });
	}
});

/**
 * POST /api/zoho/admin/sync/incremental
 * Trigger an incremental sync (production only)
 */
router.post("/admin/sync/incremental", async (req, res) => {
	try {
		if (process.env.NODE_ENV !== "production") {
			return res.json({
				message:
					"Incremental sync is disabled in development. Only the production database syncs with Zoho.",
				environment: process.env.NODE_ENV,
				syncExecuted: false,
			});
		}

		const { ZohoSyncOrchestrator } = await import(
			"./services/sync-orchestrator"
		);
		const orchestrator = await ZohoSyncOrchestrator.create();
		if (!orchestrator) {
			return res
				.status(503)
				.json({ message: "No active Zoho connection configured" });
		}
		const report = await orchestrator.runIncrementalSync();

		res.json({
			message: "Incremental sync completed",
			environment: "production",
			syncExecuted: true,
			report,
		});
	} catch (error: any) {
		console.error("[Zoho Sync] Incremental sync error:", error);
		res.status(500).json({ message: error.message });
	}
});

/**
 * POST /api/zoho/admin/sync/webhooks
 * Process pending webhook events (production only)
 */
router.post("/admin/sync/webhooks", async (req, res) => {
	try {
		if (process.env.NODE_ENV !== "production") {
			return res.json({
				message:
					"Webhook processing is disabled in development. Only the production database syncs with Zoho.",
				environment: process.env.NODE_ENV,
				syncExecuted: false,
			});
		}

		const { ZohoWebhookProcessor } = await import(
			"./services/webhook-processor"
		);
		const processor = await ZohoWebhookProcessor.create();
		if (!processor) {
			return res
				.status(503)
				.json({ message: "No active Zoho connection configured" });
		}
		const limit = Number.parseInt(req.body.limit || "50");
		const result = await processor.processPendingEvents(limit);

		res.json({
			message: "Webhook processing completed",
			environment: "production",
			syncExecuted: true,
			result,
		});
	} catch (error: any) {
		console.error("[Zoho Sync] Webhook processing error:", error);
		res.status(500).json({ message: error.message });
	}
});

/**
 * GET /api/zoho/admin/sync/health
 * Get sync health status (works in all environments for monitoring)
 */
router.get("/admin/sync/health", async (req, res) => {
	try {
		const { ZohoSyncOrchestrator } = await import(
			"./services/sync-orchestrator"
		);
		const orchestrator = await ZohoSyncOrchestrator.create();
		if (!orchestrator) {
			return res.json({
				environment: process.env.NODE_ENV,
				syncEnabled: false,
				health: null,
				message: "No active Zoho connection configured",
			});
		}
		const health = await orchestrator.getSyncHealth();

		res.json({
			environment: process.env.NODE_ENV,
			syncEnabled: health.syncEnabled,
			health,
		});
	} catch (error: any) {
		console.error("[Zoho Sync] Health check error:", error);
		res.status(500).json({ message: error.message });
	}
});

router.get("/admin/sync/webhook-stats", async (req, res) => {
	try {
		const { ZohoWebhookProcessor } = await import(
			"./services/webhook-processor"
		);
		const processor = await ZohoWebhookProcessor.create();
		if (!processor) {
			return res.json({
				environment: process.env.NODE_ENV,
				stats: null,
				message: "No active Zoho connection configured",
			});
		}
		const stats = await processor.getProcessingStats();

		res.json({
			environment: process.env.NODE_ENV,
			stats,
		});
	} catch (error: any) {
		console.error("[Zoho Sync] Webhook stats error:", error);
		res.status(500).json({ message: error.message });
	}
});

router.get("/admin/sync/reconciliation", async (req, res) => {
	try {
		const { ZohoSyncOrchestrator } = await import(
			"./services/sync-orchestrator"
		);
		const orchestrator = await ZohoSyncOrchestrator.create();
		if (!orchestrator) {
			return res
				.status(503)
				.json({ message: "No active Zoho connection configured" });
		}
		const report = await orchestrator.runReconciliation();

		res.json({
			environment: process.env.NODE_ENV,
			reconciliation: report,
		});
	} catch (error: any) {
		console.error("[Zoho Sync] Reconciliation error:", error);
		res.status(500).json({ message: error.message });
	}
});

router.get("/admin/sync/dead-letter", async (req, res) => {
	try {
		const { ZohoWebhookProcessor } = await import(
			"./services/webhook-processor"
		);
		const processor = await ZohoWebhookProcessor.create();
		if (!processor) {
			return res.json({
				environment: process.env.NODE_ENV,
				count: 0,
				events: [],
				message: "No active Zoho connection configured",
			});
		}
		const events = await processor.getDeadLetterEvents(20);

		res.json({
			environment: process.env.NODE_ENV,
			count: events.length,
			events,
		});
	} catch (error: any) {
		console.error("[Zoho Sync] Dead letter query error:", error);
		res.status(500).json({ message: error.message });
	}
});

router.post("/admin/sync/dead-letter/:eventId/retry", async (req, res) => {
	try {
		const { ZohoWebhookProcessor } = await import(
			"./services/webhook-processor"
		);
		const processor = await ZohoWebhookProcessor.create();
		if (!processor) {
			return res
				.status(503)
				.json({ message: "No active Zoho connection configured" });
		}
		const success = await processor.retryDeadLetterEvent(req.params.eventId);

		if (success) {
			res.json({
				message: "Event reset for retry",
				eventId: req.params.eventId,
			});
		} else {
			res.status(404).json({ message: "Dead letter event not found" });
		}
	} catch (error: any) {
		console.error("[Zoho Sync] Dead letter retry error:", error);
		res.status(500).json({ message: error.message });
	}
});

// ==================== ZOHO INTEGRATION STATUS ====================

/**
 * GET /api/zoho/integration-status
 * Get status of all Zoho integrations
 */
router.get("/integration-status", async (req, res) => {
	try {
		const refreshToken = process.env.ZOHO_REFRESH_TOKEN;
		const clientId = process.env.ZOHO_CLIENT_ID;
		const clientSecret = process.env.ZOHO_CLIENT_SECRET;

		if (!refreshToken || !clientId || !clientSecret) {
			return res.json({
				configured: false,
				message: "Zoho credentials not configured",
				applications: [],
			});
		}

		const oauthService = new ZohoOAuthService("in");
		const tokenResponse = await oauthService.refreshAccessToken(refreshToken);

		const scopes = tokenResponse.scope?.split(" ") || [];
		const applications = [
			{
				name: "CRM",
				configured: scopes.some((s) => s.includes("ZohoCRM")),
				scopes: scopes.filter((s) => s.includes("ZohoCRM")),
			},
			{
				name: "Books",
				configured: scopes.some((s) => s.includes("ZohoBooks")),
				scopes: scopes.filter((s) => s.includes("ZohoBooks")),
			},
			{
				name: "Campaigns",
				configured: scopes.some((s) => s.includes("ZohoCampaigns")),
				scopes: scopes.filter((s) => s.includes("ZohoCampaigns")),
			},
			{
				name: "Meeting",
				configured: scopes.some((s) => s.includes("ZohoMeeting")),
				scopes: scopes.filter((s) => s.includes("ZohoMeeting")),
			},
			{
				name: "Sign",
				configured: scopes.some((s) => s.includes("ZohoSign")),
				scopes: scopes.filter((s) => s.includes("ZohoSign")),
			},
		];

		res.json({
			configured: true,
			apiDomain: tokenResponse.api_domain,
			applications,
			totalScopes: scopes.length,
		});
	} catch (error: any) {
		console.error("Get integration status error:", error);
		res.status(500).json({ message: error.message });
	}
});

export default router;
