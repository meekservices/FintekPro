import { createLogger } from './logger';

const logger = createLogger({ service: 'cache' });

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export interface CacheOptions {
  ttl?: number;
}

export class CacheService {
  private cache: Map<string, CacheEntry<any>>;
  private cleanupInterval: NodeJS.Timeout | null;
  private readonly defaultTTL: number;

  constructor(defaultTTL: number = 3600000) {
    this.cache = new Map();
    this.cleanupInterval = null;
    this.defaultTTL = defaultTTL;
    this.startCleanup();
    logger.info('Cache service initialized', { defaultTTL });
  }

  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);
    
    if (!entry) {
      logger.debug('Cache miss', { key });
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      logger.debug('Cache entry expired', { key });
      return null;
    }

    logger.debug('Cache hit', { key });
    return entry.value as T;
  }

  async set<T>(key: string, value: T, options?: CacheOptions): Promise<void> {
    const ttl = options?.ttl ?? this.defaultTTL;
    const expiresAt = Date.now() + ttl;

    this.cache.set(key, {
      value,
      expiresAt
    });

    logger.debug('Cache set', { key, ttl });
  }

  async del(key: string): Promise<boolean> {
    const deleted = this.cache.delete(key);
    logger.debug('Cache delete', { key, deleted });
    return deleted;
  }

  async delPattern(pattern: string): Promise<number> {
    const regex = new RegExp(pattern.replace('*', '.*'));
    let count = 0;

    const keys = Array.from(this.cache.keys());
    for (const key of keys) {
      if (regex.test(key)) {
        this.cache.delete(key);
        count++;
      }
    }

    logger.info('Cache pattern delete', { pattern, count });
    return count;
  }

  async has(key: string): Promise<boolean> {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return false;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  async clear(): Promise<void> {
    const size = this.cache.size;
    this.cache.clear();
    logger.info('Cache cleared', { entriesRemoved: size });
  }

  size(): number {
    return this.cache.size;
  }

  getStats() {
    const now = Date.now();
    let expired = 0;
    let active = 0;

    const values = Array.from(this.cache.values());
    for (const entry of values) {
      if (now > entry.expiresAt) {
        expired++;
      } else {
        active++;
      }
    }

    return {
      total: this.cache.size,
      active,
      expired
    };
  }

  private startCleanup() {
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000);
  }

  private cleanup() {
    const now = Date.now();
    let removed = 0;

    const entries = Array.from(this.cache.entries());
    for (const [key, entry] of entries) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        removed++;
      }
    }

    if (removed > 0) {
      logger.debug('Cache cleanup completed', { removed });
    }
  }

  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.cache.clear();
    logger.info('Cache service destroyed');
  }
}

export const cacheService = new CacheService(
  parseInt(process.env.CACHE_DEFAULT_TTL || '3600000', 10)
);

export const getCacheKey = {
  nav: (schemeCode: string) => `nav:${schemeCode}`,
  navBatch: () => `nav:batch:*`,
  exchangeRate: (currency: string) => `exchange:${currency}`,
  exchangeRates: () => `exchange:*`,
  mutualFund: (id: string) => `mf:${id}`,
  mutualFunds: () => `mf:*`,
  bond: (id: string) => `bond:${id}`,
  bonds: () => `bond:*`,
  portfolio: (userId: string) => `portfolio:${userId}`,
  portfolios: () => `portfolio:*`,
  user: (id: string) => `user:${id}`,
  users: () => `user:*`,
};

export default cacheService;
