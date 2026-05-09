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
router.post('/admin/refresh-company-data/:companyId', async (req: Request, res: Response) => {
  try {
    if (!req.user?.roles?.includes('admin')) {
      return apiResponse.forbidden(res, 'Admin access required');
    }
    
    const { companyId } = req.params;
    
    const company = await storage.getUnlistedCompanyById(companyId);
    if (!company) {
      return apiResponse.notFound(res, 'Company not found');
    }
    
    const companyData = company as any;
    const results: { source: string; status: string; error?: string; data?: any }[] = [];
    
    // Try MoneyControl price refresh
    try {
      const mcResult = await priceAggregationService.refreshMoneyControlPrice(companyId);
      results.push({ source: 'moneycontrol', status: mcResult ? 'success' : 'no_data' });
    } catch (mcError: any) {
      results.push({ source: 'moneycontrol', status: 'error', error: mcError.message });
    }
    
    // Try MCA data fetch if CIN is available
    if (companyData.cin && mcaService.isConfigured()) {
      try {
        console.log(`[Refresh] Fetching MCA data for CIN: ${companyData.cin}`);
        const mcaData = await mcaService.getCompanyByCIN(companyData.cin);
        
        if (mcaData) {
          // Update company with MCA data
          const companyUpdate = mcaService.toFintekProCompanyData(mcaData);
          await storage.updateUnlistedCompany(companyId, {
            industry: companyUpdate.industry || companyData.industry,
            sector: companyUpdate.sector || companyData.sector,
            faceValue: companyUpdate.faceValue || companyData.faceValue,
            totalShares: companyUpdate.totalShares ? parseInt(companyUpdate.totalShares) : companyData.totalShares,
            description: companyUpdate.registeredAddress || companyData.description,
            lastSyncedAt: new Date(),
          });
          
          // Calculate basic metrics from MCA data
          const metrics = mcaService.estimateBasicMetrics(mcaData);
          
          // Store MCA-derived ratios if we have them
          if (metrics.debtEquity !== undefined) {
            const currentYear = new Date().getFullYear();
            const financialYear = `${currentYear - 1}-${currentYear}`;
            
            try {
              await storage.createCompanyRatios({
                companyId,
                financialYear,
                debtEquity: metrics.debtEquity.toString(),
                dataSource: 'mca',
              });
            } catch (ratioError) {
              console.log('[Refresh] Could not store MCA ratios:', ratioError);
            }
          }
          
          results.push({ 
            source: 'mca', 
            status: 'success',
            data: {
              paidUpCapital: mcaData.paidUpCapital,
              authorizedCapital: mcaData.authorizedCapital,
              directors: mcaData.directors.length,
              charges: mcaData.charges.length,
            }
          });
        } else {
          results.push({ source: 'mca', status: 'no_data' });
        }
      } catch (mcaError: any) {
        console.error('[Refresh] MCA error:', mcaError);
        results.push({ source: 'mca', status: 'error', error: mcaError.message });
      }
    } else if (!companyData.cin) {
      results.push({ source: 'mca', status: 'skipped', error: 'No CIN available' });
    } else {
      results.push({ source: 'mca', status: 'skipped', error: 'API not configured' });
    }
    
    // Try CredHive sync - always attempt as it has mock data fallback in development
    try {
      let credhiveId = companyData.probe42CompanyId;
      
      // If no CredHive ID, try to search and link the company
      if (!credhiveId && companyData.name) {
        console.log(`[Refresh] No CredHive ID, searching for: ${companyData.name}`);
        const searchResults = await credhiveService.searchCompanyByNameOrCIN(companyData.name.substring(0, 50));
        
        if (searchResults.length > 0) {
          // Link the first matching company
          credhiveId = searchResults[0].company_id;
          console.log(`[Refresh] Found and linking CredHive company: ${credhiveId}`);
          
          // Update company with CredHive ID and CIN if available
          const updateData: any = { probe42CompanyId: credhiveId };
          if (searchResults[0].cin && !companyData.cin) {
            updateData.cin = searchResults[0].cin;
            console.log(`[Refresh] Auto-populated CIN: ${searchResults[0].cin}`);
          }
          
          await storage.updateUnlistedCompany(companyId, updateData);
        }
      }
      
      // Use company's CredHive ID if available for direct sync
      if (credhiveId) {
        // Fetch company details (includes directors), financials, and ratios
        const [_companyDetails, financials, ratios] = await Promise.all([
          credhiveService.getCompanyDetails(credhiveId),
          (credhiveService as any).getCompanyFinancials(credhiveId, 3),
          (credhiveService as any).getCompanyRatios(credhiveId, 3),
        ]);
        
        // Update company with details from CredHive including CIN if missing
        const companyDetails = _companyDetails as any;
        if (companyDetails) {
          const updateData: any = { lastSyncedAt: new Date() };
          if (companyDetails.cin && !companyData.cin) {
            updateData.cin = companyDetails.cin;
            console.log(`[Refresh] Auto-populated CIN from CredHive details: ${companyDetails.cin}`);
          }
          // Add capital info if available
          if (companyDetails.paid_up_capital) {
            updateData.paidUpCapital = companyDetails.paid_up_capital.toString();
          }
          if (companyDetails.authorized_capital) {
            updateData.authorizedCapital = companyDetails.authorized_capital.toString();
          }
          if (companyDetails.face_value) {
            updateData.faceValue = companyDetails.face_value.toString();
          }
          if (companyDetails.total_shares) {
            updateData.totalShares = companyDetails.total_shares;
          }
          await storage.updateUnlistedCompany(companyId, updateData);
          
          if (companyDetails.directors && companyDetails.directors.length > 0) {
            console.log(`[Refresh] Got ${companyDetails.directors.length} directors from CredHive`);
          }
        }
        
        // Store financials in database
        let financialsSaved = 0;
        for (const fin of financials) {
          try {
            const existingFin = await storage.getCompanyFinancialsByYear(companyId, fin.financial_year);
            const finData = {
              companyId,
              financialYear: fin.financial_year,
              periodStart: fin.period_start,
              periodEnd: fin.period_end,
              revenue: fin.revenue?.toString(),
              ebitda: fin.ebitda?.toString(),
              pat: fin.pat?.toString(),
              netProfit: fin.pat?.toString(), // Use PAT as Net Profit for display
              totalAssets: fin.total_assets?.toString(),
              networth: fin.networth?.toString(),
              totalDebt: fin.total_debt?.toString(),
              dataSource: 'credhive' as const,
              verified: false,
            };
            if (existingFin) {
              await storage.updateCompanyFinancials(existingFin.id, finData);
            } else {
              await storage.createCompanyFinancials(finData);
            }
            financialsSaved++;
          } catch (finError) {
            console.log(`[Refresh] Could not save financial for ${fin.financial_year}:`, finError);
          }
        }
        console.log(`[Refresh] Saved ${financialsSaved} financials from CredHive`);
        
        // Store ratios in database
        let ratiosSaved = 0;
        for (const ratio of ratios) {
          try {
            const existingRatio = await storage.getCompanyRatiosByYear(companyId, ratio.financial_year);
            const ratioData = {
              companyId,
              financialYear: ratio.financial_year,
              peRatio: ratio.pe_ratio?.toString(),
              pbRatio: ratio.pb_ratio?.toString(),
              evEbitda: ratio.ev_ebitda?.toString(),
              roe: ratio.roe?.toString(),
              roce: ratio.roce?.toString(),
              marginEbitda: ratio.margin_ebitda?.toString(),
              marginPat: ratio.margin_pat?.toString(),
              debtEquity: ratio.debt_equity?.toString(),
              currentRatio: ratio.current_ratio?.toString(),
              revenueGrowth: ratio.revenue_growth?.toString(),
              profitGrowth: ratio.profit_growth?.toString(),
              dataSource: 'credhive' as const,
            };
            if (existingRatio) {
              await storage.updateCompanyRatios(existingRatio.id, ratioData);
            } else {
              await storage.createCompanyRatios(ratioData);
            }
            ratiosSaved++;
          } catch (ratioError) {
            console.log(`[Refresh] Could not save ratio for ${ratio.financial_year}:`, ratioError);
          }
        }
        console.log(`[Refresh] Saved ${ratiosSaved} ratios from CredHive`);
        
        if (financialsSaved > 0 || ratiosSaved > 0 || (companyDetails?.directors && companyDetails.directors.length > 0)) {
          results.push({ 
            source: 'credhive', 
            status: 'success',
            data: {
              financials: financialsSaved,
              ratios: ratiosSaved,
              directors: companyDetails?.directors?.length || 0,
            }
          });
        } else {
          results.push({ source: 'credhive', status: 'no_data' });
        }
      } else {
        results.push({ source: 'credhive', status: 'skipped', error: 'Could not find matching company in CredHive' });
      }
    } catch (p42Error: any) {
      results.push({ source: 'credhive', status: 'error', error: p42Error.message });
    }
    
    // Also run multi-source data enrichment with forceRefresh to bypass identity confidence check
    // This ensures MCA fallback is used when CIN/ISIN are present but no CredHive mapping exists
    try {
      const currentYear = new Date().getFullYear();
      const fy = `FY${currentYear - 1}-${currentYear.toString().slice(-2)}`;
      
      const enriched = await dataEnrichmentService.enrichCompanyFinancials(companyId, fy, {
        forceRefresh: true,
      });
      
      if (enriched.sources.length > 0) {
        results.push({
          source: 'data_enrichment',
          status: 'success',
          data: {
            sources: enriched.sources,
            metricsEnriched: Object.keys(enriched.metrics).length,
            overallConfidence: enriched.overallConfidence,
          }
        });
      } else {
        const blockReason = enriched.auditTrail.find((a: any) => a.action === 'block')?.reason;
        const bypassReason = enriched.auditTrail.find((a: any) => a.action === 'bypass')?.reason;
        results.push({
          source: 'data_enrichment',
          status: 'no_data',
          data: { reason: blockReason || bypassReason || 'No metrics fetched' }
        });
      }
    } catch (enrichError: any) {
      console.log('[Refresh] Data enrichment error:', enrichError.message);
      results.push({ source: 'data_enrichment', status: 'error', error: enrichError.message });
    }
    
    return apiResponse.success(res, {
      message: 'Company data refresh completed',
      companyId,
      companyName: companyData.name,
      results,
    });
  } catch (error: any) {
    console.error('Error refreshing company data:', error);
    return apiResponse.serverError(res, error.message || 'Failed to refresh company data');
  }
});

/**
 * POST /api/unlisted/admin/auto-enrich/:companyId
 * Auto-enrich company metadata (name, sector, industry) from MCA using CIN
 * with CredHive fallback. Used when sector/industry are "Unknown"
 */
router.post('/admin/auto-enrich/:companyId', async (req: Request, res: Response) => {
  try {
    if (!req.user?.roles?.includes('admin')) {
      return apiResponse.forbidden(res, 'Admin access required');
    }
    
    const { companyId } = req.params;
    
    const company = await storage.getUnlistedCompanyById(companyId);
    if (!company) {
      return apiResponse.notFound(res, 'Company not found');
    }
    
    const companyData = company as any;
    const enrichedFields: { field: string; oldValue: string | null; newValue: string; source: string }[] = [];
    let enrichmentSource = 'none';
    
    // Check if enrichment is needed
    const needsSectorEnrich = !companyData.sector || companyData.sector.toLowerCase().includes('unknown');
    const needsIndustryEnrich = !companyData.industry || companyData.industry.toLowerCase().includes('unknown');
    
    if (!needsSectorEnrich && !needsIndustryEnrich) {
      return apiResponse.success(res, {
        message: 'Company metadata already complete',
        companyId,
        companyName: companyData.name,
        enrichedFields: [],
        alreadyComplete: true,
      });
    }
    
    // If CIN is missing but we have a company name, try to fetch CIN from CredHive search
    // Note: Sandbox.co.in MCA API doesn't support company name search, only CIN lookup
    let currentCIN = companyData.cin;
    if (!currentCIN && companyData.name) {
      try {
        console.log(`[Auto-Enrich] No CIN available, searching CredHive by company name: ${companyData.name}`);
        const credhiveResults = await credhiveService.searchCompanyByNameOrCIN(companyData.name);
        
        if (credhiveResults && credhiveResults.length > 0) {
          // Find best match by name similarity
          const searchNameLower = companyData.name.toLowerCase().replace(/\s+/g, ' ').trim();
          let bestMatch = credhiveResults[0];
          let bestScore = 0;
          
          for (const result of credhiveResults) {
            const resultNameLower = result.name.toLowerCase().replace(/\s+/g, ' ').trim();
            // Simple word match scoring
            const searchWords = searchNameLower.split(' ');
            const resultWords = resultNameLower.split(' ');
            let matchScore = 0;
            for (const word of searchWords) {
              if (resultWords.some((rw: any) => rw.includes(word) || word.includes(rw))) {
                matchScore++;
              }
            }
            const score = matchScore / Math.max(searchWords.length, resultWords.length);
            if (score > bestScore) {
              bestScore = score;
              bestMatch = result;
            }
          }
          
          if (bestMatch.cin && bestScore >= 0.4) {
            currentCIN = bestMatch.cin;
            companyData.cin = bestMatch.cin; // Update local reference to prevent overwrite
            console.log(`[Auto-Enrich] Found CIN ${bestMatch.cin} for "${companyData.name}" via CredHive (matched: "${bestMatch.name}", score: ${(bestScore * 100).toFixed(1)}%)`);
            
            // Save the CIN and CredHive ID to the company record
            const updatePayload: any = { cin: bestMatch.cin, lastSyncedAt: new Date() };
            if ((bestMatch as any).company_id) {
              updatePayload.probe42CompanyId = (bestMatch as any).company_id;
            }
            await storage.updateUnlistedCompany(companyId, updatePayload);
            
            enrichedFields.push({
              field: 'cin',
              oldValue: null,
              newValue: bestMatch.cin,
              source: 'CredHive'
            });
            enrichmentSource = 'CredHive';
            
            // Also update name if official name differs meaningfully
            if (bestMatch.name && bestMatch.name.toLowerCase() !== companyData.name.toLowerCase()) {
              await storage.updateUnlistedCompany(companyId, { name: bestMatch.name });
              enrichedFields.push({
                field: 'name',
                oldValue: companyData.name,
                newValue: bestMatch.name,
                source: 'CredHive'
              });
              companyData.name = bestMatch.name; // Update local reference
            }
          } else {
            console.log(`[Auto-Enrich] CredHive search found ${credhiveResults.length} results but no confident match (best score: ${(bestScore * 100).toFixed(1)}%)`);
          }
        } else {
          console.log(`[Auto-Enrich] Could not find CIN for "${companyData.name}" in CredHive search`);
        }
      } catch (cinError: any) {
        console.error('[Auto-Enrich] Error searching CredHive for CIN:', cinError.message);
      }
    }
    
    // Try MCA first if CIN is available (either from DB or newly fetched)
    if (currentCIN && mcaService.isConfigured()) {
      try {
        console.log(`[Auto-Enrich] Fetching MCA data for CIN: ${currentCIN}`);
        const mcaData = await mcaService.getCompanyByCIN(currentCIN);
        
        if (mcaData) {
          const mcaCompanyData = mcaService.toFintekProCompanyData(mcaData);
          const updateData: any = { lastSyncedAt: new Date() };
          
          console.log('[Auto-Enrich] MCA raw data:', JSON.stringify(mcaData, null, 2));
          console.log('[Auto-Enrich] MCA company data:', JSON.stringify(mcaCompanyData, null, 2));
          console.log('[Auto-Enrich] Current company name:', companyData.name);
          console.log('[Auto-Enrich] MCA company name:', mcaCompanyData.name);
          
          // Always use MCA company name as authoritative source (official government registry)
          // Force update even if names appear similar - MCA is the definitive source
          if (mcaCompanyData.name) {
            const normalizedMcaName = mcaCompanyData.name.trim();
            const normalizedCurrentName = (companyData.name || '').trim();
            
            console.log('[Auto-Enrich] Normalized MCA name:', normalizedMcaName);
            console.log('[Auto-Enrich] Normalized current name:', normalizedCurrentName);
            console.log('[Auto-Enrich] Names equal (case-insensitive)?', normalizedMcaName.toLowerCase() === normalizedCurrentName.toLowerCase());
            console.log('[Auto-Enrich] Names equal (exact)?', normalizedMcaName === normalizedCurrentName);
            
            // Update if names differ in any way (case, spacing, abbreviations like Ltd vs Limited)
            if (normalizedMcaName.toLowerCase() !== normalizedCurrentName.toLowerCase() || 
                normalizedMcaName !== normalizedCurrentName) {
              updateData.name = normalizedMcaName;
              enrichedFields.push({
                field: 'name',
                oldValue: companyData.name,
                newValue: normalizedMcaName,
                source: 'MCA'
              });
              console.log('[Auto-Enrich] Name will be updated to:', normalizedMcaName);
            } else {
              console.log('[Auto-Enrich] Name update skipped - names are identical');
            }
          } else {
            console.log('[Auto-Enrich] No name in MCA response');
          }
          
          // Update sector if available and needed
          if (mcaCompanyData.sector && needsSectorEnrich) {
            updateData.sector = mcaCompanyData.sector;
            enrichedFields.push({
              field: 'sector',
              oldValue: companyData.sector || 'Unknown',
              newValue: mcaCompanyData.sector,
              source: 'MCA'
            });
          }
          
          // Update industry if available and needed
          if (mcaCompanyData.industry && needsIndustryEnrich) {
            updateData.industry = mcaCompanyData.industry;
            enrichedFields.push({
              field: 'industry',
              oldValue: companyData.industry || 'Unknown',
              newValue: mcaCompanyData.industry,
              source: 'MCA'
            });
          }
          
          // Also update other useful MCA fields if missing
          if (mcaCompanyData.paidUpCapital && !companyData.paidUpCapital) {
            updateData.paidUpCapital = mcaCompanyData.paidUpCapital;
            enrichedFields.push({
              field: 'paidUpCapital',
              oldValue: null,
              newValue: mcaCompanyData.paidUpCapital,
              source: 'MCA'
            });
          }
          
          if (mcaCompanyData.authorizedCapital && !companyData.authorizedCapital) {
            updateData.authorizedCapital = mcaCompanyData.authorizedCapital;
            enrichedFields.push({
              field: 'authorizedCapital',
              oldValue: null,
              newValue: mcaCompanyData.authorizedCapital,
              source: 'MCA'
            });
          }
          
          if (mcaCompanyData.incorporationDate && !companyData.incorporationDate) {
            updateData.incorporationDate = mcaCompanyData.incorporationDate;
            enrichedFields.push({
              field: 'incorporationDate',
              oldValue: null,
              newValue: mcaCompanyData.incorporationDate,
              source: 'MCA'
            });
          }
          
          if (Object.keys(updateData).length > 1) {
            await storage.updateUnlistedCompany(companyId, updateData);
            // Combine sources if CIN was found via CredHive
            if (enrichmentSource === 'CredHive') {
              enrichmentSource = 'CredHive + MCA';
            } else if (enrichmentSource === 'none') {
              enrichmentSource = 'MCA';
            }
            console.log(`[Auto-Enrich] Updated ${enrichedFields.length} fields from MCA for ${companyData.name}`);
          }
        }
      } catch (mcaError: any) {
        console.error('[Auto-Enrich] MCA error:', mcaError.message);
      }
    }
    
    // If still missing sector/industry, try CredHive
    const stillNeedsSector = enrichedFields.every((f: any) => f.field !== 'sector') && needsSectorEnrich;
    const stillNeedsIndustry = enrichedFields.every((f: any) => f.field !== 'industry') && needsIndustryEnrich;
    
    if ((stillNeedsSector || stillNeedsIndustry) && companyData.probe42CompanyId) {
      try {
        console.log(`[Auto-Enrich] Fetching CredHive data for ID: ${companyData.probe42CompanyId}`);
        const credhiveDetails = await credhiveService.getCompanyDetails(companyData.probe42CompanyId);
        
        if (credhiveDetails) {
          const updateData: any = { lastSyncedAt: new Date() };
          
          if (credhiveDetails.sector && stillNeedsSector) {
            updateData.sector = credhiveDetails.sector;
            enrichedFields.push({
              field: 'sector',
              oldValue: companyData.sector || 'Unknown',
              newValue: credhiveDetails.sector,
              source: 'CredHive'
            });
          }
          
          if (credhiveDetails.industry && stillNeedsIndustry) {
            updateData.industry = credhiveDetails.industry;
            enrichedFields.push({
              field: 'industry',
              oldValue: companyData.industry || 'Unknown',
              newValue: credhiveDetails.industry,
              source: 'CredHive'
            });
          }
          
          if (Object.keys(updateData).length > 1) {
            await storage.updateUnlistedCompany(companyId, updateData);
            // Combine sources properly
            if (enrichmentSource.includes('MCA') && !enrichmentSource.includes('CredHive')) {
              enrichmentSource = enrichmentSource + ' + CredHive';
            } else if (enrichmentSource === 'none' || enrichmentSource === '') {
              enrichmentSource = 'CredHive';
            }
            console.log(`[Auto-Enrich] Updated ${enrichedFields.length} fields from CredHive for ${companyData.name}`);
          }
        }
      } catch (p42Error: any) {
        console.error('[Auto-Enrich] CredHive error:', p42Error.message);
      }
    }
    
    // Final fallback: Use NIC-based classification from CIN if still missing sector/industry
    const finalNeedsSector = enrichedFields.every((f: any) => f.field !== 'sector') && needsSectorEnrich;
    const finalNeedsIndustry = enrichedFields.every((f: any) => f.field !== 'industry') && needsIndustryEnrich;
    
    if ((finalNeedsSector || finalNeedsIndustry) && currentCIN) {
      try {
        const { classifyIndustryFromCIN } = await import('../utils/nic-industry-classifier');
        const nicClassification = classifyIndustryFromCIN(currentCIN);
        
        if (nicClassification) {
          console.log(`[Auto-Enrich] Using NIC-based classification for CIN ${currentCIN}: ${nicClassification.sector}/${nicClassification.industry}`);
          const updateData: any = { lastSyncedAt: new Date() };
          
          if (nicClassification.sector && finalNeedsSector) {
            updateData.sector = nicClassification.sector;
            enrichedFields.push({
              field: 'sector',
              oldValue: companyData.sector || 'Unknown',
              newValue: nicClassification.sector,
              source: 'NIC Classification (Derived from CIN)'
            });
          }
          
          if (nicClassification.industry && finalNeedsIndustry) {
            updateData.industry = nicClassification.industry;
            enrichedFields.push({
              field: 'industry',
              oldValue: companyData.industry || 'Unknown',
              newValue: nicClassification.industry,
              source: 'NIC Classification (Derived from CIN)'
            });
          }
          
          if (Object.keys(updateData).length > 1) {
            await storage.updateUnlistedCompany(companyId, updateData);
            if (enrichmentSource === 'none' || enrichmentSource === '') {
              enrichmentSource = 'NIC Classification';
            } else {
              enrichmentSource = enrichmentSource + ' + NIC Classification';
            }
            console.log(`[Auto-Enrich] Updated ${enrichedFields.filter((f: any) => f.source.includes('NIC')).length} fields from NIC classification for ${companyData.name}`);
          }
        }
      } catch (nicError: any) {
        console.error('[Auto-Enrich] NIC classification error:', nicError.message);
      }
    }
    
    // Fetch the updated company data
    const updatedCompany = await storage.getUnlistedCompanyById(companyId);
    
    return apiResponse.success(res, {
      message: enrichedFields.length > 0 
        ? `Successfully enriched ${enrichedFields.length} field(s) from ${enrichmentSource}`
        : 'No enrichment data found from external sources',
      companyId,
      companyName: (updatedCompany as any)?.name || companyData.name,
      enrichedFields,
      enrichmentSource,
      updatedCompany: updatedCompany ? {
        id: (updatedCompany as any).id,
        name: (updatedCompany as any).name,
        sector: (updatedCompany as any).sector,
        industry: (updatedCompany as any).industry,
        cin: (updatedCompany as any).cin,
      } : null,
    });
  } catch (error: any) {
    console.error('Error auto-enriching company:', error);
    return apiResponse.serverError(res, error.message || 'Failed to auto-enrich company data');
  }
});

/**
 * POST /api/unlisted/companies/:companyId/publish-to-store-with-prices
 * Publish company to store with admin-set buy/sell prices (Admin only)
 */

export default router;
