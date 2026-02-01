import { Router } from "express";
import { db } from "../db";
import { 
  researchLists, 
  researchListItems, 
  savedScreeners,
  researchListProposalAttachments,
  researchAuditLog,
  mutualFunds,
  listedStocks,
  agents,
  insertResearchListSchema,
  insertResearchListItemSchema,
  insertSavedScreenerSchema,
} from "@shared/schema";
import { eq, and, or, desc, asc, sql, ilike, gte, lte, inArray } from "drizzle-orm";
import { z } from "zod";

const router = Router();

// Helper: Get agent from session
function getAgentFromSession(req: any): { agentId: string; agentName: string } | null {
  if (req.user?.agentId) {
    return { agentId: req.user.agentId, agentName: req.user.fullName || req.user.email };
  }
  if (req.user?.id) {
    return { agentId: req.user.id, agentName: req.user.fullName || req.user.email };
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
  ipAddress?: string
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
    console.error("[ResearchAudit] Failed to log:", error);
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
        itemCount: sql<number>`(SELECT COUNT(*) FROM research_list_items WHERE research_list_id = ${researchLists.id})`.as("item_count"),
      })
      .from(researchLists)
      .where(
        or(
          eq(researchLists.createdByAgentId, agent.agentId),
          eq(researchLists.visibility, "org"),
          eq(researchLists.visibility, "team")
        )
      )
      .orderBy(desc(researchLists.updatedAt));

    res.json({ success: true, lists });
  } catch (error) {
    console.error("[ResearchLists] Error fetching lists:", error);
    res.status(500).json({ error: "Failed to fetch research lists" });
  }
});

// GET /api/research-lists/:id - Get single research list with items
router.get("/:id", async (req, res) => {
  try {
    const agent = getAgentFromSession(req);
    if (!agent) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { id } = req.params;

    const [list] = await db
      .select()
      .from(researchLists)
      .where(eq(researchLists.id, id));

    if (!list) {
      return res.status(404).json({ error: "Research list not found" });
    }

    // Check access
    if (list.createdByAgentId !== agent.agentId && list.visibility === "private") {
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
    console.error("[ResearchLists] Error fetching list:", error);
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
      req.ip
    );

    res.status(201).json({ success: true, list: newList });
  } catch (error) {
    console.error("[ResearchLists] Error creating list:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
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

    const { id } = req.params;

    // Get existing list
    const [existingList] = await db
      .select()
      .from(researchLists)
      .where(eq(researchLists.id, id));

    if (!existingList) {
      return res.status(404).json({ error: "Research list not found" });
    }

    // Check edit permission
    if (existingList.createdByAgentId !== agent.agentId) {
      if (existingList.visibility !== "org" || !existingList.isEditable) {
        return res.status(403).json({ error: "Cannot edit this list" });
      }
    }

    const { name, description, visibility, isEditable, tags, isArchived } = req.body;

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
      req.ip
    );

    res.json({ success: true, list: updatedList });
  } catch (error) {
    console.error("[ResearchLists] Error updating list:", error);
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

    const { id } = req.params;

    const [existingList] = await db
      .select()
      .from(researchLists)
      .where(eq(researchLists.id, id));

    if (!existingList) {
      return res.status(404).json({ error: "Research list not found" });
    }

    // Only owner can delete
    if (existingList.createdByAgentId !== agent.agentId) {
      return res.status(403).json({ error: "Only the creator can delete this list" });
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
      req.ip
    );

    res.json({ success: true, message: "Research list deleted" });
  } catch (error) {
    console.error("[ResearchLists] Error deleting list:", error);
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

    const { id } = req.params;

    // Verify list exists and is editable
    const [list] = await db
      .select()
      .from(researchLists)
      .where(eq(researchLists.id, id));

    if (!list) {
      return res.status(404).json({ error: "Research list not found" });
    }

    if (!list.isEditable && list.createdByAgentId !== agent.agentId) {
      return res.status(403).json({ error: "This list is not editable" });
    }

    const validatedData = insertResearchListItemSchema.parse({
      ...req.body,
      researchListId: id,
      addedByAgentId: agent.agentId,
    });

    const [newItem] = await db
      .insert(researchListItems)
      .values(validatedData)
      .returning();

    // Update list's updatedAt
    await db
      .update(researchLists)
      .set({ updatedAt: new Date() })
      .where(eq(researchLists.id, id));

    await logResearchAudit(
      "research_list_item",
      newItem.id,
      "add_item",
      agent.agentId,
      agent.agentName,
      null,
      newItem,
      req.ip
    );

    res.status(201).json({ success: true, item: newItem });
  } catch (error) {
    console.error("[ResearchListItems] Error adding item:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: error.errors });
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

    const { id, itemId } = req.params;

    // Verify list exists and is editable
    const [list] = await db
      .select()
      .from(researchLists)
      .where(eq(researchLists.id, id));

    if (!list) {
      return res.status(404).json({ error: "Research list not found" });
    }

    if (!list.isEditable && list.createdByAgentId !== agent.agentId) {
      return res.status(403).json({ error: "This list is not editable" });
    }

    const [existingItem] = await db
      .select()
      .from(researchListItems)
      .where(and(
        eq(researchListItems.id, itemId),
        eq(researchListItems.researchListId, id)
      ));

    if (!existingItem) {
      return res.status(404).json({ error: "Item not found in list" });
    }

    await db.delete(researchListItems).where(eq(researchListItems.id, itemId));

    // Update list's updatedAt
    await db
      .update(researchLists)
      .set({ updatedAt: new Date() })
      .where(eq(researchLists.id, id));

    await logResearchAudit(
      "research_list_item",
      itemId,
      "remove_item",
      agent.agentId,
      agent.agentName,
      existingItem,
      null,
      req.ip
    );

    res.json({ success: true, message: "Item removed from list" });
  } catch (error) {
    console.error("[ResearchListItems] Error removing item:", error);
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
    console.error("[ResearchListItems] Error fetching items:", error);
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
      offset = "0"
    } = req.query;

    const limitNum = Math.min(parseInt(limit as string) || 50, 100);
    const offsetNum = parseInt(offset as string) || 0;

    let instruments: any[] = [];

    if (universe === "MF") {
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
      
      if (query) {
        conditions.push(
          or(
            ilike(mutualFunds.schemeName, `%${query}%`),
            ilike(mutualFunds.schemeCode, `%${query}%`),
            ilike(mutualFunds.fundHouse, `%${query}%`)
          )
        );
      }

      if (category) {
        conditions.push(ilike(mutualFunds.category, `%${category}%`));
      }

      if (minAum) {
        conditions.push(gte(mutualFunds.aum, minAum as string));
      }

      if (maxExpenseRatio) {
        conditions.push(lte(mutualFunds.expenseRatio, maxExpenseRatio as string));
      }

      if (minReturns3y) {
        conditions.push(gte(mutualFunds.returns3y, minReturns3y as string));
      }

      if (conditions.length > 0) {
        queryBuilder = queryBuilder.where(and(...conditions)) as any;
      }

      instruments = await queryBuilder;
    } else if (universe === "STOCK") {
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

      if (query) {
        conditions.push(
          or(
            ilike(listedStocks.companyName, `%${query}%`),
            ilike(listedStocks.symbol, `%${query}%`)
          )
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
    }

    res.json({ 
      success: true, 
      instruments,
      pagination: {
        limit: limitNum,
        offset: offsetNum,
        hasMore: instruments.length === limitNum
      }
    });
  } catch (error) {
    console.error("[InstrumentSearch] Error:", error);
    res.status(500).json({ error: "Failed to search instruments" });
  }
});

// =====================================================
// SCREENER
// =====================================================

// POST /api/research-lists/screener/run - Run screener with DSL
router.post("/screener/run", async (req, res) => {
  try {
    const { universe, filters, limit = 50, offset = 0 } = req.body;

    if (!universe || !filters) {
      return res.status(400).json({ error: "Universe and filters are required" });
    }

    let results: any[] = [];
    const limitNum = Math.min(limit, 100);

    if (universe === "MF") {
      const conditions: any[] = [];

      // Build conditions from DSL
      for (const [field, operators] of Object.entries(filters)) {
        for (const [op, value] of Object.entries(operators as Record<string, any>)) {
          const column = getColumnByField(mutualFunds, field);
          if (!column) continue;

          if (op === ">=") conditions.push(gte(column, String(value)));
          if (op === "<=") conditions.push(lte(column, String(value)));
          if (op === "=") conditions.push(eq(column, value));
          if (op === "like") conditions.push(ilike(column, `%${value}%`));
        }
      }

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
        .offset(offset);

      if (conditions.length > 0) {
        queryBuilder = queryBuilder.where(and(...conditions)) as any;
      }

      results = await queryBuilder;
    } else if (universe === "STOCK") {
      const conditions: any[] = [];

      for (const [field, operators] of Object.entries(filters)) {
        for (const [op, value] of Object.entries(operators as Record<string, any>)) {
          const column = getColumnByField(listedStocks, field);
          if (!column) continue;

          if (op === ">=") conditions.push(gte(column, String(value)));
          if (op === "<=") conditions.push(lte(column, String(value)));
          if (op === "=") conditions.push(eq(column, value));
          if (op === "like") conditions.push(ilike(column, `%${value}%`));
        }
      }

      let queryBuilder = db
        .select({
          id: listedStocks.id,
          name: listedStocks.companyName,
          symbol: listedStocks.symbol,
          isin: listedStocks.isin,
          sector: listedStocks.sector,
          marketCap: listedStocks.marketCap,
          currentPrice: listedStocks.currentPrice,
          dayChangePercent: listedStocks.dayChangePercent,
          type: sql<string>`'stock'`.as("type"),
        })
        .from(listedStocks)
        .limit(limitNum)
        .offset(offset);

      if (conditions.length > 0) {
        queryBuilder = queryBuilder.where(and(...conditions)) as any;
      }

      results = await queryBuilder;
    }

    res.json({ 
      success: true, 
      results,
      count: results.length,
      filters,
      universe
    });
  } catch (error) {
    console.error("[Screener] Error running screener:", error);
    res.status(500).json({ error: "Failed to run screener" });
  }
});

// POST /api/research-lists/screener/save-to-list - Save screener results to new list
router.post("/screener/save-to-list", async (req, res) => {
  try {
    const agent = getAgentFromSession(req);
    if (!agent) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { name, description, universe, filters, instruments } = req.body;

    if (!name || !universe || !instruments || !Array.isArray(instruments)) {
      return res.status(400).json({ error: "Name, universe, and instruments array are required" });
    }

    // Create the list
    const [newList] = await db
      .insert(researchLists)
      .values({
        name,
        description,
        universeType: universe,
        createdByAgentId: agent.agentId,
        screenerConfig: { filters, universe },
        visibility: "private",
      })
      .returning();

    // Add instruments
    if (instruments.length > 0) {
      const itemsToInsert = instruments.map((inst: any) => ({
        researchListId: newList.id,
        instrumentId: inst.id,
        instrumentType: inst.type || universe.toLowerCase(),
        instrumentName: inst.name,
        instrumentSymbol: inst.symbol,
        instrumentIsin: inst.isin,
        addedSource: "screener",
        addedByAgentId: agent.agentId,
        snapshotMetrics: {
          nav: inst.nav,
          returns3y: inst.returns3y,
          expenseRatio: inst.expenseRatio,
          currentPrice: inst.currentPrice,
        },
      }));

      await db.insert(researchListItems).values(itemsToInsert);
    }

    await logResearchAudit(
      "research_list",
      newList.id,
      "create_from_screener",
      agent.agentId,
      agent.agentName,
      null,
      { list: newList, instrumentCount: instruments.length },
      req.ip
    );

    res.status(201).json({ 
      success: true, 
      list: newList, 
      itemsAdded: instruments.length 
    });
  } catch (error) {
    console.error("[Screener] Error saving to list:", error);
    res.status(500).json({ error: "Failed to save screener results to list" });
  }
});

// =====================================================
// PROPOSAL INTEGRATION
// =====================================================

// POST /api/research-lists/:id/attach-to-proposal - Attach list to proposal
router.post("/:id/attach-to-proposal", async (req, res) => {
  try {
    const agent = getAgentFromSession(req);
    if (!agent) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { id } = req.params;
    const { proposalId, rationale } = req.body;

    if (!proposalId) {
      return res.status(400).json({ error: "Proposal ID is required" });
    }

    // Get list with items for snapshot
    const [list] = await db
      .select()
      .from(researchLists)
      .where(eq(researchLists.id, id));

    if (!list) {
      return res.status(404).json({ error: "Research list not found" });
    }

    const items = await db
      .select()
      .from(researchListItems)
      .where(eq(researchListItems.researchListId, id));

    // Create immutable snapshot
    const snapshotData = {
      list: {
        id: list.id,
        name: list.name,
        description: list.description,
        universeType: list.universeType,
        cachedMetrics: list.cachedMetrics,
      },
      items: items.map(item => ({
        instrumentId: item.instrumentId,
        instrumentType: item.instrumentType,
        instrumentName: item.instrumentName,
        instrumentSymbol: item.instrumentSymbol,
        snapshotMetrics: item.snapshotMetrics,
        notes: item.notes,
        rating: item.rating,
      })),
      snapshotTimestamp: new Date().toISOString(),
    };

    const [attachment] = await db
      .insert(researchListProposalAttachments)
      .values({
        proposalId,
        researchListId: id,
        snapshotData,
        rationale,
        attachedByAgentId: agent.agentId,
      })
      .returning();

    await logResearchAudit(
      "research_list",
      id,
      "attach_proposal",
      agent.agentId,
      agent.agentName,
      null,
      { proposalId, attachmentId: attachment.id },
      req.ip
    );

    res.status(201).json({ success: true, attachment });
  } catch (error) {
    console.error("[ResearchList] Error attaching to proposal:", error);
    res.status(500).json({ error: "Failed to attach research list to proposal" });
  }
});

// Helper function to map field names to columns
function getColumnByField(table: any, field: string) {
  const fieldMap: Record<string, any> = {
    // Mutual Funds
    returns_1y: mutualFunds.returns1y,
    returns_3y: mutualFunds.returns3y,
    returns_5y: mutualFunds.returns5y,
    expense_ratio: mutualFunds.expenseRatio,
    aum: mutualFunds.aum,
    nav: mutualFunds.nav,
    category: mutualFunds.category,
    risk_level: mutualFunds.riskLevel,
    rating: mutualFunds.crisilRating,
    
    // Stocks
    current_price: listedStocks.currentPrice,
    market_cap: listedStocks.marketCap,
    sector: listedStocks.sector,
    day_change_percent: listedStocks.dayChangePercent,
  };
  
  return fieldMap[field];
}

export default router;
