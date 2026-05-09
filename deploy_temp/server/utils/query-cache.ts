/**
 * DB Query Cache — P0 pool-exhaustion relief
 *
 * Wraps heavy read-only queries with a short-lived LRU cache so the
 * same expensive SELECT is not fired on every concurrent request.
 *
 * Usage:
 *   const data = await queryCache.get(
 *     'compliance:summary:agent:42',
 *     () => db.select().from(complianceEvents).where(...),
 *     120  // TTL seconds (optional, default 60)
 *   );
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const DEFAULT_TTL_S = 60;
const MAX_ENTRIES = 500;

class QueryCache {
  private store = new Map<string, CacheEntry<unknown>>();

  async get<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlSeconds: number = DEFAULT_TTL_S,
  ): Promise<T> {
    const entry = this.store.get(key) as CacheEntry<T> | undefined;
    if (entry && entry.expiresAt > Date.now()) {
      return entry.value;
    }

    const value = await fetcher();
    this.set(key, value, ttlSeconds);
    return value;
  }

  set<T>(key: string, value: T, ttlSeconds: number = DEFAULT_TTL_S): void {
    if (this.store.size >= MAX_ENTRIES) {
      const oldest = this.store.keys().next().value;
      if (oldest) this.store.delete(oldest);
    }
    this.store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  invalidate(keyOrPrefix: string): void {
    for (const k of this.store.keys()) {
      if (k === keyOrPrefix || k.startsWith(keyOrPrefix + ':')) {
        this.store.delete(k);
      }
    }
  }

  invalidateAll(): void {
    this.store.clear();
  }

  get size(): number {
    return this.store.size;
  }

  stats(): { size: number; maxEntries: number } {
    return { size: this.store.size, maxEntries: MAX_ENTRIES };
  }
}

export const queryCache = new QueryCache();
