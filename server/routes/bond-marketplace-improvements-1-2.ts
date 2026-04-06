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
router.get('/my-eligibility-summary', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id;
    
    if (!userId) {
      return apiResponse.unauthorized(res, 'User not authenticated');
    }

    const users = await db.select().from(schema.users)
      .where(eq(schema.users.id, userId));
    const user = users[0];

    const userTier = (user as any)?.kycTier || 'none';
    
    const eligibleCategories: { id: string; name: string; tier: string }[] = [];
    const restrictedCategories: { id: string; name: string; tier: string; requiredTier?: string }[] = [];

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
    const [latestGov] = await db.select({ lastUpdated: schema.governmentSecurities.lastUpdated })
      .from(schema.governmentSecurities)
      .orderBy(desc(schema.governmentSecurities.lastUpdated))
      .limit(1);

    const [latestCorp] = await db.select({ lastUpdated: schema.corporateBonds.lastUpdated })
      .from(schema.corporateBonds)
      .orderBy(desc(schema.corporateBonds.lastUpdated))
      .limit(1);

    const now = new Date();
    const freshnesThreshold = 6 * 60 * 60 * 1000; // 6 hours

    const sources = [
      {
        source: 'Government Securities (RBI)',
        lastUpdated: latestGov?.lastUpdated,
        isStale: latestGov?.lastUpdated ? (now.getTime() - new Date(latestGov.lastUpdated).getTime()) > freshnesThreshold : true,
        status: latestGov?.lastUpdated ? (now.getTime() - new Date(latestGov.lastUpdated).getTime()) > freshnesThreshold ? 'stale' : 'fresh' : 'unavailable'
      },
      {
        source: 'Corporate Bonds (NSE/BSE)',
        lastUpdated: latestCorp?.lastUpdated,
        isStale: latestCorp?.lastUpdated ? (now.getTime() - new Date(latestCorp.lastUpdated).getTime()) > freshnesThreshold : true,
        status: latestCorp?.lastUpdated ? (now.getTime() - new Date(latestCorp.lastUpdated).getTime()) > freshnesThreshold ? 'stale' : 'fresh' : 'unavailable'
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

// Helper to map instrument types to the service-accepted union types
type BondFeeInstrumentType = 'gsec' | 'tbill' | 'sdl' | 'sgb' | 'corporate_bond' | 'ncd' | 'infrastructure_bond' | 'unlisted_bond' | 'tax_free_bond';

function mapToFeeInstrumentType(rawType: string, isGovernment: boolean): BondFeeInstrumentType {
  const typeMap: Record<string, BondFeeInstrumentType> = {
    'g_sec': 'gsec',
    'gsec': 'gsec',
    'government': 'gsec',
    't_bill': 'tbill',
    'tbill': 'tbill',
    'treasury_bill': 'tbill',
    'sdl': 'sdl',
    'state_development_loan': 'sdl',
    'sgb': 'sgb',
    'sovereign_gold_bond': 'sgb',
    'corporate': 'corporate_bond',
    'corporate_bond': 'corporate_bond',
    'ncd': 'ncd',
    'non_convertible_debenture': 'ncd',
    'debenture': 'ncd',
    'infrastructure': 'infrastructure_bond',
    'infrastructure_bond': 'infrastructure_bond',
    'unlisted': 'unlisted_bond',
    'unlisted_bond': 'unlisted_bond',
    'tax_free': 'tax_free_bond',
    'tax_free_bond': 'tax_free_bond'
  };
  
  const normalizedType = rawType?.toLowerCase().replace(/[- ]/g, '_');
  if (typeMap[normalizedType]) {
    return typeMap[normalizedType];
  }
  return isGovernment ? 'gsec' : 'corporate_bond';
}

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
    let rawInstrumentType = 'corporate_bond';
    let isGovernment = false;
    let grossYield = 0;
    let minInvestment = 100000;
    let maturityDate: Date | null = null;

    const [govBond] = await db.select().from(schema.governmentSecurities)
      .where(eq(schema.governmentSecurities.isin, isin));
    
    if (govBond) {
      bond = govBond;
      isGovernment = true;
      rawInstrumentType = govBond.securityType || 'gsec';
      grossYield = parseFloat(govBond.yieldToMaturity || '0');
      minInvestment = parseInt(govBond.minimumInvestment || '10000');
      maturityDate = govBond.maturityDate ? new Date(govBond.maturityDate) : null;
    } else {
      const [corpBond] = await db.select().from(schema.corporateBonds)
        .where(eq(schema.corporateBonds.isin, isin));
      
      if (corpBond) {
        bond = corpBond;
        isGovernment = false;
        rawInstrumentType = corpBond.bondType || 'corporate_bond';
        grossYield = parseFloat(corpBond.yieldToMaturity || '0');
        minInvestment = corpBond.minimumLotSize || 10000;
        maturityDate = corpBond.maturityDate ? new Date(corpBond.maturityDate) : null;
      }
    }

    if (!bond) {
      return apiResponse.notFound(res, 'Bond not found');
    }

    // Map to service-accepted instrument type
    const instrumentType = mapToFeeInstrumentType(rawInstrumentType, isGovernment);

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
        bondName: bond.securityName || bond.bondName || bond.issuer,
        instrumentType,
        ...netYieldResult,
        investorSegment
      });
    } catch (calcError) {
      // Fallback to simple calculation
      const estimatedFees = grossYield * 0.02; // 2% fee impact estimate
      return apiResponse.success(res, {
        isin,
        bondName: bond.securityName || bond.bondName || bond.issuer,
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


export default router;
