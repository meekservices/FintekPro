/**
 * Bounded LRU Cache Utility
 *
 * Prevents memory leaks in serverless/containerized environments (such as Cloud Run)
 * by capping maximum entries and using an LRU eviction strategy combined with
 * optional TTL expiry.
 *
 * Provides a drop-in Map-compatible interface:
 *   - get(key: string): V | undefined
 *   - set(key: string, value: V): this
 *   - has(key: string): boolean
 *   - delete(key: string): boolean
 *   - clear(): void
 *   - size: number
 */

export interface CacheEntryWithExpiry {
	expiresAt?: number;
}

export class BoundedCache<V extends object = any> {
	private store = new Map<string, V>();
	private readonly maxSize: number;

	constructor(maxSize = 1000) {
		this.maxSize = Math.max(1, maxSize);
		// Periodically clean expired items every 60 seconds without keeping event loop alive
		const timer = setInterval(() => this.evictExpired(), 60_000);
		if (timer && typeof timer.unref === "function") {
			timer.unref();
		}
	}

	get(key: string): V | undefined {
		const entry = this.store.get(key);
		if (!entry) return undefined;

		const exp = (entry as CacheEntryWithExpiry).expiresAt;
		if (typeof exp === "number" && Date.now() > exp) {
			this.store.delete(key);
			return undefined;
		}

		// Refresh LRU order: delete and re-insert as newest
		this.store.delete(key);
		this.store.set(key, entry);
		return entry;
	}

	set(key: string, value: V): this {
		if (this.store.has(key)) {
			this.store.delete(key);
		} else if (this.store.size >= this.maxSize) {
			const oldestKey = this.store.keys().next().value;
			if (oldestKey !== undefined) {
				this.store.delete(oldestKey);
			}
		}
		this.store.set(key, value);
		return this;
	}

	has(key: string): boolean {
		return this.get(key) !== undefined;
	}

	delete(key: string): boolean {
		return this.store.delete(key);
	}

	clear(): void {
		this.store.clear();
	}

	get size(): number {
		return this.store.size;
	}

	private evictExpired(): void {
		const now = Date.now();
		for (const [k, v] of this.store) {
			const exp = (v as CacheEntryWithExpiry).expiresAt;
			if (typeof exp === "number" && now > exp) {
				this.store.delete(k);
			}
		}
	}
}
