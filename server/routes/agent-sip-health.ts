import { Router } from "express";
import { db } from "../db";
import { comprehensiveHoldings, portfolios, portfolioHoldings, users } from "@shared/schema";
import { eq, and, sql, inArray, or } from "drizzle-orm";

const router = Router();

const requireAuth = (req: any, res: any, next: any) => {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
};

function deriveSipStatus(holding: any): "active" | "expiring" | "lapsed" | "paused" {
  const now = new Date();
  const meta = holding.metadata as any;

  if (meta?.mandateEndDate) {
    const mandateEnd = new Date(meta.mandateEndDate);
    const daysToEnd = Math.floor((mandateEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (daysToEnd < 0) return "lapsed";
    if (daysToEnd <= 30) return "expiring";
  }

  if (meta?.sipStatus) {
    const s = String(meta.sipStatus).toLowerCase();
    if (s.includes("laps") || s.includes("stop")) return "lapsed";
    if (s.includes("paus") || s.includes("hold")) return "paused";
    if (s.includes("expir")) return "expiring";
  }

  const lastUpdated = holding.lastUpdated || holding.createdAt;
  if (lastUpdated) {
    const daysSinceUpdate = Math.floor((now.getTime() - new Date(lastUpdated).getTime()) / (1000 * 60 * 60 * 24));
    const freq = (holding.contributionFrequency || meta?.frequency || "monthly").toLowerCase();
    const expectedDays = freq.includes("week") ? 10 : freq.includes("quarter") ? 95 : freq.includes("year") ? 370 : 45;
    if (daysSinceUpdate > expectedDays * 1.5) return "lapsed";
  }

  return "active";
}

// GET /api/agent/sip-health
router.get("/api/agent/sip-health", requireAuth, async (req, res) => {
  try {
    const agentId = (req.user as any)?.id;

    // Fetch all clients assigned to this agent
    const agentClients = await db
      .select({ id: users.id, firstName: users.firstName, lastName: users.lastName, mobile: users.mobile })
      .from(users)
      .where(sql`${users.agentId} = ${agentId} AND 'client' = ANY(${users.roles})`);

    if (agentClients.length === 0) {
      return res.json({
        summary: { totalActive: 0, expiringIn30d: 0, lapsed: 0, totalMonthlySipAmount: 0 },
        items: [],
      });
    }

    const clientIds = agentClients.map((c) => c.id);
    const clientMap = new Map(agentClients.map((c) => [c.id, c]));

    // Query comprehensive_holdings for MF/SIP type
    const compHoldings = await db
      .select()
      .from(comprehensiveHoldings)
      .where(
        and(
          inArray(comprehensiveHoldings.userId, clientIds),
          or(
            sql`${comprehensiveHoldings.assetType} ILIKE 'mutual_fund'`,
            sql`${comprehensiveHoldings.contributionFrequency} IS NOT NULL`
          )
        )
      )
      .limit(500);

    // Also query portfolio_holdings for MF type
    const clientPortfolios = await db
      .select({ id: portfolios.id, userId: portfolios.userId })
      .from(portfolios)
      .where(inArray(portfolios.userId, clientIds));

    const portfolioIds = clientPortfolios.map((p) => p.id);
    const portfolioUserMap = new Map(clientPortfolios.map((p) => [p.id, p.userId]));

    const pfHoldings =
      portfolioIds.length > 0
        ? await db
            .select()
            .from(portfolioHoldings)
            .where(
              and(
                inArray(portfolioHoldings.portfolioId, portfolioIds),
                sql`${portfolioHoldings.assetType} ILIKE 'mf' OR ${portfolioHoldings.assetType} ILIKE 'mutual_fund'`
              )
            )
            .limit(500)
        : [];

    const items: any[] = [];

    for (const h of compHoldings) {
      const client = clientMap.get(h.userId || "");
      if (!client) continue;
      const status = deriveSipStatus(h);
      const meta = h.metadata as any;
      const sipAmount = parseFloat(String(meta?.sipAmount || meta?.amount || 0));
      const freq = h.contributionFrequency || meta?.frequency || "Monthly";
      items.push({
        id: h.id,
        clientId: h.userId,
        clientName: `${client.firstName || ""} ${client.lastName || ""}`.trim(),
        clientPhone: client.mobile,
        fundName: h.assetName,
        isin: h.isin,
        folio: h.folio,
        sipAmount,
        frequency: freq,
        status,
        lastDebitDate: h.lastUpdated || h.createdAt,
        nextDebitDate: meta?.nextDebitDate || null,
        marketValue: parseFloat(String(h.marketValue || 0)),
        source: "comprehensive",
      });
    }

    for (const h of pfHoldings) {
      const userId = portfolioUserMap.get(h.portfolioId);
      const client = userId ? clientMap.get(userId) : undefined;
      if (!client) continue;
      const status = deriveSipStatus(h);
      const sipAmount = parseFloat(String((h as any).sipAmount || 0));
      items.push({
        id: h.id,
        clientId: userId,
        clientName: `${client.firstName || ""} ${client.lastName || ""}`.trim(),
        clientPhone: client.mobile,
        fundName: h.name || h.symbol || "Unknown Fund",
        isin: h.isin,
        folio: h.folioNumber,
        sipAmount,
        frequency: "Monthly",
        status,
        lastDebitDate: h.updatedAt,
        nextDebitDate: null,
        marketValue: parseFloat(String(h.currentValue || 0)),
        source: "portfolio",
      });
    }

    const now = new Date();
    const summary = {
      totalActive: items.filter((i) => i.status === "active").length,
      expiringIn30d: items.filter((i) => i.status === "expiring").length,
      lapsed: items.filter((i) => i.status === "lapsed").length,
      totalMonthlySipAmount: items
        .filter((i) => i.status === "active" && i.frequency?.toLowerCase().includes("month"))
        .reduce((sum, i) => sum + (i.sipAmount || 0), 0),
    };

    // Sort by urgency: lapsed first, expiring, paused, active
    const urgencyOrder = { lapsed: 0, expiring: 1, paused: 2, active: 3 };
    items.sort((a, b) => (urgencyOrder[a.status as keyof typeof urgencyOrder] ?? 3) - (urgencyOrder[b.status as keyof typeof urgencyOrder] ?? 3));

    res.json({ summary, items });
  } catch (err) {
    console.error("[SIP Health] Error:", err);
    res.status(500).json({ error: "Failed to fetch SIP health data" });
  }
});

export default router;
