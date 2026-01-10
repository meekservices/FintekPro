/**
 * Proactive Cache Warming Service
 * 
 * Automatically refreshes frequently accessed data before it expires.
 * Reduces API latency by ensuring popular data is always cached.
 * 
 * Features:
 * - Track access patterns to identify popular items
 * - Pre-fetch data before cache expiry
 * - Batch operations to minimize API calls
 * - Configurable warming schedules
 */

import { unifiedStockPriceService } from './unified-stock-price-service';
import { db } from '../db';

interface AccessPattern {
  key: string;
  type: 'stock' | 'company' | 'fund';
  accessCount: number;
  lastAccessed: number;
}

interface WarmingConfig {
  enabled: boolean;
  checkIntervalMs: number;
  minAccessCount: number;
  popularStocks: string[];
  popularFunds: string[];
}

interface WarmingMetrics {
  totalWarmingRuns: number;
  stocksWarmed: number;
  lastRunAt: number | null;
  errors: number;
}

const DEFAULT_CONFIG: WarmingConfig = {
  enabled: true,
  checkIntervalMs: 30 * 60 * 1000, // Check every 30 minutes
  minAccessCount: 3, // Minimum accesses to be considered "popular"
  popularStocks: [
    'RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'ICICIBANK',
    'HINDUNILVR', 'ITC', 'SBIN', 'BHARTIARTL', 'KOTAKBANK',
    'BAJFINANCE', 'LICI', 'ASIANPAINT', 'MARUTI', 'AXISBANK',
    'TITAN', 'SUNPHARMA', 'ULTRACEMCO', 'WIPRO', 'HCLTECH'
  ],
  popularFunds: [], // Reserved for future fund warming
};

class ProactiveCacheWarmingService {
  private config: WarmingConfig;
  private accessPatterns: Map<string, AccessPattern> = new Map();
  private intervalId: NodeJS.Timeout | null = null;
  private metrics: WarmingMetrics = {
    totalWarmingRuns: 0,
    stocksWarmed: 0,
    lastRunAt: null,
    errors: 0,
  };

  constructor(config: Partial<WarmingConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  start(): void {
    if (this.intervalId) {
      console.log('[CacheWarming] Already running');
      return;
    }

    if (!this.config.enabled) {
      console.log('[CacheWarming] Service disabled');
      return;
    }

    console.log(`✅ Proactive Cache Warming Service started (interval: ${this.config.checkIntervalMs / 1000 / 60} min)`);

    this.intervalId = setInterval(() => {
      this.runWarmingCycle().catch(err => {
        console.error('[CacheWarming] Cycle failed:', err.message);
        this.metrics.errors++;
      });
    }, this.config.checkIntervalMs);

    setTimeout(() => this.runWarmingCycle(), 2 * 60 * 1000);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('[CacheWarming] Service stopped');
    }
  }

  recordAccess(type: 'stock' | 'company' | 'fund', key: string): void {
    const patternKey = `${type}:${key}`;
    const existing = this.accessPatterns.get(patternKey);
    
    if (existing) {
      existing.accessCount++;
      existing.lastAccessed = Date.now();
    } else {
      this.accessPatterns.set(patternKey, {
        key,
        type,
        accessCount: 1,
        lastAccessed: Date.now(),
      });
    }
  }

  getPopularItems(type: 'stock' | 'company' | 'fund', limit: number = 20): string[] {
    const items = Array.from(this.accessPatterns.values())
      .filter(p => p.type === type && p.accessCount >= this.config.minAccessCount)
      .sort((a, b) => b.accessCount - a.accessCount)
      .slice(0, limit)
      .map(p => p.key);
    
    return items;
  }

  async runWarmingCycle(): Promise<{ stocks: number }> {
    console.log('[CacheWarming] Starting warming cycle...');
    this.metrics.totalWarmingRuns++;
    this.metrics.lastRunAt = Date.now();

    let stocksWarmed = 0;

    try {
      const popularStocks = [...this.config.popularStocks, ...this.getPopularItems('stock', 10)];
      const uniqueStocks = [...new Set(popularStocks)];
      
      if (uniqueStocks.length > 0) {
        console.log(`[CacheWarming] Warming ${uniqueStocks.length} popular stocks...`);
        await unifiedStockPriceService.warmCache(uniqueStocks);
        stocksWarmed = uniqueStocks.length;
        this.metrics.stocksWarmed += stocksWarmed;
      }
    } catch (error: any) {
      console.error('[CacheWarming] Error during warming:', error.message);
      this.metrics.errors++;
    }

    console.log(`[CacheWarming] Cycle complete: ${stocksWarmed} stocks warmed`);

    return { stocks: stocksWarmed };
  }

  getMetrics(): WarmingMetrics & { accessPatternCount: number; config: WarmingConfig } {
    return {
      ...this.metrics,
      accessPatternCount: this.accessPatterns.size,
      config: this.config,
    };
  }

  clearAccessPatterns(): void {
    this.accessPatterns.clear();
  }
}

export const proactiveCacheWarmingService = new ProactiveCacheWarmingService();
