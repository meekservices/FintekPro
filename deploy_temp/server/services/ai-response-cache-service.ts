/**
 * AI Response Cache Service
 * 
 * Caches AI (Gemini) recommendations to reduce API costs and improve response times.
 * Uses content-based hashing to identify similar requests.
 * 
 * Features:
 * - Hash-based caching for identical/similar prompts
 * - Configurable TTL per recommendation type
 * - Memory-efficient LRU eviction
 * - Metrics tracking for cost savings
 */

import crypto from 'crypto';

interface CachedResponse {
  response: any;
  timestamp: number;
  hitCount: number;
  inputHash: string;
  type: string;
}

interface CacheConfig {
  maxEntries: number;
  defaultTtlMs: number;
  ttlByType: Record<string, number>;
}

interface CacheMetrics {
  totalRequests: number;
  cacheHits: number;
  cacheMisses: number;
  estimatedApiCallsSaved: number;
  estimatedCostSavingsUSD: number;
}

const DEFAULT_CONFIG: CacheConfig = {
  maxEntries: 500,
  defaultTtlMs: 60 * 60 * 1000, // 1 hour default
  ttlByType: {
    'mf_recommendation': 2 * 60 * 60 * 1000,     // 2 hours for MF recommendations
    'stock_recommendation': 30 * 60 * 1000,      // 30 min for stock recommendations (more volatile)
    'bond_recommendation': 4 * 60 * 60 * 1000,   // 4 hours for bond recommendations
    'portfolio_analysis': 60 * 60 * 1000,        // 1 hour for portfolio analysis
    'risk_assessment': 4 * 60 * 60 * 1000,       // 4 hours for risk assessments
    'investment_proposal': 60 * 60 * 1000,       // 1 hour for investment proposals
    'market_insight': 15 * 60 * 1000,            // 15 min for market insights
    'rebalancing': 2 * 60 * 60 * 1000,           // 2 hours for rebalancing suggestions
  },
};

const GEMINI_COST_PER_1K_TOKENS = 0.00025; // Approximate cost
const AVG_TOKENS_PER_REQUEST = 2000;

class AIResponseCacheService {
  private cache: Map<string, CachedResponse> = new Map();
  private accessOrder: string[] = [];
  private config: CacheConfig;
  private metrics: CacheMetrics = {
    totalRequests: 0,
    cacheHits: 0,
    cacheMisses: 0,
    estimatedApiCallsSaved: 0,
    estimatedCostSavingsUSD: 0,
  };

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    console.log('✅ AI Response Cache Service initialized');
  }

  /**
   * Generate a hash key from the input parameters
   * Normalizes and sorts object keys for consistent hashing
   */
  private generateHash(type: string, input: any): string {
    const normalized = this.normalizeInput(input);
    const content = `${type}:${JSON.stringify(normalized)}`;
    return crypto.createHash('sha256').update(content).digest('hex').substring(0, 16);
  }

  /**
   * Normalize input for consistent hashing
   * - Sort object keys
   * - Round numbers to reduce precision variations
   * - Trim strings
   */
  private normalizeInput(obj: any): any {
    if (obj === null || obj === undefined) {
      return null;
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.normalizeInput(item));
    }
    
    if (typeof obj === 'object') {
      const sorted: any = {};
      const keys = Object.keys(obj).sort();
      for (const key of keys) {
        sorted[key] = this.normalizeInput(obj[key]);
      }
      return sorted;
    }
    
    if (typeof obj === 'number') {
      return Math.round(obj * 100) / 100;
    }
    
    if (typeof obj === 'string') {
      return obj.trim().toLowerCase();
    }
    
    return obj;
  }

  /**
   * Get TTL for a specific recommendation type
   */
  private getTtl(type: string): number {
    return this.config.ttlByType[type] || this.config.defaultTtlMs;
  }

  /**
   * Check if a cached response is still valid
   */
  private isValid(entry: CachedResponse, type: string): boolean {
    const ttl = this.getTtl(type);
    const age = Date.now() - entry.timestamp;
    return age < ttl;
  }

  /**
   * Evict least recently used entries if cache is full
   */
  private evictIfNeeded(): void {
    while (this.cache.size >= this.config.maxEntries && this.accessOrder.length > 0) {
      const oldestKey = this.accessOrder.shift();
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }
  }

  /**
   * Update access order for LRU tracking
   */
  private touchEntry(hash: string): void {
    const index = this.accessOrder.indexOf(hash);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
    this.accessOrder.push(hash);
  }

  /**
   * Get a cached AI response if available
   * Returns null if not cached or expired
   */
  get<T>(type: string, input: any): T | null {
    this.metrics.totalRequests++;
    
    const hash = this.generateHash(type, input);
    const entry = this.cache.get(hash);
    
    if (!entry) {
      this.metrics.cacheMisses++;
      return null;
    }
    
    if (!this.isValid(entry, type)) {
      this.cache.delete(hash);
      this.metrics.cacheMisses++;
      return null;
    }
    
    entry.hitCount++;
    this.touchEntry(hash);
    this.metrics.cacheHits++;
    this.metrics.estimatedApiCallsSaved++;
    this.metrics.estimatedCostSavingsUSD += (GEMINI_COST_PER_1K_TOKENS * AVG_TOKENS_PER_REQUEST) / 1000;
    
    console.log(`[AICache] Cache HIT for ${type} (hash: ${hash}, hits: ${entry.hitCount})`);
    
    return entry.response as T;
  }

  /**
   * Store an AI response in the cache
   */
  set(type: string, input: any, response: any): void {
    const hash = this.generateHash(type, input);
    
    this.evictIfNeeded();
    
    this.cache.set(hash, {
      response,
      timestamp: Date.now(),
      hitCount: 0,
      inputHash: hash,
      type,
    });
    
    this.touchEntry(hash);
    
    console.log(`[AICache] Cached ${type} response (hash: ${hash})`);
  }

  /**
   * Get or compute - checks cache first, then calls fetcher if miss
   * This is the primary method for integrating with AI services
   */
  async getOrCompute<T>(
    type: string,
    input: any,
    fetcher: () => Promise<T>
  ): Promise<T> {
    const cached = this.get<T>(type, input);
    
    if (cached !== null) {
      return cached;
    }
    
    const result = await fetcher();
    this.set(type, input, result);
    
    return result;
  }

  /**
   * Invalidate a specific cache entry
   */
  invalidate(type: string, input: any): boolean {
    const hash = this.generateHash(type, input);
    const deleted = this.cache.delete(hash);
    
    if (deleted) {
      const index = this.accessOrder.indexOf(hash);
      if (index > -1) {
        this.accessOrder.splice(index, 1);
      }
    }
    
    return deleted;
  }

  /**
   * Invalidate all entries of a specific type
   */
  invalidateType(type: string): number {
    let count = 0;
    const hashesToDelete: string[] = [];
    
    for (const [hash, entry] of this.cache.entries()) {
      if (entry.type === type) {
        hashesToDelete.push(hash);
      }
    }
    
    for (const hash of hashesToDelete) {
      this.cache.delete(hash);
      const index = this.accessOrder.indexOf(hash);
      if (index > -1) {
        this.accessOrder.splice(index, 1);
      }
      count++;
    }
    
    return count;
  }

  /**
   * Clear all cached entries
   */
  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
  }

  /**
   * Get cache metrics and statistics
   */
  getMetrics(): CacheMetrics & { 
    cacheSize: number; 
    hitRate: string;
    topCachedTypes: { type: string; count: number }[];
  } {
    const hitRate = this.metrics.totalRequests > 0
      ? ((this.metrics.cacheHits / this.metrics.totalRequests) * 100).toFixed(2)
      : '0.00';
    
    const typeCounts = new Map<string, number>();
    for (const entry of this.cache.values()) {
      typeCounts.set(entry.type, (typeCounts.get(entry.type) || 0) + 1);
    }
    
    const topCachedTypes = Array.from(typeCounts.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count);
    
    return {
      ...this.metrics,
      cacheSize: this.cache.size,
      hitRate: `${hitRate}%`,
      topCachedTypes,
      estimatedCostSavingsUSD: Math.round(this.metrics.estimatedCostSavingsUSD * 1000) / 1000,
    };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      totalRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      estimatedApiCallsSaved: 0,
      estimatedCostSavingsUSD: 0,
    };
  }
}

export const aiResponseCacheService = new AIResponseCacheService();
