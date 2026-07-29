/**
 * Distributed Cache Utility
 * P1 — Redis-backed compliance cache across autoscale pods.
 *
 * Uses Redis when REDIS_URL is configured (production autoscale).
 * Falls back to a local LRU map when Redis is unavailable (dev / single-pod).
 * The interface is identical either way so callers never need to branch.
 *
 * Redis access goes through the shared circuit-breaker client (redis-client.ts).
 * If Redis is down, getSharedRedis() returns null in <1ms after the first
 * failed attempt (60-second circuit breaker cooldown).
 */

import { logger } from "../logger";

type CacheValue = string;

interface CacheEntry {
	value: CacheValue;
	expiresAt: number;
}

class LocalLRUCache {
	private store = new Map<string, CacheEntry>();
	private readonly maxSize: number;

	constructor(maxSize = 5000) {
		this.maxSize = maxSize;
		setInterval(() => this.evictExpired(), 60_000).unref?.();
	}

	get(key: string): CacheValue | null {
		const entry = this.store.get(key);
		if (!entry) return null;
		if (Date.now() > entry.expiresAt) {
			this.store.delete(key);
			return null;
		}
		this.store.delete(key);
		this.store.set(key, entry);
		return entry.value;
	}

	set(key: string, value: CacheValue, ttlSeconds: number): void {
		if (this.store.size >= this.maxSize) {
			const oldest = this.store.keys().next().value;
			if (oldest) this.store.delete(oldest);
		}
		this.store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
	}

	del(key: string): void {
		this.store.delete(key);
	}

	private evictExpired(): void {
		const now = Date.now();
		for (const [k, v] of this.store) {
			if (now > v.expiresAt) this.store.delete(k);
		}
	}

	size(): number {
		return this.store.size;
	}
}

class DistributedCache {
	private local: LocalLRUCache;

	constructor() {
		this.local = new LocalLRUCache();
		// Warm up shared Redis connection in background (non-blocking)
		import("./redis-client")
			.then(({ getSharedRedis }) => getSharedRedis().catch(() => {}))
			.catch(() => {});
	}

	private async redis(): Promise<any> {
		try {
			const { getSharedRedis } = await import("./redis-client");
			return getSharedRedis();
		} catch {
			return null;
		}
	}

	async get(key: string): Promise<string | null> {
		try {
			const r = await this.redis();
			if (r) return await r.get(key);
		} catch { /* fall through to local */ }
		return this.local.get(key);
	}

	async set(key: string, value: string, ttlSeconds: number): Promise<void> {
		try {
			const r = await this.redis();
			if (r) { await r.setEx(key, ttlSeconds, value); return; }
		} catch { /* fall through to local */ }
		this.local.set(key, value, ttlSeconds);
	}

	async del(key: string): Promise<void> {
		try {
			const r = await this.redis();
			if (r) { await r.del(key); return; }
		} catch { /* fall through to local */ }
		this.local.del(key);
	}

	async getJson<T>(key: string): Promise<T | null> {
		const raw = await this.get(key);
		if (!raw) return null;
		try { return JSON.parse(raw) as T; } catch { return null; }
	}

	async setJson<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
		await this.set(key, JSON.stringify(value), ttlSeconds);
	}

	isUsingRedis(): boolean {
		return false; // circuit-breaker managed; no persistent state here
	}

	localSize(): number {
		return this.local.size();
	}
}

export const distributedCache = new DistributedCache();
