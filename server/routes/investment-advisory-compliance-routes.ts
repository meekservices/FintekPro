import express, { Request, Response, Router } from 'express';
import { investmentAdvisoryCompliance } from '../services/investment-advisory-compliance';
import { AuthRequest } from '../types/broker-types';
import { logger } from '../logger';

const router: Router = express.Router();

// ============================================================================
// AUDIT TRAIL ROUTES
// ============================================================================

/**
 * POST /audit/recommendation - Log a recommendation with full audit trail
 */
router.post('/audit/recommendation', async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      clientId,
      advisorId,
      recommendationType,
      action,
      productCode,
      productName,
      amount,
      rationale,
      suitabilityScore,
      riskWarnings,
      explanationReasons,
      suitabilityEvidence
    } = req.body;
    
    if (!clientId || !advisorId || !recommendationType || !action || !rationale) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: clientId, advisorId, recommendationType, action, rationale'
      });
      return;
    }
    
    const auditLog = investmentAdvisoryCompliance.logRecommendation({
      clientId,
      advisorId,
      recommendationType,
      action,
      productCode,
      productName,
      amount,
      rationale,
      suitabilityScore: suitabilityScore || 70,
      riskWarnings: riskWarnings || [],
      explanationReasons: explanationReasons || [],
      suitabilityEvidence: suitabilityEvidence || {
        riskProfile: 'moderate',
        investmentHorizon: 5,
        clientSegment: 'retail',
        kycTier: 'basic',
        financialCapacity: true,
        productEligibility: true
      }
    });
    
    res.json({
      success: true,
      data: auditLog
    });
  } catch (error: any) {
    logger.error('[AdvisoryCompliance] Recommendation log failed', { error });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /audit/acknowledge - Record client acknowledgment of recommendation
 */
router.post('/audit/acknowledge', async (req: Request, res: Response): Promise<void> => {
  try {
    const { auditId, ipAddress, deviceFingerprint } = req.body;
    
    if (!auditId) {
      res.status(400).json({
        success: false,
        error: 'Missing required field: auditId'
      });
      return;
    }
    
    const result = investmentAdvisoryCompliance.acknowledgeRecommendation({
      auditId,
      ipAddress: ipAddress || req.ip || 'unknown',
      deviceFingerprint: deviceFingerprint || req.headers['user-agent'] || 'unknown'
    });
    
    if (!result) {
      res.status(404).json({
        success: false,
        error: 'Audit log not found'
      });
      return;
    }
    
    res.json({
      success: true,
      data: {
        auditId: result.auditId,
        acknowledged: result.clientAcknowledgment?.acknowledged,
        acknowledgedAt: result.clientAcknowledgment?.acknowledgedAt
      }
    });
  } catch (error: any) {
    logger.error('[AdvisoryCompliance] Acknowledgment failed', { auditId: req.body.auditId, error });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /audit/client/:clientId - Get client audit trail
 */
router.get('/audit/client/:clientId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { clientId } = req.params;
    const logs = investmentAdvisoryCompliance.getClientAuditTrail(clientId);
    
    res.json({
      success: true,
      data: {
        clientId,
        totalLogs: logs.length,
        auditTrail: logs
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// CONSENT MANAGEMENT ROUTES
// ============================================================================

/**
 * POST /consent/record - Record client consent
 */
router.post('/consent/record', async (req: Request, res: Response): Promise<void> => {
  try {
    const { clientId, consentType, consentText, expiresAt } = req.body;
    
    if (!clientId || !consentType || !consentText) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: clientId, consentType, consentText'
      });
      return;
    }
    
    const consent = investmentAdvisoryCompliance.recordConsent({
      clientId,
      consentType,
      consentText,
      ipAddress: req.ip || 'unknown',
      deviceInfo: req.headers['user-agent'] as string || 'unknown',
      expiresAt: expiresAt ? new Date(expiresAt) : undefined
    });
    
    res.json({
      success: true,
      data: consent
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /consent/client/:clientId - Get client consents
 */
router.get('/consent/client/:clientId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { clientId } = req.params;
    const consents = investmentAdvisoryCompliance.getClientConsents(clientId);
    
    res.json({
      success: true,
      data: {
        clientId,
        consents
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /consent/check/:clientId - Check required consents for a client
 */
router.get('/consent/check/:clientId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { clientId } = req.params;
    const result = investmentAdvisoryCompliance.checkRequiredConsents(clientId);
    
    res.json({
      success: true,
      data: {
        clientId,
        ...result
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// SUITABILITY DECLARATION ROUTES
// ============================================================================

/**
 * POST /suitability/declaration - Create suitability declaration
 */
router.post('/suitability/declaration', async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      clientId,
      advisorId,
      proposalId,
      riskProfileMatch,
      horizonMatch,
      financialCapacityMatch,
      objectivesMatch,
      kycComplete,
      overrideReason
    } = req.body;
    
    if (!clientId || !advisorId || !proposalId) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: clientId, advisorId, proposalId'
      });
      return;
    }
    
    const declaration = investmentAdvisoryCompliance.createSuitabilityDeclaration({
      clientId,
      advisorId,
      proposalId,
      riskProfileMatch: riskProfileMatch !== false,
      horizonMatch: horizonMatch !== false,
      financialCapacityMatch: financialCapacityMatch !== false,
      objectivesMatch: objectivesMatch !== false,
      kycComplete: kycComplete !== false,
      overrideReason
    });
    
    res.json({
      success: true,
      data: declaration
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// COMPLIANCE REPORT ROUTES
// ============================================================================

/**
 * POST /reports/generate - Generate compliance report
 */
router.post('/reports/generate', async (req: Request, res: Response): Promise<void> => {
  try {
    const { reportType, periodStart, periodEnd } = req.body;
    
    if (!reportType) {
      res.status(400).json({
        success: false,
        error: 'Missing required field: reportType'
      });
      return;
    }
    
    const now = new Date();
    const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const defaultEnd = now;
    
    const report = investmentAdvisoryCompliance.generateComplianceReport({
      reportType,
      periodStart: periodStart ? new Date(periodStart) : defaultStart,
      periodEnd: periodEnd ? new Date(periodEnd) : defaultEnd
    });
    
    res.json({
      success: true,
      data: report
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /reports/stats - Get compliance statistics
 */
router.get('/reports/stats', async (_req: Request, res: Response): Promise<void> => {
  try {
    const stats = investmentAdvisoryCompliance.getComplianceStats();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// DISCLOSURE ROUTES
// ============================================================================

/**
 * POST /disclosures/generate - Generate disclosure document
 */
router.post('/disclosures/generate', async (req: Request, res: Response): Promise<void> => {
  try {
    const { clientId, proposalId, products } = req.body;
    
    if (!clientId || !proposalId || !products || !Array.isArray(products)) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: clientId, proposalId, products (array)'
      });
      return;
    }
    
    const document = investmentAdvisoryCompliance.generateDisclosureDocument({
      clientId,
      proposalId,
      products
    });
    
    res.json({
      success: true,
      data: document
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /disclosures/mandatory - Get mandatory disclosure templates
 */
router.get('/disclosures/mandatory', (_req: Request, res: Response): void => {
  res.json({
    success: true,
    data: {
      disclosures: [
        {
          type: 'risk_disclosure',
          title: 'Investment Risk Disclosure',
          content: 'Investments in securities market are subject to market risks. There is no assurance or guarantee that the objectives of any of the Schemes will be achieved. Past performance of the Sponsor/AMC/Mutual Fund is not necessarily indicative of future results.',
          regulatoryReference: 'SEBI Circular CIR/OIAE/1/2015 dated 23-Mar-2015',
          mandatory: true
        },
        {
          type: 'advisor_disclosure',
          title: 'Investment Adviser Registration',
          content: 'FintekPro is a SEBI Registered Investment Adviser under SEBI (Investment Advisers) Regulations, 2013. All investment advice is provided based on assessment of your risk profile and investment objectives.',
          regulatoryReference: 'SEBI (Investment Advisers) Regulations, 2013',
          mandatory: true
        },
        {
          type: 'conflict_disclosure',
          title: 'Conflict of Interest',
          content: 'FintekPro may receive commissions, trail fees, or other compensation from product manufacturers. We endeavor to provide unbiased advice in your best interest despite potential conflicts.',
          regulatoryReference: 'SEBI Circular SEBI/HO/IMD/DF3/CIR/P/2021/024',
          mandatory: true
        },
        {
          type: 'suitability_disclosure',
          title: 'Suitability Statement',
          content: 'Investment recommendations are made based on your stated investment objectives, risk tolerance, time horizon, and financial situation. Please ensure these details are accurate and updated.',
          regulatoryReference: 'SEBI (Investment Advisers) Regulations, 2013 - Regulation 17(2)',
          mandatory: true
        },
        {
          type: 'complaint_disclosure',
          title: 'Grievance Redressal',
          content: 'For complaints, contact our compliance officer at compliance@fintekpro.com. You may also register complaints with SEBI at SCORES portal (https://scores.gov.in) or contact SEBI Helpline 1800-22-7575.',
          regulatoryReference: 'SEBI Circular SEBI/HO/OIAE/2/P/CIR/2021/62',
          mandatory: true
        }
      ],
      lastUpdated: new Date().toISOString()
    }
  });
});

/**
 * GET /regulations/ia - Get Investment Advisers regulations reference
 */
router.get('/regulations/ia', (_req: Request, res: Response): void => {
  res.json({
    success: true,
    data: {
      regulation: 'SEBI (Investment Advisers) Regulations, 2013',
      lastAmended: '2020-09-23',
      keyProvisions: [
        {
          regulation: 'Regulation 15',
          title: 'General Responsibility',
          summary: 'Investment adviser shall act in fiduciary capacity towards clients, maintain integrity and fair dealing'
        },
        {
          regulation: 'Regulation 16',
          title: 'Know Your Client',
          summary: 'Before providing investment advice, verify client identity, financial situation, and investment experience'
        },
        {
          regulation: 'Regulation 17(1)',
          title: 'Risk Profiling',
          summary: 'Assess risk appetite of client based on financial situation, investment objectives, and risk tolerance'
        },
        {
          regulation: 'Regulation 17(2)',
          title: 'Suitability',
          summary: 'Ensure investment advice is appropriate based on risk profile; document rationale for recommendations'
        },
        {
          regulation: 'Regulation 17(3)',
          title: 'Documentation',
          summary: 'Maintain records of all investment advice, risk assessments, and client acknowledgments for minimum 5 years'
        },
        {
          regulation: 'Regulation 17(4)',
          title: 'Disclosure of Rationale',
          summary: 'Disclose reasoning and rationale for investment recommendations to client'
        },
        {
          regulation: 'Regulation 18',
          title: 'Conflicts of Interest',
          summary: 'Disclose all conflicts, avoid preferential treatment, segregate advisory from distribution activities'
        },
        {
          regulation: 'Regulation 21',
          title: 'Fee Structure',
          summary: 'Investment advisor may charge fees as fixed, asset-based, or performance-based; no hidden charges'
        }
      ],
      complianceRequirements: [
        'Annual compliance audit by qualified auditor',
        'Monthly investor complaints report to SEBI',
        'Disclosure of fee structure to clients',
        '5-year record retention for all advice',
        'Segregation of advisory and distribution activities',
        'Client risk profiling before advice',
        'Suitability assessment for all recommendations'
      ]
    }
  });
});

/**
 * POST /archive/expired - Archive expired audit logs
 */
router.post('/archive/expired', async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = investmentAdvisoryCompliance.archiveExpiredLogs();
    
    res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
