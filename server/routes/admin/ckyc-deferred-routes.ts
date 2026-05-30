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
import { ckycAuditService } from "../../services/ckyc-audit-service";
import { ckycSlaEscalationService } from "../../services/ckyc-sla-escalation-service";
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
        details: parseResult.error.issues,
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
    // Use the new SLA escalation service for comprehensive breach detection
    const { breachedCount, escalatedCount } = await ckycSlaEscalationService.triggerManualCheck();
    
    res.json({
      success: true,
      data: { breachedCount, escalatedCount },
      message: breachedCount > 0 
        ? `${breachedCount} breach(es) found, ${escalatedCount} case(s) escalated`
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

// === AUDIT LOG ENDPOINTS ===

router.get('/cases/:caseId/audit-log', async (req, res) => {
  try {
    const { caseId } = req.params;
    const logs = await ckycAuditService.getAuditLogsByCase(caseId);
    
    res.json({
      success: true,
      data: {
        caseId,
        totalEvents: logs.length,
        logs,
      },
    });
  } catch (error) {
    console.error('[CKYC Deferred Admin] Failed to get audit log:', error);
    res.status(500).json({ success: false, error: 'Failed to get audit log' });
  }
});

router.get('/cases/:caseId/journey', async (req, res) => {
  try {
    const { caseId } = req.params;
    const journey = await ckycAuditService.reconstructJourney(caseId);
    
    if (!journey) {
      return res.status(404).json({ success: false, error: 'Case not found' });
    }
    
    res.json({
      success: true,
      data: journey,
    });
  } catch (error) {
    console.error('[CKYC Deferred Admin] Failed to reconstruct journey:', error);
    res.status(500).json({ success: false, error: 'Failed to reconstruct CKYC journey' });
  }
});

router.get('/cases/:caseId/export', async (req, res) => {
  try {
    const { caseId } = req.params;
    const format = (req.query.format as 'json' | 'csv') || 'json';
    
    const exported = await ckycAuditService.exportAuditTrail(caseId, format);
    
    const contentType = format === 'csv' ? 'text/csv' : 'application/json';
    const filename = `ckyc-audit-${caseId.slice(0, 8)}-${Date.now()}.${format}`;
    
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(exported);
  } catch (error) {
    console.error('[CKYC Deferred Admin] Failed to export audit trail:', error);
    res.status(500).json({ success: false, error: 'Failed to export audit trail' });
  }
});

router.get('/cases/:caseId/verify-integrity', async (req, res) => {
  try {
    const { caseId } = req.params;
    const integrity = await ckycAuditService.verifyChainIntegrity(caseId);
    
    res.json({
      success: true,
      data: integrity,
    });
  } catch (error) {
    console.error('[CKYC Deferred Admin] Failed to verify integrity:', error);
    res.status(500).json({ success: false, error: 'Failed to verify audit chain integrity' });
  }
});

router.get('/compliance-events', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const start = startDate ? new Date(startDate as string) : undefined;
    const end = endDate ? new Date(endDate as string) : undefined;
    
    const events = await ckycAuditService.getComplianceEvents(start, end);
    
    res.json({
      success: true,
      data: {
        totalEvents: events.length,
        events,
      },
    });
  } catch (error) {
    console.error('[CKYC Deferred Admin] Failed to get compliance events:', error);
    res.status(500).json({ success: false, error: 'Failed to get compliance events' });
  }
});

export default router;
