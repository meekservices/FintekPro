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
 * Circuit breaker states
 */
enum CircuitState {
  CLOSED = 'CLOSED',    // Normal operation
  OPEN = 'OPEN',        // Too many failures, reject immediately
  HALF_OPEN = 'HALF_OPEN' // Testing if service recovered
}

/**
 * Circuit breaker for database lookups
 */
class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private successCount = 0; // Track consecutive successes in HALF_OPEN
  private lastFailureTime = 0;
  private readonly FAILURE_THRESHOLD = 5; // Open circuit after 5 consecutive failures
  private readonly RESET_TIMEOUT = 30000; // 30 seconds cooldown before trying again
  private readonly SUCCESS_THRESHOLD = 2; // Require 2 successes in HALF_OPEN to close circuit

  /**
   * Check if circuit allows request
   */
  canAttempt(): boolean {
    if (this.state === CircuitState.CLOSED) {
      return true;
    }

    if (this.state === CircuitState.OPEN) {
      // Check if enough time has passed to try half-open
      if (Date.now() - this.lastFailureTime > this.RESET_TIMEOUT) {
        this.state = CircuitState.HALF_OPEN;
        this.successCount = 0; // Reset success counter when entering HALF_OPEN
        logger.info('Circuit breaker entering HALF_OPEN state', { 
          failureCount: this.failureCount 
        });
        return true;
      }
      return false; // Still in cooldown
    }

    // HALF_OPEN state allows attempts
    return true;
  }

  /**
   * Record successful operation
   */
  recordSuccess(): void {
    if (this.state === CircuitState.HALF_OPEN) {
      // Increment success counter in HALF_OPEN
      this.successCount++;
      
      // Only close circuit after reaching SUCCESS_THRESHOLD
      if (this.successCount >= this.SUCCESS_THRESHOLD) {
        this.state = CircuitState.CLOSED;
        this.failureCount = 0;
        this.successCount = 0;
        logger.info('Circuit breaker closed after successful recovery', {
          successesRequired: this.SUCCESS_THRESHOLD
        });
      } else {
        logger.info('Circuit breaker HALF_OPEN success', {
          successCount: this.successCount,
          successesRequired: this.SUCCESS_THRESHOLD
        });
      }
    } else if (this.state === CircuitState.CLOSED) {
      // Reset failure count on success
      this.failureCount = 0;
    }
  }

  /**
   * Record failed operation
   */
  recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === CircuitState.HALF_OPEN) {
      // Failed during HALF_OPEN, reopen circuit and reset success counter
      this.state = CircuitState.OPEN;
      this.successCount = 0;
      logger.warn('Circuit breaker reopened after failed recovery attempt', {
        failureCount: this.failureCount
      });
    } else if (this.state === CircuitState.CLOSED && this.failureCount >= this.FAILURE_THRESHOLD) {
      // Too many failures, open circuit
      this.state = CircuitState.OPEN;
      logger.error('Circuit breaker opened due to repeated failures', {
        failureCount: this.failureCount,
        threshold: this.FAILURE_THRESHOLD
      });
    }
  }

  /**
   * Get current state for monitoring
   */
  getState(): { state: CircuitState; failureCount: number } {
    return { state: this.state, failureCount: this.failureCount };
  }
}

// Singleton circuit breaker instance
const circuitBreaker = new CircuitBreaker();

/**
 * Safely check if a user is an admin with circuit breaker pattern
 * Returns false on errors to fail-safe to rate limiting
 */
async function isAdminSafe(identifier: string): Promise<boolean> {
  // Check cache first
  const cached = adminCache.get(identifier);
  if (cached !== null) {
    return cached;
  }

  // Check if circuit breaker allows attempt
  if (!circuitBreaker.canAttempt()) {
    logger.warn('Admin lookup rejected by circuit breaker', { 
      identifier,
      ...circuitBreaker.getState()
    });
    return false; // Fail-safe: enforce rate limiting
  }

  try {
    // Set a timeout for DB lookup (2 seconds max)
    const timeoutPromise = new Promise<never>((_, reject) => 
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

    // Success - record with circuit breaker and cache result
    circuitBreaker.recordSuccess();
    adminCache.set(identifier, result);
    return result;

  } catch (error) {
    // Record failure with circuit breaker
    circuitBreaker.recordFailure();
    
    // Log error but don't expose it
    logger.error('Admin lookup failed', { 
      identifier, 
      error: error instanceof Error ? error.message : String(error),
      ...circuitBreaker.getState()
    });
    
    // Fail-safe: enforce rate limiting on errors
    return false;
  }
}

/**
 * Rate limiter skip function - determines if request should bypass auth rate limiting
 * 
 * Note: express.json() middleware is applied before this skip function,
 * so req.body is available for checking admin status
 */
export async function shouldSkipAuthRateLimit(req: any): Promise<boolean> {
  // Check the full URL (originalUrl) to determine if it's a login endpoint
  // req.path alone won't work because it's relative to the mount point
  const fullPath = req.originalUrl || req.baseUrl + req.path || req.path;
  if (!fullPath || !fullPath.includes('/login')) {
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
        path: fullPath,
        ip: req.ip
      });
    }

    return isAdmin;

  } catch (error) {
    // Any error in skip logic should fail-safe to enforcing rate limit
    logger.error('Rate limit skip check failed', { 
      error: error instanceof Error ? error.message : String(error),
      path: fullPath 
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
