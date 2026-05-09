/**
 * Retry Utility with Exponential Backoff
 * Provides configurable retry logic for operations that may fail transiently
 */

import { AppError } from './errors';

export interface RetryOptions {
  maxAttempts?: number;
  baseDelay?: number;
  maxDelay?: number;
  jitter?: boolean;
  timeoutMs?: number;
  onRetry?: (error: Error, attempt: number) => void;
  shouldRetry?: (error: Error) => boolean;
}

export interface RetryResult<T> {
  result: T;
  attempts: number;
  totalTime: number;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  jitter: true,
  timeoutMs: 60000,
  onRetry: () => {},
  shouldRetry: (error: Error) => {
    if (error instanceof AppError) {
      return error.isRetryable;
    }
    return false;
  },
};

/**
 * Calculate delay with exponential backoff and optional jitter
 */
function calculateDelay(
  attempt: number,
  baseDelay: number,
  maxDelay: number,
  jitter: boolean
): number {
  const exponentialDelay = Math.min(
    baseDelay * Math.pow(2, attempt - 1),
    maxDelay
  );

  if (!jitter) {
    return exponentialDelay;
  }

  return Math.floor(exponentialDelay * (0.5 + Math.random() * 0.5));
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute a function with retry logic
 */
export async function executeWithRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<RetryResult<T>> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const startTime = Date.now();
  let lastError: Error;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Operation timeout after ${opts.timeoutMs}ms`));
        }, opts.timeoutMs);
      });

      const result = await Promise.race([fn(), timeoutPromise]);

      return {
        result,
        attempts: attempt,
        totalTime: Date.now() - startTime,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      const isLastAttempt = attempt === opts.maxAttempts;
      const shouldRetry = opts.shouldRetry(lastError);

      if (isLastAttempt || !shouldRetry) {
        throw lastError;
      }

      opts.onRetry(lastError, attempt);

      const delay = calculateDelay(
        attempt,
        opts.baseDelay,
        opts.maxDelay,
        opts.jitter
      );
      await sleep(delay);
    }
  }

  throw lastError!;
}

/**
 * Retry decorator for class methods
 */
export function Retry(options: RetryOptions = {}) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const result = await executeWithRetry(
        () => originalMethod.apply(this, args),
        options
      );
      return result.result;
    };

    return descriptor;
  };
}

/**
 * Create a retryable version of a function
 */
export function withRetry<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  options: RetryOptions = {}
): T {
  return (async (...args: any[]) => {
    const result = await executeWithRetry(() => fn(...args), options);
    return result.result;
  }) as T;
}
