import { Router } from "express";
import { db } from "../db";
import { agentBaskets, agentBasketItems, users } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import { getAppBaseUrl } from "../utils/app-url";

import { requireAgentPortal } from "../middleware/roleMiddleware";

const router = Router();

// Middleware is imported above
const requireAuth = requireAgentPortal;

// GET /api/agent/baskets — list all baskets for the authenticated agent
router.get("/api/agent/baskets", requireAuth, async (req, res) => {
  try {
    const agentId = (req.user as any)?.id;
    const baskets = await db
      .select({
        id: agentBaskets.id,
        name: agentBaskets.name,
        theme: agentBaskets.theme,
        description: agentBaskets.description,
        isPublic: agentBaskets.isPublic,
        createdAt: agentBaskets.createdAt,
        updatedAt: agentBaskets.updatedAt,
        itemCount: sql<number>`(SELECT COUNT(*) FROM agent_basket_items WHERE basket_id = ${agentBaskets.id})`,
        totalAllocation: sql<number>`(SELECT COALESCE(SUM(allocation_percent), 0) FROM agent_basket_items WHERE basket_id = ${agentBaskets.id})`,
      })
      .from(agentBaskets)
      .where(eq(agentBaskets.agentId, agentId))
      .orderBy(sql`${agentBaskets.updatedAt} DESC`);

    res.json(baskets);
  } catch (err) {
    console.error("[Agent Baskets] GET list error:", err);
    res.status(500).json({ error: "Failed to fetch baskets" });
  }
});

// POST /api/agent/baskets — create a basket
router.post("/api/agent/baskets", requireAuth, async (req, res) => {
  try {
    const agentId = (req.user as any)?.id;
    const { name, theme, description, isPublic } = req.body;
    if (!name) return res.status(400).json({ error: "Basket name is required" });

    const [basket] = await db
      .insert(agentBaskets)
      .values({ agentId, name, theme: theme || "Custom", description, isPublic: isPublic || false })
      .returning();

    res.json(basket);
  } catch (err) {
    console.error("[Agent Baskets] POST create error:", err);
    res.status(500).json({ error: "Failed to create basket" });
  }
});

// GET /api/agent/baskets/:id — basket detail + items
router.get("/api/agent/baskets/:id", requireAuth, async (req, res) => {
  try {
    const agentId = (req.user as any)?.id;
    const { id } = req.params;

    const [basket] = await db
      .select()
      .from(agentBaskets)
      .where(and(eq(agentBaskets.id, id), eq(agentBaskets.agentId, agentId)));

    if (!basket) return res.status(404).json({ error: "Basket not found" });

    const items = await db
      .select()
      .from(agentBasketItems)
      .where(eq(agentBasketItems.basketId, id))
      .orderBy(agentBasketItems.addedAt);

    res.json({ ...basket, items });
  } catch (err) {
    console.error("[Agent Baskets] GET detail error:", err);
    res.status(500).json({ error: "Failed to fetch basket" });
  }
});

// PUT /api/agent/baskets/:id — update basket metadata
router.put("/api/agent/baskets/:id", requireAuth, async (req, res) => {
  try {
    const agentId = (req.user as any)?.id;
    const { id } = req.params;
    const { name, theme, description, isPublic } = req.body;

    const [updated] = await db
      .update(agentBaskets)
      .set({ name, theme, description, isPublic, updatedAt: new Date() })
      .where(and(eq(agentBaskets.id, id), eq(agentBaskets.agentId, agentId)))
      .returning();

    if (!updated) return res.status(404).json({ error: "Basket not found" });
    res.json(updated);
  } catch (err) {
    console.error("[Agent Baskets] PUT update error:", err);
    res.status(500).json({ error: "Failed to update basket" });
  }
});

// DELETE /api/agent/baskets/:id — delete basket
router.delete("/api/agent/baskets/:id", requireAuth, async (req, res) => {
  try {
    const agentId = (req.user as any)?.id;
    const { id } = req.params;

    await db
      .delete(agentBaskets)
      .where(and(eq(agentBaskets.id, id), eq(agentBaskets.agentId, agentId)));

    res.json({ success: true });
  } catch (err) {
    console.error("[Agent Baskets] DELETE error:", err);
    res.status(500).json({ error: "Failed to delete basket" });
  }
});

// POST /api/agent/baskets/:id/items — add instrument
router.post("/api/agent/baskets/:id/items", requireAuth, async (req, res) => {
  try {
    const agentId = (req.user as any)?.id;
    const { id } = req.params;

    const [basket] = await db
      .select({ id: agentBaskets.id })
      .from(agentBaskets)
      .where(and(eq(agentBaskets.id, id), eq(agentBaskets.agentId, agentId)));
    if (!basket) return res.status(404).json({ error: "Basket not found" });

    const { instrumentType, symbol, isin, name, allocationPercent } = req.body;
    if (!name) return res.status(400).json({ error: "Instrument name is required" });

    const [item] = await db
      .insert(agentBasketItems)
      .values({ basketId: id, instrumentType: instrumentType || "stock", symbol, isin, name, allocationPercent: allocationPercent || 0 })
      .returning();

    await db.update(agentBaskets).set({ updatedAt: new Date() }).where(eq(agentBaskets.id, id));

    res.json(item);
  } catch (err) {
    console.error("[Agent Baskets] POST item error:", err);
    res.status(500).json({ error: "Failed to add item" });
  }
});

// DELETE /api/agent/baskets/:id/items/:itemId — remove item
router.delete("/api/agent/baskets/:id/items/:itemId", requireAuth, async (req, res) => {
  try {
    const agentId = (req.user as any)?.id;
    const { id, itemId } = req.params;

    const [basket] = await db
      .select({ id: agentBaskets.id })
      .from(agentBaskets)
      .where(and(eq(agentBaskets.id, id), eq(agentBaskets.agentId, agentId)));
    if (!basket) return res.status(404).json({ error: "Basket not found" });

    await db.delete(agentBasketItems).where(eq(agentBasketItems.id, itemId));
    await db.update(agentBaskets).set({ updatedAt: new Date() }).where(eq(agentBaskets.id, id));

    res.json({ success: true });
  } catch (err) {
    console.error("[Agent Baskets] DELETE item error:", err);
    res.status(500).json({ error: "Failed to remove item" });
  }
});

// POST /api/agent/baskets/:id/share — generate share text + link
router.post("/api/agent/baskets/:id/share", requireAuth, async (req, res) => {
  try {
    const agentId = (req.user as any)?.id;
    const { id } = req.params;

    const [basket] = await db
      .select({
        id: agentBaskets.id,
        name: agentBaskets.name,
        theme: agentBaskets.theme,
        description: agentBaskets.description,
      })
      .from(agentBaskets)
      .where(and(eq(agentBaskets.id, id), eq(agentBaskets.agentId, agentId)));
    if (!basket) return res.status(404).json({ error: "Basket not found" });

    const items = await db
      .select()
      .from(agentBasketItems)
      .where(eq(agentBasketItems.basketId, id));

    const baseUrl = getAppBaseUrl();
    const basketLink = `${baseUrl}/agent/baskets/${id}`;

    const itemList = items
      .map((item) => `  • ${item.name} (${item.allocationPercent}%)`)
      .join("\n");

    const shareText = `*${basket.name}* — ${basket.theme} Basket\n\n${basket.description || ""}\n\n*Holdings:*\n${itemList}\n\n🔗 View full basket: ${basketLink}`;

    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;

    res.json({ shareText, whatsappUrl, basketLink });
  } catch (err) {
    console.error("[Agent Baskets] POST share error:", err);
    res.status(500).json({ error: "Failed to generate share link" });
  }
});

export default router;
