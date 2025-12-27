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
import { kycVault, users } from '@shared/schema';
import { eq, sql } from 'drizzle-orm';
import { encryptionService } from './encryption-service';
import { tokenizationService } from './services/tokenization-service';

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

// ===== ADMIN/SETUP ENDPOINTS (Development Only - No Auth) =====

// Setup KYC vault from verified PAN and trigger auto-population
// SECURITY: Only available in development mode, no auth required
router.post("/admin/setup-from-pan", async (req: Request, res: Response) => {
  try {
    // Security check: Only allow in development mode
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({
        success: false,
        error: 'This endpoint is only available in development mode'
      });
    }

    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: "userId is required"
      });
    }

    console.log(`🔧 [Admin] Setting up auto-population for user: ${userId}`);

    // Step 1: Get verified PAN record using raw SQL
    const panRecords = await db.execute(sql`
      SELECT id, user_id, pan_number, full_name, date_of_birth, pan_type, verified, verified_at, verification_source
      FROM pan_verification_records
      WHERE user_id = ${userId}
      AND verified = true
      LIMIT 1
    `);

    if (!panRecords.rows || panRecords.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No verified PAN record found for this user'
      });
    }

    const rawPanRecord = panRecords.rows[0] as {
      id: string;
      user_id: string;
      pan_number: string;
      full_name: string;
      date_of_birth: string;
      pan_type: string;
      verified: boolean;
      verified_at: string | Date;
      verification_source: string;
    };
    
    // Convert verified_at to Date if it's a string (raw SQL returns strings)
    const panRecord = {
      ...rawPanRecord,
      verified_at: rawPanRecord.verified_at instanceof Date 
        ? rawPanRecord.verified_at 
        : new Date(rawPanRecord.verified_at)
    };

    // Step 2: Get user details
    const userRecords = await db.select().from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (userRecords.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const user = userRecords[0];

    // Step 3: Check if vault already exists
    const existingVault = await db.select().from(kycVault)
      .where(eq(kycVault.userId, userId))
      .limit(1);

    if (existingVault.length > 0) {
      console.log(`📋 KYC Vault already exists for user ${userId}, skipping vault creation`);
    } else {
      // Step 4: Create KYC vault entry with encrypted data
      console.log(`🔐 Creating KYC Vault for user ${userId}...`);
      
      const encryptedFullName = encryptionService.encrypt(panRecord.full_name || '');
      const encryptedDob = encryptionService.encrypt(panRecord.date_of_birth || '');
      const encryptedMobile = user.mobile ? encryptionService.encrypt(user.mobile) : null;
      const encryptedEmail = user.email ? encryptionService.encrypt(user.email) : null;
      
      // Tokenize PAN
      const tokenResult = await tokenizationService.tokenize(
        panRecord.pan_number,
        'pan',
        userId
      );

      const kycExpiryDate = new Date();
      kycExpiryDate.setFullYear(kycExpiryDate.getFullYear() + 2);

      await db.insert(kycVault).values({
        userId,
        encryptedFullName,
        encryptedDateOfBirth: encryptedDob,
        encryptedMobile,
        encryptedEmail,
        tokenizedPan: tokenResult.success ? tokenResult.token : null,
        kycStatus: 'verified',
        source: 'pan_verification',
        verificationMethod: 'pan_api',
        panVerifiedAt: panRecord.verified_at,
        kycVerifiedAt: new Date(),
        kycExpiryDate,
        isExpired: false
      });

      console.log(`✅ KYC Vault created for user ${userId}`);
    }

    // Step 5: Grant all consents
    console.log(`📋 Granting all data source consents for user ${userId}...`);
    const consents = await consentManagementService.grantAllConsents(
      userId,
      req.ip,
      req.headers['user-agent']
    );
    console.log(`✅ Granted ${consents.length} consents`);

    // Step 6: Trigger auto-population
    console.log(`🚀 Initiating auto-population workflow for user ${userId}...`);
    const result = await autoPopulationOrchestrator.initiateFromKYC(
      userId,
      'kyc_completion'
    );

    res.json({
      success: true,
      message: 'Auto-population setup completed',
      panVerified: true,
      panDetails: {
        pan: panRecord.pan_number.substring(0, 4) + '****' + panRecord.pan_number.slice(-1),
        name: panRecord.full_name,
        dob: panRecord.date_of_birth,
        verifiedAt: panRecord.verified_at
      },
      consentsGranted: consents.length,
      autoPopulationResult: result
    });
  } catch (error: any) {
    console.error('Error in admin setup:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to complete auto-population setup'
    });
  }
});

// Apply authentication to all remaining routes
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

// Retry a single failed data source
router.post("/retry-source", async (req: Request, res: Response) => {
  try {
    // Get userId from session for security - don't rely on client-provided userId
    const sessionUserId = req.session?.user?.id;
    const { dataSource } = req.body;
    
    if (!sessionUserId) {
      return res.status(401).json({
        success: false,
        error: "Authentication required"
      });
    }
    
    if (!dataSource) {
      return res.status(400).json({
        success: false,
        error: "dataSource is required"
      });
    }
    
    const userId = sessionUserId;

    // Validate data source
    const validSources = ['mutual_funds', 'demat', 'bank', 'loans', 'insurance', 'epf', 'nps', 'apy'];
    if (!validSources.includes(dataSource)) {
      return res.status(400).json({
        success: false,
        error: `Invalid data source. Must be one of: ${validSources.join(', ')}`
      });
    }

    // Check if user has consent for this data source
    const hasConsent = await consentManagementService.hasValidConsent(userId, dataSource);
    if (!hasConsent) {
      return res.status(400).json({
        success: false,
        error: `No valid consent for ${dataSource}. Please grant consent first.`,
        errorSuggestion: 'Grant consent for this data source before retrying.'
      });
    }

    // Retry fetch for the specific data source
    const result = await autoPopulationOrchestrator.retryDataSource(userId, dataSource);

    res.json({
      success: true,
      message: `Retry initiated for ${dataSource}`,
      result
    });
  } catch (error: any) {
    console.error('Error retrying data source:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to retry data source'
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
