/**
 * Resilient Client Utilities
 * Provides wrapper functions to add retry + circuit breaker to external API clients
 */

import { executeWithRetry, RetryOptions } from "./retry";
import { withCircuitBreaker, CircuitBreakerOptions } from "./circuitBreaker";
import { ExternalServiceError, TimeoutError } from "./errors";

export interface ResilientClientOptions {
	serviceName: string;
	retry?: RetryOptions;
	circuitBreaker?: CircuitBreakerOptions;
	timeout?: number;
}

const DEFAULT_TIMEOUT = 30000; // 30 seconds

/**
 * Create a resilient API client wrapper
 * Combines retry logic + circuit breaker + timeout handling
 */
export function createResilientClient<T extends object>(
	client: T,
	options: ResilientClientOptions,
): T {
	const {
		serviceName,
		retry,
		circuitBreaker,
		timeout = DEFAULT_TIMEOUT,
	} = options;

	const wrappedClient: any = {};

	for (const key of Object.keys(client)) {
		const value = (client as any)[key];

		if (typeof value === "function") {
			wrappedClient[key] = createResilientMethod(
				value.bind(client),
				serviceName,
				key,
				{
					retry,
					circuitBreaker,
					timeout,
				},
			);
		} else {
			wrappedClient[key] = value;
		}
	}

	return wrappedClient as T;
}

/**
 * Wrap a single method with resilience patterns
 */
function createResilientMethod(
	method: Function,
	serviceName: string,
	methodName: string,
	options: {
		retry?: RetryOptions;
		circuitBreaker?: CircuitBreakerOptions;
		timeout?: number;
	},
) {
	const { retry, circuitBreaker, timeout } = options;

	return async (...args: any[]) => {
		// Apply timeout
		const executeWithTimeout = async () => {
			const timeoutPromise = new Promise((_, reject) => {
				setTimeout(() => {
					reject(
						new TimeoutError(
							`${serviceName}.${methodName} timed out after ${timeout}ms`,
							timeout!,
							{ args },
						),
					);
				}, timeout);
			});

			const methodPromise = method(...args);

			try {
				return await Promise.race([methodPromise, timeoutPromise]);
			} catch (error) {
				if (error instanceof Error) {
					// Wrap external errors in ExternalServiceError
					if (!(error instanceof TimeoutError)) {
						throw new ExternalServiceError(
							serviceName,
							`${serviceName}.${methodName} failed: ${error.message}`,
							error,
							true, // isRetryable
							{ method: methodName, args },
						);
					}
				}
				throw error;
			}
		};

		// Apply circuit breaker
		const withCircuit = circuitBreaker
			? withCircuitBreaker(serviceName, executeWithTimeout, circuitBreaker)
			: executeWithTimeout;

		// Apply retry logic
		if (retry) {
			const result = await executeWithRetry(withCircuit, {
				...retry,
				onRetry: (error, attempt) => {
					console.warn(
						`[Retry] ${serviceName}.${methodName} attempt ${attempt}/${retry.maxAttempts}:`,
						error.message,
					);
					retry.onRetry?.(error, attempt);
				},
			});
			return result.result;
		}

		return withCircuit();
	};
}

/**
 * Predefined resilience configurations for different service types
 */
export const ResilienceProfiles = {
	/**
	 * Critical services that must succeed (max retries, long timeout)
	 */
	CRITICAL: {
		retry: {
			maxAttempts: 5,
			baseDelay: 1000,
			maxDelay: 30000,
			jitter: true,
			timeoutMs: 60000,
		},
		circuitBreaker: {
			failureThreshold: 10,
			successThreshold: 3,
			timeout: 120000,
		},
		timeout: 45000,
	},

	/**
	 * Standard external APIs (moderate retries)
	 */
	STANDARD: {
		retry: {
			maxAttempts: 3,
			baseDelay: 1000,
			maxDelay: 10000,
			jitter: true,
			timeoutMs: 30000,
		},
		circuitBreaker: {
			failureThreshold: 5,
			successThreshold: 2,
			timeout: 60000,
		},
		timeout: 30000,
	},

	/**
	 * Fast services where latency matters (fewer retries, short timeout)
	 */
	FAST: {
		retry: {
			maxAttempts: 2,
			baseDelay: 500,
			maxDelay: 5000,
			jitter: true,
			timeoutMs: 10000,
		},
		circuitBreaker: {
			failureThreshold: 3,
			successThreshold: 2,
			timeout: 30000,
		},
		timeout: 10000,
	},

	/**
	 * Best-effort services (no retry, just circuit breaker)
	 */
	BEST_EFFORT: {
		circuitBreaker: {
			failureThreshold: 5,
			successThreshold: 2,
			timeout: 60000,
		},
		timeout: 15000,
	},
};
