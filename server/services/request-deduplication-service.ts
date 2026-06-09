/**
 * Request Deduplication Service
 *
 * Prevents duplicate in-flight API requests for the same resource.
 * When multiple callers request the same resource simultaneously,
 * only one API call is made and all callers receive the same result.
 *
 * Benefits:
 * - Reduces API costs by eliminating duplicate requests
 * - Improves response times for deduplicated calls
 * - Prevents rate limit issues from burst requests
 */

type PendingRequest<T> = {
	promise: Promise<T>;
	timestamp: number;
	callers: number;
};

class RequestDeduplicationService {
	private pendingRequests: Map<string, PendingRequest<any>> = new Map();
	private metrics = {
		totalRequests: 0,
		deduplicatedRequests: 0,
		apiCallsSaved: 0,
	};

	/**
	 * Execute a request with deduplication
	 * If an identical request is already in-flight, return its promise instead of making a new call
	 *
	 * @param key Unique identifier for the request (e.g., 'credhive:company:U12345MH2020PTC123456')
	 * @param fetcher Function that makes the actual API call
	 * @param ttlMs Optional TTL for keeping the result cached after completion (default: 0, no post-completion caching)
	 */
	async dedupe<T>(
		key: string,
		fetcher: () => Promise<T>,
		ttlMs: number = 0,
	): Promise<T> {
		this.metrics.totalRequests++;

		const existing = this.pendingRequests.get(key);

		if (existing) {
			existing.callers++;
			this.metrics.deduplicatedRequests++;
			this.metrics.apiCallsSaved++;
			console.log(
				`[RequestDedupe] Deduplicated request for: ${key} (${existing.callers} callers)`,
			);
			return existing.promise;
		}

		const promise = this.executeWithCleanup(key, fetcher, ttlMs);

		this.pendingRequests.set(key, {
			promise,
			timestamp: Date.now(),
			callers: 1,
		});

		return promise;
	}

	private async executeWithCleanup<T>(
		key: string,
		fetcher: () => Promise<T>,
		ttlMs: number,
	): Promise<T> {
		try {
			const result = await fetcher();

			if (ttlMs > 0) {
				setTimeout(() => {
					this.pendingRequests.delete(key);
				}, ttlMs);
			} else {
				this.pendingRequests.delete(key);
			}

			return result;
		} catch (error) {
			this.pendingRequests.delete(key);
			throw error;
		}
	}

	/**
	 * Create a deduplication key for common request types
	 */
	createKey(
		service: string,
		operation: string,
		...identifiers: string[]
	): string {
		return `${service}:${operation}:${identifiers.join(":")}`;
	}

	/**
	 * Check if a request is currently in-flight
	 */
	isInFlight(key: string): boolean {
		return this.pendingRequests.has(key);
	}

	/**
	 * Get current deduplication metrics
	 */
	getMetrics() {
		return {
			...this.metrics,
			currentInFlight: this.pendingRequests.size,
			savingsPercentage:
				this.metrics.totalRequests > 0
					? (
							(this.metrics.apiCallsSaved / this.metrics.totalRequests) *
							100
						).toFixed(2)
					: "0.00",
		};
	}

	/**
	 * Clear all pending requests (use with caution, mainly for testing)
	 */
	clearAll(): void {
		this.pendingRequests.clear();
	}

	/**
	 * Reset metrics
	 */
	resetMetrics(): void {
		this.metrics = {
			totalRequests: 0,
			deduplicatedRequests: 0,
			apiCallsSaved: 0,
		};
	}
}

export const requestDedupeService = new RequestDeduplicationService();
