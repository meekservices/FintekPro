import { db } from "../db";
import { sql } from "drizzle-orm";
import { BoundedCache } from "../utils/bounded-cache";
import { logger } from "../logger";

export interface CacheStats {
	l1Hits: number;
	l2Hits: number;
	misses: number;
	writes: number;
	l1Size: number;
}

export class TwoTierCacheService {
	private static instance: TwoTierCacheService;
	// L1: In-process LRU cache (RAM, <0.05ms)
	private l1Cache: BoundedCache<{ value: any; expiresAt: number }>;
	private tableInitialized = false;
	private stats: CacheStats = {
		l1Hits: 0,
		l2Hits: 0,
		misses: 0,
		writes: 0,
		l1Size: 0,
	};

	static getInstance(): TwoTierCacheService {
		if (!TwoTierCacheService.instance) {
			TwoTierCacheService.instance = new TwoTierCacheService();
		}
		return TwoTierCacheService.instance;
	}

	constructor(maxL1Entries = 2500) {
		this.l1Cache = new BoundedCache<{ value: any; expiresAt: number }>(maxL1Entries);
		// Initialize the L2 DB table asynchronously
		this.ensureL2Table().catch((err) => {
			logger.warn("[TwoTierCache] L2 Table initialization notice:", err?.message);
		});
		// Periodically delete expired L2 rows every 15 minutes
		const cleanupTimer = setInterval(() => this.purgeExpiredL2Entries(), 15 * 60 * 1000);
		if (cleanupTimer && typeof cleanupTimer.unref === "function") {
			cleanupTimer.unref();
		}
	}

	/**
	 * Ensures the PostgreSQL L2 cache table exists
	 */
	private async ensureL2Table(): Promise<void> {
		if (this.tableInitialized) return;
		try {
			await db.execute(sql`
				CREATE TABLE IF NOT EXISTS app_cache_store (
					cache_key VARCHAR(255) PRIMARY KEY,
					cache_value JSONB NOT NULL,
					expires_at TIMESTAMPTZ NOT NULL,
					created_at TIMESTAMPTZ DEFAULT NOW()
				);
				CREATE INDEX IF NOT EXISTS idx_app_cache_store_expires ON app_cache_store (expires_at);
			`);
			this.tableInitialized = true;
			logger.info("[TwoTierCache] L2 PostgreSQL cache table verified");
		} catch (e: any) {
			logger.warn("[TwoTierCache] L2 table verification warning:", e?.message);
		}
	}

	/**
	 * Get an item from cache: checks L1 (RAM) first, then L2 (PostgreSQL)
	 */
	async get<T>(key: string): Promise<T | null> {
		const now = Date.now();

		// 1. Check L1 Cache (0.01ms)
		const l1Entry = this.l1Cache.get(key);
		if (l1Entry) {
			if (l1Entry.expiresAt > now) {
				this.stats.l1Hits++;
				return l1Entry.value as T;
			}
			this.l1Cache.delete(key);
		}

		// 2. Check L2 Cache (PostgreSQL table: ~1-3ms)
		try {
			await this.ensureL2Table();
			const result = await db.execute(sql`
				SELECT cache_value, expires_at
				FROM app_cache_store
				WHERE cache_key = ${key}
				LIMIT 1
			`);

			const rows = (result as any).rows || [];
			if (rows.length > 0) {
				const row = rows[0];
				const expiresAtTime = new Date(row.expires_at).getTime();

				if (expiresAtTime > now) {
					const value = row.cache_value as T;
					// Back-populate L1 cache for subsequent instant hits
					this.l1Cache.set(key, { value, expiresAt: expiresAtTime });
					this.stats.l2Hits++;
					return value;
				}

				// Expired in L2: delete asynchronously
				db.execute(sql`DELETE FROM app_cache_store WHERE cache_key = ${key}`).catch(() => {});
			}
		} catch (err: any) {
			logger.warn(`[TwoTierCache] L2 fetch failed for key ${key}:`, err?.message);
		}

		this.stats.misses++;
		return null;
	}

	/**
	 * Set an item in cache: writes to L1 (RAM) and L2 (PostgreSQL) simultaneously
	 */
	async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
		const safeTtl = Math.max(5, ttlSeconds);
		const expiresAtMs = Date.now() + safeTtl * 1000;
		const expiresAtDate = new Date(expiresAtMs).toISOString();

		// Write to L1 RAM
		this.l1Cache.set(key, { value, expiresAt: expiresAtMs });
		this.stats.writes++;

		// Write to L2 PostgreSQL asynchronously without blocking caller
		try {
			await this.ensureL2Table();
			await db.execute(sql`
				INSERT INTO app_cache_store (cache_key, cache_value, expires_at)
				VALUES (${key}, ${JSON.stringify(value)}::jsonb, ${expiresAtDate}::timestamptz)
				ON CONFLICT (cache_key) DO UPDATE SET
					cache_value = EXCLUDED.cache_value,
					expires_at = EXCLUDED.expires_at,
					created_at = NOW()
			`);
		} catch (err: any) {
			logger.warn(`[TwoTierCache] L2 upsert failed for key ${key}:`, err?.message);
		}
	}

	/**
	 * Cache-Aside pattern: returns cached data or computes, caches, and returns it
	 */
	async wrap<T>(key: string, ttlSeconds: number, fetcher: () => Promise<T>): Promise<T> {
		const cached = await this.get<T>(key);
		if (cached !== null && cached !== undefined) {
			return cached;
		}

		const fresh = await fetcher();
		if (fresh !== null && fresh !== undefined) {
			await this.set(key, fresh, ttlSeconds);
		}
		return fresh;
	}

	/**
	 * Delete a specific key from both L1 and L2
	 */
	async del(key: string): Promise<void> {
		this.l1Cache.delete(key);
		try {
			await this.ensureL2Table();
			await db.execute(sql`DELETE FROM app_cache_store WHERE cache_key = ${key}`);
		} catch (err: any) {
			logger.warn(`[TwoTierCache] L2 del failed for key ${key}:`, err?.message);
		}
	}

	/**
	 * Alias for del()
	 */
	async delete(key: string): Promise<void> {
		return this.del(key);
	}

	/**
	 * Clear local memory cache and purge all L2 rows
	 */
	async clear(): Promise<void> {
		this.l1Cache.clear();
		try {
			await this.ensureL2Table();
			await db.execute(sql`TRUNCATE TABLE app_cache_store`);
		} catch (err: any) {
			logger.warn("[TwoTierCache] L2 clear failed:", err?.message);
		}
	}

	/**
	 * Purge expired entries from L2 database
	 */
	async purgeExpiredL2Entries(): Promise<number> {
		try {
			await this.ensureL2Table();
			const result = await db.execute(sql`
				DELETE FROM app_cache_store
				WHERE expires_at < NOW()
			`);
			return (result as any).rowCount || 0;
		} catch {
			return 0;
		}
	}

	getStats(): CacheStats {
		return {
			...this.stats,
			l1Size: this.l1Cache.size,
		};
	}
}

export const twoTierCacheService = TwoTierCacheService.getInstance();
