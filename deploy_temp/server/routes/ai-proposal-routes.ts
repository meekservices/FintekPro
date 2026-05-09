import { Router } from "express";
import { aiProposalEngine } from "../services/ai-proposal-engine";
import { db } from "../db";
import { aiProposals, aiProposalItems, portfolioDiagnostics, aiAuditLogs, clientRiskProfiles } from "@shared/schema";
import { eq, desc, and } from "drizzle-orm";
import { z } from "zod";
import { requireClientOrHigher, requireAgent, requireAdmin } from "../middleware/auth";

const router = Router();

router.use(requireClientOrHigher);

const updateRiskProfileSchema = z.object({
  riskCategory: z.enum(["conservative", "moderate", "aggressive"]).optional(),
  riskScore: z.number().min(1).max(10).optional(),
  timeHorizonYears: z.number().min(1).max(50).optional(),
  liquidityNeed: z.enum(["low", "medium", "high"]).optional(),
  taxBracket: z.string().optional(),
  investmentObjectives: z.array(z.string()).optional(),
  productRestrictions: z.array(z.string()).optional(),
  maxEquityExposure: z.number().min(0).max(100).optional(),
  maxSingleStockExposure: z.number().min(0).max(100).optional(),
  maxSingleAmcExposure: z.number().min(0).max(100).optional(),
});

const updateProposalItemSchema = z.object({
  amount: z.number().positive().optional(),
  status: z.enum(["pending", "approved", "rejected", "modified", "removed"]).optional(),
  agentModificationReason: z.string().optional(),
});

router.get("/risk-profile", async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const profile = await aiProposalEngine.getOrCreateRiskProfile(userId);
    if (!profile) {
      return res.status(404).json({ error: "Could not get risk profile" });
    }

    res.json(profile);
  } catch (error: any) {
    console.error("Error fetching risk profile:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/risk-profile/:userId", requireAgent, async (req, res) => {
  try {
    const { userId } = req.params;
    const profile = await aiProposalEngine.getOrCreateRiskProfile(userId);
    if (!profile) {
      return res.status(404).json({ error: "Could not get risk profile" });
    }

    res.json(profile);
  } catch (error: any) {
    console.error("Error fetching risk profile:", error);
    res.status(500).json({ error: error.message });
  }
});

router.put("/risk-profile", async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const validated = updateRiskProfileSchema.parse(req.body);
    
    const [existing] = await db.select().from(clientRiskProfiles).where(eq(clientRiskProfiles.userId, userId)).limit(1);
    
    if (!existing) {
      const [created] = await db.insert(clientRiskProfiles).values({
        userId,
        ...validated,
        investmentObjectives: validated.investmentObjectives || [],
        productRestrictions: validated.productRestrictions || [],
      }).returning();
      return res.json(created);
    }

    const [updated] = await db.update(clientRiskProfiles).set({
      ...validated,
      lastAssessedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(clientRiskProfiles.userId, userId)).returning();

    res.json(updated);
  } catch (error: any) {
    console.error("Error updating risk profile:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/diagnostics", async (req, res) => {
  try {
    const requestingUser = (req as any).user;
    let userId: string;
    if (req.body.userId && ['agent', 'partner', 'admin', 'superadmin'].some((r: string) => (requestingUser?.roles || [requestingUser?.role]).includes(r))) {
      userId = req.body.userId;
    } else {
      userId = requestingUser?.id;
    }
    if (!userId) {
      return res.status(401).json({ error: "User ID required" });
    }

    const diagnostics = await aiProposalEngine.runPortfolioDiagnostics(userId);
    res.json(diagnostics);
  } catch (error: any) {
    console.error("Error running diagnostics:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/diagnostics/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const diagnostics = await aiProposalEngine.getDiagnostics(id);
    
    if (!diagnostics) {
      return res.status(404).json({ error: "Diagnostics not found" });
    }

    res.json(diagnostics);
  } catch (error: any) {
    console.error("Error fetching diagnostics:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/diagnostics/latest/:userId", requireAgent, async (req, res) => {
  try {
    const { userId } = req.params;
    const diagnostics = await aiProposalEngine.getLatestDiagnostics(userId);
    
    if (!diagnostics) {
      return res.status(404).json({ error: "No diagnostics found for user" });
    }

    res.json(diagnostics);
  } catch (error: any) {
    console.error("Error fetching latest diagnostics:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/generate", requireAgent, async (req, res) => {
  try {
    const { clientId, diagnosticsId, title } = req.body;
    const agentId = (req as any).user?.id;

    if (!clientId) {
      return res.status(400).json({ error: "Client ID is required" });
    }

    let diagId = diagnosticsId;
    if (!diagId) {
      const diagnostics = await aiProposalEngine.runPortfolioDiagnostics(clientId);
      diagId = diagnostics.id;
    }

    const recommendations = await aiProposalEngine.generateRecommendations(clientId, diagId);
    
    if (recommendations.length === 0) {
      return res.json({
        message: "No recommendations needed - your portfolio is well balanced",
        diagnosticsId: diagId,
        recommendations: [],
      });
    }

    const result = await aiProposalEngine.createProposal(
      clientId,
      agentId || null,
      diagId,
      recommendations,
      title
    );

    res.json({
      proposal: result.proposal,
      items: result.items,
      diagnosticsId: diagId,
    });
  } catch (error: any) {
    console.error("Error generating proposal:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/proposals", async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    const { role } = req.query;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    let proposals;
    if (role === "agent") {
      proposals = await aiProposalEngine.getAgentProposals(userId);
    } else {
      proposals = await aiProposalEngine.getClientProposals(userId);
    }

    res.json(proposals);
  } catch (error: any) {
    console.error("Error fetching proposals:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/proposals/client/:clientId", requireAgent, async (req, res) => {
  try {
    const { clientId } = req.params;
    const proposals = await aiProposalEngine.getClientProposals(clientId);
    res.json(proposals);
  } catch (error: any) {
    console.error("Error fetching client proposals:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/proposals/agent/:agentId", requireAgent, async (req, res) => {
  try {
    const { agentId } = req.params;
    const requestingUser = (req as any).user;
    const isAdmin = ['admin', 'superadmin'].some((r: string) => (requestingUser?.roles || [requestingUser?.role]).includes(r));
    if (!isAdmin && requestingUser?.id !== agentId) {
      return res.status(403).json({ error: "Access denied" });
    }
    const proposals = await aiProposalEngine.getAgentProposals(agentId);
    res.json(proposals);
  } catch (error: any) {
    console.error("Error fetching agent proposals:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/proposals/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await aiProposalEngine.getProposal(id);
    
    if (!result) {
      return res.status(404).json({ error: "Proposal not found" });
    }

    res.json(result);
  } catch (error: any) {
    console.error("Error fetching proposal:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/proposals/:id/submit", requireAgent, async (req, res) => {
  try {
    const { id } = req.params;
    const agentId = (req as any).user?.id;

    if (!agentId) {
      return res.status(401).json({ error: "Agent ID required" });
    }

    const proposal = await aiProposalEngine.submitProposalToClient(id, agentId);
    res.json(proposal);
  } catch (error: any) {
    console.error("Error submitting proposal:", error);
    res.status(500).json({ error: error.message });
  }
});

router.put("/proposals/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;
    const actorId = (req as any).user?.id;
    const requestingUser = (req as any).user;
    const roles: string[] = requestingUser?.roles || (requestingUser?.role ? [requestingUser.role] : []);
    const actorRole = roles.includes('admin') || roles.includes('superadmin') ? 'agent'
      : roles.some((r: string) => ['agent', 'partner'].includes(r)) ? 'agent'
      : 'client';

    if (!actorId) {
      return res.status(401).json({ error: "Actor ID required" });
    }

    const proposal = await aiProposalEngine.updateProposalStatus(id, status, actorId, actorRole, notes);
    res.json(proposal);
  } catch (error: any) {
    console.error("Error updating proposal status:", error);
    res.status(500).json({ error: error.message });
  }
});

router.put("/items/:id", requireAgent, async (req, res) => {
  try {
    const { id } = req.params;
    const actorId = (req as any).user?.id;

    if (!actorId) {
      return res.status(401).json({ error: "Actor ID required" });
    }

    const validated = updateProposalItemSchema.parse(req.body);
    const item = await aiProposalEngine.updateProposalItem(id, validated, actorId, "agent");
    res.json(item);
  } catch (error: any) {
    console.error("Error updating proposal item:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/items/:id/approve", async (req, res) => {
  try {
    const { id } = req.params;
    const clientId = (req as any).user?.id;

    if (!clientId) {
      return res.status(401).json({ error: "Client ID required" });
    }

    const item = await aiProposalEngine.clientApproveItem(id, clientId);
    res.json(item);
  } catch (error: any) {
    console.error("Error approving item:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/items/:id/reject", async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const clientId = (req as any).user?.id;

    if (!clientId) {
      return res.status(401).json({ error: "Client ID required" });
    }

    const item = await aiProposalEngine.clientRejectItem(id, clientId, reason);
    res.json(item);
  } catch (error: any) {
    console.error("Error rejecting item:", error);
    res.status(500).json({ error: error.message });
  }
});

router.post("/proposals/:id/finalize", async (req, res) => {
  try {
    const { id } = req.params;
    const clientId = (req as any).user?.id;

    if (!clientId) {
      return res.status(401).json({ error: "Client ID required" });
    }

    const proposal = await aiProposalEngine.finalizeProposalApproval(id, clientId);
    res.json(proposal);
  } catch (error: any) {
    console.error("Error finalizing proposal:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/proposals/:id/audit", requireAgent, async (req, res) => {
  try {
    const { id } = req.params;
    const logs = await aiProposalEngine.getAuditLogs(id);
    res.json(logs);
  } catch (error: any) {
    console.error("Error fetching audit logs:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/all-proposals", requireAdmin, async (req, res) => {
  try {
    const { status, limit = 50, offset = 0 } = req.query;
    
    let query = db.select().from(aiProposals);
    
    if (status) {
      query = query.where(eq(aiProposals.status, status as string)) as any;
    }
    
    const proposals = await query.orderBy(desc(aiProposals.createdAt)).limit(Number(limit)).offset(Number(offset));
    
    res.json(proposals);
  } catch (error: any) {
    console.error("Error fetching all proposals:", error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/stats", requireAdmin, async (req, res) => {
  try {
    const userId = req.query.userId as string | undefined;

    const [diagnosticsRows, proposalsRows] = await Promise.all([
      userId
        ? db.select({ healthScore: portfolioDiagnostics.healthScore })
            .from(portfolioDiagnostics)
            .where(eq(portfolioDiagnostics.userId, userId))
        : db.select({ healthScore: portfolioDiagnostics.healthScore })
            .from(portfolioDiagnostics),
      userId
        ? db.select({ status: aiProposals.status })
            .from(aiProposals)
            .where(eq(aiProposals.clientId, userId))
        : db.select({ status: aiProposals.status })
            .from(aiProposals),
    ]);

    const proposalsByStatus: Record<string, number> = {};
    for (const p of proposalsRows) {
      proposalsByStatus[p.status] = (proposalsByStatus[p.status] || 0) + 1;
    }

    const avgHealthScore = diagnosticsRows.length > 0
      ? Math.round(diagnosticsRows.reduce((sum, d) => sum + (d.healthScore || 0), 0) / diagnosticsRows.length)
      : 0;

    res.json({
      totalDiagnostics: diagnosticsRows.length,
      totalProposals: proposalsRows.length,
      proposalsByStatus,
      avgHealthScore,
    });
  } catch (error: any) {
    console.error("Error fetching stats:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
