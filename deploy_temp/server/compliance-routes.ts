/**
 * SEBI Compliance API Routes
 * 
 * Comprehensive API endpoints for:
 * - SEBI compliance status and checks
 * - Demat account compliance
 * - PMLA audit logging and monitoring
 * - Order retention and archival
 * - FATCA/CRS compliance management
 */

import { Router, Request, Response } from 'express';
import { sebiComplianceService } from './services/sebi-compliance-service';
import { dematComplianceService } from './services/demat-compliance-service';
import { pmlaAuditService } from './services/pmla-audit-service';
import { orderRetentionService } from './services/order-retention-service';
import { fatcaCrsService } from './services/fatca-crs-service';
import { db } from './db';
import { sebiDepositoryParticipants, insertSebiDepositoryParticipantSchema } from '@shared/schema';
import { eq, like, or, sql, desc } from 'drizzle-orm';

const router = Router();

// ==================== SEBI COMPLIANCE ENDPOINTS ====================

/**
 * Get comprehensive SEBI compliance status for a user
 */
router.get('/sebi/status/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const status = await sebiComplianceService.checkComplianceStatus(userId);
    res.json({ success: true, data: status });
  } catch (error: any) {
    console.error('[Compliance API] SEBI status error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Assess product suitability for a user
 */
router.post('/sebi/suitability', async (req: Request, res: Response) => {
  try {
    const { userId, productCategory, investmentAmount } = req.body;
    
    if (!userId || !productCategory || !investmentAmount) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: userId, productCategory, investmentAmount' 
      });
    }

    const result = await sebiComplianceService.assessProductSuitability(
      userId, 
      productCategory, 
      parseFloat(investmentAmount)
    );
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('[Compliance API] Suitability assessment error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Calculate margin requirements
 */
router.post('/sebi/margin', async (req: Request, res: Response) => {
  try {
    const { userId, productType, orderValue, orderType } = req.body;
    
    if (!userId || !productType || !orderValue) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: userId, productType, orderValue' 
      });
    }

    const result = await sebiComplianceService.calculateMarginRequirement(
      userId, 
      productType, 
      parseFloat(orderValue),
      orderType || 'buy'
    );
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('[Compliance API] Margin calculation error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Validate debt listing compliance
 */
router.post('/sebi/debt-listing', async (req: Request, res: Response) => {
  try {
    const { isin, bondData } = req.body;
    
    if (!isin || !bondData) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: isin, bondData' 
      });
    }

    const result = await sebiComplianceService.validateDebtListingCompliance(isin, bondData);
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('[Compliance API] Debt listing validation error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Generate compliance report
 */
router.post('/sebi/report', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, reportType } = req.body;
    
    if (!startDate || !endDate || !reportType) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: startDate, endDate, reportType' 
      });
    }

    const result = await sebiComplianceService.generateComplianceReport(
      new Date(startDate),
      new Date(endDate),
      reportType
    );
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('[Compliance API] Report generation error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get SEBI regulations reference
 */
router.get('/sebi/regulations', async (req: Request, res: Response) => {
  try {
    const regulations = sebiComplianceService.getRegulations();
    const marginRequirements = sebiComplianceService.getMarginRequirements();
    res.json({ 
      success: true, 
      data: { regulations, marginRequirements } 
    });
  } catch (error: any) {
    console.error('[Compliance API] Regulations fetch error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== DEMAT COMPLIANCE ENDPOINTS ====================

/**
 * Validate depository participant
 */
router.get('/demat/validate-dp/:dpId', async (req: Request, res: Response) => {
  try {
    const { dpId } = req.params;
    const result = await dematComplianceService.validateDP(dpId);
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('[Compliance API] DP validation error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Validate demat account
 */
router.post('/demat/validate-account', async (req: Request, res: Response) => {
  try {
    const { accountNumber, depository } = req.body;
    
    if (!accountNumber || !depository) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: accountNumber, depository' 
      });
    }

    const result = await dematComplianceService.validateDematAccount(accountNumber, depository);
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('[Compliance API] Demat account validation error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Verify beneficial owner
 */
router.post('/demat/verify-bo', async (req: Request, res: Response) => {
  try {
    const { userId, dematAccountNumber, panNumber } = req.body;
    
    if (!userId || !dematAccountNumber || !panNumber) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: userId, dematAccountNumber, panNumber' 
      });
    }

    const result = await dematComplianceService.verifyBeneficialOwner(
      userId, 
      dematAccountNumber, 
      panNumber
    );
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('[Compliance API] BO verification error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Authorize transaction (EDIS)
 */
router.post('/demat/authorize-transaction', async (req: Request, res: Response) => {
  try {
    const { userId, transactionType, isin, quantity, dematAccountNumber } = req.body;
    
    if (!userId || !transactionType || !isin || !quantity || !dematAccountNumber) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields' 
      });
    }

    const result = await dematComplianceService.authorizeTransaction(
      userId,
      transactionType,
      isin,
      parseInt(quantity),
      dematAccountNumber
    );
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('[Compliance API] Transaction authorization error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Verify holdings
 */
router.get('/demat/holdings/:userId/:isin', async (req: Request, res: Response) => {
  try {
    const { userId, isin } = req.params;
    const result = await dematComplianceService.verifyHoldings(userId, isin);
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('[Compliance API] Holdings verification error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Validate nominee compliance
 */
router.get('/demat/nominee/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const result = await dematComplianceService.validateNomineeCompliance(userId);
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('[Compliance API] Nominee validation error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Generate demat compliance report
 */
router.get('/demat/report/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const result = await dematComplianceService.generateComplianceReport(userId);
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('[Compliance API] Demat report error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== PMLA AUDIT ENDPOINTS ====================

/**
 * Monitor transaction for PMLA compliance
 */
router.post('/pmla/monitor', async (req: Request, res: Response) => {
  try {
    const { userId, transactionId, amount, currency, transactionType, sourceCountry, destinationCountry } = req.body;
    
    if (!userId || !transactionId || !amount || !currency || !transactionType) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields' 
      });
    }

    const result = await pmlaAuditService.monitorTransaction({
      userId,
      transactionId,
      amount: parseFloat(amount),
      currency,
      transactionType,
      sourceCountry,
      destinationCountry,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('[Compliance API] PMLA monitoring error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Log CDD event
 */
router.post('/pmla/cdd', async (req: Request, res: Response) => {
  try {
    const { userId, cddType, outcome, riskCategory, findings, nextReviewDate } = req.body;
    
    if (!userId || !cddType || !outcome || !riskCategory) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields' 
      });
    }

    const eventId = await pmlaAuditService.logCDDEvent({
      userId,
      cddType,
      outcome,
      riskCategory,
      findings: findings || [],
      nextReviewDate: new Date(nextReviewDate || Date.now() + 365 * 24 * 60 * 60 * 1000),
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });
    res.json({ success: true, data: { eventId } });
  } catch (error: any) {
    console.error('[Compliance API] CDD logging error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Log EDD event
 */
router.post('/pmla/edd', async (req: Request, res: Response) => {
  try {
    const { userId, eddReason, measures, outcome, reviewedBy, findings } = req.body;
    
    if (!userId || !eddReason || !outcome || !reviewedBy) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields' 
      });
    }

    const eventId = await pmlaAuditService.logEDDEvent({
      userId,
      eddReason,
      measures: measures || [],
      outcome,
      reviewedBy,
      findings: findings || [],
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });
    res.json({ success: true, data: { eventId } });
  } catch (error: any) {
    console.error('[Compliance API] EDD logging error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Generate FIU report
 */
router.post('/pmla/fiu-report', async (req: Request, res: Response) => {
  try {
    const { userId, reportType, transactionIds, suspicionIndicators } = req.body;
    
    if (!userId || !reportType || !transactionIds) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields' 
      });
    }

    const report = await pmlaAuditService.generateFIUReport({
      userId,
      reportType,
      transactionIds,
      suspicionIndicators: suspicionIndicators || []
    });
    res.json({ success: true, data: report });
  } catch (error: any) {
    console.error('[Compliance API] FIU report error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get audit history
 */
router.get('/pmla/history/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { startDate, endDate, eventType, limit } = req.query;
    
    const history = await pmlaAuditService.getAuditHistory(userId, {
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      eventType: eventType as any,
      limit: limit ? parseInt(limit as string) : undefined
    });
    res.json({ success: true, data: history });
  } catch (error: any) {
    console.error('[Compliance API] Audit history error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get PMLA thresholds
 */
router.get('/pmla/thresholds', async (req: Request, res: Response) => {
  try {
    const thresholds = pmlaAuditService.getThresholds();
    const highRiskCountries = pmlaAuditService.getHighRiskCountries();
    res.json({ success: true, data: { thresholds, highRiskCountries } });
  } catch (error: any) {
    console.error('[Compliance API] Thresholds fetch error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== ORDER RETENTION ENDPOINTS ====================

/**
 * Archive a specific order
 */
router.post('/retention/archive/:orderId', async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const result = await orderRetentionService.archiveOrder(orderId);
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('[Compliance API] Order archive error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Bulk archive old orders
 */
router.post('/retention/archive-bulk', async (req: Request, res: Response) => {
  try {
    const { olderThanDays } = req.body;
    const result = await orderRetentionService.archiveOldOrders(olderThanDays || 90);
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('[Compliance API] Bulk archive error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Retrieve archived order
 */
router.get('/retention/retrieve/:orderId', async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const result = await orderRetentionService.retrieveArchivedOrder(orderId);
    
    if (!result) {
      return res.status(404).json({ success: false, error: 'Archived order not found' });
    }
    
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('[Compliance API] Order retrieval error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Process regulatory request
 */
router.post('/retention/regulatory-request', async (req: Request, res: Response) => {
  try {
    const { requestType, requestedBy, userId, orderIds, dateRange } = req.body;
    
    if (!requestType || !requestedBy) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: requestType, requestedBy' 
      });
    }

    const result = await orderRetentionService.processRegulatoryRequest({
      requestId: `REQ-${Date.now()}`,
      requestType,
      requestedBy,
      requestDate: new Date(),
      userId,
      orderIds,
      dateRange: dateRange ? {
        start: new Date(dateRange.start),
        end: new Date(dateRange.end)
      } : undefined
    });
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('[Compliance API] Regulatory request error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get retention statistics
 */
router.get('/retention/statistics', async (req: Request, res: Response) => {
  try {
    const stats = await orderRetentionService.getRetentionStatistics();
    res.json({ success: true, data: stats });
  } catch (error: any) {
    console.error('[Compliance API] Retention stats error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Verify archive integrity
 */
router.get('/retention/verify/:archiveId', async (req: Request, res: Response) => {
  try {
    const { archiveId } = req.params;
    const result = await orderRetentionService.verifyArchiveIntegrity(archiveId);
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('[Compliance API] Archive verification error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Cleanup expired archives
 */
router.post('/retention/cleanup', async (req: Request, res: Response) => {
  try {
    const result = await orderRetentionService.cleanupExpiredArchives();
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('[Compliance API] Cleanup error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get retention policies
 */
router.get('/retention/policies', async (req: Request, res: Response) => {
  try {
    const policies = orderRetentionService.getRetentionPolicies();
    res.json({ success: true, data: policies });
  } catch (error: any) {
    console.error('[Compliance API] Policies fetch error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== FATCA/CRS ENDPOINTS ====================

/**
 * Get FATCA status
 */
router.get('/fatca/status/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const status = await fatcaCrsService.getFATCAStatus(userId);
    res.json({ success: true, data: status });
  } catch (error: any) {
    console.error('[Compliance API] FATCA status error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get CRS status
 */
router.get('/crs/status/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const status = await fatcaCrsService.getCRSStatus(userId);
    res.json({ success: true, data: status });
  } catch (error: any) {
    console.error('[Compliance API] CRS status error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Submit self-certification
 */
router.post('/fatca-crs/self-certification', async (req: Request, res: Response) => {
  try {
    const { userId, formType, taxResidencies, isUSPerson, usIndicia, documentUrl } = req.body;
    
    if (!userId || !formType || !taxResidencies) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields' 
      });
    }

    const form = await fatcaCrsService.submitSelfCertification({
      userId,
      formType,
      taxResidencies,
      isUSPerson: isUSPerson || false,
      usIndicia: usIndicia || [],
      documentUrl
    });
    res.json({ success: true, data: form });
  } catch (error: any) {
    console.error('[Compliance API] Self-certification error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Check US indicia
 */
router.get('/fatca/us-indicia/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const result = await fatcaCrsService.checkUSIndicia(userId);
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('[Compliance API] US indicia check error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Generate CRS report
 */
router.post('/crs/report', async (req: Request, res: Response) => {
  try {
    const { reportYear, reportingJurisdiction } = req.body;
    
    if (!reportYear || !reportingJurisdiction) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: reportYear, reportingJurisdiction' 
      });
    }

    const report = await fatcaCrsService.generateCRSReport(
      parseInt(reportYear),
      reportingJurisdiction
    );
    res.json({ success: true, data: report });
  } catch (error: any) {
    console.error('[Compliance API] CRS report error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get comprehensive compliance summary
 */
router.get('/fatca-crs/summary/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const summary = await fatcaCrsService.getComplianceSummary(userId);
    res.json({ success: true, data: summary });
  } catch (error: any) {
    console.error('[Compliance API] Compliance summary error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get participating jurisdictions
 */
router.get('/crs/jurisdictions', async (req: Request, res: Response) => {
  try {
    const jurisdictions = fatcaCrsService.getParticipatingJurisdictions();
    const usIndiciaTypes = fatcaCrsService.getUSIndiciaTypes();
    res.json({ success: true, data: { jurisdictions, usIndiciaTypes } });
  } catch (error: any) {
    console.error('[Compliance API] Jurisdictions fetch error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== UNIFIED COMPLIANCE DASHBOARD ====================

/**
 * Get unified compliance dashboard for a user
 */
router.get('/dashboard/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    // Fetch all compliance statuses in parallel
    const [sebiStatus, dematReport, fatcaCrsStatus] = await Promise.all([
      sebiComplianceService.checkComplianceStatus(userId),
      dematComplianceService.generateComplianceReport(userId),
      fatcaCrsService.getComplianceSummary(userId)
    ]);

    // Calculate overall compliance score
    const scores = [
      sebiStatus.complianceScore,
      dematReport.complianceScore,
      fatcaCrsStatus.overallStatus === 'compliant' ? 100 : 
        fatcaCrsStatus.overallStatus === 'action_required' ? 60 :
        fatcaCrsStatus.overallStatus === 'pending' ? 40 : 20
    ];
    const overallScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);

    res.json({
      success: true,
      data: {
        userId,
        overallComplianceScore: overallScore,
        overallStatus: overallScore >= 80 ? 'compliant' : 
          overallScore >= 60 ? 'action_required' : 
          overallScore >= 40 ? 'pending' : 'non_compliant',
        sebi: sebiStatus,
        demat: dematReport,
        fatcaCrs: fatcaCrsStatus,
        lastUpdated: new Date()
      }
    });
  } catch (error: any) {
    console.error('[Compliance API] Dashboard error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== DP REGISTRY ADMIN ENDPOINTS ====================

/**
 * Get all registered Depository Participants with pagination and filters
 */
router.get('/dp-registry', async (req: Request, res: Response) => {
  try {
    const { 
      page = '1', 
      limit = '50', 
      depository, 
      status, 
      search 
    } = req.query;

    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    let query = db.select().from(sebiDepositoryParticipants);

    // Apply filters
    const conditions = [];
    if (depository) {
      conditions.push(eq(sebiDepositoryParticipants.depository, depository as string));
    }
    if (status) {
      conditions.push(eq(sebiDepositoryParticipants.status, status as string));
    }
    if (search) {
      conditions.push(
        or(
          like(sebiDepositoryParticipants.dpId, `%${search}%`),
          like(sebiDepositoryParticipants.dpName, `%${search}%`),
          like(sebiDepositoryParticipants.sebiRegistrationNumber, `%${search}%`)
        )
      );
    }

    // Get total count
    const countResult = await db.select({ count: sql<number>`count(*)` })
      .from(sebiDepositoryParticipants);
    const total = countResult[0]?.count || 0;

    // Get paginated results
    const dps = await db.select()
      .from(sebiDepositoryParticipants)
      .orderBy(desc(sebiDepositoryParticipants.createdAt))
      .limit(parseInt(limit as string))
      .offset(offset);

    res.json({
      success: true,
      data: {
        depositoryParticipants: dps,
        pagination: {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          total,
          totalPages: Math.ceil(total / parseInt(limit as string))
        }
      }
    });
  } catch (error: any) {
    console.error('[Compliance API] DP registry fetch error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get a specific DP by ID
 */
router.get('/dp-registry/:dpId', async (req: Request, res: Response) => {
  try {
    const { dpId } = req.params;

    const dp = await db.select()
      .from(sebiDepositoryParticipants)
      .where(
        or(
          eq(sebiDepositoryParticipants.dpId, dpId),
          eq(sebiDepositoryParticipants.id, dpId)
        )
      )
      .limit(1);

    if (dp.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: `DP ${dpId} not found in registry` 
      });
    }

    res.json({ success: true, data: dp[0] });
  } catch (error: any) {
    console.error('[Compliance API] DP fetch error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Add a new DP to the registry (Admin only)
 */
router.post('/dp-registry', async (req: Request, res: Response) => {
  try {
    // Validate input
    const validationResult = insertSebiDepositoryParticipantSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      return res.status(400).json({ 
        success: false, 
        error: 'Validation failed',
        details: validationResult.error.errors 
      });
    }

    const dpData = validationResult.data;

    // Check if DP already exists
    const existing = await db.select()
      .from(sebiDepositoryParticipants)
      .where(eq(sebiDepositoryParticipants.dpId, dpData.dpId))
      .limit(1);

    if (existing.length > 0) {
      return res.status(409).json({ 
        success: false, 
        error: `DP ${dpData.dpId} already exists in registry` 
      });
    }

    // Insert new DP
    const inserted = await db.insert(sebiDepositoryParticipants)
      .values(dpData)
      .returning();

    console.log(`[DP Registry] Added new DP: ${dpData.dpId} - ${dpData.dpName}`);

    res.status(201).json({ success: true, data: inserted[0] });
  } catch (error: any) {
    console.error('[Compliance API] DP add error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Update DP status (Admin only)
 */
router.patch('/dp-registry/:dpId/status', async (req: Request, res: Response) => {
  try {
    const { dpId } = req.params;
    const { status, statusReason } = req.body;

    if (!['active', 'suspended', 'cancelled'].includes(status)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid status. Must be: active, suspended, or cancelled' 
      });
    }

    const updated = await db.update(sebiDepositoryParticipants)
      .set({
        status,
        statusReason,
        statusUpdatedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(sebiDepositoryParticipants.dpId, dpId))
      .returning();

    if (updated.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: `DP ${dpId} not found` 
      });
    }

    console.log(`[DP Registry] Updated DP ${dpId} status to ${status}`);

    res.json({ success: true, data: updated[0] });
  } catch (error: any) {
    console.error('[Compliance API] DP status update error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Validate a DP ID
 */
router.get('/dp-registry/validate/:dpId', async (req: Request, res: Response) => {
  try {
    const { dpId } = req.params;
    const result = await dematComplianceService.validateDP(dpId);
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('[Compliance API] DP validation error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get DP registry statistics
 */
router.get('/dp-registry-stats', async (req: Request, res: Response) => {
  try {
    const stats = await db.select({
      depository: sebiDepositoryParticipants.depository,
      status: sebiDepositoryParticipants.status,
      count: sql<number>`count(*)`
    })
    .from(sebiDepositoryParticipants)
    .groupBy(sebiDepositoryParticipants.depository, sebiDepositoryParticipants.status);

    const total = await db.select({ count: sql<number>`count(*)` })
      .from(sebiDepositoryParticipants);

    res.json({
      success: true,
      data: {
        total: total[0]?.count || 0,
        byDepository: stats.reduce((acc: any, s) => {
          if (!acc[s.depository]) {
            acc[s.depository] = { active: 0, suspended: 0, cancelled: 0, total: 0 };
          }
          acc[s.depository][s.status] = s.count;
          acc[s.depository].total += s.count;
          return acc;
        }, {}),
        lastUpdated: new Date()
      }
    });
  } catch (error: any) {
    console.error('[Compliance API] DP stats error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
