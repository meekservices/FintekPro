/**
 * Admin Routes for CKYC Deferred Cases
 * 
 * Provides endpoints for managing deferred CKYC cases:
 * - Dashboard tile with aging buckets
 * - Case listing with filters
 * - Case detail view
 * - Admin action handling
 * - SLA monitoring
 */

import { Router } from "express";
import { ckycDeferredService } from "../../services/ckyc-deferred-service";
import { ckycEnvironmentService } from "../../services/ckyc-environment-service";
import { z } from "zod";

const router = Router();

const adminActionSchema = z.object({
  action: z.enum(['manual_kyc_initiated', 'vkyc_scheduled', 'rejected', 'resolved']),
  reason: z.string().min(10, 'Reason must be at least 10 characters'),
});

router.get('/dashboard-stats', async (req, res) => {
  try {
    const agingBuckets = await ckycDeferredService.getAgingBuckets();
    const environmentMode = ckycEnvironmentService.getMode();
    const blockedAttemptsCount = ckycEnvironmentService.getBlockedAttemptsCount();
    
    res.json({
      success: true,
      data: {
        agingBuckets,
        environmentMode,
        blockedAttemptsCount,
        mockProviderAllowed: ckycEnvironmentService.isMockProviderAllowed(),
      },
    });
  } catch (error) {
    console.error('[CKYC Deferred Admin] Failed to get dashboard stats:', error);
    res.status(500).json({ success: false, error: 'Failed to get dashboard stats' });
  }
});

router.get('/cases', async (req, res) => {
  try {
    const { status, assignedTo, breachedOnly, limit, offset } = req.query;
    
    const { cases, total } = await ckycDeferredService.getAllDeferredCases({
      status: status as string,
      assignedTo: assignedTo as string,
      breachedOnly: breachedOnly === 'true',
      limit: limit ? parseInt(limit as string) : 50,
      offset: offset ? parseInt(offset as string) : 0,
    });
    
    res.json({
      success: true,
      data: { cases, total },
    });
  } catch (error) {
    console.error('[CKYC Deferred Admin] Failed to get cases:', error);
    res.status(500).json({ success: false, error: 'Failed to get deferred cases' });
  }
});

router.get('/cases/:caseId', async (req, res) => {
  try {
    const { caseId } = req.params;
    const caseDetail = await ckycDeferredService.getDeferredCaseById(caseId);
    
    if (!caseDetail) {
      return res.status(404).json({ success: false, error: 'Case not found' });
    }
    
    res.json({
      success: true,
      data: caseDetail,
    });
  } catch (error) {
    console.error('[CKYC Deferred Admin] Failed to get case:', error);
    res.status(500).json({ success: false, error: 'Failed to get case details' });
  }
});

router.post('/cases/:caseId/action', async (req, res) => {
  try {
    const { caseId } = req.params;
    const adminId = (req as any).user?.id;
    
    if (!adminId) {
      return res.status(401).json({ success: false, error: 'Admin authentication required' });
    }
    
    const parseResult = adminActionSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid action data',
        details: parseResult.error.errors,
      });
    }
    
    const { action, reason } = parseResult.data;
    
    const updated = await ckycDeferredService.takeAdminAction(caseId, {
      action,
      reason,
      adminId,
    });
    
    res.json({
      success: true,
      data: updated,
      message: `Action ${action} applied successfully`,
    });
  } catch (error) {
    console.error('[CKYC Deferred Admin] Failed to apply action:', error);
    res.status(500).json({ success: false, error: 'Failed to apply admin action' });
  }
});

router.post('/check-sla-breaches', async (req, res) => {
  try {
    const breachedCount = await ckycDeferredService.checkAndEscalateSLABreaches();
    
    res.json({
      success: true,
      data: { breachedCount },
      message: breachedCount > 0 
        ? `${breachedCount} case(s) escalated for SLA breach`
        : 'No SLA breaches found',
    });
  } catch (error) {
    console.error('[CKYC Deferred Admin] Failed to check SLA breaches:', error);
    res.status(500).json({ success: false, error: 'Failed to check SLA breaches' });
  }
});

router.get('/environment-compliance', async (req, res) => {
  try {
    const complianceResult = ckycEnvironmentService.runStartupComplianceCheck();
    const blockedAttempts = ckycEnvironmentService.getBlockedAttempts();
    
    res.json({
      success: true,
      data: {
        compliance: complianceResult,
        blockedAttempts,
      },
    });
  } catch (error) {
    console.error('[CKYC Deferred Admin] Failed to get compliance status:', error);
    res.status(500).json({ success: false, error: 'Failed to get compliance status' });
  }
});

export default router;
