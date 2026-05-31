// @ts-nocheck
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

interface Holding {
  name?: string;
  productName?: string;
  assetType?: string;
  productType?: string;
  quantity?: number;
  currentValue?: number;
  [key: string]: any;
}

interface NormalizedHolding {
  name: string;
  assetType: string;
  quantity: number;
  currentValue: number;
  [key: string]: any;
}

// Helper to normalize holdings to backend format
function normalizeHoldings(holdings: Holding[]): NormalizedHolding[] {
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

router.get("/unlisted-stocks/recommendations", async (req: Request, res: Response): Promise<void> => {
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
  } catch (error: unknown) {
    console.error("[UnlistedStocks] Error fetching recommendations:", error);
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, message: msg });
  }
});

// Populate broad sectors for all unlisted stocks (Admin action)
router.post("/unlisted-stocks/populate-sectors", async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await populateUnlistedBroadSectors();
    res.json({ 
      success: true, 
      message: `Populated broad sectors for ${result.updated} companies`,
      ...result
    });
  } catch (error: unknown) {
    console.error("[UnlistedStocks] Error populating sectors:", error);
    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, message: msg });
  }
});

/**
 * Unified CAS/PDF parsing endpoint
 * Routes through UnifiedPortfolioImportService which auto-detects CAS vs broker PDF
 * Returns holdings with LOTS as first-class entities for proposal builder
 */
router.post(
  "/portfolio/parse-cas",
  upload.single('file'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.file) {
        res.status(400).json({ success: false, error: 'No file uploaded' });
        return;
      }

      console.log('[Agent CAS Parse] Using unified service:', req.file.originalname);
      const importResult = await unifiedPortfolioImportService.importFromPDF(req.file.buffer, req.file.originalname);

      if (!importResult.success || importResult.holdings.length === 0) {
        res.json({
          success: false,
          error: 'No holdings found in the statement',
          errors: importResult.errors.length > 0 ? importResult.errors : ['Failed to parse statement']
        });
        return;
      }

      try {
        assertLotsNotDropped(importResult.holdings);
      } catch (lotsError: unknown) {
        const msg = lotsError instanceof Error ? lotsError.message : String(lotsError);
        console.error('[Agent CAS Parse] CRITICAL:', msg);
        res.status(500).json({
          success: false,
          error: 'CAS_LOTS_DROPPED',
          message: 'Transaction rows found in CAS but lost during processing.'
        });
        return;
      }

      const holdings = importResult.holdings.map((h, idx) => ({
        id: h.id || `cas-${idx}-${Date.now()}`,
        name: h.name || 'Unknown Fund',
        productName: h.name || 'Unknown Fund',
        symbol: h.symbol || '',
        isin: h.isin || '',
        quantity: h.quantity || 0,
        units: h.quantity || 0,
        averagePrice: h.avgCostPerUnit || 0,
        averageCost: h.avgCostPerUnit || 0,
        investedValue: h.investedValue || 0,
        currentValue: h.currentValue || 0,
        currentNav: h.currentNav || 0,
        nav: h.currentNav || 0,
        unrealizedGain: h.unrealizedGain || 0,
        unrealizedGainPercent: h.unrealizedGainPercent || 0,
        assetType: h.assetType || 'mutual_fund',
        productType: h.assetType || 'mutual_fund',
        folioNumber: h.folioNumber || '',
        folio: h.folioNumber || '',
        amc: h.amcName || '',
        confidenceScore: h.confidenceScore || 90,
        broker: h.broker || importResult.brokerDetected || 'Unknown',
        lots: h.lots || [],
        lotSummary: h.lotSummary || `${h.lotCount || 0} lot${(h.lotCount || 0) !== 1 ? 's' : ''}`,
        lotCount: h.lotCount || 0,
        holdingTier: h.holdingTier || 'FULL',
        eligibleForTax: h.eligibleForTax !== false,
        tierWarnings: h.tierWarnings || [],
        firstPurchaseDate: h.firstPurchaseDate || h.purchaseDate || '',
        transactions: h.transactions || []
      }));

      const calculatedValue = holdings.reduce((sum, h) => sum + h.currentValue, 0);
      const calculatedInvested = holdings.reduce((sum, h) => sum + h.investedValue, 0);
      const totalLots = holdings.reduce((sum, h) => sum + (h.lots?.length || 0), 0);
      const authoritativeMarketValue = importResult.portfolioSummary?.totalMarketValue || calculatedValue;
      const authoritativeCostValue = importResult.portfolioSummary?.totalCostValue || calculatedInvested;

      console.log(`[Agent CAS Parse] SUCCESS: ${holdings.length} holdings, ${totalLots} lots, Value: ₹${(authoritativeMarketValue / 100000).toFixed(2)} L`);

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
          calculatedValue,
          calculatedInvested,
          hasReconciliationDelta: Math.abs(calculatedValue - authoritativeMarketValue) > (authoritativeMarketValue * 0.005)
        },
        investor: importResult.investor,
        brokerDetected: importResult.brokerDetected || 'Unknown',
        warnings: importResult.warnings || []
      });
    } catch (error: unknown) {
      console.error('[Agent CAS Parse] Error:', error);
      const msg = error instanceof Error ? error.message : 'Failed to parse CAS statement';
      res.status(500).json({
        success: false,
        error: msg
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
  async (req: Request, res: Response): Promise<void> => {
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
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      res.status(500).json({ success: false, error: msg });
    }
  }
);

router.post(
  "/mf-returns/sync",
  requireAuth,
  requireRole(['admin', 'ops']), // Only admin/ops can trigger sync
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { mfReturnsSyncService } = await import("../services/mf-returns-sync-service");
      const { maxFunds = 50 } = req.body;
      
      // Run async to not block response
      mfReturnsSyncService.runBatchSync(Math.min(maxFunds, 200));
      
      res.json({
        success: true,
        message: `Started sync for up to ${maxFunds} funds. Check status endpoint for progress.`
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      res.status(500).json({ success: false, error: msg });
    }
  }
);

router.get(
  "/mf-returns/fund/:schemeCode",
  requireAuth,
  requireRole(['admin', 'agent', 'ops']),
  async (req: Request, res: Response): Promise<void> => {
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
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      res.status(500).json({ success: false, error: msg });
    }
  }
);

// Save prospect goals - matches by email/mobile/PAN to link with existing users
const prospectGoalSchema = z.object({
  goalType: z.string(),
  goalName: z.string(),
  targetAmount: z.number(),
  timelineYears: z.number(),
  priority: z.enum(['low', 'medium', 'high']),
  currentProgress: z.number().optional().default(0),
  monthlyContribution: z.number().optional().default(0)
});


export default router;
