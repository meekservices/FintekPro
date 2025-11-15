/**
 * KYC Tier Management Routes
 * 
 * Handles tier status checks, upgrade requests, and admin approval workflows.
 * Mounted at /api/kyc/tiers/* from main routes file.
 */

import express, { Router } from 'express';
import { z } from 'zod';
import {
  getUserTierStatus,
  requestTierUpgrade,
  approveTierUpgrade,
  rejectTierUpgrade,
  TierUpgradeRequest
} from './services/kyc-tier-service';
import { logger } from './logger';

const router: Router = express.Router();

/**
 * GET /api/kyc/tiers/status
 * 
 * Get comprehensive tier status for the authenticated user.
 * Returns current tier, eligibility, verification status, and product access.
 */
router.get('/status', async (req: any, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Authentication required' 
      });
    }

    const userId = req.user.id;
    const tierStatus = await getUserTierStatus(userId);

    logger.info('KYC tier status retrieved', {
      userId,
      currentTier: tierStatus.currentTier,
      eligibleForUpgrade: tierStatus.eligibleForUpgrade,
      nextTier: tierStatus.nextTier
    });

    return res.json({
      success: true,
      data: tierStatus
    });

  } catch (error: any) {
    logger.error('Error retrieving tier status', {
      userId: req.user?.id,
      error: error.message,
      stack: error.stack
    });

    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve tier status',
      error: error.message
    });
  }
});

/**
 * POST /api/kyc/tiers/request-upgrade
 * 
 * Request a tier upgrade (Tier 1→2 or Tier 2→3).
 * Tier 1→2 is auto-approved if verifications are complete.
 * Tier 2→3 requires manual compliance review and approval.
 */
const upgradeRequestSchema = z.object({
  targetTier: z.enum(['basic', 'enhanced', 'accredited_investor']),
  metadata: z.record(z.any()).optional()
});

router.post('/request-upgrade', async (req: any, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Authentication required' 
      });
    }

    // Validate request body
    const validation = upgradeRequestSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request data',
        errors: validation.error.errors
      });
    }

    const { targetTier, metadata } = validation.data;
    const userId = req.user.id;

    // Prepare upgrade request
    const upgradeRequest: TierUpgradeRequest = {
      userId,
      targetTier,
      requestedBy: userId,
      metadata
    };

    // Execute upgrade request
    const result = await requestTierUpgrade(upgradeRequest);

    logger.info('KYC tier upgrade requested', {
      userId,
      targetTier,
      success: result.success,
      requiresManualApproval: result.requiresManualApproval,
      upgradeEventId: result.upgradeEventId
    });

    return res.json({
      success: result.success,
      message: result.message,
      requiresManualApproval: result.requiresManualApproval,
      nextSteps: result.nextSteps,
      upgradeEventId: result.upgradeEventId
    });

  } catch (error: any) {
    logger.error('Error requesting tier upgrade', {
      userId: req.user?.id,
      error: error.message,
      stack: error.stack
    });

    return res.status(500).json({
      success: false,
      message: 'Failed to process upgrade request',
      error: error.message
    });
  }
});

/**
 * POST /api/kyc/tiers/approve
 * 
 * Admin endpoint: Approve a pending tier upgrade request.
 * Typically used for Tier 2→3 compliance review approvals.
 */
const approvalSchema = z.object({
  eventId: z.string().min(1),
  notes: z.string().optional()
});

router.post('/approve', async (req: any, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Authentication required' 
      });
    }

    // Check admin role
    if (req.user.role !== 'admin') {
      logger.warn('Unauthorized tier approval attempt', {
        userId: req.user.id,
        userRole: req.user.role
      });
      
      return res.status(403).json({
        success: false,
        message: 'Admin privileges required'
      });
    }

    // Validate request body
    const validation = approvalSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request data',
        errors: validation.error.errors
      });
    }

    const { eventId, notes } = validation.data;
    const approvedBy = req.user.id;

    // Execute approval
    const result = await approveTierUpgrade(eventId, approvedBy, notes);

    logger.info('KYC tier upgrade approved', {
      eventId,
      approvedBy,
      success: result.success
    });

    return res.json({
      success: result.success,
      message: result.message,
      upgradeEventId: result.upgradeEventId
    });

  } catch (error: any) {
    logger.error('Error approving tier upgrade', {
      adminId: req.user?.id,
      error: error.message,
      stack: error.stack
    });

    return res.status(500).json({
      success: false,
      message: 'Failed to approve upgrade',
      error: error.message
    });
  }
});

/**
 * POST /api/kyc/tiers/reject
 * 
 * Admin endpoint: Reject a pending tier upgrade request.
 * Requires rejection reason for audit trail and user notification.
 */
const rejectionSchema = z.object({
  eventId: z.string().min(1),
  reason: z.string().min(10, 'Rejection reason must be at least 10 characters')
});

router.post('/reject', async (req: any, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Authentication required' 
      });
    }

    // Check admin role
    if (req.user.role !== 'admin') {
      logger.warn('Unauthorized tier rejection attempt', {
        userId: req.user.id,
        userRole: req.user.role
      });
      
      return res.status(403).json({
        success: false,
        message: 'Admin privileges required'
      });
    }

    // Validate request body
    const validation = rejectionSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request data',
        errors: validation.error.errors
      });
    }

    const { eventId, reason } = validation.data;
    const rejectedBy = req.user.id;

    // Execute rejection
    const result = await rejectTierUpgrade(eventId, rejectedBy, reason);

    logger.info('KYC tier upgrade rejected', {
      eventId,
      rejectedBy,
      reason,
      success: result.success
    });

    return res.json({
      success: result.success,
      message: result.message,
      upgradeEventId: result.upgradeEventId
    });

  } catch (error: any) {
    logger.error('Error rejecting tier upgrade', {
      adminId: req.user?.id,
      error: error.message,
      stack: error.stack
    });

    return res.status(500).json({
      success: false,
      message: 'Failed to reject upgrade',
      error: error.message
    });
  }
});

export default router;
