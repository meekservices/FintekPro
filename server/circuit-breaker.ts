import { logger } from './logger';

/**
 * Circuit Breaker Pattern Implementation
 * 
 * Prevents cascading failures by detecting when external services are down
 * and failing fast instead of waiting for timeouts.
 * 
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Service is down, requests fail immediately
 * - HALF_OPEN: Testing if service has recovered
 * 
 * Production-ready error handling for external API calls
 */

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

export interface CircuitBreakerOptions {
  failureThreshold?: number; // Number of failures before opening circuit
  successThreshold?: number; // Number of successes to close circuit from half-open
  timeout?: number; // Time in ms before attempting recovery (half-open)
  monitoringPeriod?: number; // Time window for counting failures
}

export interface CircuitBreakerStats {
  state: CircuitState;
  failures: number;
  successes: number;
  totalCalls: number;
  lastFailureTime: number | null;
  lastSuccessTime: number | null;
}

const DEFAULT_OPTIONS: Required<CircuitBreakerOptions> = {
  failureThreshold: 5,
  successThreshold: 2,
  timeout: 60000, // 60 seconds
  monitoringPeriod: 60000 // 60 seconds
};

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failures: number = 0;
  private successes: number = 0;
  private totalCalls: number = 0;
  private lastFailureTime: number | null = null;
  private lastSuccessTime: number | null = null;
  private nextAttemptTime: number = 0;
  private failureTimestamps: number[] = [];

  constructor(
    private readonly name: string,
    private readonly options: CircuitBreakerOptions = {}
  ) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Execute a function through the circuit breaker
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.totalCalls++;

    // Check if circuit is open
    if (this.state === CircuitState.OPEN) {
      if (Date.now() < this.nextAttemptTime) {
        // Circuit still open, fail fast
        const error = new Error(`Circuit breaker is OPEN for ${this.name}`);
        logger.warn('Circuit breaker rejecting request (OPEN)', {
          serviceName: this.name,
          state: this.state,
          failures: this.failures,
          nextAttemptTime: new Date(this.nextAttemptTime).toISOString()
        });
        throw error;
      }

      // Transition to half-open to test service
      this.state = CircuitState.HALF_OPEN;
      logger.info('Circuit breaker transitioning to HALF_OPEN', {
        serviceName: this.name
      });
    }

    try {
      // Execute the function
      const result = await fn();

      // Record success
      this.onSuccess();

      return result;

    } catch (error) {
      // Record failure
      this.onFailure();

      throw error;
    }
  }

  /**
   * Handle successful execution
   */
  private onSuccess(): void {
    this.successes++;
    this.lastSuccessTime = Date.now();

    if (this.state === CircuitState.HALF_OPEN) {
      // Check if we've had enough successes to close the circuit
      if (this.successes >= this.options.successThreshold!) {
        const previousSuccesses = this.successes;
        
        // Reset all counters when transitioning to CLOSED
        this.state = CircuitState.CLOSED;
        this.failures = 0;
        this.successes = 0;
        this.failureTimestamps = [];

        logger.info('Circuit breaker closed after recovery', {
          serviceName: this.name,
          successCount: previousSuccesses
        });
      }
    } else if (this.state === CircuitState.CLOSED) {
      // Reset failure counters on success in closed state
      this.failures = 0;
      this.failureTimestamps = [];
      // Keep success counter for monitoring but reset on state change
    }
  }

  /**
   * Handle failed execution
   */
  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    this.failureTimestamps.push(Date.now());

    // Remove old failure timestamps outside monitoring period
    const cutoffTime = Date.now() - this.options.monitoringPeriod!;
    this.failureTimestamps = this.failureTimestamps.filter(t => t > cutoffTime);

    if (this.state === CircuitState.HALF_OPEN) {
      // Failed during half-open, reopen circuit
      this.state = CircuitState.OPEN;
      this.nextAttemptTime = Date.now() + this.options.timeout!;
      this.successes = 0;

      logger.warn('Circuit breaker reopened after failed recovery attempt', {
        serviceName: this.name,
        nextAttemptTime: new Date(this.nextAttemptTime).toISOString()
      });

    } else if (this.state === CircuitState.CLOSED) {
      // Check if we've exceeded failure threshold
      if (this.failureTimestamps.length >= this.options.failureThreshold!) {
        this.state = CircuitState.OPEN;
        this.nextAttemptTime = Date.now() + this.options.timeout!;
        this.successes = 0;

        logger.error('Circuit breaker opened due to excessive failures', {
          serviceName: this.name,
          failures: this.failures,
          threshold: this.options.failureThreshold,
          monitoringPeriod: this.options.monitoringPeriod,
          nextAttemptTime: new Date(this.nextAttemptTime).toISOString()
        });
      }
    }
  }

  /**
   * Get current circuit breaker statistics
   */
  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      totalCalls: this.totalCalls,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime
    };
  }

  /**
   * Get current state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Manually reset the circuit breaker
   */
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failures = 0;
    this.successes = 0;
    this.failureTimestamps = [];
    this.nextAttemptTime = 0;

    logger.info('Circuit breaker manually reset', {
      serviceName: this.name
    });
  }

  /**
   * Check if circuit is allowing requests
   */
  isAvailable(): boolean {
    if (this.state === CircuitState.CLOSED || this.state === CircuitState.HALF_OPEN) {
      return true;
    }

    if (this.state === CircuitState.OPEN && Date.now() >= this.nextAttemptTime) {
      return true; // Will transition to half-open on next call
    }

    return false;
  }
}

/**
 * Circuit Breaker Registry
 * Manages multiple circuit breakers for different services
 */
class CircuitBreakerRegistry {
  private breakers: Map<string, CircuitBreaker> = new Map();

  /**
   * Get or create a circuit breaker for a service
   */
  getBreaker(name: string, options?: CircuitBreakerOptions): CircuitBreaker {
    if (!this.breakers.has(name)) {
      this.breakers.set(name, new CircuitBreaker(name, options));
    }
    return this.breakers.get(name)!;
  }

  /**
   * Get all circuit breaker statistics
   */
  getAllStats(): Record<string, CircuitBreakerStats> {
    const stats: Record<string, CircuitBreakerStats> = {};

    Array.from(this.breakers.entries()).forEach(([name, breaker]) => {
      stats[name] = breaker.getStats();
    });

    return stats;
  }

  /**
   * Reset all circuit breakers
   */
  resetAll(): void {
    Array.from(this.breakers.values()).forEach(breaker => {
      breaker.reset();
    });

    logger.info('All circuit breakers reset');
  }

  /**
   * Get health status of all services
   */
  getHealthStatus(): {
    healthy: number;
    degraded: number;
    down: number;
    total: number;
    services: Record<string, { state: CircuitState; available: boolean }>;
  } {
    const services: Record<string, { state: CircuitState; available: boolean }> = {};
    let healthy = 0;
    let degraded = 0;
    let down = 0;

    Array.from(this.breakers.entries()).forEach(([name, breaker]) => {
      const state = breaker.getState();
      const available = breaker.isAvailable();

      services[name] = { state, available };

      if (state === CircuitState.CLOSED) {
        healthy++;
      } else if (state === CircuitState.HALF_OPEN) {
        degraded++;
      } else {
        down++;
      }
    });

    return {
      healthy,
      degraded,
      down,
      total: this.breakers.size,
      services
    };
  }
}

// Singleton registry
export const circuitBreakerRegistry = new CircuitBreakerRegistry();

/**
 * Helper function to execute API calls with circuit breaker protection
 * 
 * @example
 * const data = await withCircuitBreaker('BSE_STAR_API', async () => {
 *   return await bseStarApi.getData();
 * });
 */
export async function withCircuitBreaker<T>(
  serviceName: string,
  fn: () => Promise<T>,
  options?: CircuitBreakerOptions
): Promise<T> {
  const breaker = circuitBreakerRegistry.getBreaker(serviceName, options);
  return breaker.execute(fn);
}
