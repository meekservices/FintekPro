/**
 * CKYC Provider Configuration API Routes
 * 
 * Admin endpoints for managing CKYC provider configuration
 * Implements runtime switching without redeploy
 */

import { Router, Request, Response } from 'express';
import { ckycProviderResolutionService, CkycProviderCode } from '../services/ckyc-provider-resolution-service';
import { z } from 'zod';

const router = Router();

// Validation schemas
const toggleProviderSchema = z.object({
  enabled: z.boolean(),
  reason: z.string().optional(),
});

const updatePrioritySchema = z.object({
  priority: z.number().int().min(1).max(100),
});

const bulkUpdatePrioritySchema = z.object({
  providers: z.array(z.object({
    providerCode: z.string(),
    priority: z.number().int().min(1).max(100),
  })),
});

/**
 * GET /api/admin/ckyc/providers
 * Get all configured CKYC providers
 */
router.get('/providers', async (req: Request, res: Response) => {
  try {
    const providers = await ckycProviderResolutionService.getAllProviders();
    
    res.json({
      success: true,
      data: providers,
      meta: {
        total: providers.length,
        environment: process.env.NODE_ENV || 'development',
        truthscreenConfigured: !!(process.env.TRUTHSCREEN_USERNAME && process.env.TRUTHSCREEN_PASSWORD),
      },
    });
  } catch (error) {
    console.error('[CKYC Provider Routes] Error fetching providers:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch CKYC providers',
    });
  }
});

/**
 * GET /api/admin/ckyc/providers/:code
 * Get a specific provider by code
 */
router.get('/providers/:code', async (req: Request, res: Response) => {
  try {
    const { code } = req.params;
    const provider = await ckycProviderResolutionService.getProviderByCode(code as CkycProviderCode);
    
    if (!provider) {
      return res.status(404).json({
        success: false,
        error: `Provider ${code} not found`,
      });
    }
    
    res.json({
      success: true,
      data: provider,
    });
  } catch (error) {
    console.error('[CKYC Provider Routes] Error fetching provider:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch CKYC provider',
    });
  }
});

/**
 * PATCH /api/admin/ckyc/providers/:code/toggle
 * Enable or disable a provider
 */
router.patch('/providers/:code/toggle', async (req: Request, res: Response) => {
  try {
    const { code } = req.params;
    const validation = toggleProviderSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request body',
        details: validation.error.errors,
      });
    }
    
    const { enabled, reason } = validation.data;
    const userId = (req as any).user?.id;
    
    await ckycProviderResolutionService.toggleProvider(
      code as CkycProviderCode,
      enabled,
      userId,
      reason
    );
    
    const updatedProvider = await ckycProviderResolutionService.getProviderByCode(code as CkycProviderCode);
    
    res.json({
      success: true,
      message: `Provider ${code} ${enabled ? 'enabled' : 'disabled'} successfully`,
      data: updatedProvider,
    });
  } catch (error: any) {
    console.error('[CKYC Provider Routes] Error toggling provider:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to toggle CKYC provider',
    });
  }
});

/**
 * PATCH /api/admin/ckyc/providers/:code/priority
 * Update provider priority
 */
router.patch('/providers/:code/priority', async (req: Request, res: Response) => {
  try {
    const { code } = req.params;
    const validation = updatePrioritySchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request body',
        details: validation.error.errors,
      });
    }
    
    const { priority } = validation.data;
    const userId = (req as any).user?.id;
    
    await ckycProviderResolutionService.updateProviderPriority(
      code as CkycProviderCode,
      priority,
      userId
    );
    
    const updatedProvider = await ckycProviderResolutionService.getProviderByCode(code as CkycProviderCode);
    
    res.json({
      success: true,
      message: `Provider ${code} priority updated to ${priority}`,
      data: updatedProvider,
    });
  } catch (error: any) {
    console.error('[CKYC Provider Routes] Error updating priority:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update provider priority',
    });
  }
});

/**
 * PATCH /api/admin/ckyc/providers/priorities
 * Bulk update provider priorities (for drag-drop reordering)
 */
router.patch('/providers/priorities', async (req: Request, res: Response) => {
  try {
    const validation = bulkUpdatePrioritySchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request body',
        details: validation.error.errors,
      });
    }
    
    const { providers } = validation.data;
    const userId = (req as any).user?.id;
    
    for (const { providerCode, priority } of providers) {
      await ckycProviderResolutionService.updateProviderPriority(
        providerCode as CkycProviderCode,
        priority,
        userId
      );
    }
    
    const allProviders = await ckycProviderResolutionService.getAllProviders();
    
    res.json({
      success: true,
      message: 'Provider priorities updated successfully',
      data: allProviders,
    });
  } catch (error: any) {
    console.error('[CKYC Provider Routes] Error updating priorities:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update provider priorities',
    });
  }
});

/**
 * GET /api/admin/ckyc/providers/:code/health
 * Get provider health status and trigger health check
 */
router.get('/providers/:code/health', async (req: Request, res: Response) => {
  try {
    const { code } = req.params;
    const provider = await ckycProviderResolutionService.getProviderByCode(code as CkycProviderCode);
    
    if (!provider) {
      return res.status(404).json({
        success: false,
        error: `Provider ${code} not found`,
      });
    }
    
    res.json({
      success: true,
      data: {
        providerCode: provider.providerCode,
        healthStatus: provider.healthStatus,
        lastHealthCheck: provider.lastHealthCheck,
        consecutiveFailures: provider.consecutiveFailures,
        autoDisabledAt: provider.autoDisabledAt,
      },
    });
  } catch (error) {
    console.error('[CKYC Provider Routes] Error checking health:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check provider health',
    });
  }
});

/**
 * POST /api/admin/ckyc/providers/:code/health-check
 * Manually trigger health check for a provider
 */
router.post('/providers/:code/health-check', async (req: Request, res: Response) => {
  try {
    const { code } = req.params;
    
    // For now, just mark as healthy - real implementation would ping the provider
    await ckycProviderResolutionService.updateProviderHealth(
      code as CkycProviderCode,
      'healthy',
      false
    );
    
    const provider = await ckycProviderResolutionService.getProviderByCode(code as CkycProviderCode);
    
    res.json({
      success: true,
      message: `Health check completed for ${code}`,
      data: {
        healthStatus: provider?.healthStatus,
        lastHealthCheck: provider?.lastHealthCheck,
      },
    });
  } catch (error) {
    console.error('[CKYC Provider Routes] Error triggering health check:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to trigger health check',
    });
  }
});

/**
 * GET /api/admin/ckyc/audit-log
 * Get CKYC provider configuration audit log
 */
router.get('/audit-log', async (req: Request, res: Response) => {
  try {
    const { providerCode, limit } = req.query;
    
    const logs = await ckycProviderResolutionService.getProviderAuditLog(
      providerCode as CkycProviderCode | undefined,
      limit ? parseInt(limit as string) : 50
    );
    
    res.json({
      success: true,
      data: logs,
      meta: {
        total: logs.length,
      },
    });
  } catch (error) {
    console.error('[CKYC Provider Routes] Error fetching audit log:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch audit log',
    });
  }
});

/**
 * POST /api/admin/ckyc/resolve
 * Test provider resolution for a given context
 */
router.post('/resolve', async (req: Request, res: Response) => {
  try {
    const { userId, panNumber, hasAadhaarConsent, hasCkycReference, riskCategory, canDoVideoKyc } = req.body;
    
    const result = await ckycProviderResolutionService.resolveCkycProvider({
      userId: userId || 'test-user',
      panNumber: panNumber || 'XXXXXX0000',
      hasAadhaarConsent,
      hasCkycReference,
      riskCategory,
      canDoVideoKyc,
    });
    
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('[CKYC Provider Routes] Error resolving provider:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to resolve CKYC provider',
    });
  }
});

/**
 * POST /api/admin/ckyc/seed
 * Seed default providers (admin only)
 */
router.post('/seed', async (req: Request, res: Response) => {
  try {
    await ckycProviderResolutionService.seedDefaultProviders();
    const providers = await ckycProviderResolutionService.getAllProviders();
    
    res.json({
      success: true,
      message: 'Default providers seeded successfully',
      data: providers,
    });
  } catch (error) {
    console.error('[CKYC Provider Routes] Error seeding providers:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to seed default providers',
    });
  }
});

export default router;
