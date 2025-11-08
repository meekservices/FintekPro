/**
 * KYC Priority Workflow Routes
 * 
 * Handles KYC verification using the 4-tier priority workflow:
 * 1. CKYC Lookup (fastest)
 * 2. KRA eKYC (5 agencies in parallel)
 * 3. Video KYC (HyperVerge/SignDesk)
 * 4. Manual KYC (final fallback)
 */

import type { Request, Response } from 'express';
import { z } from 'zod';
import { kycPriorityOrchestrator } from './services/kyc-priority-orchestrator';
import { db } from './db';
import { kycWorkflows, kycVerificationAttempts } from '@shared/schema';
import { eq, desc } from 'drizzle-orm';
import { logger } from './services/logger';
import { apiResponse } from './utils/responses';

// Middleware to require authentication
const requireAuth = (req: any, res: Response, next: any) => {
  if (!req.user) {
    return apiResponse.unauthorized(res, 'Authentication required');
  }
  next();
};

// Middleware to require client or higher role
const requireClientOrHigher = (req: any, res: Response, next: any) => {
  if (!req.user) {
    return apiResponse.unauthorized(res, 'Authentication required');
  }
  
  const allowedRoles = ['client', 'partner', 'admin', 'super_admin'];
  if (!allowedRoles.includes(req.user.role)) {
    return apiResponse.forbidden(res, 'Client access or higher required');
  }
  
  next();
};

// Middleware to require admin role
const requireAdmin = (req: any, res: Response, next: any) => {
  if (!req.user) {
    return apiResponse.unauthorized(res, 'Authentication required');
  }
  
  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    return apiResponse.forbidden(res, 'Admin access required');
  }
  
  next();
};

export function registerKYCPriorityRoutes(app: any) {

  /**
   * Initiate KYC Priority Workflow
   * POST /api/kyc/priority/initiate
   */
  app.post('/api/kyc/priority/initiate', requireClientOrHigher, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    // Validate request body
    const schema = z.object({
      panNumber: z.string().min(10).max(10),
      aadhaarNumber: z.string().optional(),
      dateOfBirth: z.string().optional(),
      name: z.string(),
      mobile: z.string().optional(),
      email: z.string().email().optional(),
    });

    const validated = schema.parse(req.body);

    logger.info('KYC Priority Workflow initiation requested', {
      userId,
      hasPan: !!validated.panNumber,
      hasAadhaar: !!validated.aadhaarNumber,
    });

    // Execute workflow
    const result = await kycPriorityOrchestrator.executeWorkflow({
      userId,
      panNumber: validated.panNumber,
      aadhaarNumber: validated.aadhaarNumber,
      dateOfBirth: validated.dateOfBirth,
      name: validated.name,
      mobile: validated.mobile,
      email: validated.email,
    });

    logger.info('KYC Priority Workflow completed', {
      userId,
      status: result.status,
      method: result.method,
    });

    return res.json({
      success: true,
      data: {
        workflowId: result.workflowId,
        status: result.status,
        method: result.method,
        message: result.message,
        ckycKinNumber: result.ckycKinNumber,
        attemptsSummary: result.attemptsSummary,
      },
    });
  } catch (error: any) {
    logger.error('KYC Priority Workflow initiation failed', {
      error: error.message,
      userId: (req as any).user?.id,
    });

    // Handle validation errors
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request data',
        errors: error.errors,
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to initiate KYC workflow',
      error: error.message,
    });
  }
});

  /**
   * Get KYC Workflow Status
   * GET /api/kyc/priority/status/:userId
   */
  app.get('/api/kyc/priority/status/:userId', requireAuth, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const requestingUserId = (req as any).user?.id;

    // Authorization: Users can only view their own status, admin/super_admin can view any
    const userRole = (req as any).user?.role;
    const isPrivileged = userRole === 'admin' || userRole === 'super_admin';
    if (!isPrivileged && requestingUserId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to view this workflow status',
      });
    }

    // Get latest workflow for user
    const workflows = await db
      .select()
      .from(kycWorkflows)
      .where(eq(kycWorkflows.userId, userId))
      .orderBy(desc(kycWorkflows.initiatedAt))
      .limit(1);

    if (workflows.length === 0) {
      return res.json({
        success: true,
        data: {
          hasWorkflow: false,
          message: 'No KYC workflow found for this user',
        },
      });
    }

    const workflow = workflows[0];

    // Get verification attempts for this workflow
    const attempts = await db
      .select()
      .from(kycVerificationAttempts)
      .where(eq(kycVerificationAttempts.workflowId, workflow.id))
      .orderBy(desc(kycVerificationAttempts.attemptedAt));

    return res.json({
      success: true,
      data: {
        hasWorkflow: true,
        workflow: {
          id: workflow.id,
          status: workflow.status,
          currentMethod: workflow.currentMethod,
          attemptedMethods: workflow.attemptedMethods,
          verifiedAt: workflow.verifiedAt,
          initiatedAt: workflow.initiatedAt,
          completedAt: workflow.completedAt,
          // videoKycSessionId is internal - not exposed to prevent session hijacking
        },
        attempts: attempts.map((attempt) => ({
          id: attempt.id,
          verificationMethod: attempt.verificationMethod,
          provider: attempt.provider,
          outcome: attempt.outcome,
          responseCode: attempt.responseCode,
          latencyMs: attempt.latencyMs,
          attemptedAt: attempt.attemptedAt,
          dataCompleteness: attempt.dataCompleteness,
          dataFreshness: attempt.dataFreshness,
        })),
        summary: {
          totalAttempts: attempts.length,
          successfulAttempts: attempts.filter((a) => a.outcome === 'success').length,
          failedAttempts: attempts.filter((a) => a.outcome === 'failure').length,
        },
      },
    });
  } catch (error: any) {
    logger.error('Failed to fetch KYC workflow status', {
      error: error.message,
      userId: req.params.userId,
    });

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch workflow status',
      error: error.message,
    });
  }
});

  /**
   * Get All Workflows (Admin only)
   * GET /api/kyc/priority/workflows
   */
  app.get('/api/kyc/priority/workflows', requireAdmin, async (req: Request, res: Response) => {
  try {
    // requireAdmin middleware already ensures admin/super_admin access
    const { status, limit = '50', offset = '0' } = req.query;

    // Build query
    const queryBuilder = db
      .select()
      .from(kycWorkflows)
      .orderBy(desc(kycWorkflows.initiatedAt))
      .limit(parseInt(limit as string))
      .offset(parseInt(offset as string));

    // Filter by status if provided and execute query
    const workflows = status && typeof status === 'string'
      ? await queryBuilder.where(eq(kycWorkflows.status, status as any))
      : await queryBuilder;

    return res.json({
      success: true,
      data: {
        workflows: workflows.map((w) => ({
          id: w.id,
          userId: w.userId,
          status: w.status,
          currentMethod: w.currentMethod,
          attemptedMethods: w.attemptedMethods,
          verifiedAt: w.verifiedAt,
          initiatedAt: w.initiatedAt,
        })),
        pagination: {
          limit: parseInt(limit as string),
          offset: parseInt(offset as string),
        },
      },
    });
  } catch (error: any) {
    logger.error('Failed to fetch KYC workflows', {
      error: error.message,
    });

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch workflows',
      error: error.message,
    });
  }
  });
}
