// @ts-nocheck
/**
 * Account Aggregator (AA) Consent Routes
 * 
 * API endpoints for:
 * - Creating consent for MF/Demat data fetch
 * - Fetching data after consent approval
 * - Syncing holdings to unified storage
 * - Managing active consent sessions
 * 
 * Regulatory Compliance:
 * - RBI Account Aggregator Framework
 * - SEBI investment advisor guidelines
 * - Consent audit trail for regulatory reporting
 */

import { Router, Request, Response } from 'express';
import { db } from '../db';
import { 
  aaConsentSessions, 
  dataSourceConsents,
  portfolios
} from '@shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { AAFIUService } from '../services/aa-fiu-service';
import { kycPortfolioMigrationService } from '../services/kyc-portfolio-migration-service';
import { unifiedHoldingsReaderService } from '../services/unified-holdings-reader-service';

const router: Router = Router();
const aaService = new AAFIUService();

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * GET /api/aa/consent/active
 * Check if user has an active AA consent session
 */
router.get('/consent/active', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.query.userId as string;
    
    if (!userId) {
      res.status(400).json({ error: 'userId is required' });
      return;
    }

    const [session] = await db
      .select()
      .from(aaConsentSessions)
      .where(and(
        eq(aaConsentSessions.userId, userId),
        eq(aaConsentSessions.status, 'active')
      ))
      .orderBy(desc(aaConsentSessions.createdAt))
      .limit(1);

    res.json({
      hasActiveConsent: !!session,
      session: session ? {
        id: session.id,
        status: session.status,
        assetTypes: session.assetTypes,
        expiresAt: session.expiresAt,
        lastDataFetchAt: session.lastDataFetchAt,
        aaProvider: session.aaProvider,
      } : null
    });
  } catch (error: unknown) {
    console.error('[AA] Error checking active consent:', error);
    res.status(500).json({ error: errorMessage(error) });
  }
});

/**
 * POST /api/aa/consent/create
 * Create a new AA consent request
 */
router.post('/consent/create', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, panNumber, assetTypes, validityDays = 90, syncFrequencyDays = 30 } = req.body as {
      userId?: string;
      panNumber?: string;
      assetTypes?: string[];
      validityDays?: number;
      syncFrequencyDays?: number;
    };

    if (!userId || !panNumber) {
      res.status(400).json({ error: 'userId and panNumber are required' });
      return;
    }

    const consentResponse = await (aaService as any).createConsent({
      userId,
      panNumber,
      assetTypes: assetTypes || ['MF', 'DEMAT'],
      validityDays,
      syncFrequencyDays,
      callbackUrl: `${process.env.APP_URL || 'https://fintekpro.com'}/api/aa/callback`,
    });

    // Record consent in audit log
    await db.insert(dataSourceConsents).values({
      userId: userId,
      dataSource: assetTypes?.includes('DEMAT') ? 'demat' : 'mutual_funds',
      provider: 'account_aggregator',
      consentGiven: true,
      consentPurpose: 'portfolio_sync',
      consentText: `I authorize FintekPro to fetch my ${assetTypes?.join(', ') || 'financial'} data via Account Aggregator for portfolio analysis.`,
      ipAddress: req.ip || '',
      userAgent: req.get('user-agent') || '',
    });

    res.json({
      success: true,
      consentHandleId: consentResponse.consentHandleId,
      redirectUrl: consentResponse.redirectUrl,
      sessionId: consentResponse.sessionId,
      expiresAt: consentResponse.expiresAt,
    });
  } catch (error: unknown) {
    console.error('[AA] Error creating consent:', error);
    res.status(500).json({ error: errorMessage(error) });
  }
});

/**
 * POST /api/aa/data/fetch
 * Fetch data from FIUs after consent approval
 * Routes to staging for review OR direct sync based on useStaging flag
 */
router.post('/data/fetch', async (req: Request, res: Response): Promise<void> => {
  try {
    const { consentSessionId, userId, useStaging = true } = req.body as {
      consentSessionId?: string;
      userId?: string;
      useStaging?: boolean;
    };

    if (!consentSessionId || !userId) {
      res.status(400).json({ error: 'consentSessionId and userId are required' });
      return;
    }

    // Step 1: Fetch fresh data from AA
    const fetchResult = await (aaService as any).fetchAllData(consentSessionId);

    if (!fetchResult.success) {
      res.status(500).json({ 
        error: 'Failed to fetch data from Account Aggregator',
        details: fetchResult.errors
      });
      return;
    }

    // Prepare holdings for staging or direct storage
    const allHoldings: any[] = [];

    if (fetchResult.aggregatedData?.mutualFunds?.length) {
      const mfHoldings = fetchResult.aggregatedData.mutualFunds.map((mf: any) => ({
        id: nanoid(),
        name: mf.schemeName || mf.fundName,
        isin: mf.isin,
        assetType: 'mutual_fund',
        quantity: mf.units || 0,
        units: mf.units || 0,
        averageCost: mf.avgNav,
        currentPrice: mf.currentNav,
        currentValue: mf.currentValue || (mf.units * mf.currentNav),
        investedValue: mf.investedValue,
        folioNumber: mf.folioNumber,
        source: 'aa_mf',
      }));
      allHoldings.push(...mfHoldings);
    }

    if (fetchResult.aggregatedData?.dematHoldings?.length) {
      const dematHoldings = fetchResult.aggregatedData.dematHoldings.map((h: any) => ({
        id: nanoid(),
        name: h.companyName || h.symbol,
        isin: h.isin,
        symbol: h.symbol,
        assetType: h.assetType || 'equity',
        quantity: h.quantity || 0,
        averageCost: h.averagePrice,
        currentPrice: h.currentPrice,
        currentValue: h.currentValue,
        investedValue: h.investedAmount,
        dematAccountNumber: h.dematAccountNumber,
        depository: h.depository,
        source: 'aa_demat',
      }));
      allHoldings.push(...dematHoldings);
    }

    // Update consent session with fetch timestamp
    await db.update(aaConsentSessions)
      .set({ lastDataFetchAt: new Date() })
      .where(eq(aaConsentSessions.id, consentSessionId));

    if (useStaging && allHoldings.length > 0) {
      // Route to staging for user review
      const stagingResponse = await fetch(`${process.env.APP_URL || 'http://localhost:5000'}/api/portfolio/staging/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          holdings: allHoldings,
          source: 'account_aggregator'
        })
      });

      if (!stagingResponse.ok) {
        console.error('[AA] Staging creation failed:', stagingResponse.status);
        res.status(500).json({ 
          error: 'Failed to create staging session for review',
          details: `Staging service returned ${stagingResponse.status}`
        });
        return;
      }

      const stagingResult = (await stagingResponse.json()) as { success?: boolean; sessionId?: string; error?: string };

      if (!stagingResult.success || !stagingResult.sessionId) {
        console.error('[AA] Staging result invalid:', stagingResult);
        res.status(500).json({ 
          error: 'Staging session creation returned invalid response',
          details: stagingResult.error || 'No session ID returned'
        });
        return;
      }

      res.json({
        success: true,
        mode: 'staging',
        stagingSessionId: stagingResult.sessionId,
        holdingsCount: allHoldings.length,
        requiresReview: true,
        summary: {
          mutualFundsCount: fetchResult.aggregatedData?.mutualFunds?.length || 0,
          dematHoldingsCount: fetchResult.aggregatedData?.dematHoldings?.length || 0,
          npsCount: fetchResult.aggregatedData?.nps?.length || 0,
          epfCount: fetchResult.aggregatedData?.epf?.length || 0,
          ppfCount: fetchResult.aggregatedData?.ppf?.length || 0,
          loansCount: fetchResult.aggregatedData?.loans?.length || 0,
          fetchedAt: new Date().toISOString(),
        }
      });
    } else {
      // Direct sync mode (legacy flow or auto-sync)
      const clearResult = await kycPortfolioMigrationService.onAutoSyncRefresh(userId, 'all');
      console.log(`[AA] Cleared ${clearResult.clearedCount} holdings before fetch`);

      let [portfolio] = await db
        .select()
        .from(portfolios)
        .where(eq(portfolios.userId, userId))
        .limit(1);

      if (!portfolio) {
        [portfolio] = await db.insert(portfolios).values({
          userId,
          name: 'Primary Portfolio',
          isDefault: true,
        }).returning();
      }

      let totalStored = 0;
      const mfHoldings = allHoldings.filter(h => h.source === 'aa_mf');
      const dematHoldings = allHoldings.filter(h => h.source === 'aa_demat');

      if (mfHoldings.length) {
        totalStored += await kycPortfolioMigrationService.storeAAFetchedHoldings(
          userId, portfolio.id, mfHoldings, 'aa_mf'
        );
      }

      if (dematHoldings.length) {
        totalStored += await kycPortfolioMigrationService.storeAAFetchedHoldings(
          userId, portfolio.id, dematHoldings, 'aa_demat'
        );
      }

      res.json({
        success: true,
        mode: 'direct',
        clearedCount: clearResult.clearedCount,
        storedCount: totalStored,
        requiresReview: false,
        summary: {
          mutualFundsCount: fetchResult.aggregatedData?.mutualFunds?.length || 0,
          dematHoldingsCount: fetchResult.aggregatedData?.dematHoldings?.length || 0,
          fetchedAt: new Date().toISOString(),
        }
      });
    }
  } catch (error: unknown) {
    console.error('[AA] Error fetching data:', error);
    res.status(500).json({ error: errorMessage(error) });
  }
});

/**
 * POST /api/aa/callback
 * Callback from AA portal after user approves consent
 */
router.post('/callback', async (req: Request, res: Response): Promise<void> => {
  try {
    const { consentHandleId, status } = req.body as { consentHandleId?: string; status?: string; userId?: string };

    console.log(`[AA] Consent callback: ${consentHandleId} - ${status}`);

    if (status === 'APPROVED') {
      // Update consent session status
      await db.update(aaConsentSessions)
        .set({ 
          status: 'active',
          updatedAt: new Date()
        })
        .where(eq(aaConsentSessions.consentHandleId, consentHandleId || ''));

      res.json({ success: true, status: 'consent_approved' });
    } else {
      await db.update(aaConsentSessions)
        .set({ 
          status: 'rejected',
          updatedAt: new Date()
        })
        .where(eq(aaConsentSessions.consentHandleId, consentHandleId || ''));

      res.json({ success: false, status: 'consent_rejected' });
    }
  } catch (error: unknown) {
    console.error('[AA] Callback error:', error);
    res.status(500).json({ error: errorMessage(error) });
  }
});

/**
 * GET /api/aa/holdings/summary
 * Get summary of holdings from unified reader
 */
router.get('/holdings/summary', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.query.userId as string;
    
    if (!userId) {
      res.status(400).json({ error: 'userId is required' });
      return;
    }

    const summary = await unifiedHoldingsReaderService.getPortfolioSummary(userId);
    const clientType = await unifiedHoldingsReaderService.getClientType(userId);

    res.json({
      ...summary,
      clientType: {
        isProspect: clientType.isProspect,
        isRegistered: clientType.isRegistered,
        hasAAConsent: clientType.hasAAConsent,
        autoSyncEnabled: clientType.autoSyncEnabled,
      }
    });
  } catch (error: unknown) {
    console.error('[AA] Error getting holdings summary:', error);
    res.status(500).json({ error: errorMessage(error) });
  }
});

/**
 * POST /api/aa/consent/revoke
 * Revoke an active consent session
 */
router.post('/consent/revoke', async (req: Request, res: Response): Promise<void> => {
  try {
    const { consentSessionId, userId, reason } = req.body as { consentSessionId?: string; userId?: string; reason?: string };

    if (!consentSessionId || !userId) {
      res.status(400).json({ error: 'consentSessionId and userId are required' });
      return;
    }

    await db.update(aaConsentSessions)
      .set({ 
        status: 'revoked',
        updatedAt: new Date()
      })
      .where(and(
        eq(aaConsentSessions.id, consentSessionId),
        eq(aaConsentSessions.userId, userId)
      ));

    // Record revocation in audit
    await db.insert(dataSourceConsents).values({
      userId: userId,
      dataSource: 'all',
      provider: 'account_aggregator',
      consentGiven: false,
      consentPurpose: 'consent_revocation',
      consentText: `User revoked AA consent. Reason: ${reason || 'User requested'}`,
      ipAddress: req.ip || '',
      userAgent: req.get('user-agent') || '',
    } as any);

    res.json({ success: true, message: 'Consent revoked successfully' });
  } catch (error: unknown) {
    console.error('[AA] Error revoking consent:', error);
    res.status(500).json({ error: errorMessage(error) });
  }
});

export default router;
