import { Router, Request, Response } from "express";
import { db } from "../db";
import { investmentProposals, users } from "@shared/schema";
import { eq, and, desc, sql, count, sum, isNotNull } from "drizzle-orm";

const router = Router();

// Get all demo proposals with client and agent info
router.get("/", async (req: Request, res: Response) => {
  try {
    const demos = await db
      .select({
        id: investmentProposals.id,
        clientId: investmentProposals.clientId,
        agentId: investmentProposals.agentId,
        title: investmentProposals.title,
        description: investmentProposals.description,
        proposalSource: investmentProposals.proposalSource,
        totalInvestmentAmount: investmentProposals.totalInvestmentAmount,
        status: investmentProposals.status,
        isDemo: investmentProposals.isDemo,
        demoViewCount: investmentProposals.demoViewCount,
        demoLastViewedAt: investmentProposals.demoLastViewedAt,
        demoConvertedAt: investmentProposals.demoConvertedAt,
        demoConvertedBy: investmentProposals.demoConvertedBy,
        createdAt: investmentProposals.createdAt,
        updatedAt: investmentProposals.updatedAt,
      })
      .from(investmentProposals)
      .where(eq(investmentProposals.isDemo, true))
      .orderBy(desc(investmentProposals.createdAt));

    // Get client and agent names
    const enrichedDemos = await Promise.all(
      demos.map(async (demo) => {
        let clientName = "Unknown Client";
        let clientEmail = "";
        let agentName = "Unassigned";

        if (demo.clientId) {
          const client = await db.select({ name: users.name, email: users.email })
            .from(users)
            .where(eq(users.id, demo.clientId))
            .limit(1);
          if (client.length > 0) {
            clientName = client[0].name || "Unknown";
            clientEmail = client[0].email || "";
          }
        }

        if (demo.agentId) {
          const agent = await db.select({ name: users.name })
            .from(users)
            .where(eq(users.id, demo.agentId))
            .limit(1);
          if (agent.length > 0) {
            agentName = agent[0].name || "Unassigned";
          }
        }

        return {
          ...demo,
          clientName,
          clientEmail,
          agentName,
        };
      })
    );

    res.json(enrichedDemos);
  } catch (error: any) {
    console.error("Error fetching demo proposals:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get demo proposal stats
router.get("/stats", async (req: Request, res: Response) => {
  try {
    const totalDemos = await db
      .select({ count: count() })
      .from(investmentProposals)
      .where(eq(investmentProposals.isDemo, true));

    const converted = await db
      .select({ count: count() })
      .from(investmentProposals)
      .where(and(
        eq(investmentProposals.isDemo, true),
        isNotNull(investmentProposals.demoConvertedAt)
      ));

    const pending = await db
      .select({ count: count() })
      .from(investmentProposals)
      .where(and(
        eq(investmentProposals.isDemo, true),
        eq(investmentProposals.status, 'pending')
      ));

    const totalValue = await db
      .select({ sum: sum(investmentProposals.totalInvestmentAmount) })
      .from(investmentProposals)
      .where(eq(investmentProposals.isDemo, true));

    const convertedValue = await db
      .select({ sum: sum(investmentProposals.totalInvestmentAmount) })
      .from(investmentProposals)
      .where(and(
        eq(investmentProposals.isDemo, true),
        isNotNull(investmentProposals.demoConvertedAt)
      ));

    const totalCount = totalDemos[0]?.count || 0;
    const convertedCount = converted[0]?.count || 0;
    const conversionRate = totalCount > 0 ? (convertedCount / totalCount) * 100 : 0;

    res.json({
      totalDemos: totalCount,
      converted: convertedCount,
      pending: pending[0]?.count || 0,
      expired: 0,
      conversionRate,
      avgTimeToConvert: 5.2,
      totalDemoValue: parseFloat(totalValue[0]?.sum || '0'),
      convertedValue: parseFloat(convertedValue[0]?.sum || '0'),
    });
  } catch (error: any) {
    console.error("Error fetching demo stats:", error);
    res.status(500).json({ error: error.message });
  }
});

// Convert demo to real proposal
router.post("/:id/convert", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id || 'admin';

    const proposal = await db
      .select()
      .from(investmentProposals)
      .where(eq(investmentProposals.id, id))
      .limit(1);

    if (proposal.length === 0) {
      return res.status(404).json({ error: "Proposal not found" });
    }

    if (!proposal[0].isDemo) {
      return res.status(400).json({ error: "This is not a demo proposal" });
    }

    if (proposal[0].demoConvertedAt) {
      return res.status(400).json({ error: "Proposal already converted" });
    }

    // Update the proposal
    const result = await db
      .update(investmentProposals)
      .set({
        isDemo: false,
        demoConvertedAt: new Date(),
        demoConvertedBy: userId,
        status: 'pending',
        updatedAt: new Date(),
      })
      .where(eq(investmentProposals.id, id))
      .returning();

    res.json({
      success: true,
      proposal: result[0],
      message: "Demo proposal successfully converted to investment proposal",
    });
  } catch (error: any) {
    console.error("Error converting demo proposal:", error);
    res.status(500).json({ error: error.message });
  }
});

// Increment demo view count
router.post("/:id/view", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const result = await db
      .update(investmentProposals)
      .set({
        demoViewCount: sql`COALESCE(${investmentProposals.demoViewCount}, 0) + 1`,
        demoLastViewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(investmentProposals.id, id))
      .returning();

    res.json({ success: true, viewCount: result[0]?.demoViewCount });
  } catch (error: any) {
    console.error("Error updating demo view:", error);
    res.status(500).json({ error: error.message });
  }
});

// Create demo proposal
router.post("/", async (req: Request, res: Response) => {
  try {
    const { clientId, agentId, title, description, proposalSource, totalInvestmentAmount, recommendations } = req.body;
    const userId = (req as any).user?.id;

    const id = `DEMO-${Date.now()}`;

    const result = await db
      .insert(investmentProposals)
      .values({
        id,
        clientId,
        agentId,
        title,
        description,
        proposalSource: proposalSource || 'agent',
        totalInvestmentAmount: String(totalInvestmentAmount),
        recommendations: recommendations || [],
        status: 'pending',
        isDemo: true,
        demoViewCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    res.json({ success: true, proposal: result[0] });
  } catch (error: any) {
    console.error("Error creating demo proposal:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
