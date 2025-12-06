/**
 * Bond Marketplace Improvements API Routes
 * Implements: Enhanced Filtering, Eligibility Visibility, Risk Disclosures,
 * Data Freshness, Net Yield Display, Watchlist/Alerts, Suitability Scoring, Admin Audit
 */

import { Router, Request, Response } from 'express';
import { db } from '../db';
import { eq, and, or, desc, asc, gte, lte, sql, isNotNull, like, between } from 'drizzle-orm';
import * as schema from '@shared/schema';
import { apiResponse } from '../utils/responses';
import { requireAuth, requireAdmin } from '../middleware/roleMiddleware';
import { bondFeeCalibrationService } from '../services/bond-fee-calibration-service';
import { determineRegulatoryTier, checkTierEligibility } from '../bond-kyc-gate';

const router = Router();

// =====================================================
// TASK 1: Enhanced Filtering & Search
// =====================================================

/**
 * GET /api/bonds/enhanced-catalog
 * Browse bonds with advanced filtering (credit rating, maturity, tax benefits)
 */
router.get('/enhanced-catalog', async (req: Request, res: Response) => {
  try {
    const {
      type = 'all',
      creditRating,
      minYield,
      maxYield,
      minMaturityYears,
      maxMaturityYears,
      taxCategory,
      minInvestment,
      sortBy = 'yield',
      sortOrder = 'desc',
      limit = '50',
      offset = '0'
    } = req.query;

    const bonds: any[] = [];
    const now = new Date();

    // Fetch government securities with filters
    if (type === 'all' || type === 'government') {
      const govBonds = await db.select().from(schema.governmentSecurities)
        .where(eq(schema.governmentSecurities.tradingStatus, 'active'))
        .limit(parseInt(limit as string));

      bonds.push(...govBonds.map(b => {
        const maturityDate = b.maturityDate ? new Date(b.maturityDate) : null;
        const yearsToMaturity = maturityDate ? Math.max(0, (maturityDate.getTime() - now.getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : null;
        
        return {
          id: b.id,
          isin: b.isin,
          bondName: b.securityName,
          issuerName: 'Government of India',
          instrumentType: b.securityType || 'gsec',
          displayType: 'Government Security',
          couponRate: b.couponRate,
          yieldToMaturity: b.yieldToMaturity,
          maturityDate: b.maturityDate,
          yearsToMaturity: yearsToMaturity ? Math.round(yearsToMaturity * 10) / 10 : null,
          creditRating: 'SOV',
          ratingAgency: 'CRISIL/ICRA',
          minInvestment: b.minimumInvestment || 10000,
          faceValue: b.faceValue || 100,
          taxCategory: 'taxable',
          isTaxFree: false,
          isListed: true,
          exchange: 'RBI',
          lastUpdated: b.lastUpdated,
          source: 'government_securities'
        };
      }));
    }

    // Fetch corporate bonds with filters
    if (type === 'all' || type === 'corporate') {
      const corpBonds = await db.select().from(schema.corporateBonds)
        .where(eq(schema.corporateBonds.tradingStatus, 'active'))
        .limit(parseInt(limit as string));

      bonds.push(...corpBonds.map(b => {
        const maturityDate = b.maturityDate ? new Date(b.maturityDate) : null;
        const yearsToMaturity = maturityDate ? Math.max(0, (maturityDate.getTime() - now.getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : null;
        
        return {
          id: b.id,
          isin: b.isin,
          bondName: b.bondName || b.issuer,
          issuerName: b.issuer,
          instrumentType: b.bondType || 'corporate_bond',
          displayType: b.bondType === 'ncd' ? 'NCD' : b.bondType === 'infrastructure' ? 'Infrastructure Bond' : 'Corporate Bond',
          couponRate: b.couponRate,
          yieldToMaturity: b.yieldToMaturity,
          maturityDate: b.maturityDate,
          yearsToMaturity: yearsToMaturity ? Math.round(yearsToMaturity * 10) / 10 : null,
          creditRating: b.creditRating,
          ratingAgency: 'CRISIL/ICRA',
          minInvestment: b.minimumLotSize || b.minimumInvestment || 10000,
          faceValue: b.faceValue || 1000,
          taxCategory: b.bondType === 'tax_free' ? 'tax_free' : 'taxable',
          isTaxFree: b.bondType === 'tax_free',
          isListed: b.tradingStatus === 'active',
          exchange: 'NSE/BSE',
          lastUpdated: b.lastUpdated,
          lastPrice: b.currentPrice,
          source: 'corporate_bonds'
        };
      }));
    }

    // Apply client-side filters
    let filteredBonds = bonds;

    // Credit rating filter
    if (creditRating && creditRating !== 'all') {
      const ratings = (creditRating as string).split(',');
      filteredBonds = filteredBonds.filter(b => {
        if (!b.creditRating) return false;
        return ratings.some(r => b.creditRating.includes(r));
      });
    }

    // Yield filter
    if (minYield) {
      const min = parseFloat(minYield as string);
      filteredBonds = filteredBonds.filter(b => parseFloat(b.yieldToMaturity || '0') >= min);
    }
    if (maxYield) {
      const max = parseFloat(maxYield as string);
      filteredBonds = filteredBonds.filter(b => parseFloat(b.yieldToMaturity || '0') <= max);
    }

    // Maturity years filter
    if (minMaturityYears) {
      const min = parseFloat(minMaturityYears as string);
      filteredBonds = filteredBonds.filter(b => (b.yearsToMaturity || 0) >= min);
    }
    if (maxMaturityYears) {
      const max = parseFloat(maxMaturityYears as string);
      filteredBonds = filteredBonds.filter(b => (b.yearsToMaturity || Infinity) <= max);
    }

    // Tax category filter
    if (taxCategory && taxCategory !== 'all') {
      filteredBonds = filteredBonds.filter(b => b.taxCategory === taxCategory);
    }

    // Min investment filter
    if (minInvestment) {
      const min = parseFloat(minInvestment as string);
      filteredBonds = filteredBonds.filter(b => (b.minInvestment || 0) <= min);
    }

    // Sort
    filteredBonds.sort((a, b) => {
      let aVal, bVal;
      switch (sortBy) {
        case 'yield':
          aVal = parseFloat(a.yieldToMaturity || '0');
          bVal = parseFloat(b.yieldToMaturity || '0');
          break;
        case 'maturity':
          aVal = a.yearsToMaturity || 0;
          bVal = b.yearsToMaturity || 0;
          break;
        case 'rating':
          aVal = a.creditRating || 'ZZZ';
          bVal = b.creditRating || 'ZZZ';
          break;
        case 'minInvestment':
          aVal = a.minInvestment || 0;
          bVal = b.minInvestment || 0;
          break;
        default:
          aVal = parseFloat(a.yieldToMaturity || '0');
          bVal = parseFloat(b.yieldToMaturity || '0');
      }
      return sortOrder === 'asc' ? (aVal > bVal ? 1 : -1) : (aVal < bVal ? 1 : -1);
    });

    // Pagination
    const offsetNum = parseInt(offset as string);
    const limitNum = parseInt(limit as string);
    const paginatedBonds = filteredBonds.slice(offsetNum, offsetNum + limitNum);

    return apiResponse.success(res, {
      bonds: paginatedBonds,
      total: filteredBonds.length,
      filters: {
        creditRatings: ['SOV', 'AAA', 'AA+', 'AA', 'AA-', 'A+', 'A', 'A-', 'BBB+', 'BBB'],
        taxCategories: ['all', 'taxable', 'tax_free'],
        maturityRanges: [
          { label: '0-1 Year', min: 0, max: 1 },
          { label: '1-3 Years', min: 1, max: 3 },
          { label: '3-5 Years', min: 3, max: 5 },
          { label: '5-10 Years', min: 5, max: 10 },
          { label: '10+ Years', min: 10, max: null }
        ]
      },
      pagination: {
        offset: offsetNum,
        limit: limitNum,
        hasMore: offsetNum + limitNum < filteredBonds.length
      }
    });
  } catch (error: any) {
    console.error('Error in enhanced catalog:', error);
    return apiResponse.serverError(res, 'Failed to fetch bond catalog');
  }
});

/**
 * GET /api/bonds/maturity-ladder
 * Group bonds by maturity buckets for planning
 */
router.get('/maturity-ladder', async (req: Request, res: Response) => {
  try {
    const now = new Date();
    
    // Fetch all bonds
    const [govBonds, corpBonds] = await Promise.all([
      db.select().from(schema.governmentSecurities).where(eq(schema.governmentSecurities.tradingStatus, 'active')),
      db.select().from(schema.corporateBonds).where(eq(schema.corporateBonds.tradingStatus, 'active'))
    ]);

    const allBonds = [
      ...govBonds.map(b => ({
        isin: b.isin,
        bondName: b.securityName,
        instrumentType: 'government',
        couponRate: b.couponRate,
        yieldToMaturity: b.indicativeYield,
        maturityDate: b.maturityDate,
        creditRating: 'SOV'
      })),
      ...corpBonds.map(b => ({
        isin: b.isin,
        bondName: b.bondName || b.issuerName,
        instrumentType: 'corporate',
        couponRate: b.couponRate,
        yieldToMaturity: b.yieldToMaturity || b.currentYield,
        maturityDate: b.maturityDate,
        creditRating: b.creditRating || b.rating
      }))
    ];

    // Group by maturity buckets
    const buckets = [
      { label: '0-6 Months', minMonths: 0, maxMonths: 6, bonds: [] as any[] },
      { label: '6-12 Months', minMonths: 6, maxMonths: 12, bonds: [] as any[] },
      { label: '1-2 Years', minMonths: 12, maxMonths: 24, bonds: [] as any[] },
      { label: '2-3 Years', minMonths: 24, maxMonths: 36, bonds: [] as any[] },
      { label: '3-5 Years', minMonths: 36, maxMonths: 60, bonds: [] as any[] },
      { label: '5-7 Years', minMonths: 60, maxMonths: 84, bonds: [] as any[] },
      { label: '7-10 Years', minMonths: 84, maxMonths: 120, bonds: [] as any[] },
      { label: '10+ Years', minMonths: 120, maxMonths: Infinity, bonds: [] as any[] }
    ];

    allBonds.forEach(bond => {
      if (!bond.maturityDate) return;
      
      const maturityDate = new Date(bond.maturityDate);
      const monthsToMaturity = (maturityDate.getTime() - now.getTime()) / (30.44 * 24 * 60 * 60 * 1000);
      
      if (monthsToMaturity < 0) return; // Skip matured bonds
      
      const bucket = buckets.find(b => monthsToMaturity >= b.minMonths && monthsToMaturity < b.maxMonths);
      if (bucket) {
        bucket.bonds.push({
          ...bond,
          monthsToMaturity: Math.round(monthsToMaturity)
        });
      }
    });

    // Calculate bucket statistics
    const ladderData = buckets.map(bucket => {
      const yields = bucket.bonds.map(b => parseFloat(b.yieldToMaturity || '0')).filter(y => y > 0);
      return {
        label: bucket.label,
        bondCount: bucket.bonds.length,
        avgYield: yields.length > 0 ? Math.round((yields.reduce((a, b) => a + b, 0) / yields.length) * 100) / 100 : null,
        minYield: yields.length > 0 ? Math.min(...yields) : null,
        maxYield: yields.length > 0 ? Math.max(...yields) : null,
        bonds: bucket.bonds.slice(0, 5) // Return top 5 per bucket
      };
    });

    return apiResponse.success(res, { ladder: ladderData });
  } catch (error: any) {
    console.error('Error in maturity ladder:', error);
    return apiResponse.serverError(res, 'Failed to generate maturity ladder');
  }
});

/**
 * POST /api/bonds/compare
 * Compare multiple bonds side-by-side
 */
router.post('/compare', async (req: Request, res: Response) => {
  try {
    const { isins } = req.body;
    
    if (!isins || !Array.isArray(isins) || isins.length < 2 || isins.length > 4) {
      return apiResponse.badRequest(res, 'Please provide 2-4 bond ISINs for comparison');
    }

    const bonds: any[] = [];
    
    for (const isin of isins) {
      // Try government securities first
      const [govBond] = await db.select().from(schema.governmentSecurities)
        .where(eq(schema.governmentSecurities.isin, isin));
      
      if (govBond) {
        bonds.push({
          isin: govBond.isin,
          bondName: govBond.securityName,
          issuerName: 'Government of India',
          instrumentType: 'government',
          couponRate: govBond.couponRate,
          yieldToMaturity: govBond.indicativeYield,
          maturityDate: govBond.maturityDate,
          creditRating: 'SOV',
          minInvestment: govBond.minimumBidAmount || 10000,
          faceValue: govBond.faceValue || 100,
          taxCategory: 'taxable',
          riskLevel: 'Very Low',
          liquidityRating: 'High'
        });
        continue;
      }

      // Try corporate bonds
      const [corpBond] = await db.select().from(schema.corporateBonds)
        .where(eq(schema.corporateBonds.isin, isin));
      
      if (corpBond) {
        const riskLevel = getRiskLevel(corpBond.creditRating || corpBond.rating || '');
        bonds.push({
          isin: corpBond.isin,
          bondName: corpBond.bondName || corpBond.issuerName,
          issuerName: corpBond.issuerName,
          instrumentType: corpBond.bondType || 'corporate',
          couponRate: corpBond.couponRate,
          yieldToMaturity: corpBond.yieldToMaturity || corpBond.currentYield,
          maturityDate: corpBond.maturityDate,
          creditRating: corpBond.creditRating || corpBond.rating,
          minInvestment: corpBond.minimumLotSize || 10000,
          faceValue: corpBond.faceValue || 1000,
          taxCategory: corpBond.bondType === 'tax_free' ? 'tax_free' : 'taxable',
          riskLevel,
          liquidityRating: corpBond.isListed ? 'Medium' : 'Low'
        });
      }
    }

    // Generate comparison metrics
    const comparison = {
      bonds,
      metrics: {
        highestYield: bonds.reduce((max, b) => parseFloat(b.yieldToMaturity || '0') > parseFloat(max.yieldToMaturity || '0') ? b : max, bonds[0])?.isin,
        lowestRisk: bonds.reduce((min, b) => getRiskScore(b.creditRating) < getRiskScore(min.creditRating) ? b : min, bonds[0])?.isin,
        shortestMaturity: bonds.reduce((min, b) => new Date(b.maturityDate || '2099-12-31') < new Date(min.maturityDate || '2099-12-31') ? b : min, bonds[0])?.isin,
        lowestMinInvestment: bonds.reduce((min, b) => (b.minInvestment || Infinity) < (min.minInvestment || Infinity) ? b : min, bonds[0])?.isin
      }
    };

    return apiResponse.success(res, comparison);
  } catch (error: any) {
    console.error('Error in bond comparison:', error);
    return apiResponse.serverError(res, 'Failed to compare bonds');
  }
});

// =====================================================
// TASK 2: Investor Eligibility Visibility
// =====================================================

/**
 * GET /api/bonds/eligibility/:isin
 * Check user eligibility for a specific bond
 */
router.get('/eligibility/:isin', requireAuth, async (req: Request, res: Response) => {
  try {
    const { isin } = req.params;
    const userId = (req.user as any)?.id;

    if (!userId) {
      return apiResponse.unauthorized(res, 'Authentication required');
    }

    // Get user's KYC profile from users table
    const [userProfile] = await db.select().from(schema.users)
      .where(eq(schema.users.id, userId));

    // Get bond details
    let bond: any = null;
    let bondType = 'unknown';
    let isListed = true;
    let minInvestment = 10000;

    const [govBond] = await db.select().from(schema.governmentSecurities)
      .where(eq(schema.governmentSecurities.isin, isin));
    
    if (govBond) {
      bond = govBond;
      bondType = govBond.securityType || 'gsec';
      minInvestment = govBond.minimumBidAmount || 10000;
    } else {
      const [corpBond] = await db.select().from(schema.corporateBonds)
        .where(eq(schema.corporateBonds.isin, isin));
      
      if (corpBond) {
        bond = corpBond;
        bondType = corpBond.bondType || 'corporate';
        isListed = corpBond.isListed !== false;
        minInvestment = corpBond.minimumLotSize || 10000;
      }
    }

    if (!bond) {
      return apiResponse.notFound(res, 'Bond not found');
    }

    // Determine required tier
    const requiredTier = determineRegulatoryTier(bondType, minInvestment, isListed);
    const tierCheck = await checkTierEligibility(userId, requiredTier);

    // Get user's current tier
    const userTier = userProfile?.kycTier || 'none';
    const tierOrder = ['none', 'basic', 'tier_1', 'tier_2', 'tier_3', 'enhanced', 'accredited'];

    return apiResponse.success(res, {
      isin,
      bondName: bond.securityName || bond.bondName || bond.issuerName,
      bondType,
      isListed,
      eligibility: {
        isEligible: tierCheck.eligible,
        reason: tierCheck.reason,
        userTier,
        requiredTier,
        upgradeRequired: tierOrder.indexOf(userTier) < tierOrder.indexOf(requiredTier),
        upgradePath: tierCheck.eligible ? null : getUpgradePath(userTier, requiredTier)
      },
      requirements: {
        minInvestment,
        kycDocumentsRequired: getKycDocumentsForTier(requiredTier),
        riskDisclosuresRequired: !isListed || requiredTier === 'tier_3'
      }
    });
  } catch (error: any) {
    console.error('Error checking eligibility:', error);
    return apiResponse.serverError(res, 'Failed to check eligibility');
  }
});

/**
 * GET /api/bonds/my-eligibility-summary
 * Get summary of what bonds user can access
 */
router.get('/my-eligibility-summary', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id;
    
    if (!userId) {
      return apiResponse.unauthorized(res, 'User not authenticated');
    }

    const users = await db.select().from(schema.users)
      .where(eq(schema.users.id, userId));
    const user = users[0];

    const userTier = user?.kycTier || 'none';
    
    const eligibleCategories = [];
    const restrictedCategories = [];

    // Define tier capabilities
    const tierCapabilities: Record<string, string[]> = {
      'none': [],
      'basic': ['gsec', 't_bill', 'sdl', 'sgb'],
      'tier_1': ['gsec', 't_bill', 'sdl', 'sgb', 'corporate_listed', 'ncd_listed', 'tax_free'],
      'tier_2': ['gsec', 't_bill', 'sdl', 'sgb', 'corporate_listed', 'ncd_listed', 'tax_free', 'infrastructure'],
      'tier_3': ['gsec', 't_bill', 'sdl', 'sgb', 'corporate_listed', 'ncd_listed', 'tax_free', 'infrastructure', 'unlisted'],
      'enhanced': ['gsec', 't_bill', 'sdl', 'sgb', 'corporate_listed', 'ncd_listed', 'tax_free', 'infrastructure', 'unlisted'],
      'accredited': ['gsec', 't_bill', 'sdl', 'sgb', 'corporate_listed', 'ncd_listed', 'tax_free', 'infrastructure', 'unlisted', 'private_placement']
    };

    const allCategories = [
      { id: 'gsec', name: 'Government Securities', tier: 'basic' },
      { id: 'corporate_listed', name: 'Listed Corporate Bonds', tier: 'tier_1' },
      { id: 'ncd_listed', name: 'Listed NCDs', tier: 'tier_1' },
      { id: 'tax_free', name: 'Tax Free Bonds', tier: 'tier_1' },
      { id: 'infrastructure', name: 'Infrastructure Bonds', tier: 'tier_2' },
      { id: 'unlisted', name: 'Unlisted Bonds', tier: 'tier_3' },
      { id: 'private_placement', name: 'Private Placements', tier: 'accredited' }
    ];

    const userCapabilities = tierCapabilities[userTier] || [];

    allCategories.forEach(cat => {
      if (userCapabilities.includes(cat.id)) {
        eligibleCategories.push(cat);
      } else {
        restrictedCategories.push({ ...cat, requiredTier: cat.tier });
      }
    });

    return apiResponse.success(res, {
      currentTier: userTier,
      tierDisplayName: getTierDisplayName(userTier),
      eligibleCategories,
      restrictedCategories,
      nextTier: getNextTier(userTier),
      upgradeUrl: '/kyc/upgrade'
    });
  } catch (error: any) {
    console.error('Error getting eligibility summary:', error);
    return apiResponse.serverError(res, 'Failed to get eligibility summary');
  }
});

// =====================================================
// TASK 3: Risk Disclosure Integration
// =====================================================

/**
 * GET /api/bonds/risk-disclosures/:instrumentType
 * Get SEBI-mandated risk disclosures for an instrument type
 */
router.get('/risk-disclosures/:instrumentType', async (req: Request, res: Response) => {
  try {
    const { instrumentType } = req.params;
    const { transactionValue, isListed } = req.query;

    const disclosures = getSEBIDisclosures(instrumentType, parseFloat(transactionValue as string) || 0, isListed !== 'false');

    return apiResponse.success(res, disclosures);
  } catch (error: any) {
    console.error('Error getting risk disclosures:', error);
    return apiResponse.serverError(res, 'Failed to get risk disclosures');
  }
});

/**
 * POST /api/bonds/risk-attestation
 * Record user's acknowledgment of risk disclosures
 */
router.post('/risk-attestation', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id;
    const {
      isin,
      bondName,
      instrumentType,
      transactionValue,
      disclosuresAcknowledged,
      orderType
    } = req.body;

    if (!isin || !instrumentType || !disclosuresAcknowledged) {
      return apiResponse.badRequest(res, 'Missing required fields');
    }

    // Verify all required disclosures are acknowledged
    const required = getSEBIDisclosures(instrumentType, transactionValue || 0, true);
    const requiredCategories = required.disclosures.filter((d: any) => d.requiresExplicitAck).map((d: any) => d.category);
    const acknowledged = disclosuresAcknowledged || [];
    
    const allAcknowledged = requiredCategories.every((cat: string) => acknowledged.includes(cat));

    // Record attestation
    const [attestation] = await db.insert(schema.bondRiskDisclosureAttestations).values({
      userId,
      isin,
      bondName: bondName || isin,
      instrumentType,
      transactionValue: String(transactionValue || 0),
      disclosuresAcknowledged: acknowledged,
      allDisclosuresAccepted: allAcknowledged,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      retentionExpiresAt: new Date(Date.now() + 7 * 365 * 24 * 60 * 60 * 1000) // 7 years
    }).returning();

    return apiResponse.success(res, {
      attestationId: attestation.id,
      allDisclosuresAccepted: allAcknowledged,
      message: allAcknowledged ? 'All risk disclosures acknowledged' : 'Some required disclosures not acknowledged'
    });
  } catch (error: any) {
    console.error('Error recording attestation:', error);
    return apiResponse.serverError(res, 'Failed to record attestation');
  }
});

// =====================================================
// TASK 4: Data Freshness & Reliability
// =====================================================

/**
 * GET /api/bonds/data-freshness
 * Get data freshness status for bond sources
 */
router.get('/data-freshness', async (_req: Request, res: Response) => {
  try {
    // Get latest update timestamps from various sources
    const [latestGov] = await db.select({ updatedAt: schema.governmentSecurities.updatedAt })
      .from(schema.governmentSecurities)
      .orderBy(desc(schema.governmentSecurities.updatedAt))
      .limit(1);

    const [latestCorp] = await db.select({ updatedAt: schema.corporateBonds.updatedAt })
      .from(schema.corporateBonds)
      .orderBy(desc(schema.corporateBonds.updatedAt))
      .limit(1);

    const now = new Date();
    const freshnesThreshold = 6 * 60 * 60 * 1000; // 6 hours

    const sources = [
      {
        source: 'Government Securities (RBI)',
        lastUpdated: latestGov?.updatedAt,
        isStale: latestGov?.updatedAt ? (now.getTime() - new Date(latestGov.updatedAt).getTime()) > freshnesThreshold : true,
        status: latestGov?.updatedAt ? (now.getTime() - new Date(latestGov.updatedAt).getTime()) > freshnesThreshold ? 'stale' : 'fresh' : 'unavailable'
      },
      {
        source: 'Corporate Bonds (NSE/BSE)',
        lastUpdated: latestCorp?.updatedAt,
        isStale: latestCorp?.updatedAt ? (now.getTime() - new Date(latestCorp.updatedAt).getTime()) > freshnesThreshold : true,
        status: latestCorp?.updatedAt ? (now.getTime() - new Date(latestCorp.updatedAt).getTime()) > freshnesThreshold ? 'stale' : 'fresh' : 'unavailable'
      }
    ];

    return apiResponse.success(res, {
      timestamp: now.toISOString(),
      sources,
      overallStatus: sources.every(s => s.status === 'fresh') ? 'all_fresh' : sources.some(s => s.status === 'stale') ? 'some_stale' : 'unavailable'
    });
  } catch (error: any) {
    console.error('Error getting data freshness:', error);
    return apiResponse.serverError(res, 'Failed to get data freshness');
  }
});

// =====================================================
// TASK 5: Net Yield Display for Investors
// =====================================================

/**
 * GET /api/bonds/net-yield/:isin
 * Get net yield calculation for a bond (investor segment based)
 */
router.get('/net-yield/:isin', async (req: Request, res: Response) => {
  try {
    const { isin } = req.params;
    const { investorSegment = 'retail' } = req.query;

    // Find the bond
    let bond: any = null;
    let instrumentType = 'corporate_bond';
    let grossYield = 0;
    let minInvestment = 100000;
    let maturityDate: Date | null = null;

    const [govBond] = await db.select().from(schema.governmentSecurities)
      .where(eq(schema.governmentSecurities.isin, isin));
    
    if (govBond) {
      bond = govBond;
      instrumentType = govBond.securityType || 'gsec';
      grossYield = parseFloat(govBond.indicativeYield || '0');
      minInvestment = govBond.minimumBidAmount || 10000;
      maturityDate = govBond.maturityDate ? new Date(govBond.maturityDate) : null;
    } else {
      const [corpBond] = await db.select().from(schema.corporateBonds)
        .where(eq(schema.corporateBonds.isin, isin));
      
      if (corpBond) {
        bond = corpBond;
        instrumentType = corpBond.bondType || 'corporate_bond';
        grossYield = parseFloat(corpBond.yieldToMaturity || corpBond.currentYield || '0');
        minInvestment = corpBond.minimumLotSize || 10000;
        maturityDate = corpBond.maturityDate ? new Date(corpBond.maturityDate) : null;
      }
    }

    if (!bond) {
      return apiResponse.notFound(res, 'Bond not found');
    }

    // Calculate holding period
    const now = new Date();
    const holdingPeriodYears = maturityDate ? Math.max(0.25, (maturityDate.getTime() - now.getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : 1;

    // Calculate net yield using the calibration service
    try {
      const netYieldResult = await bondFeeCalibrationService.calculateNetYield({
        instrumentType,
        grossYield,
        transactionAmount: minInvestment,
        holdingPeriodYears,
        investorSegment: investorSegment as 'retail' | 'hni' | 'institutional'
      });

      return apiResponse.success(res, {
        isin,
        bondName: bond.securityName || bond.bondName || bond.issuerName,
        instrumentType,
        ...netYieldResult,
        investorSegment
      });
    } catch (calcError) {
      // Fallback to simple calculation
      const estimatedFees = grossYield * 0.02; // 2% fee impact estimate
      return apiResponse.success(res, {
        isin,
        bondName: bond.securityName || bond.bondName || bond.issuerName,
        instrumentType,
        grossYield,
        netYield: grossYield - estimatedFees,
        feeImpactBps: Math.round(estimatedFees * 100),
        investorSegment,
        isEstimate: true
      });
    }
  } catch (error: any) {
    console.error('Error calculating net yield:', error);
    return apiResponse.serverError(res, 'Failed to calculate net yield');
  }
});

// =====================================================
// TASK 6: Watchlist & Alerts
// =====================================================

/**
 * GET /api/bonds/watchlist
 * Get user's bond watchlist
 */
router.get('/watchlist', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id;

    const watchlistItems = await db.select().from(schema.bondWatchlist)
      .where(eq(schema.bondWatchlist.userId, userId))
      .orderBy(desc(schema.bondWatchlist.addedAt));

    // Enrich with current data
    const enrichedItems = await Promise.all(watchlistItems.map(async (item) => {
      let currentData: any = {};
      
      const [govBond] = await db.select().from(schema.governmentSecurities)
        .where(eq(schema.governmentSecurities.isin, item.isin));
      
      if (govBond) {
        currentData = {
          currentYield: govBond.indicativeYield,
          lastUpdated: govBond.updatedAt
        };
      } else {
        const [corpBond] = await db.select().from(schema.corporateBonds)
          .where(eq(schema.corporateBonds.isin, item.isin));
        
        if (corpBond) {
          currentData = {
            currentYield: corpBond.yieldToMaturity || corpBond.currentYield,
            currentPrice: corpBond.lastTradedPrice || corpBond.currentPrice,
            lastUpdated: corpBond.updatedAt
          };
        }
      }

      return {
        ...item,
        ...currentData,
        yieldChange: currentData.currentYield && item.yieldAtAdd 
          ? parseFloat(currentData.currentYield) - parseFloat(String(item.yieldAtAdd)) 
          : null
      };
    }));

    return apiResponse.success(res, enrichedItems);
  } catch (error: any) {
    console.error('Error fetching watchlist:', error);
    return apiResponse.serverError(res, 'Failed to fetch watchlist');
  }
});

/**
 * POST /api/bonds/watchlist
 * Add bond to watchlist
 */
router.post('/watchlist', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id;
    const { isin, alertOnYieldChange = true, yieldChangeThreshold = 0.25 } = req.body;

    if (!isin) {
      return apiResponse.badRequest(res, 'ISIN is required');
    }

    // Check if already in watchlist
    const [existing] = await db.select().from(schema.bondWatchlist)
      .where(and(
        eq(schema.bondWatchlist.userId, userId),
        eq(schema.bondWatchlist.isin, isin)
      ));

    if (existing) {
      return apiResponse.badRequest(res, 'Bond already in watchlist');
    }

    // Get bond details
    let bondName = isin;
    let instrumentType = 'unknown';
    let yieldAtAdd: number | null = null;

    const [govBond] = await db.select().from(schema.governmentSecurities)
      .where(eq(schema.governmentSecurities.isin, isin));
    
    if (govBond) {
      bondName = govBond.securityName || isin;
      instrumentType = 'government';
      yieldAtAdd = parseFloat(govBond.indicativeYield || '0');
    } else {
      const [corpBond] = await db.select().from(schema.corporateBonds)
        .where(eq(schema.corporateBonds.isin, isin));
      
      if (corpBond) {
        bondName = corpBond.bondName || corpBond.issuerName || isin;
        instrumentType = corpBond.bondType || 'corporate';
        yieldAtAdd = parseFloat(corpBond.yieldToMaturity || corpBond.currentYield || '0');
      }
    }

    const [watchlistItem] = await db.insert(schema.bondWatchlist).values({
      userId,
      isin,
      bondName,
      instrumentType,
      yieldAtAdd,
      alertOnYieldChange,
      yieldChangeThreshold: String(yieldChangeThreshold)
    }).returning();

    return apiResponse.success(res, watchlistItem, 201);
  } catch (error: any) {
    console.error('Error adding to watchlist:', error);
    return apiResponse.serverError(res, 'Failed to add to watchlist');
  }
});

/**
 * DELETE /api/bonds/watchlist/:isin
 * Remove bond from watchlist
 */
router.delete('/watchlist/:isin', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id;
    const { isin } = req.params;

    await db.delete(schema.bondWatchlist)
      .where(and(
        eq(schema.bondWatchlist.userId, userId),
        eq(schema.bondWatchlist.isin, isin)
      ));

    return apiResponse.success(res, { message: 'Removed from watchlist' });
  } catch (error: any) {
    console.error('Error removing from watchlist:', error);
    return apiResponse.serverError(res, 'Failed to remove from watchlist');
  }
});

/**
 * GET /api/bonds/alerts
 * Get user's bond alerts
 */
router.get('/alerts', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id;
    const { status = 'unread' } = req.query;

    const alerts = await db.select().from(schema.bondAlerts)
      .where(and(
        eq(schema.bondAlerts.userId, userId),
        status !== 'all' ? eq(schema.bondAlerts.status, status as string) : sql`1=1`
      ))
      .orderBy(desc(schema.bondAlerts.createdAt))
      .limit(50);

    return apiResponse.success(res, alerts);
  } catch (error: any) {
    console.error('Error fetching alerts:', error);
    return apiResponse.serverError(res, 'Failed to fetch alerts');
  }
});

/**
 * PATCH /api/bonds/alerts/:id/read
 * Mark alert as read
 */
router.patch('/alerts/:id/read', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id;
    const { id } = req.params;

    await db.update(schema.bondAlerts)
      .set({ status: 'read', readAt: new Date() })
      .where(and(
        eq(schema.bondAlerts.id, id),
        eq(schema.bondAlerts.userId, userId)
      ));

    return apiResponse.success(res, { message: 'Alert marked as read' });
  } catch (error: any) {
    console.error('Error marking alert as read:', error);
    return apiResponse.serverError(res, 'Failed to mark alert as read');
  }
});

// =====================================================
// TASK 7: Suitability Scoring
// =====================================================

/**
 * GET /api/bonds/suitability/:isin
 * Calculate suitability score for a bond based on user profile
 */
router.get('/suitability/:isin', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id;
    const { isin } = req.params;

    // Get user's risk profile
    const [riskProfile] = await db.select().from(schema.riskProfiles)
      .where(eq(schema.riskProfiles.userId, userId));

    if (!riskProfile) {
      return apiResponse.success(res, {
        isin,
        hasSuitabilityScore: false,
        message: 'Complete risk profiling to get personalized recommendations',
        profileUrl: '/risk-profile'
      });
    }

    // Get bond details
    let bond: any = null;
    let instrumentType = 'corporate_bond';
    let bondYield = 0;
    let maturityDate: Date | null = null;
    let creditRating = '';
    let isListed = true;
    let bondName = '';

    const [govBond] = await db.select().from(schema.governmentSecurities)
      .where(eq(schema.governmentSecurities.isin, isin));
    
    if (govBond) {
      bond = govBond;
      instrumentType = 'government';
      bondYield = parseFloat(govBond.indicativeYield || '0');
      maturityDate = govBond.maturityDate ? new Date(govBond.maturityDate) : null;
      creditRating = 'SOV';
      bondName = govBond.securityName || isin;
    } else {
      const [corpBond] = await db.select().from(schema.corporateBonds)
        .where(eq(schema.corporateBonds.isin, isin));
      
      if (corpBond) {
        bond = corpBond;
        instrumentType = corpBond.bondType || 'corporate';
        bondYield = parseFloat(corpBond.yieldToMaturity || corpBond.currentYield || '0');
        maturityDate = corpBond.maturityDate ? new Date(corpBond.maturityDate) : null;
        creditRating = corpBond.creditRating || corpBond.rating || '';
        isListed = corpBond.isListed !== false;
        bondName = corpBond.bondName || corpBond.issuerName || isin;
      }
    }

    if (!bond) {
      return apiResponse.notFound(res, 'Bond not found');
    }

    // Calculate suitability scores
    const scores = calculateSuitabilityScores(riskProfile, {
      instrumentType,
      yield: bondYield,
      maturityDate,
      creditRating,
      isListed
    });

    return apiResponse.success(res, {
      isin,
      bondName,
      instrumentType,
      hasSuitabilityScore: true,
      scores,
      overallScore: scores.overall,
      suitabilityCategory: getSuitabilityCategory(scores.overall),
      recommendation: getSuitabilityRecommendation(scores),
      warnings: scores.warnings
    });
  } catch (error: any) {
    console.error('Error calculating suitability:', error);
    return apiResponse.serverError(res, 'Failed to calculate suitability');
  }
});

/**
 * GET /api/bonds/suitable-for-me
 * Get bonds sorted by suitability for user
 */
router.get('/suitable-for-me', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id;
    const { limit = '10' } = req.query;

    // Get user's risk profile
    const [riskProfile] = await db.select().from(schema.riskProfiles)
      .where(eq(schema.riskProfiles.userId, userId));

    if (!riskProfile) {
      return apiResponse.success(res, {
        hasSuitableRecommendations: false,
        message: 'Complete risk profiling to get personalized recommendations',
        profileUrl: '/risk-profile'
      });
    }

    // Fetch bonds
    const [govBonds, corpBonds] = await Promise.all([
      db.select().from(schema.governmentSecurities).where(eq(schema.governmentSecurities.tradingStatus, 'active')).limit(50),
      db.select().from(schema.corporateBonds).where(eq(schema.corporateBonds.tradingStatus, 'active')).limit(50)
    ]);

    // Score all bonds
    const scoredBonds: any[] = [];

    govBonds.forEach(bond => {
      const scores = calculateSuitabilityScores(riskProfile, {
        instrumentType: 'government',
        yield: parseFloat(bond.indicativeYield || '0'),
        maturityDate: bond.maturityDate ? new Date(bond.maturityDate) : null,
        creditRating: 'SOV',
        isListed: true
      });

      scoredBonds.push({
        isin: bond.isin,
        bondName: bond.securityName,
        instrumentType: 'government',
        yield: bond.indicativeYield,
        maturityDate: bond.maturityDate,
        creditRating: 'SOV',
        suitabilityScore: scores.overall,
        suitabilityCategory: getSuitabilityCategory(scores.overall)
      });
    });

    corpBonds.forEach(bond => {
      const scores = calculateSuitabilityScores(riskProfile, {
        instrumentType: bond.bondType || 'corporate',
        yield: parseFloat(bond.yieldToMaturity || bond.currentYield || '0'),
        maturityDate: bond.maturityDate ? new Date(bond.maturityDate) : null,
        creditRating: bond.creditRating || bond.rating || '',
        isListed: bond.isListed !== false
      });

      scoredBonds.push({
        isin: bond.isin,
        bondName: bond.bondName || bond.issuerName,
        instrumentType: bond.bondType || 'corporate',
        yield: bond.yieldToMaturity || bond.currentYield,
        maturityDate: bond.maturityDate,
        creditRating: bond.creditRating || bond.rating,
        suitabilityScore: scores.overall,
        suitabilityCategory: getSuitabilityCategory(scores.overall)
      });
    });

    // Sort by suitability score
    scoredBonds.sort((a, b) => b.suitabilityScore - a.suitabilityScore);

    return apiResponse.success(res, {
      hasSuitableRecommendations: true,
      recommendations: scoredBonds.slice(0, parseInt(limit as string)),
      riskProfileSummary: {
        riskCategory: riskProfile.riskCategory,
        investmentHorizon: riskProfile.investmentTimeHorizon
      }
    });
  } catch (error: any) {
    console.error('Error getting suitable bonds:', error);
    return apiResponse.serverError(res, 'Failed to get suitable bonds');
  }
});

// =====================================================
// TASK 8: Admin Audit Dashboard
// =====================================================

/**
 * GET /api/admin/bonds/fee-override-audit
 * Get fee override audit trail
 */
router.get('/admin/fee-override-audit', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { 
      startDate, 
      endDate, 
      action, 
      isin,
      limit = '50',
      offset = '0'
    } = req.query;

    const conditions = [];

    if (startDate) {
      conditions.push(gte(schema.bondFeeOverrideAudit.performedAt, new Date(startDate as string)));
    }
    if (endDate) {
      conditions.push(lte(schema.bondFeeOverrideAudit.performedAt, new Date(endDate as string)));
    }
    if (action) {
      conditions.push(eq(schema.bondFeeOverrideAudit.action, action as string));
    }
    if (isin) {
      conditions.push(eq(schema.bondFeeOverrideAudit.isin, isin as string));
    }

    const auditRecords = await db.select()
      .from(schema.bondFeeOverrideAudit)
      .where(conditions.length > 0 ? and(...conditions) : sql`1=1`)
      .orderBy(desc(schema.bondFeeOverrideAudit.performedAt))
      .limit(parseInt(limit as string))
      .offset(parseInt(offset as string));

    // Get total count
    const [countResult] = await db.select({ count: sql<number>`count(*)::int` })
      .from(schema.bondFeeOverrideAudit)
      .where(conditions.length > 0 ? and(...conditions) : sql`1=1`);

    return apiResponse.success(res, {
      records: auditRecords,
      total: countResult?.count || 0,
      pagination: {
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      }
    });
  } catch (error: any) {
    console.error('Error fetching audit records:', error);
    return apiResponse.serverError(res, 'Failed to fetch audit records');
  }
});

/**
 * GET /api/admin/bonds/compliance-summary
 * Get compliance summary for reporting
 */
router.get('/admin/compliance-summary', requireAdmin, async (_req: Request, res: Response) => {
  try {
    const now = new Date();
    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Get override statistics
    const [overrideStats] = await db.select({
      totalOverrides: sql<number>`count(*)::int`,
      pendingApproval: sql<number>`count(*) filter (where approved_at is null)::int`
    }).from(schema.bondFeeOverrides);

    // Get attestation statistics
    const [attestationStats] = await db.select({
      totalAttestations: sql<number>`count(*)::int`,
      last30Days: sql<number>`count(*) filter (where attested_at >= ${last30Days})::int`
    }).from(schema.bondRiskDisclosureAttestations);

    // Get audit activity
    const [auditStats] = await db.select({
      totalActions: sql<number>`count(*)::int`,
      creates: sql<number>`count(*) filter (where action = 'created')::int`,
      modifications: sql<number>`count(*) filter (where action = 'modified')::int`,
      approvals: sql<number>`count(*) filter (where action = 'approved')::int`,
      violations: sql<number>`count(*) filter (where regulatory_violations is not null and regulatory_violations != '[]'::jsonb)::int`
    }).from(schema.bondFeeOverrideAudit);

    return apiResponse.success(res, {
      feeOverrides: {
        total: overrideStats?.totalOverrides || 0,
        pendingApproval: overrideStats?.pendingApproval || 0
      },
      riskAttestations: {
        total: attestationStats?.totalAttestations || 0,
        last30Days: attestationStats?.last30Days || 0
      },
      auditActivity: {
        total: auditStats?.totalActions || 0,
        breakdown: {
          creates: auditStats?.creates || 0,
          modifications: auditStats?.modifications || 0,
          approvals: auditStats?.approvals || 0
        },
        violationsRecorded: auditStats?.violations || 0
      },
      generatedAt: now.toISOString()
    });
  } catch (error: any) {
    console.error('Error getting compliance summary:', error);
    return apiResponse.serverError(res, 'Failed to get compliance summary');
  }
});

// =====================================================
// Helper Functions
// =====================================================

function getRiskLevel(rating: string): string {
  if (!rating) return 'Unknown';
  if (rating === 'SOV' || rating.startsWith('AAA')) return 'Very Low';
  if (rating.startsWith('AA')) return 'Low';
  if (rating.startsWith('A')) return 'Moderate';
  if (rating.startsWith('BBB')) return 'Medium';
  if (rating.startsWith('BB')) return 'High';
  return 'Very High';
}

function getRiskScore(rating: string): number {
  if (!rating) return 100;
  if (rating === 'SOV') return 0;
  if (rating.startsWith('AAA')) return 5;
  if (rating === 'AA+') return 10;
  if (rating === 'AA') return 15;
  if (rating === 'AA-') return 20;
  if (rating === 'A+') return 30;
  if (rating === 'A') return 35;
  if (rating === 'A-') return 40;
  if (rating.startsWith('BBB')) return 50;
  if (rating.startsWith('BB')) return 70;
  return 90;
}

function getUpgradePath(currentTier: string, requiredTier: string): any {
  const paths: Record<string, any> = {
    'none_to_basic': { steps: ['Complete basic KYC', 'Verify PAN'], estimatedTime: '10 minutes' },
    'basic_to_tier_1': { steps: ['Add address proof', 'Bank verification'], estimatedTime: '15 minutes' },
    'tier_1_to_tier_2': { steps: ['Income verification', 'Risk assessment'], estimatedTime: '20 minutes' },
    'tier_2_to_tier_3': { steps: ['Net worth declaration', 'Enhanced due diligence'], estimatedTime: '1-2 days' },
    'tier_3_to_accredited': { steps: ['Accredited investor verification', 'SEBI compliance check'], estimatedTime: '3-5 days' }
  };
  
  return paths[`${currentTier}_to_${requiredTier}`] || { steps: ['Contact support for upgrade'], estimatedTime: 'Varies' };
}

function getKycDocumentsForTier(tier: string): string[] {
  const docs: Record<string, string[]> = {
    'basic': ['PAN Card'],
    'tier_1': ['PAN Card', 'Address Proof', 'Bank Statement'],
    'tier_2': ['PAN Card', 'Address Proof', 'Bank Statement', 'Income Proof'],
    'tier_3': ['PAN Card', 'Address Proof', 'Bank Statement', 'Income Proof', 'Net Worth Certificate'],
    'accredited': ['PAN Card', 'Address Proof', 'Bank Statement', 'Income Proof', 'Net Worth Certificate', 'CA Certificate']
  };
  return docs[tier] || docs['basic'];
}

function getTierDisplayName(tier: string): string {
  const names: Record<string, string> = {
    'none': 'Not Verified',
    'basic': 'Basic KYC',
    'tier_1': 'Standard',
    'tier_2': 'Enhanced',
    'tier_3': 'Premium',
    'enhanced': 'Enhanced',
    'accredited': 'SEBI Accredited'
  };
  return names[tier] || tier;
}

function getNextTier(currentTier: string): any {
  const order = ['none', 'basic', 'tier_1', 'tier_2', 'tier_3', 'accredited'];
  const currentIndex = order.indexOf(currentTier);
  if (currentIndex < 0 || currentIndex >= order.length - 1) return null;
  
  const nextTier = order[currentIndex + 1];
  return { tier: nextTier, displayName: getTierDisplayName(nextTier) };
}

function getSEBIDisclosures(instrumentType: string, transactionValue: number, isListed: boolean): any {
  const baseDisclosures = [
    { category: 'market_risk', title: 'Market Risk', description: 'Bond prices can fluctuate based on market conditions, interest rates, and economic factors.', requiresExplicitAck: true },
    { category: 'interest_rate_risk', title: 'Interest Rate Risk', description: 'Rising interest rates may cause bond prices to decline.', requiresExplicitAck: true },
    { category: 'credit_risk', title: 'Credit Risk', description: 'The issuer may default on interest or principal payments.', requiresExplicitAck: true }
  ];

  const additionalDisclosures = [];

  if (!isListed) {
    additionalDisclosures.push(
      { category: 'liquidity_risk', title: 'Liquidity Risk', description: 'Unlisted bonds may be difficult to sell. You may not be able to exit your position quickly.', requiresExplicitAck: true },
      { category: 'valuation_risk', title: 'Valuation Risk', description: 'Fair value of unlisted securities may be difficult to determine.', requiresExplicitAck: true }
    );
  }

  if (transactionValue > 5000000) {
    additionalDisclosures.push(
      { category: 'concentration_risk', title: 'Concentration Risk', description: 'Large investments in a single instrument increase portfolio concentration risk.', requiresExplicitAck: true }
    );
  }

  if (instrumentType === 'corporate' || instrumentType === 'ncd') {
    additionalDisclosures.push(
      { category: 'default_risk', title: 'Default Risk', description: 'Corporate issuers may face financial difficulties leading to default.', requiresExplicitAck: true }
    );
  }

  return {
    disclosures: [...baseDisclosures, ...additionalDisclosures],
    requiredCount: baseDisclosures.length + additionalDisclosures.filter(d => d.requiresExplicitAck).length
  };
}

function calculateSuitabilityScores(riskProfile: any, bondDetails: any): any {
  const warnings: string[] = [];
  
  // Risk alignment (0-100)
  const riskScore = getRiskScore(bondDetails.creditRating);
  const userRiskTolerance = getRiskToleranceScore(riskProfile.riskCategory);
  const riskAlignment = Math.max(0, 100 - Math.abs(riskScore - userRiskTolerance));

  // Horizon alignment (0-100)
  let horizonAlignment = 50;
  if (bondDetails.maturityDate) {
    const yearsToMaturity = (bondDetails.maturityDate.getTime() - Date.now()) / (365.25 * 24 * 60 * 60 * 1000);
    const userHorizon = getHorizonYears(riskProfile.investmentTimeHorizon);
    horizonAlignment = Math.max(0, 100 - Math.abs(yearsToMaturity - userHorizon) * 10);
    
    if (yearsToMaturity > userHorizon * 1.5) {
      warnings.push('Bond maturity exceeds your investment horizon');
    }
  }

  // Liquidity score (0-100)
  const liquidityScore = bondDetails.isListed ? 80 : 30;
  if (!bondDetails.isListed && riskProfile.liquidityNeeds === 'high') {
    warnings.push('Unlisted bond may not meet your liquidity needs');
  }

  // Yield expectation score (0-100)
  const yieldExpectation = riskProfile.expectedReturns || 7;
  const yieldAlignment = bondDetails.yield >= yieldExpectation ? 100 : (bondDetails.yield / yieldExpectation) * 100;

  // Tax efficiency (0-100)
  const taxScore = bondDetails.instrumentType === 'tax_free' ? 100 : 
    bondDetails.instrumentType === 'government' ? 70 : 50;

  const overall = Math.round((riskAlignment * 0.3 + horizonAlignment * 0.25 + liquidityScore * 0.15 + yieldAlignment * 0.2 + taxScore * 0.1) * 10) / 10;

  return {
    riskAlignment,
    horizonAlignment,
    liquidityScore,
    yieldExpectation: Math.round(yieldAlignment),
    taxEfficiency: taxScore,
    overall,
    warnings
  };
}

function getRiskToleranceScore(riskCategory: string): number {
  const scores: Record<string, number> = {
    'conservative': 20,
    'moderately_conservative': 35,
    'moderate': 50,
    'moderately_aggressive': 65,
    'aggressive': 80
  };
  return scores[riskCategory] || 50;
}

function getHorizonYears(horizon: string): number {
  const years: Record<string, number> = {
    'short': 1,
    'medium_short': 2,
    'medium': 3,
    'medium_long': 5,
    'long': 10
  };
  return years[horizon] || 3;
}

function getSuitabilityCategory(score: number): string {
  if (score >= 80) return 'highly_suitable';
  if (score >= 60) return 'suitable';
  if (score >= 40) return 'neutral';
  if (score >= 20) return 'less_suitable';
  return 'not_suitable';
}

function getSuitabilityRecommendation(scores: any): string {
  if (scores.overall >= 80) return 'This bond aligns well with your investment profile.';
  if (scores.overall >= 60) return 'This bond is generally suitable for your profile.';
  if (scores.overall >= 40) return 'This bond has mixed alignment with your goals. Review carefully.';
  if (scores.overall >= 20) return 'This bond may not be ideal for your risk profile.';
  return 'This bond is not recommended based on your profile.';
}

export default router;
