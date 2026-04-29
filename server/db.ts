import { drizzle } from 'drizzle-orm/node-postgres';
import pkg from 'pg';
const { Pool } = pkg;
import * as schema from "@shared/schema";
import { log } from "./vite";

/**
 * Database connection management.
 * In production, we prioritize CLOUD_SQL_CONNECTION_NAME via unix domain sockets
 * or falls back to DATABASE_URL (for Railway/Local).
 */

if (!process.env.DATABASE_URL && !process.env.PRODUCTION_DATABASE_URL) {
  throw new Error(
    "DATABASE_URL or PRODUCTION_DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const connectionString = process.env.PRODUCTION_DATABASE_URL || process.env.DATABASE_URL;

// Pool configuration with optimized production defaults
export const pool = new Pool({
  connectionString,
  // Cloud Run optimization: Limit pool size to manage connections effectively
  max: process.env.NODE_ENV === 'production' ? 10 : 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  // SSL is required for most external connections (Railway/Neon) 
  // but handled via Unix socket for Cloud SQL.
  // We enable it by default if connection is not local/unix.
  ssl: connectionString?.includes('localhost') || connectionString?.includes('/cloudsql/') 
    ? false 
    : { rejectUnauthorized: false }
});

// Periodic pool health check
pool.on('error', (err) => {
  log(`CRITICAL: Unexpected error on idle database client: ${err.message}`);
});

export const db = drizzle(pool, { schema });
