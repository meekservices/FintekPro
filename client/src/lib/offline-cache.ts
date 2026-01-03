const DB_NAME = 'fintekpro-offline-cache';
const DB_VERSION = 1;
const STORES = {
  portfolio: 'portfolio-data',
  user: 'user-data',
  market: 'market-data'
} as const;

type StoreKey = keyof typeof STORES;

interface CachedData<T> {
  key: string;
  data: T;
  timestamp: number;
  expiresAt: number;
}

class OfflineCache {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  private async init(): Promise<void> {
    if (this.db) return;
    
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('[OfflineCache] Failed to open database');
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        Object.values(STORES).forEach(storeName => {
          if (!db.objectStoreNames.contains(storeName)) {
            db.createObjectStore(storeName, { keyPath: 'key' });
          }
        });
      };
    });

    return this.initPromise;
  }

  async set<T>(
    store: StoreKey,
    key: string,
    data: T,
    ttlMinutes: number = 60
  ): Promise<void> {
    await this.init();
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORES[store], 'readwrite');
      const objectStore = transaction.objectStore(STORES[store]);
      
      const cachedData: CachedData<T> = {
        key,
        data,
        timestamp: Date.now(),
        expiresAt: Date.now() + (ttlMinutes * 60 * 1000)
      };

      const request = objectStore.put(cachedData);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async get<T>(store: StoreKey, key: string): Promise<T | null> {
    await this.init();
    if (!this.db) return null;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORES[store], 'readonly');
      const objectStore = transaction.objectStore(STORES[store]);
      
      const request = objectStore.get(key);
      
      request.onsuccess = () => {
        const result = request.result as CachedData<T> | undefined;
        
        if (!result) {
          resolve(null);
          return;
        }

        if (Date.now() > result.expiresAt) {
          this.delete(store, key);
          resolve(null);
          return;
        }

        resolve(result.data);
      };
      
      request.onerror = () => reject(request.error);
    });
  }

  async delete(store: StoreKey, key: string): Promise<void> {
    await this.init();
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORES[store], 'readwrite');
      const objectStore = transaction.objectStore(STORES[store]);
      
      const request = objectStore.delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async clear(store: StoreKey): Promise<void> {
    await this.init();
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORES[store], 'readwrite');
      const objectStore = transaction.objectStore(STORES[store]);
      
      const request = objectStore.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getWithFallback<T>(
    store: StoreKey,
    key: string,
    fetcher: () => Promise<T>,
    ttlMinutes: number = 60
  ): Promise<{ data: T; fromCache: boolean; timestamp: Date | null }> {
    const cached = await this.get<T>(store, key);
    
    if (cached !== null) {
      fetcher().then(freshData => {
        this.set(store, key, freshData, ttlMinutes);
      }).catch(() => {});
      
      return { data: cached, fromCache: true, timestamp: null };
    }

    try {
      const freshData = await fetcher();
      await this.set(store, key, freshData, ttlMinutes);
      return { data: freshData, fromCache: false, timestamp: new Date() };
    } catch (error) {
      const staleData = await this.getStale<T>(store, key);
      if (staleData) {
        return { data: staleData, fromCache: true, timestamp: null };
      }
      throw error;
    }
  }

  private async getStale<T>(store: StoreKey, key: string): Promise<T | null> {
    await this.init();
    if (!this.db) return null;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORES[store], 'readonly');
      const objectStore = transaction.objectStore(STORES[store]);
      
      const request = objectStore.get(key);
      
      request.onsuccess = () => {
        const result = request.result as CachedData<T> | undefined;
        resolve(result?.data ?? null);
      };
      
      request.onerror = () => reject(request.error);
    });
  }

  async getCacheInfo(store: StoreKey, key: string): Promise<{
    exists: boolean;
    timestamp: Date | null;
    isExpired: boolean;
  }> {
    await this.init();
    if (!this.db) return { exists: false, timestamp: null, isExpired: false };

    return new Promise((resolve) => {
      const transaction = this.db!.transaction(STORES[store], 'readonly');
      const objectStore = transaction.objectStore(STORES[store]);
      
      const request = objectStore.get(key);
      
      request.onsuccess = () => {
        const result = request.result as CachedData<unknown> | undefined;
        
        if (!result) {
          resolve({ exists: false, timestamp: null, isExpired: false });
          return;
        }

        resolve({
          exists: true,
          timestamp: new Date(result.timestamp),
          isExpired: Date.now() > result.expiresAt
        });
      };
      
      request.onerror = () => {
        resolve({ exists: false, timestamp: null, isExpired: false });
      };
    });
  }
}

export const offlineCache = new OfflineCache();

export function useOfflineCache<T>(
  store: StoreKey,
  key: string,
  options?: {
    ttlMinutes?: number;
    enabled?: boolean;
  }
) {
  const cacheKey = `${store}:${key}`;
  
  return {
    async get(): Promise<T | null> {
      if (options?.enabled === false) return null;
      return offlineCache.get<T>(store, key);
    },
    
    async set(data: T): Promise<void> {
      if (options?.enabled === false) return;
      return offlineCache.set(store, key, data, options?.ttlMinutes);
    },
    
    async invalidate(): Promise<void> {
      return offlineCache.delete(store, key);
    },
    
    cacheKey
  };
}
