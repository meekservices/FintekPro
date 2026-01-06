import { Router, Request, Response } from "express";
import { db } from "../db";
import { investmentProposals, users, prospectProposals } from "@shared/schema";
import { eq, and, desc, sql, count, sum, isNotNull } from "drizzle-orm";
import { generateProposalPDF } from "../services/reports/proposal-pdf-renderer";
import { z } from "zod";
import { nanoid } from "nanoid";

const proposalConfigSchema = z.object({
  clientId: z.string().optional(),
  investmentGoals: z.object({
    primaryGoal: z.string(),
    investmentHorizon: z.string(),
    targetAmount: z.coerce.number().min(0),
    monthlyContribution: z.coerce.number().min(0),
  }),
  assetAllocation: z.object({
    equity: z.coerce.number().min(0).max(100),
    debt: z.coerce.number().min(0).max(100),
    gold: z.coerce.number().min(0).max(100),
    realestate: z.coerce.number().min(0).max(100),
    cash: z.coerce.number().min(0).max(100),
  }).refine(data => {
    const total = data.equity + data.debt + data.gold + data.realestate + data.cash;
    return total === 100;
  }, { message: "Asset allocation must total 100%" }),
  riskProfile: z.object({
    score: z.coerce.number().min(0).max(100),
    category: z.enum(['conservative', 'moderate', 'aggressive', 'very_aggressive']),
    tolerance: z.string(),
  }),
  sections: z.object({
    executiveSummary: z.boolean(),
    investmentRecommendations: z.boolean(),
    assetAllocationChart: z.boolean(),
    riskAssessment: z.boolean(),
    projectedReturns: z.boolean(),
    feeDisclosure: z.boolean(),
    termsConditions: z.boolean(),
  }),
  coverPage: z.object({
    enabled: z.boolean(),
    title: z.string(),
    clientName: z.string(),
    preparedBy: z.string(),
    date: z.string(),
  }),
  settings: z.object({
    orientation: z.enum(['portrait', 'landscape']),
    includeDisclaimer: z.boolean(),
    includeSEBIDisclosure: z.boolean(),
  }),
});

const generatePdfRequestSchema = z.object({
  config: proposalConfigSchema,
  clientId: z.union([z.number(), z.string()]).optional(),
  proposalName: z.string().optional(),
});

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

// Agent-specific routes
export const agentDemoRouter = Router();

// Get agent's demo proposals
agentDemoRouter.get("/", async (req: Request, res: Response) => {
  try {
    const agentId = (req as any).user?.id;
    
    if (!agentId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

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
      .where(and(
        eq(investmentProposals.isDemo, true),
        eq(investmentProposals.agentId, agentId)
      ))
      .orderBy(desc(investmentProposals.createdAt));

    // Enrich with client names
    const enrichedDemos = await Promise.all(
      demos.map(async (demo) => {
        let clientName = "Unknown Client";
        let clientEmail = "";

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

        return {
          ...demo,
          clientName,
          clientEmail,
          agentName: "You",
        };
      })
    );

    res.json(enrichedDemos);
  } catch (error: any) {
    console.error("Error fetching agent demo proposals:", error);
    res.status(500).json({ error: error.message });
  }
});

// Get agent's demo stats
agentDemoRouter.get("/stats", async (req: Request, res: Response) => {
  try {
    const agentId = (req as any).user?.id;
    
    if (!agentId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const totalDemos = await db
      .select({ count: count() })
      .from(investmentProposals)
      .where(and(
        eq(investmentProposals.isDemo, true),
        eq(investmentProposals.agentId, agentId)
      ));

    const converted = await db
      .select({ count: count() })
      .from(investmentProposals)
      .where(and(
        eq(investmentProposals.isDemo, true),
        eq(investmentProposals.agentId, agentId),
        isNotNull(investmentProposals.demoConvertedAt)
      ));

    const pending = await db
      .select({ count: count() })
      .from(investmentProposals)
      .where(and(
        eq(investmentProposals.isDemo, true),
        eq(investmentProposals.agentId, agentId),
        eq(investmentProposals.status, 'pending')
      ));

    const totalValue = await db
      .select({ sum: sum(investmentProposals.totalInvestmentAmount) })
      .from(investmentProposals)
      .where(and(
        eq(investmentProposals.isDemo, true),
        eq(investmentProposals.agentId, agentId)
      ));

    const convertedValue = await db
      .select({ sum: sum(investmentProposals.totalInvestmentAmount) })
      .from(investmentProposals)
      .where(and(
        eq(investmentProposals.isDemo, true),
        eq(investmentProposals.agentId, agentId),
        isNotNull(investmentProposals.demoConvertedAt)
      ));

    const totalCount = totalDemos[0]?.count || 0;
    const convertedCount = converted[0]?.count || 0;
    const conversionRate = totalCount > 0 ? (convertedCount / totalCount) * 100 : 0;

    res.json({
      totalDemos: totalCount,
      converted: convertedCount,
      pending: pending[0]?.count || 0,
      conversionRate,
      avgTimeToConvert: 4.5,
      totalDemoValue: parseFloat(totalValue[0]?.sum || '0'),
      convertedValue: parseFloat(convertedValue[0]?.sum || '0'),
    });
  } catch (error: any) {
    console.error("Error fetching agent demo stats:", error);
    res.status(500).json({ error: error.message });
  }
});

// Generate proposal PDF
agentDemoRouter.post("/generate-pdf", async (req: Request, res: Response) => {
  try {
    const agentId = (req as any).user?.id;
    
    if (!agentId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Validate request body
    const validationResult = generatePdfRequestSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ 
        error: "Invalid request data", 
        details: validationResult.error.errors 
      });
    }

    const { config, clientId, proposalName } = validationResult.data;

    // Get client data
    let clientData = { fullName: 'Valued Client', email: '' };
    if (clientId) {
      const client = await db
        .select({ 
          firstName: users.firstName, 
          lastName: users.lastName, 
          email: users.email 
        })
        .from(users)
        .where(eq(users.id, String(clientId)))
        .limit(1);
      if (client.length > 0) {
        const fullName = [client[0].firstName, client[0].lastName]
          .filter(Boolean)
          .join(' ') || 'Valued Client';
        clientData = {
          fullName,
          email: client[0].email || '',
        };
      }
    }

    // Generate PDF
    const pdfBuffer = await generateProposalPDF(config, clientData);
    
    // Convert to base64 data URL
    const base64 = pdfBuffer.toString('base64');
    const pdfUrl = `data:application/pdf;base64,${base64}`;

    // Create proposal record in prospect_proposals for display in proposals list
    const shareToken = nanoid(12);
    const referralCode = `REF-${nanoid(8)}`;
    const targetAmount = Number(config.investmentGoals.targetAmount) || 0;
    
    // Get agent info
    const agentInfo = await db
      .select({ firstName: users.firstName, lastName: users.lastName, email: users.email, mobile: users.mobile })
      .from(users)
      .where(eq(users.id, agentId))
      .limit(1);
    
    const agentData = agentInfo[0];
    const agentName = agentData ? [agentData.firstName, agentData.lastName].filter(Boolean).join(' ') || 'Agent' : 'Agent';
    const agent = { name: agentName, email: agentData?.email || '', mobile: agentData?.mobile || '' };
    
    // Build recommendations array from config
    const recommendations = [
      { productType: 'Equity', productName: 'Diversified Equity Fund', recommendedAmount: targetAmount * (config.assetAllocation.equity / 100), allocationPercentage: config.assetAllocation.equity, investmentType: 'sip', selectionReason: 'Equity allocation for growth' },
      { productType: 'Debt', productName: 'Corporate Bond Fund', recommendedAmount: targetAmount * (config.assetAllocation.debt / 100), allocationPercentage: config.assetAllocation.debt, investmentType: 'lumpsum', selectionReason: 'Debt allocation for stability' },
      { productType: 'Gold', productName: 'Gold ETF', recommendedAmount: targetAmount * (config.assetAllocation.gold / 100), allocationPercentage: config.assetAllocation.gold, investmentType: 'lumpsum', selectionReason: 'Gold allocation for hedge' },
    ].filter(r => r.allocationPercentage > 0);
    
    const proposalTitle = proposalName || `Investment Proposal - ${clientData.fullName}`;
    
    const [proposal] = await db.insert(prospectProposals).values({
      shareToken,
      agentId,
      agentName: agent.name,
      agentEmail: agent.email || undefined,
      agentMobile: agent.mobile || undefined,
      prospectName: clientData.fullName,
      prospectEmail: clientData.email || undefined,
      proposalType: 'fresh_investment',
      proposalTitle,
      executiveSummary: `Personalized investment strategy for ${config.investmentGoals.primaryGoal} with ${config.riskProfile.category} risk profile.`,
      recommendations,
      totalInvestmentAmount: targetAmount.toFixed(2),
      projectedReturns: '12.00',
      projectedValue: (targetAmount * 1.5).toFixed(2),
      targetAllocation: config.assetAllocation,
      investmentGoals: config.investmentGoals,
      referralCode,
      status: 'draft',
      viewCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();

    res.json({ 
      success: true, 
      pdfUrl,
      proposalId: proposal.id,
      shareToken: proposal.shareToken,
      message: 'Proposal PDF generated successfully'
    });
  } catch (error: any) {
    console.error("Error generating proposal PDF:", error);
    res.status(500).json({ error: error.message || 'Failed to generate proposal' });
  }
});

// Agent convert demo to real proposal
agentDemoRouter.post("/:id/convert", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const agentId = (req as any).user?.id;

    if (!agentId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const proposal = await db
      .select()
      .from(investmentProposals)
      .where(and(
        eq(investmentProposals.id, id),
        eq(investmentProposals.agentId, agentId)
      ))
      .limit(1);

    if (proposal.length === 0) {
      return res.status(404).json({ error: "Proposal not found or not yours" });
    }

    if (!proposal[0].isDemo) {
      return res.status(400).json({ error: "This is not a demo proposal" });
    }

    if (proposal[0].demoConvertedAt) {
      return res.status(400).json({ error: "Proposal already converted" });
    }

    const result = await db
      .update(investmentProposals)
      .set({
        isDemo: false,
        demoConvertedAt: new Date(),
        demoConvertedBy: agentId,
        status: 'pending',
        updatedAt: new Date(),
      })
      .where(eq(investmentProposals.id, id))
      .returning();

    res.json({
      success: true,
      proposal: result[0],
      message: "Demo proposal converted successfully",
    });
  } catch (error: any) {
    console.error("Error converting agent demo proposal:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
