/**
 * Zoho API Rate Limiter Service
 * Implements token bucket algorithm to prevent exceeding Zoho's API credit limits
 * 
 * Zoho Limits:
 * - Base: 50,000 credits/org/day
 * - Additional: 250 credits per employee license
 * - Each API call consumes 1-5 credits depending on operation
 */

interface RateLimitBucket {
  tokens: number;
  lastRefill: number;
  maxTokens: number;
  refillRate: number; // tokens per millisecond
}

class ZohoRateLimiter {
  private buckets: Map<string, RateLimitBucket>;
  private readonly DEFAULT_MAX_TOKENS = 50000; // Base daily limit
  private readonly DEFAULT_REFILL_RATE = 50000 / (24 * 60 * 60 * 1000); // per millisecond

  constructor() {
    this.buckets = new Map();
  }

  /**
   * Get or create bucket for a connection
   */
  private getBucket(connectionId: string): RateLimitBucket {
    if (!this.buckets.has(connectionId)) {
      this.buckets.set(connectionId, {
        tokens: this.DEFAULT_MAX_TOKENS,
        lastRefill: Date.now(),
        maxTokens: this.DEFAULT_MAX_TOKENS,
        refillRate: this.DEFAULT_REFILL_RATE
      });
    }
    return this.buckets.get(connectionId)!;
  }

  /**
   * Refill bucket based on time elapsed
   */
  private refillBucket(bucket: RateLimitBucket): void {
    const now = Date.now();
    const timePassed = now - bucket.lastRefill;
    const tokensToAdd = timePassed * bucket.refillRate;
    
    bucket.tokens = Math.min(bucket.maxTokens, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;
  }

  /**
   * Check if request can be made (async for future external limit checking)
   */
  async canMakeRequest(connectionId: string, cost: number = 1): Promise<boolean> {
    const bucket = this.getBucket(connectionId);
    this.refillBucket(bucket);
    
    return bucket.tokens >= cost;
  }

  /**
   * Consume tokens for a request
   */
  async consumeTokens(connectionId: string, cost: number = 1): Promise<void> {
    const bucket = this.getBucket(connectionId);
    this.refillBucket(bucket);
    
    if (bucket.tokens < cost) {
      throw new Error(`Rate limit exceeded for connection ${connectionId}. Available: ${Math.floor(bucket.tokens)}, Required: ${cost}`);
    }
    
    bucket.tokens -= cost;
  }

  /**
   * Wait for tokens to be available (with exponential backoff)
   */
  async waitForTokens(connectionId: string, cost: number = 1, maxWaitMs: number = 60000): Promise<void> {
    const startTime = Date.now();
    let waitTime = 1000; // Start with 1 second
    
    while (!(await this.canMakeRequest(connectionId, cost))) {
      if (Date.now() - startTime > maxWaitMs) {
        throw new Error(`Rate limit wait timeout exceeded for connection ${connectionId}`);
      }
      
      // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, waitTime));
      waitTime = Math.min(waitTime * 2, 30000); // Max 30 seconds
    }
    
    await this.consumeTokens(connectionId, cost);
  }

  /**
   * Get current token count for monitoring
   */
  getAvailableTokens(connectionId: string): number {
    const bucket = this.getBucket(connectionId);
    this.refillBucket(bucket);
    return Math.floor(bucket.tokens);
  }

  /**
   * Reset bucket (useful for testing or manual intervention)
   */
  resetBucket(connectionId: string): void {
    this.buckets.delete(connectionId);
  }

  /**
   * Update bucket limits based on organization plan
   */
  updateLimits(connectionId: string, maxTokens: number): void {
    const bucket = this.getBucket(connectionId);
    bucket.maxTokens = maxTokens;
    bucket.refillRate = maxTokens / (24 * 60 * 60 * 1000);
    bucket.tokens = Math.min(bucket.tokens, maxTokens);
  }
}

export const zohoRateLimiter = new ZohoRateLimiter();
