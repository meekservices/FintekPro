import { Router } from "express";
import { db } from "../db";
import { portfolios, clientAgentRelationships } from "@shared/schema";
import { eq, and, inArray, gt } from "drizzle-orm";
import { requireAgentPortal } from "../middleware/roleMiddleware";

const router = Router();
const requireAuth = requireAgentPortal;

router.get("/portfolio-drift", requireAuth, async (req, res) => {
  try {
    const agentId = (req.user as any)?.id;
    
    const relationships = await db
      .select({ clientId: clientAgentRelationships.clientId })
      .from(clientAgentRelationships)
      .where(and(eq(clientAgentRelationships.agentId, agentId), eq(clientAgentRelationships.isActive, true)));
    
    const clientIds = relationships.map(r => r.clientId).filter(Boolean) as string[];
    
    if (clientIds.length === 0) return res.json([]);

    const driftClients = await db
      .select()
      .from(portfolios)
      .where(and(
        inArray(portfolios.userId, clientIds),
        gt(sql`ABS(target_allocation - current_allocation)`, 5)
      ));

    res.json(driftClients);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch portfolio drift" });
  }
});

export default router;
