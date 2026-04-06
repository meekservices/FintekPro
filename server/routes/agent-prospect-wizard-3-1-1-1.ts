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

export default router;
