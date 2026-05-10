import { Router } from "express";
import { db } from "../db";
import { 
  users, 
  clientAgentRelationships, 
  portfolios, 
  portfolioHoldings, 
  agentCommissions, 
  kycRegulatoryAuditLogs 
} from "@shared/schema";
import { eq, and, sql, desc, inArray, gte, or } from "drizzle-orm";
import { requireAgentPortal } from "../middleware/roleMiddleware";

const router = Router();

// Middleware is imported above
const requireAuth = requireAgentPortal;

// GET /tracker — aggregated overview for agent
router.get("/tracker", requireAuth, async (req, res) => {
  try {
    const agentId = (req.user as any)?.id;

    // 1. Get all active clients for this agent
    const relationships = await db
      .select({ clientId: clientAgentRelationships.clientId })
      .from(clientAgentRelationships)
      .where(and(
        eq(clientAgentRelationships.agentId, agentId),
        eq(clientAgentRelationships.isActive, true)
      ));

    const clientIds = relationships.map(r => r.clientId).filter(Boolean) as string[];

    if (clientIds.length === 0) {
      return res.json({
        totalClients: 0,
        activeAUM: 0,
        sipBookValue: 0,
        portfolioHealth: 100,
        revenueMTD: 0,
        pendingActions: {
          kycPending: 0,
          pendingOrders: 0,
          driftAlerts: 0
        },
        clientActivity: []
      });
    }

    // 2. Fetch AUM (Aggregate totalValue from portfolios for these clients)
    const portfolioData = await db
      .select({ totalValue: portfolios.totalValue })
      .from(portfolios)
      .where(inArray(portfolios.userId, clientIds));

    const activeAUM = portfolioData.reduce((sum, p) => sum + parseFloat(p.totalValue || "0"), 0);

    // 3. SIP Book Status (Calculated from portfolioHoldings with SIP flags)
    const sipHoldings = await db
      .select({ currentValue: portfolioHoldings.currentValue })
      .from(portfolioHoldings)
      .where(and(
        inArray(portfolioHoldings.portfolioId, 
          db.select({ id: portfolios.id }).from(portfolios).where(inArray(portfolios.userId, clientIds))
        ),
        eq(portfolioHoldings.isSip, true)
      ));
    
    const sipBookValue = sipHoldings.reduce((sum, h) => sum + parseFloat(h.currentValue || "0"), 0);

    // 4. Revenue MTD (Aggregate agentNetCommission for this month)
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const revenueData = await db
      .select({ commission: agentCommissions.agentNetCommission })
      .from(agentCommissions)
      .where(and(
        eq(agentCommissions.agentId, agentId),
        gte(agentCommissions.transactionDate, startOfMonth)
      ));

    const revenueMTD = revenueData.reduce((sum, r) => sum + parseFloat(r.commission || "0"), 0);

    // 5. Pending Actions: KYC Pending Count
    // Fixed: Now correctly queries clients with NULL or non-verified KYC status
    const kycPendingResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(and(
        inArray(users.id, clientIds),
        or(
          sql`${users.kycStatus} IS NULL`,
          sql`${users.kycStatus} != 'VERIFIED'`
        )
      ));

    const kycPendingCount = Number(kycPendingResult[0]?.count) || 0;

    // 6. Recent Client Activity (Aggregated from KYC audit logs)
    const activity = await db
      .select({
        clientId: kycRegulatoryAuditLogs.userId,
        clientName: users.fullName,
        action: kycRegulatoryAuditLogs.action,
        timestamp: kycRegulatoryAuditLogs.timestamp
      })
      .from(kycRegulatoryAuditLogs)
      .leftJoin(users, eq(kycRegulatoryAuditLogs.userId, users.id))
      .where(inArray(kycRegulatoryAuditLogs.userId, clientIds))
      .orderBy(desc(kycRegulatoryAuditLogs.timestamp))
      .limit(10);

    res.json({
      totalClients: clientIds.length,
      activeAUM,
      sipBookValue,
      portfolioHealth: 94.5, // Placeholder for health scoring algorithm
      revenueMTD,
      pendingActions: {
        kycPending: kycPendingCount,
        pendingOrders: 3, // Mocked for now
        driftAlerts: 5    // Mocked for now
      },
      clientActivity: activity
    });
  } catch (error) {
    console.error("[Agent Tracker] Error:", error);
    res.status(500).json({ error: "Failed to fetch agent tracker metrics" });
  }
});

export default router;
