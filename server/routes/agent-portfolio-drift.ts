import { Router } from "express";
import { db } from "../db";
import { portfolios, portfolioHoldings, users, agentPortfolioOutcomes } from "@shared/schema";
import { eq, and, sql, inArray } from "drizzle-orm";

import { requireAgentPortal } from "../middleware/roleMiddleware";

const router = Router();

// Middleware is imported above
const requireAuth = requireAgentPortal;

const RISK_PROFILE_TARGETS: Record<string, Record<string, number>> = {
  aggressive: { equity: 80, debt: 10, gold: 5, real_estate: 3, alternatives: 2, cash: 0 },
  moderate: { equity: 60, debt: 25, gold: 8, real_estate: 5, alternatives: 2, cash: 0 },
  conservative: { equity: 30, debt: 55, gold: 8, real_estate: 5, alternatives: 2, cash: 0 },
  default: { equity: 60, debt: 30, gold: 5, real_estate: 3, alternatives: 2, cash: 0 },
};

function classifyAssetClass(holding: any): string {
  const type = (holding.assetType || "").toLowerCase();
  const productType = (holding.productType || "").toLowerCase();
  if (type === "gold" || type === "silver" || productType === "gold") return "gold";
  if (type === "real_estate" || type === "reit") return "real_estate";
  if (type === "debt" || type === "bond" || type === "fd" || productType === "bond") return "debt";
  if (type === "cash") return "cash";
  if (type === "aif" || type === "pms" || type === "alternative") return "alternatives";
  return "equity";
}

// GET /portfolio-drift
router.get("/portfolio-drift", requireAuth, async (req, res) => {
  try {
    const agentId = (req.user as any)?.id;

    // Get all clients for this agent
    const agentClients = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        riskCategory: users.riskTolerance,
      })
      .from(users)
      .where(sql`${users.agentId} = ${agentId} AND 'client' = ANY(${users.roles})`);

    if (agentClients.length === 0) {
      return res.json({ clients: [], summary: { highDrift: 0, avgDrift: 0, rebalancedThisMonth: 0 } });
    }

    const clientIds = agentClients.map((c) => c.id);
    const clientMap = new Map(agentClients.map((c) => [c.id, c]));

    // Get portfolios
    const allPortfolios = await db
      .select({ id: portfolios.id, userId: portfolios.userId, updatedAt: portfolios.updatedAt })
      .from(portfolios)
      .where(inArray(portfolios.userId, clientIds));

    const portfolioIds = allPortfolios.map((p) => p.id);
    const portfolioUserMap = new Map(allPortfolios.map((p) => [p.id, p.userId]));
    const portfolioUpdatedMap = new Map(allPortfolios.map((p) => [p.userId || "", p.updatedAt]));

    if (portfolioIds.length === 0) {
      return res.json({ clients: [], summary: { highDrift: 0, avgDrift: 0, rebalancedThisMonth: 0 } });
    }

    const holdings = await db
      .select({
        portfolioId: portfolioHoldings.portfolioId,
        assetType: portfolioHoldings.assetType,
        productType: portfolioHoldings.productType,
        currentValue: portfolioHoldings.currentValue,
      })
      .from(portfolioHoldings)
      .where(inArray(portfolioHoldings.portfolioId, portfolioIds));

    // Get agent portfolio outcomes for target allocations
    const outcomes = await db
      .select()
      .from(agentPortfolioOutcomes)
      .where(and(eq(agentPortfolioOutcomes.agentId, agentId), inArray(agentPortfolioOutcomes.clientId, clientIds)));
    const outcomeMap = new Map(outcomes.map((o) => [o.clientId, o]));

    // Group holdings by client
    const clientHoldingsMap = new Map<string, typeof holdings>();
    for (const h of holdings) {
      const userId = portfolioUserMap.get(h.portfolioId);
      if (!userId) continue;
      if (!clientHoldingsMap.has(userId)) clientHoldingsMap.set(userId, []);
      clientHoldingsMap.get(userId)!.push(h);
    }

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const result = [];

    for (const client of agentClients) {
      const clientHoldings = clientHoldingsMap.get(client.id) || [];
      const totalValue = clientHoldings.reduce((sum, h) => sum + parseFloat(String(h.currentValue || 0)), 0);

      if (totalValue === 0) continue;

      const currentAllocation: Record<string, number> = { equity: 0, debt: 0, gold: 0, real_estate: 0, alternatives: 0, cash: 0 };
      for (const h of clientHoldings) {
        const cls = classifyAssetClass(h);
        const val = parseFloat(String(h.currentValue || 0));
        currentAllocation[cls] = (currentAllocation[cls] || 0) + (val / totalValue) * 100;
      }

      const riskProfile = (client.riskCategory || "moderate").toLowerCase();
      const targetAllocation =
        RISK_PROFILE_TARGETS[riskProfile] || RISK_PROFILE_TARGETS.default;

      let driftScore = 0;
      for (const cls of Object.keys(targetAllocation)) {
        driftScore += Math.abs((currentAllocation[cls] || 0) - (targetAllocation[cls] || 0));
      }

      const lastRebalancedAt = portfolioUpdatedMap.get(client.id) || null;
      const rebalancedThisMonth = lastRebalancedAt && new Date(lastRebalancedAt) >= startOfMonth;

      result.push({
        clientId: client.id,
        clientName: `${client.firstName || ""} ${client.lastName || ""}`.trim(),
        riskProfile,
        currentAllocation: Object.fromEntries(
          Object.entries(currentAllocation).map(([k, v]) => [k, Math.round(v * 10) / 10])
        ),
        targetAllocation,
        driftScore: Math.round(driftScore * 10) / 10,
        lastRebalancedAt,
        rebalancedThisMonth: !!rebalancedThisMonth,
        totalValue,
      });
    }

    result.sort((a, b) => b.driftScore - a.driftScore);

    const highDrift = result.filter((r) => r.driftScore > 15).length;
    const avgDrift = result.length > 0 ? Math.round((result.reduce((s, r) => s + r.driftScore, 0) / result.length) * 10) / 10 : 0;
    const rebalancedThisMonth = result.filter((r) => r.rebalancedThisMonth).length;

    res.json({ clients: result, summary: { highDrift, avgDrift, rebalancedThisMonth } });
  } catch (err) {
    console.error("[Portfolio Drift] Error:", err);
    res.status(500).json({ error: "Failed to compute portfolio drift" });
  }
});

export default router;
