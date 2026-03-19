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
import { unifiedStockPriceService } from '../services/unified-stock-price-service';
import { companyDataRefreshScheduler } from '../services/company-data-refresh-scheduler';
import { onboardingCacheService } from '../services/onboarding-cache-service';
import { credhiveService } from '../services/credhive-service';
import { proactiveCacheWarmingService } from '../services/proactive-cache-warming-service';

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
    const [cacheStats, dedupeMetrics, aiMetrics, stockMetrics, onboardingMetrics, companyRefreshMetrics] = await Promise.all([
      dataCacheService.getCacheStats(),
      Promise.resolve(requestDedupeService.getMetrics()),
      Promise.resolve(aiResponseCacheService.getMetrics()),
      Promise.resolve(unifiedStockPriceService.getMetrics()),
      Promise.resolve(onboardingCacheService.getMetrics()),
      Promise.resolve(companyDataRefreshScheduler.getMetrics()),
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
        stockPriceCache: {
          type: 'Unified Stock Price Cache',
          ...stockMetrics,
        },
        onboardingCache: {
          type: 'Onboarding Verification Cache',
          ...onboardingMetrics,
        },
        companyDataRefresh: {
          type: 'Company Data Auto-Refresh',
          ...companyRefreshMetrics,
        },
        totalSavings: {
          description: 'Estimated total cost savings from all caching layers',
          apiCallsSaved: dedupeMetrics.apiCallsSaved + aiMetrics.estimatedApiCallsSaved + onboardingMetrics.estimatedApiCallsSaved,
          estimatedMonthlySavingsUSD: (cacheStats.apiUsage.estimatedSavings || 0) + aiMetrics.estimatedCostSavingsUSD,
          estimatedMonthlySavingsINR: onboardingMetrics.estimatedSavingsINR,
        }
      }
    });
  } catch (error: any) {
    console.error('Error fetching cache summary:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/admin/cache/stock-prices
 * Get stock price cache metrics
 */
router.get('/stock-prices', async (req, res) => {
  try {
    const metrics = unifiedStockPriceService.getMetrics();
    
    res.json({
      success: true,
      data: {
        ...metrics,
        description: 'Unified stock price caching from NSE/BSE with automatic fallback',
      }
    });
  } catch (error: any) {
    console.error('Error fetching stock price cache metrics:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/admin/cache/stock-prices/warm
 * Warm the stock price cache with popular stocks
 */
router.post('/stock-prices/warm', async (req, res) => {
  try {
    const { symbols } = req.body;
    await unifiedStockPriceService.warmCache(symbols);
    
    res.json({
      success: true,
      message: 'Stock price cache warming initiated'
    });
  } catch (error: any) {
    console.error('Error warming stock price cache:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/admin/cache/company-refresh
 * Get company data refresh scheduler metrics
 */
router.get('/company-refresh', async (req, res) => {
  try {
    const metrics = companyDataRefreshScheduler.getMetrics();
    
    res.json({
      success: true,
      data: {
        ...metrics,
        description: 'Automatic company data refresh using Probe42 batch APIs',
      }
    });
  } catch (error: any) {
    console.error('Error fetching company refresh metrics:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/admin/cache/company-refresh/trigger
 * Trigger manual company data refresh cycle
 */
router.post('/company-refresh/trigger', async (req, res) => {
  try {
    const result = await companyDataRefreshScheduler.runRefreshCycle();
    
    res.json({
      success: true,
      message: `Refresh cycle complete: ${result.refreshed} companies refreshed, ${result.errors} errors`,
      ...result
    });
  } catch (error: any) {
    console.error('Error triggering company refresh:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/admin/cache/onboarding
 * Get onboarding cache metrics
 */
router.get('/onboarding', async (req, res) => {
  try {
    const metrics = onboardingCacheService.getMetrics();
    
    res.json({
      success: true,
      data: {
        ...metrics,
        description: 'Caches verification results during KYC onboarding to reduce API calls',
      }
    });
  } catch (error: any) {
    console.error('Error fetching onboarding cache metrics:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/admin/cache/warming
 * Get proactive cache warming metrics
 */
router.get('/warming', async (req, res) => {
  try {
    const metrics = proactiveCacheWarmingService.getMetrics();
    
    res.json({
      success: true,
      data: {
        ...metrics,
        description: 'Proactively warms popular data caches before expiry',
      }
    });
  } catch (error: any) {
    console.error('Error fetching warming metrics:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/admin/cache/warming/trigger
 * Trigger manual cache warming cycle
 */
router.post('/warming/trigger', async (req, res) => {
  try {
    const result = await proactiveCacheWarmingService.runWarmingCycle();
    
    res.json({
      success: true,
      message: `Warming complete: ${result.stocks} stocks warmed`,
      ...result
    });
  } catch (error: any) {
    console.error('Error triggering cache warming:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/admin/cache/batch-enrich
 * Batch enrich company data for multiple CINs in a single request
 * Reduces API calls by combining lookups
 */
router.post('/batch-enrich', async (req, res) => {
  try {
    const { cins, includeFinancials = false, years = 3 } = req.body;
    
    if (!Array.isArray(cins) || cins.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'cins must be a non-empty array of CIN strings' 
      });
    }
    
    if (cins.length > 50) {
      return res.status(400).json({ 
        success: false, 
        error: 'Maximum 50 CINs allowed per batch request' 
      });
    }
    
    console.log(`[BatchEnrich] Processing ${cins.length} companies${includeFinancials ? ' with financials' : ''}`);
    
    const detailsMap = await credhiveService.batchGetCompanyDetails(cins);
    
    let financialsMap: Map<string, any[]> | null = null;
    if (includeFinancials) {
      financialsMap = await credhiveService.batchGetCompanyFinancials(cins, years);
    }
    
    const results = cins.map(cin => ({
      cin,
      details: detailsMap.get(cin) || null,
      financials: financialsMap?.get(cin) || null,
      success: detailsMap.get(cin) !== null,
    }));
    
    const successful = results.filter(r => r.success).length;
    
    res.json({
      success: true,
      data: {
        total: cins.length,
        successful,
        failed: cins.length - successful,
        results,
      },
      message: `Batch enriched ${successful}/${cins.length} companies`
    });
  } catch (error: any) {
    console.error('Error in batch enrichment:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
