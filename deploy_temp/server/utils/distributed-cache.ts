/**
 * Distributed Cache Utility
 * P1 — Redis-backed compliance cache across autoscale pods.
 *
 * Uses Redis when REDIS_URL is configured (production autoscale).
 * Falls back to a local LRU map when Redis is unavailable (dev / single-pod).
 * The interface is identical either way so callers never need to branch.
 */

import { logger } from '../logger';

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
  private redisClient: any = null;
  private local: LocalLRUCache;
  private usingRedis = false;

  constructor() {
    this.local = new LocalLRUCache();
    this.initRedis().catch(() => {});
  }

  private async initRedis(): Promise<void> {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      logger.info('[DistributedCache] No REDIS_URL set — using local LRU cache');
      return;
    }
    try {
      // @ts-ignore: redis is an optional dependency
      const { createClient } = await import('redis').catch(() => ({ createClient: null }));
      if (!createClient) {
        logger.warn('[DistributedCache] redis package not installed — using local LRU');
        return;
      }
      const client = createClient({ url: redisUrl });
      client.on('error', (err: any) => {
        if (this.usingRedis) {
          logger.warn('[DistributedCache] Redis error — falling back to local LRU', { error: String(err) });
          this.usingRedis = false;
        }
      });
      client.on('ready', () => {
        logger.info('[DistributedCache] Redis connected — using distributed cache');
        this.usingRedis = true;
      });
      await client.connect();
      this.redisClient = client;
    } catch (err) {
      logger.warn('[DistributedCache] Redis init failed — using local LRU', { error: String(err) });
    }
  }

  async get(key: string): Promise<string | null> {
    if (this.usingRedis && this.redisClient) {
      try {
        return await this.redisClient.get(key);
      } catch {
        this.usingRedis = false;
      }
    }
    return this.local.get(key);
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    if (this.usingRedis && this.redisClient) {
      try {
        await this.redisClient.setEx(key, ttlSeconds, value);
        return;
      } catch {
        this.usingRedis = false;
      }
    }
    this.local.set(key, value, ttlSeconds);
  }

  async del(key: string): Promise<void> {
    if (this.usingRedis && this.redisClient) {
      try {
        await this.redisClient.del(key);
        return;
      } catch {
        this.usingRedis = false;
      }
    }
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
    return this.usingRedis;
  }

  localSize(): number {
    return this.local.size();
  }
}

export const distributedCache = new DistributedCache();
