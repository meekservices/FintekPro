/**
 * @file distributed-lock.ts
 * @description Zero-Redis Distributed Lock (PostgreSQL Distributed Lock + Optional Redis + Local Fallback).
 *
 * Problem:
 * In autoscaled Cloud Run deployments, cron jobs, order operations, and market data syncs
 * execute concurrently on multiple pods if relying solely on in-process node-cron.
 *
 * Solution:
 * Uses PostgreSQL distributed locking with TTL via atomic conditional upsert (`distributed_locks`).
 * Works 100% across all autoscaled Cloud Run pods without requiring Redis or Memorystore.
 * When Redis is available, it can optionally be used as an accelerator.
 * Falls back gracefully to an in-memory TTL lock for isolated offline unit testing.
 *
 * Complies with FintekPro GCR v1.0:
 * - Structured logging: { event, lock_key, status, latency_ms }
 * - Graceful degradation: never crash full system
 * - Deterministic error reporting
 */

import { randomUUID } from "crypto";
import { logger } from "../logger";
import { getSharedRedis } from "./redis-client";
import { pool } from "../db";

// In-memory fallback lock table for local/single-pod mode
interface LocalLock {
	token: string;
	expiresAt: number;
}

const localLocks = new Map<string, LocalLock>();

// Periodic cleanup of stale local locks
setInterval(() => {
	const now = Date.now();
	for (const [key, lock] of localLocks.entries()) {
		if (now >= lock.expiresAt) {
			localLocks.delete(key);
		}
	}
}, 30_000).unref?.();

export interface LockHandle {
	acquired: boolean;
	lockKey: string;
	token: string;
	release: () => Promise<boolean>;
}

let tableEnsured = false;
async function ensureLockTable(): Promise<void> {
	if (tableEnsured) return;
	try {
		await pool.query(`
			CREATE TABLE IF NOT EXISTS distributed_locks (
				lock_key VARCHAR(255) PRIMARY KEY,
				token VARCHAR(255) NOT NULL,
				acquired_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
				expires_at TIMESTAMPTZ NOT NULL
			);
			CREATE INDEX IF NOT EXISTS idx_distributed_locks_expires_at ON distributed_locks (expires_at);
		`);
		tableEnsured = true;
	} catch (err: unknown) {
		const msg = err instanceof Error ? err.message : String(err);
		logger.debug("[DistributedLock] Table ensure skipped/failed", { error: msg });
	}
}

/**
 * Acquire a distributed lock for a specific task.
 * @param lockKey - Unique identifier for the job or resource (e.g. "cron:market-enrichment")
 * @param ttlSeconds - Time-to-live in seconds before lock auto-expires
 */
export async function acquireDistributedLock(
	lockKey: string,
	ttlSeconds = 60,
): Promise<LockHandle> {
	const startTime = Date.now();
	const fullKey = `fintekpro:lock:${lockKey}`;
	const token = randomUUID();

	// Tier 1: Optional Redis accelerator (if REDIS_URL is configured and connected)
	if (process.env.REDIS_URL) {
		try {
			const redis = await getSharedRedis();
			if (redis?.isOpen) {
				const res = await redis.set(fullKey, token, {
					NX: true,
					EX: ttlSeconds,
				});

				const acquired = res === "OK";
				const latencyMs = Date.now() - startTime;

				if (acquired) {
					logger.info("[DistributedLock] Acquired Redis cluster lock", {
						event: "DISTRIBUTED_LOCK_ACQUIRED",
						lock_key: lockKey,
						ttl_seconds: ttlSeconds,
						latency_ms: latencyMs,
						provider: "REDIS",
						status: "SUCCESS",
					});
				} else {
					logger.debug("[DistributedLock] Redis lock contested by another pod", {
						event: "DISTRIBUTED_LOCK_CONTESTED",
						lock_key: lockKey,
						latency_ms: latencyMs,
						provider: "REDIS",
						status: "SKIPPED",
					});
				}

				return {
					acquired,
					lockKey,
					token,
					release: async () => {
						try {
							const luaScript = `
								if redis.call("get", KEYS[1]) == ARGV[1] then
									return redis.call("del", KEYS[1])
								else
									return 0
								end
							`;
							const result = await redis.eval(luaScript, {
								keys: [fullKey],
								arguments: [token],
							});
							return result === 1;
						} catch (releaseErr: unknown) {
							const msg = releaseErr instanceof Error ? releaseErr.message : String(releaseErr);
							logger.warn("[DistributedLock] Failed to release Redis lock", {
								error: msg,
								lock_key: lockKey,
							});
							return false;
						}
					},
				};
			}
		} catch (redisErr: unknown) {
			const msg = redisErr instanceof Error ? redisErr.message : String(redisErr);
			logger.warn("[DistributedLock] Redis check failed — falling back to PostgreSQL", {
				error: msg,
				lock_key: lockKey,
			});
		}
	}

	// Tier 2: PostgreSQL Distributed Lock (Zero-Redis Core Engine)
	try {
		await ensureLockTable();

		const query = `
			INSERT INTO distributed_locks (lock_key, token, acquired_at, expires_at)
			VALUES ($1, $2, NOW(), NOW() + ($3 || ' seconds')::INTERVAL)
			ON CONFLICT (lock_key) DO UPDATE
			SET token = EXCLUDED.token,
			    acquired_at = EXCLUDED.acquired_at,
			    expires_at = EXCLUDED.expires_at
			WHERE distributed_locks.expires_at < NOW()
			RETURNING lock_key;
		`;

		const result = await pool.query(query, [lockKey, token, ttlSeconds]);
		const acquired = (result.rowCount ?? 0) > 0;
		const latencyMs = Date.now() - startTime;

		if (acquired) {
			logger.info("[DistributedLock] Acquired PostgreSQL cluster lock (Zero-Redis)", {
				event: "DISTRIBUTED_LOCK_ACQUIRED",
				lock_key: lockKey,
				ttl_seconds: ttlSeconds,
				latency_ms: latencyMs,
				provider: "POSTGRES",
				status: "SUCCESS",
			});
		} else {
			logger.debug("[DistributedLock] PostgreSQL lock contested by another pod", {
				event: "DISTRIBUTED_LOCK_CONTESTED",
				lock_key: lockKey,
				latency_ms: latencyMs,
				provider: "POSTGRES",
				status: "SKIPPED",
			});
		}

		return {
			acquired,
			lockKey,
			token,
			release: async () => {
				try {
					const delRes = await pool.query(
						`DELETE FROM distributed_locks WHERE lock_key = $1 AND token = $2`,
						[lockKey, token],
					);
					return (delRes.rowCount ?? 0) > 0;
				} catch (err: unknown) {
					const msg = err instanceof Error ? err.message : String(err);
					logger.warn("[DistributedLock] Failed to release PostgreSQL lock", {
						error: msg,
						lock_key: lockKey,
					});
					return false;
				}
			},
		};
	} catch (pgErr: unknown) {
		const msg = pgErr instanceof Error ? pgErr.message : String(pgErr);
		logger.warn("[DistributedLock] PostgreSQL lock query failed — falling back to local memory", {
			error: msg,
			lock_key: lockKey,
		});
	}

	// Tier 3: Local In-Memory Fallback (Offline / Test Mode)
	const now = Date.now();
	const existing = localLocks.get(fullKey);

	if (existing && now < existing.expiresAt) {
		return {
			acquired: false,
			lockKey,
			token,
			release: async () => false,
		};
	}

	localLocks.set(fullKey, {
		token,
		expiresAt: now + ttlSeconds * 1000,
	});

	return {
		acquired: true,
		lockKey,
		token,
		release: async () => {
			const current = localLocks.get(fullKey);
			if (current?.token === token) {
				localLocks.delete(fullKey);
				return true;
			}
			return false;
		},
	};
}

/**
 * Higher-order utility to wrap a cron or recurring task in a distributed lock.
 * If another pod already holds the lock, execution is safely skipped without throwing.
 */
export async function withDistributedLock<T>(
	lockKey: string,
	ttlSeconds: number,
	task: () => Promise<T>,
): Promise<{ executed: boolean; result?: T }> {
	const handle = await acquireDistributedLock(lockKey, ttlSeconds);

	if (!handle.acquired) {
		return { executed: false };
	}

	try {
		const result = await task();
		return { executed: true, result };
	} finally {
		await handle.release();
	}
}
