import { Router } from "express";
import { db } from "../db";
import { unifiedOrders, users } from "@shared/schema";
import { eq, and, sql, desc } from "drizzle-orm";
import { randomUUID } from "crypto";

const router = Router();

const requireAuth = (req: any, res: any, next: any) => {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
};

function generateOrderNumber(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `ORD-${date}-${rand}`;
}

// GET /api/agent/client-orders — list orders placed by this agent for clients
router.get("/api/agent/client-orders", requireAuth, async (req, res) => {
  try {
    const agentId = (req.user as any)?.id;
    const clientId = req.query.clientId as string | undefined;

    const whereClause = clientId
      ? and(eq(unifiedOrders.createdByAgentId, agentId), eq(unifiedOrders.userId, clientId))
      : eq(unifiedOrders.createdByAgentId, agentId);

    const orders = await db
      .select({
        id: unifiedOrders.id,
        orderNumber: unifiedOrders.orderNumber,
        userId: unifiedOrders.userId,
        productType: unifiedOrders.productType,
        productName: unifiedOrders.productName,
        orderType: unifiedOrders.orderType,
        amount: unifiedOrders.amount,
        quantity: unifiedOrders.quantity,
        status: unifiedOrders.status,
        notes: unifiedOrders.notes,
        createdAt: unifiedOrders.createdAt,
        clientFirstName: users.firstName,
        clientLastName: users.lastName,
        clientEmail: users.email,
      })
      .from(unifiedOrders)
      .leftJoin(users, eq(unifiedOrders.userId, users.id))
      .where(whereClause)
      .orderBy(desc(unifiedOrders.createdAt))
      .limit(100);

    res.json(
      orders.map((o) => ({
        ...o,
        clientName: `${o.clientFirstName || ""} ${o.clientLastName || ""}`.trim() || o.clientEmail,
      }))
    );
  } catch (err) {
    console.error("[Agent Client Orders] GET error:", err);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

// POST /api/agent/client-orders — place order on behalf of client
router.post("/api/agent/client-orders", requireAuth, async (req, res) => {
  try {
    const agentId = (req.user as any)?.id;
    const { clientId, productType, productName, symbol, isin, action, quantity, orderType, price, notes, consentConfirmed } = req.body;

    if (!consentConfirmed) {
      return res.status(400).json({ error: "Client consent must be confirmed before placing an order" });
    }
    if (!clientId) return res.status(400).json({ error: "Client ID is required" });
    if (!productType) return res.status(400).json({ error: "Product type is required" });
    if (!productName) return res.status(400).json({ error: "Product name is required" });
    if (!action) return res.status(400).json({ error: "Order action (buy/sell) is required" });

    const [client] = await db.select({ id: users.id }).from(users).where(eq(users.id, clientId));
    if (!client) return res.status(404).json({ error: "Client not found" });

    const orderId = randomUUID();
    const [order] = await db
      .insert(unifiedOrders)
      .values({
        id: orderId,
        orderNumber: generateOrderNumber(),
        userId: clientId,
        createdByAgentId: agentId,
        productType,
        productId: isin || symbol || undefined,
        productName,
        orderType: action,
        quantity: quantity ? String(quantity) : undefined,
        amount: price ? String(price) : "0",
        status: "initiated",
        paymentStatus: "pending",
        executionStatus: "pending",
        notes: `Agent-placed order${notes ? ": " + notes : ""}. Client consent confirmed.`,
        createdBy: agentId,
        metadata: { placedByAgent: true, agentId, symbol, isin, orderSubType: orderType || "MARKET", consentConfirmed: true },
      })
      .returning();

    res.json(order);
  } catch (err) {
    console.error("[Agent Client Orders] POST error:", err);
    res.status(500).json({ error: "Failed to place order" });
  }
});

export default router;
