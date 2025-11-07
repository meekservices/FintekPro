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

const router = Router();

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
router.post("/fetch/loans", async (req: Request, res: Response) => {
  try {
    const sessionUserId = req.session.user.id;
    
    // TODO: Verify that the provided PAN/DOB belongs to the authenticated user
    // This should query kycVault to confirm ownership before making CIBIL API call
    // For now, we're passing through to CIBIL API (accepts any PAN - NOT production ready)
    
    console.warn(`⚠️ SECURITY WARNING: CIBIL loan fetch for user ${sessionUserId} without PAN ownership verification`);
    
    // Pass through to CIBIL API
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
