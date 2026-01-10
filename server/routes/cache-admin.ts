/**
 * Cache Admin Routes
 * 
 * Provides admin endpoints for monitoring and managing the data cache system.
 */

import { Router } from 'express';
import { dataCacheService } from '../services/unified-data-cache-service';
import { cacheCleanupScheduler } from '../services/cache-cleanup-scheduler';
import { requestDedupeService } from '../services/request-deduplication-service';
import { aiResponseCacheService } from '../services/ai-response-cache-service';

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

/**
 * GET /api/admin/cache/deduplication
 * Get request deduplication metrics - shows API calls saved
 */
router.get('/deduplication', async (req, res) => {
  try {
    const metrics = requestDedupeService.getMetrics();
    
    res.json({
      success: true,
      data: {
        ...metrics,
        description: 'Request deduplication prevents duplicate in-flight API requests for the same resource',
        benefits: [
          'Reduces API costs by eliminating redundant requests',
          'Improves response times for deduplicated calls',
          'Prevents rate limit issues from burst requests'
        ]
      }
    });
  } catch (error: any) {
    console.error('Error fetching deduplication metrics:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/admin/cache/deduplication/reset
 * Reset deduplication metrics
 */
router.post('/deduplication/reset', async (req, res) => {
  try {
    requestDedupeService.resetMetrics();
    
    res.json({
      success: true,
      message: 'Deduplication metrics reset successfully'
    });
  } catch (error: any) {
    console.error('Error resetting deduplication metrics:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/admin/cache/ai-responses
 * Get AI response cache metrics and cost savings
 */
router.get('/ai-responses', async (req, res) => {
  try {
    const metrics = aiResponseCacheService.getMetrics();
    
    res.json({
      success: true,
      data: {
        ...metrics,
        description: 'AI response caching reduces Gemini API costs by caching similar recommendation requests',
        cachedTypes: [
          { type: 'mf_recommendation', ttl: '2 hours' },
          { type: 'stock_recommendation', ttl: '30 minutes' },
          { type: 'bond_recommendation', ttl: '4 hours' },
          { type: 'portfolio_analysis', ttl: '1 hour' },
          { type: 'risk_assessment', ttl: '4 hours' },
          { type: 'investment_proposal', ttl: '1 hour' },
          { type: 'market_insight', ttl: '15 minutes' },
          { type: 'rebalancing', ttl: '2 hours' },
        ]
      }
    });
  } catch (error: any) {
    console.error('Error fetching AI cache metrics:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/admin/cache/ai-responses/clear
 * Clear the AI response cache
 */
router.post('/ai-responses/clear', async (req, res) => {
  try {
    const { type } = req.body;
    
    if (type) {
      const cleared = aiResponseCacheService.invalidateType(type);
      res.json({
        success: true,
        message: `Cleared ${cleared} cached entries for type: ${type}`
      });
    } else {
      aiResponseCacheService.clear();
      res.json({
        success: true,
        message: 'All AI response cache cleared'
      });
    }
  } catch (error: any) {
    console.error('Error clearing AI cache:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/admin/cache/summary
 * Get overall cache performance summary across all caching layers
 */
router.get('/summary', async (req, res) => {
  try {
    const [cacheStats, dedupeMetrics, aiMetrics] = await Promise.all([
      dataCacheService.getCacheStats(),
      Promise.resolve(requestDedupeService.getMetrics()),
      Promise.resolve(aiResponseCacheService.getMetrics()),
    ]);
    
    res.json({
      success: true,
      data: {
        dataCache: {
          type: 'Persistent Data Cache',
          ...cacheStats,
        },
        requestDeduplication: {
          type: 'In-Flight Request Deduplication',
          ...dedupeMetrics,
        },
        aiResponseCache: {
          type: 'AI Response Cache',
          ...aiMetrics,
        },
        totalSavings: {
          description: 'Estimated total cost savings from all caching layers',
          apiCallsSaved: dedupeMetrics.apiCallsSaved + aiMetrics.estimatedApiCallsSaved,
          estimatedMonthlySavingsUSD: (cacheStats.apiUsage.estimatedSavings || 0) + aiMetrics.estimatedCostSavingsUSD,
        }
      }
    });
  } catch (error: any) {
    console.error('Error fetching cache summary:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
