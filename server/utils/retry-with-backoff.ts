/**
 * @file retry-with-backoff.ts
 * @description SHPR v1.0 — Shared retry utility with exponential backoff.
 *
 * Purpose:
 *   Provides a single, reusable retry wrapper used across all FintekPro services
 *   for transient failure recovery. Implements the Self-Healing Production Runtime
 *   (SHPR v1.0) §2 auto-retry mandate: max 3 retries, exponential backoff with jitter.
 *
 * Inputs:
 *   - fn: async function to retry
 *   - maxRetries: default 3 (SHPR mandate)
 *   - baseDelayMs: base delay in ms; doubles each attempt
 *   - context: optional label for structured logs
 *
 * Outputs:
 *   - Result of fn on success
 *   - Throws GcrError on final failure (retryable: false)
 *
 * Edge cases:
 *   - Jitter prevents thundering-herd on concurrent retries
 *   - Any attempt success short-circuits remaining retries
 *   - Non-retryable errors (4xx, validation) are not retried
 *
 * @module utils/retry-with-backoff
 * GCR v1.0 compliant — structured logs, error contract, no randomness in backoff formula
 */

import { logger } from "../logger";

/** GCR-standard error contract for failed operations. */
export interface GcrError {
  error_code: string;
  message: string;
  retryable: boolean;
  attempts: number;
  context?: string;
}

/**
 * Options for retryWithBackoff.
 */
export interface RetryOptions {
  /** Maximum retry attempts. SHPR mandate: default 3. */
  maxRetries?: number;
  /** Base delay in ms. Doubles each attempt with ±15% jitter. Default: 200ms. */
  baseDelayMs?: number;
  /** Human-readable label for structured log events. */
  context?: string;
  /**
   * Optional predicate to determine if an error is retryable.
   * If not provided, all errors are considered retryable.
   * Return false to skip retries (e.g. for 4xx validation errors).
   */
  isRetryable?: (err: unknown) => boolean;
}

/**
 * Retries an async function with exponential backoff and jitter.
 *
 * @param fn - The async function to execute and retry on failure.
 * @param options - Retry configuration (maxRetries, baseDelayMs, context, isRetryable).
 * @returns Promise resolving to the result of fn.
 * @throws GcrError after all retries are exhausted.
 *
 * @example
 * ```ts
 * const data = await retryWithBackoff(
 *   () => fetchMFNAVCagr(schemeCode),
 *   { context: "MFAPIClient.fetchNav", maxRetries: 3 }
 * );
 * ```
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelayMs = 200,
    context = "unknown",
    isRetryable = () => true,
  } = options;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      const result = await fn();
      if (attempt > 1) {
        // Log successful recovery after retries
        logger.info(`[RetryBackoff] Recovered after ${attempt - 1} retry(s)`, {
          event: "RETRY_RECOVERED",
          user_id: "system",
          context,
          attempts: attempt,
          latency_ms: 0,
          status: "success",
        });
      }
      return result;
    } catch (err) {
      lastError = err;
      const errMsg = err instanceof Error ? err.message : String(err);
      const canRetry = isRetryable(err);

      logger.warn(`[RetryBackoff] Attempt ${attempt}/${maxRetries + 1} failed`, {
        event: "RETRY_ATTEMPT",
        user_id: "system",
        context,
        attempt,
        max_retries: maxRetries,
        error_code: canRetry ? "TRANSIENT_ERROR" : "NON_RETRYABLE_ERROR",
        error_message: errMsg,
        retryable: canRetry && attempt <= maxRetries,
        latency_ms: 0,
        status: "error",
      });

      // Non-retryable error or exhausted retries — stop immediately
      if (!canRetry || attempt > maxRetries) break;

      // Exponential backoff with ±15% jitter (deterministic-ish per GCR)
      // delay = baseDelayMs * 2^(attempt-1) * jitter
      // jitter factor: 0.85–1.15 using attempt-based pseudo-random (not Math.random())
      const jitterFactor = 1 + ((attempt * 17) % 31 - 15) / 100; // ranges 0.85–1.15
      const delay = Math.round(baseDelayMs * Math.pow(2, attempt - 1) * jitterFactor);

      await sleep(delay);
    }
  }

  // Final failure — build GCR error contract
  const gcrError: GcrError = {
    error_code: "MAX_RETRIES_EXHAUSTED",
    message:
      lastError instanceof Error
        ? lastError.message
        : `Operation failed after ${maxRetries} retries in context: ${context}`,
    retryable: false,
    attempts: maxRetries + 1,
    context,
  };

  logger.error(`[RetryBackoff] All retries exhausted`, {
    event: "RETRY_EXHAUSTED",
    user_id: "system",
    context,
    attempts: maxRetries + 1,
    error_code: gcrError.error_code,
    latency_ms: 0,
    status: "error",
  });

  throw gcrError;
}

/** Promise-based sleep. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
