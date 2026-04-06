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
router.post('/companies/:companyId/publish-to-store-with-prices', async (req: Request, res: Response) => {
  try {
    // Check if user is admin
    if (!req.user?.roles?.includes('admin')) {
      return apiResponse.forbidden(res, 'Admin access required');
    }
    
    const { companyId } = req.params;
    const { buyPrice, sellPrice, priceSource } = req.body;
    
    // Validate prices
    if (!buyPrice || !sellPrice) {
      return apiResponse.badRequest(res, 'Both buyPrice and sellPrice are required');
    }
    
    const parsedBuyPrice = parseFloat(buyPrice);
    const parsedSellPrice = parseFloat(sellPrice);
    
    if (isNaN(parsedBuyPrice) || isNaN(parsedSellPrice)) {
      return apiResponse.badRequest(res, 'Invalid price values');
    }
    
    if (parsedBuyPrice <= 0 || parsedSellPrice <= 0) {
      return apiResponse.badRequest(res, 'Prices must be positive');
    }
    
    if (parsedBuyPrice >= parsedSellPrice) {
      return apiResponse.badRequest(res, 'Buy price must be less than sell price');
    }
    
    // Get the company
    const companyData = await storage.getUnlistedCompanyById(companyId);
    if (!companyData) {
      return apiResponse.notFound(res, 'Company not found');
    }
    
    const company = companyData as any;
    
    // Check if already published
    const existingProduct = await storage.getStoreProductBySourceCompanyId(companyId);
    if (existingProduct) {
      // Update existing product with new prices
      const updatedProduct = await storage.updateStoreProduct(existingProduct.id, {
        buyPrice: parsedBuyPrice.toString(),
        sellPrice: parsedSellPrice.toString(),
        price: parsedSellPrice.toString(), // Use sell price as display price
        priceSource: priceSource || 'manual',
        priceUpdatedAt: new Date(),
        priceMetadata: JSON.stringify({
          updatedBy: req.user?.id,
          updatedAt: new Date().toISOString(),
          source: priceSource || 'manual',
        }),
      });
      
      return apiResponse.success(res, {
        message: 'Store product prices updated successfully',
        product: {
          id: updatedProduct.id,
          name: updatedProduct.name,
          buyPrice: updatedProduct.buyPrice,
          sellPrice: updatedProduct.sellPrice,
        },
        action: 'updated',
      });
    }
    
    // Get or create Unlisted Shares category
    let unlistedCategory = await storage.getStoreCategoryBySlug('unlisted');
    if (!unlistedCategory) {
      unlistedCategory = await storage.createStoreCategory({
        name: 'Unlisted Shares',
        description: 'Pre-IPO and unlisted company shares for sophisticated investors',
        slug: 'unlisted',
        icon: 'TrendingUp',
        displayOrder: 10,
        isActive: true,
      });
    }
    
    // Get or create subcategory for sector
    let subcategory = null;
    if (company.sector) {
      const sectorSlug = company.sector.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      subcategory = await storage.getStoreSubcategoryBySlug(sectorSlug);
      if (!subcategory) {
        subcategory = await storage.createStoreSubcategory({
          name: company.sector,
          description: `Unlisted shares in the ${company.sector} sector`,
          slug: sectorSlug,
          categoryId: unlistedCategory.id,
          displayOrder: 0,
          isActive: true,
        });
      }
    }
    
    // Create the store product with prices
    const productData = {
      name: company.name,
      shortDescription: `Unlisted shares of ${company.name} - ${company.sector || 'Technology'} sector`,
      fullDescription: company.description || `Invest in ${company.name}, an unlisted company in the ${company.sector || 'Technology'} sector.`,
      categoryId: unlistedCategory.id,
      subcategoryId: subcategory?.id,
      productType: 'unlisted_stock',
      productKey: `UNLISTED-${company.cin || company.id}`,
      price: parsedSellPrice.toString(),
      buyPrice: parsedBuyPrice.toString(),
      sellPrice: parsedSellPrice.toString(),
      priceSource: priceSource || 'manual',
      priceUpdatedAt: new Date(),
      priceMetadata: JSON.stringify({
        setBy: req.user?.id,
        setAt: new Date().toISOString(),
        source: priceSource || 'manual',
      }),
      currency: 'INR',
      minimumInvestment: company.minLotSize ? String(Number(company.minLotSize) * parsedSellPrice) : '10000',
      riskLevel: 'high',
      features: JSON.stringify([
        'Enhanced KYC Required',
        'Pre-IPO Investment Opportunity',
        `Sector: ${company.sector || 'Technology'}`,
      ]),
      eligibility: JSON.stringify({
        kycLevel: 'enhanced',
        minNetWorth: 2500000,
        investorType: ['accredited', 'qualified'],
      }),
      documents: JSON.stringify([
        'PAN Card',
        'Address Proof',
        'Bank Statement',
        'Net Worth Certificate',
      ]),
      provider: company.name,
      providerCode: company.cin || company.id,
      regulatory: JSON.stringify({
        cin: company.cin,
        isin: company.isin,
        sector: company.sector,
        listingStage: company.listingStage,
      }),
      isActive: company.status === 'active',
      isFeatured: false,
      displayOrder: 0,
      visibleToClients: true,
      visibleToPartners: true,
      visibleToAgents: true,
      visibleToGuests: false,
      showInquiryForm: true,
      sourceCompanyId: company.id,
      lotSize: company.minLotSize || 1,
      faceValue: company.faceValue || null,
      marketCap: company.marketCap || null,
      peRatio: company.peRatio || null,
    };
    
    const product = await storage.createStoreProduct(productData);
    
    return apiResponse.created(res, {
      message: `${company.name} published to store with prices`,
      product: {
        id: product.id,
        name: product.name,
        buyPrice: product.buyPrice,
        sellPrice: product.sellPrice,
      },
      category: {
        id: unlistedCategory.id,
        name: unlistedCategory.name,
      },
      action: 'created',
    });
  } catch (error: any) {
    console.error('Error publishing to store with prices:', error);
    return apiResponse.serverError(res, 'Failed to publish company to store');
  }
});

/**
 * PATCH /api/unlisted/admin/update-store-prices/:productId
 * Update buy/sell prices for an existing store product (Admin only)
 */
router.patch('/admin/update-store-prices/:productId', async (req: Request, res: Response) => {
  try {
    // Check if user is admin
    if (!req.user?.roles?.includes('admin')) {
      return apiResponse.forbidden(res, 'Admin access required');
    }
    
    const { productId } = req.params;
    const { buyPrice, sellPrice, priceSource } = req.body;
    
    // Validate prices
    if (!buyPrice || !sellPrice) {
      return apiResponse.badRequest(res, 'Both buyPrice and sellPrice are required');
    }
    
    const parsedBuyPrice = parseFloat(buyPrice);
    const parsedSellPrice = parseFloat(sellPrice);
    
    if (isNaN(parsedBuyPrice) || isNaN(parsedSellPrice)) {
      return apiResponse.badRequest(res, 'Invalid price values');
    }
    
    if (parsedBuyPrice <= 0 || parsedSellPrice <= 0) {
      return apiResponse.badRequest(res, 'Prices must be positive');
    }
    
    if (parsedBuyPrice >= parsedSellPrice) {
      return apiResponse.badRequest(res, 'Buy price must be less than sell price');
    }
    
    // Update the product
    const updatedProduct = await storage.updateStoreProduct(productId, {
      buyPrice: parsedBuyPrice.toString(),
      sellPrice: parsedSellPrice.toString(),
      price: parsedSellPrice.toString(),
      priceSource: priceSource || 'manual',
      priceUpdatedAt: new Date(),
      priceMetadata: JSON.stringify({
        updatedBy: req.user?.id,
        updatedAt: new Date().toISOString(),
        source: priceSource || 'manual',
      }),
    });
    
    return apiResponse.success(res, {
      message: 'Prices updated successfully',
      product: {
        id: updatedProduct.id,
        name: updatedProduct.name,
        buyPrice: updatedProduct.buyPrice,
        sellPrice: updatedProduct.sellPrice,
        priceSource: updatedProduct.priceSource,
        priceUpdatedAt: updatedProduct.priceUpdatedAt,
      },
    });
  } catch (error: any) {
    console.error('Error updating store prices:', error);
    return apiResponse.serverError(res, 'Failed to update prices');
  }
});

// ===================================================================
// MONEYCONTROL RECONCILIATION ROUTES (Admin only)
// ===================================================================

/**
 * GET /api/unlisted/admin/reconciliation/moneycontrol
 * Get list of companies on MoneyControl that are not in FintekPro (Admin only)
 */


export default router;
