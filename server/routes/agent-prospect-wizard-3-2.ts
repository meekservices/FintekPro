import { Router, Request, Response } from "express";
import { storage } from "../storage";
import multer from "multer";
import { db } from "../db";
import { portfolios, portfolioHoldings, prospectLeads } from "@shared/schema";
import { eq, inArray, or, desc as descOrd } from "drizzle-orm";
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
  populateUnlistedBroadSectors,
  isSipRestricted
} from "../services/agent-prospect-wizard-service";
import { schemeGovernanceService } from "../services/scheme-governance-service";
import { z } from "zod";
import { ZohoCRMService } from "../zoho/services/crm";
import { ZohoConnectionResolver } from "../zoho/connection-resolver";
import { unifiedPortfolioImportService } from "../services/unified-portfolio-import-service";
import { assertLotsNotDropped } from "../services/holding-transformer";
import { requireAuth, requireRole } from "../middleware/roleMiddleware";
import { prospectReadinessService } from "../services/prospect-readiness-service";
import { portfolioAnalyticsDataService } from "../services/portfolio-analytics-data-service";
import { enrichAndScoreProspect, bulkScoreProspects, getSectorBenchmarks, getBenchmarkForSegment, bustBenchmarkCache } from "../services/prospect-scoring-engine";
import { prospectScoreHistory } from "@shared/schema";

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
  purchasePrice: z.number().optional(),
  purchaseDate: z.string().optional(),
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

// Lot schema for capital gains tracking - supports multiple date formats from CAS parser
// Note: All date fields are optional for backward compatibility, but at least one should be present for tax calculations
const holdingLotSchema = z.object({
  purchaseDate: z.string().optional(),
  transactionDate: z.union([z.string(), z.date()]).optional(),
  transactionDateStr: z.string().optional(),
  transactionType: z.string().optional(),
  units: z.coerce.number(),
  nav: z.coerce.number(),
  amount: z.coerce.number().optional(),
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
  equity: z.number().min(0).max(100).default(0),
  debt: z.number().min(0).max(100).default(0),
  hybrid: z.number().min(0).max(100).default(0),
  gold: z.number().min(0).max(100).default(0),
  silver: z.number().min(0).max(100).default(0),
  index: z.number().min(0).max(100).default(0),
  etf: z.number().min(0).max(100).default(0),
  listed_stocks: z.number().min(0).max(100).default(0),
  unlisted_stocks: z.number().min(0).max(100).default(0),
  reit: z.number().min(0).max(100).default(0),
  invit: z.number().min(0).max(100).default(0),
  bonds: z.number().min(0).max(100).default(0),
  mld: z.number().min(0).max(100).default(0),
  pms: z.number().min(0).max(100).default(0),
  aif: z.number().min(0).max(100).default(0),
  global_advisory: z.number().min(0).max(100).default(0),
  us_markets: z.number().min(0).max(100).default(0),
  europe_markets: z.number().min(0).max(100).default(0),
  asia_pacific_markets: z.number().min(0).max(100).default(0),
  emerging_markets: z.number().min(0).max(100).default(0),
  international: z.number().min(0).max(100).default(0),
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
  investmentGoals: z.array(z.object({
    goalType: z.string(),
    targetAmount: z.number(),
    timelineYears: z.number(),
    monthlyContribution: z.number(),
    priority: z.string().optional()
  })).optional(),
  globalAdvisorySelections: globalAdvisorySelectionsSchema,
  proposalSections: proposalSectionsSchema,
  analyticsData: z.any().optional()
});

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
    await prospectReadinessService.advanceOnHoldingsImport(req.params.id);
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
    
    // Helper to generate a unique key for deduplication
    // Priority: ISIN > normalized (name + type)
    const getHoldingKey = (h: any): string => {
      if (h.isin && h.isin.trim()) {
        return `isin:${h.isin.trim().toUpperCase()}`;
      }
      const name = (h.productName || h.name || '').trim().toLowerCase();
      const type = (h.productType || h.assetType || 'mutual_fund').trim().toLowerCase();
      return `name:${name}|type:${type}`;
    };
    
    // Create a map of existing holdings by key for O(1) lookup
    const existingMap = new Map<string, any>();
    for (const h of currentHoldings) {
      const key = getHoldingKey(h);
      existingMap.set(key, h);
    }
    
    // Merge: update existing or add new holdings (no duplicates)
    let addedCount = 0;
    let updatedCount = 0;
    
    for (const newH of newHoldings) {
      const key = getHoldingKey(newH);
      const enrichedHolding = { ...newH, addedAt: new Date().toISOString(), source: 'upload' };
      
      if (existingMap.has(key)) {
        // Update existing holding with new values (preserve id if present)
        const existing = existingMap.get(key);
        existingMap.set(key, { 
          ...existing, 
          ...enrichedHolding,
          id: existing.id || enrichedHolding.id,
          updatedAt: new Date().toISOString()
        });
        updatedCount++;
      } else {
        // Add new holding
        existingMap.set(key, enrichedHolding);
        addedCount++;
      }
    }
    
    const mergedHoldings = Array.from(existingMap.values());

    await agentProspectWizardService.updateProspectPortfolio(req.params.id, mergedHoldings);
    if (mergedHoldings.length > 0) {
      await prospectReadinessService.advanceOnHoldingsImport(req.params.id);
    }
    res.json({ 
      success: true, 
      holdings: mergedHoldings, 
      message: `${addedCount} new holdings added, ${updatedCount} existing holdings updated`,
      addedCount,
      updatedCount,
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


export default router;
