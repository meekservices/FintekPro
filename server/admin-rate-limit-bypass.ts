/**
 * Admin Rate Limit Bypass Module
 * Provides secure, cached admin identification for rate limiter skip logic
 */

import { storage } from "./storage";
import { logger } from "./logger";

interface CacheEntry {
  isAdmin: boolean;
  timestamp: number;
}

class AdminCache {
  private cache = new Map<string, CacheEntry>();
  private readonly TTL = 5 * 60 * 1000; // 5 minutes
  private readonly MAX_ENTRIES = 1000; // Prevent memory bloat

  /**
   * Check if identifier is a known admin (with caching)
   */
  get(identifier: string): boolean | null {
    const entry = this.cache.get(identifier);
    if (!entry) return null;

    // Check if cache entry is still valid
    if (Date.now() - entry.timestamp > this.TTL) {
      this.cache.delete(identifier);
      return null;
    }

    return entry.isAdmin;
  }

  /**
   * Cache admin status for an identifier
   */
  set(identifier: string, isAdmin: boolean): void {
    // Prevent memory bloat
    if (this.cache.size >= this.MAX_ENTRIES) {
      // Remove oldest entries (simple FIFO)
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }

    this.cache.set(identifier, {
      isAdmin,
      timestamp: Date.now()
    });
  }

  /**
   * Invalidate cache for a specific identifier
   * Call this when admin roles change
   */
  invalidate(identifier: string): void {
    this.cache.delete(identifier);
  }

  /**
   * Clear entire cache
   * Call this when you need to force refresh all admin checks
   */
  clear(): void {
    this.cache.clear();
  }
}

// Singleton cache instance
const adminCache = new AdminCache();

/**
 * Safely check if a user is an admin with circuit breaker pattern
 * Returns null on errors to fail-safe to rate limiting
 */
async function isAdminSafe(identifier: string): Promise<boolean> {
  // Check cache first
  const cached = adminCache.get(identifier);
  if (cached !== null) {
    return cached;
  }

  try {
    // Set a timeout for DB lookup (2 seconds max)
    const timeoutPromise = new Promise<null>((_, reject) => 
      setTimeout(() => reject(new Error('Admin lookup timeout')), 2000)
    );

    const lookupPromise = (async () => {
      // Try to find user by email, userId, or mobile
      let user = null;
      
      // Check if it's an email
      if (identifier.includes('@')) {
        user = await storage.getUserByEmail(identifier);
      } 
      // Check if it's a userId (starts with FTP)
      else if (identifier.startsWith('FTP')) {
        user = await storage.getUserByUserId(identifier);
      }
      // Assume it's a mobile number
      else {
        user = await storage.getUserByMobile(identifier);
      }

      // Check if user has admin role
      const isAdmin = user?.roles?.includes('admin') || 
                     user?.roles?.includes('super_admin') || 
                     false;

      return isAdmin;
    })();

    // Race between lookup and timeout
    const result = await Promise.race([lookupPromise, timeoutPromise]);
    
    if (result === null) {
      // Timeout occurred
      logger.warn('Admin lookup timeout', { identifier });
      return false; // Fail-safe: enforce rate limiting
    }

    // Cache the result
    adminCache.set(identifier, result);
    return result;

  } catch (error) {
    // Log error but don't expose it
    logger.error('Admin lookup failed', { 
      identifier, 
      error: error instanceof Error ? error.message : String(error) 
    });
    
    // Fail-safe: enforce rate limiting on errors
    return false;
  }
}

/**
 * Rate limiter skip function - determines if request should bypass auth rate limiting
 */
export async function shouldSkipAuthRateLimit(req: any): Promise<boolean> {
  // Only apply to login endpoint
  if (!req.path || !req.path.includes('/login')) {
    return false;
  }

  try {
    // Safely extract identifier from request body
    const identifier = req.body?.identifier;
    
    // No identifier means malformed request - enforce rate limiting
    if (!identifier || typeof identifier !== 'string') {
      return false;
    }

    // Check if user is admin
    const isAdmin = await isAdminSafe(identifier);
    
    // Log admin bypass events for monitoring
    if (isAdmin) {
      logger.info('Admin rate limit bypass', { 
        identifier,
        path: req.path,
        ip: req.ip
      });
    }

    return isAdmin;

  } catch (error) {
    // Any error in skip logic should fail-safe to enforcing rate limit
    logger.error('Rate limit skip check failed', { 
      error: error instanceof Error ? error.message : String(error),
      path: req.path 
    });
    return false;
  }
}

/**
 * Invalidate admin cache for a user (call when roles change)
 */
export function invalidateAdminCache(identifier: string): void {
  adminCache.invalidate(identifier);
}

/**
 * Clear entire admin cache
 */
export function clearAdminCache(): void {
  adminCache.clear();
}
