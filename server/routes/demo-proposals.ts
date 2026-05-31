// @ts-nocheck
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
    etf: z.coerce.number().min(0).max(100).optional().default(0),
  }).refine(data => {
    const total = (data.equity || 0) + (data.debt || 0) + (data.gold || 0) + 
                  (data.realestate || 0) + (data.cash || 0) + (data.hybrid || 0) +
                  (data.index || 0) + (data.international || 0) + (data.us_markets || 0) +
                  (data.europe_markets || 0) + (data.asia_pacific_markets || 0) + 
                  (data.emerging_markets || 0) + (data.reit || 0) + (data.invit || 0) +
                  (data.bonds || 0) + (data.listed_stocks || 0) + (data.unlisted_stocks || 0) +
                  (data.etf || 0);
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
    customData: z.record(z.string(), z.any()).optional(),
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
      console.error("[Generate PDF] Validation failed:", JSON.stringify(validationResult.error.issues, null, 2));
      return res.status(400).json({ 
        error: "Invalid request data", 
        message: validationResult.error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join('; '),
        details: validationResult.error.issues 
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
        equity: (config.assetAllocation.equity || 0) + (config.assetAllocation.index || 0) + 
                (config.assetAllocation.listed_stocks || 0) + (config.assetAllocation.etf || 0) +
                (config.assetAllocation.hybrid || 0) + (config.assetAllocation.unlisted_stocks || 0) +
                (config.assetAllocation.us_markets || 0) + (config.assetAllocation.europe_markets || 0) +
                (config.assetAllocation.asia_pacific_markets || 0) + (config.assetAllocation.emerging_markets || 0) +
                (config.assetAllocation.international || 0),
        debt: (config.assetAllocation.debt || 0) + (config.assetAllocation.bonds || 0),
        gold: config.assetAllocation.gold || 0,
        realestate: (config.assetAllocation.reit || 0) + (config.assetAllocation.invit || 0),
        cash: (config.assetAllocation.cash || 0),
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
    
    const recommendationMap = [
      { key: 'equity', type: 'Equity MF', name: 'Diversified Equity Fund', investType: 'sip', reason: 'Equity allocation for growth' },
      { key: 'debt', type: 'Debt MF', name: 'Corporate Bond Fund', investType: 'lumpsum', reason: 'Debt allocation for stability' },
      { key: 'hybrid', type: 'Hybrid MF', name: 'Balanced Advantage Fund', investType: 'sip', reason: 'Hybrid allocation for balance' },
      { key: 'gold', type: 'Gold', name: 'Gold ETF', investType: 'lumpsum', reason: 'Gold allocation for hedge' },
      { key: 'index', type: 'Index Fund', name: 'Nifty 50 Index Fund', investType: 'sip', reason: 'Index allocation for passive growth' },
      { key: 'etf', type: 'ETF', name: 'Exchange Traded Fund', investType: 'lumpsum', reason: 'ETF allocation for diversification' },
      { key: 'us_markets', type: 'US Markets', name: 'US Equity Fund', investType: 'sip', reason: 'US market exposure' },
      { key: 'europe_markets', type: 'Europe', name: 'Europe Fund', investType: 'sip', reason: 'European market exposure' },
      { key: 'asia_pacific_markets', type: 'Asia-Pacific', name: 'Asia-Pacific Fund', investType: 'sip', reason: 'Asia-Pacific market exposure' },
      { key: 'emerging_markets', type: 'Emerging Markets', name: 'Emerging Markets Fund', investType: 'sip', reason: 'Emerging market exposure' },
      { key: 'reit', type: 'REIT', name: 'Real Estate Investment Trust', investType: 'lumpsum', reason: 'Real estate exposure' },
      { key: 'invit', type: 'InvIT', name: 'Infrastructure Investment Trust', investType: 'lumpsum', reason: 'Infrastructure exposure' },
      { key: 'bonds', type: 'Bonds', name: 'Direct Bond/NCD', investType: 'lumpsum', reason: 'Fixed income allocation' },
      { key: 'listed_stocks', type: 'Listed Stocks', name: 'Direct Equity', investType: 'lumpsum', reason: 'Direct equity exposure' },
      { key: 'unlisted_stocks', type: 'Unlisted', name: 'Pre-IPO Shares', investType: 'lumpsum', reason: 'Unlisted equity exposure' },
      { key: 'cash', type: 'Liquid', name: 'Liquid Fund', investType: 'lumpsum', reason: 'Liquidity allocation' },
    ];
    const recommendations = recommendationMap
      .filter(r => (config.assetAllocation[r.key] || 0) > 0)
      .map(r => ({
        productType: r.type,
        productName: r.name,
        recommendedAmount: targetAmount * ((config.assetAllocation[r.key] || 0) / 100),
        allocationPercentage: config.assetAllocation[r.key] || 0,
        investmentType: r.investType,
        selectionReason: r.reason,
      }));
    
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
        status: 'waiting_client_approval',
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
