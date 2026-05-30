/**
 * Unlisted Marketplace API Routes
 * 
 * Handles all routes related to unlisted share trading marketplace including:
 * - Company management
 * - Credhive integration for financial data
 * - Buy/Sell listings and deal matching
 * - Financials and ratios tracking
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import { storage } from '../storage';
import { db } from '../db';
import { apiResponse } from '../utils/responses';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { credhiveService } from '../services/credhive-service';
import { credhiveAdapter } from '../services/vendor-adapters/credhive.adapter';
import { enrichUnlistedCompanyWithMCAData } from '../services/mca-enrichment-service';
import { PriceSuggestionService } from '../services/price-suggestion';
import { priceAggregationService } from '../services/price-aggregation';
import { moneyControlReconciliation } from '../services/moneycontrol-reconciliation';
import { mcaService } from '../services/mca-service';
import { unifiedCompanyDataService } from '../services/unified-company-data-service';
import { valuationService } from '../services/valuation-service';
import { unlistedPricingWorkflowService } from '../services/unlisted-pricing-workflow';
import { unlistedEligibilityService } from '../services/unlisted-eligibility';
import { unlistedRiskDisclosureService, saveRiskAcknowledgment, requireRiskDisclosure } from '../services/unlisted-risk-disclosures';
import {
  insertUnlistedCompanySchema,
  insertUnlistedPriceHistorySchema,
  insertSellListingSchema,
  insertBuyRequestSchema,
  insertUnlistedDealSchema,
  insertUnlistedCartSchema,
  sellListings,
  buyRequests,
  unlistedDeals,
  unlistedCart,
  userProfiles,
  type UnlistedCompany,
  type SellListing,
  type BuyRequest,
  type UnlistedCartItem,
} from '@shared/schema';
import { requireLevel2 } from '../middleware/kyc-level-gate';
import { requireAuth, requireAdmin } from '../middleware/roleMiddleware';
import { orderAuditHook } from '../services/order-audit-hook';
import { dataEnrichmentService } from '../services/data-enrichment-service';
import { unlistedValuationGovernanceService } from '../services/unlisted-valuation-governance-service';
import { unlistedFinancialEnrichmentService } from '../services/unlisted-financial-enrichment-service';
import * as schema from "@shared/schema";
import {
  insertUnlistedEquityValuationHistorySchema,
  clientUnlistedDisclosureLog,
  unlistedEquityValuationHistory,
} from '@shared/schema';



const router = Router();

// ===================================================================
// COMPANY MANAGEMENT ROUTES
// ===================================================================

/**
 * GET /api/unlisted/companies
 * List only STORE-PUBLISHED unlisted companies (public - no KYC required for browsing)
 * Only returns companies where storeProductId is not null (published to store)
 */
router.post('/admin/compliance/check-investor-limit', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { companyId, userId } = req.body;
    
    if (!companyId || !userId) {
      return apiResponse.badRequest(res, 'companyId and userId are required');
    }
    
    const result = await regulatoryComplianceService.checkInvestorLimit(companyId, userId);
    return apiResponse.success(res, {
      message: 'Investor limit check completed',
      data: result,
    });
  } catch (error: any) {
    console.error('[RegCompliance] Error checking investor limit:', error);
    return apiResponse.serverError(res, 'Failed to check investor limit');
  }
});

/**
 * GET /api/unlisted/admin/compliance/str-flags
 * Get pending STR flags for admin review
 */
router.get('/admin/compliance/str-flags', requireAdmin, async (req: Request, res: Response) => {
  try {
    const data = await regulatoryComplianceService.getPendingSTRFlags();
    return apiResponse.success(res, {
      message: 'STR flags retrieved',
      data,
    });
  } catch (error: any) {
    console.error('[RegCompliance] Error fetching STR flags:', error);
    return apiResponse.serverError(res, 'Failed to fetch STR flags');
  }
});

/**
 * POST /api/unlisted/compliance/check-lockin
 * Check if shares can be sold (lock-in check)
 * User can only check their own lock-in status
 */
router.post('/compliance/check-lockin', requireAuth, async (req: Request, res: Response) => {
  try {
    const { companyId, sharesToSell } = req.body;
    const userId = (req as any).user?.id;
    
    if (!userId) {
      return apiResponse.unauthorized(res, 'Authentication required');
    }
    
    if (!companyId || !sharesToSell) {
      return apiResponse.badRequest(res, 'companyId and sharesToSell are required');
    }
    
    const result = await regulatoryComplianceService.checkLockInStatus(companyId, userId, sharesToSell);
    return apiResponse.success(res, {
      message: 'Lock-in check completed',
      data: result,
    });
  } catch (error: any) {
    console.error('[RegCompliance] Error checking lock-in:', error);
    return apiResponse.serverError(res, 'Failed to check lock-in status');
  }
});

/**
 * POST /api/unlisted/admin/compliance/check-company-status
 * Check company listing status from MCA
 */
router.post('/admin/compliance/check-company-status', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { companyId } = req.body;
    
    if (!companyId) {
      return apiResponse.badRequest(res, 'companyId is required');
    }
    
    const result = await regulatoryComplianceService.checkCompanyListingStatus(companyId);
    return apiResponse.success(res, {
      message: 'Company status check completed',
      data: result,
    });
  } catch (error: any) {
    console.error('[RegCompliance] Error checking company status:', error);
    return apiResponse.serverError(res, 'Failed to check company status');
  }
});

/**
 * POST /api/unlisted/admin/compliance/verify-source-of-funds
 * Mark source of funds as verified for a user
 */
router.post('/admin/compliance/verify-source-of-funds', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { companyId, userId } = req.body;
    const adminId = (req as any).user?.id || 'admin';
    
    if (!companyId || !userId) {
      return apiResponse.badRequest(res, 'companyId and userId are required');
    }
    
    const result = await regulatoryComplianceService.markSourceOfFundsVerified(companyId, userId, adminId);
    return apiResponse.success(res, {
      message: result.success ? 'Source of funds verified successfully' : 'Failed to verify source of funds',
      data: result,
    });
  } catch (error: any) {
    console.error('[RegCompliance] Error verifying source of funds:', error);
    return apiResponse.serverError(res, 'Failed to verify source of funds');
  }
});

// ==================== END REGULATORY COMPLIANCE API ROUTES ====================

// ==================== INSTITUTIONAL VALUATION GOVERNANCE API ROUTES ====================

/**
 * POST /api/unlisted/companies/:id/valuation
 * Append-only valuation entry for an unlisted instrument (Admin only).
 * Rules: must include valuation_method + valuation_date + price.
 * Supporting document URL optional. Never overwrites existing rows.
 */
router.post('/companies/:id/valuation', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const schema = z.object({
      valuationMethod: z.enum(['dcf', 'nav', 'comparable', 'book_value', 'market_implied', 'ca_certified', 'other']),
      price: z.number().positive('Price must be positive'),
      valuationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
      supportingDocumentUrl: z.string().url().optional(),
      notes: z.string().max(1000).optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return apiResponse.badRequest(res, parsed.error.issues[0].message);
    }

    const result = await unlistedValuationGovernanceService.addValuation(id, {
      ...parsed.data,
      addedBy: (req.user as any)?.id,
    });

    return apiResponse.success(res, result, 'Valuation recorded successfully');
  } catch (error: any) {
    console.error('[ValuationGovernance] Error adding valuation:', error);
    if (error.message?.includes('not found')) {
      return apiResponse.notFound(res, error.message);
    }
    return apiResponse.serverError(res, 'Failed to record valuation');
  }
});

/**
 * GET /api/unlisted/companies/:id/valuation
 * Full versioned valuation history for a company (newest first).
 */
router.get('/companies/:id/valuation', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const [history, latest] = await Promise.all([
      unlistedValuationGovernanceService.getValuationHistory(id),
      unlistedValuationGovernanceService.getLatestValuation(id),
    ]);

    return apiResponse.success(res, {
      companyId: id,
      latestValuation: latest,
      history,
      totalEntries: history.length,
    });
  } catch (error: any) {
    console.error('[ValuationGovernance] Error fetching history:', error);
    return apiResponse.serverError(res, 'Failed to fetch valuation history');
  }
});

/**
 * POST /api/unlisted/client-disclosure
 * Log a client's acknowledgment of the unlisted equity risk disclosure.
 * Required before any unlisted instrument appears in a finalized proposal.
 */
router.post('/client-disclosure', requireAuth, async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      companyId: z.string().optional(),
      proposalId: z.string().optional(),
      disclosureVersion: z.string().default('1.0.0'),
      disclosureHash: z.string().length(64),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return apiResponse.badRequest(res, parsed.error.issues[0].message);
    }

    const clientId = (req.user as any)?.id;
    if (!clientId) return apiResponse.unauthorized(res, 'Authentication required');

    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
      || req.socket?.remoteAddress
      || null;

    await db.insert(clientUnlistedDisclosureLog).values({
      clientId,
      companyId: parsed.data.companyId ?? null,
      proposalId: parsed.data.proposalId ?? null,
      disclosureVersion: parsed.data.disclosureVersion,
      disclosureHash: parsed.data.disclosureHash,
      ipAddress: ip,
      userAgent: req.headers['user-agent'] ?? null,
    } as any);

    return apiResponse.success(res, { acknowledged: true, acknowledgedAt: new Date().toISOString() });
  } catch (error: any) {
    console.error('[Disclosure] Error logging disclosure:', error);
    return apiResponse.serverError(res, 'Failed to log disclosure acknowledgment');
  }
});

/**
 * GET /api/unlisted/admin/health
 * Institutional monitoring dashboard: stale valuations, compliance flags, enrichment failures.
 */
router.get('/admin/health', requireAdmin, async (req: Request, res: Response) => {
  try {
    const report = await unlistedValuationGovernanceService.getHealthReport();
    return apiResponse.success(res, report);
  } catch (error: any) {
    console.error('[UnlistedHealth] Error generating report:', error);
    return apiResponse.serverError(res, 'Failed to generate health report');
  }
});

/**
 * POST /api/unlisted/admin/valuation/check-stale
 * Manually trigger the valuation staleness sweep (also runs quarterly via cron).
 */
router.post('/admin/valuation/check-stale', requireAdmin, async (req: Request, res: Response) => {
  try {
    const report = await unlistedValuationGovernanceService.runStalenessSweep();
    return apiResponse.success(res, report, `Staleness sweep complete: ${report.markedStale} newly marked stale`);
  } catch (error: any) {
    console.error('[UnlistedHealth] Error in staleness sweep:', error);
    return apiResponse.serverError(res, 'Failed to run staleness sweep');
  }
});

/**
 * GET /api/unlisted/companies/:id/proposal-modifiers
 * Returns the unlisted-specific portfolio modifiers for a given instrument
 * (liquidity_weight=0, rebalance_eligible=false, stress_haircut=40%).
 * Used by the proposal engine before generating allocation.
 */
router.get('/companies/:id/proposal-modifiers', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const modifiers = unlistedValuationGovernanceService.getProposalModifiers(id);
    const latest = await unlistedValuationGovernanceService.getLatestValuation(id);
    return apiResponse.success(res, {
      companyId: id,
      ...modifiers,
      latestValuation: latest,
    });
  } catch (error: any) {
    console.error('[ProposalModifiers] Error:', error);
    return apiResponse.serverError(res, 'Failed to fetch proposal modifiers');
  }
});

// ==================== END INSTITUTIONAL VALUATION GOVERNANCE API ROUTES ====================

// ==================== PROBE42 FINANCIAL ENRICHMENT API ROUTES ====================

/**
 * GET /api/unlisted/admin/financial-health
 * Admin dashboard: negative NW companies, high leverage, no financials, consecutive losses.
 * Fully derived from CredHive data stored in company_financials / company_ratios.
 */
router.get('/admin/financial-health', requireAdmin, async (req: Request, res: Response) => {
  try {
    const report = await unlistedFinancialEnrichmentService.getFinancialHealthReport();
    return apiResponse.success(res, report);
  } catch (error: any) {
    console.error('[FinancialHealth] Error generating report:', error);
    return apiResponse.serverError(res, 'Failed to generate financial health report');
  }
});

/**
 * POST /api/unlisted/admin/companies/:id/enrich
 * Trigger on-demand CredHive enrichment for a single company.
 * Useful immediately after adding a new instrument or after subscription upgrade.
 */
router.post('/admin/companies/:id/enrich', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await unlistedFinancialEnrichmentService.enrichCompany(id);
    return apiResponse.success(res, result, `Enrichment complete. FHS: ${result.fhs?.toFixed(3) ?? 'N/A'}`);
  } catch (error: any) {
    console.error('[FinancialEnrichment] Error:', error);
    if (error.message?.includes('not found')) return apiResponse.notFound(res, error.message);
    return apiResponse.serverError(res, 'Enrichment failed: ' + error.message);
  }
});

/**
 * POST /api/unlisted/admin/enrich/batch
 * Trigger batch enrichment for all stale companies (>90 days without sync).
 * Rate-controlled: max 50 companies per call, 200ms inter-call delay.
 */
router.post('/admin/enrich/batch', requireAdmin, async (req: Request, res: Response) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const result = await unlistedFinancialEnrichmentService.enrichStaleBatch(limit);
    return apiResponse.success(res, result,
      `Batch enrichment: ${result.succeeded} succeeded, ${result.failed} failed of ${result.processed} processed`);
  } catch (error: any) {
    console.error('[FinancialEnrichment] Batch error:', error);
    return apiResponse.serverError(res, 'Batch enrichment failed');
  }
});

/**
 * GET /api/unlisted/companies/:id/fhs
 * Compute Financial Health Score for a company from stored ratio data.
 * Returns FHS [0,1], volatility proxy, and risk label.
 */
router.get('/companies/:id/fhs', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const fhs = await unlistedFinancialEnrichmentService.computeFHSFromDb(id);
    return apiResponse.success(res, { companyId: id, ...fhs });
  } catch (error: any) {
    console.error('[FHS] Error computing FHS:', error);
    return apiResponse.serverError(res, 'Failed to compute financial health score');
  }
});

/**
 * GET /api/unlisted/admin/vendor-calls
 * View CredHive API call log (rate/cost monitoring).
 */
router.get('/admin/vendor-calls', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { vendor = 'credhive', limit = '100', success } = req.query;
    const { db: dbConn } = await import('../db');
    const { vendorApiCallLog } = await import('@shared/schema');
    const { desc: descOrd, eq: eqOp, and: andOp } = await import('drizzle-orm');

    const filters: any[] = [eqOp(vendorApiCallLog.vendor, String(vendor))];
    if (success !== undefined) {
      filters.push(eqOp(vendorApiCallLog.success, success === 'true'));
    }

    const rows = await dbConn
      .select()
      .from(vendorApiCallLog)
      .where(filters.length === 1 ? filters[0] : andOp(...filters))
      .orderBy(descOrd(vendorApiCallLog.calledAt))
      .limit(Math.min(Number(limit), 500));

    const totalCost = rows.reduce((sum, r) => sum + (r.costUnit ?? 1), 0);
    const errorRate = rows.length ? rows.filter(r => !r.success).length / rows.length : 0;

    return apiResponse.success(res, {
      rows,
      summary: {
        totalCalls: rows.length,
        totalCostUnits: totalCost,
        errorRate: (errorRate * 100).toFixed(1) + '%',
        vendor: String(vendor),
      },
    });
  } catch (error: any) {
    console.error('[VendorCalls] Error:', error);
    return apiResponse.serverError(res, 'Failed to fetch vendor call log');
  }
});

// ==================== END PROBE42 FINANCIAL ENRICHMENT API ROUTES ====================


export default router;
