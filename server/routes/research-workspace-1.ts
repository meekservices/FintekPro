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
					sql<number>`(SELECT COUNT(*) FROM research_list_items WHERE research_list_id = ${researchLists.id})`.as(
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

		res.json({ success: true, list, items });
	} catch (error) {
		logger.error("[ResearchLists] Error fetching list", { error: String(error) });
		res.status(500).json({ error: "Failed to fetch research list" });
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
