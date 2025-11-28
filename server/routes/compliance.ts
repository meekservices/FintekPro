import express, { Request, Response } from 'express';
import { complianceService } from '../services/compliance-service';
import { storage } from '../storage';
import { apiResponse } from '../utils/responses';

const router = express.Router();

/**
 * GET /api/compliance/flags/:companyId
 * Get compliance red flags for a company
 */
router.get('/flags/:companyId', async (req: Request, res: Response) => {
  try {
    const { companyId } = req.params;
    
    const flags = await complianceService.checkComplianceFlags(companyId);
    const riskScore = await complianceService.getComplianceRiskScore(companyId);
    const hasBlockingFlags = flags.some((f) => f.blocksDeals);
    
    return apiResponse.success(res, {
      companyId,
      flags,
      riskScore,
      hasBlockingFlags,
      dealBlocked: hasBlockingFlags,
    });
  } catch (error: any) {
    console.error('Error checking compliance flags:', error);
    return apiResponse.serverError(res, 'Failed to check compliance flags');
  }
});

/**
 * GET /api/compliance/risk-score/:companyId
 * Get compliance risk score for a company
 */
router.get('/risk-score/:companyId', async (req: Request, res: Response) => {
  try {
    const { companyId } = req.params;
    
    const riskScore = await complianceService.getComplianceRiskScore(companyId);
    
    return apiResponse.success(res, {
      companyId,
      riskScore,
      riskLevel: riskScore >= 70 ? 'high' : riskScore >= 40 ? 'medium' : 'low',
    });
  } catch (error: any) {
    console.error('Error calculating risk score:', error);
    return apiResponse.serverError(res, 'Failed to calculate risk score');
  }
});

export default router;
