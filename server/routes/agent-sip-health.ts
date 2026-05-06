import { Router } from "express";
import { db } from "../db";
import { portfolios, portfolioHoldings, clientAgentRelationships } from "@shared/schema";
import { eq, and, inArray } from "drizzle-orm";
import { requireAgentPortal } from "../middleware/roleMiddleware";

const router = Router();
const requireAuth = requireAgentPortal;

router.get("/sip-health", requireAuth, async (req, res) => {
  try {
    const agentId = (req.user as any)?.id;
    
    const relationships = await db
      .select({ clientId: clientAgentRelationships.clientId })
      .from(clientAgentRelationships)
      .where(and(eq(clientAgentRelationships.agentId, agentId), eq(clientAgentRelationships.isActive, true)));
    
    const clientIds = relationships.map(r => r.clientId).filter(Boolean) as string[];
    
    if (clientIds.length === 0) return res.json({ healthyCount: 0, totalCount: 0 });

    const sipData = await db
      .select({ count: sql<number>`count(*)` })
      .from(portfolioHoldings)
      .where(and(
        inArray(portfolioHoldings.portfolioId, 
          db.select({ id: portfolios.id }).from(portfolios).where(inArray(portfolios.userId, clientIds))
        ),
        eq(portfolioHoldings.isSip, true)
      ));

    res.json({
      totalSips: Number(sipData[0]?.count) || 0,
      healthySips: Number(sipData[0]?.count) || 0 // Mocked health status
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch SIP health" });
  }
});

export default router;
