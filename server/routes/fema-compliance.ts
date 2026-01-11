/**
 * FEMA Compliance API Routes
 * 
 * Provides endpoints for:
 * - RBI Purpose Code validation and lookup
 * - LRS limit tracking and eligibility checks
 * - TCS calculation for foreign remittances
 * - RBI A2 Form generation and submission
 * - AD Bank certificate generation and validation
 * - FEMA compliance reporting
 */

import { Router, Request, Response } from 'express';
import { requireAuth, requireRole, getRoleInfo } from '../middleware/roleMiddleware';
import { femaComplianceService } from '../services/fema-compliance-service';
import { RoleId } from '@shared/roles';

const router = Router();

const FEMA_ALLOWED_ROLES: RoleId[] = ['superadmin', 'admin', 'compliance_officer', 'master_agent', 'agent', 'sub_agent', 'partner', 'client'];
const ADMIN_ROLES: RoleId[] = ['superadmin', 'admin', 'compliance_officer'];

// ==================== PURPOSE CODE ENDPOINTS ====================

router.get('/purpose-codes', requireAuth, requireRole(FEMA_ALLOWED_ROLES), async (req: Request, res: Response) => {
  try {
    const { category } = req.query;
    
    let codes;
    if (category === 'capital_account' || category === 'current_account') {
      codes = femaComplianceService.getPurposeCodesByCategory(category);
    } else {
      codes = femaComplianceService.getAllPurposeCodes();
    }
    
    res.json({
      success: true,
      data: codes,
      count: codes.length
    });
  } catch (error) {
    console.error('[FEMA] Error fetching purpose codes:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch purpose codes' });
  }
});

router.get('/purpose-codes/:code', requireAuth, requireRole(FEMA_ALLOWED_ROLES), async (req: Request, res: Response) => {
  try {
    const { code } = req.params;
    const purposeCode = femaComplianceService.getPurposeCode(code);
    
    if (!purposeCode) {
      return res.status(404).json({ success: false, error: 'Purpose code not found' });
    }
    
    res.json({ success: true, data: purposeCode });
  } catch (error) {
    console.error('[FEMA] Error fetching purpose code:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch purpose code' });
  }
});

router.post('/purpose-codes/validate', requireAuth, requireRole(FEMA_ALLOWED_ROLES), async (req: Request, res: Response) => {
  try {
    const { purposeCode, amountUSD } = req.body;
    
    if (!purposeCode) {
      return res.status(400).json({ success: false, error: 'Purpose code is required' });
    }
    
    const validation = femaComplianceService.validatePurposeCode(purposeCode, amountUSD || 0);
    
    res.json({
      success: true,
      data: validation
    });
  } catch (error) {
    console.error('[FEMA] Error validating purpose code:', error);
    res.status(500).json({ success: false, error: 'Failed to validate purpose code' });
  }
});

// ==================== LRS LIMIT ENDPOINTS ====================

router.get('/lrs/status', requireAuth, requireRole(FEMA_ALLOWED_ROLES), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { financialYear } = req.query;
    
    if (!userId) {
      return res.status(401).json({ success: false, error: 'User not authenticated' });
    }
    
    const status = await femaComplianceService.getLRSStatus(userId, financialYear as string);
    
    res.json({ success: true, data: status });
  } catch (error) {
    console.error('[FEMA] Error fetching LRS status:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch LRS status' });
  }
});

router.get('/lrs/status/:userId', requireAuth, requireRole(ADMIN_ROLES), async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { financialYear } = req.query;
    
    const status = await femaComplianceService.getLRSStatus(userId, financialYear as string);
    
    res.json({ success: true, data: status });
  } catch (error) {
    console.error('[FEMA] Error fetching LRS status:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch LRS status' });
  }
});

router.post('/lrs/eligibility', requireAuth, requireRole(FEMA_ALLOWED_ROLES), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { amountUSD } = req.body;
    
    if (!userId) {
      return res.status(401).json({ success: false, error: 'User not authenticated' });
    }
    
    if (!amountUSD || amountUSD <= 0) {
      return res.status(400).json({ success: false, error: 'Valid amount in USD is required' });
    }
    
    const eligibility = await femaComplianceService.checkLRSEligibility(userId, amountUSD);
    
    res.json({ success: true, data: eligibility });
  } catch (error) {
    console.error('[FEMA] Error checking LRS eligibility:', error);
    res.status(500).json({ success: false, error: 'Failed to check LRS eligibility' });
  }
});

// ==================== TCS CALCULATION ENDPOINTS ====================

router.post('/tcs/calculate', requireAuth, requireRole(FEMA_ALLOWED_ROLES), async (req: Request, res: Response) => {
  try {
    const { 
      remittanceAmountINR, 
      fyUtilizationINR = 0, 
      purposeCode, 
      isEducationLoanFunded = false 
    } = req.body;
    
    if (!remittanceAmountINR || remittanceAmountINR <= 0) {
      return res.status(400).json({ success: false, error: 'Valid remittance amount in INR is required' });
    }
    
    if (!purposeCode) {
      return res.status(400).json({ success: false, error: 'Purpose code is required' });
    }
    
    const tcsCalculation = femaComplianceService.calculateTCS(
      remittanceAmountINR,
      fyUtilizationINR,
      purposeCode,
      isEducationLoanFunded
    );
    
    res.json({ success: true, data: tcsCalculation });
  } catch (error) {
    console.error('[FEMA] Error calculating TCS:', error);
    res.status(500).json({ success: false, error: 'Failed to calculate TCS' });
  }
});

// ==================== A2 FORM ENDPOINTS ====================

router.post('/a2-form/generate', requireAuth, requireRole(FEMA_ALLOWED_ROLES), async (req: Request, res: Response) => {
  try {
    const { 
      transactionId,
      applicantDetails,
      remittanceDetails,
      beneficiaryDetails,
      adBankDetails,
      declarations
    } = req.body;
    
    if (!applicantDetails?.pan || !remittanceDetails?.purposeCode) {
      return res.status(400).json({ 
        success: false, 
        error: 'Applicant PAN and purpose code are required' 
      });
    }
    
    const a2Form = await femaComplianceService.generateA2Form(transactionId, {
      transactionId,
      applicantDetails,
      remittanceDetails,
      beneficiaryDetails,
      adBankDetails,
      declarations
    });
    
    res.json({ success: true, data: a2Form });
  } catch (error) {
    console.error('[FEMA] Error generating A2 form:', error);
    res.status(500).json({ success: false, error: 'Failed to generate A2 form' });
  }
});

router.get('/a2-form/:formNumber', requireAuth, requireRole(FEMA_ALLOWED_ROLES), async (req: Request, res: Response) => {
  try {
    const { formNumber } = req.params;
    
    const form = await femaComplianceService.getA2Form(formNumber);
    
    if (!form) {
      return res.status(404).json({ success: false, error: 'A2 form not found' });
    }
    
    res.json({ success: true, data: form });
  } catch (error) {
    console.error('[FEMA] Error fetching A2 form:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch A2 form' });
  }
});

router.post('/a2-form/:formNumber/submit', requireAuth, requireRole(FEMA_ALLOWED_ROLES), async (req: Request, res: Response) => {
  try {
    const { formNumber } = req.params;
    
    const result = await femaComplianceService.submitA2Form(formNumber);
    
    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error });
    }
    
    res.json({ 
      success: true, 
      data: { 
        acknowledgementNumber: result.acknowledgementNumber,
        message: 'A2 Form submitted successfully'
      }
    });
  } catch (error) {
    console.error('[FEMA] Error submitting A2 form:', error);
    res.status(500).json({ success: false, error: 'Failed to submit A2 form' });
  }
});

// ==================== AD CERTIFICATE ENDPOINTS ====================

router.post('/ad-certificate/generate', requireAuth, requireRole(FEMA_ALLOWED_ROLES), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { 
      transactionId,
      adBankName,
      adBankBranch,
      adCode,
      applicantName,
      applicantPan,
      purposeCode,
      remittanceAmountUSD,
      remittanceAmountINR,
      exchangeRate,
      beneficiaryDetails,
      tcsDeducted = 0
    } = req.body;
    
    if (!adBankName || !adCode || !applicantPan || !purposeCode) {
      return res.status(400).json({ 
        success: false, 
        error: 'AD bank details, applicant PAN, and purpose code are required' 
      });
    }
    
    const certificate = await femaComplianceService.generateADCertificate(
      transactionId,
      userId,
      {
        adBankName,
        adBankBranch,
        adCode,
        applicantName,
        applicantPan,
        purposeCode,
        remittanceAmountUSD,
        remittanceAmountINR,
        exchangeRate,
        beneficiaryDetails,
        tcsDeducted
      }
    );
    
    res.json({ success: true, data: certificate });
  } catch (error) {
    console.error('[FEMA] Error generating AD certificate:', error);
    res.status(500).json({ success: false, error: 'Failed to generate AD certificate' });
  }
});

router.get('/ad-certificate/:certificateNumber', requireAuth, requireRole(FEMA_ALLOWED_ROLES), async (req: Request, res: Response) => {
  try {
    const { certificateNumber } = req.params;
    
    const certificate = await femaComplianceService.getADCertificate(certificateNumber);
    
    if (!certificate) {
      return res.status(404).json({ success: false, error: 'AD certificate not found' });
    }
    
    res.json({ success: true, data: certificate });
  } catch (error) {
    console.error('[FEMA] Error fetching AD certificate:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch AD certificate' });
  }
});

router.post('/ad-certificate/:certificateNumber/validate', requireAuth, requireRole(FEMA_ALLOWED_ROLES), async (req: Request, res: Response) => {
  try {
    const { certificateNumber } = req.params;
    
    const validation = await femaComplianceService.validateADCertificate(certificateNumber);
    
    res.json({ success: true, data: validation });
  } catch (error) {
    console.error('[FEMA] Error validating AD certificate:', error);
    res.status(500).json({ success: false, error: 'Failed to validate AD certificate' });
  }
});

// ==================== TRANSACTION ENDPOINTS ====================

router.post('/transactions', requireAuth, requireRole(FEMA_ALLOWED_ROLES), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const transactionData = req.body;
    
    if (!userId) {
      return res.status(401).json({ success: false, error: 'User not authenticated' });
    }
    
    const transaction = await femaComplianceService.recordTransaction({
      ...transactionData,
      userId,
      status: 'draft'
    });
    
    res.json({ success: true, data: transaction });
  } catch (error) {
    console.error('[FEMA] Error recording transaction:', error);
    res.status(500).json({ success: false, error: 'Failed to record transaction' });
  }
});

router.patch('/transactions/:transactionId/status', requireAuth, requireRole(FEMA_ALLOWED_ROLES), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { transactionId } = req.params;
    const { status, remarks } = req.body;
    
    if (!userId) {
      return res.status(401).json({ success: false, error: 'User not authenticated' });
    }
    
    const validStatuses = ['draft', 'pending_ad_approval', 'approved', 'remitted', 'rejected'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status' });
    }
    
    const transaction = await femaComplianceService.updateTransactionStatus(
      transactionId,
      userId,
      status,
      remarks
    );
    
    if (!transaction) {
      return res.status(404).json({ success: false, error: 'Transaction not found' });
    }
    
    res.json({ success: true, data: transaction });
  } catch (error) {
    console.error('[FEMA] Error updating transaction status:', error);
    res.status(500).json({ success: false, error: 'Failed to update transaction status' });
  }
});

// ==================== COMPLIANCE REPORT ENDPOINTS ====================

router.get('/compliance-report', requireAuth, requireRole(FEMA_ALLOWED_ROLES), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { financialYear } = req.query;
    
    if (!userId) {
      return res.status(401).json({ success: false, error: 'User not authenticated' });
    }
    
    const report = await femaComplianceService.generateComplianceReport(userId, financialYear as string);
    
    res.json({ success: true, data: report });
  } catch (error) {
    console.error('[FEMA] Error generating compliance report:', error);
    res.status(500).json({ success: false, error: 'Failed to generate compliance report' });
  }
});

router.get('/compliance-report/:userId', requireAuth, requireRole(ADMIN_ROLES), async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { financialYear } = req.query;
    
    const report = await femaComplianceService.generateComplianceReport(userId, financialYear as string);
    
    res.json({ success: true, data: report });
  } catch (error) {
    console.error('[FEMA] Error generating compliance report:', error);
    res.status(500).json({ success: false, error: 'Failed to generate compliance report' });
  }
});

export function registerFemaComplianceRoutes(app: Router): void {
  app.use('/api/fema', router);
  console.log('✅ FEMA Compliance routes registered');
}

export default router;
