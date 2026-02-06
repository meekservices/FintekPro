/**
 * Admin eSign Provider Configuration Routes
 * 
 * Allows administrators to:
 * - View all available eSign providers
 * - Toggle active provider
 * - Update provider pricing
 * - View usage statistics
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { unifiedESignService, ESignProvider } from '../services/unified-esign-service';
import { requireAuth, requireRole } from '../middleware/roleMiddleware';

const router = Router();

const setProviderSchema = z.object({
  provider: z.enum(['authbridge', 'protean', 'emudhra', 'cvl', 'dsc_token', 'user_signature']),
});

const updatePricingSchema = z.object({
  provider: z.enum(['authbridge', 'protean', 'emudhra', 'cvl', 'dsc_token', 'user_signature']),
  pricePerSign: z.number().min(0).max(1000),
});

router.get('/api/admin/esign/providers', requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const activeProvider = await unifiedESignService.getActiveProvider();
    const providers = await unifiedESignService.getProviderConfigs();

    res.json({
      success: true,
      activeProvider,
      providers,
    });
  } catch (error) {
    console.error('[Admin eSign] Error fetching providers:', error);
    res.status(500).json({ error: 'Failed to fetch eSign providers' });
  }
});

router.get('/api/admin/esign/active-provider', requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const activeProvider = await unifiedESignService.getActiveProvider();
    const config = unifiedESignService.getProviderConfig(activeProvider);
    
    res.json({
      success: true,
      activeProvider,
      config,
    });
  } catch (error) {
    console.error('[Admin eSign] Error fetching active provider:', error);
    res.status(500).json({ error: 'Failed to fetch active provider' });
  }
});

router.post('/api/admin/esign/set-provider', requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const validated = setProviderSchema.parse(req.body);
    
    const result = await unifiedESignService.setActiveProvider(
      validated.provider as ESignProvider,
      userId
    );

    if (!result.success) {
      return res.status(400).json({ error: result.message });
    }

    res.json({
      success: true,
      message: result.message,
      activeProvider: validated.provider,
    });
  } catch (error) {
    console.error('[Admin eSign] Error setting provider:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to set eSign provider' });
  }
});

router.post('/api/admin/esign/update-pricing', requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const validated = updatePricingSchema.parse(req.body);
    
    const result = await unifiedESignService.updateProviderPricing(
      validated.provider as ESignProvider,
      validated.pricePerSign,
      userId
    );

    if (!result.success) {
      return res.status(400).json({ error: result.message });
    }

    res.json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    console.error('[Admin eSign] Error updating pricing:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to update provider pricing' });
  }
});

router.get('/api/admin/esign/cheapest-provider', requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const cheapestProvider = await unifiedESignService.getCheapestConfiguredProvider();
    const config = unifiedESignService.getProviderConfig(cheapestProvider);
    
    res.json({
      success: true,
      cheapestProvider,
      config,
      recommendation: `Switch to ${config?.displayName} to save on eSign costs (₹${config?.pricingPerSign}/sign)`,
    });
  } catch (error) {
    console.error('[Admin eSign] Error fetching cheapest provider:', error);
    res.status(500).json({ error: 'Failed to fetch cheapest provider' });
  }
});

router.get('/api/admin/esign/usage-stats', requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const stats = await unifiedESignService.getProviderUsageStats();
    
    res.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error('[Admin eSign] Error fetching usage stats:', error);
    res.status(500).json({ error: 'Failed to fetch usage statistics' });
  }
});

router.get('/api/admin/esign/all-requests', requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const requests = await unifiedESignService.getAllESignRequests();
    res.json(requests);
  } catch (error) {
    console.error('[Admin eSign] Error fetching all requests:', error);
    res.status(500).json({ error: 'Failed to fetch eSign requests' });
  }
});

router.get('/api/admin/esign/provider/:provider', requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const { provider } = req.params;
    const config = unifiedESignService.getProviderConfig(provider as ESignProvider);
    
    if (!config) {
      return res.status(404).json({ error: 'Provider not found' });
    }

    res.json({
      success: true,
      config,
    });
  } catch (error) {
    console.error('[Admin eSign] Error fetching provider config:', error);
    res.status(500).json({ error: 'Failed to fetch provider configuration' });
  }
});

export default router;
