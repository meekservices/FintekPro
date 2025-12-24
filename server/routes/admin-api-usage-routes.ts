import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middleware/roleMiddleware';
import { apiUsageTrackingService } from '../services/api-usage-tracking-service';

const router = Router();

const updatePricingSchema = z.object({
  providerName: z.string().min(1),
  costPerCall: z.number().min(0).max(10000),
});

const addProviderSchema = z.object({
  providerName: z.string().min(1).max(100),
  displayName: z.string().min(1).max(255),
  description: z.string().optional(),
  costPerCall: z.number().min(0).max(10000),
  currency: z.string().default('INR'),
});

router.get('/api/admin/api-usage/providers', requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const providers = await apiUsageTrackingService.getProviderPricing();
    res.json({ success: true, providers });
  } catch (error) {
    console.error('[Admin API Usage] Error fetching providers:', error);
    res.status(500).json({ error: 'Failed to fetch API providers' });
  }
});

router.patch('/api/admin/api-usage/pricing', requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const adminId = (req.user as any)?.id;
    if (!adminId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const validated = updatePricingSchema.parse(req.body);
    const result = await apiUsageTrackingService.updateProviderPricing(
      validated.providerName,
      validated.costPerCall,
      adminId
    );

    if (!result.success) {
      return res.status(400).json({ error: result.message });
    }

    res.json({ success: true, message: result.message });
  } catch (error) {
    console.error('[Admin API Usage] Error updating pricing:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to update provider pricing' });
  }
});

router.post('/api/admin/api-usage/providers', requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const adminId = (req.user as any)?.id;
    if (!adminId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const validated = addProviderSchema.parse(req.body);
    const result = await apiUsageTrackingService.addProvider(validated, adminId);

    if (!result.success) {
      return res.status(400).json({ error: result.message });
    }

    res.json({ success: true, message: result.message });
  } catch (error) {
    console.error('[Admin API Usage] Error adding provider:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to add provider' });
  }
});

router.get('/api/admin/api-usage/stats', requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    
    const start = startDate ? new Date(startDate as string) : undefined;
    const end = endDate ? new Date(endDate as string) : undefined;
    
    const stats = await apiUsageTrackingService.getUsageStats(start, end);
    res.json({ success: true, stats });
  } catch (error) {
    console.error('[Admin API Usage] Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch usage stats' });
  }
});

router.get('/api/admin/api-usage/monthly-estimate', requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const estimate = await apiUsageTrackingService.getMonthlyEstimate();
    res.json({ success: true, ...estimate });
  } catch (error) {
    console.error('[Admin API Usage] Error fetching monthly estimate:', error);
    res.status(500).json({ error: 'Failed to fetch monthly estimate' });
  }
});

router.get('/api/admin/api-usage/daily', requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const dailyUsage = await apiUsageTrackingService.getDailyUsage(days);
    res.json({ success: true, dailyUsage });
  } catch (error) {
    console.error('[Admin API Usage] Error fetching daily usage:', error);
    res.status(500).json({ error: 'Failed to fetch daily usage' });
  }
});

router.get('/api/admin/api-usage/summary', requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const [providers, monthlyEstimate, dailyUsage] = await Promise.all([
      apiUsageTrackingService.getProviderPricing(),
      apiUsageTrackingService.getMonthlyEstimate(),
      apiUsageTrackingService.getDailyUsage(30),
    ]);

    res.json({
      success: true,
      providers,
      monthlyEstimate,
      dailyUsage,
    });
  } catch (error) {
    console.error('[Admin API Usage] Error fetching summary:', error);
    res.status(500).json({ error: 'Failed to fetch usage summary' });
  }
});

export default router;
