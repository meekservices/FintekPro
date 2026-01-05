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
        estimatedMonthlySavings: stats.apiUsage.estimatedSavings * (30 / 30), // Extrapolate
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
    
    const result = await dataCacheService['db']?.execute(`
      SELECT 
        provider,
        COUNT(*) as total_calls,
        COUNT(*) FILTER (WHERE cache_hit = true) as cache_hits,
        COUNT(*) FILTER (WHERE cache_hit = false) as api_calls,
        ROUND(100.0 * COUNT(*) FILTER (WHERE cache_hit = true) / NULLIF(COUNT(*), 0), 2) as hit_rate_percent,
        COALESCE(SUM(estimated_cost_inr), 0) as total_cost,
        COALESCE(SUM(CASE WHEN cache_hit = true THEN estimated_cost_inr ELSE 0 END), 0) as saved_cost
      FROM api_usage_tracking
      WHERE created_at > NOW() - INTERVAL '${days} days'
      GROUP BY provider
      ORDER BY total_calls DESC
    `);
    
    res.json({
      success: true,
      period: `Last ${days} days`,
      data: result?.rows || []
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
    const result = await dataCacheService['db']?.execute(`
      SELECT * FROM cache_refresh_schedule
      ORDER BY priority ASC
    `);
    
    res.json({
      success: true,
      data: result?.rows || []
    });
  } catch (error: any) {
    console.error('Error fetching schedules:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
