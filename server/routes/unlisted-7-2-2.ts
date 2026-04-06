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
import { requireAuth } from '../middleware/roleMiddleware';
import { orderAuditHook } from '../services/order-audit-hook';
import { dataEnrichmentService } from '../services/data-enrichment-service';
import { unlistedValuationGovernanceService } from '../services/unlisted-valuation-governance-service';
import { unlistedFinancialEnrichmentService } from '../services/unlisted-financial-enrichment-service';
import {
  insertUnlistedEquityValuationHistorySchema,
  clientUnlistedDisclosureLog,
  unlistedEquityValuationHistory,
} from '@shared/schema';

// Admin middleware for unlisted marketplace admin routes
const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return apiResponse.unauthorized(res, 'Authentication required');
  }

  const userRoles = (req.user as any)?.roles || [];
  if (!userRoles.includes('admin') && !userRoles.includes('superadmin')) {
    return apiResponse.forbidden(res, 'Admin access required');
  }

  next();
};

const router = Router();

// ===================================================================
// COMPANY MANAGEMENT ROUTES
// ===================================================================

/**
 * GET /api/unlisted/companies
 * List only STORE-PUBLISHED unlisted companies (public - no KYC required for browsing)
 * Only returns companies where storeProductId is not null (published to store)
 */
router.get('/admin/reconciliation/moneycontrol', requireAdmin, async (req: Request, res: Response) => {
  try {
    const forceRefresh = req.query.refresh === 'true';
    const result = await moneyControlReconciliation.getReconciliationSuggestions(forceRefresh);
    
    return apiResponse.success(res, result);
  } catch (error: any) {
    console.error('Error fetching MoneyControl reconciliation:', error);
    return apiResponse.serverError(res, error.message || 'Failed to fetch reconciliation data');
  }
});

/**
 * POST /api/unlisted/admin/reconciliation/refresh
 * Force refresh the MoneyControl cache (Admin only)
 */
router.post('/admin/reconciliation/refresh', requireAdmin, async (req: Request, res: Response) => {
  try {
    const result = await moneyControlReconciliation.getReconciliationSuggestions(true);
    
    return apiResponse.success(res, {
      message: 'Cache refreshed successfully',
      ...result,
    });
  } catch (error: any) {
    console.error('Error refreshing MoneyControl cache:', error);
    return apiResponse.serverError(res, error.message || 'Failed to refresh cache');
  }
});

const moneyControlCompanySchema = z.object({
  name: z.string().min(1, 'Company name is required'),
  isin: z.string().min(12).max(12).regex(/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/, 'Invalid ISIN format'),
  price: z.number().positive('Price must be positive'),
  change: z.number().optional().default(0),
  changePercent: z.number().optional().default(0),
  previousClose: z.number().optional().default(0),
  sector: z.string().optional(),
  scrapedAt: z.string().or(z.date()).optional(),
});

/**
 * POST /api/unlisted/admin/reconciliation/sync
 * Sync a company from MoneyControl to FintekPro (Admin only)
 */
router.post('/admin/reconciliation/sync', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { company } = req.body;
    
    if (!company) {
      return apiResponse.badRequest(res, 'Company data is required');
    }
    
    const validationResult = moneyControlCompanySchema.safeParse(company);
    if (!validationResult.success) {
      return apiResponse.badRequest(res, 'Invalid company data', validationResult.error.errors);
    }
    
    const validatedCompany = validationResult.data;
    
    const synced = await moneyControlReconciliation.syncCompanyFromMoneyControl({
      ...validatedCompany,
      scrapedAt: validatedCompany.scrapedAt ? new Date(validatedCompany.scrapedAt) : new Date(),
    }, (req.user as any)?.id);
    
    return apiResponse.created(res, {
      message: 'Company synced successfully',
      company: synced,
    });
  } catch (error: any) {
    console.error('Error syncing company from MoneyControl:', error);
    return apiResponse.serverError(res, error.message || 'Failed to sync company');
  }
});

/**
 * POST /api/unlisted/admin/reconciliation/sync-batch
 * Sync multiple companies from MoneyControl to FintekPro (Admin only)
 */
router.post('/admin/reconciliation/sync-batch', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { companies } = req.body;
    
    if (!Array.isArray(companies) || companies.length === 0) {
      return apiResponse.badRequest(res, 'Companies array is required');
    }
    
    if (companies.length > 50) {
      return apiResponse.badRequest(res, 'Maximum 50 companies per batch');
    }
    
    const validatedCompanies = [];
    const validationErrors = [];
    
    for (let i = 0; i < companies.length; i++) {
      const result = moneyControlCompanySchema.safeParse(companies[i]);
      if (result.success) {
        validatedCompanies.push({
          ...result.data,
          scrapedAt: result.data.scrapedAt ? new Date(result.data.scrapedAt) : new Date(),
        });
      } else {
        validationErrors.push({ index: i, name: companies[i]?.name, errors: result.error.errors });
      }
    }
    
    if (validatedCompanies.length === 0) {
      return apiResponse.badRequest(res, 'No valid companies to sync', validationErrors);
    }
    
    const result = await moneyControlReconciliation.syncMultipleCompanies(validatedCompanies, req.user?.id);
    
    return apiResponse.success(res, {
      message: `Synced ${result.success.length} companies, ${result.failed.length} failed`,
      success: result.success,
      failed: result.failed,
      validationErrors: validationErrors.length > 0 ? validationErrors : undefined,
    });
  } catch (error: any) {
    console.error('Error batch syncing companies:', error);
    return apiResponse.serverError(res, error.message || 'Failed to batch sync companies');
  }
});

/**
 * GET /api/unlisted/admin/reconciliation/cache-status
 * Get current cache status (Admin only)
 */



export default router;
