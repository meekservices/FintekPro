import { Router, Request, Response } from "express";
import { db } from "../db";
import { 
  prospectProposals, 
  prospectProposalEvents, 
  onboardingInvitations,
  users 
} from "@shared/schema";
import { eq, desc, and, sql, ilike, or } from "drizzle-orm";
import { nanoid } from "nanoid";

const router = Router();

function generateShareToken(): string {
  return `PP-${nanoid(12)}`;
}

function generateReferralCode(): string {
  return `FTP-${nanoid(8).toUpperCase()}`;
}

async function logProposalEvent(
  proposalId: string,
  eventType: string,
  eventData?: any,
  ipAddress?: string,
  userAgent?: string,
  referrer?: string
) {
  await db.insert(prospectProposalEvents).values({
    proposalId,
    eventType,
    eventData: eventData || {},
    ipAddress,
    userAgent,
    referrer,
  });
}

// ============ AGENT ROUTES ============

// Create prospect proposal
router.post("/api/agent/prospect-proposals", async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const {
      prospectName,
      prospectEmail,
      prospectMobile,
      prospectPan,
      proposalType,
      clientType,
      samplePortfolio,
      investmentGoals,
      proposalTitle,
      executiveSummary,
      currentAnalysis,
      recommendations,
      totalInvestmentAmount,
      projectedReturns,
      projectedValue,
      targetAllocation,
      validUntil,
    } = req.body;

    if (!prospectName || !proposalType || !proposalTitle) {
      return res.status(400).json({ error: "Prospect name, proposal type, and title are required" });
    }

    if (proposalType === 'sample_portfolio' && !samplePortfolio) {
      return res.status(400).json({ error: "Sample portfolio data is required for portfolio analysis" });
    }

    if (proposalType === 'fresh_investment' && !investmentGoals) {
      return res.status(400).json({ error: "Investment goals are required for fresh investment proposals" });
    }

    const shareToken = generateShareToken();
    const referralCode = generateReferralCode();

    // Create linked onboarding invitation and proposal in a transaction
    const expiresAt = validUntil ? new Date(validUntil) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const result = await db.transaction(async (tx) => {
      const [invitation] = await tx.insert(onboardingInvitations).values({
        referralCode,
        inviterId: user.id,
        inviterType: "agent",
        inviterName: user.firstName ? `${user.firstName} ${user.lastName || ""}`.trim() : user.email,
        clientEmail: prospectEmail,
        clientMobile: prospectMobile,
        clientName: prospectName,
        suggestedMode: "smart",
        status: "pending",
        expiresAt,
        notes: `Created via prospect proposal: ${proposalTitle}`,
      }).returning();

      const [proposal] = await tx.insert(prospectProposals).values({
        shareToken,
        agentId: user.id,
        agentName: user.firstName ? `${user.firstName} ${user.lastName || ""}`.trim() : null,
        agentArnCode: user.arnCode || null,
        agentMobile: user.mobile || null,
        agentEmail: user.email || null,
        prospectName,
        prospectEmail,
        prospectMobile,
        prospectPan: prospectPan || null,
        proposalType,
        clientType: clientType || 'individual',
        samplePortfolio: samplePortfolio || null,
        investmentGoals: investmentGoals || null,
        proposalTitle,
        executiveSummary,
        currentAnalysis,
        recommendations: recommendations || [],
        totalInvestmentAmount: totalInvestmentAmount?.toString(),
        projectedReturns: projectedReturns?.toString(),
        projectedValue: projectedValue?.toString(),
        targetAllocation: targetAllocation || null,
        invitationId: invitation.id,
        referralCode,
        status: "draft",
        validUntil: expiresAt,
      }).returning();

      return { invitation, proposal };
    });

    const { invitation, proposal } = result;

    await logProposalEvent(proposal.id, "created", {
      proposalType,
      prospectName,
      prospectEmail,
    }, req.ip, req.headers["user-agent"] as string);

    const baseUrl = process.env.REPLIT_DEV_DOMAIN 
      ? `https://${process.env.REPLIT_DEV_DOMAIN}`
      : process.env.REPL_SLUG 
        ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`
        : "";

    res.json({
      success: true,
      proposal,
      invitation,
      shareableLink: `${baseUrl}/proposal/${shareToken}`,
      onboardingLink: `${baseUrl}/onboarding?ref=${referralCode}`,
    });
  } catch (error: any) {
    console.error("Create prospect proposal error:", error);
    res.status(500).json({ error: error.message || "Failed to create proposal" });
  }
});

// List agent's prospect proposals
router.get("/api/agent/prospect-proposals", async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { status, search } = req.query;

    let whereConditions = [eq(prospectProposals.agentId, user.id)];
    
    if (status && status !== 'all') {
      whereConditions.push(eq(prospectProposals.status, status as string));
    }

    const proposals = await db.select()
      .from(prospectProposals)
      .where(and(...whereConditions))
      .orderBy(desc(prospectProposals.createdAt));

    // Filter by search if provided
    let filteredProposals = proposals;
    if (search) {
      const searchLower = (search as string).toLowerCase();
      filteredProposals = proposals.filter(p => 
        p.prospectName?.toLowerCase().includes(searchLower) ||
        p.prospectEmail?.toLowerCase().includes(searchLower) ||
        p.proposalTitle?.toLowerCase().includes(searchLower)
      );
    }

    // Get stats
    const stats = {
      total: proposals.length,
      draft: proposals.filter(p => p.status === 'draft').length,
      shared: proposals.filter(p => p.status === 'shared').length,
      viewed: proposals.filter(p => p.status === 'viewed').length,
      converted: proposals.filter(p => p.status === 'converted').length,
      totalViews: proposals.reduce((sum, p) => sum + (p.viewCount || 0), 0),
    };

    res.json({ proposals: filteredProposals, stats });
  } catch (error: any) {
    console.error("List prospect proposals error:", error);
    res.status(500).json({ error: error.message || "Failed to list proposals" });
  }
});

// Get single proposal (agent view)
router.get("/api/agent/prospect-proposals/:id", async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const [proposal] = await db.select()
      .from(prospectProposals)
      .where(and(
        eq(prospectProposals.id, req.params.id),
        eq(prospectProposals.agentId, user.id)
      ));

    if (!proposal) {
      return res.status(404).json({ error: "Proposal not found" });
    }

    // Get events
    const events = await db.select()
      .from(prospectProposalEvents)
      .where(eq(prospectProposalEvents.proposalId, proposal.id))
      .orderBy(desc(prospectProposalEvents.timestamp));

    const baseUrl = process.env.REPLIT_DEV_DOMAIN 
      ? `https://${process.env.REPLIT_DEV_DOMAIN}`
      : process.env.REPL_SLUG 
        ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`
        : "";

    res.json({
      proposal,
      events,
      shareableLink: `${baseUrl}/proposal/${proposal.shareToken}`,
      onboardingLink: `${baseUrl}/onboarding?ref=${proposal.referralCode}`,
    });
  } catch (error: any) {
    console.error("Get prospect proposal error:", error);
    res.status(500).json({ error: error.message || "Failed to get proposal" });
  }
});

// Update proposal
router.patch("/api/agent/prospect-proposals/:id", async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const [existing] = await db.select()
      .from(prospectProposals)
      .where(and(
        eq(prospectProposals.id, req.params.id),
        eq(prospectProposals.agentId, user.id)
      ));

    if (!existing) {
      return res.status(404).json({ error: "Proposal not found" });
    }

    const updateData: any = { updatedAt: new Date() };
    const allowedFields = [
      'prospectName', 'prospectEmail', 'prospectMobile', 'prospectPan',
      'proposalTitle', 'executiveSummary', 'currentAnalysis',
      'recommendations', 'totalInvestmentAmount', 'projectedReturns',
      'projectedValue', 'targetAllocation', 'samplePortfolio', 'investmentGoals'
    ];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        if (['totalInvestmentAmount', 'projectedReturns', 'projectedValue'].includes(field)) {
          updateData[field] = req.body[field]?.toString();
        } else {
          updateData[field] = req.body[field];
        }
      }
    }

    const [updated] = await db.update(prospectProposals)
      .set(updateData)
      .where(eq(prospectProposals.id, req.params.id))
      .returning();

    res.json({ success: true, proposal: updated });
  } catch (error: any) {
    console.error("Update prospect proposal error:", error);
    res.status(500).json({ error: error.message || "Failed to update proposal" });
  }
});

// Share proposal (mark as shared and optionally send notifications)
router.post("/api/agent/prospect-proposals/:id/share", async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { shareVia } = req.body; // 'email' | 'whatsapp' | 'both'

    const [existing] = await db.select()
      .from(prospectProposals)
      .where(and(
        eq(prospectProposals.id, req.params.id),
        eq(prospectProposals.agentId, user.id)
      ));

    if (!existing) {
      return res.status(404).json({ error: "Proposal not found" });
    }

    const updateData: any = {
      status: 'shared',
      updatedAt: new Date(),
    };

    if (shareVia === 'email' || shareVia === 'both') {
      updateData.sharedViaEmail = true;
      updateData.emailSentAt = new Date();
      await logProposalEvent(existing.id, "shared_email", { prospectEmail: existing.prospectEmail }, req.ip, req.headers["user-agent"] as string);
    }

    if (shareVia === 'whatsapp' || shareVia === 'both') {
      updateData.sharedViaWhatsApp = true;
      updateData.whatsappSentAt = new Date();
      await logProposalEvent(existing.id, "shared_whatsapp", { prospectMobile: existing.prospectMobile }, req.ip, req.headers["user-agent"] as string);
    }

    const [updated] = await db.update(prospectProposals)
      .set(updateData)
      .where(eq(prospectProposals.id, req.params.id))
      .returning();

    const baseUrl = process.env.REPLIT_DEV_DOMAIN 
      ? `https://${process.env.REPLIT_DEV_DOMAIN}`
      : process.env.REPL_SLUG 
        ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`
        : "";

    res.json({
      success: true,
      proposal: updated,
      shareableLink: `${baseUrl}/proposal/${existing.shareToken}`,
      onboardingLink: `${baseUrl}/onboarding?ref=${existing.referralCode}`,
    });
  } catch (error: any) {
    console.error("Share proposal error:", error);
    res.status(500).json({ error: error.message || "Failed to share proposal" });
  }
});

// Delete proposal
router.delete("/api/agent/prospect-proposals/:id", async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const [existing] = await db.select()
      .from(prospectProposals)
      .where(and(
        eq(prospectProposals.id, req.params.id),
        eq(prospectProposals.agentId, user.id)
      ));

    if (!existing) {
      return res.status(404).json({ error: "Proposal not found" });
    }

    // Delete events first
    await db.delete(prospectProposalEvents)
      .where(eq(prospectProposalEvents.proposalId, existing.id));

    // Delete proposal
    await db.delete(prospectProposals)
      .where(eq(prospectProposals.id, existing.id));

    res.json({ success: true });
  } catch (error: any) {
    console.error("Delete proposal error:", error);
    res.status(500).json({ error: error.message || "Failed to delete proposal" });
  }
});

// ============ PUBLIC ROUTES (for prospects) ============

// Get proposal by share token (public view)
router.get("/api/public/proposal/:shareToken", async (req: Request, res: Response) => {
  try {
    const [proposal] = await db.select()
      .from(prospectProposals)
      .where(eq(prospectProposals.shareToken, req.params.shareToken));

    if (!proposal) {
      return res.status(404).json({ error: "Proposal not found or expired" });
    }

    // Check if expired
    if (proposal.validUntil && new Date(proposal.validUntil) < new Date()) {
      return res.status(410).json({ error: "This proposal has expired" });
    }

    // Update view count and status
    const isFirstView = !proposal.firstViewedAt;
    await db.update(prospectProposals)
      .set({
        viewCount: (proposal.viewCount || 0) + 1,
        lastViewedAt: new Date(),
        firstViewedAt: isFirstView ? new Date() : proposal.firstViewedAt,
        status: proposal.status === 'draft' ? 'viewed' : proposal.status,
        updatedAt: new Date(),
      })
      .where(eq(prospectProposals.id, proposal.id));

    await logProposalEvent(
      proposal.id,
      "viewed",
      { viewCount: (proposal.viewCount || 0) + 1, isFirstView },
      req.ip,
      req.headers["user-agent"] as string,
      req.headers.referer as string
    );

    const baseUrl = process.env.REPLIT_DEV_DOMAIN 
      ? `https://${process.env.REPLIT_DEV_DOMAIN}`
      : process.env.REPL_SLUG 
        ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`
        : "";

    res.json({
      proposal: {
        id: proposal.id,
        proposalType: proposal.proposalType,
        proposalTitle: proposal.proposalTitle,
        executiveSummary: proposal.executiveSummary,
        currentAnalysis: proposal.currentAnalysis,
        recommendations: proposal.recommendations,
        totalInvestmentAmount: proposal.totalInvestmentAmount,
        projectedReturns: proposal.projectedReturns,
        projectedValue: proposal.projectedValue,
        targetAllocation: proposal.targetAllocation,
        samplePortfolio: proposal.samplePortfolio,
        investmentGoals: proposal.investmentGoals,
        agentName: proposal.agentName,
        agentMobile: proposal.agentMobile,
        agentEmail: proposal.agentEmail,
        validUntil: proposal.validUntil,
        createdAt: proposal.createdAt,
      },
      onboardingLink: `${baseUrl}/onboarding?ref=${proposal.referralCode}`,
    });
  } catch (error: any) {
    console.error("Get public proposal error:", error);
    res.status(500).json({ error: error.message || "Failed to load proposal" });
  }
});

// Track onboarding click from proposal
router.post("/api/public/proposal/:shareToken/onboarding-click", async (req: Request, res: Response) => {
  try {
    const [proposal] = await db.select()
      .from(prospectProposals)
      .where(eq(prospectProposals.shareToken, req.params.shareToken));

    if (!proposal) {
      return res.status(404).json({ error: "Proposal not found" });
    }

    await logProposalEvent(
      proposal.id,
      "onboarding_started",
      {},
      req.ip,
      req.headers["user-agent"] as string,
      req.headers.referer as string
    );

    // Update invitation status
    if (proposal.invitationId) {
      await db.update(onboardingInvitations)
        .set({
          status: "started",
          onboardingStartedAt: new Date(),
          lastActivityAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(onboardingInvitations.id, proposal.invitationId));
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error("Track onboarding click error:", error);
    res.status(500).json({ error: error.message || "Failed to track click" });
  }
});

// ============ AI PROPOSAL GENERATION ============

// Generate AI recommendations based on input
router.post("/api/agent/prospect-proposals/generate", async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { proposalType, clientType = 'individual', samplePortfolio, investmentGoals } = req.body;

    // Client type configurations for tailored recommendations
    const clientTypeConfig: Record<string, {
      minInvestment: number;
      eligibleProducts: string[];
      riskModifier: number;
      toneSuffix: string;
      premiumProducts: boolean;
    }> = {
      individual: { minInvestment: 5000, eligibleProducts: ['mutual_fund'], riskModifier: 1.0, toneSuffix: 'for your personal financial goals', premiumProducts: false },
      hni: { minInvestment: 5000000, eligibleProducts: ['mutual_fund', 'pms', 'aif'], riskModifier: 1.1, toneSuffix: 'for your sophisticated investment requirements', premiumProducts: true },
      ultra_hni: { minInvestment: 50000000, eligibleProducts: ['mutual_fund', 'pms', 'aif', 'private_equity', 'structured_products'], riskModifier: 1.15, toneSuffix: 'for your ultra-high-net-worth portfolio', premiumProducts: true },
      corporate: { minInvestment: 10000000, eligibleProducts: ['mutual_fund', 'bonds', 'fixed_deposits'], riskModifier: 0.85, toneSuffix: 'for your corporate treasury requirements', premiumProducts: false },
      nri: { minInvestment: 10000, eligibleProducts: ['mutual_fund', 'bonds', 'nri_fd'], riskModifier: 0.95, toneSuffix: 'considering NRE/NRO account regulations', premiumProducts: false },
      trust: { minInvestment: 25000000, eligibleProducts: ['mutual_fund', 'pms', 'aif', 'bonds'], riskModifier: 0.9, toneSuffix: 'for your family office/trust requirements', premiumProducts: true },
      institutional: { minInvestment: 100000000, eligibleProducts: ['mutual_fund', 'pms', 'aif', 'bonds', 'structured_products'], riskModifier: 0.8, toneSuffix: 'for your institutional investment mandate', premiumProducts: true },
    };

    const config = clientTypeConfig[clientType] || clientTypeConfig.individual;

    // Generate recommendations based on proposal type
    let recommendations: any[] = [];
    let executiveSummary = "";
    let currentAnalysis = "";
    let targetAllocation: Record<string, number> = {};
    let projectedReturns = 12;
    let projectedValue = 0;

    if (proposalType === 'sample_portfolio' && samplePortfolio) {
      // Analyze sample portfolio and suggest improvements
      const totalValue = Math.max(samplePortfolio.totalValue || 0, config.minInvestment);
      const holdings = samplePortfolio.holdings || [];
      
      currentAnalysis = `Based on your current portfolio worth ₹${totalValue.toLocaleString('en-IN')}, we've analyzed ${holdings.length} holdings and identified opportunities for optimization ${config.toneSuffix}.`;
      
      executiveSummary = `Your portfolio shows potential for improved diversification and returns. We recommend rebalancing to achieve better risk-adjusted returns ${config.toneSuffix}.${config.premiumProducts ? ' As a qualified investor, you have access to exclusive PMS and AIF products with higher return potential.' : ''}`;

      // Generate client-type specific recommendations for sample portfolio
      if (config.premiumProducts && (clientType === 'hni' || clientType === 'ultra_hni' || clientType === 'trust' || clientType === 'institutional')) {
        // Premium rebalancing for HNI/Ultra HNI/Trust/Institutional
        targetAllocation = clientType === 'ultra_hni' 
          ? { 'PMS': 35, 'AIF': 25, 'Mutual Funds': 20, 'Debt': 15, 'Alternatives': 5 }
          : { 'PMS': 30, 'Mutual Funds': 30, 'AIF': 15, 'Debt': 20, 'Gold': 5 };
        
        recommendations = [
          {
            productType: 'pms',
            productName: 'Marcellus Consistent Compounders PMS',
            productCode: 'PMS-MARC-CC',
            amc: 'Marcellus Investment Managers',
            category: 'PMS - Large Cap',
            recommendedAmount: Math.round(totalValue * 0.35),
            allocationPercentage: 35,
            investmentType: 'lumpsum',
            minInvestment: 5000000,
            returns1Y: 18.5,
            returns3Y: 16.2,
            returns5Y: 19.8,
            riskRating: 'Moderately High',
            selectionReason: 'Reallocate to premium PMS for alpha generation with focus on high-quality compounders.'
          },
          {
            productType: 'aif',
            productName: 'Alchemy High Growth Select Stock Fund',
            productCode: 'AIF-ALCH-HG',
            amc: 'Alchemy Capital Management',
            category: 'AIF Category III',
            recommendedAmount: Math.round(totalValue * 0.25),
            allocationPercentage: 25,
            investmentType: 'lumpsum',
            minInvestment: 10000000,
            returns1Y: 28.5,
            returns3Y: 22.8,
            returns5Y: 25.2,
            riskRating: 'High',
            selectionReason: 'Category III AIF for concentrated high-conviction exposure not available in mutual funds.'
          },
          {
            productType: 'mutual_fund',
            productName: 'Axis Bluechip Fund - Direct Growth',
            productCode: 'INF846K01EW2',
            amc: 'Axis Mutual Fund',
            category: 'Large Cap',
            recommendedAmount: Math.round(totalValue * 0.20),
            allocationPercentage: 20,
            investmentType: 'lumpsum',
            returns1Y: 15.2,
            returns3Y: 12.8,
            returns5Y: 14.5,
            riskRating: 'Moderately High',
            selectionReason: 'Retain liquid mutual fund allocation for flexibility and easy redemption.'
          },
          {
            productType: 'bond',
            productName: 'HDFC Limited NCD - 8.75% 2028',
            productCode: 'INE001A08015',
            amc: 'HDFC Limited',
            category: 'Corporate NCD',
            recommendedAmount: Math.round(totalValue * 0.15),
            allocationPercentage: 15,
            investmentType: 'lumpsum',
            returns1Y: 8.75,
            riskRating: 'Low',
            selectionReason: 'AAA-rated bonds for stable income and capital preservation in rebalanced portfolio.'
          },
          {
            productType: 'aif',
            productName: 'Kotak Special Situations Fund',
            productCode: 'AIF-KOT-SSF',
            amc: 'Kotak Alternate Asset Managers',
            category: 'AIF Category II',
            recommendedAmount: Math.round(totalValue * 0.05),
            allocationPercentage: 5,
            investmentType: 'lumpsum',
            minInvestment: 10000000,
            returns1Y: 22.3,
            returns3Y: 18.5,
            riskRating: 'High',
            selectionReason: 'Add alternative exposure through special situations strategy.'
          }
        ];
        projectedReturns = Math.round(16.5 * config.riskModifier * 10) / 10;
      } else if (clientType === 'corporate') {
        // Conservative treasury rebalancing for corporate
        targetAllocation = { 'Liquid Funds': 30, 'Ultra Short Duration': 25, 'Corporate Bonds': 25, 'Arbitrage': 15, 'Fixed Deposits': 5 };
        
        recommendations = [
          {
            productType: 'mutual_fund',
            productName: 'HDFC Liquid Fund - Direct',
            productCode: 'INF179K01LQ1',
            amc: 'HDFC Mutual Fund',
            category: 'Liquid Fund',
            recommendedAmount: Math.round(totalValue * 0.30),
            allocationPercentage: 30,
            investmentType: 'lumpsum',
            returns1Y: 7.2,
            returns3Y: 6.5,
            returns5Y: 6.8,
            riskRating: 'Low',
            selectionReason: 'Rebalance to liquid funds for instant liquidity and T+0 redemption facility.'
          },
          {
            productType: 'mutual_fund',
            productName: 'ICICI Prudential Ultra Short Term Fund - Direct',
            productCode: 'INF109K01UST',
            amc: 'ICICI Prudential',
            category: 'Ultra Short Duration',
            recommendedAmount: Math.round(totalValue * 0.25),
            allocationPercentage: 25,
            investmentType: 'lumpsum',
            returns1Y: 7.5,
            returns3Y: 6.8,
            returns5Y: 7.1,
            riskRating: 'Low to Moderate',
            selectionReason: 'Enhanced returns over liquid funds for 3-6 month treasury parking.'
          },
          {
            productType: 'bond',
            productName: 'REC Limited Tax-Free Bond - 7.12% 2033',
            productCode: 'INE020B08090',
            amc: 'REC Limited',
            category: 'Tax-Free Bond',
            recommendedAmount: Math.round(totalValue * 0.25),
            allocationPercentage: 25,
            investmentType: 'lumpsum',
            returns1Y: 7.12,
            riskRating: 'Low',
            selectionReason: 'Tax-efficient government-backed bonds for long-term surplus deployment.'
          },
          {
            productType: 'mutual_fund',
            productName: 'Kotak Equity Arbitrage Fund - Direct',
            productCode: 'INF174K01ARB',
            amc: 'Kotak Mahindra',
            category: 'Arbitrage',
            recommendedAmount: Math.round(totalValue * 0.15),
            allocationPercentage: 15,
            investmentType: 'lumpsum',
            returns1Y: 7.8,
            returns3Y: 6.5,
            returns5Y: 6.2,
            riskRating: 'Low',
            selectionReason: 'Equity-taxed returns with minimal risk through market-neutral arbitrage.'
          },
          {
            productType: 'fixed_deposit',
            productName: 'SBI Corporate Fixed Deposit',
            productCode: 'FD-SBI-CORP',
            amc: 'State Bank of India',
            category: 'Bank Fixed Deposit',
            recommendedAmount: Math.round(totalValue * 0.05),
            allocationPercentage: 5,
            investmentType: 'lumpsum',
            returns1Y: 7.0,
            riskRating: 'Very Low',
            selectionReason: 'Emergency reserve with guaranteed capital protection.'
          }
        ];
        projectedReturns = Math.round(7.5 * config.riskModifier * 10) / 10;
      } else if (clientType === 'nri') {
        // NRI-compliant rebalancing
        targetAllocation = { 'NRE Mutual Funds': 40, 'NRO Debt': 25, 'Indian Equity': 25, 'Gold': 10 };
        
        recommendations = [
          {
            productType: 'mutual_fund',
            productName: 'HDFC Flexicap Fund - Direct (NRE)',
            productCode: 'INF179K01FLC',
            amc: 'HDFC Mutual Fund',
            category: 'Flexi Cap',
            recommendedAmount: Math.round(totalValue * 0.40),
            allocationPercentage: 40,
            investmentType: 'lumpsum',
            returns1Y: 18.5,
            returns3Y: 14.2,
            returns5Y: 15.8,
            riskRating: 'Moderately High',
            selectionReason: 'Rebalance to NRI-friendly fund with full repatriation facility under FEMA.'
          },
          {
            productType: 'mutual_fund',
            productName: 'ICICI Prudential Banking & PSU Debt Fund - Direct',
            productCode: 'INF109K01BPD',
            amc: 'ICICI Prudential',
            category: 'Banking & PSU Debt',
            recommendedAmount: Math.round(totalValue * 0.25),
            allocationPercentage: 25,
            investmentType: 'lumpsum',
            returns1Y: 7.8,
            returns3Y: 7.2,
            returns5Y: 7.5,
            riskRating: 'Moderate',
            selectionReason: 'Safe debt allocation suitable for NRO account with minimal credit risk.'
          },
          {
            productType: 'mutual_fund',
            productName: 'Nippon India Large Cap Fund - Direct',
            productCode: 'INF204K01LC1',
            amc: 'Nippon India',
            category: 'Large Cap',
            recommendedAmount: Math.round(totalValue * 0.25),
            allocationPercentage: 25,
            investmentType: 'lumpsum',
            returns1Y: 14.5,
            returns3Y: 12.8,
            returns5Y: 13.5,
            riskRating: 'Moderately High',
            selectionReason: 'Quality large-cap exposure for long-term India growth story.'
          },
          {
            productType: 'mutual_fund',
            productName: 'SBI Gold Fund - Direct',
            productCode: 'INF200K01GF1',
            amc: 'SBI Mutual Fund',
            category: 'Gold',
            recommendedAmount: Math.round(totalValue * 0.10),
            allocationPercentage: 10,
            investmentType: 'lumpsum',
            returns1Y: 18.5,
            returns3Y: 12.2,
            returns5Y: 11.8,
            riskRating: 'Moderate',
            selectionReason: 'Rupee-denominated gold for currency hedging and portfolio diversification.'
          }
        ];
        projectedReturns = Math.round(12.5 * config.riskModifier * 10) / 10;
      } else {
        // Standard retail investor rebalancing
        targetAllocation = {
          'Large Cap': 25,
          'Mid Cap': 20,
          'Contra/Value': 15,
          'Debt': 25,
          'Flexi Cap': 15
        };

        recommendations = [
          {
            productType: 'mutual_fund',
            productName: 'Axis Bluechip Fund - Direct Growth',
            productCode: 'INF846K01EW2',
            amc: 'Axis Mutual Fund',
            category: 'Large Cap',
            recommendedAmount: Math.round(totalValue * 0.25),
            allocationPercentage: 25,
            investmentType: 'lumpsum',
            returns1Y: 15.2,
            returns3Y: 12.8,
            returns5Y: 14.5,
            riskRating: 'Moderately High',
            selectionReason: 'Consistent performer with strong large-cap exposure and experienced fund management.'
          },
          {
            productType: 'mutual_fund',
            productName: 'HDFC Mid-Cap Opportunities Fund - Direct',
            productCode: 'INF179K01CR7',
            amc: 'HDFC Mutual Fund',
            category: 'Mid Cap',
            recommendedAmount: Math.round(totalValue * 0.20),
            allocationPercentage: 20,
            investmentType: 'sip',
            sipAmount: Math.round(totalValue * 0.20 / 12),
            returns1Y: 28.5,
            returns3Y: 18.2,
            returns5Y: 16.8,
            riskRating: 'High',
            selectionReason: 'Strong mid-cap fund with excellent track record for long-term wealth creation.'
          },
          {
            productType: 'mutual_fund',
            productName: 'SBI Contra Fund - Direct Growth',
            productCode: 'INF200K01RD1',
            amc: 'SBI Mutual Fund',
            category: 'Contra',
            recommendedAmount: Math.round(totalValue * 0.15),
            allocationPercentage: 15,
            investmentType: 'lumpsum',
            returns1Y: 32.1,
            returns3Y: 22.5,
            returns5Y: 18.9,
            riskRating: 'High',
            selectionReason: 'Value-oriented approach provides excellent diversification from growth-heavy portfolios.'
          },
          {
            productType: 'mutual_fund',
            productName: 'ICICI Prudential Corporate Bond Fund - Direct',
            productCode: 'INF109K01ZH7',
            amc: 'ICICI Prudential',
            category: 'Corporate Bond',
            recommendedAmount: Math.round(totalValue * 0.25),
            allocationPercentage: 25,
            investmentType: 'lumpsum',
            returns1Y: 7.8,
            returns3Y: 7.2,
            returns5Y: 8.1,
            riskRating: 'Moderate',
            selectionReason: 'Quality debt allocation for portfolio stability and regular income generation.'
          },
          {
            productType: 'mutual_fund',
            productName: 'Parag Parikh Flexi Cap Fund - Direct',
            productCode: 'INF879O01027',
            amc: 'PPFAS Mutual Fund',
            category: 'Flexi Cap',
            recommendedAmount: Math.round(totalValue * 0.15),
            allocationPercentage: 15,
            investmentType: 'sip',
            sipAmount: Math.round(totalValue * 0.15 / 12),
            returns1Y: 22.3,
            returns3Y: 16.9,
            returns5Y: 18.2,
            riskRating: 'Moderately High',
            selectionReason: 'Unique global diversification with value investing philosophy for long-term growth.'
          }
        ];
        projectedReturns = Math.round(13.5 * config.riskModifier * 10) / 10;
      }
      
      projectedValue = Math.round(totalValue * Math.pow(1 + projectedReturns/100, 5));

    } else if (proposalType === 'fresh_investment' && investmentGoals) {
      // Generate recommendations for fresh investment
      const { goalType, targetAmount, timeHorizon, monthlyInvestment, lumpsum, riskTolerance } = investmentGoals;
      const calculatedAmount = (lumpsum || 0) + (monthlyInvestment || 0) * 12;
      const totalAmount = Math.max(calculatedAmount, config.minInvestment);

      const goalLabels: Record<string, string> = {
        retirement: 'Retirement Planning',
        child_education: 'Child Education',
        wealth_creation: 'Wealth Creation',
        home_purchase: 'Home Purchase',
        emergency_fund: 'Emergency Fund',
        tax_saving: 'Tax Saving',
        regular_income: 'Regular Income',
        custom: 'Custom Goal'
      };

      executiveSummary = `Based on your ${goalLabels[goalType] || goalType} goal with a ${timeHorizon} investment horizon and ${riskTolerance} risk tolerance, we've curated a personalized investment portfolio ${config.toneSuffix}.${config.premiumProducts ? ' Your profile qualifies you for premium investment products including PMS and AIFs.' : ''}`;

      currentAnalysis = `For ${targetAmount ? `a target of ₹${targetAmount.toLocaleString('en-IN')}` : 'your investment goal'}, we recommend a ${riskTolerance === 'aggressive' ? 'growth-oriented' : riskTolerance === 'conservative' ? 'stability-focused' : 'balanced'} approach ${config.toneSuffix}. ${monthlyInvestment ? `Your monthly SIP of ₹${monthlyInvestment.toLocaleString('en-IN')} combined with ` : ''}${lumpsum ? `a lumpsum of ₹${lumpsum.toLocaleString('en-IN')}` : ''} positions you well for long-term wealth creation.`;

      // Different allocations based on risk tolerance with client type modifier
      const adjustedReturns = config.riskModifier;
      if (riskTolerance === 'aggressive') {
        targetAllocation = { 'Equity': 80, 'Debt': 15, 'Gold': 5 };
        projectedReturns = Math.round(14 * adjustedReturns * 10) / 10;
      } else if (riskTolerance === 'conservative') {
        targetAllocation = { 'Equity': 40, 'Debt': 50, 'Gold': 10 };
        projectedReturns = Math.round(9 * adjustedReturns * 10) / 10;
      } else {
        targetAllocation = { 'Equity': 60, 'Debt': 30, 'Gold': 10 };
        projectedReturns = Math.round(11.5 * adjustedReturns * 10) / 10;
      }

      // Generate client-type specific recommendations
      if (config.premiumProducts && (clientType === 'hni' || clientType === 'ultra_hni' || clientType === 'trust' || clientType === 'institutional')) {
        // Premium products for HNI/Ultra HNI/Trust/Institutional clients
        targetAllocation = clientType === 'ultra_hni' 
          ? { 'PMS': 35, 'AIF': 25, 'Mutual Funds': 20, 'Debt': 15, 'Alternatives': 5 }
          : { 'PMS': 30, 'Mutual Funds': 30, 'AIF': 15, 'Debt': 20, 'Gold': 5 };
        
        recommendations = [
          {
            productType: 'pms',
            productName: 'Marcellus Consistent Compounders PMS',
            productCode: 'PMS-MARC-CC',
            amc: 'Marcellus Investment Managers',
            category: 'PMS - Large Cap',
            recommendedAmount: Math.round(totalAmount * 0.35),
            allocationPercentage: 35,
            investmentType: 'lumpsum',
            minInvestment: 5000000,
            returns1Y: 18.5,
            returns3Y: 16.2,
            returns5Y: 19.8,
            riskRating: 'Moderately High',
            selectionReason: 'Premium PMS focusing on high-quality businesses with sustainable competitive advantages. Ideal for HNI investors seeking alpha generation.'
          },
          {
            productType: 'aif',
            productName: 'Alchemy High Growth Select Stock Fund',
            productCode: 'AIF-ALCH-HG',
            amc: 'Alchemy Capital Management',
            category: 'AIF Category III',
            recommendedAmount: Math.round(totalAmount * 0.25),
            allocationPercentage: 25,
            investmentType: 'lumpsum',
            minInvestment: 10000000,
            returns1Y: 28.5,
            returns3Y: 22.8,
            returns5Y: 25.2,
            riskRating: 'High',
            selectionReason: 'Category III AIF with proven track record of outperformance through concentrated high-conviction portfolio.'
          },
          {
            productType: 'mutual_fund',
            productName: 'Axis Bluechip Fund - Direct Growth',
            productCode: 'INF846K01EW2',
            amc: 'Axis Mutual Fund',
            category: 'Large Cap',
            recommendedAmount: Math.round(totalAmount * 0.20),
            allocationPercentage: 20,
            investmentType: monthlyInvestment ? 'sip' : 'lumpsum',
            sipAmount: monthlyInvestment ? Math.round(monthlyInvestment * 0.20) : undefined,
            returns1Y: 15.2,
            returns3Y: 12.8,
            returns5Y: 14.5,
            riskRating: 'Moderately High',
            selectionReason: 'Liquid mutual fund component for flexibility and easy redemption when needed.'
          },
          {
            productType: 'bond',
            productName: 'HDFC Limited NCD - 8.75% 2028',
            productCode: 'INE001A08015',
            amc: 'HDFC Limited',
            category: 'Corporate NCD',
            recommendedAmount: Math.round(totalAmount * 0.15),
            allocationPercentage: 15,
            investmentType: 'lumpsum',
            returns1Y: 8.75,
            riskRating: 'Low',
            selectionReason: 'AAA-rated corporate bond for stable income and capital preservation.'
          },
          {
            productType: 'aif',
            productName: 'Kotak Special Situations Fund',
            productCode: 'AIF-KOT-SSF',
            amc: 'Kotak Alternate Asset Managers',
            category: 'AIF Category II',
            recommendedAmount: Math.round(totalAmount * 0.05),
            allocationPercentage: 5,
            investmentType: 'lumpsum',
            minInvestment: 10000000,
            returns1Y: 22.3,
            returns3Y: 18.5,
            riskRating: 'High',
            selectionReason: 'Special situations fund for accessing unique investment opportunities not available in public markets.'
          }
        ];
        projectedReturns = Math.round(16.5 * adjustedReturns * 10) / 10;
      } else if (clientType === 'corporate') {
        // Conservative treasury-focused products for corporate clients
        targetAllocation = { 'Liquid Funds': 30, 'Ultra Short Duration': 25, 'Corporate Bonds': 25, 'Arbitrage': 15, 'Fixed Deposits': 5 };
        
        recommendations = [
          {
            productType: 'mutual_fund',
            productName: 'HDFC Liquid Fund - Direct',
            productCode: 'INF179K01LQ1',
            amc: 'HDFC Mutual Fund',
            category: 'Liquid Fund',
            recommendedAmount: Math.round(totalAmount * 0.30),
            allocationPercentage: 30,
            investmentType: 'lumpsum',
            returns1Y: 7.2,
            returns3Y: 6.5,
            returns5Y: 6.8,
            riskRating: 'Low',
            selectionReason: 'Instant redemption facility up to ₹50L. Ideal for corporate cash management with T+0 liquidity.'
          },
          {
            productType: 'mutual_fund',
            productName: 'ICICI Prudential Ultra Short Term Fund - Direct',
            productCode: 'INF109K01UST',
            amc: 'ICICI Prudential',
            category: 'Ultra Short Duration',
            recommendedAmount: Math.round(totalAmount * 0.25),
            allocationPercentage: 25,
            investmentType: 'lumpsum',
            returns1Y: 7.5,
            returns3Y: 6.8,
            returns5Y: 7.1,
            riskRating: 'Low to Moderate',
            selectionReason: 'Better returns than liquid funds with marginal increase in duration. Suitable for 3-6 month parking.'
          },
          {
            productType: 'bond',
            productName: 'REC Limited Tax-Free Bond - 7.12% 2033',
            productCode: 'INE020B08090',
            amc: 'REC Limited',
            category: 'Tax-Free Bond',
            recommendedAmount: Math.round(totalAmount * 0.25),
            allocationPercentage: 25,
            investmentType: 'lumpsum',
            returns1Y: 7.12,
            riskRating: 'Low',
            selectionReason: 'Government-backed tax-free bonds for long-term corporate surplus deployment with tax efficiency.'
          },
          {
            productType: 'mutual_fund',
            productName: 'Kotak Equity Arbitrage Fund - Direct',
            productCode: 'INF174K01ARB',
            amc: 'Kotak Mahindra',
            category: 'Arbitrage',
            recommendedAmount: Math.round(totalAmount * 0.15),
            allocationPercentage: 15,
            investmentType: 'lumpsum',
            returns1Y: 7.8,
            returns3Y: 6.5,
            returns5Y: 6.2,
            riskRating: 'Low',
            selectionReason: 'Tax-efficient returns (equity taxation) with low risk through arbitrage strategy.'
          },
          {
            productType: 'fixed_deposit',
            productName: 'SBI Corporate Fixed Deposit',
            productCode: 'FD-SBI-CORP',
            amc: 'State Bank of India',
            category: 'Bank Fixed Deposit',
            recommendedAmount: Math.round(totalAmount * 0.05),
            allocationPercentage: 5,
            investmentType: 'lumpsum',
            returns1Y: 7.0,
            riskRating: 'Very Low',
            selectionReason: 'Capital protection with guaranteed returns for emergency reserve.'
          }
        ];
        projectedReturns = Math.round(7.5 * adjustedReturns * 10) / 10;
      } else if (clientType === 'nri') {
        // NRI-compliant products
        targetAllocation = { 'NRE Mutual Funds': 40, 'NRO Debt': 25, 'Indian Equity': 25, 'Gold': 10 };
        
        recommendations = [
          {
            productType: 'mutual_fund',
            productName: 'HDFC Flexicap Fund - Direct (NRE)',
            productCode: 'INF179K01FLC',
            amc: 'HDFC Mutual Fund',
            category: 'Flexi Cap',
            recommendedAmount: Math.round(totalAmount * 0.40),
            allocationPercentage: 40,
            investmentType: monthlyInvestment ? 'sip' : 'lumpsum',
            sipAmount: monthlyInvestment ? Math.round(monthlyInvestment * 0.40) : undefined,
            returns1Y: 18.5,
            returns3Y: 14.2,
            returns5Y: 15.8,
            riskRating: 'Moderately High',
            selectionReason: 'NRI-friendly diversified equity fund with repatriation facility. Compliant with FEMA regulations.'
          },
          {
            productType: 'mutual_fund',
            productName: 'ICICI Prudential Banking & PSU Debt Fund - Direct',
            productCode: 'INF109K01BPD',
            amc: 'ICICI Prudential',
            category: 'Banking & PSU Debt',
            recommendedAmount: Math.round(totalAmount * 0.25),
            allocationPercentage: 25,
            investmentType: 'lumpsum',
            returns1Y: 7.8,
            returns3Y: 7.2,
            returns5Y: 7.5,
            riskRating: 'Moderate',
            selectionReason: 'Safe debt fund investing in banking and PSU bonds. NRO account compatible.'
          },
          {
            productType: 'mutual_fund',
            productName: 'Nippon India Large Cap Fund - Direct',
            productCode: 'INF204K01LC1',
            amc: 'Nippon India',
            category: 'Large Cap',
            recommendedAmount: Math.round(totalAmount * 0.25),
            allocationPercentage: 25,
            investmentType: monthlyInvestment ? 'sip' : 'lumpsum',
            sipAmount: monthlyInvestment ? Math.round(monthlyInvestment * 0.25) : undefined,
            returns1Y: 14.5,
            returns3Y: 12.8,
            returns5Y: 13.5,
            riskRating: 'Moderately High',
            selectionReason: 'Blue-chip Indian equity exposure suitable for NRI investors with long-term India view.'
          },
          {
            productType: 'mutual_fund',
            productName: 'SBI Gold Fund - Direct',
            productCode: 'INF200K01GF1',
            amc: 'SBI Mutual Fund',
            category: 'Gold',
            recommendedAmount: Math.round(totalAmount * 0.10),
            allocationPercentage: 10,
            investmentType: 'lumpsum',
            returns1Y: 18.5,
            returns3Y: 12.2,
            returns5Y: 11.8,
            riskRating: 'Moderate',
            selectionReason: 'Rupee-denominated gold exposure for currency hedging and portfolio diversification.'
          }
        ];
        projectedReturns = Math.round(12.5 * adjustedReturns * 10) / 10;
      } else {
        // Standard retail investor recommendations
        recommendations = [
          {
            productType: 'mutual_fund',
            productName: 'Nifty 50 Index Fund - Direct',
            productCode: 'INF204K01JL8',
            amc: 'UTI Mutual Fund',
            category: 'Index Fund',
            recommendedAmount: Math.round(totalAmount * 0.30),
            allocationPercentage: 30,
            investmentType: monthlyInvestment ? 'sip' : 'lumpsum',
            sipAmount: monthlyInvestment ? Math.round(monthlyInvestment * 0.30) : undefined,
            returns1Y: 12.5,
            returns3Y: 11.2,
            returns5Y: 12.8,
            riskRating: 'Moderately High',
            selectionReason: 'Low-cost index fund tracking Nifty 50 for core equity exposure with minimal expense ratio.'
          },
          {
            productType: 'mutual_fund',
            productName: 'Mirae Asset Large Cap Fund - Direct',
            productCode: 'INF769K01DN6',
            amc: 'Mirae Asset',
            category: 'Large Cap',
            recommendedAmount: Math.round(totalAmount * 0.25),
            allocationPercentage: 25,
            investmentType: monthlyInvestment ? 'sip' : 'lumpsum',
            sipAmount: monthlyInvestment ? Math.round(monthlyInvestment * 0.25) : undefined,
            returns1Y: 16.8,
            returns3Y: 13.5,
            returns5Y: 15.2,
            riskRating: 'Moderately High',
            selectionReason: 'Top-rated large cap fund with consistent outperformance and experienced management.'
          },
          {
            productType: 'mutual_fund',
            productName: 'HDFC Short Term Debt Fund - Direct',
            productCode: 'INF179K01EQ5',
            amc: 'HDFC Mutual Fund',
            category: 'Short Duration',
            recommendedAmount: Math.round(totalAmount * 0.25),
            allocationPercentage: 25,
            investmentType: 'lumpsum',
            returns1Y: 7.5,
            returns3Y: 6.8,
            returns5Y: 7.2,
            riskRating: 'Moderate',
            selectionReason: 'Quality short-term debt fund for stability and better-than-FD returns.'
          },
          {
            productType: 'mutual_fund',
            productName: 'SBI Small Cap Fund - Direct',
            productCode: 'INF200K01ST5',
            amc: 'SBI Mutual Fund',
            category: 'Small Cap',
            recommendedAmount: Math.round(totalAmount * 0.15),
            allocationPercentage: 15,
            investmentType: monthlyInvestment ? 'sip' : 'lumpsum',
            sipAmount: monthlyInvestment ? Math.round(monthlyInvestment * 0.15) : undefined,
            returns1Y: 35.2,
            returns3Y: 25.8,
            returns5Y: 22.5,
            riskRating: 'Very High',
            selectionReason: 'High-growth small cap exposure for enhanced portfolio returns over long term.'
          },
          {
            productType: 'mutual_fund',
            productName: 'SBI Gold Fund - Direct',
            productCode: 'INF200K01GF1',
            amc: 'SBI Mutual Fund',
            category: 'Gold',
            recommendedAmount: Math.round(totalAmount * 0.05),
            allocationPercentage: 5,
            investmentType: 'lumpsum',
            returns1Y: 18.5,
            returns3Y: 12.2,
            returns5Y: 11.8,
            riskRating: 'Moderate',
            selectionReason: 'Gold allocation for portfolio hedging and inflation protection.'
          }
        ];
      }

      const yearsMap: Record<string, number> = { short_term: 3, medium_term: 5, long_term: 10 };
      const years = yearsMap[timeHorizon] || 5;
      projectedValue = Math.round(totalAmount * Math.pow(1 + projectedReturns/100, years));
    }

    res.json({
      success: true,
      generated: {
        executiveSummary,
        currentAnalysis,
        recommendations,
        targetAllocation,
        projectedReturns,
        projectedValue,
        totalInvestmentAmount: recommendations.reduce((sum, r) => sum + r.recommendedAmount, 0),
      }
    });
  } catch (error: any) {
    console.error("Generate proposal error:", error);
    res.status(500).json({ error: error.message || "Failed to generate proposal" });
  }
});

export default router;
