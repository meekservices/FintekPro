/**
 * Auto-Population API Routes
 * 
 * Endpoints for post-KYC auto-population system:
 * - Consent management
 * - Workflow initiation and tracking
 * - Data source integration
 */

import { Router, Request, Response } from 'express';
import { consentManagementService } from './services/consent-management-service';
import { autoPopulationOrchestrator } from './services/auto-population-orchestrator';
import { CibilAPI } from './cibil-api';
import { db } from './db';
import { dataSourceConsents } from '@shared/schema';
import { eq } from 'drizzle-orm';
import rateLimit from 'express-rate-limit';

const router = Router();

// Per-user rate limiting for sensitive data fetch endpoints
// Applied after session middleware so req.session.user is available
const loanFetchLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes  
  max: 10, // Limit each user to 10 requests per 15 minutes
  message: { 
    success: false,
    error: "Too many loan fetch attempts. Please try again in 15 minutes."
  },
  standardHeaders: true,
  legacyHeaders: false,
  // CRITICAL: Key by authenticated user ID to prevent DOB brute-force per user
  keyGenerator: (req: Request) => {
    const userId = req.session?.user?.id;
    if (!userId) {
      console.warn('⚠️ Rate limiter: No user session found, falling back to IP');
      return `ip:${req.ip || 'unknown'}`;
    }
    return `user:${userId}`;
  },
  // Log when rate limit is hit for security monitoring
  handler: (req: Request, res: Response) => {
    const userId = req.session?.user?.id || 'anonymous';
    console.warn(`🚨 RATE LIMIT: User ${userId} exceeded loan fetch limit from IP ${req.ip}`);
    res.status(429).json({
      success: false,
      error: "Too many loan fetch attempts. Please try again in 15 minutes."
    });
  }
});

// Authentication middleware - ensure user is logged in
const requireAuth = (req: Request, res: Response, next: Function) => {
  if (!req.session?.user?.id) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized. Please log in to access this resource.'
    });
  }
  next();
};

// Authorization middleware - ensure user owns the resource
const requireOwnership = (userIdParam: string) => {
  return (req: Request, res: Response, next: Function) => {
    const userId = req.params[userIdParam] || req.body[userIdParam];
    if (userId && userId !== req.session.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden. You can only access your own resources.'
      });
    }
    next();
  };
};

// Apply authentication to all routes
router.use(requireAuth);

// ===== CONSENT MANAGEMENT ENDPOINTS =====

// Grant consent for a specific data source
router.post("/consent/grant", requireOwnership('userId'), async (req: Request, res: Response) => {
  try {
    const { userId, dataSource, provider, consentPurpose, syncFrequency, validityDays } = req.body;
    
    if (!userId || !dataSource || !consentPurpose) {
      return res.status(400).json({
        success: false,
        error: "userId, dataSource, and consentPurpose are required"
      });
    }

    const consent = await consentManagementService.grantConsent({
      userId,
      dataSource,
      provider,
      consentPurpose,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      syncFrequency,
      validityDays
    });

    res.json({
      success: true,
      message: `Consent granted for ${dataSource}`,
      consent
    });
  } catch (error: any) {
    console.error('Error granting consent:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to grant consent'
    });
  }
});

// Check consent status for a data source
router.get("/consent/check/:userId/:dataSource", requireOwnership('userId'), async (req: Request, res: Response) => {
  try {
    const { userId, dataSource } = req.params;
    
    const consentStatus = await consentManagementService.checkConsent(userId, dataSource as any);

    res.json({
      success: true,
      consentStatus
    });
  } catch (error: any) {
    console.error('Error checking consent:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to check consent'
    });
  }
});

// Get all consents for a user
router.get("/consent/user/:userId", requireOwnership('userId'), async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    
    const consents = await consentManagementService.getUserConsents(userId);

    res.json({
      success: true,
      totalConsents: consents.length,
      consents
    });
  } catch (error: any) {
    console.error('Error fetching user consents:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch consents'
    });
  }
});

// Revoke consent
router.post("/consent/revoke", async (req: Request, res: Response) => {
  try {
    const { consentId, reason } = req.body;
    const sessionUserId = req.session.user.id;
    
    if (!consentId || !reason) {
      return res.status(400).json({
        success: false,
        error: "consentId and reason are required"
      });
    }

    // Ownership check: Verify the consent belongs to the authenticated user
    const consents = await consentManagementService.getUserConsents(sessionUserId);
    const consentToRevoke = consents.find(c => c.id === consentId);
    
    if (!consentToRevoke) {
      return res.status(404).json({
        success: false,
        error: 'Consent not found or does not belong to you'
      });
    }

    await consentManagementService.revokeConsent(consentId, reason);

    res.json({
      success: true,
      message: 'Consent revoked successfully'
    });
  } catch (error: any) {
    console.error('Error revoking consent:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to revoke consent'
    });
  }
});

// Grant all consents (bulk operation for post-KYC)
router.post("/consent/grant-all", requireOwnership('userId'), async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: "userId is required"
      });
    }

    const consents = await consentManagementService.grantAllConsents(
      userId,
      req.ip,
      req.headers['user-agent']
    );

    res.json({
      success: true,
      message: 'All consents granted successfully',
      totalConsents: consents.length,
      consents
    });
  } catch (error: any) {
    console.error('Error granting all consents:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to grant all consents'
    });
  }
});

// Renew all expired consents
router.post("/consent/renew-all", requireOwnership('userId'), async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: "userId is required"
      });
    }

    // Get all consents for this user (including expired)
    const allConsents = await db
      .select()
      .from(dataSourceConsents)
      .where(eq(dataSourceConsents.userId, userId));
    
    // Filter for expired consents
    const now = new Date();
    const expiredConsents = allConsents.filter(consent => {
      const isExpired = consent.expiresAt && new Date(consent.expiresAt) < now;
      return isExpired;
    });
    
    if (expiredConsents.length === 0) {
      return res.json({
        success: true,
        message: 'No expired consents to renew',
        renewedCount: 0
      });
    }

    // Renew each expired consent (extend expiry by 90 days)
    const renewedConsents = [];
    for (const consent of expiredConsents) {
      const renewed = await consentManagementService.renewConsent(
        userId,
        consent.id,
        90 // Default 90 days validity
      );
      renewedConsents.push(renewed);
    }

    res.json({
      success: true,
      message: `Successfully renewed ${renewedConsents.length} consent(s)`,
      renewedCount: renewedConsents.length,
      consents: renewedConsents
    });
  } catch (error: any) {
    console.error('Error renewing consents:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to renew consents'
    });
  }
});

// Get consents expiring soon
router.get("/consent/expiring/:userId", requireOwnership('userId'), async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    
    const expiringConsents = await consentManagementService.getExpiringConsents(userId);

    res.json({
      success: true,
      totalExpiring: expiringConsents.length,
      consents: expiringConsents
    });
  } catch (error: any) {
    console.error('Error fetching expiring consents:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch expiring consents'
    });
  }
});

// ===== AUTO-POPULATION WORKFLOW ENDPOINTS =====

// Initiate auto-population workflow
router.post("/initiate", requireOwnership('userId'), async (req: Request, res: Response) => {
  try {
    const { userId, triggeredBy } = req.body;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: "userId is required"
      });
    }

    const result = await autoPopulationOrchestrator.initiateFromKYC(
      userId,
      triggeredBy || 'manual_refresh'
    );

    res.json({
      success: true,
      message: 'Auto-population workflow initiated',
      result
    });
  } catch (error: any) {
    console.error('Error initiating auto-population:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to initiate auto-population'
    });
  }
});

// Get workflow status
router.get("/status/:workflowId", async (req: Request, res: Response) => {
  try {
    const { workflowId } = req.params;
    const sessionUserId = req.session.user.id;
    
    const status = await autoPopulationOrchestrator.getWorkflowStatus(workflowId);

    if (!status) {
      return res.status(404).json({
        success: false,
        error: 'Workflow not found'
      });
    }

    // Ownership check: Ensure workflow belongs to the authenticated user
    if (status.userId !== sessionUserId) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden. You can only view your own workflows.'
      });
    }

    res.json({
      success: true,
      status
    });
  } catch (error: any) {
    console.error('Error fetching workflow status:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch workflow status'
    });
  }
});

// Get all workflows for a user
router.get("/workflows/:userId", requireOwnership('userId'), async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    
    const workflows = await autoPopulationOrchestrator.getUserWorkflows(userId);

    res.json({
      success: true,
      totalWorkflows: workflows.length,
      workflows
    });
  } catch (error: any) {
    console.error('Error fetching user workflows:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch workflows'
    });
  }
});

// Manual refresh (re-trigger auto-population)
router.post("/refresh", requireOwnership('userId'), async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: "userId is required"
      });
    }

    const result = await autoPopulationOrchestrator.initiateFromKYC(userId, 'manual_refresh');

    res.json({
      success: true,
      message: 'Manual refresh initiated',
      result
    });
  } catch (error: any) {
    console.error('Error refreshing auto-population:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to refresh auto-population'
    });
  }
});

// ===== PORTFOLIO SUMMARY ENDPOINT =====

// Get portfolio summary for user
router.get("/summary/:userId", requireOwnership('userId'), async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    
    // Import db and schema
    const { db } = await import('./db');
    const { comprehensiveHoldings, autoPopulationStatus } = await import('@shared/schema');
    const { eq, desc, sql } = await import('drizzle-orm');
    
    // Get last sync status
    const lastSync = await db
      .select()
      .from(autoPopulationStatus)
      .where(eq(autoPopulationStatus.userId, userId))
      .orderBy(desc(autoPopulationStatus.completedAt))
      .limit(1);
    
    const lastSyncData = lastSync.length > 0 ? lastSync[0] : null;
    
    // Get portfolio holdings with aggregations
    const holdings = await db
      .select()
      .from(comprehensiveHoldings)
      .where(eq(comprehensiveHoldings.userId, userId));
    
    // Calculate totals and asset allocation
    let totalMarketValue = 0;
    let totalInvestedValue = 0;
    let totalGainLoss = 0;
    const assetTypeBreakdown: Record<string, { value: number; count: number }> = {};
    const dataSourceBreakdown: Record<string, { value: number; count: number }> = {};
    
    holdings.forEach(holding => {
      const marketValue = holding.marketValue ? parseFloat(holding.marketValue.toString()) : 0;
      const investedValue = holding.investedValue ? parseFloat(holding.investedValue.toString()) : 0;
      const gainLoss = holding.gainLoss ? parseFloat(holding.gainLoss.toString()) : 0;
      
      totalMarketValue += marketValue;
      totalInvestedValue += investedValue;
      totalGainLoss += gainLoss;
      
      // Asset type breakdown
      const assetType = holding.assetType || 'other';
      if (!assetTypeBreakdown[assetType]) {
        assetTypeBreakdown[assetType] = { value: 0, count: 0 };
      }
      assetTypeBreakdown[assetType].value += marketValue;
      assetTypeBreakdown[assetType].count += 1;
      
      // Data source breakdown
      const dataSource = holding.dataSource || 'unknown';
      if (!dataSourceBreakdown[dataSource]) {
        dataSourceBreakdown[dataSource] = { value: 0, count: 0 };
      }
      dataSourceBreakdown[dataSource].value += marketValue;
      dataSourceBreakdown[dataSource].count += 1;
    });
    
    const gainLossPercent = totalInvestedValue > 0 
      ? ((totalGainLoss / totalInvestedValue) * 100) 
      : 0;
    
    res.json({
      success: true,
      summary: {
        totalMarketValue,
        totalInvestedValue,
        totalGainLoss,
        gainLossPercent,
        totalHoldings: holdings.length,
        assetTypeBreakdown,
        dataSourceBreakdown,
        lastSync: lastSyncData ? {
          workflowId: lastSyncData.workflowId,
          status: lastSyncData.status,
          completedAt: lastSyncData.completedAt,
          totalRecordsFetched: lastSyncData.totalRecordsFetched,
          successfulSources: lastSyncData.successfulSources,
          totalDataSources: lastSyncData.totalDataSources,
          durationMs: lastSyncData.durationMs
        } : null
      }
    });
  } catch (error: any) {
    console.error('Error fetching portfolio summary:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch portfolio summary'
    });
  }
});

// ===== DATA SOURCE SPECIFIC ENDPOINTS =====

// Fetch loan liabilities from CIBIL
// Security: This endpoint accepts PAN/name/DOB, so we must ensure the user can only fetch their own data
// Rate limited to prevent DOB brute-force attacks (10 requests per 15 min per user)
router.post("/fetch/loans", loanFetchLimiter, async (req: Request, res: Response) => {
  try {
    const sessionUserId = req.session.user.id;
    const { panNumber, dateOfBirth } = req.body;
    
    if (!panNumber || !dateOfBirth) {
      return res.status(400).json({
        success: false,
        error: 'PAN number and Date of Birth are required'
      });
    }
    
    // SECURITY: Verify that the provided PAN/DOB belongs to the authenticated user
    const { kycVaultDecryptionService } = await import('./services/kyc-vault-decryption-service');
    
    const decryptResult = await kycVaultDecryptionService.decryptVaultData(sessionUserId, {
      purpose: 'auto_population',
      requestId: `loan-fetch-${Date.now()}`,
      externalParty: 'CIBIL',
      fieldsRequired: ['pan', 'dateOfBirth'],
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });
    
    if (!decryptResult.success || !decryptResult.data) {
      console.error(`❌ KYC vault access failed for user ${sessionUserId}`);
      return res.status(403).json({
        success: false,
        error: 'Unable to verify KYC data. Please complete KYC verification first.'
      });
    }
    
    // Verify PAN ownership
    if (decryptResult.data.pan !== panNumber.toUpperCase()) {
      console.warn(`🚨 SECURITY ALERT: User ${sessionUserId} attempted to fetch loans with non-owned PAN: ${panNumber}`);
      return res.status(403).json({
        success: false,
        error: 'The provided PAN number does not match your verified KYC records.'
      });
    }
    
    // Verify DOB ownership
    if (decryptResult.data.dateOfBirth !== dateOfBirth) {
      console.warn(`🚨 SECURITY ALERT: User ${sessionUserId} attempted to fetch loans with incorrect DOB`);
      return res.status(403).json({
        success: false,
        error: 'The provided Date of Birth does not match your verified KYC records.'
      });
    }
    
    console.log(`✅ PAN/DOB ownership verified for user ${sessionUserId}`);
    
    // Pass through to CIBIL API after verification
    return CibilAPI.fetchLoanLiabilities(req, res);
  } catch (error: any) {
    console.error('Error fetching loans:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch loan liabilities'
    });
  }
});

export { router as autoPopulationRouter };
