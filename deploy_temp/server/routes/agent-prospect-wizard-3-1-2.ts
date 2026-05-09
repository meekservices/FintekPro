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
// Falls back to the client's real portfolio (portfolioHoldings) when currentPortfolio is empty
// and the prospect was converted to a full client (convertedUserId is set).
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

    let holdings = (prospect.currentPortfolio as any[]) || [];

    // --- Fallback: pull from real portfolio when wizard scratchpad is empty ---
    let holdingSource = 'wizard_session';
    if (holdings.length === 0) {
      try {
        // First: look up portfolios by convertedUserId (full client), then by prospectId (linked prospect)
        const portfolioConditions = [];
        if (prospect.convertedUserId) {
          portfolioConditions.push(eq(portfolios.userId, prospect.convertedUserId));
        }
        // Also check portfolios directly linked to this prospect record
        portfolioConditions.push(eq(portfolios.prospectId, req.params.id));

        const userPortfolios = await db
          .select({ id: portfolios.id })
          .from(portfolios)
          .where(
            portfolioConditions.length === 1
              ? portfolioConditions[0]
              : or(...portfolioConditions)
          );

        if (userPortfolios.length > 0) {
          const portfolioIds = userPortfolios.map(p => p.id);

          // Fetch all holdings across all portfolios in one query
          const rawHoldings = await db
            .select({
              name: portfolioHoldings.name,
              isin: portfolioHoldings.isin,
              symbol: portfolioHoldings.symbol,
              assetType: portfolioHoldings.assetType,
              productType: portfolioHoldings.productType,
              quantity: portfolioHoldings.quantity,
              avgPrice: portfolioHoldings.avgPrice,
              currentValue: portfolioHoldings.currentValue,
              investedValue: portfolioHoldings.investedValue,
              folioNumber: portfolioHoldings.folioNumber,
              broker: portfolioHoldings.broker,
              purchaseDate: portfolioHoldings.purchaseDate,
              confidenceScore: portfolioHoldings.confidenceScore,
            })
            .from(portfolioHoldings)
            .where(inArray(portfolioHoldings.portfolioId, portfolioIds));

          if (rawHoldings.length > 0) {
            // Transform to wizard currentPortfolio format
            holdings = rawHoldings.map(h => ({
              name: h.name || 'Unknown',
              isin: h.isin ?? undefined,
              symbol: h.symbol ?? undefined,
              assetType: h.assetType,
              productType: h.productType ?? h.assetType,
              quantity: parseFloat(h.quantity?.toString() || '0'),
              averageCost: h.avgPrice ? parseFloat(h.avgPrice.toString()) : undefined,
              currentValue: parseFloat(h.currentValue?.toString() || '0'),
              investedValue: h.investedValue ? parseFloat(h.investedValue.toString()) : undefined,
              folioNumber: h.folioNumber ?? undefined,
              broker: h.broker ?? undefined,
              purchaseDate: h.purchaseDate ? String(h.purchaseDate) : undefined,
              confidenceScore: h.confidenceScore ?? undefined,
            }));
            holdingSource = 'real_portfolio';
            console.log(`[Agent Wizard] Loaded ${holdings.length} holdings from real portfolio for client ${prospect.convertedUserId} (prospect ${req.params.id})`);
          }
        }
      } catch (fallbackErr) {
        console.warn("[Agent Wizard] Real portfolio fallback failed, returning empty:", fallbackErr);
      }
    }
    // --- end fallback ---

    res.json({ success: true, holdings, source: holdingSource });
  } catch (error: any) {
    console.error("[Agent Wizard] Error fetching holdings:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ADD a single holding to prospect's portfolio


export default router;
