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
  category: z.string().optional()
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
  globalAdvisorySelections: globalAdvisorySelectionsSchema
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
    
    const result = agentProspectWizardService.generateRebalancingRecommendations(
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
      data.globalAdvisorySelections
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
      console.log('[Agent CAS Parse] Endpoint hit - THIS IS THE NEW ENDPOINT');
      
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
      
      // Summary stats
      const totalValue = holdings.reduce((sum, h) => sum + h.currentValue, 0);
      const totalInvested = holdings.reduce((sum, h) => sum + h.investedValue, 0);
      const totalLots = holdings.reduce((sum, h) => sum + (h.lots?.length || 0), 0);
      
      console.log(`[Agent CAS Parse] SUCCESS: ${holdings.length} holdings, ${totalLots} lots total`);
      
      res.json({
        success: true,
        fileName: req.file.originalname,
        holdings,
        summary: {
          totalHoldings: holdings.length,
          totalValue,
          totalInvested,
          totalLots,
          unrealizedGain: totalValue - totalInvested
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

export default router;
