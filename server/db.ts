import { drizzle } from 'drizzle-orm/node-postgres';
import pkg from 'pg';
const { Pool } = pkg;
import * as schema from '@shared/schema';
import fs from 'fs';

/**
 * DATABASE CONNECTION LOGIC
 * 
 * Production: Uses Google Cloud SQL Unix Sockets via /cloudsql mount.
 * Development: Uses TCP (127.0.0.1:5432).
 */

const isProduction = process.env.NODE_ENV === "production";
const instanceConnectionName = process.env.INSTANCE_CONNECTION_NAME || "fintekpro:asia-south1:fintekpro-db";

// Configuration defaults
let user = 'postgres';
let password = process.env.DB_PASSWORD || 'Kamini@321';
let database = 'fintekpro';
let host = '127.0.0.1';
let port = 5432;

// Parse connection URL if provided (standard practice in many environments)
const dbUrl = process.env.PRODUCTION_DATABASE_URL || process.env.DATABASE_URL;

// Build Pool Configuration
const POOL_CONFIG: any = {
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
};

if (dbUrl) {
    // Use connectionString directly - pg will handle parsing and special characters correctly
  POOL_CONFIG.connectionString = dbUrl;

  // Safely extract database name for logging without exposing credentials
  try {
        // We use a regex instead of URL to avoid throwing on malformed URLs with unencoded @
      const dbMatch = dbUrl.match(/\/([^\/?#]+)(\?|$)/);
        const dbName = dbMatch ? dbMatch[1] : 'unknown';
        console.log(`[DB] Using DATABASE_URL for database: ${dbName} (Production: ${isProduction})`);
  } catch (e) {
        console.log(`[DB] Using provided DATABASE_URL (Production: ${isProduction})`);
  }
} else {
    POOL_CONFIG.user = user;
    POOL_CONFIG.password = password;
    POOL_CONFIG.database = database;
    POOL_CONFIG.host = host;
    POOL_CONFIG.port = port;
    console.log(`[DB] No DATABASE_URL found. Using default parameters.`);
}

if (isProduction) {
    console.log(`[DB] Production Diagnostics:`);
    console.log(`[DB] - INSTANCE_CONNECTION_NAME: ${instanceConnectionName}`);
    console.log(`[DB] - DATABASE_URL defined: ${!!dbUrl}`);

  try {
        const rootDir = '/cloudsql';
        if (fs.existsSync(rootDir)) {
                const contents = fs.readdirSync(rootDir);
                console.log(`[DB] ${rootDir} exists. Contents: ${JSON.stringify(contents)}`);
        } else {
                console.error(`[DB] ${rootDir} directory does NOT exist.`);
                // Check root just in case
          try {
                    const rootItems = fs.readdirSync('/');
                    if (rootItems.includes('cloudsql')) {
                                console.log(`[DB] /cloudsql found in root listing but existsSync failed.`);
                    }
          } catch (e) {}
        }
  } catch (err) {
        console.error(`[DB] Error checking /cloudsql: ${err instanceof Error ? err.message : String(err)}`);
  }

  const socketPath = `/cloudsql/${instanceConnectionName}`;

  if (dbUrl) {
        // If DATABASE_URL already contains ?host=/cloudsql/..., pg handles the socket natively.
      // Do NOT override POOL_CONFIG.host 
      if (dbUrl.includes('/cloudsql/')) {
              console.log(`[DB] Production Mode: DATABASE_URL has embedded Unix Socket path. Letting pg handle routing.`);
      } else if (fs.existsSync(socketPath)) {
              // URL exists but doesn't specify socket - inject it
          console.log(`[DB] Injecting Unix Socket host override: ${socketPath}`);
              POOL_CONFIG.host = socketPath;
              delete POOL_CONFIG.port;
      } else {
              console.warn(`[DB] Socket not found at ${socketPath}. Proceeding with DATABASE_URL as-is (TCP or proxy).`);
      }
  }
} else if (!dbUrl) {
    console.log(`[DB] Development Mode: Connecting to ${host}:${port}`);
}

// Initialize the Pool
export const pool = new Pool(POOL_CONFIG);

// Error handling for the pool
pool.on('error', (err) => {
    console.error('[DB] Unexpected error on idle client', err);
});

// Initialize Drizzle
export const db = drizzle(pool, { schema });

// Export connection tester
export const testConnection = async () => {
    const client = await pool.connect();
    try {
          const res = await client.query('SELECT NOW()');
          return { success: true, timestamp: res.rows[0].now };
    } finally {
          client.release();
    }
};
