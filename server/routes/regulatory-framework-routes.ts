import { Router, Request, Response } from "express";
import { regulatoryFrameworkService } from "../services/regulatory-framework-service";
import { z } from "zod";

const router = Router();

// Schema validations
const classifyInvestorSchema = z.object({
  investmentAmount: z.number().optional(),
  netWorth: z.number().optional(),
  kycTier: z.string().optional(),
  entityType: z.string().optional(),
});

const checkEligibilitySchema = z.object({
  productCategory: z.string(),
  investmentAmount: z.number(),
  isin: z.string().optional(),
});

const createOverrideProposalSchema = z.object({
  userId: z.string(),
  productCategory: z.string(),
  productSubCategory: z.string().optional(),
  isin: z.string().optional(),
  overrideType: z.string(),
  currentInvestorType: z.string().optional(),
  proposedInvestorType: z.string().optional(),
  currentMinInvestment: z.number().optional(),
  proposedMinInvestment: z.number().optional(),
  currentMaxInvestment: z.number().optional(),
  proposedMaxInvestment: z.number().optional(),
  currentBrokeragePercent: z.number().optional(),
  proposedBrokeragePercent: z.number().optional(),
  justification: z.string(),
  validFrom: z.string().transform(s => new Date(s)),
  validUntil: z.string().transform(s => new Date(s)),
});

const reviewProposalSchema = z.object({
  reviewLevel: z.enum(['level1', 'level2', 'final']),
  decision: z.enum(['approved', 'rejected', 'escalated']),
  notes: z.string(),
});

/**
 * GET /api/regulatory/classification-rules
 * Get all active investor classification rules
 */
router.get("/classification-rules", async (req: Request, res: Response) => {
  try {
    const rules = [];
    for (const type of ['retail', 'sHNI', 'bHNI', 'qib', 'anchor']) {
      const rule = await regulatoryFrameworkService.getClassificationRule(type);
      if (rule) rules.push(rule);
    }
    res.json(rules);
  } catch (error: any) {
    console.error("Error fetching classification rules:", error);
    res.status(500).json({ error: "Failed to fetch classification rules" });
  }
});

/**
 * POST /api/regulatory/classify-investor
 * Auto-classify investor based on investment amount, net worth, KYC tier
 */
router.post("/classify-investor", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const validationResult = classifyInvestorSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ error: validationResult.error.issues });
    }

    const { investmentAmount, netWorth, kycTier, entityType } = validationResult.data;

    const classification = await regulatoryFrameworkService.classifyInvestor(
      userId,
      investmentAmount,
      netWorth,
      kycTier,
      entityType
    );

    res.json({
      success: true,
      classification,
    });
  } catch (error: any) {
    console.error("Error classifying investor:", error);
    res.status(500).json({ error: "Failed to classify investor" });
  }
});

/**
 * POST /api/regulatory/save-classification
 * Save investor classification to user profile
 */
router.post("/save-classification", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const { classificationType, classificationBasis, investmentAmount, netWorth } = req.body;

    if (!classificationType || !classificationBasis) {
      return res.status(400).json({ error: "classificationType and classificationBasis are required" });
    }

    const classification = await regulatoryFrameworkService.saveUserClassification(userId, {
      classificationType,
      classificationBasis,
      investmentAmount,
      netWorth,
    });

    res.json({
      success: true,
      classification,
    });
  } catch (error: any) {
    console.error("Error saving classification:", error);
    res.status(500).json({ error: "Failed to save classification" });
  }
});

/**
 * GET /api/regulatory/my-classification
 * Get current user's investor classification
 */
router.get("/my-classification", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const classification = await regulatoryFrameworkService.getUserClassification(userId);

    if (!classification) {
      return res.json({
        success: true,
        classification: null,
        message: "No classification found. Classification will be auto-determined on first investment.",
      });
    }

    res.json({
      success: true,
      classification,
    });
  } catch (error: any) {
    console.error("Error fetching user classification:", error);
    res.status(500).json({ error: "Failed to fetch user classification" });
  }
});

/**
 * GET /api/regulatory/brokerage-structure/:investorType/:productCategory
 * Get brokerage structure for investor type and product category
 */
router.get("/brokerage-structure/:investorType/:productCategory", async (req: Request, res: Response) => {
  try {
    const { investorType, productCategory } = req.params;

    const structure = await regulatoryFrameworkService.getBrokerageStructure(
      investorType,
      productCategory
    );

    res.json({
      success: true,
      brokerageStructure: structure,
    });
  } catch (error: any) {
    console.error("Error fetching brokerage structure:", error);
    res.status(500).json({ error: "Failed to fetch brokerage structure" });
  }
});

/**
 * POST /api/regulatory/calculate-costs
 * Calculate transaction costs for an investment
 */
router.post("/calculate-costs", async (req: Request, res: Response) => {
  try {
    const { investmentAmount, investorType, productCategory } = req.body;

    if (!investmentAmount || !investorType || !productCategory) {
      return res.status(400).json({ 
        error: "investmentAmount, investorType, and productCategory are required" 
      });
    }

    const brokerageStructure = await regulatoryFrameworkService.getBrokerageStructure(
      investorType,
      productCategory
    );

    const costs = regulatoryFrameworkService.calculateTransactionCosts(
      investmentAmount,
      brokerageStructure
    );

    res.json({
      success: true,
      investmentAmount,
      investorType,
      productCategory,
      brokerageStructure,
      transactionCosts: costs,
    });
  } catch (error: any) {
    console.error("Error calculating costs:", error);
    res.status(500).json({ error: "Failed to calculate transaction costs" });
  }
});

/**
 * POST /api/regulatory/check-eligibility
 * Check if user is eligible for a product
 */
router.post("/check-eligibility", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const validationResult = checkEligibilitySchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ error: validationResult.error.issues });
    }

    const { productCategory, investmentAmount, isin } = validationResult.data;

    const eligibility = await regulatoryFrameworkService.checkProductEligibility(
      userId,
      productCategory,
      investmentAmount,
      isin
    );

    res.json({
      success: true,
      eligibility,
    });
  } catch (error: any) {
    console.error("Error checking eligibility:", error);
    res.status(500).json({ error: "Failed to check product eligibility" });
  }
});

/**
 * POST /api/regulatory/override-proposals
 * Create a new override proposal (Admin/Partner/Agent)
 */
router.post("/override-proposals", async (req: Request, res: Response) => {
  try {
    const proposedBy = (req as any).user?.id;
    if (!proposedBy) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Check if user has permission to create proposals (admin, partner, agent)
    const userRole = (req as any).user?.role || 'client';
    if (!['admin', 'partner', 'agent'].includes(userRole)) {
      return res.status(403).json({ 
        error: "Only Admin, Partner, or Agent can create override proposals" 
      });
    }

    const validationResult = createOverrideProposalSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ error: validationResult.error.issues });
    }

    const proposal = await regulatoryFrameworkService.createOverrideProposal({
      ...validationResult.data,
      proposedBy,
      proposerRole: userRole,
    });

    res.json({
      success: true,
      proposal,
    });
  } catch (error: any) {
    console.error("Error creating override proposal:", error);
    res.status(500).json({ error: "Failed to create override proposal" });
  }
});

/**
 * GET /api/regulatory/override-proposals
 * Get override proposals (filtered by status/role)
 */
router.get("/override-proposals", async (req: Request, res: Response) => {
  try {
    const { status, proposerRole } = req.query;

    const proposals = await regulatoryFrameworkService.getPendingProposals({
      status: status as string,
      proposerRole: proposerRole as string,
    });

    res.json({
      success: true,
      proposals,
    });
  } catch (error: any) {
    console.error("Error fetching override proposals:", error);
    res.status(500).json({ error: "Failed to fetch override proposals" });
  }
});

/**
 * POST /api/regulatory/override-proposals/:id/review
 * Review an override proposal (Compliance/Admin)
 */
router.post("/override-proposals/:id/review", async (req: Request, res: Response) => {
  try {
    const reviewedBy = (req as any).user?.id;
    if (!reviewedBy) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const { id } = req.params;

    const validationResult = reviewProposalSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ error: validationResult.error.issues });
    }

    const { reviewLevel, decision, notes } = validationResult.data;

    const updatedProposal = await regulatoryFrameworkService.reviewOverrideProposal(
      id,
      reviewLevel,
      reviewedBy,
      decision,
      notes
    );

    res.json({
      success: true,
      proposal: updatedProposal,
    });
  } catch (error: any) {
    console.error("Error reviewing proposal:", error);
    res.status(500).json({ error: error.message || "Failed to review proposal" });
  }
});

/**
 * GET /api/regulatory/risk-disclosures/:productCategory
 * Get risk disclosure templates for product category
 */
router.get("/risk-disclosures/:productCategory", async (req: Request, res: Response) => {
  try {
    const { productCategory } = req.params;
    const { disclosureType } = req.query;

    const templates = await regulatoryFrameworkService.getRiskDisclosureTemplates(
      productCategory,
      disclosureType as string
    );

    res.json({
      success: true,
      templates,
    });
  } catch (error: any) {
    console.error("Error fetching risk disclosure templates:", error);
    res.status(500).json({ error: "Failed to fetch risk disclosure templates" });
  }
});

/**
 * POST /api/regulatory/seed-defaults
 * Seed default classification rules, brokerage structures, and eligibility rules (Admin only)
 */
router.post("/seed-defaults", async (req: Request, res: Response) => {
  try {
    const userRole = (req as any).user?.role || 'client';
    if (userRole !== 'admin') {
      return res.status(403).json({ error: "Admin access required" });
    }

    await regulatoryFrameworkService.seedDefaultClassificationRules();
    await regulatoryFrameworkService.seedDefaultBrokerageStructures();
    await regulatoryFrameworkService.seedDefaultEligibilityRules();

    res.json({
      success: true,
      message: "Default regulatory framework data seeded successfully",
    });
  } catch (error: any) {
    console.error("Error seeding defaults:", error);
    res.status(500).json({ error: "Failed to seed default data" });
  }
});

/**
 * GET /api/regulatory/investor-types
 * Get investor type summary with thresholds and features
 */
router.get("/investor-types", async (_req: Request, res: Response) => {
  try {
    const investorTypes = [
      {
        type: "retail",
        displayName: "Retail Individual Investor (RII)",
        minInvestment: 10000,
        maxInvestment: 200000,
        features: [
          "35% IPO quota reservation",
          "Lottery-based allotment",
          "Can bid at cut-off price",
          "No lock-in period",
          "Basic KYC sufficient",
        ],
        brokerageRange: "0.50%",
        typicalYieldImpact: "60 bps",
      },
      {
        type: "sHNI",
        displayName: "Small HNI (sHNI)",
        minInvestment: 200001,
        maxInvestment: 1000000,
        features: [
          "5% NII quota reservation",
          "Lottery-based allotment",
          "Minimum 1 lot guaranteed",
          "Cannot bid at cut-off",
          "Enhanced KYC required",
        ],
        brokerageRange: "0.35%",
        typicalYieldImpact: "45 bps",
      },
      {
        type: "bHNI",
        displayName: "Big HNI (bHNI)",
        minInvestment: 1000001,
        maxInvestment: null,
        features: [
          "10% NII quota reservation",
          "Lottery-based allotment",
          "No upper investment limit",
          "Cannot bid at cut-off",
          "Enhanced KYC required",
        ],
        brokerageRange: "0.25%",
        typicalYieldImpact: "32 bps",
      },
      {
        type: "qib",
        displayName: "Qualified Institutional Buyer (QIB)",
        minInvestment: null,
        maxInvestment: null,
        netWorthRequired: 10000000000,
        features: [
          "50% IPO quota reservation",
          "Proportionate allotment",
          "SEBI registration required",
          "Annual status renewal",
          "Accredited investor KYC",
        ],
        brokerageRange: "0.10%",
        typicalYieldImpact: "15 bps",
        eligibleEntities: ["Mutual Funds", "Insurance", "Pension Funds", "FPIs", "Banks", "NBFCs"],
      },
      {
        type: "anchor",
        displayName: "Anchor Investor",
        minInvestment: 100000000,
        maxInvestment: null,
        features: [
          "Up to 60% of QIB quota",
          "Bid 1 day before IPO opens",
          "Direct allotment",
          "30-90 days lock-in",
          "SEBI registration required",
        ],
        brokerageRange: "0.05%",
        typicalYieldImpact: "8 bps",
      },
    ];

    res.json({
      success: true,
      investorTypes,
      sebiThresholds: {
        retailMax: 200000,
        sHniMax: 1000000,
        qibMinNetWorth: 10000000000,
        anchorMinInvestment: 100000000,
      },
    });
  } catch (error: any) {
    console.error("Error fetching investor types:", error);
    res.status(500).json({ error: "Failed to fetch investor types" });
  }
});

export default router;
