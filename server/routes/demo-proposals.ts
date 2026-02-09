import { Router, Request, Response } from "express";
import { db } from "../db";
import { investmentProposals, users, prospectProposals } from "@shared/schema";
import { eq, and, desc, sql, count, sum, isNotNull } from "drizzle-orm";
import { generateProposalPDF } from "../services/reports/proposal-pdf-renderer";
import { generateRegulatorGradePdf, ProposalPdfConfig } from "../services/reports/regulator-grade-pdf-renderer";
import { proposalAuditService } from "../services/proposal-audit-service";
import { z } from "zod";
import { nanoid } from "nanoid";

const proposalConfigSchema = z.object({
  clientId: z.string().optional(),
  investmentGoals: z.object({
    primaryGoal: z.string(),
    investmentHorizon: z.string().optional().default('5-10 years'),
    targetAmount: z.coerce.number().min(0),
    monthlyContribution: z.coerce.number().min(0).optional().default(0),
    expectedReturn: z.coerce.number().optional(),
  }),
  assetAllocation: z.object({
    equity: z.coerce.number().min(0).max(100),
    debt: z.coerce.number().min(0).max(100),
    gold: z.coerce.number().min(0).max(100),
    realestate: z.coerce.number().min(0).max(100).optional().default(0),
    cash: z.coerce.number().min(0).max(100),
    hybrid: z.coerce.number().min(0).max(100).optional().default(0),
    index: z.coerce.number().min(0).max(100).optional().default(0),
    international: z.coerce.number().min(0).max(100).optional().default(0),
    us_markets: z.coerce.number().min(0).max(100).optional().default(0),
    europe_markets: z.coerce.number().min(0).max(100).optional().default(0),
    asia_pacific_markets: z.coerce.number().min(0).max(100).optional().default(0),
    emerging_markets: z.coerce.number().min(0).max(100).optional().default(0),
    reit: z.coerce.number().min(0).max(100).optional().default(0),
    invit: z.coerce.number().min(0).max(100).optional().default(0),
    bonds: z.coerce.number().min(0).max(100).optional().default(0),
    listed_stocks: z.coerce.number().min(0).max(100).optional().default(0),
    unlisted_stocks: z.coerce.number().min(0).max(100).optional().default(0),
  }).refine(data => {
    const total = (data.equity || 0) + (data.debt || 0) + (data.gold || 0) + 
                  (data.realestate || 0) + (data.cash || 0) + (data.hybrid || 0) +
                  (data.index || 0) + (data.international || 0) + (data.us_markets || 0) +
                  (data.europe_markets || 0) + (data.asia_pacific_markets || 0) + 
                  (data.emerging_markets || 0) + (data.reit || 0) + (data.invit || 0) +
                  (data.bonds || 0) + (data.listed_stocks || 0) + (data.unlisted_stocks || 0);
    return total === 100;
  }, { message: "Asset allocation must total 100%" }),
  riskProfile: z.object({
    score: z.coerce.number().min(0).max(100),
    category: z.enum(['conservative', 'moderate', 'aggressive', 'very_aggressive']),
    tolerance: z.string().optional().default('Moderate risk tolerance'),
    description: z.string().optional(),
  }),
  sections: z.object({
    coverPage: z.boolean().optional().default(true),
    tableOfContents: z.boolean().optional().default(true),
    executiveSummary: z.boolean().optional().default(true),
    portfolioOverview: z.boolean().optional().default(false),
    productRecommendations: z.boolean().optional().default(true),
    capitalGainsSummary: z.boolean().optional().default(false),
    exitLoadSummary: z.boolean().optional().default(false),
    taxImpactSummary: z.boolean().optional().default(false),
    rebalancingSipRecommendations: z.boolean().optional().default(false),
    portfolioHealthScore: z.boolean().optional().default(false),
    expenseRatioAnalysis: z.boolean().optional().default(false),
    riskHeatMap: z.boolean().optional().default(false),
    benchmarkComparison: z.boolean().optional().default(false),
    whatIfScenarios: z.boolean().optional().default(false),
    dividendProjection: z.boolean().optional().default(false),
    priorityRecommendations: z.boolean().optional().default(false),
    portfolioGrowthProjection: z.boolean().optional().default(false),
    mandatoryDisclaimers: z.boolean().optional().default(true),
    advisorDeclaration: z.boolean().optional().default(true),
  }),
  sectionCustomizations: z.record(z.object({
    customNotes: z.string().optional(),
    overrideTitle: z.string().optional(),
    showInToc: z.boolean().optional(),
    customData: z.record(z.any()).optional(),
  })).optional().default({}),
  coverPage: z.object({
    enabled: z.boolean().optional().default(true),
    title: z.string().optional().default('Investment Proposal'),
    clientName: z.string().optional().default(''),
    preparedBy: z.string().optional().default('FintekPro Financial Advisor'),
    date: z.string().optional().transform(v => v || new Date().toLocaleDateString('en-IN')),
    companyName: z.string().optional(),
  }),
  settings: z.object({
    orientation: z.enum(['portrait', 'landscape']).optional().default('portrait'),
    includeDisclaimer: z.boolean().optional().default(true),
    includeSEBIDisclosure: z.boolean().optional().default(true),
  }).optional().default({}),
});

const fundingSummarySchema = z.object({
  totalSellAmount: z.number(),
  rebalancingBuyAmount: z.number(),
  freshInvestmentAmount: z.number(),
  remainingSellProceeds: z.number(),
  totalDeployableAmount: z.number(),
}).optional();

const detailedRecommendationSchema = z.object({
  action: z.string(),
  productName: z.string(),
  suggestedAmount: z.number(),
  fundedBy: z.string().optional(),
  fundMetrics: z.object({
    amc: z.string().optional(),
    category: z.string().optional(),
    returns1Y: z.union([z.number(), z.string()]).optional(),
    returns3Y: z.union([z.number(), z.string()]).optional(),
    returns5Y: z.union([z.number(), z.string()]).optional(),
    risk: z.string().optional(),
    expenseRatio: z.union([z.number(), z.string()]).optional(),
    aum: z.union([z.number(), z.string()]).optional(),
  }).optional(),
  rationale: z.string().optional(),
  selectionReason: z.string().optional(),
}).optional();

const generatePdfRequestSchema = z.object({
  config: proposalConfigSchema,
  clientId: z.union([z.number(), z.string()]).optional(),
  proposalName: z.string().optional(),
  fundingSummary: fundingSummarySchema,
  detailedRecommendations: z.array(detailedRecommendationSchema).optional(),
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
      console.error("[Generate PDF] Validation failed:", JSON.stringify(validationResult.error.errors, null, 2));
      return res.status(400).json({ 
        error: "Invalid request data", 
        message: validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; '),
        details: validationResult.error.errors 
      });
    }

    const { config, clientId, proposalName, fundingSummary, detailedRecommendations } = validationResult.data;

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

    // Build regulator-grade PDF config
    const regulatorPdfConfig: Partial<ProposalPdfConfig> = {
      proposalId: nanoid(12),
      version: 'v1.0',
      client: {
        name: clientData.fullName,
        email: clientData.email,
      },
      advisor: {
        name: config.coverPage.preparedBy,
      },
      investmentGoals: config.investmentGoals,
      riskProfile: config.riskProfile,
      proposedAllocation: {
        equity: config.assetAllocation.equity,
        debt: config.assetAllocation.debt,
        gold: config.assetAllocation.gold,
        realestate: config.assetAllocation.realestate || 0,
        cash: config.assetAllocation.cash,
        totalValue: config.investmentGoals.targetAmount,
      },
      sections: config.sections as ProposalPdfConfig['sections'],
      sectionCustomizations: config.sectionCustomizations,
      settings: {
        orientation: config.settings.orientation,
      },
    };

    // Generate regulator-grade PDF with customizations
    const pdfResult = await generateRegulatorGradePdf(regulatorPdfConfig as ProposalPdfConfig);
    const pdfBuffer = pdfResult.pdfBuffer;
    
    // Log audit event for PDF generation with customizations
    try {
      await proposalAuditService.logEvent({
        proposalId: regulatorPdfConfig.proposalId!,
        eventType: 'PDF_GENERATED',
        eventAction: 'CREATED',
        actorId: agentId,
        actorRole: 'agent',
        payloadAfter: {
          version: pdfResult.version,
          hash: pdfResult.hash,
          sectionsIncluded: pdfResult.sectionsIncluded,
          totalPages: pdfResult.totalPages,
          sectionCustomizations: Object.keys(config.sectionCustomizations || {}).length > 0 
            ? config.sectionCustomizations 
            : undefined,
        },
      });
    } catch (auditError) {
      console.error('Failed to log audit event:', auditError);
    }
    
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
