/**
 * Admin Aadhaar Provider Configuration Routes
 * 
 * Allows administrators to:
 * - View all available Aadhaar verification providers
 * - Toggle active provider
 * - Update provider pricing
 * - View usage statistics
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { unifiedAadhaarService, AadhaarProvider } from '../services/unified-aadhaar-service';
import { TruthscreenAadhaarService } from '../services/truthscreen-aadhaar-service';
import { requireAuth, requireRole } from '../middleware/roleMiddleware';

const router = Router();

const setProviderSchema = z.object({
  provider: z.enum(['cashfree-bank', 'truthscreen-aadhaar', 'sandbox-pan', 'offline_xml']),
});

const updatePricingSchema = z.object({
  provider: z.enum(['cashfree-bank', 'truthscreen-aadhaar', 'sandbox-pan', 'offline_xml']),
  pricePerVerification: z.number().min(0).max(1000),
});

router.get('/api/admin/aadhaar/providers', requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const activeProvider = unifiedAadhaarService.getActiveProvider();
    const providers = unifiedAadhaarService.getProviderConfigs();

    res.json({
      success: true,
      activeProvider,
      providers,
    });
  } catch (error) {
    console.error('[Admin Aadhaar] Error fetching providers:', error);
    res.status(500).json({ error: 'Failed to fetch Aadhaar providers' });
  }
});

router.get('/api/admin/aadhaar/active-provider', requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const activeProvider = unifiedAadhaarService.getActiveProvider();
    const config = unifiedAadhaarService.getProviderConfig(activeProvider);
    
    res.json({
      success: true,
      activeProvider,
      config,
    });
  } catch (error) {
    console.error('[Admin Aadhaar] Error fetching active provider:', error);
    res.status(500).json({ error: 'Failed to fetch active provider' });
  }
});

router.post('/api/admin/aadhaar/set-provider', requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const validated = setProviderSchema.parse(req.body);
    
    const result = unifiedAadhaarService.setActiveProvider(
      validated.provider as AadhaarProvider,
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
    console.error('[Admin Aadhaar] Error setting provider:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to set Aadhaar provider' });
  }
});

router.patch('/api/admin/aadhaar/pricing', requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const validated = updatePricingSchema.parse(req.body);
    
    const result = unifiedAadhaarService.updateProviderPricing(
      validated.provider as AadhaarProvider,
      validated.pricePerVerification,
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
    console.error('[Admin Aadhaar] Error updating pricing:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to update provider pricing' });
  }
});

router.get('/api/admin/aadhaar/usage', requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const stats = unifiedAadhaarService.getProviderUsageStats();
    
    res.json({
      success: true,
      stats,
      mockData: true,
      note: 'Usage statistics are mock data. Real usage tracking will be implemented when transaction logging is enabled.',
    });
  } catch (error) {
    console.error('[Admin Aadhaar] Error fetching usage stats:', error);
    res.status(500).json({ error: 'Failed to fetch usage statistics' });
  }
});

router.get('/api/admin/aadhaar/cheapest-provider', requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const cheapestProvider = unifiedAadhaarService.getCheapestConfiguredProvider();
    
    if (!cheapestProvider) {
      return res.json({
        success: true,
        cheapestProvider: null,
        config: null,
        recommendation: 'No providers are currently configured. Please configure at least one Aadhaar verification provider.',
      });
    }
    
    const config = unifiedAadhaarService.getProviderConfig(cheapestProvider);
    
    res.json({
      success: true,
      cheapestProvider,
      config,
      recommendation: `Switch to ${config?.name} to save on Aadhaar verification costs (₹${config?.pricePerVerification}/verification)`,
    });
  } catch (error) {
    console.error('[Admin Aadhaar] Error fetching cheapest provider:', error);
    res.status(500).json({ error: 'Failed to fetch cheapest provider' });
  }
});

router.get('/api/admin/aadhaar/provider/:provider', requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const { provider } = req.params;
    const config = unifiedAadhaarService.getProviderConfig(provider as AadhaarProvider);
    
    if (!config) {
      return res.status(404).json({ error: 'Provider not found' });
    }

    res.json({
      success: true,
      config,
    });
  } catch (error) {
    console.error('[Admin Aadhaar] Error fetching provider config:', error);
    res.status(500).json({ error: 'Failed to fetch provider configuration' });
  }
});

/**
 * Check CKYC/KRA Status via Truthscreen
 * Returns KYC validation status from all KRAs (CVL, NDML, Karvy, etc.)
 */
router.post('/api/ckyc/status', requireAuth, async (req: Request, res: Response) => {
  try {
    const { pan } = req.body;
    
    if (!pan) {
      return res.status(400).json({
        success: false,
        message: 'PAN number is required'
      });
    }

    const ckycStatus = await TruthscreenAadhaarService.checkCKYCStatus(pan);
    
    res.json(ckycStatus);
  } catch (error) {
    console.error('[CKYC Status] Error checking CKYC status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check CKYC status'
    });
  }
});

/**
 * Admin route to check CKYC status for any PAN
 */
router.post('/api/admin/ckyc/status', requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const { pan } = req.body;
    
    if (!pan) {
      return res.status(400).json({
        success: false,
        message: 'PAN number is required'
      });
    }

    const ckycStatus = await TruthscreenAadhaarService.checkCKYCStatus(pan);
    
    res.json({
      ...ckycStatus,
      provider: 'truthscreen-ckyc',
      checkedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Admin CKYC] Error checking CKYC status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check CKYC status'
    });
  }
});

/**
 * Check PAN-Aadhaar linkage via Truthscreen
 */
router.post('/api/verification/pan-aadhaar-linkage', requireAuth, async (req: Request, res: Response) => {
  try {
    const { pan, aadhaar } = req.body;
    
    if (!pan || !aadhaar) {
      return res.status(400).json({
        success: false,
        message: 'PAN and Aadhaar numbers are required'
      });
    }

    const linkageStatus = await TruthscreenAadhaarService.checkPanAadhaarLinkage(pan, aadhaar);
    
    res.json(linkageStatus);
  } catch (error) {
    console.error('[PAN-Aadhaar Linkage] Error checking linkage:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check PAN-Aadhaar linkage'
    });
  }
});

export default router;
