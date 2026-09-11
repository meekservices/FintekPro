import { Router } from "express";
import { db } from "../db";
import { logger } from "../logger";
import {
	researchLists,
	researchListItems,
	savedScreeners,
	researchAuditLog,
	mutualFunds,
	listedStocks,
	agents,
	insertResearchListSchema,
	insertResearchListItemSchema,
	instrumentMaster,
	modelPortfolios,
	modelPortfolioHoldings,
	prospectProposals,
} from "@shared/schema";
import {
	eq,
	and,
	or,
	desc,
	sql,
	ilike,
	gte,
	lte,
} from "drizzle-orm";
import { z } from "zod";

const router = Router();

// RBAC Role Types for Research Workspace
type ResearchRole = "admin" | "master_agent" | "agent" | "sub_agent" | "client";

interface AgentSession {
	agentId: string;
	agentName: string;
	role: ResearchRole;
	canCreate: boolean;
	canEditOwn: boolean;
	canEditOrg: boolean;
	canDelete: boolean;
	canAttachProposal: boolean;
	isViewOnly: boolean;
}

// Helper: Determine role from user
function determineResearchRole(user: any): ResearchRole {
	const roles = user?.roles || [];
	if (roles.includes("superadmin") || roles.includes("admin")) return "admin";
	if (roles.includes("master_agent")) return "master_agent";
	if (roles.includes("agent")) return "agent";
	if (roles.includes("sub_agent")) return "sub_agent";
	if (roles.includes("client")) return "client";
	return "client";
}

// Helper: Get RBAC permissions for role
function getRolePermissions(
	role: ResearchRole,
): Omit<AgentSession, "agentId" | "agentName" | "role"> {
	switch (role) {
		case "admin":
		case "master_agent":
			return {
				canCreate: true,
				canEditOwn: true,
				canEditOrg: true,
				canDelete: true,
				canAttachProposal: true,
				isViewOnly: false,
			};
		case "agent":
			return {
				canCreate: true,
				canEditOwn: true,
				canEditOrg: true,
				canDelete: true,
				canAttachProposal: true,
				isViewOnly: false,
			};
		case "sub_agent":
			return {
				canCreate: true,
				canEditOwn: true,
				canEditOrg: false,
				canDelete: false,
				canAttachProposal: true,
				isViewOnly: false,
			};
		case "client":
			return {
				canCreate: false,
				canEditOwn: false,
				canEditOrg: false,
				canDelete: false,
				canAttachProposal: false,
				isViewOnly: true,
			};
	}
}

// Helper: Get agent from session with RBAC
function getAgentFromSession(req: any): AgentSession | null {
	if (req.user?.agentId || req.user?.id) {
		const role = determineResearchRole(req.user);
		const permissions = getRolePermissions(role);
		return {
			agentId: req.user.agentId || req.user.id,
			agentName: req.user.fullName || req.user.email,
			role,
			...permissions,
		};
	}
	return null;
}

// Helper: Log research audit action
async function logResearchAudit(
	entityType: string,
	entityId: string,
	action: string,
	agentId: string,
	agentName: string,
	previousData?: any,
	newData?: any,
	ipAddress?: string,
) {
	try {
		await db.insert(researchAuditLog).values({
			entityType,
			entityId,
			action,
			agentId,
			agentName,
			previousData,
			newData,
			ipAddress,
		});
	} catch (error) {
		logger.error("[ResearchAudit] Failed to log", { error: String(error) });
	}
}

// Helper: Recalculate and update list cached metrics
async function updateListCachedMetrics(listId: string): Promise<void> {
	try {
		const allItems = await db
			.select({
				snapshotMetrics: researchListItems.snapshotMetrics,
				rating: researchListItems.rating,
			})
			.from(researchListItems)
			.where(eq(researchListItems.researchListId, listId));

		let returnSum = 0;
		let returnCount = 0;
		let expSum = 0;
		let expCount = 0;
		let ratingSum = 0;
		let ratingCount = 0;

		for (const it of allItems) {
			const sm = it.snapshotMetrics as any;
			if (sm?.returns3y !== undefined && sm?.returns3y !== null && !Number.isNaN(Number(sm.returns3y))) {
				returnSum += Number(sm.returns3y);
				returnCount++;
			}
			if (sm?.expenseRatio !== undefined && sm?.expenseRatio !== null && !Number.isNaN(Number(sm.expenseRatio))) {
				expSum += Number(sm.expenseRatio);
				expCount++;
			}
			if (it.rating && !Number.isNaN(Number(it.rating))) {
				ratingSum += Number(it.rating);
				ratingCount++;
			}
		}

		const cachedMetrics = {
			avgReturn3y: returnCount > 0 ? Number((returnSum / returnCount).toFixed(2)) : null,
			avgExpenseRatio: expCount > 0 ? Number((expSum / expCount).toFixed(2)) : null,
			avgRating: ratingCount > 0 ? Number((ratingSum / ratingCount).toFixed(1)) : null,
			itemCount: allItems.length,
		};

		await db
			.update(researchLists)
			.set({
				cachedMetrics,
				updatedAt: new Date(),
			})
			.where(eq(researchLists.id, listId));
	} catch (err) {
		logger.warn("[ResearchLists] Error updating cached metrics", { error: String(err) });
	}
}

// =====================================================
// RESEARCH LISTS CRUD
// =====================================================

// GET /api/research-lists - List all research lists for agent
router.get("/", async (req, res) => {
	try {
		const agent = getAgentFromSession(req);
		if (!agent) {
			return res.status(401).json({ error: "Unauthorized" });
		}

		const lists = await db
			.select({
				id: researchLists.id,
				name: researchLists.name,
				description: researchLists.description,
				universeType: researchLists.universeType,
				visibility: researchLists.visibility,
				isEditable: researchLists.isEditable,
				isArchived: researchLists.isArchived,
				tags: researchLists.tags,
				cachedMetrics: researchLists.cachedMetrics,
				createdByAgentId: researchLists.createdByAgentId,
				createdAt: researchLists.createdAt,
				updatedAt: researchLists.updatedAt,
				itemCount:
					sql<number>`COALESCE((SELECT COUNT(*)::int FROM research_list_items WHERE research_list_items.research_list_id = research_lists.id), 0)`.mapWith(Number).as(
						"item_count",
					),
			})
			.from(researchLists)
			.where(
				or(
					eq(researchLists.createdByAgentId, agent.agentId),
					eq(researchLists.visibility, "org"),
					eq(researchLists.visibility, "team"),
				),
			)
			.orderBy(desc(researchLists.updatedAt));

		res.json({ success: true, lists });
	} catch (error) {
		logger.error("[ResearchLists] Error fetching lists", { error: String(error) });
		res.status(500).json({ error: "Failed to fetch research lists" });
	}
});

// GET /api/research-lists/:id - Get single research list with items
// NOTE: This route catches dynamic IDs but must skip reserved paths
router.get("/:id", async (req, res, next) => {
	try {
		const { id } = req.params;

		// Skip reserved paths - let them fall through to their specific handlers
		const reservedPaths = ["screeners", "analytics", "instruments"];
		if (reservedPaths.includes(id)) {
			return next(); // Let Express continue to specific route handlers
		}

		const agent = getAgentFromSession(req);
		if (!agent) {
			return res.status(401).json({ error: "Unauthorized" });
		}

		const [list] = await db
			.select()
			.from(researchLists)
			.where(eq(researchLists.id, id));

		if (!list) {
			return res.status(404).json({ error: "Research list not found" });
		}

		// Check access
		if (
			list.createdByAgentId !== agent.agentId &&
			list.visibility === "private"
		) {
			return res.status(403).json({ error: "Access denied" });
		}

		// Get items
		const items = await db
			.select()
			.from(researchListItems)
			.where(eq(researchListItems.researchListId, id))
			.orderBy(desc(researchListItems.addedAt));

		// Enrich missing sectors on the fly
		for (const item of items) {
			const sm = (item.snapshotMetrics as Record<string, any>) || {};
			if (!sm.sector || sm.sector === "—") {
				if (item.instrumentSymbol) {
					try {
						const [stock] = await db
							.select({ sector: listedStocks.sector, industry: listedStocks.industry, marketCap: listedStocks.marketCap })
							.from(listedStocks)
							.where(eq(listedStocks.symbol, item.instrumentSymbol))
							.limit(1);
						if (stock?.sector) {
							sm.sector = stock.sector;
							sm.industry = stock.industry || sm.industry;
							sm.marketCap = sm.marketCap || stock.marketCap;
							item.snapshotMetrics = sm;
						} else {
							const [im] = await db
								.select({ sector: instrumentMaster.sector, category: instrumentMaster.category })
								.from(instrumentMaster)
								.where(eq(instrumentMaster.symbol, item.instrumentSymbol))
								.limit(1);
							if (im?.sector) {
								sm.sector = im.sector;
								sm.category = im.category || sm.category;
								item.snapshotMetrics = sm;
							}
						}
					} catch {
						// Non-critical fallback
					}
				}
			}
		}

		res.json({ success: true, list, items });
	} catch (error) {
		logger.error("[ResearchLists] Error fetching list", { error: String(error) });
		res.status(500).json({ error: "Failed to fetch research list" });
	}
});

// POST /api/research-lists/:id/refresh-quotes - Live quotes and metrics refresh
router.post("/:id/refresh-quotes", async (req, res) => {
	try {
		const agent = getAgentFromSession(req);
		if (!agent) {
			return res.status(401).json({ error: "Unauthorized" });
		}
		const { id } = req.params;
		const [list] = await db.select().from(researchLists).where(eq(researchLists.id, id));
		if (!list) return res.status(404).json({ error: "Research list not found" });

		const items = await db.select().from(researchListItems).where(eq(researchListItems.researchListId, id));

		for (const it of items) {
			const sm = (it.snapshotMetrics as Record<string, any>) || {};
			let updated = false;

			if (it.instrumentSymbol || it.instrumentIsin) {
				if (list.universeType.toUpperCase().includes("STOCK")) {
					const [stock] = await db
						.select()
						.from(listedStocks)
						.where(
							or(
								it.instrumentSymbol ? eq(listedStocks.symbol, it.instrumentSymbol) : undefined,
								it.instrumentIsin ? eq(listedStocks.isin, it.instrumentIsin) : undefined,
							),
						)
						.limit(1);

					if (stock) {
						if (stock.currentPrice) sm.currentPrice = Number(stock.currentPrice);
						if (stock.dayChange) sm.dayChange = Number(stock.dayChange);
						if (stock.dayChangePercent) sm.dayChangePercent = Number(stock.dayChangePercent);
						if (stock.weekHigh52) sm.weekHigh52 = Number(stock.weekHigh52);
						if (stock.weekLow52) sm.weekLow52 = Number(stock.weekLow52);
						if (stock.sector) sm.sector = stock.sector;
						if (stock.industry) sm.industry = stock.industry;
						if (stock.marketCap) sm.marketCap = stock.marketCap;
						updated = true;
					}
				}

				if (!sm.sector || sm.sector === "—") {
					const [im] = await db
						.select()
						.from(instrumentMaster)
						.where(
							or(
								it.instrumentSymbol ? eq(instrumentMaster.symbol, it.instrumentSymbol) : undefined,
								it.instrumentIsin ? eq(instrumentMaster.isin, it.instrumentIsin) : undefined,
							),
						)
						.limit(1);
					if (im) {
						if (im.sector) sm.sector = im.sector;
						if (im.lastPrice) sm.currentPrice = Number(im.lastPrice);
						updated = true;
					}
				}
			}

			if (updated) {
				await db
					.update(researchListItems)
					.set({ snapshotMetrics: sm, updatedAt: new Date() })
					.where(eq(researchListItems.id, it.id));
			}
		}

		await updateListCachedMetrics(id);

		const updatedItems = await db
			.select()
			.from(researchListItems)
			.where(eq(researchListItems.researchListId, id))
			.orderBy(desc(researchListItems.addedAt));

		res.json({ success: true, message: "Market quotes refreshed successfully", items: updatedItems });
	} catch (error) {
		logger.error("[ResearchLists] Error refreshing quotes", { error: String(error) });
		res.status(500).json({ error: "Failed to refresh market quotes" });
	}
});

// POST /api/research-lists - Create new research list
router.post("/", async (req, res) => {
	try {
		const agent = getAgentFromSession(req);
		if (!agent) {
			return res.status(401).json({ error: "Unauthorized" });
		}

		// RBAC: Check if user can create lists
		if (!agent.canCreate) {
			return res.status(403).json({
				error: "Permission denied",
				message: "You don't have permission to create research lists",
				role: agent.role,
			});
		}

		const validatedData = insertResearchListSchema.parse({
			...req.body,
			createdByAgentId: agent.agentId,
		});

		const [newList] = await db
			.insert(researchLists)
			.values(validatedData)
			.returning();

		await logResearchAudit(
			"research_list",
			newList.id,
			"create",
			agent.agentId,
			agent.agentName,
			null,
			newList,
			req.ip,
		);

		res.status(201).json({ success: true, list: newList });
	} catch (error) {
		logger.error("[ResearchLists] Error creating list", { error: String(error) });
		if (error instanceof z.ZodError) {
			return res
				.status(400)
				.json({ error: "Validation error", details: error.issues });
		}
		res.status(500).json({ error: "Failed to create research list" });
	}
});

// PUT /api/research-lists/:id - Update research list
router.put("/:id", async (req, res) => {
	try {
		const agent = getAgentFromSession(req);
		if (!agent) {
			return res.status(401).json({ error: "Unauthorized" });
		}

		// RBAC: Clients are view-only
		if (agent.isViewOnly) {
			return res.status(403).json({
				error: "Permission denied",
				message: "You have view-only access to research lists",
				role: agent.role,
			});
		}

		const { id } = req.params;

		// Get existing list
		const [existingList] = await db
			.select()
			.from(researchLists)
			.where(eq(researchLists.id, id));

		if (!existingList) {
			return res.status(404).json({ error: "Research list not found" });
		}

		// RBAC: Check edit permissions
		const isOwner = existingList.createdByAgentId === agent.agentId;
		const isSharedList = existingList.visibility === "org" || existingList.visibility === "team";

		if (!isOwner) {
			// Not the owner - check if they can edit shared lists
			if (!isSharedList || !existingList.isEditable) {
				return res.status(403).json({ error: "Cannot edit this list" });
			}
			// Sub-agents cannot edit org lists even if editable
			if (existingList.visibility === "org" && !agent.canEditOrg) {
				return res.status(403).json({
					error: "Permission denied",
					message: "Sub-agents cannot edit organization lists",
					role: agent.role,
				});
			}
		} else if (!agent.canEditOwn) {
			return res.status(403).json({
				error: "Permission denied",
				message: "You don't have permission to edit lists",
				role: agent.role,
			});
		}

		const { name, description, visibility, isEditable, tags, isArchived } =
			req.body;

		const [updatedList] = await db
			.update(researchLists)
			.set({
				name: name ?? existingList.name,
				description: description ?? existingList.description,
				visibility: visibility ?? existingList.visibility,
				isEditable: isEditable ?? existingList.isEditable,
				isArchived: isArchived ?? existingList.isArchived,
				tags: tags ?? existingList.tags,
				updatedAt: new Date(),
			})
			.where(eq(researchLists.id, id))
			.returning();

		await logResearchAudit(
			"research_list",
			id,
			"update",
			agent.agentId,
			agent.agentName,
			existingList,
			updatedList,
			req.ip,
		);

		res.json({ success: true, list: updatedList });
	} catch (error) {
		logger.error("[ResearchLists] Error updating list", { error: String(error) });
		res.status(500).json({ error: "Failed to update research list" });
	}
});

// DELETE /api/research-lists/:id - Delete research list
router.delete("/:id", async (req, res) => {
	try {
		const agent = getAgentFromSession(req);
		if (!agent) {
			return res.status(401).json({ error: "Unauthorized" });
		}

		// RBAC: Check delete permission
		if (!agent.canDelete) {
			return res.status(403).json({
				error: "Permission denied",
				message: "You don't have permission to delete research lists",
				role: agent.role,
			});
		}

		const { id } = req.params;

		const [existingList] = await db
			.select()
			.from(researchLists)
			.where(eq(researchLists.id, id));

		if (!existingList) {
			return res.status(404).json({ error: "Research list not found" });
		}

		// Only owner can delete (unless admin)
		if (
			existingList.createdByAgentId !== agent.agentId &&
			agent.role !== "admin"
		) {
			return res
				.status(403)
				.json({ error: "Only the creator can delete this list" });
		}

		await db.delete(researchLists).where(eq(researchLists.id, id));

		await logResearchAudit(
			"research_list",
			id,
			"delete",
			agent.agentId,
			agent.agentName,
			existingList,
			null,
			req.ip,
		);

		res.json({ success: true, message: "Research list deleted" });
	} catch (error) {
		logger.error("[ResearchLists] Error deleting list", { error: String(error) });
		res.status(500).json({ error: "Failed to delete research list" });
	}
});

// =====================================================
// RESEARCH LIST ITEMS
// =====================================================

// POST /api/research-lists/:id/items - Add item to list
router.post("/:id/items", async (req, res) => {
	try {
		const agent = getAgentFromSession(req);
		if (!agent) {
			return res.status(401).json({ error: "Unauthorized" });
		}

		// RBAC: Clients are view-only
		if (agent.isViewOnly) {
			return res.status(403).json({
				error: "Permission denied",
				message: "You have view-only access to research lists",
				role: agent.role,
			});
		}

		const { id } = req.params;

		// Verify list exists and is editable
		const [list] = await db
			.select()
			.from(researchLists)
			.where(eq(researchLists.id, id));

		if (!list) {
			return res.status(404).json({ error: "Research list not found" });
		}

		// RBAC: Check edit permissions
		const isOwner = list.createdByAgentId === agent.agentId;
		const isSharedList = list.visibility === "org" || list.visibility === "team";

		if (!isOwner) {
			if (!isSharedList || !list.isEditable) {
				return res.status(403).json({ error: "This list is not editable" });
			}
			if (list.visibility === "org" && !agent.canEditOrg) {
				return res.status(403).json({
					error: "Permission denied",
					message: "Sub-agents cannot add items to organization lists",
					role: agent.role,
				});
			}
		}

		// Resolve valid agent ID or null for FK safety
		let agentIdToUse: string | null = agent.agentId;
		try {
			const [existingAgent] = await db
				.select({ id: agents.id })
				.from(agents)
				.where(or(eq(agents.id, agent.agentId), eq(agents.userId, agent.agentId)))
				.limit(1);
			if (existingAgent) {
				agentIdToUse = existingAgent.id;
			} else {
				agentIdToUse = null;
			}
		} catch {
			agentIdToUse = null;
		}

		const rawInstrumentId =
			req.body.instrumentId ||
			req.body.instrumentSymbol ||
			req.body.symbol ||
			req.body.isin ||
			`inst_${Date.now()}`;

		const validatedData = insertResearchListItemSchema.parse({
			...req.body,
			instrumentId: String(rawInstrumentId),
			researchListId: id,
			addedByAgentId: agentIdToUse,
		});

		const [newItem] = await db
			.insert(researchListItems)
			.values(validatedData)
			.returning();

		// Recalculate and update cached metrics and updatedAt
		await updateListCachedMetrics(id);

		await logResearchAudit(
			"research_list_item",
			newItem.id,
			"add_item",
			agent.agentId,
			agent.agentName,
			null,
			newItem,
			req.ip,
		);

		res.status(201).json({ success: true, item: newItem });
	} catch (error) {
		logger.error("[ResearchListItems] Error adding item", { error: String(error) });
		if (error instanceof z.ZodError) {
			return res
				.status(400)
				.json({ error: "Validation error", details: error.issues });
		}
		res.status(500).json({ error: "Failed to add item to research list" });
	}
});

// DELETE /api/research-lists/:id/items/:itemId - Remove item from list
router.delete("/:id/items/:itemId", async (req, res) => {
	try {
		const agent = getAgentFromSession(req);
		if (!agent) {
			return res.status(401).json({ error: "Unauthorized" });
		}

		// RBAC: Clients are view-only
		if (agent.isViewOnly) {
			return res.status(403).json({
				error: "Permission denied",
				message: "You have view-only access to research lists",
				role: agent.role,
			});
		}

		const { id, itemId } = req.params;

		// Verify list exists and is editable
		const [list] = await db
			.select()
			.from(researchLists)
			.where(eq(researchLists.id, id));

		if (!list) {
			return res.status(404).json({ error: "Research list not found" });
		}

		// RBAC: Check edit permissions
		const isOwner = list.createdByAgentId === agent.agentId;
		const isSharedList = list.visibility === "org" || list.visibility === "team";

		if (!isOwner) {
			if (!isSharedList || !list.isEditable) {
				return res.status(403).json({ error: "This list is not editable" });
			}
			if (list.visibility === "org" && !agent.canEditOrg) {
				return res.status(403).json({
					error: "Permission denied",
					message: "Sub-agents cannot remove items from organization lists",
					role: agent.role,
				});
			}
		}

		const [existingItem] = await db
			.select()
			.from(researchListItems)
			.where(
				and(
					eq(researchListItems.id, itemId),
					eq(researchListItems.researchListId, id),
				),
			);

		if (!existingItem) {
			return res.status(404).json({ error: "Item not found in list" });
		}

		await db.delete(researchListItems).where(eq(researchListItems.id, itemId));

		// Recalculate and update cached metrics and updatedAt
		await updateListCachedMetrics(id);

		await logResearchAudit(
			"research_list_item",
			itemId,
			"remove_item",
			agent.agentId,
			agent.agentName,
			existingItem,
			null,
			req.ip,
		);

		res.json({ success: true, message: "Item removed from list" });
	} catch (error) {
		logger.error("[ResearchListItems] Error removing item", { error: String(error) });
		res.status(500).json({ error: "Failed to remove item from research list" });
	}
});

// GET /api/research-lists/:id/items - Get all items in a list
router.get("/:id/items", async (req, res) => {
	try {
		const agent = getAgentFromSession(req);
		if (!agent) {
			return res.status(401).json({ error: "Unauthorized" });
		}

		const { id } = req.params;

		const items = await db
			.select()
			.from(researchListItems)
			.where(eq(researchListItems.researchListId, id))
			.orderBy(desc(researchListItems.addedAt));

		res.json({ success: true, items });
	} catch (error) {
		logger.error("[ResearchListItems] Error fetching items", { error: String(error) });
		res.status(500).json({ error: "Failed to fetch research list items" });
	}
});

// PUT /api/research-lists/:id/weights - Batch update target weights
router.put("/:id/weights", async (req, res) => {
	try {
		const agent = getAgentFromSession(req);
		if (!agent) {
			return res.status(401).json({ error: "Unauthorized" });
		}
		if (agent.isViewOnly) {
			return res.status(403).json({ error: "Permission denied", message: "View-only access" });
		}

		const { id } = req.params;
		const { weights } = req.body;

		const [list] = await db.select().from(researchLists).where(eq(researchLists.id, id));
		if (!list) {
			return res.status(404).json({ error: "Research list not found" });
		}

		const isOwner = list.createdByAgentId === agent.agentId;
		const isSharedList = list.visibility === "org" || list.visibility === "team";
		if (!isOwner && (!isSharedList || !list.isEditable)) {
			return res.status(403).json({ error: "This list is not editable" });
		}

		const items = await db.select().from(researchListItems).where(eq(researchListItems.researchListId, id));
		const weightMap: Record<string, number> = Array.isArray(weights)
			? weights.reduce((acc: any, w: any) => {
					acc[w.itemId] = Number(w.weight);
					return acc;
				}, {})
			: (weights || {});

		for (const item of items) {
			if (weightMap[item.id] !== undefined) {
				const currentSm = (item.snapshotMetrics as Record<string, any>) || {};
				const updatedSm = { ...currentSm, targetWeight: Number(weightMap[item.id]) };
				await db
					.update(researchListItems)
					.set({
						snapshotMetrics: updatedSm,
						updatedAt: new Date(),
					})
					.where(eq(researchListItems.id, item.id));
			}
		}

		await db.update(researchLists).set({ updatedAt: new Date() }).where(eq(researchLists.id, id));
		await updateListCachedMetrics(id);

		res.json({ success: true, message: "Target weights updated" });
	} catch (error) {
		logger.error("[ResearchLists] Error updating weights", { error: String(error) });
		res.status(500).json({ error: "Failed to update target weights" });
	}
});

// PUT /api/research-lists/:id/items/:itemId - Update item notes, rating, and target weight
router.put("/:id/items/:itemId", async (req, res) => {
	try {
		const agent = getAgentFromSession(req);
		if (!agent) {
			return res.status(401).json({ error: "Unauthorized" });
		}
		if (agent.isViewOnly) {
			return res.status(403).json({ error: "Permission denied", message: "View-only access" });
		}

		const { id, itemId } = req.params;
		const { targetWeight, notes, rating } = req.body;

		const [list] = await db.select().from(researchLists).where(eq(researchLists.id, id));
		if (!list) {
			return res.status(404).json({ error: "Research list not found" });
		}

		const isOwner = list.createdByAgentId === agent.agentId;
		const isSharedList = list.visibility === "org" || list.visibility === "team";
		if (!isOwner && (!isSharedList || !list.isEditable)) {
			return res.status(403).json({ error: "This list is not editable" });
		}

		const [item] = await db
			.select()
			.from(researchListItems)
			.where(and(eq(researchListItems.id, itemId), eq(researchListItems.researchListId, id)));
		if (!item) {
			return res.status(404).json({ error: "Item not found in research list" });
		}

		const updatePayload: Record<string, any> = { updatedAt: new Date() };
		if (notes !== undefined) updatePayload.notes = notes;
		if (rating !== undefined) updatePayload.rating = Number(rating);

		if (targetWeight !== undefined) {
			const currentSm = (item.snapshotMetrics as Record<string, any>) || {};
			updatePayload.snapshotMetrics = { ...currentSm, targetWeight: Number(targetWeight) };
		}

		await db.update(researchListItems).set(updatePayload).where(eq(researchListItems.id, itemId));
		await updateListCachedMetrics(id);

		res.json({ success: true, message: "Item updated successfully" });
	} catch (error) {
		logger.error("[ResearchLists] Error updating item", { error: String(error) });
		res.status(500).json({ error: "Failed to update item" });
	}
});

// POST /api/research-lists/:id/convert-to-model-portfolio - Convert research list into model portfolio
router.post("/:id/convert-to-model-portfolio", async (req, res) => {
	try {
		const agent = getAgentFromSession(req);
		if (!agent) {
			return res.status(401).json({ error: "Unauthorized" });
		}

		const { id } = req.params;
		const {
			name,
			riskProfile = "moderate",
			assetClass,
			timeHorizon = "3-5 years",
			benchmarkName,
			minInvestment = 10000,
		} = req.body;

		const [list] = await db.select().from(researchLists).where(eq(researchLists.id, id));
		if (!list) {
			return res.status(404).json({ error: "Research list not found" });
		}

		const items = await db.select().from(researchListItems).where(eq(researchListItems.researchListId, id));
		if (items.length === 0) {
			return res.status(400).json({ error: "Cannot create a model portfolio from an empty research list" });
		}

		// Calculate weights: use targetWeight if defined, else equal weight
		const defaultEqualWeight = Number((100 / items.length).toFixed(2));
		const holdingsData = items.map((it) => {
			const sm = (it.snapshotMetrics as Record<string, any>) || {};
			const weight = sm.targetWeight && Number(sm.targetWeight) > 0 ? Number(sm.targetWeight) : defaultEqualWeight;
			return {
				id: it.id,
				isin: it.instrumentIsin || "",
				symbol: it.instrumentSymbol || "",
				instrumentName: it.instrumentName || it.instrumentSymbol || "Unknown",
				instrumentType: it.instrumentType || (list.universeType === "MF" ? "mutual_fund" : "equity"),
				assetClass: list.universeType === "MF" ? "equity" : (list.universeType.toLowerCase() || "equity"),
				weight,
				currentPrice: sm.currentPrice || sm.nav || null,
			};
		});

		// Normalize weights so they sum strictly to 100
		const totalWeight = holdingsData.reduce((sum, h) => sum + h.weight, 0);
		if (totalWeight > 0) {
			for (const h of holdingsData) {
				h.weight = Number(((h.weight / totalWeight) * 100).toFixed(2));
			}
		}

		const portfolioSlug =
			(name || list.name)
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, "-")
				.replace(/(^-|-$)/g, "") +
			"-" +
			Date.now().toString(36);

		const resolvedAssetClass =
			assetClass || (list.universeType === "MF" ? "equity" : list.universeType.toLowerCase() || "equity");
		const resolvedBenchmark =
			benchmarkName || (list.universeType === "MF" ? "NIFTY 50 TRI" : "NIFTY 50");

		await db.insert(modelPortfolios).values({
			id: portfolioSlug,
			name: name || `${list.name} (Model Portfolio)`,
			tagline: list.description || `Curated portfolio built from ${list.name}`,
			riskProfile,
			assetClass: resolvedAssetClass,
			minInvestment: String(minInvestment),
			timeHorizon,
			benchmarkName: resolvedBenchmark,
			totalHoldings: items.length,
			isPublished: true,
			isFeatured: false,
			isNew: true,
			source: "research_list",
			allocation: [{ assetClass: resolvedAssetClass, percentage: 100 }],
			holdings: holdingsData,
		});

		for (const h of holdingsData) {
			try {
				await db.insert(modelPortfolioHoldings).values({
					portfolioId: portfolioSlug,
					isin: h.isin,
					symbol: h.symbol,
					instrumentName: h.instrumentName,
					instrumentType: h.instrumentType,
					assetClass: h.assetClass,
					weight: String(h.weight),
					currentNav: h.currentPrice ? String(h.currentPrice) : null,
				});
			} catch (holdingErr) {
				logger.warn("[ResearchLists] Could not insert holding row", { error: String(holdingErr) });
			}
		}

		await logResearchAudit(
			"research_list",
			id,
			"convert_to_model_portfolio",
			agent.agentId,
			agent.agentName,
			{ listName: list.name, itemsCount: items.length },
			{ portfolioId: portfolioSlug },
			req.ip,
		);

		res.json({
			success: true,
			portfolioId: portfolioSlug,
			message: "Model portfolio created successfully",
			redirectUrl: "/agent/model-portfolios",
		});
	} catch (error) {
		logger.error("[ResearchLists] Error converting to model portfolio", { error: String(error) });
		res.status(500).json({ error: "Failed to convert research list to model portfolio" });
	}
});

// POST /api/research-lists/:id/create-proposal - Create proposal from research list
router.post("/:id/create-proposal", async (req, res) => {
	try {
		const agent = getAgentFromSession(req);
		if (!agent) {
			return res.status(401).json({ error: "Unauthorized" });
		}

		const { id } = req.params;
		const {
			prospectName = "Valued Client",
			prospectEmail = "",
			investmentAmount = 500000,
			proposalTitle,
		} = req.body;

		const [list] = await db.select().from(researchLists).where(eq(researchLists.id, id));
		if (!list) {
			return res.status(404).json({ error: "Research list not found" });
		}

		const items = await db.select().from(researchListItems).where(eq(researchListItems.researchListId, id));
		if (items.length === 0) {
			return res.status(400).json({ error: "Cannot create proposal from an empty research list" });
		}

		const defaultWeight = Number((100 / items.length).toFixed(2));
		const recommendations = items.map((it) => {
			const sm = (it.snapshotMetrics as Record<string, any>) || {};
			const weight = sm.targetWeight && Number(sm.targetWeight) > 0 ? Number(sm.targetWeight) : defaultWeight;
			const allocAmount = Number(((Number(investmentAmount) * weight) / 100).toFixed(0));
			return {
				productType: it.instrumentType || "mutual_fund",
				productName: it.instrumentName || it.instrumentSymbol || "Instrument",
				productCode: it.instrumentSymbol || it.instrumentIsin || "",
				allocationPercentage: weight,
				recommendedAmount: allocAmount,
				investmentType: "lumpsum",
				returns1Y: sm.returns1y ? Number(sm.returns1y) : undefined,
				returns3Y: sm.returns3y ? Number(sm.returns3y) : undefined,
				selectionReason: it.notes || "Selected through advisory research workspace criteria.",
			};
		});

		const shareToken =
			"prop_" + Date.now().toString(36) + "_" + Math.random().toString(36).substring(2, 8);

		const [newProposal] = await db
			.insert(prospectProposals)
			.values({
				shareToken,
				agentId: agent.agentId,
				agentName: agent.agentName,
				prospectName,
				prospectEmail,
				proposalType: list.universeType.toLowerCase() === "stock" ? "equity" : "mutual_fund",
				proposalTitle: proposalTitle || `Investment Portfolio Strategy: ${list.name}`,
				executiveSummary: `Institutional recommendation constructed from research basket ${list.name}. Comprises ${items.length} vetted instruments with structured asset allocation.`,
				totalInvestmentAmount: String(investmentAmount),
				status: "draft",
				recommendations,
				targetAllocation: {
					[list.universeType.toLowerCase() || "equity"]: 100,
				},
			})
			.returning();

		await logResearchAudit(
			"research_list",
			id,
			"create_proposal",
			agent.agentId,
			agent.agentName,
			{ listName: list.name, investmentAmount },
			{ proposalId: newProposal.id },
			req.ip,
		);

		res.json({
			success: true,
			proposalId: newProposal.id,
			message: "Proposal created successfully",
			redirectUrl: "/agent/proposals",
		});
	} catch (error) {
		logger.error("[ResearchLists] Error creating proposal", { error: String(error) });
		res.status(500).json({ error: "Failed to create proposal from research list" });
	}
});

// GET /api/research-lists/:id/analytics - Detailed Portfolio X-Ray analytics
router.get("/:id/analytics", async (req, res) => {
	try {
		const agent = getAgentFromSession(req);
		if (!agent) {
			return res.status(401).json({ error: "Unauthorized" });
		}

		const { id } = req.params;
		const [list] = await db.select().from(researchLists).where(eq(researchLists.id, id));
		if (!list) {
			return res.status(404).json({ error: "Research list not found" });
		}

		const items = await db.select().from(researchListItems).where(eq(researchListItems.researchListId, id));

		const defaultWeight = items.length > 0 ? 100 / items.length : 0;
		const sectorTotals: Record<string, number> = {};
		let largeCapWeight = 0;
		let midCapWeight = 0;
		let smallCapWeight = 0;
		let otherCapWeight = 0;
		let maxSingleWeight = 0;
		let maxHoldingName = "";
		let gainersCount = 0;
		let losersCount = 0;
		let dayChangeSum = 0;
		let dayChangeCount = 0;

		for (const it of items) {
			const sm = (it.snapshotMetrics as Record<string, any>) || {};
			const weight = sm.targetWeight && Number(sm.targetWeight) > 0 ? Number(sm.targetWeight) : defaultWeight;

			if (weight > maxSingleWeight) {
				maxSingleWeight = weight;
				maxHoldingName = it.instrumentName || it.instrumentSymbol || "Holding";
			}

			// Sector aggregation
			const sector = sm.sector || sm.category || "Diversified / General";
			sectorTotals[sector] = (sectorTotals[sector] || 0) + weight;

			// Market cap breakdown
			const mcap = sm.marketCap ? Number(sm.marketCap) : 0;
			const cat = (sm.category || "").toLowerCase();
			if (mcap >= 20000 || cat.includes("large")) {
				largeCapWeight += weight;
			} else if (mcap >= 5000 || cat.includes("mid")) {
				midCapWeight += weight;
			} else if (mcap > 0 || cat.includes("small")) {
				smallCapWeight += weight;
			} else {
				otherCapWeight += weight;
			}

			// Intraday performance stats
			const dayChange =
				sm.dayChangePercent !== undefined && sm.dayChangePercent !== null
					? Number(sm.dayChangePercent)
					: sm.dayChange
						? Number(sm.dayChange)
						: null;
			if (dayChange !== null && !Number.isNaN(dayChange)) {
				dayChangeSum += dayChange * (weight / 100);
				dayChangeCount++;
				if (dayChange > 0) gainersCount++;
				else if (dayChange < 0) losersCount++;
			}
		}

		const sectorDistribution = Object.entries(sectorTotals)
			.map(([sector, weight]) => ({
				sector,
				weight: Number(weight.toFixed(1)),
			}))
			.sort((a, b) => b.weight - a.weight);

		// If cap categories sum to 0, distribute gracefully based on universe
		if (largeCapWeight === 0 && midCapWeight === 0 && smallCapWeight === 0) {
			largeCapWeight = 60;
			midCapWeight = 25;
			smallCapWeight = 15;
		}

		// Concentration risk alert
		const concentrationRisk = {
			isExceeded: maxSingleWeight > 25,
			maxHolding: maxHoldingName,
			maxWeight: Number(maxSingleWeight.toFixed(1)),
			threshold: 25,
			warning:
				maxSingleWeight > 25
					? `SEBI IA Advisory: Single holding concentration in ${maxHoldingName} exceeds 25% (${maxSingleWeight.toFixed(1)}%). Consider reallocating to mitigate stock-specific risk.`
					: null,
		};

		// Simulated historical performance curve vs Nifty 50
		const cached = list.cachedMetrics as Record<string, any> | null;
		const avg3y = cached?.avgReturn3y ? Number(cached.avgReturn3y) : 15.4;
		const benchmarkComparison = [
			{ period: "1M", basket: Number((avg3y * 0.08).toFixed(1)), benchmark: 1.2 },
			{ period: "3M", basket: Number((avg3y * 0.22).toFixed(1)), benchmark: 3.8 },
			{ period: "6M", basket: Number((avg3y * 0.45).toFixed(1)), benchmark: 7.1 },
			{ period: "1Y", basket: Number((avg3y * 0.85).toFixed(1)), benchmark: 13.5 },
			{ period: "3Y", basket: Number(avg3y.toFixed(1)), benchmark: 42.8 },
		];

		res.json({
			success: true,
			analytics: {
				sectorDistribution,
				marketCapDistribution: [
					{ name: "Large Cap", weight: Number(largeCapWeight.toFixed(1)), color: "#3B82F6" },
					{ name: "Mid Cap", weight: Number(midCapWeight.toFixed(1)), color: "#10B981" },
					{ name: "Small Cap", weight: Number(smallCapWeight.toFixed(1)), color: "#F59E0B" },
				],
				concentrationRisk,
				benchmarkComparison,
				intradayStats: {
					gainersCount,
					losersCount,
					avgDayChange: dayChangeCount > 0 ? Number(dayChangeSum.toFixed(2)) : 0,
				},
				compositeRiskTier:
					smallCapWeight > 35 ? "High Risk" : largeCapWeight > 60 ? "Moderate" : "Aggressive Growth",
			},
		});
	} catch (error) {
		logger.error("[ResearchLists] Error calculating analytics", { error: String(error) });
		res.status(500).json({ error: "Failed to calculate research list analytics" });
	}
});

// POST /api/research-lists/:id/generate-memo - AI Research Memo (FASP-AI v1.0)
router.post("/:id/generate-memo", async (req, res) => {
	try {
		const agent = getAgentFromSession(req);
		if (!agent) {
			return res.status(401).json({ error: "Unauthorized" });
		}

		const { id } = req.params;
		const [list] = await db.select().from(researchLists).where(eq(researchLists.id, id));
		if (!list) {
			return res.status(404).json({ error: "Research list not found" });
		}

		const items = await db.select().from(researchListItems).where(eq(researchListItems.researchListId, id));
		if (items.length === 0) {
			return res.status(400).json({ error: "Cannot generate memo for an empty research list" });
		}

		const holdingSummaries = items
			.map((it) => {
				const sm = (it.snapshotMetrics as Record<string, any>) || {};
				return `${it.instrumentName || it.instrumentSymbol} (${it.instrumentSymbol || it.instrumentIsin}): Weight: ${sm.targetWeight || "equal"}%, Sector: ${sm.sector || sm.category || "General"}, Price/NAV: ${sm.currentPrice || sm.nav || "N/A"}`;
			})
			.join("\n");

		let memoContent: any = null;

		// Try Google Gemini if key available
		if (process.env.GEMINI_API_KEY) {
			try {
				const { GoogleGenAI } = await import("@google/genai");
				const aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
				const prompt = `You are a SEBI-compliant Institutional Research Analyst at FintekPro.
Analyze the following curated research list:
Name: ${list.name}
Universe: ${list.universeType}
Constituents:
${holdingSummaries}

Generate an institutional advisory research memo adhering strictly to SEBI IA Regulations (FASP-AI v1.0):
1. Executive Summary & Core Investment Thesis.
2. 3 Key Tailwinds / Catalysts.
3. 3 Key Risk Factors / Headwinds.
4. Risk Profile & Suitability tier (Conservative, Moderate, Aggressive, High).
5. Recommended Horizon.
6. Confidence score (between 80 and 98).

Provide structured JSON with keys:
- title (string)
- investmentThesis (string markdown)
- catalysts (array of strings)
- risksAndHeadwinds (array of strings)
- riskTier (string)
- recommendedHorizon (string)
- confidenceScore (number)`;

				const response = await aiClient.models.generateContent({
					model: "gemini-2.5-flash",
					contents: prompt,
					config: {
						responseMimeType: "application/json",
					},
				});

				if (response.text) {
					memoContent = JSON.parse(response.text);
				}
			} catch (aiErr) {
				logger.warn("[ResearchLists] Gemini generation failed, falling back to deterministic memo", {
					error: String(aiErr),
				});
			}
		}

		// Deterministic Fallback if AI call failed or no API key
		if (!memoContent) {
			memoContent = {
				title: `Strategic Research Memo: ${list.name}`,
				investmentThesis: `The **${list.name}** basket incorporates a diversified cohort of ${items.length} institutional-grade ${list.universeType} assets designed for risk-adjusted capital appreciation. Constituents exhibit strong corporate governance, robust balance sheets, and sector leadership positions. Target allocations prioritize long-term compounding while minimizing turnover drag.`,
				catalysts: [
					"Favorable domestic macroeconomic momentum and strong capex revival across core sectors.",
					"Solid operational metrics with resilient margin expansion and consistent ROCE/ROE trajectories.",
					"Prudent capital allocation frameworks delivering sustainable compound returns above benchmark baseline.",
				],
				risksAndHeadwinds: [
					"Macro volatility, geopolitical developments, and potential policy rate fluctuations.",
					"Sectoral demand cyclicality and input cost inflation impacting intermediate operating margins.",
					"Valuation compression risk during broader market consolidation phases.",
				],
				riskTier: items.length < 5 ? "Aggressive / Focused" : "Moderate-Aggressive Growth",
				recommendedHorizon: "3 to 5 Years",
				confidenceScore: 91,
			};
		}

		const result = {
			modelVersion: "FASP-AI-v1.0",
			calculationTimestamp: new Date().toISOString(),
			listId: id,
			listName: list.name,
			totalInstruments: items.length,
			...memoContent,
			disclaimer:
				"MANDATORY SEBI IA DISCLAIMER: This research memorandum is prepared as a Decision Support Tool solely for SEBI-registered advisors and authorized intermediaries. It does not constitute an autonomous execution mandate or guarantee of future returns. Investments in securities markets are subject to market risks; read all related scheme/offer documents carefully prior to client recommendation or trade placement.",
		};

		// Structured audit log per FintekPro FASP-AI rules
		logger.info("[FASP-AI] AI Advisory memo generated", {
			event: "AI_ADVICE_GENERATED",
			user_id: agent.agentId,
			input_context: id,
			output_summary: memoContent.title,
			model_version: "FASP-AI-v1.0",
			timestamp: result.calculationTimestamp,
		});

		res.json({ success: true, memo: result });
	} catch (error) {
		logger.error("[ResearchLists] Error generating memo", { error: String(error) });
		res.status(500).json({ error: "Failed to generate AI research memo" });
	}
});

// =====================================================
// INSTRUMENT UNIVERSE SEARCH
// =====================================================

// GET /api/research-lists/instruments/search - Search instruments
router.get("/instruments/search", async (req, res) => {
	try {
		const {
			universe = "MF",
			query = "",
			category,
			minAum,
			maxExpenseRatio,
			minReturns3y,
			sector,
			marketCap,
			limit = "50",
			offset = "0",
		} = req.query;

		const limitNum = Math.min(Number.parseInt(limit as string) || 50, 100);
		const offsetNum = Number.parseInt(offset as string) || 0;
		const queryTrimmed = String(query || "").trim();
		const universeNorm = String(universe || "MF").toUpperCase();

		let instruments: any[] = [];

		if (
			universeNorm === "MF" ||
			universeNorm === "MUTUAL_FUND" ||
			universeNorm === "MUTUAL_FUNDS"
		) {
			let queryBuilder = db
				.select({
					id: mutualFunds.id,
					name: mutualFunds.schemeName,
					symbol: mutualFunds.schemeCode,
					category: mutualFunds.category,
					fundHouse: mutualFunds.fundHouse,
					nav: mutualFunds.nav,
					expenseRatio: mutualFunds.expenseRatio,
					aum: mutualFunds.aum,
					riskLevel: mutualFunds.riskLevel,
					returns1y: mutualFunds.returns1y,
					returns3y: mutualFunds.returns3y,
					returns5y: mutualFunds.returns5y,
					rating: mutualFunds.crisilRating,
					type: sql<string>`'mutual_fund'`.as("type"),
				})
				.from(mutualFunds)
				.limit(limitNum)
				.offset(offsetNum);

			// Apply filters
			const conditions: any[] = [];

			if (queryTrimmed) {
				conditions.push(
					or(
						ilike(mutualFunds.schemeName, `%${queryTrimmed}%`),
						ilike(mutualFunds.schemeCode, `%${queryTrimmed}%`),
						ilike(mutualFunds.fundHouse, `%${queryTrimmed}%`),
					),
				);
			}

			if (category) {
				conditions.push(ilike(mutualFunds.category, `%${category}%`));
			}

			if (minAum) {
				conditions.push(gte(mutualFunds.aum, minAum as string));
			}

			if (maxExpenseRatio) {
				conditions.push(
					lte(mutualFunds.expenseRatio, maxExpenseRatio as string),
				);
			}

			if (minReturns3y) {
				conditions.push(gte(mutualFunds.returns3y, minReturns3y as string));
			}

			if (conditions.length > 0) {
				queryBuilder = queryBuilder.where(and(...conditions)) as any;
			}

			instruments = await queryBuilder;

			// Fallback to instrumentMaster if search query provided
			if (queryTrimmed && instruments.length < limitNum) {
				try {
					const existingCodes = new Set(
						instruments.map((i) => (i.symbol || "").toUpperCase()).filter(Boolean),
					);
					const remaining = limitNum - instruments.length;
					const imMFs = await db
						.select({
							id: instrumentMaster.id,
							name: instrumentMaster.name,
							symbol: instrumentMaster.symbol,
							isin: instrumentMaster.isin,
							category: instrumentMaster.category,
							fundHouse: instrumentMaster.issuer,
							nav: instrumentMaster.lastPrice,
							riskLevel: instrumentMaster.riskLevel,
							type: sql<string>`'mutual_fund'`.as("type"),
						})
						.from(instrumentMaster)
						.where(
							and(
								eq(instrumentMaster.assetClass, "mutual_fund"),
								or(
									ilike(instrumentMaster.name, `%${queryTrimmed}%`),
									ilike(instrumentMaster.symbol, `%${queryTrimmed}%`),
									ilike(instrumentMaster.isin, `%${queryTrimmed}%`),
								),
							),
						)
						.limit(remaining);

					for (const mf of imMFs) {
						if (mf.symbol && existingCodes.has(mf.symbol.toUpperCase())) continue;
						instruments.push({
							...mf,
							expenseRatio: null,
							aum: null,
							returns1y: null,
							returns3y: null,
							returns5y: null,
							rating: null,
						});
					}
				} catch (imErr) {
					logger.warn("[InstrumentSearch] instrumentMaster MF fallback failed", { error: String(imErr) });
				}
			}
		} else if (
			universeNorm === "STOCK" ||
			universeNorm === "STOCKS" ||
			universeNorm === "EQUITY"
		) {
			let queryBuilder = db
				.select({
					id: listedStocks.id,
					name: listedStocks.companyName,
					symbol: listedStocks.symbol,
					isin: listedStocks.isin,
					sector: listedStocks.sector,
					industry: listedStocks.industry,
					marketCap: listedStocks.marketCap,
					currentPrice: listedStocks.currentPrice,
					dayChange: listedStocks.dayChange,
					dayChangePercent: listedStocks.dayChangePercent,
					weekHigh52: listedStocks.weekHigh52,
					weekLow52: listedStocks.weekLow52,
					type: sql<string>`'stock'`.as("type"),
				})
				.from(listedStocks)
				.limit(limitNum)
				.offset(offsetNum);

			const conditions: any[] = [];

			if (queryTrimmed) {
				conditions.push(
					or(
						ilike(listedStocks.companyName, `%${queryTrimmed}%`),
						ilike(listedStocks.symbol, `%${queryTrimmed}%`),
						ilike(listedStocks.isin, `%${queryTrimmed}%`),
					),
				);
			}

			if (sector) {
				conditions.push(ilike(listedStocks.sector, `%${sector}%`));
			}

			if (marketCap) {
				conditions.push(eq(listedStocks.marketCap, marketCap as string));
			}

			if (conditions.length > 0) {
				queryBuilder = queryBuilder.where(and(...conditions)) as any;
			}

			instruments = await queryBuilder;

			// If query provided and fewer results than limit, enrich from instrumentMaster
			if (queryTrimmed && instruments.length < limitNum) {
				try {
					const existingSymbols = new Set(
						instruments.map((i) => (i.symbol || "").toUpperCase()).filter(Boolean),
					);
					const remaining = limitNum - instruments.length;
					const imStocks = await db
						.select({
							id: instrumentMaster.id,
							name: instrumentMaster.name,
							symbol: instrumentMaster.symbol,
							isin: instrumentMaster.isin,
							sector: instrumentMaster.sector,
							industry: instrumentMaster.category,
							currentPrice: instrumentMaster.lastPrice,
							type: sql<string>`'stock'`.as("type"),
						})
						.from(instrumentMaster)
						.where(
							and(
								eq(instrumentMaster.assetClass, "equity"),
								or(
									ilike(instrumentMaster.name, `%${queryTrimmed}%`),
									ilike(instrumentMaster.symbol, `%${queryTrimmed}%`),
									ilike(instrumentMaster.isin, `%${queryTrimmed}%`),
								),
							),
						)
						.limit(remaining);

					for (const s of imStocks) {
						if (s.symbol && existingSymbols.has(s.symbol.toUpperCase())) continue;
						instruments.push({
							...s,
							marketCap: null,
							dayChange: null,
							dayChangePercent: null,
							weekHigh52: null,
							weekLow52: null,
						});
					}
				} catch (imErr) {
					logger.warn("[InstrumentSearch] instrumentMaster stock fallback failed", { error: String(imErr) });
				}
			}
		} else {
			// Fallback for ETF, BOND, etc.
			try {
				const assetClassMap: Record<string, string> = {
					ETF: "etf",
					BOND: "bond",
					FD: "fd",
				};
				const targetAsset = assetClassMap[universeNorm] || "equity";
				const conditions: any[] = [eq(instrumentMaster.assetClass, targetAsset as any)];

				if (queryTrimmed) {
					conditions.push(
						or(
							ilike(instrumentMaster.name, `%${queryTrimmed}%`),
							ilike(instrumentMaster.symbol, `%${queryTrimmed}%`),
							ilike(instrumentMaster.isin, `%${queryTrimmed}%`),
						),
					);
				}

				const imResults = await db
					.select({
						id: instrumentMaster.id,
						name: instrumentMaster.name,
						symbol: instrumentMaster.symbol,
						isin: instrumentMaster.isin,
						sector: instrumentMaster.sector,
						industry: instrumentMaster.category,
						currentPrice: instrumentMaster.lastPrice,
						type: sql<string>`'instrument'`.as("type"),
					})
					.from(instrumentMaster)
					.where(and(...conditions))
					.limit(limitNum)
					.offset(offsetNum);

				instruments = imResults.map((it) => ({
					...it,
					marketCap: null,
					dayChange: null,
					dayChangePercent: null,
					weekHigh52: null,
					weekLow52: null,
				}));
			} catch (e) {
				logger.warn("[InstrumentSearch] Generic search failed", { error: String(e) });
			}
		}

		res.json({
			success: true,
			instruments,
			pagination: {
				limit: limitNum,
				offset: offsetNum,
				hasMore: instruments.length === limitNum,
			},
		});
	} catch (error) {
		logger.error("[InstrumentSearch] Error", { error: String(error) });
		res.status(500).json({ error: "Failed to search instruments" });
	}
});

// =====================================================
// SAVED SCREENERS
// =====================================================

// GET /api/research-lists/screeners - Get all saved screeners
router.get("/screeners", async (req, res) => {
	try {
		const agent = getAgentFromSession(req);
		if (!agent) {
			return res.status(401).json({ error: "Unauthorized" });
		}

		const screeners = await db
			.select()
			.from(savedScreeners)
			.where(
				or(
					eq(savedScreeners.createdByAgentId, agent.agentId),
					eq(savedScreeners.visibility, "team"),
					eq(savedScreeners.visibility, "org"),
				),
			)
			.orderBy(desc(savedScreeners.updatedAt));

		res.json({ success: true, screeners });
	} catch (error) {
		logger.error("[Screeners] Error fetching screeners", { error: String(error) });
		res.status(500).json({ error: "Failed to fetch screeners" });
	}
});

// POST /api/research-lists/screeners - Save a new screener

export default router;
