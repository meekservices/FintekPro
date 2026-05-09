/**
 * Circuit Breaker Pattern Implementation
 * Prevents cascading failures by stopping requests to failing services
 */

import { CircuitOpenError } from './errors';

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export interface CircuitBreakerOptions {
  failureThreshold?: number;
  successThreshold?: number;
  timeout?: number;
  monitoringWindow?: number;
  onStateChange?: (state: CircuitState, serviceName: string) => void;
  onFailure?: (error: Error, serviceName: string) => void;
}

interface CircuitStats {
  failures: number;
  successes: number;
  lastFailureTime?: number;
  consecutiveSuccesses: number;
}

const DEFAULT_OPTIONS: Required<CircuitBreakerOptions> = {
  failureThreshold: 5,
  successThreshold: 2,
  timeout: 60000,
  monitoringWindow: 60000,
  onStateChange: () => {},
  onFailure: () => {},
};

/**
 * Circuit Breaker class for managing service health
 */
export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private stats: CircuitStats = {
    failures: 0,
    successes: 0,
    consecutiveSuccesses: 0,
  };
  private nextAttempt?: number;
  private readonly serviceName: string;
  private readonly options: Required<CircuitBreakerOptions>;

  constructor(serviceName: string, options: CircuitBreakerOptions = {}) {
    this.serviceName = serviceName;
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Execute a function through the circuit breaker
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.transitionTo(CircuitState.HALF_OPEN);
      } else {
        const openUntil = this.nextAttempt
          ? new Date(this.nextAttempt)
          : undefined;
        throw new CircuitOpenError(this.serviceName, openUntil);
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Record a successful execution
   */
  private onSuccess(): void {
    this.stats.successes++;
    this.stats.consecutiveSuccesses++;

    if (this.state === CircuitState.HALF_OPEN) {
      if (this.stats.consecutiveSuccesses >= this.options.successThreshold) {
        this.transitionTo(CircuitState.CLOSED);
        this.resetStats();
      }
    }
  }

  /**
   * Record a failed execution
   */
  private onFailure(error: Error): void {
    this.stats.failures++;
    this.stats.consecutiveSuccesses = 0;
    this.stats.lastFailureTime = Date.now();

    this.options.onFailure(error, this.serviceName);

    if (this.state === CircuitState.HALF_OPEN) {
      this.transitionTo(CircuitState.OPEN);
      this.scheduleReset();
      return;
    }

    if (this.state === CircuitState.CLOSED) {
      this.cleanOldFailures();

      if (this.stats.failures >= this.options.failureThreshold) {
        this.transitionTo(CircuitState.OPEN);
        this.scheduleReset();
      }
    }
  }

  /**
   * Remove failures outside monitoring window
   */
  private cleanOldFailures(): void {
    if (!this.stats.lastFailureTime) return;

    const now = Date.now();
    const windowStart = now - this.options.monitoringWindow;

    if (this.stats.lastFailureTime < windowStart) {
      this.stats.failures = 0;
    }
  }

  /**
   * Check if we should attempt to reset the circuit
   */
  private shouldAttemptReset(): boolean {
    if (!this.nextAttempt) return false;
    return Date.now() >= this.nextAttempt;
  }

  /**
   * Schedule the next reset attempt
   */
  private scheduleReset(): void {
    this.nextAttempt = Date.now() + this.options.timeout;
  }

  /**
   * Transition to a new state
   */
  private transitionTo(newState: CircuitState): void {
    if (this.state === newState) return;

    const oldState = this.state;
    this.state = newState;

    this.options.onStateChange(newState, this.serviceName);

    console.log(
      `[CircuitBreaker] ${this.serviceName}: ${oldState} → ${newState}`
    );
  }

  /**
   * Reset all statistics
   */
  private resetStats(): void {
    this.stats = {
      failures: 0,
      successes: 0,
      consecutiveSuccesses: 0,
    };
    this.nextAttempt = undefined;
  }

  /**
   * Get current state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Get current statistics
   */
  getStats(): Readonly<CircuitStats> {
    return { ...this.stats };
  }

  /**
   * Manually open the circuit
   */
  open(): void {
    this.transitionTo(CircuitState.OPEN);
    this.scheduleReset();
  }

  /**
   * Manually close the circuit
   */
  close(): void {
    this.transitionTo(CircuitState.CLOSED);
    this.resetStats();
  }

  /**
   * Manually reset the circuit to half-open
   */
  halfOpen(): void {
    this.transitionTo(CircuitState.HALF_OPEN);
  }
}

/**
 * Circuit Breaker Registry
 * Manages multiple circuit breakers for different services
 */
class CircuitBreakerRegistry {
  private breakers = new Map<string, CircuitBreaker>();

  get(
    serviceName: string,
    options?: CircuitBreakerOptions
  ): CircuitBreaker {
    if (!this.breakers.has(serviceName)) {
      this.breakers.set(serviceName, new CircuitBreaker(serviceName, options));
    }
    return this.breakers.get(serviceName)!;
  }

  getAll(): Map<string, CircuitBreaker> {
    return new Map(this.breakers);
  }

  clear(): void {
    this.breakers.clear();
  }
}

export const circuitBreakerRegistry = new CircuitBreakerRegistry();

/**
 * Wrap a function with circuit breaker protection
 */
export function withCircuitBreaker<T extends (...args: any[]) => Promise<any>>(
  serviceName: string,
  fn: T,
  options?: CircuitBreakerOptions
): T {
  const breaker = circuitBreakerRegistry.get(serviceName, options);

  return (async (...args: any[]) => {
    return breaker.execute(() => fn(...args));
  }) as T;
}

/**
 * Circuit Breaker decorator for class methods
 */
export function CircuitBreak(
  serviceName: string,
  options?: CircuitBreakerOptions
) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    const breaker = circuitBreakerRegistry.get(serviceName, options);

    descriptor.value = async function (...args: any[]) {
      return breaker.execute(() => originalMethod.apply(this, args));
    };

    return descriptor;
  };
}
