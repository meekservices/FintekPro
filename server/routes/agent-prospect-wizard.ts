import { Router, Request, Response } from "express";
import { agentProspectWizardService, ProspectPortfolioHolding, ProspectRiskProfile, DuplicateCheckResult } from "../services/agent-prospect-wizard-service";
import { z } from "zod";
import { ZohoCRMService } from "../zoho/services/crm";

const router = Router();

const createProspectSchema = z.object({
  name: z.string().min(2),
  email: z.string().email().optional(),
  mobile: z.string().optional(),
  pan: z.string().length(10).optional(),
  clientType: z.string().optional(),
  indicativeRiskProfile: z.string().optional(),
  notes: z.string().optional()
});

const riskProfileSchema = z.object({
  riskTolerance: z.enum(['conservative', 'moderate', 'aggressive', 'very_aggressive']),
  investmentHorizon: z.enum(['short_term', 'medium_term', 'long_term']),
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
  quantity: z.number(),
  averageCost: z.number().optional(),
  currentValue: z.number(),
  currentNav: z.number().optional(),
  investedValue: z.number().optional(),
  unrealizedGain: z.number().optional(),
  unrealizedGainPercent: z.number().optional(),
  purchasePrice: z.number().optional(),
  purchaseDate: z.string().optional(),
  folioNumber: z.string().optional(),
  broker: z.string().optional(),
  confidenceScore: z.number().optional(),
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
    
    // Zoho CRM sync disabled - connection not configured
    // Uncomment when Zoho connection is set up in zoho_connections table
    
    res.json({ success: true, prospectId: result });
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

    const { holdings, riskProfile, analysis } = req.body;
    const flexibleHoldings = z.array(flexibleHoldingSchema).parse(holdings);
    const normalizedHoldings = normalizeHoldings(flexibleHoldings);
    const parsedRiskProfile = riskProfileSchema.parse(riskProfile);
    
    const result = agentProspectWizardService.generateRebalancingRecommendations(
      normalizedHoldings, 
      parsedRiskProfile, 
      analysis
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

export default router;
