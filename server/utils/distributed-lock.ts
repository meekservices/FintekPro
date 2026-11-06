/**
 * @file distributed-lock.ts
 * @description Distributed Lock (Redlock pattern) for Multi-Pod Cloud Run Concurrency.
 *
 * Problem:
 * In autoscaled Cloud Run deployments, cron jobs, order operations, and market data syncs
 * execute concurrently on multiple pods if relying solely on in-process node-cron.
 *
 * Solution:
 * Uses Redis distributed locking with TTL and atomic Lua release script.
 * When Redis is unavailable (dev or transient network partition), falls back
 * gracefully to an in-memory TTL lock with structured audit logging.
 *
 * Complies with FintekPro GCR v1.0:
 * - Structured logging: { event, lock_key, status, latency_ms }
 * - Graceful degradation: never crash full system
 * - Deterministic error reporting
 */

import { randomUUID } from "crypto";
import { logger } from "../logger";
import { getSharedRedis } from "./redis-client";

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

	try {
		const redis = await getSharedRedis();

		if (redis?.isOpen) {
			// Redis distributed lock via SET NX EX
			const res = await redis.set(fullKey, token, {
				NX: true,
				EX: ttlSeconds,
			});

			const acquired = res === "OK";
			const latencyMs = Date.now() - startTime;

			if (acquired) {
				logger.info("[DistributedLock] Acquired cluster lock", {
					event: "DISTRIBUTED_LOCK_ACQUIRED",
					lock_key: lockKey,
					ttl_seconds: ttlSeconds,
					latency_ms: latencyMs,
					status: "SUCCESS",
				});
			} else {
				logger.debug("[DistributedLock] Lock contested by another pod", {
					event: "DISTRIBUTED_LOCK_CONTESTED",
					lock_key: lockKey,
					latency_ms: latencyMs,
					status: "SKIPPED",
				});
			}

			return {
				acquired,
				lockKey,
				token,
				release: async () => {
					try {
						// Atomic Lua release script: delete only if token matches
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
					} catch (releaseErr) {
						logger.warn("[DistributedLock] Failed to release Redis lock", {
							error: (releaseErr as Error).message,
							lock_key: lockKey,
						});
						return false;
					}
				},
			};
		}
	} catch (redisErr) {
		logger.warn("[DistributedLock] Redis check failed — falling back to local lock", {
			error: (redisErr as Error).message,
			lock_key: lockKey,
		});
	}

	// ─── Local In-Memory Fallback ──────────────────────────────────────────────
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

	// Grant local lock
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

