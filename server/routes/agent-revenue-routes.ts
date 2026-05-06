import { Router } from "express";
import { db } from "../db";
import { agentRevenueTracking, clientAgentRelationships } from "@shared/schema";
import { eq, and, sql, gte, desc } from "drizzle-orm";
import { requireAgentPortal } from "../middleware/roleMiddleware";

const router = Router();
const requireAuth = requireAgentPortal;

router.get("/revenue/metrics", requireAuth, async (req, res) => {
  try {
    const agentId = (req.user as any)?.id;
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const revenue = await db
      .select({ total: sql<number>`SUM(agent_net_commission)` })
      .from(agentRevenueTracking)
      .where(and(
        eq(agentRevenueTracking.agentId, agentId),
        gte(agentRevenueTracking.transactionDate, startOfMonth)
      ));

    res.json({
      mtdRevenue: revenue[0]?.total || 0,
      period: "Current Month"
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch revenue metrics" });
  }
});

export default router;
