/**
 * Admin Prospect Dashboard Routes
 *
 * Comprehensive prospect management for admins:
 * - View all prospects across agents (B2B leads + individual prospects)
 * - Create prospects and assign to agents
 * - Import leads from Zoho CRM
 * - Assignment workflow with history tracking
 */

import { Request, Response, Router } from "express";
import { db } from "../db";
import {
	prospectLeads,
	prospectClients,
	leadActivities,
	users,
} from "@shared/schema";
import {
	eq,
	and,
	desc,
	sql,
	ilike,
	or,
	count,
	isNull,
	isNotNull,
} from "drizzle-orm";
import { ZohoCRMService } from "../zoho/services/crm";
import { getZohoConnectionId } from "../zoho/connection-resolver";
import { apiResponse } from "../utils/responses";
import { requireAdmin } from "../middleware/roleMiddleware";
import { batchEnrichMissingContacts, enrichProspectContacts } from "../services/prospect-contact-enricher";
import { logger } from "../logger";

const router = Router();

/**
 * Get consolidated metrics for admin dashboard
 */
router.get("/metrics", requireAdmin, async (req: any, res: Response) => {
	try {
		const [b2bStats] = await db
			.select({
				total: count(),
				new: sql<number>`COUNT(*) FILTER (WHERE status = 'new')`,
				contacted: sql<number>`COUNT(*) FILTER (WHERE status = 'contacted')`,
				qualified: sql<number>`COUNT(*) FILTER (WHERE status = 'qualified')`,
				converted: sql<number>`COUNT(*) FILTER (WHERE status = 'converted')`,
				rejected: sql<number>`COUNT(*) FILTER (WHERE status = 'rejected')`,
				unassigned: sql<number>`COUNT(*) FILTER (WHERE assigned_to IS NULL)`,
				hotLeads: sql<number>`COUNT(*) FILTER (WHERE lead_quality = 'hot')`,
				warmLeads: sql<number>`COUNT(*) FILTER (WHERE lead_quality = 'warm')`,
				coldLeads: sql<number>`COUNT(*) FILTER (WHERE lead_quality = 'cold')`,
			})
			.from(prospectLeads);

		const [individualStats] = await db
			.select({
				total: count(),
				prospect: sql<number>`COUNT(*) FILTER (WHERE state = 'prospect')`,
				onboarded: sql<number>`COUNT(*) FILTER (WHERE state = 'onboarded')`,
				activeClient: sql<number>`COUNT(*) FILTER (WHERE state = 'active_client')`,
			})
			.from(prospectClients);

		const agentDistribution = await db
			.select({
				agentId: prospectClients.agentId,
				firstName: users.firstName,
				lastName: users.lastName,
				prospectCount: count(),
			})
			.from(prospectClients)
			.leftJoin(users, eq(prospectClients.agentId, users.id))
			.groupBy(prospectClients.agentId, users.firstName, users.lastName)
			.orderBy(desc(count()));

		const b2bAgentDistribution = await db
			.select({
				agentId: prospectLeads.assignedTo,
				firstName: users.firstName,
				lastName: users.lastName,
				leadCount: count(),
			})
			.from(prospectLeads)
			.leftJoin(users, eq(prospectLeads.assignedTo, users.id))
			.where(isNotNull(prospectLeads.assignedTo))
			.groupBy(prospectLeads.assignedTo, users.firstName, users.lastName)
			.orderBy(desc(count()));

		res.json({
			b2bLeads: b2bStats,
			individualProspects: individualStats,
			agentDistribution: {
				individual: agentDistribution,
				b2b: b2bAgentDistribution,
			},
			totals: {
				allProspects: (b2bStats?.total || 0) + (individualStats?.total || 0),
				unassignedB2B: b2bStats?.unassigned || 0,
			},
		});
	} catch (error) {
		console.error("Error fetching prospect metrics:", error);
		return apiResponse.serverError(res, "Failed to fetch prospect metrics");
	}
});

/**
 * Get all B2B prospect leads with filtering
 */
router.get("/b2b-leads", requireAdmin, async (req: any, res: Response) => {
	try {
		const {
			status,
			quality,
			assignedTo,
			search,
			source,
			limit = 50,
			offset = 0,
		} = req.query;

		const conditions: any[] = [];

		if (status && status !== "all") {
			conditions.push(eq(prospectLeads.status, status as string));
		}
		if (quality && quality !== "all") {
			conditions.push(eq(prospectLeads.leadQuality, quality as string));
		}
		if (assignedTo === "unassigned") {
			conditions.push(isNull(prospectLeads.assignedTo));
		} else if (assignedTo && assignedTo !== "all") {
			conditions.push(eq(prospectLeads.assignedTo, assignedTo as string));
		}
		if (source && source !== "all") {
			conditions.push(eq(prospectLeads.source, source as string));
		}
		if (search) {
			const s = (search as string).trim();
			if (s) {
				conditions.push(
					or(
						ilike(prospectLeads.companyName, `%${s}%`),
						ilike(prospectLeads.primaryEmail, `%${s}%`),
						ilike(prospectLeads.primaryMobile, `%${s}%`),
						ilike(prospectLeads.cin, `%${s}%`),
						ilike(prospectLeads.city, `%${s}%`),
						ilike(prospectLeads.state, `%${s}%`),
						ilike(prospectLeads.industrySegment, `%${s}%`),
					),
				);
			}
		}

		const leads = await db
			.select({
				id: prospectLeads.id,
				cin: prospectLeads.cin,
				companyName: prospectLeads.companyName,
				primaryEmail: prospectLeads.primaryEmail,
				primaryMobile: prospectLeads.primaryMobile,
				city: prospectLeads.city,
				state: prospectLeads.state,
				address: prospectLeads.address,
				pincode: prospectLeads.pincode,
				industrySegment: prospectLeads.industrySegment,
				companyCategory: prospectLeads.companyCategory,
				leadScore: prospectLeads.leadScore,
				leadQuality: prospectLeads.leadQuality,
				status: prospectLeads.status,
				assignedTo: prospectLeads.assignedTo,
				assignedAgentName: sql<string>`CONCAT(${users.firstName}, ' ', ${users.lastName})`,
				source: prospectLeads.source,
				lastContactedAt: prospectLeads.lastContactedAt,
				nextFollowUpAt: prospectLeads.nextFollowUpAt,
				createdAt: prospectLeads.createdAt,
				compositeScore: prospectLeads.compositeScore,
				wealthScore: prospectLeads.wealthScore,
				activityScore: prospectLeads.activityScore,
				relationshipScore: prospectLeads.relationshipScore,
				estimatedNetworth: prospectLeads.estimatedNetworth,
				scoredAt: prospectLeads.scoredAt,
			})
			.from(prospectLeads)
			.leftJoin(users, eq(prospectLeads.assignedTo, users.id))
			.where(conditions.length > 0 ? and(...conditions) : undefined)
			.orderBy(desc(prospectLeads.leadScore), desc(prospectLeads.createdAt))
			.limit(Number.parseInt(limit as string))
			.offset(Number.parseInt(offset as string));

		const [totalCount] = await db
			.select({ count: count() })
			.from(prospectLeads)
			.where(conditions.length > 0 ? and(...conditions) : undefined);

		res.json({
			leads,
			total: totalCount?.count || 0,
			limit: Number.parseInt(limit as string),
			offset: Number.parseInt(offset as string),
		});
	} catch (error) {
		console.error("Error fetching B2B leads:", error);
		return apiResponse.serverError(res, "Failed to fetch B2B leads");
	}
});

/**
 * Update B2B prospect lead
 */
router.patch("/b2b-leads/:id", requireAdmin, async (req: any, res: Response) => {
	try {
		const { id } = req.params;
		const updates = req.body;

		const [existing] = await db
			.select()
			.from(prospectLeads)
			.where(eq(prospectLeads.id, id))
			.limit(1);

		if (!existing) {
			return apiResponse.notFound(res, "Lead not found");
		}

		const cleanUpdates: any = { updatedAt: new Date() };
		if (updates.companyName !== undefined) cleanUpdates.companyName = updates.companyName.trim();
		if (updates.cin !== undefined) cleanUpdates.cin = updates.cin?.trim() || null;
		if (updates.primaryEmail !== undefined) cleanUpdates.primaryEmail = updates.primaryEmail?.trim() || null;
		if (updates.primaryMobile !== undefined) cleanUpdates.primaryMobile = updates.primaryMobile?.trim() || null;
		if (updates.address !== undefined) cleanUpdates.address = updates.address?.trim() || null;
		if (updates.city !== undefined) cleanUpdates.city = updates.city?.trim() || null;
		if (updates.state !== undefined) cleanUpdates.state = updates.state?.trim() || null;
		if (updates.pincode !== undefined) cleanUpdates.pincode = updates.pincode?.trim() || null;
		if (updates.industrySegment !== undefined) cleanUpdates.industrySegment = updates.industrySegment?.trim() || null;
		if (updates.companyCategory !== undefined) cleanUpdates.companyCategory = updates.companyCategory;
		if (updates.leadQuality !== undefined) cleanUpdates.leadQuality = updates.leadQuality;
		if (updates.status !== undefined) cleanUpdates.status = updates.status;
		if (updates.notes !== undefined) cleanUpdates.notes = updates.notes?.trim() || null;

		const [updated] = await db
			.update(prospectLeads)
			.set(cleanUpdates)
			.where(eq(prospectLeads.id, id))
			.returning();

		res.json(updated);
	} catch (error) {
		console.error("Error updating B2B lead:", error);
		return apiResponse.serverError(res, "Failed to update B2B lead");
	}
});

/**
 * Delete B2B prospect lead
 */
router.delete("/b2b-leads/:id", requireAdmin, async (req: any, res: Response) => {
	try {
		const { id } = req.params;
		await db.delete(prospectLeads).where(eq(prospectLeads.id, id));
		res.json({ success: true, message: "Lead deleted successfully" });
	} catch (error) {
		console.error("Error deleting B2B lead:", error);
		return apiResponse.serverError(res, "Failed to delete B2B lead");
	}
});

/**
 * Create new B2B prospect lead
 */
/**
 * Create new B2B prospect lead (dedup-guarded)
 *
 * Purpose : Insert a new B2B company lead, rejecting the request if an
 *           identical lead already exists so the DB stays clean.
 * Dedup rules (checked in priority order):
 *   1. CIN match          – same registered company (definitive)
 *   2. Primary email match – same contact person at different companies
 *   3. Normalised company name match – fuzzy-safe exact-lower match
 * Outputs : 201 newLead | 409 Conflict with existing lead id
 */
router.post("/b2b-leads", requireAdmin, async (req: any, res: Response) => {
	try {
		const {
			companyName,
			cin,
			primaryEmail,
			primaryMobile,
			address,
			city,
			state,
			pincode,
			industrySegment,
			companyCategory,
			leadQuality,
			assignedTo,
			notes,
		} = req.body;

		if (!companyName?.trim()) {
			return apiResponse.badRequest(res, "Company name is required");
		}

		const cleanCin = cin?.trim() || null;
		const cleanEmail = primaryEmail?.trim().toLowerCase() || null;
		const cleanCompanyName = companyName.trim().toLowerCase();

		// ── Duplicate detection ─────────────────────────────────────────────
		// Build OR conditions for all available identifiers
		const dupConditions: any[] = [
			ilike(prospectLeads.companyName, cleanCompanyName),
		];
		if (cleanCin) dupConditions.push(ilike(prospectLeads.cin, cleanCin));
		if (cleanEmail) dupConditions.push(ilike(prospectLeads.primaryEmail, cleanEmail));

		const [existing] = await db
			.select({ id: prospectLeads.id, companyName: prospectLeads.companyName, cin: prospectLeads.cin })
			.from(prospectLeads)
			.where(or(...dupConditions))
			.limit(1);

		if (existing) {
			return res.status(409).json({
				success: false,
				error: "DUPLICATE_LEAD",
				message: `A lead for "${existing.companyName}" already exists${
					existing.cin ? ` (CIN: ${existing.cin})` : ""
				}.`,
				existingId: existing.id,
			});
		}

		// ── Insert ──────────────────────────────────────────────────────────
		const cleanAssignedTo = assignedTo?.trim() || null;

		const [newLead] = await db
			.insert(prospectLeads)
			.values({
				companyName: companyName.trim(),
				cin: cleanCin,
				primaryEmail: cleanEmail,
				primaryMobile: primaryMobile?.trim() || null,
				address: address?.trim() || null,
				city: city?.trim() || null,
				state: state?.trim() || null,
				pincode: pincode?.trim() || null,
				industrySegment: industrySegment?.trim() || null,
				companyCategory: companyCategory || "mid_market",
				leadQuality: leadQuality || "warm",
				leadScore: leadQuality === "hot" ? 80 : leadQuality === "warm" ? 50 : 20,
				assignedTo: cleanAssignedTo,
				source: "manual",
				status: "new",
				notes: notes?.trim() || null,
			})
			.returning();

		if (cleanAssignedTo) {
			await db.insert(leadActivities).values({
				leadId: newLead.id,
				activityType: "assignment",
				description: "Lead assigned to agent by admin",
				performedBy: req.user.id,
				metadata: { assignedTo: cleanAssignedTo, assignedBy: req.user.id },
			} as any);
		}

		logger.info("B2B_LEAD_CREATED", {
			event: "B2B_LEAD_CREATED",
			user_id: req.user?.id,
			lead_id: newLead.id,
			companyName: newLead.companyName,
			cin: newLead.cin,
			source: "manual",
			status: "success",
			latency_ms: 0,
		});

		res.status(201).json(newLead);
	} catch (error) {
		console.error("Error creating B2B lead:", error);
		return apiResponse.serverError(res, "Failed to create B2B lead");
	}
});

/**
 * Get all individual prospects with filtering
 */
router.get(
	"/individual-prospects",
	requireAdmin,
	async (req: any, res: Response) => {
		try {
			const {
				state,
				agentId,
				clientType,
				search,
				limit = 50,
				offset = 0,
			} = req.query;

			const conditions: any[] = [];

			if (state && state !== "all") {
				conditions.push(eq(prospectClients.state, state as string));
			}
			if (agentId && agentId !== "all") {
				conditions.push(eq(prospectClients.agentId, agentId as string));
			}
			if (clientType && clientType !== "all") {
				conditions.push(eq(prospectClients.clientType, clientType as string));
			}
			if (search) {
				conditions.push(
					or(
						ilike(prospectClients.name, `%${search}%`),
						ilike(prospectClients.email, `%${search}%`),
						ilike(prospectClients.pan, `%${search}%`),
						ilike(prospectClients.mobile, `%${search}%`),
					),
				);
			}

			const prospects = await db
				.select({
					id: prospectClients.id,
					name: prospectClients.name,
					email: prospectClients.email,
					mobile: prospectClients.mobile,
					pan: prospectClients.pan,
					clientType: prospectClients.clientType,
					indicativeRiskProfile: prospectClients.indicativeRiskProfile,
					state: prospectClients.state,
					agentId: prospectClients.agentId,
					agentName: sql<string>`CONCAT(${users.firstName}, ' ', ${users.lastName})`,
					portfolioFetchConsent: prospectClients.portfolioFetchConsent,
					advisoryConsent: prospectClients.advisoryConsent,
					createdAt: prospectClients.createdAt,
					updatedAt: prospectClients.updatedAt,
				})
				.from(prospectClients)
				.leftJoin(users, eq(prospectClients.agentId, users.id))
				.where(conditions.length > 0 ? and(...conditions) : undefined)
				.orderBy(desc(prospectClients.updatedAt))
				.limit(Number.parseInt(limit as string))
				.offset(Number.parseInt(offset as string));

			const [totalCount] = await db
				.select({ count: count() })
				.from(prospectClients)
				.where(conditions.length > 0 ? and(...conditions) : undefined);

			res.json({
				prospects,
				total: totalCount?.count || 0,
				limit: Number.parseInt(limit as string),
				offset: Number.parseInt(offset as string),
			});
		} catch (error) {
			console.error("Error fetching individual prospects:", error);
			return apiResponse.serverError(
				res,
				"Failed to fetch individual prospects",
			);
		}
	},
);

/**
 * Get agents for assignment dropdown
 */
router.get("/agents", requireAdmin, async (req: any, res: Response) => {
	try {
		const agents = await db
			.select({
				id: users.id,
				firstName: users.firstName,
				lastName: users.lastName,
				email: users.email,
				roles: users.roles,
			})
			.from(users)
			.where(
				or(
					sql`'partner' = ANY(${users.roles})`,
					sql`'agent' = ANY(${users.roles})`,
					sql`'sub_agent' = ANY(${users.roles})`,
				),
			)
			.orderBy(users.firstName);

		res.json(agents);
	} catch (error) {
		console.error("Error fetching agents:", error);
		return apiResponse.serverError(res, "Failed to fetch agents");
	}
});

// NOTE: Duplicate POST /b2b-leads removed — single canonical handler above (line ~275)

/**
 * Create new individual prospect
 */
/**
 * Create new individual prospect (dedup-guarded)
 *
 * Purpose : Insert a new individual prospect, rejecting duplicates.
 * Dedup rules (any match = conflict):
 *   1. Email match      – same person
 *   2. Mobile match     – same person via phone
 *   3. PAN match        – definitive identity proof
 * Outputs : 201 newProspect | 409 Conflict with existing prospect id
 */
router.post(
	"/individual-prospects",
	requireAdmin,
	async (req: any, res: Response) => {
		try {
			const {
				name,
				email,
				mobile,
				pan,
				clientType,
				indicativeRiskProfile,
				agentId,
			} = req.body;

			if (!name?.trim() || !agentId) {
				return apiResponse.badRequest(
					res,
					"Name and agent assignment are required",
				);
			}

			const [agent] = await db
				.select({ id: users.id })
				.from(users)
				.where(eq(users.id, agentId))
				.limit(1);

			if (!agent) {
				return apiResponse.badRequest(res, "Invalid agent ID");
			}

			// ── Duplicate detection ───────────────────────────────────────────
			const dupConditions: any[] = [];
			if (email?.trim()) dupConditions.push(ilike(prospectClients.email, email.trim()));
			if (mobile?.trim()) dupConditions.push(ilike(prospectClients.mobile, mobile.trim()));
			if (pan?.trim()) dupConditions.push(ilike(prospectClients.pan, pan.trim().toUpperCase()));

			if (dupConditions.length > 0) {
				const [existing] = await db
					.select({ id: prospectClients.id, name: prospectClients.name })
					.from(prospectClients)
					.where(or(...dupConditions))
					.limit(1);

				if (existing) {
					return res.status(409).json({
						success: false,
						error: "DUPLICATE_PROSPECT",
						message: `A prospect named "${existing.name}" already exists with matching email, mobile, or PAN.`,
						existingId: existing.id,
					});
				}
			}

			// ── Insert ────────────────────────────────────────────────────────
			const [newProspect] = await db
				.insert(prospectClients)
				.values({
					agentId,
					name: name.trim(),
					email: email?.trim() || null,
					mobile: mobile?.trim() || null,
					pan: pan?.trim().toUpperCase() || null,
					clientType: clientType || "individual",
					indicativeRiskProfile,
					state: "prospect",
				})
				.returning();

			res.status(201).json(newProspect);
		} catch (error) {
			console.error("Error creating individual prospect:", error);
			return apiResponse.serverError(
				res,
				"Failed to create individual prospect",
			);
		}
	},
);

/**
 * Assign/Reassign B2B lead to agent
 */
router.patch(
	"/b2b-leads/:id/assign",
	requireAdmin,
	async (req: any, res: Response) => {
		try {
			const { id } = req.params;
			const { agentId, reason } = req.body;

			const [existingLead] = await db
				.select()
				.from(prospectLeads)
				.where(eq(prospectLeads.id, id))
				.limit(1);

			if (!existingLead) {
				return apiResponse.notFound(res, "Lead not found");
			}

			const previousAgentId = existingLead.assignedTo;

			const [updated] = await db
				.update(prospectLeads)
				.set({
					assignedTo: agentId || null,
					updatedAt: new Date(),
				})
				.where(eq(prospectLeads.id, id))
				.returning();

			await db.insert(leadActivities).values({
				leadId: id,
				activityType: previousAgentId ? "reassignment" : "assignment",
				description: agentId
					? `Lead ${previousAgentId ? "reassigned" : "assigned"} to agent${reason ? ": " + reason : ""}`
					: "Lead unassigned",
				performedBy: req.user.id,
				metadata: {
					previousAgentId,
					newAgentId: agentId,
					reason,
					assignedBy: req.user.id,
				},
			} as any);

			res.json(updated);
		} catch (error) {
			console.error("Error assigning lead:", error);
			return apiResponse.serverError(res, "Failed to assign lead");
		}
	},
);

/**
 * Reassign individual prospect to different agent
 */
router.patch(
	"/individual-prospects/:id/assign",
	requireAdmin,
	async (req: any, res: Response) => {
		try {
			const { id } = req.params;
			const { agentId, reason } = req.body;

			if (!agentId) {
				return apiResponse.badRequest(res, "Agent ID is required");
			}

			const [existingProspect] = await db
				.select()
				.from(prospectClients)
				.where(eq(prospectClients.id, id))
				.limit(1);

			if (!existingProspect) {
				return apiResponse.notFound(res, "Prospect not found");
			}

			const previousAgentId = existingProspect.agentId;

			const [updated] = await db
				.update(prospectClients)
				.set({
					agentId,
					updatedAt: new Date(),
				})
				.where(eq(prospectClients.id, id))
				.returning();

			res.json({
				...updated,
				reassignment: {
					previousAgentId,
					newAgentId: agentId,
					reason,
					reassignedBy: req.user.id,
					reassignedAt: new Date(),
				},
			});
		} catch (error) {
			console.error("Error reassigning prospect:", error);
			return apiResponse.serverError(res, "Failed to reassign prospect");
		}
	},
);

/**
 * Bulk assign B2B leads
 */
router.post(
	"/b2b-leads/bulk-assign",
	requireAdmin,
	async (req: any, res: Response) => {
		try {
			const { leadIds, agentId, reason } = req.body;

			if (!Array.isArray(leadIds) || leadIds.length === 0) {
				return apiResponse.badRequest(res, "Lead IDs array is required");
			}

			const results = await Promise.allSettled(
				leadIds.map(async (leadId: string) => {
					const [existingLead] = await db
						.select({ assignedTo: prospectLeads.assignedTo })
						.from(prospectLeads)
						.where(eq(prospectLeads.id, leadId))
						.limit(1);

					await db
						.update(prospectLeads)
						.set({
							assignedTo: agentId || null,
							updatedAt: new Date(),
						})
						.where(eq(prospectLeads.id, leadId));

					await db.insert(leadActivities).values({
						leadId,
						activityType: existingLead?.assignedTo
							? "reassignment"
							: "assignment",
						description: `Bulk ${existingLead?.assignedTo ? "reassignment" : "assignment"}${reason ? ": " + reason : ""}`,
						performedBy: req.user.id,
						metadata: {
							previousAgentId: existingLead?.assignedTo,
							newAgentId: agentId,
							reason,
							bulkOperation: true,
						},
					} as any);

					return leadId;
				}),
			);

			const succeeded = results.filter((r) => r.status === "fulfilled").length;
			const failed = results.filter((r) => r.status === "rejected").length;

			res.json({
				success: true,
				processed: leadIds.length,
				succeeded,
				failed,
			});
		} catch (error) {
			console.error("Error bulk assigning leads:", error);
			return apiResponse.serverError(res, "Failed to bulk assign leads");
		}
	},
);

/**
 * Get assignment history for a lead
 */
router.get(
	"/b2b-leads/:id/history",
	requireAdmin,
	async (req: any, res: Response) => {
		try {
			const { id } = req.params;

			const activities = await db
				.select({
					id: leadActivities.id,
					activityType: leadActivities.activityType,
					description: leadActivities.description,
					performedBy: leadActivities.performedBy,
					performerName: sql<string>`CONCAT(${users.firstName}, ' ', ${users.lastName})`,
					metadata: (leadActivities as any).metadata,
					createdAt: leadActivities.createdAt,
				})
				.from(leadActivities)
				.leftJoin(users, eq(leadActivities.performedBy, users.id))
				.where(eq(leadActivities.leadId, id))
				.orderBy(desc(leadActivities.createdAt));

			res.json(activities);
		} catch (error) {
			console.error("Error fetching lead history:", error);
			return apiResponse.serverError(res, "Failed to fetch lead history");
		}
	},
);

/**
 * Import leads from Zoho CRM
 */
router.post(
	"/import/zoho-crm",
	requireAdmin,
	async (req: any, res: Response) => {
		try {
			const { module = "Leads", assignToAgent, maxRecords = 100 } = req.body;

			const connectionId = await getZohoConnectionId();

			if (!connectionId) {
				return apiResponse.badRequest(
					res,
					"Zoho CRM is not configured. Please set up Zoho integration first.",
				);
			}

			const crmService = new ZohoCRMService(connectionId);

			let records: any[] = [];

			if (module === "Leads") {
				records = await crmService.getLeads(maxRecords);
			} else if (module === "Contacts") {
				records = await crmService.getContacts(maxRecords);
			}

			if (!records || records.length === 0) {
				return res.json({
					success: true,
					imported: 0,
					message: "No records found in Zoho CRM",
				});
			}

			const importBatchId = `zoho_${Date.now()}`;
			let imported = 0;
			let skipped = 0;

			for (const record of records) {
				const email = record.Email;
				const zohoId = record.id as string | undefined;

				// ── Dedup: check CIN, email, and Zoho record ID ──────────────────
				const zohoIdNote = zohoId ? `Zoho ID: ${zohoId}` : null;
				const dupConditions: any[] = [];
				if (email) dupConditions.push(ilike(prospectLeads.primaryEmail, email));
				// Check if already imported via notes field containing same Zoho ID
				if (zohoIdNote) dupConditions.push(sql`${prospectLeads.notes} ILIKE ${'%' + zohoIdNote + '%'}`);

				if (dupConditions.length > 0) {
					const [existing] = await db
						.select({ id: prospectLeads.id })
						.from(prospectLeads)
						.where(or(...dupConditions))
						.limit(1);

					if (existing) {
						skipped++;
						continue;
					}
				}

				await db.insert(prospectLeads).values({
					companyName:
						record.Company ||
						record.Account_Name ||
						`${record.First_Name || ""} ${record.Last_Name || ""}`.trim() ||
						"Unknown",
					primaryEmail: record.Email,
					primaryMobile: record.Mobile || record.Phone,
					city: record.Mailing_City || record.City,
					state: record.Mailing_State || record.State,
					industrySegment: record.Industry,
					leadQuality: mapZohoLeadStatus(record.Lead_Status),
					leadScore: 50,
					assignedTo: assignToAgent || null,
					source: "zoho_crm",
					importBatchId,
					status: "new",
					notes: `Imported from Zoho CRM (${module}). Zoho ID: ${record.id}`,
				});

				imported++;
			}

			res.json({
				success: true,
				imported,
				skipped,
				total: records.length,
				batchId: importBatchId,
			});
		} catch (error: any) {
			console.error("Error importing from Zoho CRM:", error);
			return apiResponse.serverError(
				res,
				`Failed to import from Zoho CRM: ${error.message}`,
			);
		}
	},
);

/**
 * Get Zoho CRM connection status
 */
router.get("/zoho-status", requireAdmin, async (req: any, res: Response) => {
	try {
		const connectionId = await getZohoConnectionId();

		res.json({
			configured: !!connectionId,
			connectionId: connectionId || null,
		});
	} catch (error) {
		console.error("Error checking Zoho status:", error);
		res.json({ configured: false, connectionId: null });
	}
});

function mapZohoLeadStatus(status: string | undefined): string {
	if (!status) return "warm";

	const statusLower = status.toLowerCase();
	if (statusLower.includes("hot") || statusLower.includes("qualified"))
		return "hot";
	if (statusLower.includes("cold") || statusLower.includes("junk"))
		return "cold";
	return "warm";
}

export function registerAdminProspectRoutes(app: any) {
	app.use("/api/admin/prospects", router);
}

// ── Contact Enrichment Endpoints ─────────────────────────────────────────────

/**
 * POST /api/admin/prospects/enrich-contacts
 * Batch-enriches all leads missing director contact data from CredHive.
 * Processes up to 500 leads per run with 200ms rate-limit delay between calls.
 */
router.post(
	"/enrich-contacts",
	requireAdmin,
	async (req: any, res: Response) => {
		try {
			const result = await batchEnrichMissingContacts();

			logger.info("ADMIN_BATCH_ENRICH_TRIGGERED", {
				event: "ADMIN_BATCH_ENRICH_TRIGGERED",
				user_id: req.user?.id,
				...result,
				status: "success",
			});

			res.json(
				apiResponse.success(res, result),
			);
		} catch (err: any) {
			apiResponse.serverError(res, err.message ?? "Contact enrichment failed");
		}
	},
);

/**
 * POST /api/admin/prospects/:id/enrich-contacts
 * Force re-enriches a single lead from CredHive.
 */
router.post(
	"/:id/enrich-contacts",
	requireAdmin,
	async (req: any, res: Response) => {
		try {
			const { id } = req.params;
			const result = await enrichProspectContacts(id);

			logger.info("ADMIN_SINGLE_ENRICH_TRIGGERED", {
				event: "ADMIN_SINGLE_ENRICH_TRIGGERED",
				user_id: req.user?.id,
				lead_id: id,
				enriched: result.enriched,
				status: "success",
			});

			res.json(
				apiResponse.success(res, result),
			);
		} catch (err: any) {
			apiResponse.serverError(res, err.message ?? "Contact enrichment failed");
		}
	},
);
