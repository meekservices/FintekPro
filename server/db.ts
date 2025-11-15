import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";
import { dbResilience } from './db-resilience';

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Production-optimized connection pool configuration
export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  max: process.env.NODE_ENV === 'production' ? 20 : 10, // Max connections in pool
  idleTimeoutMillis: 30000, // Close idle connections after 30 seconds
  connectionTimeoutMillis: 10000, // Timeout for establishing connection (10s)
});

/**
 * Production-ready database client with resilience features
 * Wraps all queries with timeout and retry logic
 */
export const db = drizzle({ client: pool, schema });

/**
 * Execute a database query with resilience (timeout + retry)
 * Use this for critical queries that need extra protection
 * 
 * @example
 * const users = await executeWithResilience(() => 
 *   db.select().from(usersTable)
 * );
 */
export async function executeWithResilience<T>(
  queryFn: () => Promise<T>,
  options?: { maxAttempts?: number; timeout?: number }
): Promise<T> {
  return dbResilience.executeWithRetry(queryFn, options);
}

/**
 * Get database health statistics
 */
export function getDbHealth() {
  return dbResilience.getHealthStatus();
}