/**
 * Shared Redis client with circuit-breaker and 2.5-second connect timeout.
 *
 * Problem: REDIS_URL may point to an unreachable host. Without a timeout,
 * every `await client.connect()` hangs indefinitely, blocking all API requests.
 *
 * Solution:
 *  1. Hard 2.5-second timeout on connect via Promise.race
 *  2. Circuit breaker: after a failed attempt, skip retries for 60 seconds
 *     so downstream requests never accumulate timeout delays.
 *
 * Usage:
 *   import { getSharedRedis } from "../utils/redis-client";
 *   const redis = await getSharedRedis();   // returns null if unavailable
 *   if (redis) await redis.get("key");
 */

import { logger } from "../logger";

const CONNECT_TIMEOUT_MS = 2000;
const RACE_TIMEOUT_MS    = 2500;
const RETRY_COOLDOWN_MS  = 60_000; // 60s circuit-breaker cooldown

let _client: any           = null;
let _lastFailedAt: number  = 0;   // epoch ms of last connect failure
let _connecting            = false;

export async function getSharedRedis(): Promise<any> {
  // Already connected and open
  if (_client?.isOpen) return _client;

  // Circuit breaker: skip if we failed recently
  if (_lastFailedAt && Date.now() - _lastFailedAt < RETRY_COOLDOWN_MS) {
    return null;
  }

  // If already connecting (e.g. background warm-up in progress), don't queue — return null
  // The circuit breaker will trip after the in-flight connect resolves, protecting future calls
  if (_connecting) return null;

  if (!process.env.REDIS_URL) return null;

  _connecting = true;
  try {
    const { createClient } = await import("redis");
    const c = createClient({
      url: process.env.REDIS_URL,
      socket: {
        connectTimeout: CONNECT_TIMEOUT_MS,
        reconnectStrategy: false, // manual reconnect via circuit breaker
      },
    });
    c.on("error", () => {
      logger.warn("[Redis] Connection error — closing client");
      _client = null;
    });

    await Promise.race([
      c.connect(),
      new Promise<void>((_, reject) =>
        setTimeout(
          () => reject(new Error("Redis connect timeout")),
          RACE_TIMEOUT_MS,
        ),
      ),
    ]);

    logger.info("[Redis] Connected successfully", { url: process.env.REDIS_URL?.replace(/\/\/.*@/, "//***@") });
    _client = c;
    _lastFailedAt = 0; // reset circuit breaker on success
    return _client;
  } catch (err: any) {
    _client        = null;
    _lastFailedAt  = Date.now();
    logger.warn("[Redis] Connect failed — circuit breaker tripped for 60s", {
      error: err?.message,
    });
    return null;
  } finally {
    _connecting = false;
  }
}

/** Force-reset the circuit breaker (for testing or after manual fix) */
export function resetRedisCircuitBreaker(): void {
  _client       = null;
  _lastFailedAt = 0;
  _connecting   = false;
}
