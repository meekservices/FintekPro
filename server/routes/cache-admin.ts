/**
 * Cache Admin Routes
 * 
 * Provides admin endpoints for monitoring and managing the data cache system.
 */

import { Router } from 'express';
import { dataCacheService } from '../services/unified-data-cache-service';
import { cacheCleanupScheduler } from '../services/cache-cleanup-scheduler';

const router = Router();

/**
 * GET /api/admin/cache/stats
 * Get cache statistics and cost savings
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await dataCacheService.getCacheStats();
    
    res.json({
      success: true,
      data: {
        ...stats,
        cacheTTLs: {
          companyMaster: 'Permanent (no expiry)',
          verifications: '24 months',
          financials: '120 days (quarterly)',
          marketQuotes: '15 seconds',
          marketIndices: '5 minutes',
          marketNAVs: '24 hours',
        },
        estimatedMonthlySavings: stats.apiUsage.estimatedSavings,
      }
    });
  } catch (error: any) {
    console.error('Error fetching cache stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/admin/cache/cleanup
 * Trigger manual cache cleanup
 */
router.post('/cleanup', async (req, res) => {
  try {
    const result = await cacheCleanupScheduler.triggerManualCleanup();
    
    res.json({
      success: true,
      message: `Cleaned up ${result.deleted} expired cache entries`,
      deleted: result.deleted
    });
  } catch (error: any) {
    console.error('Error during cache cleanup:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/admin/cache/api-usage
 * Get detailed API usage breakdown
 */
router.get('/api-usage', async (req, res) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const data = await dataCacheService.getApiUsageBreakdown(days);
    
    res.json({
      success: true,
      period: `Last ${days} days`,
      data
    });
  } catch (error: any) {
    console.error('Error fetching API usage:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/admin/cache/schedules
 * Get cache refresh schedules
 */
router.get('/schedules', async (req, res) => {
  try {
    const data = await dataCacheService.getRefreshSchedules();
    
    res.json({
      success: true,
      data
    });
  } catch (error: any) {
    console.error('Error fetching schedules:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
