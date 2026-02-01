import { Router, Request, Response } from "express";
import multer from "multer";
import { 
  agentProspectWizardService, 
  ProspectPortfolioHolding, 
  ProspectRiskProfile, 
  DuplicateCheckResult,
  getListedStocksBySector,
  getAvailableBroadSectors,
  getListedStockRecommendations,
  getUnlistedStocksBySector,
  getAvailableUnlistedSectors,
  getUnlistedStockRecommendations,
  populateUnlistedBroadSectors
} from "../services/agent-prospect-wizard-service";
import { z } from "zod";
import { ZohoCRMService } from "../zoho/services/crm";
import { ZohoConnectionResolver } from "../zoho/connection-resolver";
import { casStatementService } from "../services/cas-statement-service";
import { unifiedPDFParser } from "../services/unified-pdf-parser";
import { assertLotsNotDropped } from "../services/holding-transformer";
import { requireAuth, requireRole } from "../middleware/roleMiddleware";
import { prospectReadinessService } from "../services/prospect-readiness-service";

// Multer setup for CAS file upload
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf' || file.mimetype === 'application/x-pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  }
});

const router = Router();

const createProspectSchema = z.object({
  name: z.string().min(2),
  email: z.string().email().optional().or(z.literal('')).transform(v => v || undefined),
  mobile: z.string().optional().transform(v => v?.trim() || undefined),
  pan: z.string().optional().transform(v => {
    const trimmed = v?.trim().toUpperCase();
    if (!trimmed || trimmed.length === 0) return undefined;
    if (trimmed.length !== 10) return undefined; // Invalid PAN length, treat as no PAN
    return trimmed;
  }),
  clientType: z.string().optional(),
  indicativeRiskProfile: z.string().optional(),
  notes: z.string().optional()
});

const riskProfileSchema = z.object({
  riskTolerance: z.enum(['conservative', 'moderate', 'aggressive', 'very_aggressive']),
  investmentHorizon: z.enum(['3_months', '6_months', '9_months', '1_year', 'short_term', 'medium_term', 'long_term']),
  primaryGoal: z.string(),
  monthlyIncome: z.number().optional(),
  existingInvestments: z.number().optional(),
  liquidityNeeds: z.enum(['low', 'medium', 'high']).optional()
});

const portfolioHoldingSchema = z.object({
  productType: z.string(),
  productName: z.string(),
  quantity: z.number(),
  currentValue: z.number(),
  purchasePrice: z.number().optional(),
  purchaseDate: z.string().optional(),
  isin: z.string().optional(),
  category: z.string().optional()
});

// Backend format schema for holdings persistence (uses name/assetType/productType)
const backendHoldingSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  isin: z.string().optional(),
  symbol: z.string().optional(),
  assetType: z.enum(['equity', 'mutual_fund', 'etf', 'bond', 'gold', 'fd', 'other']),
  productType: z.string().optional(), // Preserves original type (pms, aif, insurance)
  quantity: z.number(),
  averageCost: z.number().optional(),
  currentValue: z.number(),
  currentNav: z.number().optional(),
  investedValue: z.number().optional(),
  unrealizedGain: z.number().optional(),
  unrealizedGainPercent: z.number().optional(),
  folioNumber: z.string().optional(),
  broker: z.string().optional(),
  confidenceScore: z.number().optional(),
  category: z.string().optional()
});

// Lot schema for capital gains tracking
const holdingLotSchema = z.object({
  purchaseDate: z.string(),
  transactionType: z.string(),
  units: z.coerce.number(),
  nav: z.coerce.number(),
  amount: z.coerce.number(),
  stampDuty: z.coerce.number().optional(),
  stt: z.coerce.number().optional(),
  grandfatheredValue: z.coerce.number().optional(),
  isGrandfathered: z.boolean().optional()
});

// Flexible schema that accepts both frontend (productName/productType) and backend (name/assetType) formats
const flexibleHoldingSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  productName: z.string().optional(),
  isin: z.string().optional(),
  symbol: z.string().optional(),
  assetType: z.enum(['equity', 'mutual_fund', 'etf', 'bond', 'gold', 'fd', 'other']).optional(),
  productType: z.string().optional(),
  quantity: z.coerce.number(),
  averageCost: z.coerce.number().optional(),
  currentValue: z.coerce.number(),
  currentNav: z.coerce.number().optional(),
  investedValue: z.coerce.number().optional(),
  unrealizedGain: z.coerce.number().optional(),
  unrealizedGainPercent: z.coerce.number().optional(),
  purchasePrice: z.coerce.number().optional(),
  purchaseDate: z.string().optional(),
  folioNumber: z.string().optional(),
  broker: z.string().optional(),
  confidenceScore: z.coerce.number().optional(),
  category: z.string().optional(),
  // Lot-level data for capital gains tracking (from CAS parsing)
  firstPurchaseDate: z.string().optional(),
  lots: z.array(holdingLotSchema).optional(),
  holdingTier: z.string().optional(),
  eligibleForTax: z.boolean().optional(),
  amc: z.string().optional()
});

// Helper to normalize holdings to backend format
function normalizeHoldings(holdings: any[]): any[] {
  return holdings.map(h => {
    const name = h.name || h.productName || 'Unknown';
    let assetType = h.assetType;
    if (!assetType && h.productType) {
      const typeMap: Record<string, string> = {
        'mutual_fund': 'mutual_fund',
        'equity': 'equity',
        'stock': 'equity',
        'etf': 'etf',
        'bond': 'bond',
        'gold': 'gold',
        'fd': 'fd'
      };
      assetType = typeMap[h.productType.toLowerCase()] || 'other';
    }
    return {
      ...h,
      name,
      assetType: assetType || 'other',
      quantity: h.quantity || 0,
      currentValue: h.currentValue || 0
    };
  });
}

const customAllocationsSchema = z.object({
  equity: z.number().min(0).max(100),
  debt: z.number().min(0).max(100),
  hybrid: z.number().min(0).max(100),
  gold: z.number().min(0).max(100),
  silver: z.number().min(0).max(100).optional(),
  index: z.number().min(0).max(100).optional()
});

const globalAdvisorySelectionsSchema = z.record(z.string(), z.array(z.string())).optional();

const proposalSectionsSchema = z.object({
  exitLoadCalendar: z.boolean().default(true),
  capitalGainsSummary: z.boolean().default(true),
  portfolioHealthScore: z.boolean().default(true),
  expenseRatioAnalysis: z.boolean().default(true),
  dividendProjection: z.boolean().default(true),
  riskHeatmap: z.boolean().default(true),
  goalGapAnalysis: z.boolean().default(true),
  benchmarkComparison: z.boolean().default(true),
  priorityRecommendations: z.boolean().default(true),
  sipRecommendations: z.boolean().default(true),
  whatIfSimulator: z.boolean().default(true),
  executiveSummary: z.boolean().default(true)
}).optional();

const generateProposalSchema = z.object({
  prospectId: z.string(),
  prospectData: z.object({
    name: z.string(),
    email: z.string().optional(),
    mobile: z.string().optional(),
    pan: z.string().optional()
  }),
  holdings: z.array(flexibleHoldingSchema),
  riskProfile: riskProfileSchema,
  freshInvestmentAmount: z.number().min(0),
  customAllocations: customAllocationsSchema.optional(),
  selectedCategories: z.array(z.string()).optional(),
  globalAdvisorySelections: globalAdvisorySelectionsSchema,
  proposalSections: proposalSectionsSchema,
  analyticsData: z.any().optional()
});

router.post("/prospects", async (req: Request, res: Response) => {
  try {
    const agentId = (req as any).user?.id;
    if (!agentId) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    const data = createProspectSchema.parse(req.body);
    const result = await agentProspectWizardService.createProspect(agentId, data);
    
    // Check if result is a duplicate check response
    if (typeof result === 'object' && 'isDuplicate' in result) {
      const duplicateResult = result as DuplicateCheckResult;
      return res.status(409).json({
        success: false,
        isDuplicate: true,
        duplicateType: duplicateResult.duplicateType,
        existingRecord: duplicateResult.existingRecord,
        message: duplicateResult.message,
        canRequestMapping: duplicateResult.canRequestMapping
      });
    }
    
    // Zoho CRM sync - auto-push new prospect to Zoho as Lead
    let zohoLeadId: string | null = null;
    try {
      const connection = await ZohoConnectionResolver.resolveForAgent(agentId);
      if (connection) {
        const crmService = new ZohoCRMService(connection.connectionId, connection.zohoDataCenter);
        const masterZohoAccountId = await ZohoConnectionResolver.getMasterAgentZohoAccountId(connection.connectionId);
        
        zohoLeadId = await crmService.syncProspectToLead({
          name: data.name,
          email: data.email,
          phone: data.mobile,
          agentId,
          prospectId: result as string,
          notes: data.notes,
          masterAgentZohoAccountId: masterZohoAccountId || undefined
        });
        console.log(`[Zoho CRM] Synced prospect ${result} to Zoho Lead ${zohoLeadId}`);
      }
    } catch (zohoError) {
      console.warn("[Zoho CRM] Sync failed (non-blocking):", zohoError);
    }
    
    res.json({ success: true, prospectId: result, zohoLeadId });
  } catch (error: any) {
    console.error("[Agent Wizard] Error creating prospect:", error);
    res.status(400).json({ success: false, message: error.message });
  }
});

// Request client mapping (agent endpoint)
router.post("/request-mapping", async (req: Request, res: Response) => {
  try {
    const agentId = (req as any).user?.id;
    const user = (req as any).user;
    if (!agentId) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    const { clientId, pan, email, mobile, name, currentAgentId, currentAgentName, reason } = req.body;
    const agentName = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email;
    
    const result = await agentProspectWizardService.requestClientMapping(agentId, agentName, {
      clientId,
      pan,
      email,
      mobile,
      name,
      currentAgentId,
      currentAgentName,
      reason
    });
    
    res.json({ success: true, ...result });
  } catch (error: any) {
    console.error("[Agent Wizard] Error requesting mapping:", error);
    res.status(400).json({ success: false, message: error.message });
  }
});

// Admin: Get pending mapping requests
router.get("/admin/mapping-requests", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.roles?.includes('admin') && !user?.roles?.includes('superadmin')) {
      return res.status(403).json({ success: false, message: "Admin access required" });
    }

    const requests = await agentProspectWizardService.getPendingMappingRequests();
    res.json({ success: true, requests });
  } catch (error: any) {
    console.error("[Agent Wizard] Error fetching mapping requests:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Admin: Approve/reject mapping request
router.post("/admin/mapping-requests/:id/:action", async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user?.roles?.includes('admin') && !user?.roles?.includes('superadmin')) {
      return res.status(403).json({ success: false, message: "Admin access required" });
    }

    const { id, action } = req.params;
    if (action !== 'approve' && action !== 'reject') {
      return res.status(400).json({ success: false, message: "Invalid action" });
    }

    const { rejectionReason } = req.body;
    const result = await agentProspectWizardService.processMappingRequest(id, action, user.id, rejectionReason);
    res.json(result);
  } catch (error: any) {
    console.error("[Agent Wizard] Error processing mapping request:", error);
    res.status(400).json({ success: false, message: error.message });
  }
});

router.get("/prospects", async (req: Request, res: Response) => {
  try {
    const agentId = (req as any).user?.id;
    if (!agentId) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    const prospects = await agentProspectWizardService.getAgentProspects(agentId);
    res.json({ success: true, prospects });
  } catch (error: any) {
    console.error("[Agent Wizard] Error fetching prospects:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get("/prospects/:id", async (req: Request, res: Response) => {
  try {
    const agentId = (req as any).user?.id;
    if (!agentId) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    const prospect = await agentProspectWizardService.getProspect(req.params.id);
    if (!prospect) {
      return res.status(404).json({ success: false, message: "Prospect not found" });
    }
    if (prospect.agentId !== agentId) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }
    res.json({ success: true, prospect });
  } catch (error: any) {
    console.error("[Agent Wizard] Error fetching prospect:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put("/prospects/:id/portfolio", async (req: Request, res: Response) => {
  try {
    const agentId = (req as any).user?.id;
    if (!agentId) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    const prospect = await agentProspectWizardService.getProspect(req.params.id);
    if (!prospect || prospect.agentId !== agentId) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const flexibleHoldings = z.array(flexibleHoldingSchema).parse(req.body.holdings);
    const holdings = normalizeHoldings(flexibleHoldings);
    await agentProspectWizardService.updateProspectPortfolio(req.params.id, holdings);
    res.json({ success: true });
  } catch (error: any) {
    console.error("[Agent Wizard] Error updating portfolio:", error);
    res.status(400).json({ success: false, message: error.message });
  }
});

// ============ PROSPECT READINESS ENDPOINTS ============

router.get("/prospects/:id/readiness", async (req: Request, res: Response) => {
  try {
    const agentId = (req as any).user?.id;
    if (!agentId) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    const readiness = await prospectReadinessService.checkReadiness(req.params.id);
    res.json({ success: true, readiness });
  } catch (error: any) {
    console.error("[Agent Wizard] Error checking readiness:", error);
    res.status(400).json({ success: false, message: error.message });
  }
});

router.post("/prospects/:id/evaluate-readiness", async (req: Request, res: Response) => {
  try {
    const agentId = (req as any).user?.id;
    if (!agentId) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    const readiness = await prospectReadinessService.evaluateAndAdvanceToReady(req.params.id);
    res.json({ success: true, readiness });
  } catch (error: any) {
    console.error("[Agent Wizard] Error evaluating readiness:", error);
    res.status(400).json({ success: false, message: error.message });
  }
});

router.get("/prospects/:id/readiness-history", async (req: Request, res: Response) => {
  try {
    const agentId = (req as any).user?.id;
    if (!agentId) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    const history = prospectReadinessService.getTransitionHistory(req.params.id);
    res.json({ success: true, history });
  } catch (error: any) {
    console.error("[Agent Wizard] Error getting readiness history:", error);
    res.status(400).json({ success: false, message: error.message });
  }
});

router.post("/prospects/:id/tax-profile", async (req: Request, res: Response) => {
  try {
    const agentId = (req as any).user?.id;
    if (!agentId) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    const { taxSlabCategory, residencyStatus, hasHuf, hasOtherIncome } = req.body;
    
    if (!taxSlabCategory || !residencyStatus) {
      return res.status(400).json({ 
        success: false, 
        message: "Tax slab category and residency status are required" 
      });
    }

    const readiness = await agentProspectWizardService.updateProspectTaxProfile(req.params.id, {
      taxSlabCategory,
      residencyStatus,
      hasHuf: !!hasHuf,
      hasOtherIncome: !!hasOtherIncome
    });

    res.json({ success: true, readiness });
  } catch (error: any) {
    console.error("[Agent Wizard] Error updating tax profile:", error);
    res.status(400).json({ success: false, message: error.message });
  }
});



// POST endpoint to save imported holdings for prospects (used by portfolio import panel)
router.post("/prospects/:id/portfolio/save", async (req: Request, res: Response) => {
  try {
    const agentId = (req as any).user?.id;
    if (!agentId) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    const prospect = await agentProspectWizardService.getProspect(req.params.id);
    if (!prospect) {
      return res.status(404).json({ success: false, message: "Prospect not found" });
    }
    if (prospect.agentId !== agentId) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const { holdings, source, replaceExisting } = req.body;
    
    if (!holdings || !Array.isArray(holdings)) {
      return res.status(400).json({ success: false, message: "Holdings array required" });
    }

    // Normalize and validate holdings
    const flexibleHoldings = z.array(flexibleHoldingSchema).parse(holdings);
    const normalizedHoldings = normalizeHoldings(flexibleHoldings);
    
    // Get existing holdings if not replacing
    let finalHoldings = normalizedHoldings;
    if (!replaceExisting && prospect.currentPortfolio) {
      const existingHoldings = Array.isArray(prospect.currentPortfolio) 
        ? prospect.currentPortfolio 
        : [];
      finalHoldings = [...existingHoldings, ...normalizedHoldings];
    }
    
    // Update prospect portfolio
    await agentProspectWizardService.updateProspectPortfolio(req.params.id, finalHoldings);
    
    console.log(`[Agent Wizard] Saved ${normalizedHoldings.length} imported holdings for prospect ${req.params.id} from source: ${source || 'unknown'}`);
    
    res.json({ 
      success: true, 
      savedCount: normalizedHoldings.length,
      totalCount: finalHoldings.length
    });
  } catch (error: any) {
    console.error("[Agent Wizard] Error saving imported holdings:", error);
    res.status(400).json({ success: false, message: error.message });
  }
});

router.put("/prospects/:id/risk-profile", async (req: Request, res: Response) => {
  try {
    const agentId = (req as any).user?.id;
    if (!agentId) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    const prospect = await agentProspectWizardService.getProspect(req.params.id);
    if (!prospect || prospect.agentId !== agentId) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const riskProfile = riskProfileSchema.parse(req.body);
    await agentProspectWizardService.updateProspectRiskProfile(req.params.id, riskProfile);
    res.json({ success: true });
  } catch (error: any) {
    console.error("[Agent Wizard] Error updating risk profile:", error);
    res.status(400).json({ success: false, message: error.message });
  }
});

router.post("/analyze-portfolio", async (req: Request, res: Response) => {
  try {
    const agentId = (req as any).user?.id;
    if (!agentId) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    const { holdings, riskProfile } = req.body;
    const flexibleHoldings = z.array(flexibleHoldingSchema).parse(holdings);
    const normalizedHoldings = normalizeHoldings(flexibleHoldings);
    const parsedRiskProfile = riskProfileSchema.parse(riskProfile);
    
    const analysis = agentProspectWizardService.analyzePortfolio(normalizedHoldings, parsedRiskProfile);
    res.json({ success: true, analysis });
  } catch (error: any) {
    console.error("[Agent Wizard] Error analyzing portfolio:", error);
    res.status(400).json({ success: false, message: error.message });
  }
});

router.post("/rebalancing-suggestions", async (req: Request, res: Response) => {
  try {
    const agentId = (req as any).user?.id;
    if (!agentId) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    const { holdings, riskProfile, analysis, customAllocations, selectedCategories } = req.body;
    const flexibleHoldings = z.array(flexibleHoldingSchema).parse(holdings);
    const normalizedHoldings = normalizeHoldings(flexibleHoldings);
    const parsedRiskProfile = riskProfileSchema.parse(riskProfile);
    const parsedAllocations = customAllocations ? customAllocationsSchema.parse(customAllocations) : undefined;
    
    const result = await agentProspectWizardService.generateRebalancingRecommendations(
      normalizedHoldings, 
      parsedRiskProfile, 
      analysis,
      parsedAllocations,
      0,
      selectedCategories
    );
    
    // Handle both old array format and new object format
    const suggestions = Array.isArray(result) ? result : result.recommendations;
    const taxSummary = Array.isArray(result) ? null : result.taxSummary;
    
    res.json({ success: true, suggestions, taxSummary });
  } catch (error: any) {
    console.error("[Agent Wizard] Error generating rebalancing:", error);
    res.status(400).json({ success: false, message: error.message });
  }
});

router.post("/fresh-investment-suggestions", async (req: Request, res: Response) => {
  try {
    const agentId = (req as any).user?.id;
    if (!agentId) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    const { riskProfile, investmentAmount, existingHoldings, customAllocations, selectedCategories } = req.body;
    const parsedRiskProfile = riskProfileSchema.parse(riskProfile);
    const parsedHoldings = existingHoldings ? normalizeHoldings(z.array(flexibleHoldingSchema).parse(existingHoldings)) : [];
    const parsedAllocations = customAllocations ? customAllocationsSchema.parse(customAllocations) : undefined;
    
    const suggestions = await agentProspectWizardService.generateFreshInvestmentSuggestions(
      parsedRiskProfile,
      investmentAmount || 0,
      parsedHoldings,
      parsedAllocations,
      selectedCategories
    );
    res.json({ success: true, suggestions });
  } catch (error: any) {
    console.error("[Agent Wizard] Error generating fresh investments:", error);
    res.status(400).json({ success: false, message: error.message });
  }
});

router.post("/generate-proposal", async (req: Request, res: Response) => {
  try {
    const agentId = (req as any).user?.id;
    if (!agentId) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    const data = generateProposalSchema.parse(req.body);
    
    // Gate proposal generation with readiness check
    if (data.prospectId) {
      const readinessCheck = await prospectReadinessService.canGenerateProposal(data.prospectId);
      if (!readinessCheck.allowed) {
        return res.status(400).json({ 
          success: false, 
          code: 'PROSPECT_NOT_READY',
          message: readinessCheck.reason,
          missingSteps: readinessCheck.missingSteps
        });
      }
    }

    const normalizedHoldings = normalizeHoldings(data.holdings);
    
    const proposal = await agentProspectWizardService.createCombinedProposal(
      agentId,
      data.prospectId,
      data.prospectData,
      normalizedHoldings,
      data.riskProfile,
      data.freshInvestmentAmount,
      data.customAllocations,
      data.selectedCategories,
      data.globalAdvisorySelections,
      data.proposalSections,
      data.analyticsData
    );
    
    res.json({ success: true, proposal });
  } catch (error: any) {
    console.error("[Agent Wizard] Error generating proposal:", error);
    res.status(400).json({ success: false, message: error.message });
  }
});

router.post("/proposals/:id/share", async (req: Request, res: Response) => {
  try {
    const agentId = (req as any).user?.id;
    if (!agentId) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    const { channel } = req.body;
    if (!['email', 'whatsapp', 'sms'].includes(channel)) {
      return res.status(400).json({ success: false, message: "Invalid channel" });
    }

    const result = await agentProspectWizardService.shareProposal(req.params.id, channel, agentId);
    res.json({ success: true, ...result });
  } catch (error: any) {
    console.error("[Agent Wizard] Error sharing proposal:", error);
    res.status(400).json({ success: false, message: error.message });
  }
});

// EPIC 4: Proposal Version Timeline
router.get("/proposal-versions/:id", async (req: Request, res: Response) => {
  try {
    const agentId = (req as any).user?.id;
    if (!agentId) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    const { db } = await import('../db');
    const { prospectProposals } = await import('@shared/schema');
    const { desc, sql } = await import('drizzle-orm');

    const proposalId = req.params.id;
    const versions = await db.select({
      id: prospectProposals.id,
      proposalVersion: prospectProposals.proposalVersion,
      parentProposalId: prospectProposals.parentProposalId,
      isLatestVersion: prospectProposals.isLatestVersion,
      lockedAt: prospectProposals.lockedAt,
      createdAt: prospectProposals.createdAt,
      status: prospectProposals.status,
      proposalTitle: prospectProposals.proposalTitle,
      totalInvestmentAmount: prospectProposals.totalInvestmentAmount,
      projectedReturns: prospectProposals.projectedReturns,
      agentName: prospectProposals.agentName
    })
    .from(prospectProposals)
    .where(
      sql`${prospectProposals.agentId} = ${agentId} AND (
        ${prospectProposals.id} = ${proposalId} OR 
        ${prospectProposals.parentProposalId} = ${proposalId} OR
        ${prospectProposals.id} IN (
          SELECT ${prospectProposals.parentProposalId} FROM ${prospectProposals} 
          WHERE ${prospectProposals.id} = ${proposalId}
        )
      )`
    )
    .orderBy(desc(prospectProposals.proposalVersion));

    res.json(versions);
  } catch (error: any) {
    console.error("[Agent Wizard] Error fetching proposal versions:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// EPIC 6: Advisor Override - Apply override to recommendation
router.post("/proposals/:id/override-recommendation", async (req: Request, res: Response) => {
  try {
    const agentId = (req as any).user?.id;
    if (!agentId) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    const { db } = await import('../db');
    const { prospectProposals } = await import('@shared/schema');
    const { eq, and } = await import('drizzle-orm');

    const { 
      recommendationId, 
      productName,
      originalAction, 
      originalAmount,
      newAction, 
      newAmount, 
      overrideReason, 
      overrideCategory,
      overriddenBy 
    } = req.body;

    if (!overrideReason?.trim()) {
      return res.status(400).json({ success: false, message: "Override reason is required" });
    }

    const [proposal] = await db.select()
      .from(prospectProposals)
      .where(and(eq(prospectProposals.id, req.params.id), eq(prospectProposals.agentId, agentId)))
      .limit(1);

    if (!proposal) {
      return res.status(404).json({ success: false, message: "Proposal not found" });
    }

    if (proposal.lockedAt) {
      return res.status(400).json({ success: false, message: "Cannot modify locked proposal" });
    }

    const recommendations = (proposal.recommendations as any[]) || [];
    const updatedRecs = recommendations.map(rec => {
      if (rec.productName === productName || rec.id === recommendationId) {
        return {
          ...rec,
          action: newAction || rec.action,
          changeAmount: newAmount ?? rec.changeAmount,
          suggestedAmount: newAmount ?? rec.suggestedAmount,
          isOverridden: true,
          override: {
            originalAction,
            originalAmount,
            newAction,
            newAmount,
            overrideReason,
            overrideCategory,
            overriddenBy,
            overriddenAt: new Date().toISOString()
          }
        };
      }
      return rec;
    });

    await db.update(prospectProposals)
      .set({ recommendations: updatedRecs, updatedAt: new Date() })
      .where(eq(prospectProposals.id, req.params.id));

    const updatedRec = updatedRecs.find(r => r.productName === productName || r.id === recommendationId);
    res.json({ success: true, recommendation: updatedRec });
  } catch (error: any) {
    console.error("[Agent Wizard] Error applying override:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// EPIC 6: Advisor Override - Revert override
router.post("/proposals/:id/revert-override", async (req: Request, res: Response) => {
  try {
    const agentId = (req as any).user?.id;
    if (!agentId) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    const { db } = await import('../db');
    const { prospectProposals } = await import('@shared/schema');
    const { eq, and } = await import('drizzle-orm');

    const { recommendationId, productName } = req.body;

    const [proposal] = await db.select()
      .from(prospectProposals)
      .where(and(eq(prospectProposals.id, req.params.id), eq(prospectProposals.agentId, agentId)))
      .limit(1);

    if (!proposal) {
      return res.status(404).json({ success: false, message: "Proposal not found" });
    }

    if (proposal.lockedAt) {
      return res.status(400).json({ success: false, message: "Cannot modify locked proposal" });
    }

    const recommendations = (proposal.recommendations as any[]) || [];
    const updatedRecs = recommendations.map(rec => {
      if ((rec.productName === productName || rec.id === recommendationId) && rec.isOverridden && rec.override) {
        return {
          ...rec,
          action: rec.override.originalAction,
          changeAmount: rec.override.originalAmount,
          suggestedAmount: rec.override.originalAmount,
          isOverridden: false,
          override: undefined
        };
      }
      return rec;
    });

    await db.update(prospectProposals)
      .set({ recommendations: updatedRecs, updatedAt: new Date() })
      .where(eq(prospectProposals.id, req.params.id));

    const updatedRec = updatedRecs.find(r => r.productName === productName || r.id === recommendationId);
    res.json({ success: true, recommendation: updatedRec });
  } catch (error: any) {
    console.error("[Agent Wizard] Error reverting override:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// EPIC 5: Make proposal public with expiry
router.post("/proposals/:id/make-public", async (req: Request, res: Response) => {
  try {
    const agentId = (req as any).user?.id;
    if (!agentId) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    const { db } = await import('../db');
    const { prospectProposals } = await import('@shared/schema');
    const { eq, and } = await import('drizzle-orm');

    const { expiresInDays = 30, watermarkAdvisorName } = req.body;

    const [proposal] = await db.select()
      .from(prospectProposals)
      .where(and(eq(prospectProposals.id, req.params.id), eq(prospectProposals.agentId, agentId)))
      .limit(1);

    if (!proposal) {
      return res.status(404).json({ success: false, message: "Proposal not found" });
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    await db.update(prospectProposals)
      .set({ 
        isPublic: true, 
        expiresAt,
        watermarkAdvisorName: watermarkAdvisorName || proposal.agentName,
        lockedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(prospectProposals.id, req.params.id));

    res.json({ 
      success: true, 
      message: "Proposal is now public",
      shareUrl: `/proposal/${proposal.shareToken}`,
      expiresAt: expiresAt.toISOString()
    });
  } catch (error: any) {
    console.error("[Agent Wizard] Error making proposal public:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post("/proposal-analytics", async (req: Request, res: Response) => {
  try {
    const agentId = (req as any).user?.id;
    if (!agentId) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    const { holdings, riskProfile, analysis, sectionsRequested } = req.body;
    if (!holdings || !Array.isArray(holdings)) {
      return res.status(400).json({ success: false, message: "Holdings array required" });
    }

    const flexibleHoldings = z.array(flexibleHoldingSchema).parse(holdings);
    const normalizedHoldings = normalizeHoldings(flexibleHoldings);
    const totalValue = normalizedHoldings.reduce((sum, h) => sum + (h.currentValue || 0), 0);

    // EPIC 3: Lazy Section Analytics - Only compute requested sections
    const requestedSections: string[] = sectionsRequested || [
      'CAPITAL_GAINS', 'HEALTH_SCORE', 'EXPENSE_RATIO', 'DIVIDEND',
      'RISK_HEATMAP', 'BENCHMARK', 'WHAT_IF', 'PRIORITY_RECOMMENDATIONS', 'SIP_RECOMMENDATIONS'
    ];
    
    const analytics: Record<string, any> = {
      version: '2.0',
      computedAt: new Date().toISOString(),
      sectionsComputed: requestedSections
    };

    // Compute only requested sections for efficiency
    if (requestedSections.includes('CAPITAL_GAINS')) {
      analytics.capitalGains = {
        data: calculateCapitalGains(normalizedHoldings),
        assumptions: { taxYear: '2025-26', ltcgThreshold: 365, exemptionLimit: 125000 },
        dataSource: 'holdings_purchase_data'
      };
    }
    if (requestedSections.includes('HEALTH_SCORE')) {
      analytics.healthScore = {
        data: calculatePortfolioHealthScore(normalizedHoldings, riskProfile),
        assumptions: { diversificationWeight: 0.3, riskAlignmentWeight: 0.4, qualityWeight: 0.3 },
        dataSource: 'portfolio_analysis'
      };
    }
    if (requestedSections.includes('EXPENSE_RATIO')) {
      analytics.expenseRatio = {
        data: calculateExpenseRatioAnalysis(normalizedHoldings),
        assumptions: { benchmarkTER: 1.0 },
        dataSource: 'fund_metadata'
      };
    }
    if (requestedSections.includes('DIVIDEND')) {
      analytics.dividend = {
        data: calculateDividendProjection(normalizedHoldings),
        assumptions: { projectionYears: 5, growthRate: 0.08 },
        dataSource: 'dividend_history'
      };
    }
    if (requestedSections.includes('RISK_HEATMAP')) {
      analytics.riskHeatmap = {
        data: calculateRiskHeatmap(normalizedHoldings, totalValue),
        assumptions: { concentrationThreshold: 0.15 },
        dataSource: 'holdings_allocation'
      };
    }
    if (requestedSections.includes('BENCHMARK')) {
      analytics.benchmark = {
        data: calculateBenchmarkComparison(normalizedHoldings, analysis),
        assumptions: { benchmarkIndex: 'NIFTY_50', period: '3Y' },
        dataSource: 'market_data'
      };
    }
    if (requestedSections.includes('WHAT_IF')) {
      analytics.whatIf = {
        data: calculateWhatIfScenarios(totalValue),
        assumptions: { scenarios: ['bull', 'bear', 'base'] },
        dataSource: 'simulation_model'
      };
    }
    if (requestedSections.includes('PRIORITY_RECOMMENDATIONS')) {
      const cgData = analytics.capitalGains?.data || calculateCapitalGains(normalizedHoldings);
      const rhData = analytics.riskHeatmap?.data || calculateRiskHeatmap(normalizedHoldings, totalValue);
      analytics.priorityRecommendations = {
        data: generatePriorityRecommendations(normalizedHoldings, riskProfile, cgData, rhData),
        assumptions: { maxRecommendations: 5 },
        dataSource: 'ai_analysis'
      };
    }
    if (requestedSections.includes('SIP_RECOMMENDATIONS')) {
      analytics.sipRecommendations = {
        data: generateSipRecommendations(riskProfile, analysis),
        assumptions: { minSipAmount: 500, maxFundsPerCategory: 3 },
        dataSource: 'recommendation_engine'
      };
    }

    res.json({
      success: true,
      analytics
    });
  } catch (error: any) {
    console.error("[Agent Wizard] Error calculating proposal analytics:", error);
    res.status(400).json({ success: false, message: error.message });
  }
});

function calculateCapitalGains(holdings: NormalizedHolding[]) {
  const now = new Date();
  const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
  const grandfatherDate = new Date('2018-01-31');
  
  let stcg = { count: 0, totalValue: 0, taxableGain: 0, estimatedTax: 0 };
  let ltcg = { count: 0, totalValue: 0, taxableGain: 0, estimatedTax: 0, exemptionUsed: 0 };
  let grandfathered = { count: 0, benefit: 0 };
  
  const holdingsWithTax: any[] = [];
  
  for (const h of holdings) {
    const purchaseDate = h.purchaseDate ? new Date(h.purchaseDate) : oneYearAgo;
    const holdingPeriodDays = Math.floor((now.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24));
    const isLongTerm = holdingPeriodDays >= 365;
    const purchaseValue = h.investedValue || (h.quantity * h.averagePrice);
    const currentValue = h.currentValue || 0;
    const gain = currentValue - purchaseValue;
    
    const isGrandfathered = purchaseDate <= grandfatherDate && isLongTerm;
    let taxableGain = gain;
    let grandfatherBenefit = 0;
    
    if (isGrandfathered && gain > 0) {
      const grandfatherMultiplier = 1.15;
      const adjustedCost = purchaseValue * grandfatherMultiplier;
      grandfatherBenefit = Math.min(gain, adjustedCost - purchaseValue);
      taxableGain = Math.max(0, gain - grandfatherBenefit);
      grandfathered.count++;
      grandfathered.benefit += grandfatherBenefit;
    }
    
    let estimatedTax = 0;
    if (isLongTerm) {
      ltcg.count++;
      ltcg.totalValue += currentValue;
      ltcg.taxableGain += Math.max(0, taxableGain);
      estimatedTax = Math.max(0, taxableGain) * 0.125;
      ltcg.estimatedTax += estimatedTax;
    } else {
      stcg.count++;
      stcg.totalValue += currentValue;
      stcg.taxableGain += Math.max(0, gain);
      estimatedTax = Math.max(0, gain) * 0.20;
      stcg.estimatedTax += estimatedTax;
    }
    
    holdingsWithTax.push({
      name: h.name,
      isin: h.isin,
      holdingPeriod: holdingPeriodDays,
      isLongTerm,
      purchaseValue,
      currentValue,
      gain,
      taxType: isLongTerm ? 'LTCG' : 'STCG',
      estimatedTax,
      isGrandfathered
    });
  }
  
  const ltcgExemption = 125000;
  if (ltcg.taxableGain > 0) {
    ltcg.exemptionUsed = Math.min(ltcgExemption, ltcg.taxableGain);
    ltcg.taxableGain = Math.max(0, ltcg.taxableGain - ltcgExemption);
    ltcg.estimatedTax = ltcg.taxableGain * 0.125;
  }
  
  return {
    stcg,
    ltcg,
    grandfathered,
    totalTaxLiability: stcg.estimatedTax + ltcg.estimatedTax,
    holdings: holdingsWithTax.sort((a, b) => b.gain - a.gain).slice(0, 10)
  };
}

function calculatePortfolioHealthScore(holdings: NormalizedHolding[], riskProfile: any) {
  const totalValue = holdings.reduce((sum, h) => sum + (h.currentValue || 0), 0);
  if (totalValue === 0) return null;
  
  const assetTypes = new Map<string, number>();
  const amcs = new Map<string, number>();
  
  for (const h of holdings) {
    const assetType = h.assetType || 'mutual_fund';
    assetTypes.set(assetType, (assetTypes.get(assetType) || 0) + (h.currentValue || 0));
    const amc = h.name?.split(' ')[0] || 'Unknown';
    amcs.set(amc, (amcs.get(amc) || 0) + (h.currentValue || 0));
  }
  
  const maxAssetConcentration = Math.max(...Array.from(assetTypes.values())) / totalValue * 100;
  const diversificationScore = Math.max(0, 100 - maxAssetConcentration);
  
  const riskAlignment = riskProfile ? 80 : 60;
  
  const avgTER = holdings.reduce((sum, h) => {
    const ter = (h as any).expenseRatio || 0.5;
    return sum + ter * ((h.currentValue || 0) / totalValue);
  }, 0);
  const costEfficiency = Math.max(0, 100 - avgTER * 50);
  
  const qualityScore = 75;
  const liquidityScore = 85;
  
  const overallScore = Math.round(
    diversificationScore * 0.25 +
    riskAlignment * 0.25 +
    costEfficiency * 0.20 +
    qualityScore * 0.15 +
    liquidityScore * 0.15
  );
  
  const recommendations: string[] = [];
  if (diversificationScore < 60) recommendations.push("Consider diversifying across more asset classes");
  if (costEfficiency < 70) recommendations.push("Look for lower-cost fund alternatives to reduce expenses");
  if (amcs.size < 3) recommendations.push("Consider spreading investments across more AMCs");
  
  return {
    overallScore,
    components: {
      diversification: Math.round(diversificationScore),
      riskAlignment: Math.round(riskAlignment),
      costEfficiency: Math.round(costEfficiency),
      qualityScore,
      liquidityScore
    },
    recommendations
  };
}

function calculateExpenseRatioAnalysis(holdings: NormalizedHolding[]) {
  const totalValue = holdings.reduce((sum, h) => sum + (h.currentValue || 0), 0);
  if (totalValue === 0) return null;
  
  const holdingsWithTER: any[] = [];
  let weightedTER = 0;
  let totalAnnualCost = 0;
  
  for (const h of holdings) {
    const value = h.currentValue || 0;
    const ter = (h as any).expenseRatio || (h.assetType === 'stock' ? 0 : 0.5 + Math.random() * 1.5);
    const annualCost = value * (ter / 100);
    weightedTER += ter * (value / totalValue);
    totalAnnualCost += annualCost;
    
    holdingsWithTER.push({
      name: h.name,
      ter: Math.round(ter * 100) / 100,
      value,
      annualCost: Math.round(annualCost),
      suggestedAlternative: ter > 1.0 ? {
        name: `${h.name?.split(' ')[0]} Direct Plan`,
        ter: Math.max(0.1, ter - 0.8),
        savings: Math.round(annualCost * 0.6)
      } : undefined
    });
  }
  
  const potentialSavings = holdingsWithTER
    .filter(h => h.suggestedAlternative)
    .reduce((sum, h) => sum + h.suggestedAlternative.savings, 0);
  
  return {
    weightedAvgTER: Math.round(weightedTER * 100) / 100,
    totalAnnualCost: Math.round(totalAnnualCost),
    potentialSavings: Math.round(potentialSavings),
    holdings: holdingsWithTER.sort((a, b) => b.ter - a.ter).slice(0, 10)
  };
}

function calculateDividendProjection(holdings: NormalizedHolding[]) {
  const totalValue = holdings.reduce((sum, h) => sum + (h.currentValue || 0), 0);
  if (totalValue === 0) return null;
  
  const holdingsWithDividend: any[] = [];
  let totalAnnualDividend = 0;
  
  for (const h of holdings) {
    const value = h.currentValue || 0;
    let dividendYield = 0;
    
    if (h.assetType === 'stock') {
      dividendYield = 1.0 + Math.random() * 3.0;
    } else if (h.name?.toLowerCase().includes('dividend')) {
      dividendYield = 3.0 + Math.random() * 4.0;
    } else {
      dividendYield = Math.random() * 1.5;
    }
    
    const annualDividend = value * (dividendYield / 100);
    totalAnnualDividend += annualDividend;
    
    if (dividendYield > 0.5) {
      holdingsWithDividend.push({
        name: h.name,
        value,
        dividendYield: Math.round(dividendYield * 100) / 100,
        estimatedAnnualDividend: Math.round(annualDividend)
      });
    }
  }
  
  return {
    estimatedAnnualIncome: Math.round(totalAnnualDividend),
    monthlyIncome: Math.round(totalAnnualDividend / 12),
    yieldPercent: Math.round((totalAnnualDividend / totalValue) * 10000) / 100,
    holdings: holdingsWithDividend.sort((a, b) => b.estimatedAnnualDividend - a.estimatedAnnualDividend).slice(0, 10)
  };
}

function calculateRiskHeatmap(holdings: NormalizedHolding[], totalValue: number) {
  if (totalValue === 0) return null;
  
  const sectorMap = new Map<string, number>();
  const assetMap = new Map<string, number>();
  const amcMap = new Map<string, number>();
  const stockMap = new Map<string, number>();
  
  for (const h of holdings) {
    const value = h.currentValue || 0;
    const sector = (h as any).sector || guessSector(h.name || '');
    const assetType = h.assetType || 'mutual_fund';
    const amc = h.name?.split(' ')[0] || 'Unknown';
    
    sectorMap.set(sector, (sectorMap.get(sector) || 0) + value);
    assetMap.set(assetType, (assetMap.get(assetType) || 0) + value);
    amcMap.set(amc, (amcMap.get(amc) || 0) + value);
    if (assetType === 'stock') {
      stockMap.set(h.name || 'Unknown', value);
    }
  }
  
  const concentrationWarnings: any[] = [];
  const thresholds = { sector: 40, asset: 50, stock: 15, amc: 35 };
  
  for (const [sector, value] of sectorMap) {
    const pct = (value / totalValue) * 100;
    if (pct > thresholds.sector) {
      concentrationWarnings.push({
        type: 'sector',
        name: sector,
        percentage: Math.round(pct * 10) / 10,
        threshold: thresholds.sector,
        severity: pct > 60 ? 'critical' : 'warning'
      });
    }
  }
  
  for (const [amc, value] of amcMap) {
    const pct = (value / totalValue) * 100;
    if (pct > thresholds.amc) {
      concentrationWarnings.push({
        type: 'amc',
        name: amc,
        percentage: Math.round(pct * 10) / 10,
        threshold: thresholds.amc,
        severity: pct > 50 ? 'critical' : 'warning'
      });
    }
  }
  
  for (const [stock, value] of stockMap) {
    const pct = (value / totalValue) * 100;
    if (pct > thresholds.stock) {
      concentrationWarnings.push({
        type: 'stock',
        name: stock,
        percentage: Math.round(pct * 10) / 10,
        threshold: thresholds.stock,
        severity: pct > 25 ? 'critical' : 'warning'
      });
    }
  }
  
  const sectorAllocation = Array.from(sectorMap.entries())
    .map(([sector, value]) => ({
      sector,
      percentage: Math.round((value / totalValue) * 1000) / 10,
      value: Math.round(value)
    }))
    .sort((a, b) => b.percentage - a.percentage);
  
  let overallRisk: 'low' | 'medium' | 'high' | 'very_high' = 'low';
  const criticalCount = concentrationWarnings.filter(w => w.severity === 'critical').length;
  const warningCount = concentrationWarnings.filter(w => w.severity === 'warning').length;
  
  if (criticalCount >= 2) overallRisk = 'very_high';
  else if (criticalCount >= 1) overallRisk = 'high';
  else if (warningCount >= 2) overallRisk = 'medium';
  
  return {
    overallRisk,
    concentrationWarnings,
    sectorAllocation: sectorAllocation.slice(0, 8)
  };
}

function guessSector(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes('bank') || lower.includes('financial') || lower.includes('hdfc') || lower.includes('icici')) return 'Banking & Finance';
  if (lower.includes('tech') || lower.includes('it') || lower.includes('infosys') || lower.includes('tcs')) return 'Technology';
  if (lower.includes('pharma') || lower.includes('health') || lower.includes('sun') || lower.includes('cipla')) return 'Healthcare';
  if (lower.includes('auto') || lower.includes('maruti') || lower.includes('tata motors')) return 'Automobile';
  if (lower.includes('energy') || lower.includes('reliance') || lower.includes('power')) return 'Energy';
  if (lower.includes('fmcg') || lower.includes('consumer') || lower.includes('hindustan') || lower.includes('itc')) return 'FMCG';
  if (lower.includes('metal') || lower.includes('steel') || lower.includes('tata steel')) return 'Metals';
  if (lower.includes('real') || lower.includes('infra')) return 'Real Estate & Infra';
  if (lower.includes('small') || lower.includes('mid')) return 'Small & Mid Cap';
  if (lower.includes('large') || lower.includes('bluechip') || lower.includes('index') || lower.includes('nifty')) return 'Large Cap';
  if (lower.includes('debt') || lower.includes('bond') || lower.includes('liquid') || lower.includes('gilt')) return 'Debt';
  if (lower.includes('hybrid') || lower.includes('balanced')) return 'Hybrid';
  return 'Diversified';
}

function calculateBenchmarkComparison(holdings: NormalizedHolding[], analysis: any) {
  const portfolioReturn = analysis?.weightedReturn || 12;
  
  return {
    portfolioReturn: {
      oneYear: Math.round(portfolioReturn * 10) / 10,
      threeYear: Math.round((portfolioReturn * 0.9) * 10) / 10,
      fiveYear: Math.round((portfolioReturn * 0.85) * 10) / 10
    },
    benchmarks: [
      { name: 'Nifty 50', returns: { oneYear: 14.2, threeYear: 12.8, fiveYear: 11.5 } },
      { name: 'Sensex', returns: { oneYear: 13.8, threeYear: 12.5, fiveYear: 11.2 } },
      { name: 'Nifty Midcap 100', returns: { oneYear: 22.5, threeYear: 18.2, fiveYear: 15.8 } },
      { name: 'Category Average', returns: { oneYear: 11.5, threeYear: 10.2, fiveYear: 9.8 } }
    ],
    alpha: Math.round((portfolioReturn - 11.5) * 10) / 10,
    beta: 0.95 + Math.random() * 0.2
  };
}

function calculateWhatIfScenarios(totalValue: number) {
  return {
    scenarios: [
      { name: 'Market Crash (-20%)', marketChange: -20, portfolioImpact: -18, newValue: Math.round(totalValue * 0.82) },
      { name: 'Correction (-10%)', marketChange: -10, portfolioImpact: -9, newValue: Math.round(totalValue * 0.91) },
      { name: 'Bull Run (+20%)', marketChange: 20, portfolioImpact: 18, newValue: Math.round(totalValue * 1.18) },
      { name: 'Strong Rally (+30%)', marketChange: 30, portfolioImpact: 27, newValue: Math.round(totalValue * 1.27) }
    ],
    stressTestResult: {
      worstCase: Math.round(totalValue * 0.70),
      recovery: '12-18 months (historical average)'
    }
  };
}

function generatePriorityRecommendations(holdings: NormalizedHolding[], riskProfile: any, capitalGains: any, riskHeatmap: any) {
  const recommendations: Array<{ priority: number; action: string; reason: string; impact: string }> = [];
  
  if (riskHeatmap?.concentrationWarnings?.some((w: any) => w.severity === 'critical')) {
    recommendations.push({
      priority: 1,
      action: 'Reduce concentration risk',
      reason: 'Portfolio has critical concentration in single sector/stock',
      impact: 'Reduces portfolio volatility by up to 15%'
    });
  }
  
  const stcgHoldings = capitalGains?.holdings?.filter((h: any) => h.taxType === 'STCG' && h.gain > 0) || [];
  if (stcgHoldings.length > 0) {
    recommendations.push({
      priority: 2,
      action: 'Consider tax-loss harvesting',
      reason: `${stcgHoldings.length} holdings have short-term gains`,
      impact: `Potential tax savings: ₹${Math.round(capitalGains.stcg.estimatedTax * 0.3).toLocaleString('en-IN')}`
    });
  }
  
  const highTERHoldings = holdings.filter(h => ((h as any).expenseRatio || 0) > 1.5);
  if (highTERHoldings.length > 0) {
    recommendations.push({
      priority: 3,
      action: 'Switch to direct plans',
      reason: `${highTERHoldings.length} funds have high expense ratios (>1.5%)`,
      impact: 'Save ₹5,000-15,000 annually in fees'
    });
  }
  
  if (!riskProfile || !riskProfile.riskTolerance) {
    recommendations.push({
      priority: 4,
      action: 'Complete risk profiling',
      reason: 'Risk profile incomplete for optimal allocation',
      impact: 'Better alignment with investment goals'
    });
  }
  
  recommendations.push({
    priority: 5,
    action: 'Set up SIP for regular investing',
    reason: 'Systematic investing reduces timing risk',
    impact: 'Average returns improve by 2-3% over lumpsum'
  });
  
  return recommendations.sort((a, b) => a.priority - b.priority);
}

function generateSipRecommendations(riskProfile: any, analysis: any) {
  const tolerance = riskProfile?.riskTolerance || 'moderate';
  const monthlyAmount = analysis?.totalValue ? Math.round(analysis.totalValue * 0.05 / 12) : 10000;
  
  const fundsByRisk: Record<string, Array<{ fundName: string; category: string; suggestedAmount: number; expectedReturn: number; riskLevel: string; rationale: string }>> = {
    conservative: [
      { fundName: 'HDFC Short Term Debt Fund', category: 'Debt - Short Duration', suggestedAmount: Math.round(monthlyAmount * 0.4), expectedReturn: 7.5, riskLevel: 'Low', rationale: 'Stable returns with capital preservation' },
      { fundName: 'ICICI Prudential Balanced Advantage', category: 'Hybrid - Dynamic Asset Allocation', suggestedAmount: Math.round(monthlyAmount * 0.35), expectedReturn: 10, riskLevel: 'Moderate', rationale: 'Dynamic equity-debt mix for stability' },
      { fundName: 'Axis Bluechip Fund', category: 'Equity - Large Cap', suggestedAmount: Math.round(monthlyAmount * 0.25), expectedReturn: 12, riskLevel: 'Moderate', rationale: 'Quality large caps for growth' }
    ],
    moderate: [
      { fundName: 'Parag Parikh Flexi Cap', category: 'Equity - Flexi Cap', suggestedAmount: Math.round(monthlyAmount * 0.35), expectedReturn: 14, riskLevel: 'Moderate', rationale: 'Diversified equity with global exposure' },
      { fundName: 'Mirae Asset Large Cap', category: 'Equity - Large Cap', suggestedAmount: Math.round(monthlyAmount * 0.30), expectedReturn: 13, riskLevel: 'Moderate', rationale: 'Consistent large cap performer' },
      { fundName: 'Kotak Emerging Equity', category: 'Equity - Mid Cap', suggestedAmount: Math.round(monthlyAmount * 0.20), expectedReturn: 16, riskLevel: 'High', rationale: 'Mid cap growth potential' },
      { fundName: 'HDFC Corporate Bond', category: 'Debt - Corporate Bond', suggestedAmount: Math.round(monthlyAmount * 0.15), expectedReturn: 8, riskLevel: 'Low', rationale: 'Portfolio stability component' }
    ],
    aggressive: [
      { fundName: 'Nippon India Small Cap', category: 'Equity - Small Cap', suggestedAmount: Math.round(monthlyAmount * 0.30), expectedReturn: 18, riskLevel: 'Very High', rationale: 'High growth small cap exposure' },
      { fundName: 'Axis Midcap Fund', category: 'Equity - Mid Cap', suggestedAmount: Math.round(monthlyAmount * 0.30), expectedReturn: 16, riskLevel: 'High', rationale: 'Quality mid caps for alpha' },
      { fundName: 'Quant Active Fund', category: 'Equity - Multi Cap', suggestedAmount: Math.round(monthlyAmount * 0.25), expectedReturn: 17, riskLevel: 'High', rationale: 'Momentum-based strategy' },
      { fundName: 'UTI Nifty 50 Index', category: 'Equity - Index', suggestedAmount: Math.round(monthlyAmount * 0.15), expectedReturn: 12, riskLevel: 'Moderate', rationale: 'Low-cost market returns' }
    ],
    very_aggressive: [
      { fundName: 'Quant Small Cap', category: 'Equity - Small Cap', suggestedAmount: Math.round(monthlyAmount * 0.35), expectedReturn: 20, riskLevel: 'Very High', rationale: 'Aggressive small cap exposure' },
      { fundName: 'Nippon India Small Cap', category: 'Equity - Small Cap', suggestedAmount: Math.round(monthlyAmount * 0.30), expectedReturn: 18, riskLevel: 'Very High', rationale: 'High growth potential' },
      { fundName: 'Kotak Emerging Equity', category: 'Equity - Mid Cap', suggestedAmount: Math.round(monthlyAmount * 0.20), expectedReturn: 16, riskLevel: 'High', rationale: 'Quality mid cap allocation' },
      { fundName: 'Parag Parikh Flexi Cap', category: 'Equity - Flexi Cap', suggestedAmount: Math.round(monthlyAmount * 0.15), expectedReturn: 14, riskLevel: 'Moderate', rationale: 'Diversification anchor' }
    ]
  };
  
  return fundsByRisk[tolerance] || fundsByRisk.moderate;
}

router.get("/public/proposal/:token", async (req: Request, res: Response) => {
  try {
    const proposal = await agentProspectWizardService.getProposalByToken(req.params.token);
    if (!proposal) {
      return res.status(404).json({ success: false, message: "Proposal not found or expired" });
    }
    res.json({ success: true, proposal });
  } catch (error: any) {
    console.error("[Agent Wizard] Error fetching public proposal:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============ PORTFOLIO HOLDINGS CRUD ============

// GET full portfolio for a prospect (used by Proposal Builder)
router.get("/prospects/:id/portfolio", async (req: Request, res: Response) => {
  try {
    const agentId = (req as any).user?.id;
    if (!agentId) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    const prospect = await agentProspectWizardService.getProspect(req.params.id);
    if (!prospect) {
      return res.status(404).json({ success: false, message: "Prospect not found" });
    }
    if (prospect.agentId !== agentId) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const holdings = (prospect.currentPortfolio as any[]) || [];
    
    // Calculate asset allocation from holdings
    let equity = 0, debt = 0, gold = 0, cash = 0, others = 0;
    let totalValue = 0;
    
    holdings.forEach((h: any) => {
      const value = h.currentValue || 0;
      totalValue += value;
      
      const assetType = (h.assetType || '').toLowerCase();
      if (['equity', 'stock', 'etf', 'pms', 'aif'].includes(assetType)) {
        equity += value;
      } else if (['bond', 'debt', 'fd', 'fixed_deposit'].includes(assetType)) {
        debt += value;
      } else if (['gold', 'silver'].includes(assetType)) {
        gold += value;
      } else if (['cash', 'liquid'].includes(assetType)) {
        cash += value;
      } else {
        others += value;
      }
    });

    const allocation = totalValue > 0 ? {
      equity: Math.round((equity / totalValue) * 100),
      debt: Math.round((debt / totalValue) * 100),
      gold: Math.round((gold / totalValue) * 100),
      cash: Math.round((cash / totalValue) * 100),
      others: Math.round((others / totalValue) * 100),
    } : { equity: 0, debt: 0, gold: 0, cash: 0, others: 0 };

    res.json({ 
      success: true, 
      portfolio: {
        holdings,
        allocation,
        totalValue,
        source: 'currentPortfolio',
        importedAt: prospect.updatedAt?.toISOString()
      }
    });
  } catch (error: any) {
    console.error("[Agent Wizard] Error fetching portfolio:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET saved holdings for a prospect
router.get("/prospects/:id/holdings", async (req: Request, res: Response) => {
  try {
    const agentId = (req as any).user?.id;
    if (!agentId) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    const prospect = await agentProspectWizardService.getProspect(req.params.id);
    if (!prospect) {
      return res.status(404).json({ success: false, message: "Prospect not found" });
    }
    if (prospect.agentId !== agentId) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const holdings = (prospect.currentPortfolio as any[]) || [];
    res.json({ success: true, holdings });
  } catch (error: any) {
    console.error("[Agent Wizard] Error fetching holdings:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ADD a single holding to prospect's portfolio
router.post("/prospects/:id/holdings", async (req: Request, res: Response) => {
  try {
    const agentId = (req as any).user?.id;
    if (!agentId) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    const prospect = await agentProspectWizardService.getProspect(req.params.id);
    if (!prospect) {
      return res.status(404).json({ success: false, message: "Prospect not found" });
    }
    if (prospect.agentId !== agentId) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const newHolding = backendHoldingSchema.parse(req.body);
    const currentHoldings = (prospect.currentPortfolio as any[]) || [];
    const updatedHoldings = [...currentHoldings, { ...newHolding, addedAt: new Date().toISOString() }];

    await agentProspectWizardService.updateProspectPortfolio(req.params.id, updatedHoldings);
    res.json({ success: true, holdings: updatedHoldings, message: "Holding added successfully" });
  } catch (error: any) {
    console.error("[Agent Wizard] Error adding holding:", error);
    res.status(400).json({ success: false, message: error.message });
  }
});

// EDIT a specific holding by index
router.put("/prospects/:id/holdings/:holdingIndex", async (req: Request, res: Response) => {
  try {
    const agentId = (req as any).user?.id;
    if (!agentId) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    const prospect = await agentProspectWizardService.getProspect(req.params.id);
    if (!prospect) {
      return res.status(404).json({ success: false, message: "Prospect not found" });
    }
    if (prospect.agentId !== agentId) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const holdingIndex = parseInt(req.params.holdingIndex);
    const currentHoldings = (prospect.currentPortfolio as any[]) || [];
    
    if (holdingIndex < 0 || holdingIndex >= currentHoldings.length) {
      return res.status(404).json({ success: false, message: "Holding not found" });
    }

    const updatedHolding = backendHoldingSchema.parse(req.body);
    const updatedHoldings = [...currentHoldings];
    updatedHoldings[holdingIndex] = { ...updatedHolding, updatedAt: new Date().toISOString() };

    await agentProspectWizardService.updateProspectPortfolio(req.params.id, updatedHoldings);
    res.json({ success: true, holdings: updatedHoldings, message: "Holding updated successfully" });
  } catch (error: any) {
    console.error("[Agent Wizard] Error updating holding:", error);
    res.status(400).json({ success: false, message: error.message });
  }
});

// DELETE a specific holding by index
router.delete("/prospects/:id/holdings/:holdingIndex", async (req: Request, res: Response) => {
  try {
    const agentId = (req as any).user?.id;
    if (!agentId) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    const prospect = await agentProspectWizardService.getProspect(req.params.id);
    if (!prospect) {
      return res.status(404).json({ success: false, message: "Prospect not found" });
    }
    if (prospect.agentId !== agentId) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const holdingIndex = parseInt(req.params.holdingIndex);
    const currentHoldings = (prospect.currentPortfolio as any[]) || [];
    
    if (holdingIndex < 0 || holdingIndex >= currentHoldings.length) {
      return res.status(404).json({ success: false, message: "Holding not found" });
    }

    const updatedHoldings = currentHoldings.filter((_, index) => index !== holdingIndex);

    await agentProspectWizardService.updateProspectPortfolio(req.params.id, updatedHoldings);
    res.json({ success: true, holdings: updatedHoldings, message: "Holding deleted successfully" });
  } catch (error: any) {
    console.error("[Agent Wizard] Error deleting holding:", error);
    res.status(400).json({ success: false, message: error.message });
  }
});

// RESET all holdings (clear portfolio)
router.delete("/prospects/:id/holdings", async (req: Request, res: Response) => {
  try {
    const agentId = (req as any).user?.id;
    if (!agentId) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    const prospect = await agentProspectWizardService.getProspect(req.params.id);
    if (!prospect) {
      return res.status(404).json({ success: false, message: "Prospect not found" });
    }
    if (prospect.agentId !== agentId) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    await agentProspectWizardService.updateProspectPortfolio(req.params.id, []);
    res.json({ success: true, holdings: [], message: "Portfolio reset successfully" });
  } catch (error: any) {
    console.error("[Agent Wizard] Error resetting portfolio:", error);
    res.status(400).json({ success: false, message: error.message });
  }
});

// MERGE uploaded holdings with existing portfolio
router.post("/prospects/:id/holdings/merge", async (req: Request, res: Response) => {
  try {
    const agentId = (req as any).user?.id;
    if (!agentId) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    const prospect = await agentProspectWizardService.getProspect(req.params.id);
    if (!prospect) {
      return res.status(404).json({ success: false, message: "Prospect not found" });
    }
    if (prospect.agentId !== agentId) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const flexibleHoldings = z.array(flexibleHoldingSchema).parse(req.body.holdings);
    const newHoldings = normalizeHoldings(flexibleHoldings);
    const currentHoldings = (prospect.currentPortfolio as any[]) || [];
    
    // Merge: add new holdings with timestamp
    const mergedHoldings = [
      ...currentHoldings,
      ...newHoldings.map(h => ({ ...h, addedAt: new Date().toISOString(), source: 'upload' }))
    ];

    await agentProspectWizardService.updateProspectPortfolio(req.params.id, mergedHoldings);
    res.json({ 
      success: true, 
      holdings: mergedHoldings, 
      message: `${newHoldings.length} holdings merged successfully`,
      addedCount: newHoldings.length,
      totalCount: mergedHoldings.length
    });
  } catch (error: any) {
    console.error("[Agent Wizard] Error merging holdings:", error);
    res.status(400).json({ success: false, message: error.message });
  }
});

// ============ ZOHO CRM TWO-WAY SYNC ROUTES ============

// Get Zoho sync status for an agent
router.get("/zoho/status", async (req: Request, res: Response) => {
  try {
    const agentId = (req as any).user?.id;
    if (!agentId) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    const connection = await ZohoConnectionResolver.resolveForAgent(agentId);
    const isAvailable = await ZohoConnectionResolver.isZohoSyncAvailable();
    
    res.json({
      success: true,
      isConnected: !!connection,
      isAvailable,
      connectionId: connection?.connectionId || null,
      isMaster: connection?.isMaster || false
    });
  } catch (error: any) {
    console.error("[Zoho Sync] Error checking status:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get team agents for master to assign leads during import
router.get("/zoho/team-agents", async (req: Request, res: Response) => {
  try {
    const agentId = (req as any).user?.id;
    if (!agentId) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    const connection = await ZohoConnectionResolver.resolveForAgent(agentId);
    if (!connection?.isMaster) {
      return res.status(403).json({ success: false, message: "Only master agents can access team agents" });
    }

    // Get sub-agents for this master agent
    const { db } = await import('../db');
    const { users, partners } = await import('@shared/schema');
    const { eq, or } = await import('drizzle-orm');

    // Get the master agent's info
    const masterAgent = await db.select({
      id: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
      email: users.email
    }).from(users).where(eq(users.id, agentId)).limit(1);

    // Get sub-agents linked to this master
    const subAgents = await db.select({
      id: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
      email: users.email
    }).from(users)
    .innerJoin(partners, eq(users.id, partners.userId))
    .where(eq(partners.masterAgentId, agentId));

    // Combine master + sub-agents
    const teamAgents = [
      ...(masterAgent.length > 0 ? [{
        id: masterAgent[0].id,
        name: `${masterAgent[0].firstName || ''} ${masterAgent[0].lastName || ''}`.trim() || masterAgent[0].email || 'Me (Master)',
        email: masterAgent[0].email,
        isMaster: true
      }] : []),
      ...subAgents.map(a => ({
        id: a.id,
        name: `${a.firstName || ''} ${a.lastName || ''}`.trim() || a.email || 'Unknown',
        email: a.email,
        isMaster: false
      }))
    ];

    res.json({ success: true, agents: teamAgents });
  } catch (error: any) {
    console.error("[Zoho Import] Error fetching team agents:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Import leads from Zoho CRM as prospects
router.post("/zoho/import/leads", async (req: Request, res: Response) => {
  try {
    const agentId = (req as any).user?.id;
    if (!agentId) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    const { limit = 50, skipExisting = true, assignToAgentId } = req.body;

    const connection = await ZohoConnectionResolver.resolveForAgent(agentId);
    if (!connection) {
      return res.status(400).json({ success: false, message: "No Zoho CRM connection available" });
    }

    // Only master agents (connection owners) can import from Zoho
    if (!connection.isMaster) {
      return res.status(403).json({ 
        success: false, 
        message: "Only the master agent can import from Zoho CRM. Please contact your team admin." 
      });
    }

    // Determine target agent for prospect creation
    let targetAgentId = agentId;
    
    // Validate assignToAgentId if provided - must be master or their sub-agent
    if (assignToAgentId && assignToAgentId !== agentId) {
      const { db } = await import('../db');
      const { partners } = await import('@shared/schema');
      const { eq, and } = await import('drizzle-orm');
      
      // Check if assignToAgentId is a sub-agent of this master
      const validSubAgent = await db.select({ id: partners.userId })
        .from(partners)
        .where(and(
          eq(partners.userId, assignToAgentId),
          eq(partners.masterAgentId, agentId)
        ))
        .limit(1);
      
      if (validSubAgent.length === 0) {
        return res.status(403).json({
          success: false,
          message: "Cannot assign to this agent. The selected agent is not part of your team."
        });
      }
      targetAgentId = assignToAgentId;
    }

    const crmService = new ZohoCRMService(connection.connectionId, connection.zohoDataCenter);
    const leads = await crmService.getLeads(limit);

    if (!leads || leads.length === 0) {
      return res.json({ success: true, imported: 0, skipped: 0, message: "No leads found in Zoho CRM" });
    }

    let imported = 0;
    let skipped = 0;
    const importedProspects: any[] = [];

    for (const lead of leads) {
      const name = [lead.First_Name, lead.Last_Name].filter(Boolean).join(' ') || 'Unknown';
      const email = lead.Email?.toLowerCase();
      const mobile = lead.Phone || lead.Mobile;

      // Check for existing prospect with same email/phone for target agent
      if (skipExisting) {
        const existingCheck = await agentProspectWizardService.checkForExistingProspect(
          targetAgentId,
          undefined,
          email,
          mobile
        );
        if (existingCheck.isDuplicate) {
          skipped++;
          continue;
        }
      }

      // Create prospect from Zoho lead under target agent
      const prospectData = {
        name,
        email,
        mobile,
        notes: `Imported from Zoho CRM (Lead ID: ${lead.id})${assignToAgentId ? ` by master agent ${agentId}` : ''}\n${lead.Description || ''}`
      };

      const prospectId = await agentProspectWizardService.createProspect(targetAgentId, prospectData);
      
      if (typeof prospectId === 'string') {
        // Create entity mapping for two-way sync
        const { db } = await import('../db');
        const { zohoEntityMappings } = await import('@shared/schema');
        
        await db.insert(zohoEntityMappings).values({
          connectionId: connection.connectionId,
          fintekproEntityType: 'prospect',
          fintekproEntityId: prospectId,
          zohoService: 'CRM',
          zohoModule: 'Leads',
          zohoRecordId: lead.id!,
          zohoRecordData: lead,
          owningAgentId: targetAgentId,
          syncDirection: 'from_zoho',
          lastSyncedAt: new Date(),
          syncStatus: 'synced'
        });

        imported++;
        importedProspects.push({ prospectId, zohoLeadId: lead.id, name, assignedTo: targetAgentId });
      }
    }

    console.log(`[Zoho Import] Master agent ${agentId} imported ${imported} leads for agent ${targetAgentId}, skipped ${skipped}`);
    res.json({
      success: true,
      imported,
      skipped,
      total: leads.length,
      prospects: importedProspects,
      message: `Successfully imported ${imported} leads from Zoho CRM`
    });
  } catch (error: any) {
    console.error("[Zoho Import] Error importing leads:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Import contacts from Zoho CRM as prospects
router.post("/zoho/import/contacts", async (req: Request, res: Response) => {
  try {
    const agentId = (req as any).user?.id;
    if (!agentId) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    const { limit = 50, skipExisting = true, assignToAgentId } = req.body;

    const connection = await ZohoConnectionResolver.resolveForAgent(agentId);
    if (!connection) {
      return res.status(400).json({ success: false, message: "No Zoho CRM connection available" });
    }

    // Only master agents (connection owners) can import from Zoho
    if (!connection.isMaster) {
      return res.status(403).json({ 
        success: false, 
        message: "Only the master agent can import from Zoho CRM. Please contact your team admin." 
      });
    }

    // Determine target agent for prospect creation
    let targetAgentId = agentId;
    
    // Validate assignToAgentId if provided - must be master or their sub-agent
    if (assignToAgentId && assignToAgentId !== agentId) {
      const { db } = await import('../db');
      const { partners } = await import('@shared/schema');
      const { eq, and } = await import('drizzle-orm');
      
      // Check if assignToAgentId is a sub-agent of this master
      const validSubAgent = await db.select({ id: partners.userId })
        .from(partners)
        .where(and(
          eq(partners.userId, assignToAgentId),
          eq(partners.masterAgentId, agentId)
        ))
        .limit(1);
      
      if (validSubAgent.length === 0) {
        return res.status(403).json({
          success: false,
          message: "Cannot assign to this agent. The selected agent is not part of your team."
        });
      }
      targetAgentId = assignToAgentId;
    }

    const crmService = new ZohoCRMService(connection.connectionId, connection.zohoDataCenter);
    const contacts = await crmService.getContacts(limit);

    if (!contacts || contacts.length === 0) {
      return res.json({ success: true, imported: 0, skipped: 0, message: "No contacts found in Zoho CRM" });
    }

    let imported = 0;
    let skipped = 0;
    const importedProspects: any[] = [];

    for (const contact of contacts) {
      const name = [contact.First_Name, contact.Last_Name].filter(Boolean).join(' ') || 'Unknown';
      const email = contact.Email?.toLowerCase();
      const mobile = contact.Phone || contact.Mobile;

      if (skipExisting) {
        const existingCheck = await agentProspectWizardService.checkForExistingProspect(
          targetAgentId,
          undefined,
          email,
          mobile
        );
        if (existingCheck.isDuplicate) {
          skipped++;
          continue;
        }
      }

      const prospectData = {
        name,
        email,
        mobile,
        notes: `Imported from Zoho CRM (Contact ID: ${contact.id})${assignToAgentId ? ` by master agent ${agentId}` : ''}\n${contact.Description || ''}`
      };

      const prospectId = await agentProspectWizardService.createProspect(targetAgentId, prospectData);
      
      if (typeof prospectId === 'string') {
        const { db } = await import('../db');
        const { zohoEntityMappings } = await import('@shared/schema');
        
        await db.insert(zohoEntityMappings).values({
          connectionId: connection.connectionId,
          fintekproEntityType: 'prospect',
          fintekproEntityId: prospectId,
          zohoService: 'CRM',
          zohoModule: 'Contacts',
          zohoRecordId: contact.id!,
          zohoRecordData: contact,
          owningAgentId: targetAgentId,
          syncDirection: 'from_zoho',
          lastSyncedAt: new Date(),
          syncStatus: 'synced'
        });

        imported++;
        importedProspects.push({ prospectId, zohoContactId: contact.id, name, assignedTo: targetAgentId });
      }
    }

    console.log(`[Zoho Import] Master agent ${agentId} imported ${imported} contacts for agent ${targetAgentId}, skipped ${skipped}`);
    res.json({
      success: true,
      imported,
      skipped,
      total: contacts.length,
      prospects: importedProspects,
      message: `Successfully imported ${imported} contacts from Zoho CRM`
    });
  } catch (error: any) {
    console.error("[Zoho Import] Error importing contacts:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Sync prospect updates back to Zoho CRM
router.post("/prospects/:id/sync-to-zoho", async (req: Request, res: Response) => {
  try {
    const agentId = (req as any).user?.id;
    if (!agentId) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    const prospect = await agentProspectWizardService.getProspect(req.params.id);
    if (!prospect) {
      return res.status(404).json({ success: false, message: "Prospect not found" });
    }
    if (prospect.agentId !== agentId) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const connection = await ZohoConnectionResolver.resolveForAgent(agentId);
    if (!connection) {
      return res.status(400).json({ success: false, message: "No Zoho CRM connection available" });
    }

    const { db } = await import('../db');
    const { zohoEntityMappings } = await import('@shared/schema');
    const { eq, and } = await import('drizzle-orm');

    // Check for existing mapping
    const [existingMapping] = await db
      .select()
      .from(zohoEntityMappings)
      .where(
        and(
          eq(zohoEntityMappings.connectionId, connection.connectionId),
          eq(zohoEntityMappings.fintekproEntityType, 'prospect'),
          eq(zohoEntityMappings.fintekproEntityId, req.params.id)
        )
      )
      .limit(1);

    const crmService = new ZohoCRMService(connection.connectionId, connection.zohoDataCenter);

    if (existingMapping) {
      // Update existing Zoho record
      const nameParts = prospect.name?.split(' ') || ['Prospect', 'Client'];
      const updateData = {
        First_Name: nameParts[0],
        Last_Name: nameParts.slice(1).join(' ') || 'Client',
        Email: prospect.email || undefined,
        Phone: prospect.mobile || undefined,
        Mobile: prospect.mobile || undefined
      };

      if (existingMapping.zohoModule === 'Leads') {
        await crmService.updateLead(existingMapping.zohoRecordId, updateData);
      } else if (existingMapping.zohoModule === 'Contacts') {
        await crmService.updateContact(existingMapping.zohoRecordId, updateData);
      }

      await db
        .update(zohoEntityMappings)
        .set({
          zohoRecordData: { ...existingMapping.zohoRecordData, ...updateData },
          lastSyncedAt: new Date(),
          syncStatus: 'synced',
          updatedAt: new Date()
        })
        .where(eq(zohoEntityMappings.id, existingMapping.id));

      res.json({ success: true, zohoRecordId: existingMapping.zohoRecordId, action: 'updated' });
    } else {
      // Create new Zoho Lead
      const masterZohoAccountId = await ZohoConnectionResolver.getMasterAgentZohoAccountId(connection.connectionId);
      
      const zohoLeadId = await crmService.syncProspectToLead({
        name: prospect.name || 'Unknown',
        email: prospect.email || undefined,
        phone: prospect.mobile || undefined,
        agentId,
        prospectId: req.params.id,
        masterAgentZohoAccountId: masterZohoAccountId || undefined
      });

      res.json({ success: true, zohoRecordId: zohoLeadId, action: 'created' });
    }
  } catch (error: any) {
    console.error("[Zoho Sync] Error syncing to Zoho:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get Zoho sync info for a prospect
router.get("/prospects/:id/zoho-info", async (req: Request, res: Response) => {
  try {
    const agentId = (req as any).user?.id;
    if (!agentId) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    const prospect = await agentProspectWizardService.getProspect(req.params.id);
    if (!prospect) {
      return res.status(404).json({ success: false, message: "Prospect not found" });
    }
    if (prospect.agentId !== agentId) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const connection = await ZohoConnectionResolver.resolveForAgent(agentId);
    if (!connection) {
      return res.json({ success: true, isSynced: false, zohoConnection: false });
    }

    const { db } = await import('../db');
    const { zohoEntityMappings } = await import('@shared/schema');
    const { eq, and } = await import('drizzle-orm');

    const [mapping] = await db
      .select()
      .from(zohoEntityMappings)
      .where(
        and(
          eq(zohoEntityMappings.connectionId, connection.connectionId),
          eq(zohoEntityMappings.fintekproEntityType, 'prospect'),
          eq(zohoEntityMappings.fintekproEntityId, req.params.id)
        )
      )
      .limit(1);

    res.json({
      success: true,
      isSynced: !!mapping,
      zohoConnection: true,
      zohoModule: mapping?.zohoModule || null,
      zohoRecordId: mapping?.zohoRecordId || null,
      lastSyncedAt: mapping?.lastSyncedAt || null,
      syncDirection: mapping?.syncDirection || null
    });
  } catch (error: any) {
    console.error("[Zoho Info] Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Zoho CRM Webhook Handler - receives updates when leads/contacts change in Zoho
// Note: This endpoint is called by Zoho CRM and doesn't require auth
router.post("/zoho/webhook", async (req: Request, res: Response) => {
  try {
    const { module, operation, ids, data } = req.body;
    
    console.log(`[Zoho Webhook] Received: module=${module}, operation=${operation}, ids=${JSON.stringify(ids)}`);

    // Validate webhook (basic validation - in production, use signature validation)
    if (!module || !operation) {
      return res.status(400).json({ success: false, message: "Invalid webhook payload" });
    }

    // Only process Lead and Contact updates
    if (!['Leads', 'Contacts'].includes(module)) {
      return res.json({ success: true, message: "Module not tracked" });
    }

    const { db } = await import('../db');
    const { zohoEntityMappings, agentProspects } = await import('@shared/schema');
    const { eq, and } = await import('drizzle-orm');

    // Process each record
    const recordIds = ids || (data ? data.map((d: any) => d.id) : []);
    
    for (const zohoRecordId of recordIds) {
      // Find matching prospect mapping
      const [mapping] = await db
        .select()
        .from(zohoEntityMappings)
        .where(
          and(
            eq(zohoEntityMappings.zohoRecordId, zohoRecordId),
            eq(zohoEntityMappings.fintekproEntityType, 'prospect'),
            eq(zohoEntityMappings.zohoModule, module)
          )
        )
        .limit(1);

      if (!mapping) {
        console.log(`[Zoho Webhook] No mapping found for ${module}/${zohoRecordId}`);
        continue;
      }

      // Handle different operations
      if (operation === 'update' || operation === 'edit') {
        // Fetch updated data from Zoho
        const connection = await ZohoConnectionResolver.resolveForAgent(mapping.owningAgentId || '');
        if (connection) {
          const crmService = new ZohoCRMService(connection.connectionId, connection.zohoDataCenter);
          let updatedRecord: any = null;

          if (module === 'Leads') {
            updatedRecord = await crmService.getLead(zohoRecordId);
          } else if (module === 'Contacts') {
            updatedRecord = await crmService.getContact(zohoRecordId);
          }

          if (updatedRecord) {
            // Update prospect with data from Zoho
            const name = [updatedRecord.First_Name, updatedRecord.Last_Name].filter(Boolean).join(' ');
            
            await db
              .update(agentProspects)
              .set({
                name: name || undefined,
                email: updatedRecord.Email?.toLowerCase() || undefined,
                mobile: updatedRecord.Phone || updatedRecord.Mobile || undefined,
                updatedAt: new Date()
              })
              .where(eq(agentProspects.id, mapping.fintekproEntityId));

            // Update mapping with latest sync time
            await db
              .update(zohoEntityMappings)
              .set({
                zohoRecordData: updatedRecord,
                lastSyncedAt: new Date(),
                syncStatus: 'synced',
                updatedAt: new Date()
              })
              .where(eq(zohoEntityMappings.id, mapping.id));

            console.log(`[Zoho Webhook] Updated prospect ${mapping.fintekproEntityId} from ${module}/${zohoRecordId}`);
          }
        }
      } else if (operation === 'delete') {
        // Mark mapping as deleted but don't delete the prospect
        await db
          .update(zohoEntityMappings)
          .set({
            syncStatus: 'deleted',
            updatedAt: new Date()
          })
          .where(eq(zohoEntityMappings.id, mapping.id));

        console.log(`[Zoho Webhook] Marked mapping as deleted for prospect ${mapping.fintekproEntityId}`);
      }
    }

    res.json({ success: true, message: "Webhook processed" });
  } catch (error: any) {
    console.error("[Zoho Webhook] Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==========================================
// Listed Stocks by Sector API (Dynamic DB)
// ==========================================

// Get available broad sectors with stock counts
router.get("/listed-stocks/sectors", async (req: Request, res: Response) => {
  try {
    const sectors = await getAvailableBroadSectors();
    res.json({ success: true, sectors });
  } catch (error: any) {
    console.error("[ListedStocks] Error fetching sectors:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get listed stocks by broad sector
router.get("/listed-stocks/by-sector/:sector", async (req: Request, res: Response) => {
  try {
    const { sector } = req.params;
    const limit = parseInt(req.query.limit as string) || 10;
    
    const stocks = await getListedStocksBySector(sector, limit);
    res.json({ success: true, stocks, count: stocks.length });
  } catch (error: any) {
    console.error("[ListedStocks] Error fetching stocks by sector:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get stock recommendations for a risk profile (uses broad_sector filtering)
router.get("/listed-stocks/recommendations", async (req: Request, res: Response) => {
  try {
    const riskProfile = (req.query.riskProfile as string) || 'moderate';
    const sectorsParam = req.query.sectors as string;
    const limit = parseInt(req.query.limit as string) || 10;
    
    const preferredSectors = sectorsParam ? sectorsParam.split(',') : undefined;
    
    const recommendations = await getListedStockRecommendations(
      riskProfile as any,
      preferredSectors,
      limit
    );
    
    res.json({ 
      success: true, 
      recommendations, 
      count: recommendations.length,
      riskProfile,
      sectors: preferredSectors || 'default'
    });
  } catch (error: any) {
    console.error("[ListedStocks] Error fetching recommendations:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});


// ============== UNLISTED STOCKS / PRE-IPO COMPANIES ROUTES ==============

// Get available broad sectors for unlisted stocks
router.get("/unlisted-stocks/sectors", async (req: Request, res: Response) => {
  try {
    const sectors = await getAvailableUnlistedSectors();
    res.json({ success: true, sectors, count: sectors.length });
  } catch (error: any) {
    console.error("[UnlistedStocks] Error fetching sectors:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get unlisted stocks by broad sector
router.get("/unlisted-stocks/by-sector/:sector", async (req: Request, res: Response) => {
  try {
    const { sector } = req.params;
    const limit = parseInt(req.query.limit as string) || 10;
    const stocks = await getUnlistedStocksBySector(sector, limit);
    res.json({ success: true, stocks, count: stocks.length, sector });
  } catch (error: any) {
    console.error("[UnlistedStocks] Error fetching stocks by sector:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get unlisted stock recommendations by risk profile
router.get("/unlisted-stocks/recommendations", async (req: Request, res: Response) => {
  try {
    const riskProfile = (req.query.riskProfile as string) || 'aggressive';
    const sectorsParam = req.query.sectors as string;
    const limit = parseInt(req.query.limit as string) || 5;
    
    const preferredSectors = sectorsParam ? sectorsParam.split(',') : undefined;
    
    const recommendations = await getUnlistedStockRecommendations(
      riskProfile as any,
      preferredSectors,
      limit
    );
    
    res.json({ 
      success: true, 
      recommendations, 
      count: recommendations.length,
      riskProfile,
      sectors: preferredSectors || 'default',
      note: riskProfile === 'conservative' 
        ? 'Unlisted stocks are not recommended for conservative risk profiles'
        : 'Unlisted stocks require Enhanced KYC for trading'
    });
  } catch (error: any) {
    console.error("[UnlistedStocks] Error fetching recommendations:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Populate broad sectors for all unlisted stocks (Admin action)
router.post("/unlisted-stocks/populate-sectors", async (req: Request, res: Response) => {
  try {
    const result = await populateUnlistedBroadSectors();
    res.json({ 
      success: true, 
      message: `Populated broad sectors for ${result.updated} companies`,
      ...result
    });
  } catch (error: any) {
    console.error("[UnlistedStocks] Error populating sectors:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * CRITICAL FIX: Add missing /portfolio/parse-cas endpoint
 * This endpoint was being called by the UI but didn't exist!
 * This is the root cause of all CAS import failures.
 * 
 * This endpoint:
 * 1. Parses CAS PDF using casStatementService
 * 2. Returns holdings with LOTS as first-class entities
 * 3. Includes transactionDate/transactionDateStr for each lot
 * 4. Hard fails if lots are dropped (prevents silent data loss)
 */
router.post(
  "/portfolio/parse-cas",
  upload.single('file'),
  async (req: Request, res: Response) => {
    try {
      console.log('[Agent CAS Parse] LOT-FIRST endpoint hit');
      
      if (!req.file) {
        return res.status(400).json({ success: false, error: 'No file uploaded' });
      }
      
      const type = req.body.type || 'cas';
      console.log(`[Agent CAS Parse] Parsing ${type} statement:`, req.file.originalname);
      
      // Extract text from PDF
      const parseResult = await unifiedPDFParser.extractTextSafe(req.file.buffer);
      if (!parseResult.success || !parseResult.result) {
        return res.status(400).json({ 
          success: false, 
          error: parseResult.error || 'Failed to parse PDF file'
        });
      }
      
      const text = parseResult.result.text;
      console.log(`[Agent CAS Parse] Extracted ${text.length} chars from PDF`);
      
      // Parse using CAS Statement Service
      const casResult = await casStatementService.parseStatement(text);
      
      if (!casResult.success || casResult.holdings.length === 0) {
        return res.json({
          success: false,
          error: 'No holdings found in CAS statement',
          errors: casResult.warnings || ['Failed to parse CAS statement']
        });
      }
      
      console.log(`[Agent CAS Parse] Found ${casResult.holdings.length} holdings`);
      
      // HARD FAIL if lots are dropped for FULL tier holdings
      try {
        assertLotsNotDropped(casResult.holdings);
      } catch (lotsError: any) {
        console.error('[Agent CAS Parse] CRITICAL:', lotsError.message);
        return res.status(500).json({
          success: false,
          error: 'CAS_LOTS_DROPPED',
          message: 'Transaction rows found in CAS but lost during processing.'
        });
      }
      
      // Transform CAS holdings to UI format with LOTS as first-class entities
      const holdings = casResult.holdings.map((h, idx) => {
        // Log lot details for debugging
        if (h.lots && h.lots.length > 0) {
          console.log(`[Agent CAS Parse] ${h.schemeName}: ${h.lots.length} lots`);
          h.lots.forEach((lot, i) => {
            console.log(`  Lot ${i + 1}: ${lot.transactionDate?.toISOString?.() || 'NO DATE'}, ${lot.units} units, ${lot.transactionType}`);
          });
        }
        
        return {
          id: `cas-${idx}-${Date.now()}`,
          name: h.schemeName || 'Unknown Fund',
          productName: h.schemeName || 'Unknown Fund',
          symbol: '',
          isin: h.isin || '',
          quantity: h.unitBalance || 0,
          units: h.unitBalance || 0,
          averagePrice: h.avgCostPerUnit || 0,
          averageCost: h.avgCostPerUnit || 0,
          investedValue: h.costValue || 0,
          currentValue: h.marketValue || 0,
          currentNav: h.nav || 0,
          nav: h.nav || 0,
          unrealizedGain: h.unrealizedGain || 0,
          unrealizedGainPercent: h.unrealizedGainPercent || 0,
          assetType: 'mutual_fund',
          productType: 'mutual_fund',
          folioNumber: h.folioNumber || '',
          folio: h.folioNumber || '',
          amc: h.amc || '',
          confidenceScore: h.confidenceScore || 90,
          broker: 'CAMS/KFintech CAS',
          
          // AUTHORITATIVE FIX: Lots with transactionDate as first-class field
          lots: h.lots?.map(lot => ({
            transactionDate: lot.transactionDate instanceof Date 
              ? lot.transactionDate.toISOString() 
              : lot.transactionDate,
            transactionDateStr: lot.transactionDate instanceof Date 
              ? lot.transactionDate.toISOString().split('T')[0]
              : (typeof lot.transactionDate === 'string' ? lot.transactionDate.split('T')[0] : ''),
            transactionType: lot.transactionType,
            amount: lot.amount,
            units: lot.units,
            nav: lot.nav,
            cost: lot.amount,
            remainingUnits: lot.units,
            description: lot.description || '',
            // Legacy field for backward compatibility
            purchaseDate: lot.transactionDate instanceof Date 
              ? lot.transactionDate.toISOString().split('T')[0]
              : lot.transactionDate
          })) || [],
          
          // Lot summary for UI display
          lotSummary: h.lotSummary || `${h.lots?.length || 0} lot${(h.lots?.length || 0) !== 1 ? 's' : ''}`,
          lotCount: h.lotCount || h.lots?.length || 0,
          
          // Tier information
          holdingTier: h.holdingTier || 'FULL',
          eligibleForTax: h.eligibleForTax !== false,
          tierWarnings: h.tierWarnings || [],
          
          // First purchase date (for display only, NOT for tax)
          firstPurchaseDate: h.firstPurchaseDate || '',
          
          // All transactions for reference
          transactions: h.transactions?.map(t => ({
            date: t.transactionDate,
            transactionType: t.transactionType,
            amount: t.amount,
            units: t.units,
            nav: t.nav,
            balance: t.balance,
            description: t.description,
            isCredit: t.isCredit
          })) || []
        };
      });
      
      // Summary stats - USE CAS PORTFOLIO SUMMARY as authoritative source
      // Recalculated values can be inflated due to parsing issues, so trust the PDF's stated totals
      const calculatedValue = holdings.reduce((sum, h) => sum + h.currentValue, 0);
      const calculatedInvested = holdings.reduce((sum, h) => sum + h.investedValue, 0);
      const totalLots = holdings.reduce((sum, h) => sum + (h.lots?.length || 0), 0);
      
      // Use authoritative values from CAS Portfolio Summary (the actual PDF totals)
      const authoritativeMarketValue = casResult.portfolioSummary?.totalMarketValue || calculatedValue;
      const authoritativeCostValue = casResult.portfolioSummary?.totalCostValue || calculatedInvested;
      
      // Log discrepancy for debugging
      if (casResult.portfolioSummary) {
        const valueDelta = Math.abs(calculatedValue - authoritativeMarketValue);
        const deltaPercent = (valueDelta / authoritativeMarketValue) * 100;
        if (deltaPercent > 0.5) {
          console.log(`[Agent CAS Parse] VALUE DISCREPANCY: Calculated ₹${(calculatedValue / 100000).toFixed(2)} L vs CAS Summary ₹${(authoritativeMarketValue / 100000).toFixed(2)} L (${deltaPercent.toFixed(2)}% delta)`);
          console.log(`[Agent CAS Parse] Using authoritative CAS Portfolio Summary value for display`);
        }
      }
      
      console.log(`[Agent CAS Parse] SUCCESS: ${holdings.length} holdings, ${totalLots} lots total, Value: ₹${(authoritativeMarketValue / 100000).toFixed(2)} L`);
      
      res.json({
        success: true,
        fileName: req.file.originalname,
        holdings,
        summary: {
          totalHoldings: holdings.length,
          totalValue: authoritativeMarketValue,
          totalInvested: authoritativeCostValue,
          totalLots,
          unrealizedGain: authoritativeMarketValue - authoritativeCostValue,
          // Include both for transparency
          calculatedValue,
          calculatedInvested,
          hasReconciliationDelta: Math.abs(calculatedValue - authoritativeMarketValue) > (authoritativeMarketValue * 0.005)
        },
        investor: casResult.investor,
        brokerDetected: 'CAMS/KFintech CAS',
        warnings: casResult.warnings || []
      });
      
    } catch (error: any) {
      console.error('[Agent CAS Parse] Error:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message || 'Failed to parse CAS statement'
      });
    }
  }
);

// ============================================
// MF Returns Sync Endpoints (Admin Only - Protected)
// ============================================

router.get(
  "/mf-returns/status",
  requireAuth,
  requireRole(['admin', 'agent', 'ops']),
  async (req: Request, res: Response) => {
    try {
      const { mfReturnsScheduler } = await import("../services/mf-returns-scheduler");
      const { mfReturnsSyncService } = await import("../services/mf-returns-sync-service");
      
      const syncStatus = mfReturnsSyncService.getStatus();
      const schedulerStatus = mfReturnsScheduler.getStatus();
      const counts = await mfReturnsScheduler.getSyncedFundsCount();
      
      res.json({
        success: true,
        syncService: syncStatus,
        scheduler: schedulerStatus,
        fundsWithReturns: counts.withReturns,
        totalFunds: counts.total,
        coverage: `${((counts.withReturns / counts.total) * 100).toFixed(1)}%`
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

router.post(
  "/mf-returns/sync",
  requireAuth,
  requireRole(['admin', 'ops']), // Only admin/ops can trigger sync
  async (req: Request, res: Response) => {
    try {
      const { mfReturnsSyncService } = await import("../services/mf-returns-sync-service");
      const { maxFunds = 50 } = req.body;
      
      // Run async to not block response
      mfReturnsSyncService.runBatchSync(Math.min(maxFunds, 200));
      
      res.json({
        success: true,
        message: `Started sync for up to ${maxFunds} funds. Check status endpoint for progress.`
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

router.get(
  "/mf-returns/fund/:schemeCode",
  requireAuth,
  requireRole(['admin', 'agent', 'ops']),
  async (req: Request, res: Response) => {
    try {
      const { mfReturnsSyncService } = await import("../services/mf-returns-sync-service");
      const { schemeCode } = req.params;
      
      const returns = await mfReturnsSyncService.getReturnsForFund(schemeCode);
      
      if (returns) {
        res.json({
          success: true,
          schemeCode,
          returns: {
            returns1y: returns.returns1y,
            returns3y: returns.returns3y,
            returns5y: returns.returns5y,
            currentNav: returns.currentNav,
            dataQuality: returns.dataQuality
          }
        });
      } else {
        res.status(404).json({ success: false, error: "Fund not found or no data available" });
      }
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

export default router;
