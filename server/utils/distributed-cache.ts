/**
 * @file distributed-cache.ts
 * @description Two-Tier Zero-Redis Distributed Cache (L1 Memory LRU + L2 PostgreSQL + Optional Redis).
 *
 * Architecture:
 * - L1: High-throughput local LRU cache in memory (sub-millisecond reads)
 * - L2: Shared PostgreSQL cluster_cache table (multi-pod cross-instance consistency without Redis)
 * - Optional Tier: Redis client when REDIS_URL is explicitly configured
 *
 * Guarantees compliance and session state consistency across Cloud Run pods without Memorystore.
 */

import { logger } from "../logger";
import { pool } from "../db";

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

let clusterCacheEnsured = false;
async function ensureClusterCacheTable(): Promise<void> {
	if (clusterCacheEnsured) return;
	try {
		await pool.query(`
			CREATE TABLE IF NOT EXISTS cluster_cache (
				key VARCHAR(255) PRIMARY KEY,
				value TEXT NOT NULL,
				expires_at TIMESTAMPTZ NOT NULL
			);
			CREATE INDEX IF NOT EXISTS idx_cluster_cache_expires_at ON cluster_cache (expires_at);
		`);
		clusterCacheEnsured = true;
	} catch (err: unknown) {
		const msg = err instanceof Error ? err.message : String(err);
		logger.debug("[DistributedCache] Table ensure skipped/failed", { error: msg });
	}
}

class DistributedCache {
	private local: LocalLRUCache;

	constructor() {
		this.local = new LocalLRUCache();
		if (process.env.REDIS_URL) {
			import("./redis-client")
				.then(({ getSharedRedis }) => getSharedRedis().catch(() => {}))
				.catch(() => {});
		}
	}

	private async redis(): Promise<any> {
		if (!process.env.REDIS_URL) return null;
		try {
			const { getSharedRedis } = await import("./redis-client");
			return getSharedRedis();
		} catch {
			return null;
		}
	}

	async get(key: string): Promise<string | null> {
		// Tier 1: Check L1 local LRU cache
		const l1Val = this.local.get(key);
		if (l1Val !== null) return l1Val;

		// Optional: Redis
		if (process.env.REDIS_URL) {
			try {
				const r = await this.redis();
				if (r) {
					const redisVal = await r.get(key);
					if (redisVal) {
						this.local.set(key, redisVal, 300);
						return redisVal;
					}
				}
			} catch {
				/* fall through to L2 PostgreSQL */
			}
		}

		// Tier 2: Check L2 PostgreSQL cluster_cache (Zero-Redis Multi-Pod)
		try {
			await ensureClusterCacheTable();
			const res = await pool.query(
				`SELECT value, expires_at FROM cluster_cache WHERE key = $1 AND expires_at > NOW()`,
				[key],
			);
			if (res.rows.length > 0) {
				const val = res.rows[0].value as string;
				const expiresAt = new Date(res.rows[0].expires_at).getTime();
				const remainingSec = Math.max(1, Math.floor((expiresAt - Date.now()) / 1000));
				this.local.set(key, val, remainingSec);
				return val;
			}
		} catch {
			/* local fallback */
		}

		return null;
	}

	async set(key: string, value: string, ttlSeconds: number): Promise<void> {
		// 1. Write to L1 in-memory LRU
		this.local.set(key, value, ttlSeconds);

		// 2. Optional: Write to Redis
		if (process.env.REDIS_URL) {
			try {
				const r = await this.redis();
				if (r) {
					await r.setEx(key, ttlSeconds, value);
				}
			} catch {
				/* ignore redis error */
			}
		}

		// 3. Write to L2 PostgreSQL cluster_cache
		try {
			await ensureClusterCacheTable();
			await pool.query(
				`INSERT INTO cluster_cache (key, value, expires_at)
				 VALUES ($1, $2, NOW() + ($3 || ' seconds')::INTERVAL)
				 ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, expires_at = EXCLUDED.expires_at`,
				[key, value, ttlSeconds],
			);
		} catch {
			/* non-fatal DB write error */
		}
	}

	async del(key: string): Promise<void> {
		// 1. Delete from L1 local
		this.local.del(key);

		// 2. Optional: Delete from Redis
		if (process.env.REDIS_URL) {
			try {
				const r = await this.redis();
				if (r) await r.del(key);
			} catch {
				/* ignore */
			}
		}

		// 3. Delete from L2 PostgreSQL
		try {
			await ensureClusterCacheTable();
			await pool.query(`DELETE FROM cluster_cache WHERE key = $1`, [key]);
		} catch {
			/* non-fatal */
		}
	}

	async getJson<T>(key: string): Promise<T | null> {
		const raw = await this.get(key);
		if (!raw) return null;
		try {
			return JSON.parse(raw) as T;
		} catch {
			return null;
		}
	}

	async setJson<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
		await this.set(key, JSON.stringify(value), ttlSeconds);
	}

	isUsingRedis(): boolean {
		return !!process.env.REDIS_URL;
	}

	localSize(): number {
		return this.local.size();
	}
}

export const distributedCache = new DistributedCache();
