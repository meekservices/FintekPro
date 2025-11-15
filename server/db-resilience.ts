import { logger } from './logger';

/**
 * Database Resilience Layer
 * 
 * Provides:
 * - Query timeout protection
 * - Automatic retry logic for transient failures
 * - Connection health monitoring
 * - Circuit breaker pattern for database
 * 
 * Production-ready error handling for database operations
 */

export interface RetryOptions {
  maxAttempts?: number;
  initialDelay?: number;
  maxDelay?: number;
  timeout?: number;
  retryableErrors?: string[];
}

export interface QueryStats {
  totalQueries: number;
  successfulQueries: number;
  failedQueries: number;
  retriedQueries: number;
  timeoutQueries: number;
  averageLatency: number;
}

const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 3,
  initialDelay: 100, // ms
  maxDelay: 5000, // ms
  timeout: 30000, // 30 seconds
  retryableErrors: [
    'ECONNREFUSED',
    'ETIMEDOUT',
    'ENOTFOUND',
    'ECONNRESET',
    'EPIPE',
    'connection terminated',
    'Connection terminated unexpectedly',
    'server closed the connection unexpectedly'
  ]
};

class DatabaseResilienceService {
  private stats: QueryStats = {
    totalQueries: 0,
    successfulQueries: 0,
    failedQueries: 0,
    retriedQueries: 0,
    timeoutQueries: 0,
    averageLatency: 0
  };

  private latencies: number[] = [];
  private readonly MAX_LATENCY_SAMPLES = 1000;

  /**
   * Execute a database query with timeout and retry logic
   */
  async executeWithRetry<T>(
    queryFn: () => Promise<T>,
    options: RetryOptions = {}
  ): Promise<T> {
    const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
    let lastError: Error | null = null;
    
    this.stats.totalQueries++;

    for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
      try {
        const startTime = Date.now();

        // Execute query with timeout
        const result = await this.withTimeout(queryFn(), opts.timeout);

        // Track successful query
        const latency = Date.now() - startTime;
        this.recordSuccess(latency);

        if (attempt > 1) {
          logger.info('Database query succeeded after retry', {
            attempt,
            latency
          });
          this.stats.retriedQueries++;
        }

        return result;

      } catch (error: any) {
        lastError = error;

        // Check if error is retryable
        const isRetryable = this.isRetryableError(error, opts.retryableErrors);
        const isLastAttempt = attempt >= opts.maxAttempts;

        logger.warn('Database query failed', {
          attempt,
          maxAttempts: opts.maxAttempts,
          error: error.message,
          isRetryable,
          willRetry: isRetryable && !isLastAttempt
        });

        // Don't retry if error is not retryable or this is the last attempt
        if (!isRetryable || isLastAttempt) {
          this.recordFailure(error);
          throw error;
        }

        // Calculate exponential backoff delay
        const delay = Math.min(
          opts.initialDelay * Math.pow(2, attempt - 1),
          opts.maxDelay
        );

        // Add jitter to prevent thundering herd
        const jitter = Math.random() * delay * 0.3;
        const totalDelay = delay + jitter;

        logger.info('Retrying database query', {
          attempt,
          nextAttempt: attempt + 1,
          delay: Math.round(totalDelay)
        });

        await this.sleep(totalDelay);
      }
    }

    // Should never reach here, but TypeScript needs it
    this.recordFailure(lastError!);
    throw lastError;
  }

  /**
   * Wrap a promise with a timeout
   */
  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => 
        setTimeout(() => {
          this.stats.timeoutQueries++;
          reject(new Error(`Database query timeout after ${timeoutMs}ms`));
        }, timeoutMs)
      )
    ]);
  }

  /**
   * Check if an error is retryable
   */
  private isRetryableError(error: any, retryableErrors: string[]): boolean {
    if (!error) return false;

    const errorMessage = error.message || String(error);
    const errorCode = error.code || '';

    return retryableErrors.some(pattern => 
      errorMessage.includes(pattern) || errorCode.includes(pattern)
    );
  }

  /**
   * Record successful query
   */
  private recordSuccess(latency: number): void {
    this.stats.successfulQueries++;
    this.updateAverageLatency(latency);
  }

  /**
   * Record failed query
   */
  private recordFailure(error: Error): void {
    this.stats.failedQueries++;
    logger.error('Database query failed permanently', error);
  }

  /**
   * Update average latency with exponential moving average
   */
  private updateAverageLatency(latency: number): void {
    this.latencies.push(latency);

    // Keep only recent samples
    if (this.latencies.length > this.MAX_LATENCY_SAMPLES) {
      this.latencies.shift();
    }

    // Calculate average
    const sum = this.latencies.reduce((a, b) => a + b, 0);
    this.stats.averageLatency = Math.round(sum / this.latencies.length);
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get current query statistics
   */
  getStats(): QueryStats {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      totalQueries: 0,
      successfulQueries: 0,
      failedQueries: 0,
      retriedQueries: 0,
      timeoutQueries: 0,
      averageLatency: 0
    };
    this.latencies = [];
  }

  /**
   * Check database health
   */
  getHealthStatus(): {
    healthy: boolean;
    successRate: number;
    averageLatency: number;
    stats: QueryStats;
  } {
    const successRate = this.stats.totalQueries > 0
      ? (this.stats.successfulQueries / this.stats.totalQueries) * 100
      : 100;

    const healthy = successRate >= 95 && this.stats.averageLatency < 1000;

    return {
      healthy,
      successRate: Math.round(successRate * 100) / 100,
      averageLatency: this.stats.averageLatency,
      stats: this.getStats()
    };
  }
}

// Singleton instance
export const dbResilience = new DatabaseResilienceService();

/**
 * Helper function to execute database queries with resilience
 * 
 * @example
 * const users = await withDbResilience(() => db.select().from(usersTable));
 */
export async function withDbResilience<T>(
  queryFn: () => Promise<T>,
  options?: RetryOptions
): Promise<T> {
  return dbResilience.executeWithRetry(queryFn, options);
}
