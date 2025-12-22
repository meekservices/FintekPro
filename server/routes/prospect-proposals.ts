import { Router, Request, Response } from "express";
import { db } from "../db";
import { 
  prospectProposals, 
  prospectProposalEvents, 
  onboardingInvitations,
  users,
  mutualFunds,
  corporateBonds,
  aifMaster,
  pmsMaster,
  mldMaster
} from "@shared/schema";
import { eq, desc, and, sql, ilike, or } from "drizzle-orm";

// Helper functions to fetch store-eligible products
async function getStoreEligibleMutualFunds(options: {
  category?: string;
  riskLevel?: string;
  limit?: number;
} = {}) {
  const { category, riskLevel, limit = 20 } = options;
  
  const conditions = [
    eq(mutualFunds.isPublished, true),
    eq(mutualFunds.planType, 'regular') // Only regular schemes - direct not enabled in store
  ];
  
  if (category) {
    conditions.push(ilike(mutualFunds.category, `%${category}%`));
  }
  
  if (riskLevel) {
    conditions.push(ilike(mutualFunds.riskLevel, `%${riskLevel}%`));
  }
  
  return db
    .select({
      id: mutualFunds.id,
      schemeName: mutualFunds.schemeName,
      schemeCode: mutualFunds.schemeCode,
      category: mutualFunds.category,
      fundHouse: mutualFunds.fundHouse,
      nav: mutualFunds.nav,
      returns1y: mutualFunds.returns1y,
      returns3y: mutualFunds.returns3y,
      returns5y: mutualFunds.returns5y,
      riskLevel: mutualFunds.riskLevel,
      planType: mutualFunds.planType,
      minInvestmentAmount: mutualFunds.minInvestmentAmount,
      minSipAmount: mutualFunds.minSipAmount,
    })
    .from(mutualFunds)
    .where(and(...conditions))
    .limit(limit);
}

async function getStoreEligibleBonds(options: { limit?: number; category?: string } = {}) {
  const { limit = 10, category } = options;
  
  const conditions = [eq(corporateBonds.isPublished, true)];
  
  if (category) {
    conditions.push(ilike(corporateBonds.issuerType, `%${category}%`));
  }
  
  return db
    .select({
      id: corporateBonds.id,
      issuerName: corporateBonds.issuerName,
      isin: corporateBonds.isin,
      couponRate: corporateBonds.couponRate,
      maturityDate: corporateBonds.maturityDate,
      faceValue: corporateBonds.faceValue,
      creditRating: corporateBonds.creditRating,
      minInvestment: corporateBonds.minInvestment,
      issuerType: corporateBonds.issuerType,
    })
    .from(corporateBonds)
    .where(and(...conditions))
    .limit(limit);
}

async function getStoreEligibleAIFs(options: { limit?: number } = {}) {
  const { limit = 5 } = options;
  
  return db
    .select({
      id: aifMaster.id,
      fundName: aifMaster.fundName,
      fundCode: aifMaster.fundCode,
      fundManager: aifMaster.fundManager,
      category: aifMaster.category,
      minInvestment: aifMaster.minInvestment,
      targetReturn: aifMaster.targetReturn,
      riskLevel: aifMaster.riskLevel,
    })
    .from(aifMaster)
    .where(eq(aifMaster.isPublished, true))
    .limit(limit);
}

async function getStoreEligiblePMS(options: { limit?: number } = {}) {
  const { limit = 5 } = options;
  
  return db
    .select({
      id: pmsMaster.id,
      schemeName: pmsMaster.schemeName,
      schemeCode: pmsMaster.schemeCode,
      portfolioManager: pmsMaster.portfolioManager,
      investmentStrategy: pmsMaster.investmentStrategy,
      minInvestment: pmsMaster.minInvestment,
      targetReturn: pmsMaster.targetReturn,
      riskLevel: pmsMaster.riskLevel,
    })
    .from(pmsMaster)
    .where(eq(pmsMaster.isPublished, true))
    .limit(limit);
}

async function getStoreEligibleMLDs(options: { limit?: number } = {}) {
  const { limit = 5 } = options;
  
  return db
    .select({
      id: mldMaster.id,
      productName: mldMaster.productName,
      productCode: mldMaster.productCode,
      issuer: mldMaster.issuer,
      structureType: mldMaster.structureType,
      minInvestment: mldMaster.minInvestment,
      expectedReturn: mldMaster.expectedReturn,
      riskLevel: mldMaster.riskLevel,
    })
    .from(mldMaster)
    .where(eq(mldMaster.isPublished, true))
    .limit(limit);
}

// Build dynamic recommendations from actual store products
async function buildDynamicRecommendations(options: {
  totalAmount: number;
  clientType: string;
  riskTolerance?: string;
  includeEquity?: boolean;
  includeDebt?: boolean;
  includePremium?: boolean;
  allocations: Record<string, number>; // e.g., { 'Large Cap': 25, 'Mid Cap': 20, 'Debt': 25 }
}): Promise<any[]> {
  const { totalAmount, clientType, riskTolerance = 'moderate', includePremium = false, allocations } = options;
  const recommendations: any[] = [];
  
  // Fetch actual store products
  const [largeCaps, midCaps, flexiCaps, debtFunds, liquidFunds, bonds, aiFs, pmsProducts, mlds] = await Promise.all([
    getStoreEligibleMutualFunds({ category: 'Large Cap', limit: 5 }),
    getStoreEligibleMutualFunds({ category: 'Mid Cap', limit: 5 }),
    getStoreEligibleMutualFunds({ category: 'Flexi', limit: 5 }),
    getStoreEligibleMutualFunds({ category: 'Debt', limit: 5 }),
    getStoreEligibleMutualFunds({ category: 'Liquid', limit: 5 }),
    getStoreEligibleBonds({ limit: 5 }),
    includePremium ? getStoreEligibleAIFs({ limit: 3 }) : Promise.resolve([]),
    includePremium ? getStoreEligiblePMS({ limit: 3 }) : Promise.resolve([]),
    includePremium ? getStoreEligibleMLDs({ limit: 3 }) : Promise.resolve([])
  ]);
  
  // Build mutual fund recommendations from actual store products
  let usedAllocation = 0;
  
  // Large Cap allocation
  if (allocations['Large Cap'] && largeCaps.length > 0) {
    const fund = largeCaps[0];
    recommendations.push({
      productType: 'mutual_fund',
      productName: fund.schemeName,
      productCode: fund.schemeCode,
      amc: fund.fundHouse,
      category: fund.category,
      recommendedAmount: Math.round(totalAmount * allocations['Large Cap'] / 100),
      allocationPercentage: allocations['Large Cap'],
      investmentType: 'lumpsum',
      returns1Y: parseFloat(fund.returns1y || '0'),
      returns3Y: parseFloat(fund.returns3y || '0'),
      returns5Y: parseFloat(fund.returns5y || '0'),
      riskRating: fund.riskLevel || 'Moderately High',
      planType: fund.planType, // Will be 'regular' since we filter for it
      selectionReason: `Store-eligible ${fund.category} fund with consistent performance. Regular plan for commission-eligible investment.`
    });
    usedAllocation += allocations['Large Cap'];
  }
  
  // Mid Cap allocation
  if (allocations['Mid Cap'] && midCaps.length > 0) {
    const fund = midCaps[0];
    recommendations.push({
      productType: 'mutual_fund',
      productName: fund.schemeName,
      productCode: fund.schemeCode,
      amc: fund.fundHouse,
      category: fund.category,
      recommendedAmount: Math.round(totalAmount * allocations['Mid Cap'] / 100),
      allocationPercentage: allocations['Mid Cap'],
      investmentType: 'sip',
      sipAmount: Math.round(totalAmount * allocations['Mid Cap'] / 100 / 12),
      returns1Y: parseFloat(fund.returns1y || '0'),
      returns3Y: parseFloat(fund.returns3y || '0'),
      returns5Y: parseFloat(fund.returns5y || '0'),
      riskRating: fund.riskLevel || 'High',
      planType: fund.planType,
      selectionReason: `Store-eligible ${fund.category} fund for growth. SIP recommended for volatility averaging.`
    });
    usedAllocation += allocations['Mid Cap'];
  }
  
  // Flexi Cap allocation
  if (allocations['Flexi Cap'] && flexiCaps.length > 0) {
    const fund = flexiCaps[0];
    recommendations.push({
      productType: 'mutual_fund',
      productName: fund.schemeName,
      productCode: fund.schemeCode,
      amc: fund.fundHouse,
      category: fund.category,
      recommendedAmount: Math.round(totalAmount * allocations['Flexi Cap'] / 100),
      allocationPercentage: allocations['Flexi Cap'],
      investmentType: 'sip',
      sipAmount: Math.round(totalAmount * allocations['Flexi Cap'] / 100 / 12),
      returns1Y: parseFloat(fund.returns1y || '0'),
      returns3Y: parseFloat(fund.returns3y || '0'),
      returns5Y: parseFloat(fund.returns5y || '0'),
      riskRating: fund.riskLevel || 'Moderately High',
      planType: fund.planType,
      selectionReason: `Store-eligible ${fund.category} fund offering flexibility across market caps.`
    });
    usedAllocation += allocations['Flexi Cap'];
  }
  
  // Debt/Corporate Bond allocation
  if ((allocations['Debt'] || allocations['Corporate Bond']) && debtFunds.length > 0) {
    const allocation = allocations['Debt'] || allocations['Corporate Bond'];
    const fund = debtFunds[0];
    recommendations.push({
      productType: 'mutual_fund',
      productName: fund.schemeName,
      productCode: fund.schemeCode,
      amc: fund.fundHouse,
      category: fund.category,
      recommendedAmount: Math.round(totalAmount * allocation / 100),
      allocationPercentage: allocation,
      investmentType: 'lumpsum',
      returns1Y: parseFloat(fund.returns1y || '0'),
      returns3Y: parseFloat(fund.returns3y || '0'),
      returns5Y: parseFloat(fund.returns5y || '0'),
      riskRating: fund.riskLevel || 'Moderate',
      planType: fund.planType,
      selectionReason: `Store-eligible debt fund for portfolio stability and regular income generation.`
    });
    usedAllocation += allocation;
  }
  
  // Liquid Fund allocation
  if (allocations['Liquid'] && liquidFunds.length > 0) {
    const fund = liquidFunds[0];
    recommendations.push({
      productType: 'mutual_fund',
      productName: fund.schemeName,
      productCode: fund.schemeCode,
      amc: fund.fundHouse,
      category: fund.category,
      recommendedAmount: Math.round(totalAmount * allocations['Liquid'] / 100),
      allocationPercentage: allocations['Liquid'],
      investmentType: 'lumpsum',
      returns1Y: parseFloat(fund.returns1y || '0'),
      riskRating: fund.riskLevel || 'Low',
      planType: fund.planType,
      selectionReason: `Store-eligible liquid fund for emergency liquidity and T+0 redemption facility.`
    });
    usedAllocation += allocations['Liquid'];
  }
  
  // Bond allocation (for corporate/institutional clients)
  if (allocations['Bonds'] && bonds.length > 0) {
    const bond = bonds[0];
    recommendations.push({
      productType: 'bond',
      productName: `${bond.issuerName} - ${bond.couponRate}%`,
      productCode: bond.isin,
      amc: bond.issuerName,
      category: bond.issuerType || 'Corporate NCD',
      recommendedAmount: Math.round(totalAmount * allocations['Bonds'] / 100),
      allocationPercentage: allocations['Bonds'],
      investmentType: 'lumpsum',
      returns1Y: parseFloat(bond.couponRate || '0'),
      riskRating: bond.creditRating || 'Moderate',
      selectionReason: `${bond.creditRating}-rated bond for stable income and capital preservation.`
    });
    usedAllocation += allocations['Bonds'];
  }
  
  // Premium products for HNI/Ultra HNI
  if (includePremium) {
    // PMS allocation
    if (allocations['PMS'] && pmsProducts.length > 0) {
      const pms = pmsProducts[0];
      recommendations.push({
        productType: 'pms',
        productName: pms.schemeName,
        productCode: pms.schemeCode,
        amc: pms.portfolioManager,
        category: pms.investmentStrategy || 'PMS',
        recommendedAmount: Math.round(totalAmount * allocations['PMS'] / 100),
        allocationPercentage: allocations['PMS'],
        investmentType: 'lumpsum',
        minInvestment: parseFloat(pms.minInvestment || '5000000'),
        returns1Y: parseFloat(pms.targetReturn || '0'),
        riskRating: pms.riskLevel || 'Moderately High',
        selectionReason: `Premium PMS for alpha generation with professional portfolio management.`
      });
      usedAllocation += allocations['PMS'];
    }
    
    // AIF allocation
    if (allocations['AIF'] && aiFs.length > 0) {
      const aif = aiFs[0];
      recommendations.push({
        productType: 'aif',
        productName: aif.fundName,
        productCode: aif.fundCode,
        amc: aif.fundManager,
        category: aif.category || 'AIF',
        recommendedAmount: Math.round(totalAmount * allocations['AIF'] / 100),
        allocationPercentage: allocations['AIF'],
        investmentType: 'lumpsum',
        minInvestment: parseFloat(aif.minInvestment || '10000000'),
        returns1Y: parseFloat(aif.targetReturn || '0'),
        riskRating: aif.riskLevel || 'High',
        selectionReason: `Alternative investment fund for concentrated high-conviction exposure.`
      });
      usedAllocation += allocations['AIF'];
    }
    
    // MLD allocation
    if (allocations['Alternatives'] && mlds.length > 0) {
      const mld = mlds[0];
      recommendations.push({
        productType: 'mld',
        productName: mld.productName,
        productCode: mld.productCode,
        amc: mld.issuer,
        category: mld.structureType || 'Market Linked Debenture',
        recommendedAmount: Math.round(totalAmount * allocations['Alternatives'] / 100),
        allocationPercentage: allocations['Alternatives'],
        investmentType: 'lumpsum',
        minInvestment: parseFloat(mld.minInvestment || '1000000'),
        returns1Y: parseFloat(mld.expectedReturn || '0'),
        riskRating: mld.riskLevel || 'Moderately High',
        selectionReason: `Market-linked structured product for tax-efficient equity-linked returns.`
      });
      usedAllocation += allocations['Alternatives'];
    }
  }
  
  // If no store products found, provide informative fallback
  if (recommendations.length === 0) {
    recommendations.push({
      productType: 'mutual_fund',
      productName: 'Store products pending configuration',
      productCode: 'PENDING',
      amc: 'Configure Store',
      category: 'Awaiting Setup',
      recommendedAmount: totalAmount,
      allocationPercentage: 100,
      investmentType: 'lumpsum',
      riskRating: 'N/A',
      selectionReason: 'Please configure store-eligible mutual funds (Regular plan) to generate personalized recommendations.'
    });
  }
  
  return recommendations;
}
import { nanoid } from "nanoid";
import multer from "multer";
import { PDFParse } from "pdf-parse";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  }
});

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
        // Premium rebalancing for HNI/Ultra HNI/Trust/Institutional - use actual store products
        targetAllocation = clientType === 'ultra_hni' 
          ? { 'PMS': 35, 'AIF': 25, 'Large Cap': 20, 'Debt': 15, 'Alternatives': 5 }
          : { 'PMS': 30, 'Large Cap': 30, 'AIF': 15, 'Debt': 20, 'Bonds': 5 };
        
        // Fetch recommendations from store with premium products
        recommendations = await buildDynamicRecommendations({
          totalAmount: totalValue,
          clientType,
          riskTolerance: 'aggressive',
          includePremium: true,
          allocations: targetAllocation
        });
        projectedReturns = Math.round(16.5 * config.riskModifier * 10) / 10;
      } else if (clientType === 'corporate') {
        // Conservative treasury rebalancing for corporate - use actual store products
        targetAllocation = { 'Liquid': 30, 'Debt': 45, 'Bonds': 25 };
        
        // Fetch recommendations from store - Regular plan with treasury focus
        recommendations = await buildDynamicRecommendations({
          totalAmount: totalValue,
          clientType,
          riskTolerance: 'conservative',
          includePremium: false,
          allocations: targetAllocation
        });
        projectedReturns = Math.round(7.5 * config.riskModifier * 10) / 10;
      } else if (clientType === 'nri') {
        // NRI-compliant rebalancing - use actual store products
        targetAllocation = { 'Flexi Cap': 40, 'Debt': 25, 'Large Cap': 25, 'Bonds': 10 };
        
        // Fetch recommendations from store - Regular plan NRI-eligible
        recommendations = await buildDynamicRecommendations({
          totalAmount: totalValue,
          clientType,
          riskTolerance: 'moderate',
          includePremium: false,
          allocations: targetAllocation
        });
        projectedReturns = Math.round(12.5 * config.riskModifier * 10) / 10;
      } else {
        // Standard retail investor rebalancing - use actual store-eligible products (Regular plan only)
        targetAllocation = {
          'Large Cap': 25,
          'Mid Cap': 20,
          'Flexi Cap': 15,
          'Debt': 25,
          'Bonds': 15
        };

        // Fetch recommendations from store - Regular plan mutual funds only
        recommendations = await buildDynamicRecommendations({
          totalAmount: totalValue,
          clientType,
          riskTolerance: 'moderate',
          includePremium: false,
          allocations: targetAllocation
        });
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

      // Generate client-type specific recommendations - use actual store products
      if (config.premiumProducts && (clientType === 'hni' || clientType === 'ultra_hni' || clientType === 'trust' || clientType === 'institutional')) {
        // Premium products for HNI/Ultra HNI/Trust/Institutional clients
        targetAllocation = clientType === 'ultra_hni' 
          ? { 'PMS': 35, 'AIF': 25, 'Large Cap': 20, 'Debt': 15, 'Alternatives': 5 }
          : { 'PMS': 30, 'Large Cap': 30, 'AIF': 15, 'Debt': 20, 'Bonds': 5 };
        
        // Fetch recommendations from store with premium products
        recommendations = await buildDynamicRecommendations({
          totalAmount,
          clientType,
          riskTolerance: 'aggressive',
          includePremium: true,
          allocations: targetAllocation
        });
        projectedReturns = Math.round(16.5 * adjustedReturns * 10) / 10;
      } else if (clientType === 'corporate') {
        // Conservative treasury-focused products for corporate clients
        targetAllocation = { 'Liquid': 30, 'Debt': 45, 'Bonds': 25 };
        
        // Fetch recommendations from store - Regular plan treasury focus
        recommendations = await buildDynamicRecommendations({
          totalAmount,
          clientType,
          riskTolerance: 'conservative',
          includePremium: false,
          allocations: targetAllocation
        });
        projectedReturns = Math.round(7.5 * adjustedReturns * 10) / 10;
      } else if (clientType === 'nri') {
        // NRI-compliant products
        targetAllocation = { 'Flexi Cap': 40, 'Debt': 25, 'Large Cap': 25, 'Bonds': 10 };
        
        // Fetch recommendations from store - Regular plan NRI-eligible
        recommendations = await buildDynamicRecommendations({
          totalAmount,
          clientType,
          riskTolerance: 'moderate',
          includePremium: false,
          allocations: targetAllocation
        });
        projectedReturns = Math.round(12.5 * adjustedReturns * 10) / 10;
      } else {
        // Standard retail investor recommendations - use actual store products (Regular plan only)
        targetAllocation = riskTolerance === 'aggressive' 
          ? { 'Large Cap': 35, 'Mid Cap': 25, 'Flexi Cap': 20, 'Debt': 15, 'Bonds': 5 }
          : riskTolerance === 'conservative'
            ? { 'Large Cap': 20, 'Debt': 40, 'Bonds': 30, 'Flexi Cap': 10 }
            : { 'Large Cap': 30, 'Mid Cap': 20, 'Flexi Cap': 15, 'Debt': 25, 'Bonds': 10 };
        
        // Fetch recommendations from store - Regular plan mutual funds only
        recommendations = await buildDynamicRecommendations({
          totalAmount,
          clientType,
          riskTolerance: riskTolerance || 'moderate',
          includePremium: false,
          allocations: targetAllocation
        });
        projectedReturns = Math.round((riskTolerance === 'aggressive' ? 14 : riskTolerance === 'conservative' ? 9 : 11.5) * adjustedReturns * 10) / 10;
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

// ============ PDF HOLDING REPORT PARSING ============

interface ParsedHolding {
  fundName: string;
  investedAmount: number;
  currentValue: number;
  units: number;
  nav: number;
  unrealizedGain: number;
  unrealizedGainPercent: number;
  xirr: number;
  holdingDays?: number;
  purchaseDate?: string;
  assetClass: string;
  category?: string;
}

interface ParsedClientInfo {
  name: string;
  crn?: string;
  pan?: string;
}

interface ParsedHoldingReport {
  clientInfo: ParsedClientInfo;
  summary: {
    totalInvested: number;
    currentValue: number;
    unrealizedGain: number;
    unrealizedGainPercent: number;
    xirr: number;
  };
  holdings: ParsedHolding[];
  reportDate?: string;
}

function parseAmountFromText(text: string): number {
  const cleaned = text.replace(/[₹,\s]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function parsePercentFromText(text: string): number {
  const match = text.match(/-?\d+\.?\d*/);
  return match ? parseFloat(match[0]) : 0;
}

function parseHoldingReportPdf(text: string): ParsedHoldingReport {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l);
  
  // Extract client info
  const clientInfo: ParsedClientInfo = { name: '' };
  
  // Look for client name and PAN
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // PAN pattern: AAAAA0000A
    const panMatch = line.match(/PAN:\s*([A-Z]{5}[0-9]{4}[A-Z])/i);
    if (panMatch) {
      clientInfo.pan = panMatch[1].toUpperCase();
    }
    
    // CRN pattern
    const crnMatch = line.match(/CRN:\s*(\w+)/i);
    if (crnMatch) {
      clientInfo.crn = crnMatch[1];
    }
    
    // Look for name before CRN/PAN
    if (line.includes('Hello!')) {
      // Name is usually in the lines after Hello
      for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
        const nameLine = lines[j];
        if (nameLine.match(/^[A-Z\s]+,?$/) && !nameLine.includes('CRN') && !nameLine.includes('PAN')) {
          clientInfo.name = nameLine.replace(/,/g, '').trim();
          break;
        }
      }
    }
  }
  
  // Extract summary - look for "Total Invested", "Current Value", etc.
  let totalInvested = 0;
  let currentValue = 0;
  let totalUnrealizedGain = 0;
  let totalXirr = 0;
  
  const summaryPattern = /Total Invested.*?₹([\d,]+).*?Current Value.*?₹([\d,]+).*?Unrealised Gain.*?₹([\d,]+).*?\(([\d.-]+)%\).*?XIRR.*?([\d.-]+)%/is;
  const summaryMatch = text.match(summaryPattern);
  if (summaryMatch) {
    totalInvested = parseAmountFromText(summaryMatch[1]);
    currentValue = parseAmountFromText(summaryMatch[2]);
    totalUnrealizedGain = parseAmountFromText(summaryMatch[3]);
    totalXirr = parseFloat(summaryMatch[5]) || 0;
  } else {
    // Alternative parsing - look for key-value pairs
    const investedMatch = text.match(/Total Invested\s*₹([\d,]+)/i);
    const valueMatch = text.match(/Current Value\s*₹([\d,]+)/i);
    const gainMatch = text.match(/Unrealised Gain\s*₹([\d,]+)/i);
    const xirrMatch = text.match(/XIRR\s*([\d.-]+)%/i);
    
    if (investedMatch) totalInvested = parseAmountFromText(investedMatch[1]);
    if (valueMatch) currentValue = parseAmountFromText(valueMatch[1]);
    if (gainMatch) totalUnrealizedGain = parseAmountFromText(gainMatch[1]);
    if (xirrMatch) totalXirr = parseFloat(xirrMatch[1]) || 0;
  }
  
  // Extract individual holdings
  const holdings: ParsedHolding[] = [];
  
  // Pattern for mutual fund holdings: Fund Name (G) followed by amounts
  // Look for patterns like: "Invesco India Large & Mid Cap Fund (G)     ₹1,00,000           ₹1,12,521"
  const fundPatterns = [
    /([A-Za-z\s&]+Fund\s*\([GD]\))\s*₹([\d,]+)\s*₹([\d,]+)\s*₹?([\d,-]+)\s*\(([\d.-]+)%\)\s*([\d.-]+)%\s*([\d.]+)%/gi,
    /([A-Za-z\s&]+Fund\s*\([GD]\))\s*₹([\d,]+)\s*₹([\d,]+)\s*[₹\-]?([\d,]+)\s*\(?([+-]?[\d.]+)%?\)?\s*([+-]?[\d.]+)%/gi
  ];
  
  // Also try to find the table section with fund details
  const tableSection = text.match(/Equity Mutual Fund.*?Total\s*₹[\d,]+/is);
  if (tableSection) {
    const tableText = tableSection[0];
    
    // Match each fund entry with its details
    const fundRegex = /([A-Za-z][A-Za-z\s&]+(?:Fund|Cap Fund|Flexicap Fund)[^₹]*)\s*₹([\d,]+)\s*₹([\d,]+)\s*[₹]?([-\d,]+)\s*\(?([+-]?[\d.]+)%?\)?\s*([+-]?[\d.]+)%?\s*([\d.]+)%/gi;
    let match;
    
    while ((match = fundRegex.exec(tableText)) !== null) {
      const fundName = match[1].replace(/\s+/g, ' ').trim();
      const invested = parseAmountFromText(match[2]);
      const current = parseAmountFromText(match[3]);
      const gainAmount = parseAmountFromText(match[4]);
      const gainPercent = parsePercentFromText(match[5]);
      const xirr = parsePercentFromText(match[6]);
      
      if (fundName && invested > 0) {
        holdings.push({
          fundName,
          investedAmount: invested,
          currentValue: current,
          units: 0,
          nav: 0,
          unrealizedGain: gainAmount,
          unrealizedGainPercent: gainPercent,
          xirr,
          assetClass: 'Equity',
          category: 'Mutual Fund'
        });
      }
    }
  }
  
  // If regex didn't work, try line-by-line parsing for known fund names
  if (holdings.length === 0) {
    const knownFundPatterns = [
      /Invesco India.*Fund/i,
      /Nippon India.*Fund/i,
      /Sundaram.*Fund/i,
      /JM.*Fund/i,
      /HDFC.*Fund/i,
      /ICICI.*Fund/i,
      /SBI.*Fund/i,
      /Axis.*Fund/i,
      /Kotak.*Fund/i
    ];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const pattern of knownFundPatterns) {
        if (pattern.test(line)) {
          // Found a fund name, look for amounts in nearby lines
          const combinedText = lines.slice(i, Math.min(i + 5, lines.length)).join(' ');
          const amountMatch = combinedText.match(/₹([\d,]+).*?₹([\d,]+)/);
          const percentMatch = combinedText.match(/\(([\d.-]+)%\)/);
          const xirrMatch = combinedText.match(/([\d.-]+)%\s+[\d.]+%/);
          
          if (amountMatch) {
            const fundName = line.match(/([A-Za-z][A-Za-z\s&]+(?:Fund|Cap Fund)[^₹]*)/)?.[1]?.trim() || line;
            
            holdings.push({
              fundName: fundName.replace(/\s+/g, ' ').trim(),
              investedAmount: parseAmountFromText(amountMatch[1]),
              currentValue: parseAmountFromText(amountMatch[2]),
              units: 0,
              nav: 0,
              unrealizedGain: 0,
              unrealizedGainPercent: percentMatch ? parseFloat(percentMatch[1]) : 0,
              xirr: xirrMatch ? parseFloat(xirrMatch[1]) : 0,
              assetClass: 'Equity',
              category: 'Mutual Fund'
            });
          }
          break;
        }
      }
    }
  }
  
  // Parse detailed holdings section to get units and NAV
  const detailPatterns = /Detailed Holdings Statement for ([^₹]+)\s+.*?Total\s+Invested.*?₹([\d,]+).*?Current.*?Value.*?₹([\d,]+).*?XIRR.*?([\d.-]+)%.*?Units:\s*([\d,.]+).*?NAV:\s*([\d,.]+)/gis;
  let detailMatch;
  while ((detailMatch = detailPatterns.exec(text)) !== null) {
    const fundName = detailMatch[1].replace(/\s+/g, ' ').trim();
    const units = parseFloat(detailMatch[5].replace(/,/g, '')) || 0;
    const nav = parseFloat(detailMatch[6].replace(/,/g, '')) || 0;
    
    // Update existing holding with units and NAV
    const holding = holdings.find(h => 
      h.fundName.toLowerCase().includes(fundName.toLowerCase().split(' ')[0]) ||
      fundName.toLowerCase().includes(h.fundName.toLowerCase().split(' ')[0])
    );
    if (holding) {
      holding.units = units;
      holding.nav = nav;
    }
  }
  
  // Extract report date
  const dateMatch = text.match(/(\d{1,2}[-\/]?[A-Za-z]{3}[-\/]?\d{2,4}|\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/);
  const reportDate = dateMatch ? dateMatch[1] : undefined;
  
  return {
    clientInfo,
    summary: {
      totalInvested,
      currentValue,
      unrealizedGain: totalUnrealizedGain,
      unrealizedGainPercent: totalInvested > 0 ? ((currentValue - totalInvested) / totalInvested) * 100 : 0,
      xirr: totalXirr
    },
    holdings,
    reportDate
  };
}

// Parse holding report PDF
router.post("/api/agent/parse-holding-report", upload.single('file'), async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: "PDF file is required" });
    }

    // Parse PDF using PDFParse class (v2 API)
    const parser = new PDFParse({ data: file.buffer });
    const pdfData = await parser.getText();
    const text = pdfData.text;
    await parser.destroy();
    
    console.log("[PDF Parse] Extracted text length:", text.length);
    
    // Parse the holding report
    const parsedReport = parseHoldingReportPdf(text);
    
    console.log("[PDF Parse] Parsed holdings:", parsedReport.holdings.length);
    console.log("[PDF Parse] Client info:", parsedReport.clientInfo);
    
    res.json({
      success: true,
      fileName: file.originalname,
      parsedData: parsedReport,
      rawTextLength: text.length
    });
  } catch (error: any) {
    console.error("Parse holding report error:", error);
    res.status(500).json({ error: error.message || "Failed to parse holding report" });
  }
});

export default router;
