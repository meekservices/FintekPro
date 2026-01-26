/**
 * Bank API Rate Limiter Service
 * 
 * Generic rate limiter for bank API calls using token bucket algorithm.
 * Supports per-bank configuration with different limits and refill rates.
 * 
 * Features:
 * - Token bucket algorithm for smooth rate limiting
 * - Per-bank configuration
 * - Priority queue for critical operations
 * - Metrics tracking for monitoring
 */

export interface RateLimitConfig {
  maxTokens: number;           // Maximum tokens in bucket
  refillRate: number;          // Tokens per second
  minTokensForRequest: number; // Minimum tokens required (default: 1)
}

interface RateLimitBucket {
  tokens: number;
  lastRefill: number;
  config: RateLimitConfig;
}

interface RateLimitMetrics {
  totalRequests: number;
  totalThrottled: number;
  totalAllowed: number;
  lastThrottledAt: Date | null;
  averageWaitTime: number;
  peakUsage: number;
}

// Default rate limits for known banks (requests per minute equivalent)
const DEFAULT_BANK_LIMITS: Record<string, RateLimitConfig> = {
  'ICICI': { maxTokens: 100, refillRate: 1.67, minTokensForRequest: 1 },  // 100/min
  'HDFC': { maxTokens: 60, refillRate: 1, minTokensForRequest: 1 },       // 60/min
  'BAJAJ': { maxTokens: 120, refillRate: 2, minTokensForRequest: 1 },     // 120/min
  'TATA': { maxTokens: 60, refillRate: 1, minTokensForRequest: 1 },       // 60/min
  'KOTAK': { maxTokens: 90, refillRate: 1.5, minTokensForRequest: 1 },    // 90/min
  'AXIS': { maxTokens: 80, refillRate: 1.33, minTokensForRequest: 1 },    // 80/min
  'SBI': { maxTokens: 50, refillRate: 0.83, minTokensForRequest: 1 },     // 50/min
  'DEFAULT': { maxTokens: 60, refillRate: 1, minTokensForRequest: 1 },    // 60/min default
};

// Operation weights (some operations cost more tokens)
const OPERATION_WEIGHTS: Record<string, number> = {
  'submit_application': 5,
  'check_status': 1,
  'refresh_token': 2,
  'get_rates': 1,
  'upload_document': 3,
  'get_sanction_letter': 2,
  'DEFAULT': 1
};

class BankAPIRateLimiter {
  private buckets: Map<string, RateLimitBucket> = new Map();
  private metrics: Map<string, RateLimitMetrics> = new Map();
  private waitQueues: Map<string, Array<{ resolve: () => void; timestamp: number }>> = new Map();
  private customConfigs: Map<string, RateLimitConfig> = new Map();

  /**
   * Get or create a bucket for a bank
   */
  private getBucket(bankCode: string): RateLimitBucket {
    const key = bankCode.toUpperCase();
    
    if (!this.buckets.has(key)) {
      const config = this.customConfigs.get(key) || 
                     DEFAULT_BANK_LIMITS[key] || 
                     DEFAULT_BANK_LIMITS['DEFAULT'];
      
      this.buckets.set(key, {
        tokens: config.maxTokens,
        lastRefill: Date.now(),
        config
      });
    }
    
    return this.buckets.get(key)!;
  }

  /**
   * Refill tokens based on time elapsed
   */
  private refillBucket(bucket: RateLimitBucket): void {
    const now = Date.now();
    const timePassed = (now - bucket.lastRefill) / 1000; // Convert to seconds
    const tokensToAdd = timePassed * bucket.config.refillRate;
    
    bucket.tokens = Math.min(bucket.config.maxTokens, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;
  }

  /**
   * Get or create metrics for a bank
   */
  private getMetrics(bankCode: string): RateLimitMetrics {
    const key = bankCode.toUpperCase();
    
    if (!this.metrics.has(key)) {
      this.metrics.set(key, {
        totalRequests: 0,
        totalThrottled: 0,
        totalAllowed: 0,
        lastThrottledAt: null,
        averageWaitTime: 0,
        peakUsage: 0
      });
    }
    
    return this.metrics.get(key)!;
  }

  /**
   * Try to acquire tokens for a request
   * Returns true if allowed, false if rate limited
   */
  tryAcquire(bankCode: string, operation: string = 'DEFAULT'): boolean {
    const bucket = this.getBucket(bankCode);
    const metrics = this.getMetrics(bankCode);
    const tokensNeeded = OPERATION_WEIGHTS[operation] || OPERATION_WEIGHTS['DEFAULT'];
    
    // Refill bucket
    this.refillBucket(bucket);
    
    metrics.totalRequests++;
    
    // Track peak usage
    const currentUsage = (bucket.config.maxTokens - bucket.tokens) / bucket.config.maxTokens;
    metrics.peakUsage = Math.max(metrics.peakUsage, currentUsage);
    
    if (bucket.tokens >= tokensNeeded) {
      bucket.tokens -= tokensNeeded;
      metrics.totalAllowed++;
      return true;
    }
    
    metrics.totalThrottled++;
    metrics.lastThrottledAt = new Date();
    return false;
  }

  /**
   * Acquire tokens with waiting (async)
   * Will wait until tokens become available
   */
  async acquire(bankCode: string, operation: string = 'DEFAULT', timeoutMs: number = 30000): Promise<boolean> {
    const startTime = Date.now();
    
    // Try immediate acquisition
    if (this.tryAcquire(bankCode, operation)) {
      return true;
    }
    
    // Wait for tokens
    const bucket = this.getBucket(bankCode);
    const tokensNeeded = OPERATION_WEIGHTS[operation] || OPERATION_WEIGHTS['DEFAULT'];
    
    // Calculate wait time
    const tokensDeficit = tokensNeeded - bucket.tokens;
    const waitTimeMs = (tokensDeficit / bucket.config.refillRate) * 1000;
    
    if (waitTimeMs > timeoutMs) {
      console.warn(`[RateLimiter] ${bankCode}: Would exceed timeout (${waitTimeMs}ms > ${timeoutMs}ms)`);
      return false;
    }
    
    // Wait and retry
    await this.sleep(Math.min(waitTimeMs + 100, timeoutMs));
    
    // Update metrics
    const metrics = this.getMetrics(bankCode);
    const actualWaitTime = Date.now() - startTime;
    metrics.averageWaitTime = (metrics.averageWaitTime * (metrics.totalRequests - 1) + actualWaitTime) / metrics.totalRequests;
    
    return this.tryAcquire(bankCode, operation);
  }

  /**
   * Get remaining tokens for a bank
   */
  getRemainingTokens(bankCode: string): number {
    const bucket = this.getBucket(bankCode);
    this.refillBucket(bucket);
    return Math.floor(bucket.tokens);
  }

  /**
   * Get time until N tokens available (in milliseconds)
   */
  getTimeUntilAvailable(bankCode: string, tokensNeeded: number = 1): number {
    const bucket = this.getBucket(bankCode);
    this.refillBucket(bucket);
    
    if (bucket.tokens >= tokensNeeded) {
      return 0;
    }
    
    const tokensDeficit = tokensNeeded - bucket.tokens;
    return Math.ceil((tokensDeficit / bucket.config.refillRate) * 1000);
  }

  /**
   * Configure custom rate limits for a bank
   */
  setConfig(bankCode: string, config: RateLimitConfig): void {
    const key = bankCode.toUpperCase();
    this.customConfigs.set(key, config);
    
    // Reset bucket with new config
    this.buckets.delete(key);
    console.log(`[RateLimiter] Custom config set for ${key}:`, config);
  }

  /**
   * Get current config for a bank
   */
  getConfig(bankCode: string): RateLimitConfig {
    const key = bankCode.toUpperCase();
    return this.customConfigs.get(key) || 
           DEFAULT_BANK_LIMITS[key] || 
           DEFAULT_BANK_LIMITS['DEFAULT'];
  }

  /**
   * Get metrics for a bank
   */
  getBankMetrics(bankCode: string): RateLimitMetrics {
    return { ...this.getMetrics(bankCode) };
  }

  /**
   * Get all metrics
   */
  getAllMetrics(): Record<string, RateLimitMetrics> {
    const result: Record<string, RateLimitMetrics> = {};
    this.metrics.forEach((metrics, bankCode) => {
      result[bankCode] = { ...metrics };
    });
    return result;
  }

  /**
   * Reset metrics for a bank
   */
  resetMetrics(bankCode: string): void {
    const key = bankCode.toUpperCase();
    this.metrics.delete(key);
  }

  /**
   * Reset all rate limit state (for testing)
   */
  reset(): void {
    this.buckets.clear();
    this.metrics.clear();
    this.waitQueues.clear();
  }

  /**
   * Create a rate-limited wrapper for a function
   */
  wrap<T extends (...args: any[]) => Promise<any>>(
    bankCode: string,
    operation: string,
    fn: T
  ): T {
    return (async (...args: Parameters<T>) => {
      const acquired = await this.acquire(bankCode, operation);
      if (!acquired) {
        throw new Error(`Rate limit exceeded for ${bankCode}`);
      }
      return fn(...args);
    }) as T;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const bankAPIRateLimiter = new BankAPIRateLimiter();
