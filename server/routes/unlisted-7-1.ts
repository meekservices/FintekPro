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
router.post('/admin/companies/bulk-enrich-mca', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { limit = 50 } = req.body;
    
    // Get all companies with CIN that haven't been synced recently
    const companies = await storage.getUnlistedCompanies({ status: 'active' });
    const companiesWithCIN = companies.filter(c => c.cin);
    
    // Sort by last synced (oldest first) and limit
    const toEnrich = companiesWithCIN
      .sort((a, b) => {
        if (!a.lastSyncedAt) return -1;
        if (!b.lastSyncedAt) return 1;
        return new Date(a.lastSyncedAt).getTime() - new Date(b.lastSyncedAt).getTime();
      })
      .slice(0, limit);
    
    console.log(`📊 Bulk MCA enrichment: Processing ${toEnrich.length} companies`);
    
    const results = {
      total: toEnrich.length,
      success: 0,
      failed: 0,
      companies: [] as { id: string; name: string; status: string; financialsStored?: number }[]
    };
    
    for (const company of toEnrich) {
      try {
        const result = await enrichUnlistedCompanyWithMCAData(company.id, company.cin!);
        if (result.success) {
          results.success++;
          results.companies.push({
            id: company.id,
            name: company.name,
            status: 'success',
            financialsStored: result.financialsStored
          });
        } else {
          results.failed++;
          results.companies.push({
            id: company.id,
            name: company.name,
            status: 'failed'
          });
        }
      } catch (err) {
        results.failed++;
        results.companies.push({
          id: company.id,
          name: company.name,
          status: 'error'
        });
      }
    }
    
    return apiResponse.success(res, results);
  } catch (error: any) {
    console.error('Error in bulk MCA enrichment:', error);
    return apiResponse.serverError(res, error.message || 'Failed bulk MCA enrichment');
  }
});

/**
 * GET /api/unlisted/admin/companies/:id/test-enrichment
 * Test endpoint to verify the data enrichment fallback chain is working (Admin only)
 * Returns detailed logs of which sources were attempted and their results
 * This is a dry-run that logs the fallback chain without persisting changes
 */
router.get('/admin/companies/:id/test-enrichment', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const company = await storage.getUnlistedCompanyById(id);
    if (!company) {
      return apiResponse.notFound(res, 'Company not found');
    }
    
    console.log(`\n========================================`);
    console.log(`[TEST ENRICHMENT] Starting test for: ${company.name}`);
    console.log(`  Company ID: ${id}`);
    console.log(`  CIN: ${company.cin || 'NOT SET'}`);
    console.log(`  ISIN: ${company.isin || 'NOT SET'}`);
    console.log(`  Probe42 ID: ${company.probe42CompanyId || 'NOT SET'}`);
    console.log(`========================================\n`);
    
    const currentYear = new Date().getFullYear();
    const fy = `FY${currentYear - 1}-${currentYear.toString().slice(-2)}`;
    
    const enriched = await dataEnrichmentService.enrichCompanyFinancials(id, fy, {
      forceRefresh: true,
    });
    
    const sourcesAttempted = enriched.auditTrail
      .filter(a => a.action === 'fetch')
      .map(a => ({
        source: a.source,
        success: a.confidence !== undefined && a.confidence > 0,
        reason: a.reason,
        confidence: a.confidence,
      }));
    
    console.log(`\n========================================`);
    console.log(`[TEST ENRICHMENT] Results for: ${company.name}`);
    console.log(`  Sources used: ${enriched.sources.join(', ') || 'NONE'}`);
    console.log(`  Metrics fetched: ${Object.keys(enriched.metrics).length}`);
    console.log(`  Overall confidence: ${(enriched.overallConfidence * 100).toFixed(1)}%`);
    console.log(`  Audit trail entries: ${enriched.auditTrail.length}`);
    console.log(`========================================\n`);
    
    return apiResponse.success(res, {
      company: {
        id: company.id,
        name: company.name,
        cin: company.cin,
        isin: company.isin,
        probe42CompanyId: company.probe42CompanyId,
      },
      financialYear: fy,
      fallbackChainOrder: ['credhive', 'mca', 'nse_bse', 'finnhub', 'yahoo'],
      sourcesAttempted,
      sourcesSucceeded: enriched.sources,
      metricsCollected: Object.keys(enriched.metrics),
      metrics: enriched.metrics,
      overallConfidence: enriched.overallConfidence,
      auditTrail: enriched.auditTrail,
      testStatus: enriched.sources.length > 0 ? 'SUCCESS' : 'NO_DATA_SOURCES',
    });
  } catch (error: any) {
    console.error('[TEST ENRICHMENT] Error:', error);
    return apiResponse.serverError(res, error.message || 'Test enrichment failed');
  }
});

/**
 * GET /api/unlisted/admin/companies/:id/financials/:metric/provenance
 * "Why This Number?" API - Get full provenance and audit trail for a specific metric (Admin only)
 * Returns source, retrieval time, confidence, and override history
 */
router.get('/admin/companies/:id/financials/:metric/provenance', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id, metric } = req.params;
    const { financialYear } = req.query;
    
    const company = await storage.getUnlistedCompanyById(id);
    if (!company) {
      return apiResponse.notFound(res, 'Company not found');
    }
    
    const provenance = await dataEnrichmentService.getMetricProvenance(
      id,
      metric,
      financialYear as string | undefined
    );
    
    const usageFlags = await dataEnrichmentService.getDataUsageFlags(
      id,
      financialYear as string || `FY${new Date().getFullYear() - 1}-${new Date().getFullYear().toString().slice(-2)}`
    );
    
    return apiResponse.success(res, {
      companyId: id,
      companyName: company.companyName,
      metric: provenance.metric,
      currentValue: provenance.currentValue,
      history: provenance.history,
      sourceBreakdown: provenance.sourceBreakdown,
      usageFlags: {
        aiAllowed: usageFlags.aiAllowed,
        executionAllowed: usageFlags.executionAllowed,
        lockedForAdvisory: usageFlags.lockedForAdvisory,
        confidenceScore: usageFlags.confidenceScore,
        dataQualityScore: usageFlags.dataQualityScore,
        blockReasons: usageFlags.blockReasons,
      },
      whyThisNumber: {
        explanation: provenance.currentValue 
          ? `This ${metric} value of ${provenance.currentValue.value} was sourced from ${provenance.currentValue.source} on ${provenance.currentValue.retrievedAt.toISOString()} with ${(provenance.currentValue.confidenceScore * 100).toFixed(0)}% confidence.`
          : `No value currently recorded for ${metric}.`,
        sourcePriority: dataEnrichmentService.getSourcePriority(),
        totalHistoricalRecords: provenance.history.length,
      },
    });
  } catch (error: any) {
    console.error('Error fetching metric provenance:', error);
    return apiResponse.serverError(res, 'Failed to fetch metric provenance');
  }
});

/**
 * GET /api/unlisted/admin/companies/:id/data-usage-flags
 * Get AI and execution guardrails for a company's data (Admin only)
 */
router.get('/admin/companies/:id/data-usage-flags', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { financialYear } = req.query;
    
    const fy = financialYear as string || `FY${new Date().getFullYear() - 1}-${new Date().getFullYear().toString().slice(-2)}`;
    
    const flags = await dataEnrichmentService.getDataUsageFlags(id, fy);
    
    return apiResponse.success(res, {
      companyId: id,
      financialYear: fy,
      ...flags,
      recommendation: flags.executionAllowed 
        ? 'Data suitable for trading and advisory' 
        : flags.aiAllowed 
          ? 'Data suitable for AI analysis only, not for trading'
          : 'Data quality too low for any automated use',
    });
  } catch (error: any) {
    console.error('Error fetching data usage flags:', error);
    return apiResponse.serverError(res, 'Failed to fetch data usage flags');
  }
});

/**
 * GET /api/unlisted/financial-reports/:symbol
 * Fetch financial reports from NSE and BSE for any stock symbol
 * Returns quarterly results, announcements, board meetings, corporate actions, shareholding pattern
 */
router.get('/financial-reports/:symbol', async (req: Request, res: Response) => {
  try {
    const { symbol } = req.params;
    const { scripcode, source } = req.query;
    
    if (!symbol) {
      return apiResponse.badRequest(res, 'Stock symbol is required');
    }

    console.log(`[Financial Reports] Fetching reports for ${symbol}`);

    if (source === 'nse') {
      const nseReports = await dataEnrichmentService.fetchNSEFinancialReports(symbol);
      return apiResponse.success(res, nseReports);
    } else if (source === 'bse') {
      const bseReports = await dataEnrichmentService.fetchBSEFinancialReports(symbol, scripcode as string | undefined);
      return apiResponse.success(res, bseReports);
    } else {
      const unifiedReports = await dataEnrichmentService.fetchUnifiedFinancialReports(symbol, scripcode as string | undefined);
      return apiResponse.success(res, unifiedReports);
    }
  } catch (error: any) {
    console.error('Error fetching financial reports:', error);
    return apiResponse.serverError(res, 'Failed to fetch financial reports');
  }
});

/**
 * PUT /api/unlisted/admin/companies/:id/peers
 * Update listed peer companies for comparison (Admin only)
 */
router.put('/admin/companies/:id/peers', async (req: Request, res: Response) => {
  try {
    if (!req.user?.roles?.includes('admin')) {
      return apiResponse.forbidden(res, 'Admin access required');
    }
    
    const { id } = req.params;
    const { listedPeers } = req.body;
    
    if (!Array.isArray(listedPeers)) {
      return apiResponse.badRequest(res, 'listedPeers must be an array');
    }
    
    const company = await storage.getUnlistedCompanyById(id);
    if (!company) {
      return apiResponse.notFound(res, 'Company not found');
    }
    
    await storage.updateUnlistedCompany(id, { listedPeers });
    
    console.log(`[Peers] Updated ${listedPeers.length} listed peers for company ${id}`);
    
    return apiResponse.success(res, { 
      message: 'Listed peers updated successfully',
      peersCount: listedPeers.length 
    });
  } catch (error: any) {
    console.error('Error updating listed peers:', error);
    return apiResponse.serverError(res, 'Failed to update listed peers');
  }
});

/**
 * POST /api/unlisted/admin/companies/:id/auto-fetch-peers
 * Auto-fetch listed peer companies based on sector/industry using Yahoo Finance (Admin only)
 */
router.post('/admin/companies/:id/auto-fetch-peers', async (req: Request, res: Response) => {
  try {
    if (!req.user?.roles?.includes('admin')) {
      return apiResponse.forbidden(res, 'Admin access required');
    }
    
    const { id } = req.params;
    const { referenceSymbol, maxPeers = 5 } = req.body;
    
    const company = await storage.getUnlistedCompanyById(id);
    if (!company) {
      return apiResponse.notFound(res, 'Company not found');
    }
    
    const companyData = company as any;
    console.log(`[Auto-Fetch Peers] Starting for ${companyData.name}, sector: ${companyData.sector}, industry: ${companyData.industry}`);
    
    // Dynamic import of yahoo-finance2
    const yahooFinance = await import('yahoo-finance2').then(m => m.default);
    
    // Determine reference symbol to use for finding peers
    // Strategy: Use provided symbol, or find a major company in the same sector
    let symbolToUse = referenceSymbol;
    
    if (!symbolToUse) {
      // Map common sectors to major Indian listed companies
      const sectorToSymbolMap: Record<string, string> = {
        'Technology': 'TCS.NS',
        'Information Technology': 'TCS.NS',
        'IT': 'INFY.NS',
        'Software': 'WIPRO.NS',
        'Finance': 'HDFCBANK.NS',
        'Banking': 'HDFCBANK.NS',
        'Financial Services': 'BAJFINANCE.NS',
        'NBFC': 'BAJFINANCE.NS',
        'Fintech': 'PAYTM.NS',
        'Healthcare': 'SUNPHARMA.NS',
        'Pharmaceuticals': 'SUNPHARMA.NS',
        'Consumer': 'HINDUNILVR.NS',
        'FMCG': 'ITC.NS',
        'Retail': 'DMART.NS',
        'E-commerce': 'ETERNAL.NS',
        'Food Delivery': 'ETERNAL.NS',
        'Logistics': 'DELHIVERY.NS',
        'Manufacturing': 'TATAMOTORS.NS',
        'Auto': 'MARUTI.NS',
        'Automobile': 'MARUTI.NS',
        'Real Estate': 'DLF.NS',
        'Infrastructure': 'LT.NS',
        'Energy': 'RELIANCE.NS',
        'Oil & Gas': 'ONGC.NS',
        'Telecom': 'BHARTIARTL.NS',
        'Media': 'ZEEL.NS',
        'Entertainment': 'PVR.NS',
        'Insurance': 'SBILIFE.NS',
        'EdTech': 'INFY.NS', // No direct EdTech listing, use proxy
        'Agriculture': 'UPL.NS',
        'Chemicals': 'PIDILITIND.NS',
        'Metals': 'TATASTEEL.NS',
        'Power': 'NTPC.NS',
        'Cement': 'ULTRACEMCO.NS',
      };
      
      // Find matching sector/industry
      const sector = (companyData.sector || '').toLowerCase();
      const industry = (companyData.industry || '').toLowerCase();
      
      for (const [key, symbol] of Object.entries(sectorToSymbolMap)) {
        if (sector.includes(key.toLowerCase()) || industry.includes(key.toLowerCase()) || 
            key.toLowerCase().includes(sector) || key.toLowerCase().includes(industry)) {
          symbolToUse = symbol;
          break;
        }
      }
      
      // Default to NIFTY 50 company if no match
      if (!symbolToUse) {
        symbolToUse = 'RELIANCE.NS';
      }
    }
    
    console.log(`[Auto-Fetch Peers] Using reference symbol: ${symbolToUse}`);
    
    // Fetch recommended symbols from Yahoo Finance
    let recommendedSymbols: { symbol: string; score: number }[] = [];
    try {
      const recommendations = await yahooFinance.recommendationsBySymbol(symbolToUse);
      recommendedSymbols = recommendations.recommendedSymbols?.slice(0, maxPeers) || [];
    } catch (recError: any) {
      console.log(`[Auto-Fetch Peers] Could not get recommendations: ${recError.message}`);
      // Fallback: use sector-specific symbols
      const sectorFallbacks: Record<string, string[]> = {
        'Technology': ['TCS.NS', 'INFY.NS', 'WIPRO.NS', 'HCLTECH.NS', 'TECHM.NS'],
        'Finance': ['HDFCBANK.NS', 'ICICIBANK.NS', 'KOTAKBANK.NS', 'SBIN.NS', 'AXISBANK.NS'],
        'Healthcare': ['SUNPHARMA.NS', 'DRREDDY.NS', 'CIPLA.NS', 'DIVISLAB.NS', 'APOLLOHOSP.NS'],
        'Consumer': ['HINDUNILVR.NS', 'ITC.NS', 'NESTLEIND.NS', 'DABUR.NS', 'BRITANNIA.NS'],
      };
      
      const sector = (companyData.sector || 'Technology').toLowerCase();
      const fallbackSymbols = Object.entries(sectorFallbacks).find(([key]) => 
        sector.includes(key.toLowerCase())
      )?.[1] || sectorFallbacks['Technology'];
      
      recommendedSymbols = fallbackSymbols.slice(0, maxPeers).map((s, i) => ({ symbol: s, score: 0.5 - (i * 0.05) }));
    }
    
    if (recommendedSymbols.length === 0) {
      return apiResponse.success(res, { 
        message: 'No peer recommendations found',
        peersAdded: 0,
        peers: []
      });
    }
    
    // Fetch detailed data for each peer
    const listedPeers: Array<{
      name: string;
      ticker: string;
      exchange: string;
      marketCap?: number;
      peRatio?: number;
      pbRatio?: number;
      evEbitda?: number;
      roe?: number;
      roce?: number;
      debtEquity?: number;
      revenueGrowth?: number;
    }> = [];
    
    for (const rec of recommendedSymbols) {
      try {
        // Ensure we're using Indian symbols
        let symbol = rec.symbol;
        if (!symbol.includes('.NS') && !symbol.includes('.BO')) {
          symbol = `${symbol}.NS`;
        }
        
        const quote = await yahooFinance.quote(symbol);
        
        if (quote) {
          // Try to get key statistics
          let keyStats: any = null;
          try {
            const quoteSummary = await yahooFinance.quoteSummary(symbol, { modules: ['defaultKeyStatistics', 'financialData'] });
            keyStats = quoteSummary;
          } catch (statsErr) {
            console.log(`[Auto-Fetch Peers] Could not fetch stats for ${symbol}`);
          }
          
          listedPeers.push({
            name: quote.longName || quote.shortName || symbol.replace('.NS', '').replace('.BO', ''),
            ticker: symbol.replace('.NS', '').replace('.BO', ''),
            exchange: symbol.includes('.NS') ? 'NSE' : 'BSE',
            marketCap: quote.marketCap,
            peRatio: quote.trailingPE,
            pbRatio: keyStats?.defaultKeyStatistics?.priceToBook,
            evEbitda: keyStats?.defaultKeyStatistics?.enterpriseToEbitda,
            roe: keyStats?.financialData?.returnOnEquity ? keyStats.financialData.returnOnEquity * 100 : undefined,
            roce: keyStats?.financialData?.returnOnAssets ? keyStats.financialData.returnOnAssets * 100 : undefined,
            debtEquity: keyStats?.financialData?.debtToEquity ? keyStats.financialData.debtToEquity / 100 : undefined,
            revenueGrowth: keyStats?.financialData?.revenueGrowth ? keyStats.financialData.revenueGrowth * 100 : undefined,
          });
        }
      } catch (quoteError: any) {
        console.log(`[Auto-Fetch Peers] Error fetching ${rec.symbol}: ${quoteError.message}`);
      }
    }
    
    if (listedPeers.length > 0) {
      // Merge with existing peers if any
      const existingPeers = Array.isArray(companyData.listedPeers) ? companyData.listedPeers : [];
      const existingTickers = new Set(existingPeers.map((p: any) => p.ticker?.toUpperCase()));
      const newPeers = listedPeers.filter(p => !existingTickers.has(p.ticker.toUpperCase()));
      const mergedPeers = [...existingPeers, ...newPeers];
      
      await storage.updateUnlistedCompany(id, { listedPeers: mergedPeers });
      
      console.log(`[Auto-Fetch Peers] Added ${newPeers.length} new peers for ${companyData.name}`);
      
      return apiResponse.success(res, { 
        message: `Successfully fetched ${newPeers.length} new peer companies`,
        referenceSymbol: symbolToUse,
        peersAdded: newPeers.length,
        totalPeers: mergedPeers.length,
        peers: newPeers
      });
    }
    
    return apiResponse.success(res, { 
      message: 'Could not fetch peer data',
      peersAdded: 0,
      peers: []
    });
    
  } catch (error: any) {
    console.error('Error auto-fetching peers:', error);
    return apiResponse.serverError(res, `Failed to auto-fetch peers: ${error.message}`);
  }
});

/**
 * POST /api/unlisted/admin/refresh-company-data/:companyId
 * Refresh all company data from external sources (Admin only)
 */

export default router;
